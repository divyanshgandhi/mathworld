import { scaffold } from "@/director/next";
import type { ErrorType } from "@/rig/errors";
import { safetyNetApplies } from "@/rig/showme";
import type { HintStep } from "./hints";

/**
 * The battle as a pure phase machine (no three.js, no DOM): one wave at a time, the shots at it, the
 * hint ladder, the streak and the anti-mash guard. The arena dispatches actions and draws what this
 * says; every rule about what happens after a shot lives here and is unit-tested.
 *
 *   briefing → next → aiming ⇄ lesson
 *                       ↓ fire
 *                     volley → resolve (exact) → cleared → next | offer | done
 *                            → hint (miss)     → aiming | lesson (after the regroup)
 */
export type Phase = "briefing" | "next" | "aiming" | "volley" | "resolve" | "hint" | "lesson" | "cleared" | "offer" | "done";
export type Structure = "labels" | "discover";

/** What a miss leads to. */
export interface MissRoute {
  /** `safety-net`: stuck after a lesson on an early level, so Show Me How drops to Fast Adding. */
  kind: "safety-net" | "show-me-how" | "react";
  /** Three wild guesses fast: Nova asks the cadet to hold fire. */
  mash: boolean;
  radar: boolean;
  invite: boolean;
}

export interface BattleState {
  phase: Phase;
  /** Show Me How is on screen (it stays until the next shot, even after its last line). */
  lessonOn: boolean;
  wave: { a: number; b: number } | null;
  /** Counts every wave, so a callback can tell it belongs to an old fleet. */
  waveNo: number;
  /** Shots at this wave. */
  attempts: number;
  usedRadar: boolean;
  /** Show Me How runs this wave. */
  lessons: number;
  fallbackUsed: boolean;
  /** The hint ladder for this wave (structure "discover"). */
  hint: { level: number; soft: boolean; asked: boolean; squads: boolean; each: boolean; powerUp: boolean };
  /** Waves cleared first try in a row, this battle. */
  streak: number;
  /** Anti-mash: times (ms) of recent wild guesses. */
  wild: number[];
  lastMiss: MissRoute | null;
  /** The digits being typed (null: nothing typed). */
  charge: number | null;
}

export const WILD_WINDOW_MS = 12_000;
export const MASH_WILDS = 3;
export const MASH_LATENCY_MS = 4000;

const NO_HINT: BattleState["hint"] = { level: 0, soft: false, asked: false, squads: false, each: false, powerUp: false };

export const initialBattle = (): BattleState => ({
  phase: "briefing", lessonOn: false, wave: null, waveNo: 0, attempts: 0, usedRadar: false, lessons: 0, fallbackUsed: false,
  hint: NO_HINT, streak: 0, wild: [], lastMiss: null, charge: null,
});

export type BattleAction =
  | { type: "start" }
  | { type: "wave"; a: number; b: number }
  | { type: "ready" }
  /** A shot. A lesson on screen stays until `lesson_end` (the arena closes it right after). */
  | { type: "fire"; radar: boolean }
  | { type: "exact" }
  /** `now`: ms clock at the miss; `latencyMs`: shown → fired; `tier`: the planet's tier. */
  | { type: "miss"; guess: number; errorType: ErrorType | null; latencyMs: number; now: number; tier: number }
  | { type: "cleared" }
  | { type: "lesson"; fallback: boolean }
  | { type: "lesson_end" }
  | { type: "hint"; step: HintStep }
  | { type: "ask" }
  | { type: "offer" }
  | { type: "done" }
  | { type: "charge"; n: number | null };

/** The keypad is live: aiming, or during Show Me How (firing at any moment ends the lesson). */
export const canAim = (s: BattleState) => s.phase === "aiming" || s.phase === "lesson";

/** What a miss leads to, from the state just before it (`attempts` already counts this shot). */
export function routeMiss(s: BattleState, a: number, b: number, guess: number, mash: boolean, tier: number): MissRoute {
  const sc = scaffold(s.attempts, a, b, guess);
  if (s.lessons > 0 && !s.fallbackUsed && safetyNetApplies(tier, a, b)) return { kind: "safety-net", mash, radar: false, invite: false };
  if (sc.showMeHow && s.lessons === 0) return { kind: "show-me-how", mash, radar: false, invite: false };
  return { kind: "react", mash, radar: sc.radar, invite: sc.invite };
}

export function reduce(s: BattleState, act: BattleAction): BattleState {
  switch (act.type) {
    case "start":
      return s.phase === "briefing" ? { ...s, phase: "next" } : s;
    case "wave":
      return {
        ...s, phase: "next", lessonOn: false, wave: { a: act.a, b: act.b }, waveNo: s.waveNo + 1, attempts: 0, usedRadar: false,
        lessons: 0, fallbackUsed: false, hint: NO_HINT, lastMiss: null, wild: [], charge: null,
      };
    case "ready":
      return s.wave ? { ...s, phase: s.lessonOn ? "lesson" : "aiming" } : s;
    case "fire":
      if (!canAim(s) || !s.wave) return s;
      return { ...s, phase: "volley", attempts: s.attempts + 1, usedRadar: s.usedRadar || act.radar, charge: null };
    case "exact":
      return s.phase === "volley" ? { ...s, phase: "resolve", lastMiss: null } : s;
    case "miss": {
      if (s.phase !== "volley" || !s.wave) return s;
      let wild = s.wild;
      if (act.errorType === "wild_guess") wild = [...wild.filter((t) => act.now - t < WILD_WINDOW_MS), act.now];
      const mash = act.errorType === "wild_guess" && wild.length >= MASH_WILDS && act.latencyMs < MASH_LATENCY_MS;
      if (mash) wild = [];
      const lastMiss = routeMiss(s, s.wave.a, s.wave.b, act.guess, mash, act.tier);
      return { ...s, phase: "hint", wild, lastMiss, streak: 0 };
    }
    case "cleared":
      return { ...s, phase: "cleared", streak: s.attempts === 1 ? s.streak + 1 : 0 };
    case "lesson":
      return { ...s, phase: "lesson", lessonOn: true, lessons: s.lessons + 1, fallbackUsed: s.fallbackUsed || act.fallback };
    case "lesson_end":
      return s.lessonOn ? { ...s, lessonOn: false, phase: s.phase === "lesson" ? "aiming" : s.phase } : s;
    case "hint": {
      const st = act.step, h = s.hint;
      return {
        ...s,
        hint: {
          level: st.soft ? h.level : Math.max(h.level, st.level), soft: h.soft || st.soft, asked: h.asked,
          squads: h.squads || st.reveal.includes("squads"), each: h.each || st.reveal.includes("each"), powerUp: h.powerUp || st.flagPowerUp,
        },
      };
    }
    case "ask":
      return { ...s, hint: { ...s.hint, asked: true } };
    case "offer":
      return { ...s, phase: "offer", wave: null, lessonOn: false };
    case "done":
      return { ...s, phase: "done", wave: null, lessonOn: false };
    case "charge":
      return { ...s, charge: act.n };
  }
}

/** Where the cadet is on the hint ladder, for `nextHint()`. */
export const hintState = (s: BattleState) => ({ misses: s.attempts, level: s.hint.level, asked: s.hint.asked, soft: s.hint.soft });
