"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { AGENTS, AgentId } from "@/lib/agents";

const CityScene = dynamic(() => import("./city-scene"), {
  ssr: false,
  loading: () => <div className="city-scene city-scene-loading">Loading the 3D city…</div>,
});

type Message = { role: "user" | "assistant"; content: string };
type LogItem = { agent: AgentId; tool: string; input: Record<string, unknown> };
type ScheduledJob = {
  id: number;
  name: string;
  agent: AgentId;
  task: string;
  weekday: number;
  local_time: string;
  time_zone: string;
  enabled: boolean;
  last_started_at: string | null;
  last_status: "running" | "success" | "failed" | null;
  last_error: string | null;
};
const agentIds = Object.keys(AGENTS) as AgentId[];
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weeklyPlanTask =
  "Review Planner/tasks.md and relevant city notes, then create or update Planner/week.md with a realistic plan for the upcoming week. Only change files in this city.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAgentId(value: unknown): value is AgentId {
  return typeof value === "string" && Object.hasOwn(AGENTS, value);
}

function isLogItem(value: unknown): value is LogItem {
  return (
    isRecord(value) &&
    isAgentId(value.agent) &&
    typeof value.tool === "string" &&
    isRecord(value.input)
  );
}

function isChatResponse(value: unknown): value is { reply: string; log: LogItem[] } {
  return (
    isRecord(value) &&
    typeof value.reply === "string" &&
    Array.isArray(value.log) &&
    value.log.every(isLogItem)
  );
}

function isScheduledJob(value: unknown): value is ScheduledJob {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.name === "string" &&
    isAgentId(value.agent) &&
    typeof value.task === "string" &&
    typeof value.weekday === "number" &&
    typeof value.local_time === "string" &&
    typeof value.time_zone === "string" &&
    typeof value.enabled === "boolean" &&
    (value.last_started_at === null || typeof value.last_started_at === "string") &&
    (value.last_status === null ||
      value.last_status === "running" ||
      value.last_status === "success" ||
      value.last_status === "failed") &&
    (value.last_error === null || typeof value.last_error === "string")
  );
}

function responseError(value: unknown, fallback: string) {
  if (isRecord(value)) {
    if (typeof value.error === "string") return value.error;
    if (typeof value.reply === "string") return value.reply;
  }
  return fallback;
}

function logDetail(input: Record<string, unknown>) {
  for (const key of ["path", "agent", "from"]) {
    if (typeof input[key] === "string") return input[key];
  }
  return "";
}

export default function CityWorkspace({
  cityId,
  cityName,
  enabledAgents,
}: {
  cityId: number;
  cityName: string;
  enabledAgents: AgentId[];
}) {
  const initialAgent = enabledAgents.includes("mayor") ? "mayor" : enabledAgents[0] ?? "mayor";
  const [selectedAgent, setSelectedAgent] = useState<AgentId>(initialAgent);
  const [chats, setChats] = useState<Record<string, Message[]>>({});
  const [log, setLog] = useState<LogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState("");
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([]);
  const [scheduleName, setScheduleName] = useState("Weekly plan");
  const [scheduleAgent, setScheduleAgent] = useState<AgentId>(
    enabledAgents.includes("planner") ? "planner" : enabledAgents[0] ?? "planner",
  );
  const [scheduleTask, setScheduleTask] = useState(weeklyPlanTask);
  const [scheduleWeekday, setScheduleWeekday] = useState(0);
  const [scheduleTime, setScheduleTime] = useState("01:50");
  const [scheduleTimeZone, setScheduleTimeZone] = useState("Asia/Kolkata");
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [busyScheduleId, setBusyScheduleId] = useState<number | null>(null);
  const agent = AGENTS[selectedAgent];
  const messages = chats[selectedAgent] || [];
  const activeAgents = new Set(log.map((item) => item.agent));
  const selectedAgentEnabled = enabledAgents.includes(selectedAgent);

  function selectEnabledAgent(id: AgentId) {
    if (enabledAgents.includes(id)) setSelectedAgent(id);
  }

  const loadSchedules = useCallback(async () => {
    try {
      const response = await fetch(`/api/schedules?cityId=${cityId}`);
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(responseError(result, "Could not load scheduled jobs."));
      if (
        !isRecord(result) ||
        !Array.isArray(result.jobs) ||
        !result.jobs.every(isScheduledJob)
      ) {
        throw new Error("The server returned an invalid scheduled-job list.");
      }
      setScheduledJobs(result.jobs);
      setScheduleError("");
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : "Could not load scheduled jobs.");
    } finally {
      setScheduleLoading(false);
    }
  }, [cityId]);

  useEffect(() => {
    void loadSchedules();
    const timer = window.setInterval(() => void loadSchedules(), 30_000);
    return () => window.clearInterval(timer);
  }, [loadSchedules]);

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (scheduleBusy) return;

    setScheduleBusy(true);
    setScheduleError("");
    try {
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityId,
          name: scheduleName,
          agent: scheduleAgent,
          task: scheduleTask,
          weekday: scheduleWeekday,
          localTime: scheduleTime,
          timeZone: scheduleTimeZone,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(responseError(result, "Could not create the schedule."));
      if (!isRecord(result)) {
        throw new Error("The server returned an invalid scheduled job.");
      }
      const job = result.job;
      if (!isScheduledJob(job)) throw new Error("The server returned an invalid scheduled job.");
      setScheduledJobs((current) => [job, ...current]);
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : "Could not create the schedule.");
    } finally {
      setScheduleBusy(false);
    }
  }

  async function updateSchedule(job: ScheduledJob, action: "toggle" | "run" | "delete") {
    if (busyScheduleId !== null) return;
    if (action === "delete" && !window.confirm(`Delete the "${job.name}" schedule?`)) return;

    setBusyScheduleId(job.id);
    setScheduleError("");
    try {
      const response = action === "run"
        ? await fetch(`/api/schedules/${job.id}/run`, { method: "POST" })
        : action === "delete"
          ? await fetch(`/api/schedules/${job.id}`, { method: "DELETE" })
          : await fetch(`/api/schedules/${job.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ enabled: !job.enabled }),
            });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(responseError(result, `Could not ${action} the schedule.`));
      if (action === "delete") {
        setScheduledJobs((current) => current.filter((item) => item.id !== job.id));
      } else {
        await loadSchedules();
      }
    } catch (error) {
      await loadSchedules();
      setScheduleError(error instanceof Error ? error.message : `Could not ${action} the schedule.`);
    } finally {
      setBusyScheduleId(null);
    }
  }

  async function send() {
    const content = text.trim();
    if (!content || busy || !selectedAgentEnabled) return;

    const agentId = selectedAgent;
    const history = [...(chats[agentId] || []), { role: "user" as const, content }];
    setChats((current) => ({ ...current, [agentId]: history }));
    setText("");
    setBusy(true);
    setSendError("");
    setLog([]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId, agent: agentId, history }),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(responseError(result, `Agent request failed (${response.status}).`));
      }
      if (!isChatResponse(result)) {
        throw new Error("The agent returned an invalid response.");
      }

      setLog(result.log);
      setChats((current) => ({
        ...current,
        [agentId]: [...history, { role: "assistant", content: result.reply }],
      }));
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "The agent request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="city">
      <section className="map">
        <div className="map-heading">
          <div>
            <p className="city-context">{cityName}</p>
            <h1>Agent City</h1>
          </div>
          <nav className="city-navigation" aria-label="City navigation">
            <Link className="city-auth-link" href={`/city/${cityId}/documents`}>Documents</Link>
            <Link className="city-auth-link" href="/dashboard">All cities</Link>
            <Link className="city-auth-link" href="/settings">Settings</Link>
            <button type="button" onClick={() => signOut({ redirectTo: "/login" })}>
              Log out
            </button>
          </nav>
        </div>
        <p className="sub">Pick a building to talk to its agent, or go to Town Hall and ask for anything.</p>
        <CityScene selectedAgent={selectedAgent} onSelect={selectEnabledAgent} />
        <p className="city-scene-hint">Click a building to select its agent. Drag to orbit; scroll to zoom.</p>
        <div className="agent-picker" aria-label="Choose an agent">
          {agentIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => selectEnabledAgent(id)}
              disabled={!enabledAgents.includes(id)}
              className={`agent-picker-button ${selectedAgent === id ? "on" : ""} ${busy && activeAgents.has(id) ? "work" : ""} ${!enabledAgents.includes(id) ? "off" : ""}`}
              style={{ "--agent-color": AGENTS[id].color } as CSSProperties}
              aria-pressed={selectedAgent === id}
            >
              <span className="agent-picker-swatch" aria-hidden="true" />
              <span>{AGENTS[id].place}{enabledAgents.includes(id) ? "" : " · Off"}</span>
            </button>
          ))}
        </div>
        <section className="scheduled-jobs" aria-labelledby="scheduled-jobs-title">
          <div className="scheduled-jobs-heading">
            <div>
              <h2 id="scheduled-jobs-title">Scheduled jobs</h2>
              <p>Runs while Agent City is open. Jobs can edit files in this city.</p>
            </div>
          </div>
          <form className="schedule-form" onSubmit={createSchedule}>
            <label>
              Job name
              <input value={scheduleName} onChange={(event) => setScheduleName(event.target.value)} maxLength={80} required />
            </label>
            <label>
              Agent
              <select value={scheduleAgent} onChange={(event) => {
                if (isAgentId(event.target.value)) setScheduleAgent(event.target.value);
              }}>
                {agentIds.filter((id) => enabledAgents.includes(id)).map((id) => <option key={id} value={id}>{AGENTS[id].name}</option>)}
              </select>
            </label>
            <label>
              Runs every
              <select value={scheduleWeekday} onChange={(event) => setScheduleWeekday(Number(event.target.value))}>
                {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
            </label>
            <label>
              Local time
              <input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} required />
            </label>
            <label className="schedule-time-zone">
              Time zone
              <input value={scheduleTimeZone} onChange={(event) => setScheduleTimeZone(event.target.value)} maxLength={100} required />
            </label>
            <label className="schedule-task">
              Task
              <textarea value={scheduleTask} onChange={(event) => setScheduleTask(event.target.value)} maxLength={2000} rows={3} required />
            </label>
            <button type="submit" disabled={scheduleBusy || !enabledAgents.includes(scheduleAgent)}>
              {scheduleBusy ? "Saving…" : "Add schedule"}
            </button>
          </form>
          {scheduleError && <p className="city-error" role="alert">{scheduleError}</p>}
          {scheduleLoading ? (
            <p className="mute">Loading schedules…</p>
          ) : scheduledJobs.length === 0 ? (
            <p className="mute">No scheduled jobs yet.</p>
          ) : (
            <ul className="scheduled-job-list">
              {scheduledJobs.map((job) => (
                <li key={job.id} className="scheduled-job">
                  <div className="scheduled-job-details">
                    <strong>{job.name}</strong>
                    <span>{AGENTS[job.agent].name} · {weekdays[job.weekday]} {job.local_time} · {job.time_zone}</span>
                    <span>{job.enabled ? "Enabled" : "Paused"}{!enabledAgents.includes(job.agent) ? " · Agent disabled in Settings" : ""}{job.last_status ? ` · Last run: ${job.last_status}` : ""}</span>
                    {job.last_error && <span className="city-error">{job.last_error}</span>}
                  </div>
                  <div className="scheduled-job-actions">
                    <button type="button" disabled={busyScheduleId !== null || !enabledAgents.includes(job.agent)} onClick={() => void updateSchedule(job, "run")}>Run now</button>
                    <button type="button" disabled={busyScheduleId !== null} onClick={() => void updateSchedule(job, "toggle")}>{job.enabled ? "Pause" : "Enable"}</button>
                    <button type="button" disabled={busyScheduleId !== null} onClick={() => void updateSchedule(job, "delete")}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="feed" aria-live="polite">
          <h2>Street activity</h2>
          {log.length === 0 && <p className="mute">Nothing moving yet.</p>}
          {log.map((item, index) => (
            <p key={`${item.agent}-${item.tool}-${index}`}>
              <span style={{ color: AGENTS[item.agent].color }}>{AGENTS[item.agent].name}</span>{" "}
              {item.tool.replaceAll("_", " ")} {logDetail(item.input)}
            </p>
          ))}
        </div>
      </section>

      <section className="chat" aria-label={`${agent.name} chat`}>
        <h2 style={{ color: agent.color }}>{agent.place}</h2>
        <div className="msgs" aria-live="polite">
          {messages.length === 0 && (
            <p className="mute">
              {selectedAgentEnabled
                ? `${agent.blurb} Try: ${selectedAgent === "mayor" ? "“Sort my Library and add this week's tasks.”" : "“What do you see in your folder?”"}`
                : "All agents are off. Enable an agent from Settings to start a conversation."}
            </p>
          )}
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={message.role}>{message.content}</div>
          ))}
          {busy && <div className="assistant mute">Working…</div>}
        </div>
        {sendError && <p className="city-error" role="alert">{sendError}</p>}
        <div className="row">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={!selectedAgentEnabled}
            onKeyDown={(event) => {
              if (event.key === "Enter") void send();
            }}
            placeholder={`Message the ${agent.name}`}
            aria-label={`Message the ${agent.name}`}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || !text.trim() || !selectedAgentEnabled}
            style={{ background: agent.color }}
          >
            {busy ? "Working…" : "Send"}
          </button>
        </div>
      </section>
    </main>
  );
}
