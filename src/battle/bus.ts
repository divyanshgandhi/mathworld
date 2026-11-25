import type { EventInput } from "@/db/events";
import type { Sfx } from "@/engine/audio";
import type { WaveRole } from "@/director/fold";
import type { ErrorType } from "@/rig/errors";
import type { PlanetId } from "@/rig/pools";
import type { TrickId } from "@/rig/tricks";
import type { HintId, Reveal } from "./hints";

/**
 * Everything that happens inside one battle, as typed events. The arena emits; persistence (the
 * EventInput log), sound cues, telemetry and parts of the UI state subscribe. Delivery is synchronous
 * and in subscription order, so a subscriber that writes the log runs before anything that folds it.
 */
export interface BattleEvents {
  /** A new fleet is on its way in. */
  wave_started: { a: number; b: number; index: number; role: string };
  /** The cadet fired `n` plasma balls (the answer is the action). */
  fire: {
    n: number; a: number; b: number; planet: PlanetId; latencyMs: number; attempt: number; radar: boolean; usedRadar: boolean;
    errorType: ErrorType | null; powerUp: TrickId | null; isTransferCheck: boolean; waveRole: WaveRole;
  };
  /** One ball leaves the cannon. `extra`: a ball with no ship left to hit. `t` is stage time. */
  launch: { extra: boolean; t: number };
  /** One ball lands on a ship. `full`: the ship is destroyed. `t` is stage time. */
  hit: { ship: number; amount: number; full: boolean; t: number };
  /** The volley is over and missed: `value` ships still flying (under) or balls past (over). */
  miss: { kind: "under" | "over"; value: number; errorType: ErrorType | null; attempt: number; mash: boolean };
  /** A shot has been judged. */
  resolved: { correct: boolean; n: number; product: number; attempt: number };
  /** The fleet is cleared (exact answer). */
  wave_cleared: { a: number; b: number; attempts: number; firstTry: boolean; streak: number };
  /** Shields back up: every ship returns for another try. */
  regroup: Record<string, never>;
  /** The keypad is live again. */
  ready: Record<string, never>;
  /** A Power-Up was pressed. `fits`: it can act on this fleet. */
  powerup_applied: { id: TrickId; a: number; b: number; fits: boolean };
  /** A step of the hint ladder showed (structure: "discover"). */
  hint_shown: { id: HintId; level: number; a: number; b: number; soft: boolean; trigger: "first-sight" | "miss" | "asked"; reveal: Reveal[]; powerUp: TrickId | null };
  /** Show Me How began. */
  lesson_started: { tricks: TrickId[]; a: number; b: number; mode: "full" | "fast"; auto: boolean; fallback: boolean };
  /** Show Me How was answered (the next shot after a lesson). */
  lesson_completed: { tricks: TrickId[]; a: number; b: number; mode: "full" | "fast"; wedoCorrect: boolean };
  /** Show Me How's last line was said, `ms` after it began. */
  lesson_spoken: { ms: number };
  /** Orbs earned. */
  orb_burst: { amount: number; reason: "wave_clear" | "planet_cleared" };
  /** The planet (or the practice run) is finished. */
  battle_done: { kind: "clear" | "practice" | "academy" };
  /** The digits being typed (null: nothing typed). */
  charge: { n: number | null };
  /** A director-level event to store as it is (housekeeping, a Hyper-Jump, the intro's end). */
  record: { event: EventInput };
  /** A one-off sound for a beat that has no event of its own (lesson beats, Sector-Lock). */
  cue: { sfx: Sfx };
}
export type BattleEventType = keyof BattleEvents;
export type Handler<K extends BattleEventType> = (payload: BattleEvents[K]) => void;

export function createBus() {
  const subs = new Map<BattleEventType, Set<Handler<BattleEventType>>>();
  const any = new Set<(type: BattleEventType, payload: unknown) => void>();
  return {
    on<K extends BattleEventType>(type: K, fn: Handler<K>) {
      let set = subs.get(type);
      if (!set) subs.set(type, (set = new Set()));
      set.add(fn as Handler<BattleEventType>);
      return () => void set.delete(fn as Handler<BattleEventType>);
    },
    /** Every event, in order (dev tools, tests). */
    onAny(fn: (type: BattleEventType, payload: unknown) => void) { any.add(fn); return () => void any.delete(fn); },
    emit<K extends BattleEventType>(type: K, payload: BattleEvents[K]) {
      for (const fn of [...(subs.get(type) ?? [])]) (fn as Handler<K>)(payload);
      for (const fn of [...any]) fn(type, payload);
    },
    clear() { subs.clear(); any.clear(); },
  };
}
export type Bus = ReturnType<typeof createBus>;
