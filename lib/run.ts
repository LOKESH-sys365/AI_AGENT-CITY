import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { AGENTS, AgentId } from "./agents";
import { CITY_ROOT, fsTools, runFsTool } from "./fs-tools";
import { OutputPersistenceError } from "./output-store";

// Free and local: talks to Ollama on your own laptop. No API key needed.
const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";
const defaultModel = process.env.OLLAMA_MODEL || "llama3.2:3b";
const MAX_OLLAMA_ATTEMPTS = 3;
const RETRY_DELAY_MS = 250;

type WorkerAgentId = Exclude<AgentId, "mayor">;
type OllamaToolCall = {
  function: { name: string; arguments?: unknown };
};
type OllamaMessage = {
  content?: string;
  tool_calls?: OllamaToolCall[];
  [key: string]: unknown;
};

const delegate = {
  name: "delegate",
  description: "Give a task to another agent and get their report back",
  input_schema: {
    type: "object" as const,
    properties: { agent: { type: "string", enum: ["librarian", "professor", "builder", "planner"] }, task: { type: "string" } },
    required: ["agent", "task"],
  },
};

export type LogItem = { agent: AgentId; tool: string; input: any };
export type Turn = { role: "user" | "assistant"; content: string };
export type AgentOutputHandler = (agent: AgentId, content: string) => Promise<void>;
type AgentMcpClient = Pick<Client, "listTools" | "callTool">;
export type AgentRunSettings = {
  model?: string;
  enabledAgents?: readonly AgentId[];
  cityRoot?: string;
  systemPrompt?: string;
  toolsEnabled?: boolean;
};

const toOllamaTool = (t: { name: string; description: string; input_schema: any }) => ({
  type: "function",
  function: { name: t.name, description: t.description, parameters: t.input_schema },
});

function isWorkerAgent(value: unknown): value is WorkerAgentId {
  return (
    typeof value === "string" &&
    value !== "mayor" &&
    Object.hasOwn(AGENTS, value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected agent error.";
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestOllamaMessage(
  messages: unknown[],
  tools: ReturnType<typeof toOllamaTool>[],
  model: string,
): Promise<OllamaMessage> {
  for (let attempt = 1; attempt <= MAX_OLLAMA_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${OLLAMA}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          tools,
          stream: false,
          options: { temperature: 0.2, num_ctx: 8192 },
        }),
      });
    } catch {
      if (attempt === MAX_OLLAMA_ATTEMPTS) {
        throw new Error("Cannot reach Ollama after 3 attempts. Is it running? Try `ollama list` in a terminal.");
      }
      await wait(RETRY_DELAY_MS * attempt);
      continue;
    }

    if (!response.ok) {
      const detail = await response.text();
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      if (retryable && attempt < MAX_OLLAMA_ATTEMPTS) {
        await wait(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw new Error(`Ollama error ${response.status}: ${detail}`);
    }

    try {
      const payload: unknown = await response.json();
      if (!isRecord(payload) || !isRecord(payload.message)) {
        throw new Error("Ollama returned an invalid chat response.");
      }
      return payload.message as OllamaMessage;
    } catch (error) {
      if (attempt === MAX_OLLAMA_ATTEMPTS) {
        throw new Error(`Could not read Ollama's chat response after 3 attempts: ${errorMessage(error)}`);
      }
      await wait(RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error("Ollama request failed after 3 attempts.");
}

type ToolExecution = {
  name: string;
  output?: string;
  records: LogItem[];
  fatalError?: OutputPersistenceError;
};

async function executeToolCall(
  id: AgentId,
  call: OllamaToolCall,
  cityRoot: string,
  mcpClient: AgentMcpClient | undefined,
  mcpToolNames: ReadonlySet<string>,
  onOutput: AgentOutputHandler | undefined,
  settings: AgentRunSettings,
  enabledAgentIds: ReadonlySet<AgentId>,
): Promise<ToolExecution> {
  const name = call.function.name;
  let input: unknown = call.function.arguments || {};
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      input = {};
    }
  }

  const args = isRecord(input) ? input : {};
  const records: LogItem[] = [{ agent: id, tool: name, input: args }];
  try {
    if (name === "delegate") {
      const targetAgent = args.agent;
      const task = args.task;
      if (id !== "mayor" || !isWorkerAgent(targetAgent) || typeof task !== "string") {
        return { name, output: "Error: Invalid delegation request.", records };
      }
      if (!enabledAgentIds.has(targetAgent)) {
        return { name, output: `Error: ${AGENTS[targetAgent].name} is disabled in Settings.`, records };
      }
      const childLog: LogItem[] = [];
      try {
        const output = await runAgent(
          targetAgent,
          [{ role: "user", content: task }],
          childLog,
          cityRoot,
          onOutput,
          mcpClient,
          settings,
        );
        return { name, output, records: [...records, ...childLog] };
      } catch (error) {
        records.push(...childLog);
        throw error;
      }
    }
    if (mcpToolNames.has(name)) {
      if (!mcpClient) throw new Error("The requested MCP integration is unavailable.");
      const result = await mcpClient.callTool({ name, arguments: args });
      if (!isRecord(result) || !Array.isArray(result.content)) {
        throw new Error("The MCP tool returned an invalid response.");
      }
      const output = result.content
        .flatMap((item: unknown) =>
          isRecord(item) && item.type === "text" && typeof item.text === "string"
            ? [item.text]
            : [],
        )
        .join("\n");
      if (result.isError === true) throw new Error(output || "MCP tool call failed.");
      return {
        name,
        output: output || JSON.stringify(result.structuredContent ?? {}),
        records,
      };
    }

    return {
      name,
      output: await runFsTool(name, args, cityRoot, settings.cityRoot ?? CITY_ROOT),
      records,
    };
  } catch (error) {
    if (error instanceof OutputPersistenceError) {
      return { name, records, fatalError: error };
    }
    return { name, output: `Error: ${errorMessage(error)}`, records };
  }
}

export async function runAgent(
  id: AgentId,
  history: Turn[],
  log: LogItem[],
  cityRoot: string,
  onOutput?: AgentOutputHandler,
  mcpClient?: AgentMcpClient,
  settings: AgentRunSettings = {},
): Promise<string> {
  const enabledAgentIds = new Set(settings.enabledAgents ?? (Object.keys(AGENTS) as AgentId[]));
  if (!enabledAgentIds.has(id)) {
    throw new Error(`${AGENTS[id].name} is disabled in Settings.`);
  }

  const a = AGENTS[id];
  const workerAgentIds = (Object.keys(AGENTS) as AgentId[])
    .filter((agent): agent is WorkerAgentId => agent !== "mayor" && enabledAgentIds.has(agent));
  const mayorTools = workerAgentIds.length > 0
    ? [
        fsTools[0],
        {
          ...delegate,
          input_schema: {
            ...delegate.input_schema,
            properties: {
              agent: { type: "string" as const, enum: workerAgentIds },
              task: { type: "string" as const },
            },
          },
        },
      ]
    : [fsTools[0]];
  const baseTools = settings.toolsEnabled === false
    ? []
    : (id === "mayor" ? mayorTools : fsTools).map(toOllamaTool);
  const model = settings.model || defaultModel;
  const mcpTools = settings.toolsEnabled !== false && mcpClient && (id === "planner" || id === "builder")
    ? (await mcpClient.listTools()).tools.filter((tool) =>
        id === "planner"
          ? tool.name.startsWith("google_calendar_")
          : tool.name.startsWith("github_"),
      )
    : [];
  const mcpToolNames = new Set(mcpTools.map((tool) => tool.name));
  const tools = [
    ...baseTools,
    ...mcpTools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description ?? "",
        parameters: tool.inputSchema,
      },
    })),
  ];
  const environmentPrompt = settings.toolsEnabled === false
    ? `The city root is ${cityRoot}. You have no file or external tools for this review.`
    : `The city root is ${cityRoot}. Paths are relative to it. You cannot delete files. Use tools to act. Do not guess file names: call list_dir first.`;
  const messages: any[] = [
    { role: "system", content: `${settings.systemPrompt ?? a.prompt}\n${environmentPrompt}` },
    ...history,
  ];

  for (let step = 0; step < 8; step++) {
    const message = await requestOllamaMessage(messages, tools, model);
    messages.push(message);

    const calls = message.tool_calls || [];
    if (calls.length === 0) {
      const output = (message.content || "").trim() || "Done.";
      await onOutput?.(id, output);
      return output;
    }

    const executions: ToolExecution[] = [];
    if (id === "mayor") {
      executions.push(
        ...(await Promise.all(
          calls.map((call) =>
            executeToolCall(id, call, cityRoot, mcpClient, mcpToolNames, onOutput, settings, enabledAgentIds),
          ),
        )),
      );
    } else {
      for (const call of calls) {
        executions.push(
          await executeToolCall(id, call, cityRoot, mcpClient, mcpToolNames, onOutput, settings, enabledAgentIds),
        );
      }
    }

    for (const execution of executions) log.push(...execution.records);
    const persistenceFailure = executions.find((execution) => execution.fatalError);
    if (persistenceFailure?.fatalError) throw persistenceFailure.fatalError;

    for (const execution of executions) {
      messages.push({
        role: "tool",
        tool_name: execution.name,
        content: execution.output ?? "",
      });
    }
  }
  const output = "I stopped after too many steps. Try a smaller request.";
  await onOutput?.(id, output);
  return output;
}

export async function runLocalTextPrompt(systemPrompt: string, userPrompt: string, model: string) {
  const response = await requestOllamaMessage(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    [],
    model,
  );
  if (response.tool_calls?.length) {
    throw new Error("The selected Ollama model returned a tool call when no tools were available.");
  }
  const content = response.content?.trim();
  if (!content) throw new Error("The selected Ollama model returned an empty response.");
  return content;
}
