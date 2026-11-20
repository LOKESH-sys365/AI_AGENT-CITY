import { NextResponse } from "next/server";
import { AgentCard } from "@a2a-js/sdk";
import { getA2AAgentCard } from "@/lib/a2a-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(AgentCard.toJSON(getA2AAgentCard()), {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    console.error("Could not create the public A2A Agent Card.", error);
    return NextResponse.json({ error: "A2A is not configured correctly." }, { status: 500 });
  }
}
