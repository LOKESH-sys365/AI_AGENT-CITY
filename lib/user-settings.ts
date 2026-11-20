import { AGENTS, AgentId } from "./agents";
import { CITY_ROOT } from "./fs-tools";
import db from "./db";

export type UserSettings = {
  model: string;
  cityRoot: string;
  enabledAgents: AgentId[];
};

const defaultModel = process.env.OLLAMA_MODEL || "llama3.2:3b";
const allAgents = Object.keys(AGENTS) as AgentId[];

function isAgentId(value: unknown): value is AgentId {
  return typeof value === "string" && Object.hasOwn(AGENTS, value);
}

export function getUserSettings(googleId: string): UserSettings {
  const row = db
    .prepare("SELECT model, city_root, enabled_agents FROM user_settings WHERE google_id = ?")
    .get(googleId) as { model: string; city_root: string; enabled_agents: string } | undefined;

  if (!row) {
    return { model: defaultModel, cityRoot: CITY_ROOT, enabledAgents: [...allAgents] };
  }

  let enabledAgents: unknown;
  try {
    enabledAgents = JSON.parse(row.enabled_agents);
  } catch (error) {
    throw new Error(
      `Could not read agent settings for this account: ${error instanceof Error ? error.message : "invalid JSON"}`,
    );
  }
  if (
    !Array.isArray(enabledAgents) ||
    !enabledAgents.every(isAgentId) ||
    new Set(enabledAgents).size !== enabledAgents.length
  ) {
    throw new Error("Stored agent settings are invalid. Update them from the Settings page.");
  }

  return {
    model: row.model,
    cityRoot: row.city_root,
    enabledAgents: enabledAgents.filter(isAgentId),
  };
}

export function saveUserSettings(googleId: string, settings: UserSettings) {
  db.prepare(`
    INSERT INTO user_settings (google_id, model, city_root, enabled_agents)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(google_id) DO UPDATE SET
      model = excluded.model,
      city_root = excluded.city_root,
      enabled_agents = excluded.enabled_agents,
      updated_at = CURRENT_TIMESTAMP
  `).run(googleId, settings.model, settings.cityRoot, JSON.stringify(settings.enabledAgents));
}
