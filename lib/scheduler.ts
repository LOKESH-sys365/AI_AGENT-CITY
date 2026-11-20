import { AGENTS, AgentId } from "./agents";
import db from "./db";
import { validateCityRoot } from "./fs-tools";
import { saveAgentOutput } from "./output-store";
import { LogItem, runAgent, Turn } from "./run";
import { getUserSettings } from "./user-settings";

type ScheduledJob = {
  id: number;
  city_id: number;
  owner_id: string;
  name: string;
  agent: AgentId;
  task: string;
  weekday: number;
  local_time: string;
  time_zone: string;
  enabled: number;
  last_run_date: string | null;
  last_started_at: string | null;
  last_status: "running" | "success" | "failed" | null;
  created_at: string;
};

const weekdayNumbers: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function localMoment(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
    weekday: weekdayNumbers[values.weekday],
  };
}

function isDue(job: ScheduledJob, now: Date) {
  const current = localMoment(now, job.time_zone);
  if (current.weekday !== job.weekday || current.time < job.local_time) return false;
  if (job.last_run_date === current.date) return false;

  const createdAt = new Date(`${job.created_at.replace(" ", "T")}Z`);
  const created = localMoment(createdAt, job.time_zone);
  return created.date !== current.date || created.time < job.local_time;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected scheduled-job error.";
}

function getJob(jobId: number, ownerId?: string) {
  const sql = ownerId
    ? "SELECT * FROM scheduled_jobs WHERE id = ? AND owner_id = ?"
    : "SELECT * FROM scheduled_jobs WHERE id = ?";
  return (ownerId
    ? db.prepare(sql).get(jobId, ownerId)
    : db.prepare(sql).get(jobId)) as ScheduledJob | undefined;
}

export async function runScheduledJob(
  jobId: number,
  options: { ownerId?: string; force?: boolean } = {},
) {
  const job = getJob(jobId, options.ownerId);
  if (!job) throw new Error("Scheduled job not found.");
  if (!options.force && (!job.enabled || !isDue(job, new Date()))) return false;
  const settings = getUserSettings(job.owner_id);
  if (!settings.enabledAgents.includes(job.agent)) {
    if (options.force) throw new Error(`${AGENTS[job.agent].name} is disabled in Settings.`);
    return false;
  }

  const runDate = localMoment(new Date(), job.time_zone).date;
  const claim = db.prepare(`
    UPDATE scheduled_jobs
    SET last_run_date = ?, last_started_at = CURRENT_TIMESTAMP,
        last_finished_at = NULL, last_status = 'running', last_error = NULL
    WHERE id = ?
      AND (? = 1 OR enabled = 1)
      AND (? = 1 OR last_run_date IS NULL OR last_run_date <> ?)
      AND (
        last_status IS NULL OR last_status <> 'running'
        OR last_started_at < datetime('now', '-2 hours')
      )
  `).run(runDate, job.id, options.force ? 1 : 0, options.force ? 1 : 0, runDate);

  if (claim.changes !== 1) {
    if (options.force) throw new Error("This scheduled job is already running.");
    return false;
  }

  try {
    const city = db
      .prepare("SELECT root_path FROM cities WHERE id = ? AND owner_id = ?")
      .get(job.city_id, job.owner_id) as { root_path: string } | undefined;
    if (!city) throw new Error("The city for this scheduled job no longer exists.");

    const cityRoot = await validateCityRoot(city.root_path, settings.cityRoot);
    const log: LogItem[] = [];
    const history: Turn[] = [{ role: "user", content: job.task }];
    await runAgent(
      job.agent,
      history,
      log,
      cityRoot,
      (agent, content) => saveAgentOutput(job.city_id, agent, content, cityRoot, settings.cityRoot),
      undefined,
      settings,
    );

    db.prepare(`
      UPDATE scheduled_jobs
      SET last_status = 'success', last_finished_at = CURRENT_TIMESTAMP, last_error = NULL
      WHERE id = ?
    `).run(job.id);
    return true;
  } catch (error) {
    const message = errorMessage(error).slice(0, 2000);
    db.prepare(`
      UPDATE scheduled_jobs
      SET last_status = 'failed', last_finished_at = CURRENT_TIMESTAMP, last_error = ?
      WHERE id = ?
    `).run(message, job.id);
    throw error;
  }
}

async function pollDueJobs() {
  const jobs = db
    .prepare("SELECT * FROM scheduled_jobs WHERE enabled = 1")
    .all() as ScheduledJob[];

  for (const job of jobs) {
    try {
      if (isDue(job, new Date())) await runScheduledJob(job.id);
    } catch (error) {
      console.error(`Scheduled job ${job.id} (${AGENTS[job.agent].name}) failed:`, errorMessage(error));
    }
  }
}

type SchedulerGlobal = typeof globalThis & {
  __agentCitySchedulerTimer?: ReturnType<typeof setInterval>;
  __agentCitySchedulerRunning?: boolean;
};

export function startLocalScheduler() {
  const scheduler = globalThis as SchedulerGlobal;
  if (scheduler.__agentCitySchedulerTimer) return;

  const tick = async () => {
    if (scheduler.__agentCitySchedulerRunning) return;
    scheduler.__agentCitySchedulerRunning = true;
    try {
      await pollDueJobs();
    } catch (error) {
      console.error("Could not check scheduled jobs:", errorMessage(error));
    } finally {
      scheduler.__agentCitySchedulerRunning = false;
    }
  };

  scheduler.__agentCitySchedulerTimer = setInterval(() => {
    void tick();
  }, 30_000);
  scheduler.__agentCitySchedulerTimer.unref();
  void tick();
}
