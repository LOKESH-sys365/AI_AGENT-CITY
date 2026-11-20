import { NextResponse } from "next/server";
import { getCurrentGoogleId } from "@/lib/current-user";
import db from "@/lib/db";
import { extractDocumentText } from "@/lib/document-library";
import { readCityFile, validateCityRoot } from "@/lib/fs-tools";
import { getUserSettings } from "@/lib/user-settings";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) return NextResponse.json({ error: "Sign in to open city documents." }, { status: 401 });

  const { documentId: rawId } = await params;
  if (!/^[1-9]\d*$/.test(rawId)) return NextResponse.json({ error: "Invalid document ID." }, { status: 400 });
  const documentId = Number(rawId);
  const cityIdValue = new URL(request.url).searchParams.get("cityId");
  if (!cityIdValue || !/^[1-9]\d*$/.test(cityIdValue)) {
    return NextResponse.json({ error: "A valid cityId is required." }, { status: 400 });
  }
  const cityId = Number(cityIdValue);
  if (!Number.isSafeInteger(documentId) || !Number.isSafeInteger(cityId)) {
    return NextResponse.json({ error: "Invalid document or city ID." }, { status: 400 });
  }

  const city = db
    .prepare("SELECT root_path FROM cities WHERE id = ? AND owner_id = ?")
    .get(cityId, ownerId) as { root_path: string } | undefined;
  if (!city) return NextResponse.json({ error: "City not found." }, { status: 404 });

  const source = db
    .prepare("SELECT filename, relative_path FROM document_sources WHERE id = ? AND city_id = ?")
    .get(documentId, cityId) as { filename: string; relative_path: string } | undefined;
  if (!source) return NextResponse.json({ error: "Document not found in this city." }, { status: 404 });

  const settings = getUserSettings(ownerId);
  try {
    const cityRoot = await validateCityRoot(city.root_path, settings.cityRoot);
    const bytes = await readCityFile(source.relative_path, cityRoot, settings.cityRoot);
    const text = await extractDocumentText(source.filename, bytes);
    return NextResponse.json({ filename: source.filename, text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The source file could not be opened.";
    return NextResponse.json({ error: `The source file is unavailable: ${message}` }, { status: 409 });
  }
}
