import { NextResponse } from "next/server";
import { A2AAuthError, authenticateA2ARequest } from "@/lib/a2a-auth";
import { getA2AServerCallContext, getA2ATransportHandler } from "@/lib/a2a-server";

export const runtime = "nodejs";
export const maxDuration = 120;

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.asyncIterator in value &&
    typeof value[Symbol.asyncIterator] === "function"
  );
}

export async function POST(request: Request) {
  let googleId: string;
  try {
    googleId = await authenticateA2ARequest(request);
  } catch (error) {
    if (error instanceof A2AAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("A2A authentication failed unexpectedly.", error);
    return NextResponse.json({ error: "A2A authentication failed." }, { status: 500 });
  }

  try {
    const result = await getA2ATransportHandler().handle(
      await request.text(),
      getA2AServerCallContext(request, googleId),
    );
    if (!isAsyncIterable(result)) return NextResponse.json(result);

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for await (const response of result) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(response)}\n\n`));
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("A2A request failed.", error);
    return NextResponse.json({ error: "The A2A request could not be processed." }, { status: 500 });
  }
}
