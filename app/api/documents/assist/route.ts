import { NextResponse } from "next/server";
import { getCurrentGoogleId } from "@/lib/current-user";
import db from "@/lib/db";
import { runLocalTextPrompt } from "@/lib/run";
import { getUserSettings } from "@/lib/user-settings";

export const runtime = "nodejs";
export const maxDuration = 120;

type AssistInput = {
  cityId: number;
  mode: "create" | "edit";
  instruction: string;
  draft?: string;
};

function isAssistInput(value: unknown): value is AssistInput {
  if (typeof value !== "object" || value === null) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.cityId === "number" &&
    Number.isSafeInteger(input.cityId) &&
    input.cityId > 0 &&
    (input.mode === "create" || input.mode === "edit") &&
    typeof input.instruction === "string" &&
    input.instruction.trim().length > 0 &&
    input.instruction.length <= 6_000 &&
    (input.draft === undefined || (typeof input.draft === "string" && input.draft.length <= 30_000)) &&
    (input.mode !== "edit" || (typeof input.draft === "string" && input.draft.trim().length > 0))
  );
}

export async function POST(request: Request) {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) return NextResponse.json({ error: "Sign in to use Document Studio." }, { status: 401 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!isAssistInput(input)) {
    return NextResponse.json({ error: "Provide a city, instruction, and valid create or edit mode." }, { status: 400 });
  }

  const city = db.prepare("SELECT id FROM cities WHERE id = ? AND owner_id = ?").get(input.cityId, ownerId);
  if (!city) return NextResponse.json({ error: "City not found." }, { status: 404 });

  const settings = getUserSettings(ownerId);
  const systemPrompt = input.mode === "create"
    ? "You are the PDF Maker for Agent City. Create a polished, well-structured document that is easy to print. Return only the document in Markdown, without code fences or commentary. Do not invent personal facts; use placeholders when details are missing."
    : "You are the Editor for Agent City. Revise the supplied draft according to the instruction. Preserve its intended meaning and factual claims, improve clarity and structure, and return only the complete revised document in Markdown without code fences or commentary.";
  const userPrompt = input.mode === "create"
    ? `Document request:\n${input.instruction}`
    : `Editing instruction:\n${input.instruction}\n\nDraft to edit:\n${input.draft}`;

  try {
    const text = await runLocalTextPrompt(systemPrompt, userPrompt, settings.model);
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The local document model failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
