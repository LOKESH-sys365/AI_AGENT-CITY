"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { AGENTS, AgentId } from "@/lib/agents";
import type { UserSettings } from "@/lib/user-settings";

const agentIds = Object.keys(AGENTS) as AgentId[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSettings(value: unknown): value is UserSettings {
  return (
    isRecord(value) &&
    typeof value.model === "string" &&
    typeof value.cityRoot === "string" &&
    Array.isArray(value.enabledAgents) &&
    value.enabledAgents.every((agent) => typeof agent === "string" && Object.hasOwn(AGENTS, agent))
  );
}

function responseError(value: unknown) {
  return isRecord(value) && typeof value.error === "string" ? value.error : "Could not save settings.";
}

export default function SettingsForm({
  initialSettings,
  rootLocked,
}: {
  initialSettings: UserSettings;
  rootLocked: boolean;
}) {
  const [model, setModel] = useState(initialSettings.model);
  const [cityRoot, setCityRoot] = useState(initialSettings.cityRoot);
  const [enabledAgents, setEnabledAgents] = useState<AgentId[]>(initialSettings.enabledAgents);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function toggleAgent(agent: AgentId) {
    setEnabledAgents((current) =>
      current.includes(agent) ? current.filter((id) => id !== agent) : [...current, agent],
    );
    setSaved(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, cityRoot, enabledAgents }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(responseError(result));
      if (!isRecord(result) || !isSettings(result.settings)) {
        throw new Error("The server returned invalid settings.");
      }

      setModel(result.settings.model);
      setCityRoot(result.settings.cityRoot);
      setEnabledAgents(result.settings.enabledAgents);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="settings-shell">
      <section className="settings-card">
        <nav className="settings-navigation" aria-label="Settings navigation">
          <Link href="/dashboard">← Dashboard</Link>
        </nav>
        <p className="dashboard-kicker">LOCAL AGENT CITY</p>
        <h1>Settings</h1>
        <p className="settings-intro">These settings apply to your signed-in account on this Agent City installation.</p>
        <form className="settings-form" onSubmit={save}>
          <label>
            Ollama model
            <input
              value={model}
              onChange={(event) => {
                setModel(event.target.value);
                setSaved(false);
              }}
              maxLength={128}
              placeholder="llama3.2:3b"
              required
            />
            <span>Use an installed local model name, for example llama3.2:3b. No API key or paid service is used.</span>
          </label>
          <label>
            CITY_ROOT
            <input
              value={cityRoot}
              onChange={(event) => {
                setCityRoot(event.target.value);
                setSaved(false);
              }}
              maxLength={1024}
              spellCheck={false}
              disabled={rootLocked}
              required
            />
            <span>
              New cities get their own subfolder here.
              {rootLocked ? " Locked because this account already has cities." : " Choose it before building cities."}
            </span>
          </label>
          <fieldset className="settings-agents">
            <legend>Agents</legend>
            <p>Turn agents off to prevent direct chat, delegation, and scheduled runs.</p>
            {agentIds.map((id) => (
              <label key={id} className="settings-agent">
                <input
                  type="checkbox"
                  checked={enabledAgents.includes(id)}
                  onChange={() => toggleAgent(id)}
                />
                <span className="settings-agent-name">{AGENTS[id].name}</span>
                <span>{AGENTS[id].blurb}</span>
              </label>
            ))}
          </fieldset>
          {error && <p className="settings-error" role="alert">{error}</p>}
          {saved && <p className="settings-success" role="status">Settings saved.</p>}
          <button type="submit" className="settings-save" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </form>
      </section>
    </main>
  );
}
