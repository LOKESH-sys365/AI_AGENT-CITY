import path from "node:path";
import { AGENTS, AgentId } from "./agents";
import db from "./db";
import { CITY_ROOT, runFsTool } from "./fs-tools";

export class OutputPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutputPersistenceError";
  }
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown storage error.";
}

export async function saveAgentOutput(
  cityId: number,
  agent: AgentId,
  content: string,
  cityRoot: string,
  cityRootBase = CITY_ROOT,
) {
  let outputId: number | bigint;
  try {
    outputId = db
      .prepare("INSERT INTO outputs (city_id, agent, content) VALUES (?, ?, ?)")
      .run(cityId, agent, content).lastInsertRowid;
  } catch (error) {
    throw new OutputPersistenceError(
      `Could not save ${AGENTS[agent].name}'s output to SQLite: ${describeError(error)}`,
    );
  }

  const relativePath = path.join("outputs", `${outputId}-${agent}.md`);
  const fileContent = [
    `# ${AGENTS[agent].place} output`,
    "",
    `Output ID: ${outputId}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    content,
    "",
  ].join("\n");

  try {
    await runFsTool("write_file", { path: relativePath, content: fileContent }, cityRoot, cityRootBase);
  } catch (error) {
    try {
      const rollback = db.prepare("DELETE FROM outputs WHERE id = ?").run(outputId);
      if (rollback.changes !== 1) {
        throw new Error("The inserted output row could not be found for rollback.");
      }
    } catch (rollbackError) {
      throw new OutputPersistenceError(
        `Could not save ${AGENTS[agent].name}'s output to ${relativePath}: ${describeError(error)}. ` +
          `SQLite rollback also failed: ${describeError(rollbackError)}`,
      );
    }

    throw new OutputPersistenceError(
      `Could not save ${AGENTS[agent].name}'s output to ${relativePath}; its SQLite row was rolled back: ${describeError(error)}`,
    );
  }
}
