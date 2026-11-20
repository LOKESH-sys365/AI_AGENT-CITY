import { NextResponse } from "next/server";
import { getCurrentGoogleId } from "@/lib/current-user";
import db from "@/lib/db";
import {
  extractDocumentText,
  getDocumentMimeType,
  listKnowledgeDocuments,
  MAX_DOCUMENT_BYTES,
  saveKnowledgeDocument,
} from "@/lib/document-library";
import { validateCityRoot } from "@/lib/fs-tools";
import { getUserSettings } from "@/lib/user-settings";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILES = 20;
const MAX_BATCH_BYTES = 50 * 1024 * 1024;

function parseCityId(value: string | null) {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const cityId = Number(value);
  return Number.isSafeInteger(cityId) ? cityId : null;
}

async function getOwnedCity(cityId: number, ownerId: string) {
  return db
    .prepare("SELECT root_path FROM cities WHERE id = ? AND owner_id = ?")
    .get(cityId, ownerId) as { root_path: string } | undefined;
}

export async function GET(request: Request) {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) return NextResponse.json({ error: "Sign in to manage city documents." }, { status: 401 });

  const cityId = parseCityId(new URL(request.url).searchParams.get("cityId"));
  if (!cityId) return NextResponse.json({ error: "A valid cityId is required." }, { status: 400 });
  if (!(await getOwnedCity(cityId, ownerId))) {
    return NextResponse.json({ error: "City not found." }, { status: 404 });
  }
  return NextResponse.json({ documents: listKnowledgeDocuments(cityId) });
}

export async function POST(request: Request) {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) return NextResponse.json({ error: "Sign in to upload city documents." }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload must use multipart form data." }, { status: 400 });
  }

  const cityId = parseCityId(String(formData.get("cityId") ?? ""));
  if (!cityId) return NextResponse.json({ error: "A valid cityId is required." }, { status: 400 });
  const files = formData.getAll("files");
  if (files.length === 0 || files.some((file) => !(file instanceof File))) {
    return NextResponse.json({ error: "Select one or more PDF, TXT, or Markdown files." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Upload no more than ${MAX_FILES} files at a time.` }, { status: 413 });
  }
  const labels = formData.getAll("labels");
  if (labels.length !== files.length || labels.some((label) => typeof label !== "string")) {
    return NextResponse.json({ error: "The upload's file names are invalid." }, { status: 400 });
  }

  const totalBytes = files.reduce((total, file) => total + (file instanceof File ? file.size : 0), 0);
  if (files.some((file) => file instanceof File && file.size > MAX_DOCUMENT_BYTES) || totalBytes > MAX_BATCH_BYTES) {
    return NextResponse.json({ error: "Each file is limited to 20 MB and each upload batch to 50 MB." }, { status: 413 });
  }

  const city = await getOwnedCity(cityId, ownerId);
  if (!city) return NextResponse.json({ error: "City not found." }, { status: 404 });
  const settings = getUserSettings(ownerId);

  let cityRoot: string;
  try {
    cityRoot = await validateCityRoot(city.root_path, settings.cityRoot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? `City folder is unavailable: ${error.message}` : "City folder is unavailable." },
      { status: 409 },
    );
  }

  const uploaded: Array<{ id: number; filename: string; chunkCount: number; duplicate: boolean }> = [];
  const failed: Array<{ filename: string; error: string }> = [];
  for (const [index, entry] of files.entries()) {
    if (!(entry instanceof File) || typeof labels[index] !== "string") continue;
    try {
      const bytes = new Uint8Array(await entry.arrayBuffer());
      const mimeType = getDocumentMimeType(entry.name);
      const text = await extractDocumentText(entry.name, bytes);
      const source = await saveKnowledgeDocument(
        cityId,
        labels[index],
        mimeType,
        bytes,
        text,
        cityRoot,
        settings.cityRoot,
      );
      uploaded.push(source);
    } catch (error) {
      failed.push({
        filename: entry.name,
        error: error instanceof Error ? error.message : "Could not process this document.",
      });
    }
  }

  return NextResponse.json(
    { uploaded, failed, documents: listKnowledgeDocuments(cityId) },
    { status: uploaded.length === 0 && failed.length > 0 ? 422 : 200 },
  );
}
