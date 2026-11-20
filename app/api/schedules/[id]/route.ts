import { NextResponse } from "next/server";
import { getCurrentGoogleId } from "@/lib/current-user";
import db from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

function scheduleId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) return NextResponse.json({ error: "Sign in to update scheduled jobs." }, { status: 401 });

  const id = scheduleId((await context.params).id);
  if (id === null) return NextResponse.json({ error: "Invalid scheduled job id." }, { status: 400 });

  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof value !== "object" || value === null || !("enabled" in value) || typeof value.enabled !== "boolean") {
    return NextResponse.json({ error: "Provide an enabled boolean." }, { status: 400 });
  }

  const result = db.prepare("UPDATE scheduled_jobs SET enabled = ? WHERE id = ? AND owner_id = ?")
    .run(value.enabled ? 1 : 0, id, ownerId);
  if (result.changes !== 1) return NextResponse.json({ error: "Scheduled job not found." }, { status: 404 });

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) return NextResponse.json({ error: "Sign in to delete scheduled jobs." }, { status: 401 });

  const id = scheduleId((await context.params).id);
  if (id === null) return NextResponse.json({ error: "Invalid scheduled job id." }, { status: 400 });

  const result = db.prepare("DELETE FROM scheduled_jobs WHERE id = ? AND owner_id = ?")
    .run(id, ownerId);
  if (result.changes !== 1) return NextResponse.json({ error: "Scheduled job not found." }, { status: 404 });

  return NextResponse.json({ success: true });
}
