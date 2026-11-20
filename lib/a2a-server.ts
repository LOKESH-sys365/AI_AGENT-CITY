import {
  AgentCard,
  AgentSkill,
  Role,
  TaskState,
} from "@a2a-js/sdk";
import {
  AgentEvent,
  AgentExecutor,
  DefaultRequestHandler,
  JsonRpcTransportHandler,
  RequestContext,
  ServerCallContext,
} from "@a2a-js/sdk/server";
import { RequestMalformedError, TaskNotCancelableError } from "@a2a-js/sdk/errors";
import { AGENTS, AgentId } from "./agents";
import db from "./db";
import { validateCityRoot } from "./fs-tools";
import { connectAgentMcp } from "./mcp-integrations";
import { saveAgentOutput } from "./output-store";
import { LogItem, runAgent, Turn } from "./run";
import { getUserSettings } from "./user-settings";
import { SqliteA2ATaskStore } from "./a2a-task-store";

const agentIds = Object.keys(AGENTS) as AgentId[];

function isAgentId(value: unknown): value is AgentId {
  return typeof value === "string" && Object.hasOwn(AGENTS, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function a2aBaseUrl() {
  const configuredUrl = process.env.A2A_PUBLIC_URL;
  if (!configuredUrl && process.env.NODE_ENV === "production") {
    throw new Error("Set A2A_PUBLIC_URL to the public HTTPS origin before enabling A2A in production.");
  }

  const url = new URL(configuredUrl || "http://localhost:3000");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("A2A_PUBLIC_URL must be an HTTP(S) origin without credentials, path, query, or fragment.");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("A2A_PUBLIC_URL must use HTTPS in production.");
  }
  return url.toString().replace(/\/+$/, "");
}

export function getA2AAgentCard(): AgentCard {
  const endpoint = `${a2aBaseUrl()}/api/a2a`;
  const skills: AgentSkill[] = agentIds.map((id) => ({
    id,
    name: AGENTS[id].name,
    description: `${AGENTS[id].blurb} Each request must include message metadata agentCity with an owned cityId and this agentId. Agent availability follows the owner's Settings.`,
    tags: [id, "Agent City", "local files"],
    examples: [`Use the ${AGENTS[id].name} in my city to help with a task.`],
    inputModes: ["text/plain"],
    outputModes: ["text/plain"],
    securityRequirements: [],
  }));

  return {
    name: "Agent City",
    description: "A local Ollama-powered agent town that works only in the signed-in user's city folder.",
    supportedInterfaces: [
      { url: endpoint, protocolBinding: "JSONRPC", protocolVersion: "1.0", tenant: "" },
    ],
    provider: { url: a2aBaseUrl(), organization: "Agent City" },
    version: "1.0.0",
    capabilities: {
      streaming: true,
      pushNotifications: false,
      extensions: [],
      extendedAgentCard: false,
    },
    securitySchemes: {
      googleIdToken: {
        scheme: {
          $case: "httpAuthSecurityScheme",
          value: {
            description: "Google OpenID Connect ID token for an existing Agent City account.",
            scheme: "Bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
    securityRequirements: [{ schemes: { googleIdToken: { list: [] } } }],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills,
    signatures: [],
  };
}

function textOfMessage(message: RequestContext["userMessage"]) {
  return message.parts
    .flatMap((part) =>
      part.content?.$case === "text" && typeof part.content.value === "string"
        ? [part.content.value]
        : [],
    )
    .join("\n")
    .trim();
}

function hasOnlyTextParts(message: RequestContext["userMessage"]) {
  return (
    message.parts.length > 0 &&
    message.parts.every(
      (part) =>
        part.content?.$case === "text" &&
        (!part.mediaType || part.mediaType === "text/plain"),
    )
  );
}

function toTurns(messages: RequestContext["userMessage"][]): Turn[] {
  const turns: Turn[] = [];
  for (const message of messages) {
    const content = textOfMessage(message);
    if (!content) continue;
    if (message.role === Role.ROLE_USER) turns.push({ role: "user", content });
    if (message.role === Role.ROLE_AGENT) turns.push({ role: "assistant", content });
  }
  return turns;
}

class AgentCityExecutor implements AgentExecutor {
  async execute(requestContext: RequestContext, eventBus: Parameters<AgentExecutor["execute"]>[1]) {
    const incoming = requestContext.userMessage;
    const routing: unknown = incoming.metadata?.agentCity;
    if (
      !isRecord(routing) ||
      typeof routing.cityId !== "number" ||
      !Number.isSafeInteger(routing.cityId) ||
      routing.cityId < 1 ||
      !isAgentId(routing.agentId)
    ) {
      throw new RequestMalformedError("message.metadata.agentCity must include an owned cityId and agentId.");
    }
    const cityId = routing.cityId;
    const agentId = routing.agentId;

    const ownerId = requestContext.context.user?.userName;
    if (!ownerId) throw new Error("The authenticated A2A account is missing.");

    const city = db
      .prepare("SELECT root_path FROM cities WHERE id = ? AND owner_id = ?")
      .get(cityId, ownerId) as { root_path: string } | undefined;
    if (!city) throw new RequestMalformedError("The requested city does not belong to this Google account.");

    const settings = getUserSettings(ownerId);
    if (!settings.enabledAgents.includes(agentId)) {
      throw new RequestMalformedError(`${AGENTS[agentId].name} is disabled in Settings.`);
    }

    const history = requestContext.task?.history ? [...requestContext.task.history] : [];
    if (!history.some((message) => message.messageId === incoming.messageId)) {
      history.push(incoming);
    }
    const turns = toTurns(history);
    if (turns.length === 0 || !hasOnlyTextParts(incoming) || !textOfMessage(incoming)) {
      throw new RequestMalformedError("A2A requests must contain at least one text/plain message part.");
    }

    const cityRoot = await validateCityRoot(city.root_path, settings.cityRoot);
    const task = {
      id: requestContext.taskId,
      contextId: requestContext.contextId,
      status: {
        state: TaskState.TASK_STATE_WORKING,
        message: undefined,
        timestamp: new Date().toISOString(),
      },
      artifacts: requestContext.task?.artifacts ?? [],
      history,
      metadata: {
        ...(requestContext.task?.metadata ?? {}),
        agentCity: { cityId, agentId },
      },
    };
    eventBus.publish(AgentEvent.task(task));

    const integrations = await connectAgentMcp(ownerId);
    try {
      const log: LogItem[] = [];
      const result = await runAgent(
        agentId,
        turns,
        log,
        cityRoot,
        (agent, content) => saveAgentOutput(cityId, agent, content, cityRoot, settings.cityRoot),
        integrations.client,
        settings,
      );
      const timestamp = new Date().toISOString();
      const responseMessage = {
        messageId: crypto.randomUUID(),
        contextId: task.contextId,
        taskId: task.id,
        role: Role.ROLE_AGENT,
        parts: [{ content: { $case: "text" as const, value: result }, mediaType: "text/plain", filename: "", metadata: {} }],
        metadata: {},
        extensions: [],
        referenceTaskIds: [],
      };
      eventBus.publish(
        AgentEvent.artifactUpdate({
          taskId: task.id,
          contextId: task.contextId,
          artifact: {
            artifactId: crypto.randomUUID(),
            name: `${AGENTS[agentId].name} response`,
            description: "The agent's response. It is also saved to the city's outputs folder and SQLite.",
            parts: [{ content: { $case: "text", value: result }, mediaType: "text/plain", filename: "", metadata: {} }],
            metadata: { agentId },
            extensions: [],
          },
          append: false,
          lastChunk: true,
          metadata: {},
        }),
      );
      eventBus.publish(
        AgentEvent.statusUpdate({
          taskId: task.id,
          contextId: task.contextId,
          status: {
            state: TaskState.TASK_STATE_COMPLETED,
            message: responseMessage,
            timestamp,
          },
          metadata: {},
        }),
      );
    } finally {
      await integrations.close();
    }
  }

  async cancelTask() {
    throw new TaskNotCancelableError("Agent City does not support canceling an active local agent run.");
  }
}

let transportHandler: JsonRpcTransportHandler | undefined;

export function getA2ATransportHandler() {
  if (!transportHandler) {
    const requestHandler = new DefaultRequestHandler(
      getA2AAgentCard(),
      new SqliteA2ATaskStore(),
      new AgentCityExecutor(),
    );
    transportHandler = new JsonRpcTransportHandler(requestHandler);
  }
  return transportHandler;
}

export function getA2AServerCallContext(request: Request, googleId: string) {
  const user = {
    get isAuthenticated() {
      return true;
    },
    get userName() {
      return googleId;
    },
  };
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return new ServerCallContext({
    user,
    requestedVersion: request.headers.get("A2A-Version") || "1.0",
    state: new Map([["headers", headers]]),
  });
}
