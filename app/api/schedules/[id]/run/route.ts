import { NextResponse } from "next/server";
import { getCurrentGoogleId } from "@/lib/current-user";
import { runScheduledJob } from "@/lib/scheduler";

export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const ownerId = await getCurrentGoogleId();
  if (!ownerId) return NextResponse.json({ error: "Sign in to run scheduled jobs." }, { status: 401 });

  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid scheduled job id." }, { status: 400 });
  }

  try {
    await runScheduledJob(id, { ownerId, force: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The scheduled job failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
