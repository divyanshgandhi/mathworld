import { audio } from "@/engine/audio";
import type { Stage } from "@/engine/stage";

/**
 * One switch for "the game is holding still": the pause menu, a card that must be read, a hidden tab.
 * Each holder names a reason; the stage clock (every battle timer runs on it) and the sound (Nova's
 * voice, the music bed, effects) stop while any reason is held, and run again when the last is let go.
 */
const reasons = new Set<string>();
const subs = new Set<() => void>();

function stage(): Stage | undefined {
  return typeof window === "undefined" ? undefined : window.__mw?.stage;
}

function apply() {
  const on = reasons.size > 0, s = stage();
  if (s) s.paused = on;
  const ctx = audio.context;
  if (ctx) void (on ? ctx.suspend() : ctx.resume()).catch(() => {});
  subs.forEach((f) => f());
}

export const hold = {
  /** Hold the game still for this reason (idempotent). */
  on(reason: string) { if (!reasons.has(reason)) { reasons.add(reason); apply(); } },
  /** Let go of this reason; the game runs again when nothing else holds it. */
  off(reason: string) { if (reasons.delete(reason)) apply(); },
  /** Let go of everything (a battle unmounting must never leave the next screen frozen). */
  clear() { if (reasons.size) { reasons.clear(); apply(); } },
  has: (reason: string) => reasons.has(reason),
  get held() { return reasons.size > 0; },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
};
