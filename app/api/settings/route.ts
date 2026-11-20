import { mkdir, realpath, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { AGENTS, AgentId } from "@/lib/agents";
import { getCurrentGoogleId } from "@/lib/current-user";
import db from "@/lib/db";
import { getUserSettings, saveUserSettings } from "@/lib/user-settings";
import type { UserSettings } from "@/lib/user-settings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAgentId(value: unknown): value is AgentId {
  return typeof value === "string" && Object.hasOwn(AGENTS, value);
}

function isSettingsInput(value: unknown): value is UserSettings {
  return (
    isRecord(value) &&
    typeof value.model === "string" &&
    value.model.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value.model) &&
    typeof value.cityRoot === "string" &&
    value.cityRoot.trim().length > 0 &&
    value.cityRoot.length <= 1024 &&
    Array.isArray(value.enabledAgents) &&
    value.enabledAgents.every(isAgentId) &&
    new Set(value.enabledAgents).size === value.enabledAgents.length
  );
}

function normalizeRoot(value: string) {
  const expanded = value.trim().replace(/^~(?=$|[\\/])/, os.homedir());
  if (!path.isAbsolute(expanded)) throw new Error("CITY_ROOT must be an absolute path (or start with ~).");
  return path.resolve(expanded);
}

function samePath(left: string, right: string) {
  return path.relative(path.resolve(left), path.resolve(right)) === "";
}

export async function GET() {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) return NextResponse.json({ error: "Sign in to view settings." }, { status: 401 });

  return NextResponse.json({ settings: getUserSettings(ownerId) });
}

export async function PATCH(request: Request) {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) return NextResponse.json({ error: "Sign in to update settings." }, { status: 401 });

  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!isSettingsInput(value) || !value.model.trim()) {
    return NextResponse.json(
      { error: "Enter a valid Ollama model name, CITY_ROOT path, and agent selection." },
      { status: 400 },
    );
  }

  const current = getUserSettings(ownerId);
  let requestedRoot: string;
  try {
    requestedRoot = normalizeRoot(value.cityRoot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid CITY_ROOT path." },
      { status: 400 },
    );
  }

  if (!samePath(requestedRoot, current.cityRoot)) {
    const cityCount = db
      .prepare("SELECT COUNT(*) AS count FROM cities WHERE owner_id = ?")
      .get(ownerId) as { count: number };
    if (cityCount.count > 0) {
      return NextResponse.json(
        { error: "CITY_ROOT cannot change while this account has cities. Existing city folders stay at their current paths." },
        { status: 409 },
      );
    }
  }

  let cityRoot: string;
  try {
    await mkdir(requestedRoot, { recursive: true });
    const rootInfo = await stat(requestedRoot);
    if (!rootInfo.isDirectory()) throw new Error("CITY_ROOT must point to a directory.");
    cityRoot = await realpath(requestedRoot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? `Could not use CITY_ROOT: ${error.message}` : "Could not use CITY_ROOT." },
      { status: 400 },
    );
  }

  const settings: UserSettings = {
    model: value.model.trim(),
    cityRoot,
    enabledAgents: value.enabledAgents,
  };
  saveUserSettings(ownerId, settings);
  return NextResponse.json({ settings });
}
