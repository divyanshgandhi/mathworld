import type { EventInput } from "@/db/events";
import type { LoggedEvent } from "@/director/fold";

/**
 * The client side of the event log: events go to /api/events strictly in order (one request in
 * flight at a time, whatever piled up meanwhile goes as one batch), because the fold reads order.
 *
 * Nothing earned is ever dropped for network or server trouble: a failed batch stays at the head of
 * the queue and is retried with back-off, with no cap on tries, and the queue is kept in
 * localStorage so a reload or a crash keeps it too. Every event carries a client-made id, so a retry
 * whose first try was stored (the response was lost) is ignored by the server instead of stored twice.
 * Only a 400 (the event itself is malformed) or a 401 (no cadet on this device) drops an event.
 */
type Item = { id: string; e: EventInput };
const KEY = "mw:outbox";
const queue: Item[] = load();
let sending: Promise<void> | null = null;
let failing = false;
const listeners = new Set<() => void>();
/** Who is waiting on an event posted from this page: told true once it is stored, false if it was dropped. */
const waiting = new Map<string, (stored: boolean) => void>();
const settle = (items: Item[], stored: (i: Item) => boolean) => items.forEach((i) => { waiting.get(i.id)?.(stored(i)); waiting.delete(i.id); });
const emit = () => listeners.forEach((l) => l());

function load(): Item[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const j = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Item[];
    return Array.isArray(j) ? j.filter((i) => i && typeof i.id === "string" && i.e) : [];
  } catch { return []; }
}
function save() {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(queue)); } catch { /* storage full or off: the memory queue still retries */ }
}
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);

/** "ok" stored, "bad" rejected (retrying won't help), "retry" network or server trouble. */
async function send(items: Item[]): Promise<"ok" | "bad" | "retry"> {
  const body = { events: items.map((i) => i.e), ids: items.map((i) => i.id) };
  const r = await fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return r?.ok ? "ok" : r?.status === 400 || r?.status === 401 ? "bad" : "retry";
}

/** Back-off between retries: 0.4 s, 0.8 s, 1.6 s ... capped at 10 s. */
export const backoff = (tries: number) => Math.min(10_000, 400 * 2 ** tries);

async function drain() {
  let tries = 0;
  while (queue.length) {
    const batch = queue.slice(0, 50);
    const res = await send(batch);
    if (res === "retry") {
      if (!failing) { failing = true; emit(); }
      await new Promise((r) => setTimeout(r, backoff(tries++)));
      continue;
    }
    // one malformed event must not take the rest of the batch with it: send them one by one
    const fine = new Set<string>();
    if (res === "bad" && batch.length > 1) {
      for (const item of batch) {
        let t = 0, one: "ok" | "bad" | "retry";
        while ((one = await send([item])) === "retry") await new Promise((r) => setTimeout(r, backoff(t++)));
        if (one === "ok") fine.add(item.id);
      }
    }
    queue.splice(0, batch.length);
    save();
    settle(batch, (i) => res === "ok" || fine.has(i.id));
    tries = 0;
    if (failing) { failing = false; emit(); }
  }
  sending = null;
  emit();
}

/**
 * Queue one event. The promise resolves true once the server has stored it, or false if the server
 * rejected it for good (malformed, or no cadet): never for network trouble, which is retried until it
 * goes through. A screen that must not show something before it is saved (a purchase, a patrol's pay)
 * waits on it; the rest can ignore it.
 */
export function post(e: EventInput): Promise<boolean> {
  const id = newId();
  const stored = new Promise<boolean>((r) => waiting.set(id, r));
  queue.push({ id, e });
  save();
  emit();
  sending ??= drain();
  return stored;
}

/** Resolves once everything posted so far is stored (before navigating away). */
export const flushed = () => sending ?? Promise.resolve();

/** For the HUD's calm save mark: "saved", "saving" (in flight), or "waiting" (a try failed, retrying). */
export const saveState = (): "saved" | "saving" | "waiting" => (failing ? "waiting" : queue.length ? "saving" : "saved");
export const onSaveState = (l: () => void) => { listeners.add(l); return () => void listeners.delete(l); };

// a queue left by a reload or a crash goes out as soon as the page is back
if (typeof window !== "undefined" && queue.length) sending ??= drain();

/** The cadet's log as the fold reads it (after what is still queued here, so the fold sees it). */
export async function history(): Promise<LoggedEvent[]> {
  await Promise.race([flushed(), new Promise((r) => setTimeout(r, 3000))]);
  const r = await fetch("/api/events").catch(() => null);
  if (!r?.ok) return [];
  const j = (await r.json()) as { events: LoggedEvent[] };
  return j.events.map(({ type, payload }) => ({ type, payload }) as LoggedEvent);
}
