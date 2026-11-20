import { randomUUID } from "node:crypto";
import { mkdir, realpath, rmdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentGoogleId } from "@/lib/current-user";
import db from "@/lib/db";
import { getUserSettings } from "@/lib/user-settings";

function isCityInput(value: unknown): value is { name: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string"
  );
}

function folderSlug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "city";
}

export async function GET() {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) {
    return NextResponse.json(
      { error: "Your Google session could not be matched to a local user. Log out, then sign in with Google again." },
      { status: 401 },
    );
  }

  const cities = db
    .prepare("SELECT id, name FROM cities WHERE owner_id = ? ORDER BY id DESC")
    .all(ownerId);

  return NextResponse.json({ cities });
}

export async function POST(request: Request) {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) {
    return NextResponse.json(
      { error: "Your Google session could not be matched to a local user. Log out, then sign in with Google again." },
      { status: 401 },
    );
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isCityInput(input)) {
    return NextResponse.json({ error: "City name is required." }, { status: 400 });
  }

  const name = input.name.trim();
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "City name must be between 1 and 60 characters." }, { status: 400 });
  }

  const { cityRoot } = getUserSettings(ownerId);
  await mkdir(cityRoot, { recursive: true });
  const base = await realpath(cityRoot);
  const rootPath = path.join(base, `${folderSlug(name)}-${randomUUID()}`);
  await mkdir(rootPath);

  try {
    const result = db
      .prepare("INSERT INTO cities (name, root_path, owner_id) VALUES (?, ?, ?)")
      .run(name, rootPath, ownerId);

    return NextResponse.json(
      { city: { id: Number(result.lastInsertRowid), name } },
      { status: 201 },
    );
  } catch (error) {
    try {
      await rmdir(rootPath);
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Could not save the city or clean up its folder.");
    }
    throw error;
  }
}
