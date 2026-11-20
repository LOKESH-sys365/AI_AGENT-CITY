import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getGoogleAccessToken } from "./google-tokens";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function textResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

function summarizeEvent(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    id: value.id,
    summary: value.summary,
    description: typeof value.description === "string" ? value.description.slice(0, 2000) : undefined,
    location: value.location,
    start: value.start,
    end: value.end,
    status: value.status,
    htmlLink: value.htmlLink,
  };
}

function summarizeIssue(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    number: value.number,
    title: value.title,
    state: value.state,
    body: typeof value.body === "string" ? value.body.slice(0, 2000) : "",
    user: isRecord(value.user) ? value.user.login : undefined,
    labels: Array.isArray(value.labels)
      ? value.labels.flatMap((label) =>
          isRecord(label) && typeof label.name === "string" ? [label.name] : [],
        )
      : [],
    created_at: value.created_at,
    updated_at: value.updated_at,
    html_url: value.html_url,
    isPullRequest: isRecord(value.pull_request),
  };
}

function summarizeComment(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    id: value.id,
    user: isRecord(value.user) ? value.user.login : undefined,
    body: typeof value.body === "string" ? value.body.slice(0, 2000) : "",
    created_at: value.created_at,
    updated_at: value.updated_at,
    html_url: value.html_url,
  };
}

function eventRange(start: string, end: string) {
  const startTime = new Date(start);
  const endTime = new Date(end);
  if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime())) {
    throw new Error("Event start and end must be valid ISO date-time values.");
  }
  if (endTime <= startTime) throw new Error("Event end must be later than its start.");
  return { startTime, endTime };
}

async function calendarRequest(
  token: string,
  url: URL,
  method = "GET",
  body?: JsonRecord,
) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string"
        ? payload.error.message
        : `Google Calendar API error (${response.status}).`;
    throw new Error(message);
  }
  return payload;
}

async function githubRequest(path: string, method = "GET", body?: JsonRecord) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GitHub is not configured. Set GITHUB_TOKEN in .env.local and restart Agent City.");

  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const responseText = await response.text();
  let payload: unknown = null;
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = responseText;
    }
  }
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.message === "string"
      ? payload.message
      : `GitHub API error (${response.status}).`;
    throw new Error(message);
  }
  return payload;
}

function repositoryPath(owner: string, repo: string, suffix: string) {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${suffix}`;
}

function createIntegrationServer(googleId: string) {
  const server = new McpServer(
    { name: "agent-city-integrations", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
  const calendarEvents = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

  server.registerTool(
    "google_calendar_list_events",
    {
      description: "Read events from the signed-in user's primary Google Calendar. Use when asked about their schedule.",
      inputSchema: {
        timeMin: z.string().optional().describe("ISO date-time lower bound; defaults to now."),
        timeMax: z.string().optional().describe("ISO date-time upper bound; defaults to seven days from now."),
        maxResults: z.number().int().min(1).max(25).optional().describe("Maximum number of events to return; defaults to 10."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ timeMin, timeMax, maxResults }) => {
      const start = timeMin ? new Date(timeMin) : new Date();
      const end = timeMax ? new Date(timeMax) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
        throw new Error("Provide a valid time range where timeMax is later than timeMin.");
      }

      const url = new URL(calendarEvents);
      url.searchParams.set("timeMin", start.toISOString());
      url.searchParams.set("timeMax", end.toISOString());
      url.searchParams.set("maxResults", String(maxResults ?? 10));
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("fields", "items(id,summary,description,location,start,end,status,htmlLink),timeZone");

      const payload = await calendarRequest(await getGoogleAccessToken(googleId), url);
      if (isRecord(payload) && Array.isArray(payload.items)) {
        return textResult({
          timeZone: payload.timeZone,
          items: payload.items.map(summarizeEvent),
        });
      }
      return textResult(payload);
    },
  );

  server.registerTool(
    "google_calendar_create_event",
    {
      description: "Create a Google Calendar event. Only call when the user explicitly asks to schedule an event.",
      inputSchema: {
        summary: z.string().min(1).max(200),
        start: z.string().describe("ISO date-time including a timezone offset."),
        end: z.string().describe("ISO date-time including a timezone offset."),
        description: z.string().max(8000).optional(),
        location: z.string().max(500).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ summary, start, end, description, location }) => {
      const range = eventRange(start, end);
      const body: JsonRecord = {
        summary,
        start: { dateTime: range.startTime.toISOString() },
        end: { dateTime: range.endTime.toISOString() },
      };
      if (description) body.description = description;
      if (location) body.location = location;
      const url = new URL(calendarEvents);
      return textResult(
        summarizeEvent(await calendarRequest(await getGoogleAccessToken(googleId), url, "POST", body)),
      );
    },
  );

  server.registerTool(
    "google_calendar_update_event",
    {
      description: "Update a Google Calendar event. Only call when the user explicitly asks to change an event; never delete events.",
      inputSchema: {
        eventId: z.string().min(1),
        summary: z.string().min(1).max(200).optional(),
        start: z.string().optional().describe("New ISO date-time including a timezone offset."),
        end: z.string().optional().describe("New ISO date-time including a timezone offset."),
        description: z.string().max(8000).optional(),
        location: z.string().max(500).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ eventId, summary, start, end, description, location }) => {
      if (start !== undefined && end === undefined) throw new Error("When changing an event time, provide both start and end.");
      if (end !== undefined && start === undefined) throw new Error("When changing an event time, provide both start and end.");
      if ([summary, start, end, description, location].every((value) => value === undefined)) {
        throw new Error("Provide at least one event field to update.");
      }

      const body: JsonRecord = {};
      if (summary !== undefined) body.summary = summary;
      if (start !== undefined && end !== undefined) {
        const range = eventRange(start, end);
        body.start = { dateTime: range.startTime.toISOString() };
        body.end = { dateTime: range.endTime.toISOString() };
      }
      if (description !== undefined) body.description = description;
      if (location !== undefined) body.location = location;

      const url = new URL(`${calendarEvents}/${encodeURIComponent(eventId)}`);
      return textResult(
        summarizeEvent(await calendarRequest(await getGoogleAccessToken(googleId), url, "PATCH", body)),
      );
    },
  );

  const ownerSchema = z.string().min(1).max(39).regex(/^[A-Za-z0-9-]+$/);
  const repoSchema = z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/);

  server.registerTool(
    "github_get_repository",
    {
      description: "Read public or token-accessible GitHub repository metadata.",
      inputSchema: { owner: ownerSchema, repo: repoSchema },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ owner, repo }) => {
      const repository = await githubRequest(repositoryPath(owner, repo, ""));
      if (!isRecord(repository)) return textResult(repository);
      return textResult({
        name: repository.name,
        full_name: repository.full_name,
        description: repository.description,
        private: repository.private,
        html_url: repository.html_url,
        default_branch: repository.default_branch,
        open_issues_count: repository.open_issues_count,
      });
    },
  );

  server.registerTool(
    "github_list_repo_issues",
    {
      description: "Read issues and pull requests in a GitHub repository. Does not modify them.",
      inputSchema: {
        owner: ownerSchema,
        repo: repoSchema,
        state: z.enum(["open", "closed", "all"]).optional(),
        perPage: z.number().int().min(1).max(25).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ owner, repo, state, perPage }) => {
      const url = new URL(`https://api.github.com${repositoryPath(owner, repo, "/issues")}`);
      url.searchParams.set("state", state ?? "open");
      url.searchParams.set("per_page", String(perPage ?? 10));
      const payload = await githubRequest(`${url.pathname}${url.search}`);
      return textResult(Array.isArray(payload) ? payload.map(summarizeIssue) : payload);
    },
  );

  server.registerTool(
    "github_search_issues",
    {
      description: "Search GitHub issues and pull requests using GitHub's search query syntax.",
      inputSchema: {
        query: z.string().min(1).max(256),
        perPage: z.number().int().min(1).max(25).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, perPage }) => {
      const url = new URL("https://api.github.com/search/issues");
      url.searchParams.set("q", query);
      url.searchParams.set("per_page", String(perPage ?? 10));
      const payload = await githubRequest(`${url.pathname}${url.search}`);
      if (!isRecord(payload) || !Array.isArray(payload.items)) return textResult(payload);
      return textResult({
        total_count: payload.total_count,
        items: payload.items.map(summarizeIssue),
      });
    },
  );

  server.registerTool(
    "github_create_issue",
    {
      description: "Create an issue in a GitHub repository. Only call when the user explicitly asks to create an issue; never push code.",
      inputSchema: {
        owner: ownerSchema,
        repo: repoSchema,
        title: z.string().min(1).max(256),
        body: z.string().max(65536).optional(),
        labels: z.array(z.string().min(1).max(50)).max(10).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ owner, repo, title, body, labels }) =>
      textResult(
        summarizeIssue(await githubRequest(repositoryPath(owner, repo, "/issues"), "POST", {
          title,
          body,
          labels,
        })),
      ),
  );

  server.registerTool(
    "github_update_issue",
    {
      description: "Update a GitHub issue title, body, or state. Only call when the user explicitly asks for a change; never delete issues or push code.",
      inputSchema: {
        owner: ownerSchema,
        repo: repoSchema,
        issueNumber: z.number().int().min(1),
        title: z.string().min(1).max(256).optional(),
        body: z.string().max(65536).optional(),
        state: z.enum(["open", "closed"]).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ owner, repo, issueNumber, title, body, state }) => {
      if ([title, body, state].every((value) => value === undefined)) {
        throw new Error("Provide at least one issue field to update.");
      }
      return textResult(
        summarizeIssue(await githubRequest(
          repositoryPath(owner, repo, `/issues/${issueNumber}`),
          "PATCH",
          { title, body, state },
        )),
      );
    },
  );

  server.registerTool(
    "github_list_issue_comments",
    {
      description: "Read comments on a GitHub issue or pull request.",
      inputSchema: {
        owner: ownerSchema,
        repo: repoSchema,
        issueNumber: z.number().int().min(1),
        perPage: z.number().int().min(1).max(25).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ owner, repo, issueNumber, perPage }) => {
      const url = new URL(
        `https://api.github.com${repositoryPath(owner, repo, `/issues/${issueNumber}/comments`)}`,
      );
      url.searchParams.set("per_page", String(perPage ?? 10));
      const payload = await githubRequest(`${url.pathname}${url.search}`);
      return textResult(Array.isArray(payload) ? payload.map(summarizeComment) : payload);
    },
  );

  server.registerTool(
    "github_create_issue_comment",
    {
      description: "Add a comment to a GitHub issue or pull request. Only call when the user explicitly asks to comment; never push code.",
      inputSchema: {
        owner: ownerSchema,
        repo: repoSchema,
        issueNumber: z.number().int().min(1),
        body: z.string().min(1).max(65536),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ owner, repo, issueNumber, body }) =>
      textResult(
        summarizeComment(await githubRequest(
          repositoryPath(owner, repo, `/issues/${issueNumber}/comments`),
          "POST",
          { body },
        )),
      ),
  );

  server.registerTool(
    "github_update_issue_comment",
    {
      description: "Edit an existing GitHub issue comment. Only call when the user explicitly asks to change a comment; never push code.",
      inputSchema: {
        owner: ownerSchema,
        repo: repoSchema,
        commentId: z.number().int().min(1),
        body: z.string().min(1).max(65536),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ owner, repo, commentId, body }) =>
      textResult(
        summarizeComment(await githubRequest(
          repositoryPath(owner, repo, `/issues/comments/${commentId}`),
          "PATCH",
          { body },
        )),
      ),
  );

  return server;
}

export async function connectAgentMcp(googleId: string) {
  const server = createIntegrationServer(googleId);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "agent-city", version: "1.0.0" });
  await server.connect(serverTransport);
  try {
    await client.connect(clientTransport);
  } catch (error) {
    await server.close();
    throw error;
  }

  return {
    client,
    async close() {
      await client.close();
    },
  };
}
