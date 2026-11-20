import { NextResponse } from "next/server";
import { AGENTS, AgentId } from "@/lib/agents";
import { getCurrentGoogleId } from "@/lib/current-user";
import db from "@/lib/db";
import { getUserSettings } from "@/lib/user-settings";

const scheduleColumns =
  "id, city_id, name, agent, task, weekday, local_time, time_zone, enabled, last_run_date, last_started_at, last_finished_at, last_status, last_error, created_at";

type ScheduleInput = {
  cityId: number;
  name: string;
  agent: AgentId;
  task: string;
  weekday: number;
  localTime: string;
  timeZone: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isScheduleInput(value: unknown): value is ScheduleInput {
  if (!isRecord(value)) return false;
  return (
    typeof value.cityId === "number" &&
    Number.isSafeInteger(value.cityId) &&
    value.cityId > 0 &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    value.name.length <= 80 &&
    typeof value.agent === "string" &&
    Object.hasOwn(AGENTS, value.agent) &&
    typeof value.task === "string" &&
    value.task.trim().length > 0 &&
    value.task.length <= 2000 &&
    typeof value.weekday === "number" &&
    Number.isInteger(value.weekday) &&
    value.weekday >= 0 &&
    value.weekday <= 6 &&
    typeof value.localTime === "string" &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.localTime) &&
    typeof value.timeZone === "string" &&
    value.timeZone.length <= 100
  );
}

function serializeJob(row: Record<string, unknown>) {
  return { ...row, enabled: row.enabled === 1 };
}

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) return NextResponse.json({ error: "Sign in to view scheduled jobs." }, { status: 401 });

  const cityId = Number(new URL(request.url).searchParams.get("cityId"));
  if (!Number.isSafeInteger(cityId) || cityId <= 0) {
    return NextResponse.json({ error: "A valid cityId is required." }, { status: 400 });
  }

  const city = db.prepare("SELECT id FROM cities WHERE id = ? AND owner_id = ?").get(cityId, ownerId);
  if (!city) return NextResponse.json({ error: "City not found." }, { status: 404 });

  const jobs = db
    .prepare(`SELECT ${scheduleColumns} FROM scheduled_jobs WHERE city_id = ? AND owner_id = ? ORDER BY id DESC`)
    .all(cityId, ownerId) as Record<string, unknown>[];
  return NextResponse.json({ jobs: jobs.map(serializeJob) });
}

export async function POST(request: Request) {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) return NextResponse.json({ error: "Sign in to create scheduled jobs." }, { status: 401 });

  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!isScheduleInput(value)) {
    return NextResponse.json({ error: "Provide a valid city, job, agent, day, time, and time zone." }, { status: 400 });
  }
  if (!getUserSettings(ownerId).enabledAgents.includes(value.agent)) {
    return NextResponse.json({ error: `${AGENTS[value.agent].name} is disabled in Settings.` }, { status: 409 });
  }
  if (!isValidTimeZone(value.timeZone)) {
    return NextResponse.json({ error: "Provide a valid IANA time zone, such as Asia/Kolkata." }, { status: 400 });
  }

  const city = db
    .prepare("SELECT id FROM cities WHERE id = ? AND owner_id = ?")
    .get(value.cityId, ownerId);
  if (!city) return NextResponse.json({ error: "City not found." }, { status: 404 });

  const result = db.prepare(`
    INSERT INTO scheduled_jobs
      (city_id, owner_id, name, agent, task, weekday, local_time, time_zone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    value.cityId,
    ownerId,
    value.name.trim(),
    value.agent,
    value.task.trim(),
    value.weekday,
    value.localTime,
    value.timeZone,
  );
  const job = db.prepare(`SELECT ${scheduleColumns} FROM scheduled_jobs WHERE id = ? AND owner_id = ?`)
    .get(result.lastInsertRowid, ownerId) as Record<string, unknown>;

  return NextResponse.json({ job: serializeJob(job) }, { status: 201 });
}
