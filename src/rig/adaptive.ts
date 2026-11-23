/**
 * Per-fact mastery and the levelling rules, as pure functions and named constants.
 * The director folds events through these; the simulation harness proves them.
 */

/** Silent "fast" thresholds per tier (ms). Never shown as a timer. */
export const FAST_MS = [3500, 3500, 5000, 5000, 10000, 22000, 45000, 45000];
export const fastMs = (tier: number) => FAST_MS[Math.min(Math.max(tier, 0), FAST_MS.length - 1)];

export const M0 = 0.25;
export const ALPHA = 0.35;
export const ewma = (m: number, obs: number, alpha = ALPHA) => m + alpha * (obs - m);

/**
 * Resting Bay flashcards: a fast, correct card is a gentle nudge (a smaller step toward a lower
 * observation than a battle Gold) and counts as a fast win, so a Mint fact can polish to Gold.
 * A correct card never lowers mastery. Slow or wrong cards change nothing.
 */
export const FLASHCARD_ALPHA = 0.18;
export const FLASHCARD_OBS = 0.78;

/** How a wave was finally solved, from best to most helped. */
export type Outcome = "fast" | "thoughtful" | "powerup" | "self_corrected" | "radar" | "show_me_how";
export const OBS: Record<Outcome, number> = { fast: 1.0, thoughtful: 0.85, powerup: 0.72, self_corrected: 0.65, radar: 0.45, show_me_how: 0.2 };

export interface WaveFacts { attempts: number; usedRadar: boolean; powerUp: boolean; explained: boolean; firstLatencyMs: number }
export function outcomeOf(w: WaveFacts, tier: number): Outcome {
  if (w.explained) return "show_me_how";
  if (w.usedRadar) return "radar";
  if (w.attempts > 1) return "self_corrected";
  if (w.powerUp) return "powerup";
  return w.firstLatencyMs <= fastMs(tier) ? "fast" : "thoughtful";
}

/**
 * "Solved" for unlocking a planet: the cadet's own answer on the first try (a Power-Up is fine,
 * it is a conceptual win). Radar picks and Show Me How do not count.
 */
export const isSolved = (o: Outcome) => o === "fast" || o === "thoughtful" || o === "powerup";
/** Gold: instant, unassisted recall. Three in a row offers a Hyper-Jump. */
export const isGold = (o: Outcome) => o === "fast";
/** A struggle: first try missed or Show Me How needed. Two in a row brings a Shield Recharge. */
export const isStruggle = (o: Outcome) => !isSolved(o);

export const GOLD_STREAK_FOR_JUMP = 3;
export const JUMP = 2;
export const STRUGGLES_FOR_CUSHION = 2;
export const TRANSFER_DELAY = 2;

/** Missions: Earth is a 3-wave tutorial; every other planet is anchor + 4 in-tier waves. */
export const missionLength = (tier: number) => (tier === 0 ? 3 : 5);
/** In-tier waves needed to clear: 2 of 3 on Earth, 3 of 4 elsewhere (the anchor warm-up does not count). */
export const solvesToClear = (tier: number) => (tier === 0 ? 2 : 3);

export interface FactStat { m: number; seen: number; fastWins: number }
export type Band = "unseen" | "practicing" | "understood" | "gold";
export function band(s: FactStat | undefined): Band {
  if (!s || s.seen === 0) return "unseen";
  if (s.m >= 0.82 && s.fastWins > 0) return "gold";
  return s.m >= 0.55 ? "understood" : "practicing";
}
