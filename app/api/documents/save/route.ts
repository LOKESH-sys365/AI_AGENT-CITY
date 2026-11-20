import { NextResponse } from "next/server";
import { getCurrentGoogleId } from "@/lib/current-user";
import db from "@/lib/db";
import { saveKnowledgeDocument } from "@/lib/document-library";
import { validateCityRoot } from "@/lib/fs-tools";
import { getUserSettings } from "@/lib/user-settings";

export const runtime = "nodejs";

function isSaveInput(value: unknown): value is { cityId: number; title: string; content: string } {
  if (typeof value !== "object" || value === null) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.cityId === "number" &&
    Number.isSafeInteger(input.cityId) &&
    input.cityId > 0 &&
    typeof input.title === "string" &&
    input.title.trim().length > 0 &&
    input.title.length <= 120 &&
    typeof input.content === "string" &&
    input.content.trim().length > 0 &&
    input.content.length <= 500_000
  );
}

export async function POST(request: Request) {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) return NextResponse.json({ error: "Sign in to save city documents." }, { status: 401 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!isSaveInput(input)) {
    return NextResponse.json({ error: "A valid title, document, and cityId are required." }, { status: 400 });
  }

  const city = db
    .prepare("SELECT root_path FROM cities WHERE id = ? AND owner_id = ?")
    .get(input.cityId, ownerId) as { root_path: string } | undefined;
  if (!city) return NextResponse.json({ error: "City not found." }, { status: 404 });

  const settings = getUserSettings(ownerId);
  try {
    const cityRoot = await validateCityRoot(city.root_path, settings.cityRoot);
    const bytes = new TextEncoder().encode(input.content);
    const source = await saveKnowledgeDocument(
      input.cityId,
      `${input.title.trim()}.md`,
      "text/markdown",
      bytes,
      input.content,
      cityRoot,
      settings.cityRoot,
    );
    return NextResponse.json({ source, message: source.duplicate ? "This exact document is already saved." : "Document saved and added to Judge's library." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save this document.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
