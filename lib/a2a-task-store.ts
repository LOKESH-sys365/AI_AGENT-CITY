import { Task, TaskState } from "@a2a-js/sdk";
import { RequestMalformedError } from "@a2a-js/sdk/errors";
import type { ListTasksRequest, ListTasksResponse } from "@a2a-js/sdk";
import { ServerCallContext } from "@a2a-js/sdk/server";
import type { TaskStore } from "@a2a-js/sdk/server";
import db from "./db";

type StoredTask = {
  task_id: string;
  status_timestamp: string;
  task_json: string;
};

function ownerId(context: ServerCallContext) {
  const id = context.user?.userName;
  if (!id) throw new Error("An authenticated A2A user is required.");
  return id;
}

function encodePageToken(timestamp: string, id: string) {
  return Buffer.from(JSON.stringify({ timestamp, id })).toString("base64url");
}

function decodePageToken(token: string) {
  try {
    const value: unknown = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    if (
      typeof value === "object" &&
      value !== null &&
      "timestamp" in value &&
      typeof value.timestamp === "string" &&
      "id" in value &&
      typeof value.id === "string"
    ) {
      return { timestamp: value.timestamp, id: value.id };
    }
  } catch {
    throw new RequestMalformedError("The A2A page token is invalid.");
  }
  throw new RequestMalformedError("The A2A page token is invalid.");
}

export class SqliteA2ATaskStore implements TaskStore {
  async save(task: Task, context: ServerCallContext) {
    const id = ownerId(context);
    const statusTimestamp = task.status?.timestamp ?? new Date().toISOString();
    const json = JSON.stringify(Task.toJSON(task));
    if (!json) throw new Error("Could not serialize the A2A task.");

    db.prepare(`
      INSERT INTO a2a_tasks (owner_id, task_id, context_id, status, status_timestamp, task_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_id, task_id) DO UPDATE SET
        context_id = excluded.context_id,
        status = excluded.status,
        status_timestamp = excluded.status_timestamp,
        task_json = excluded.task_json
    `).run(id, task.id, task.contextId, task.status?.state ?? TaskState.TASK_STATE_UNSPECIFIED, statusTimestamp, json);
  }

  async load(taskId: string, context: ServerCallContext) {
    const row = db
      .prepare("SELECT task_json FROM a2a_tasks WHERE owner_id = ? AND task_id = ?")
      .get(ownerId(context), taskId) as { task_json: string } | undefined;
    if (!row) return undefined;

    const parsed: unknown = JSON.parse(row.task_json);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Stored A2A task data is invalid.");
    }
    return Task.fromJSON(parsed);
  }

  async list(params: ListTasksRequest, context: ServerCallContext): Promise<ListTasksResponse> {
    const size = params.pageSize ?? 50;
    if (!Number.isInteger(size) || size < 1 || size > 100) {
      throw new RequestMalformedError("A2A pageSize must be between 1 and 100.");
    }

    const filters = ["owner_id = ?"];
    const values: Array<string | number> = [ownerId(context)];
    if (params.contextId) {
      filters.push("context_id = ?");
      values.push(params.contextId);
    }
    if (params.status !== undefined && params.status !== TaskState.TASK_STATE_UNSPECIFIED) {
      filters.push("status = ?");
      values.push(params.status);
    }
    if (params.statusTimestampAfter) {
      filters.push("status_timestamp >= ?");
      values.push(params.statusTimestampAfter);
    }
    if (
      params.historyLength !== undefined &&
      (!Number.isInteger(params.historyLength) || params.historyLength < 0)
    ) {
      throw new RequestMalformedError("A2A historyLength must be a non-negative integer.");
    }
    const where = filters.join(" AND ");
    const count = db.prepare(`SELECT COUNT(*) AS count FROM a2a_tasks WHERE ${where}`)
      .get(...values) as { count: number };

    const cursor = params.pageToken ? decodePageToken(params.pageToken) : undefined;
    const pageFilters = [...filters];
    const pageValues = [...values];
    if (cursor) {
      pageFilters.push("(status_timestamp < ? OR (status_timestamp = ? AND task_id < ?))");
      pageValues.push(cursor.timestamp, cursor.timestamp, cursor.id);
    }
    pageValues.push(size + 1);
    const rows = db.prepare(`
      SELECT task_id, status_timestamp, task_json
      FROM a2a_tasks
      WHERE ${pageFilters.join(" AND ")}
      ORDER BY status_timestamp DESC, task_id DESC
      LIMIT ?
    `).all(...pageValues) as StoredTask[];

    const hasMore = rows.length > size;
    const pageRows = hasMore ? rows.slice(0, size) : rows;
    const tasks = pageRows.map((row) => {
      const parsed: unknown = JSON.parse(row.task_json);
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Stored A2A task data is invalid.");
      }
      const task = Task.fromJSON(parsed);
      if (params.historyLength !== undefined) {
        task.history = params.historyLength === 0 ? [] : task.history.slice(-params.historyLength);
      }
      if (params.includeArtifacts !== true) task.artifacts = [];
      return task;
    });
    const last = pageRows.at(-1);

    return {
      tasks,
      nextPageToken: hasMore && last ? encodePageToken(last.status_timestamp, last.task_id) : "",
      pageSize: size,
      totalSize: count.count,
    };
  }
}
