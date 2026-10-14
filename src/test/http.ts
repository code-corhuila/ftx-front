import { vi } from "vitest";

export interface RecordedCall {
  url: URL;
  method: string;
  headers: Headers;
  body: unknown;
}

type Reply = { status: number; body?: unknown } | Error;

/**
 * Sustituye `fetch` por un gateway ficticio que responde en orden con `replies`
 * (la última se repite) y registra cada petición.
 */
export function stubGateway(...replies: Reply[]): RecordedCall[] {
  const calls: RecordedCall[] = [];
  let next = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string, init: RequestInit = {}) => {
      calls.push({
        url: new URL(String(input)),
        method: init.method ?? "GET",
        headers: new Headers(init.headers),
        body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      });
      const reply = replies[Math.min(next++, replies.length - 1)];
      if (reply instanceof Error) throw reply;
      const text = reply.body === undefined ? null : JSON.stringify(reply.body);
      return new Response(reply.status === 204 ? null : text, {
        status: reply.status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

export const errorBody = (error: string, message = "Error", details?: unknown[]) => ({
  error,
  message,
  ...(details ? { details } : {}),
  traceId: "00000000-0000-4000-8000-000000000000",
});
