import type { Band } from "@/rig/adaptive";

/**
 * The hint ladder (OVERHAUL.md, "Structure is discovered, not printed"), as data. Used when a battle
 * runs with `structure: "discover"`: the "N squads" / "N each" labels start hidden and each rung
 * reveals a little more. With `structure: "labels"` (the default) the labels are always shown and
 * the ladder only decides nothing; Radar, invite and Show Me How still follow `scaffold()`.
 *
 * - Miss 1: the outcome plays, Nova names the mistake, then the squads label shows.
 * - Miss 2: the each label shows and the Power-Up that fits is flagged.
 * - Miss 3, or asking: Show Me How.
 * - A fact never met gets the squads label softly at once. A known fact gets nothing unprompted.
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

export interface HintStep extends Rung { trigger: HintTrigger; soft: boolean }

/**
 * Where the cadet is on the ladder for this fleet. `level`: the highest rung already shown (0: none).
 * `soft`: the first-sight squads label is up (it does not count as a rung, so miss 1 still firms it).
 */
export interface HintState { misses: number; level: number; asked: boolean; soft?: boolean }

/**
 * The next rung to show, or null. `tier` is the fact's mastery band (`band()` in src/rig/adaptive.ts):
 * only a fact never met ("unseen") gets a hint before any miss, and it is soft.
 */
export function nextHint(s: HintState, tier: Band): HintStep | null {
  if (s.asked) {
    const top = LADDER[LADDER.length - 1];
    return s.level < top.level ? { ...top, trigger: "asked", soft: false } : null;
  }
  if (s.misses <= 0) return s.level === 0 && !s.soft && tier === "unseen" ? { ...LADDER[0], trigger: "first-sight", soft: true, afterLine: false } : null;
  const rung = [...LADDER].reverse().find((r) => r.misses <= s.misses);
  if (!rung || rung.level <= s.level) return null;
  return { ...rung, trigger: "miss", soft: false };
}
