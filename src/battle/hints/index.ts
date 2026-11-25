import type { Band } from "@/rig/adaptive";

/**
 * The hint ladder (OVERHAUL.md, "Structure is discovered, not printed"), as data. Used when a battle
 * runs with `structure: "discover"`: the "N squads" / "N each" labels start hidden and each rung
 * reveals a little more. With `structure: "labels"` (the default) the labels are always shown and
 * the ladder only decides nothing; Radar, invite and Show Me How still follow `scaffold()`.
 *
 * - Nothing before the first answer, for any fleet (review round, decision 1): no first-sight hint.
 * - Miss 1: the strip says the miss, then the squads are counted one at a time, then the squads label.
 * - Miss 2: the ships of the first squad are counted, then the each label; the Power-Up that fits is flagged.
 * - Miss 3, or asking: Show Me How.
 * - 1 x n: a count that says "1 squad" tells nothing, so miss 1 counts the ships (the each rung).
 * - 0 x n and n x 0: there is nothing to count, so there is no scan rung (Show Me How still comes).
 */
export type HintId = "squads" | "each" | "show-me-how";
export type Reveal = "squads" | "each";
export type HintTrigger = "first-sight" | "miss" | "asked";

export interface Rung {
  id: HintId;
  level: 1 | 2 | 3;
  /** Shown once the cadet has missed this many times. */
  misses: number;
  /** Labels on screen once this rung shows (cumulative). */
  reveal: Reveal[];
  /** Flag the Power-Up that fits this fleet. */
  flagPowerUp: boolean;
  /** Start Show Me How. */
  showMeHow: boolean;
  /** Wait until Nova's reaction line is over before showing. */
  afterLine: boolean;
}

export const LADDER: readonly Rung[] = [
  { id: "squads", level: 1, misses: 1, reveal: ["squads"], flagPowerUp: false, showMeHow: false, afterLine: true },
  { id: "each", level: 2, misses: 2, reveal: ["squads", "each"], flagPowerUp: true, showMeHow: false, afterLine: false },
  { id: "show-me-how", level: 3, misses: 3, reveal: ["squads", "each"], flagPowerUp: true, showMeHow: true, afterLine: false },
];

/** `soft` is always false now (the first-sight hint is retired); kept so old readers still compile. */
export interface HintStep extends Rung { trigger: HintTrigger; soft: boolean }

/**
 * Where the cadet is on the ladder for this fleet. `level`: the highest rung already shown (0: none).
 * `soft`: unused (the first-sight hint is retired); accepted so old callers still compile.
 */
export interface HintState { misses: number; level: number; asked: boolean; soft?: boolean }

/** The fleet as the cadet sees it (squads x each), when the shape changes the ladder. */
export interface HintShape { a: number; b: number }

/**
 * The next rung to show, or null. Never before a miss or an ask (decision 1); `tier` is kept for callers
 * but no longer changes anything. `shape` (optional): 1 x n skips the squads rung, an empty fleet has no
 * scan rung.
 */
export function nextHint(s: HintState, tier?: Band, shape?: HintShape): HintStep | null {
  void tier;
  const top = LADDER[LADDER.length - 1];
  if (s.asked) return s.level < top.level ? { ...top, trigger: "asked", soft: false } : null;
  if (s.misses <= 0) return null;
  const empty = !!shape && (shape.a === 0 || shape.b === 0), single = !!shape && shape.a === 1 && !empty;
  const ladder: Rung[] = empty ? [top]
    : single ? [{ ...LADDER[1], misses: 1, reveal: ["each"], flagPowerUp: false }, top]
    : [...LADDER];
  const rung = [...ladder].reverse().find((r) => r.misses <= s.misses);
  if (!rung || rung.level <= s.level) return null;
  return { ...rung, trigger: "miss", soft: false };
}
