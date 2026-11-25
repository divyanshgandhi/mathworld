"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { EventInput } from "@/db/events";
import { SEEN_KEY_RE } from "./keys";

/**
 * "Has this player met this yet?" for greetings, the guided first shot and manual pages.
 *
 * The truth is the event log: `{ type: "seen", payload: { key } }`, folded into `state.seen[key]`.
 * A screen that already holds the folded state (the hubs, through `useCadet`) passes it in:
 *
 *   const { state, emit } = useCadet();
 *   const greet = useSeen("greet:bay", { seen: state?.seen, emit });
 *
 * Without a source (the battle, /manual) the hook reads the log once per page load and posts through
 * the outbox itself. Either way a key marked here is seen at once everywhere on the page, so two
 * components never both greet, and a slow or failed save never shows the same line twice in a visit.
 */
export interface SeenSource {
  /** `state.seen` from the fold. `undefined` or `null` while it loads. */
  seen: Record<string, number> | null | undefined;
  /** Appends an event (the hub's `emit`, or `post` from the outbox). */
  emit: (e: EventInput) => void;
}

type Loaded = { keys: Set<string>; canPost: boolean };
const marked = new Set<string>();
let loaded: Loaded | null = null;
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();
let version = 0;
const notify = () => { version++; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => void subs.delete(f); };

/** Reads the player's seen keys from the log, once per page load (no cadet: nothing is posted). */
function load() {
  loading ??= (async () => {
    try {
      const p = await fetch("/api/player").then((r) => r.json()).catch(() => ({ player: null }));
      if (!p?.player) { loaded = { keys: new Set(), canPost: false }; return; }
      const { history } = await import("@/engine/outbox");
      const log = await history();
      loaded = { keys: new Set(log.flatMap((e) => (e.type === "seen" ? [e.payload.key] : []))), canPost: true };
    } catch {
      loaded = { keys: new Set(), canPost: false };
    } finally {
      notify();
    }
  })();
  return loading;
}

/** For tests and the /dev/teach review: forget everything this page has marked. */
export function resetSeen(keys?: string[]) {
  if (keys) keys.forEach((k) => { marked.delete(k); loaded?.keys.delete(k); });
  else { marked.clear(); loaded?.keys.clear(); }
  notify();
}

/**
 * `seen`: `true` once met, `false` if not yet, `null` while we do not know (show nothing then).
 * `mark()` records it (once; calling it again does nothing).
 */
export function useSeen(key: string, source?: SeenSource): { seen: boolean | null; mark: () => void } {
  if (!SEEN_KEY_RE.test(key)) throw new Error(`seen key "${key}" does not match ${SEEN_KEY_RE}`);
  useSyncExternalStore(subscribe, () => version, () => 0);
  const own = !source;
  useEffect(() => { if (own) void load(); }, [own]);

  const fromSource = source ? (source.seen ? (source.seen[key] ?? 0) > 0 : null) : loaded ? loaded.keys.has(key) : null;
  const seen = marked.has(key) ? true : fromSource;

  const emit = source?.emit;
  const mark = useCallback(() => {
    if (marked.has(key)) return;
    marked.add(key);
    notify();
    const e: EventInput = { type: "seen", payload: { key } };
    if (emit) emit(e);
    else if (loaded?.canPost) void import("@/engine/outbox").then(({ post }) => post(e));
  }, [key, emit]);
  return { seen, mark };
}

/** A source kept in memory only (the /dev/teach review): nothing is stored. */
export function memorySource(seen: Record<string, number> = {}): SeenSource {
  return { seen, emit: () => {} };
}
