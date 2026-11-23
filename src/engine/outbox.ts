import type { EventInput } from "@/db/events";
import type { LoggedEvent } from "@/director/fold";

/**
 * The client side of the event log: events go to /api/events strictly in order (one request in
 * flight at a time, whatever piled up meanwhile goes as one batch), because the fold reads order.
 */
const queue: EventInput[] = [];
let sending: Promise<void> | null = null;

/** "ok" stored, "bad" rejected by validation (retrying won't help), "retry" network or server trouble. */
async function send(body: unknown): Promise<"ok" | "bad" | "retry"> {
  const r = await fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return r?.ok ? "ok" : r?.status === 400 ? "bad" : "retry";
}

async function drain() {
  while (queue.length) {
    const batch = queue.splice(0, 50);
    for (let tries = 0; tries < 3; tries++) {
      const res = await send(batch.length === 1 ? batch[0] : { events: batch });
      if (res === "ok") break;
      if (res === "bad") {
        // one malformed event must not take the rest of the batch with it: send them one by one
        if (batch.length > 1) for (const e of batch) await send(e);
        break;
      }
      await new Promise((r) => setTimeout(r, 400 * (tries + 1)));
    }
  }
  sending = null;
}

export function post(e: EventInput) {
  queue.push(e);
  sending ??= drain();
}

/** Resolves once everything posted so far is stored (before navigating away). */
export const flushed = () => sending ?? Promise.resolve();

/** The cadet's log as the fold reads it. */
export async function history(): Promise<LoggedEvent[]> {
  const r = await fetch("/api/events").catch(() => null);
  if (!r?.ok) return [];
  const j = (await r.json()) as { events: LoggedEvent[] };
  return j.events.map(({ type, payload }) => ({ type, payload }) as LoggedEvent);
}
