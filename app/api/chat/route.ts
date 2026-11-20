import { NextResponse } from "next/server";
import { AGENTS, AgentId } from "@/lib/agents";
import { getCurrentGoogleId } from "@/lib/current-user";
import db from "@/lib/db";
import { validateCityRoot } from "@/lib/fs-tools";
import { connectAgentMcp } from "@/lib/mcp-integrations";
import { saveAgentOutput } from "@/lib/output-store";
import { runAgent, LogItem } from "@/lib/run";
import { getUserSettings } from "@/lib/user-settings";

export const maxDuration = 120;

type ChatInput = {
  agent: AgentId;
  history: { role: "user" | "assistant"; content: string }[];
  cityId: number;
};

function isChatInput(value: unknown): value is ChatInput {
  if (typeof value !== "object" || value === null) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.cityId === "number" &&
    Number.isSafeInteger(input.cityId) &&
    input.cityId > 0 &&
    typeof input.agent === "string" &&
    Object.hasOwn(AGENTS, input.agent) &&
    Array.isArray(input.history) &&
    input.history.every(
      (turn) =>
        typeof turn === "object" &&
        turn !== null &&
        "role" in turn &&
        (turn.role === "user" || turn.role === "assistant") &&
        "content" in turn &&
        typeof turn.content === "string",
    )
  );
}

export async function POST(req: Request) {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) {
    return NextResponse.json(
      { error: "Your Google session could not be matched to a local user. Log out, then sign in with Google again." },
      { status: 401 },
    );
  }

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isChatInput(input)) {
    return NextResponse.json({ error: "A valid city, agent, and message history are required." }, { status: 400 });
  }

  const city = db
    .prepare("SELECT root_path FROM cities WHERE id = ? AND owner_id = ?")
    .get(input.cityId, ownerId) as { root_path: string } | undefined;
  if (!city) return NextResponse.json({ error: "City not found." }, { status: 404 });

  const settings = getUserSettings(ownerId);
  if (!settings.enabledAgents.includes(input.agent)) {
    return NextResponse.json({ error: `${AGENTS[input.agent].name} is disabled in Settings.` }, { status: 403 });
  }

  const log: LogItem[] = [];
  try {
    const cityRoot = await validateCityRoot(city.root_path, settings.cityRoot);
    const integrations = await connectAgentMcp(ownerId);
    try {
      const reply = await runAgent(
        input.agent,
        input.history,
        log,
        cityRoot,
        (agent, content) => saveAgentOutput(input.cityId, agent, content, cityRoot, settings.cityRoot),
        integrations.client,
        settings,
      );
      return NextResponse.json({ reply, log });
    } finally {
      await integrations.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected agent error.";
    return NextResponse.json({ reply: "Error: " + message, log }, { status: 500 });
  }
}
