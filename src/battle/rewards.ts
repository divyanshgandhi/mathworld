/**
 * Orbs, as data (OVERHAUL.md, "Rewards follow learning"). The amounts are the ones the battle has
 * always paid; the economy pass (wave 2) changes them here and nowhere else.
 */
export const ORB_RULES = {
  /** An exact answer: more for the first try. The Academy is for learning, not farming: it pays nothing. */
  wave_clear: { firstTry: 5, later: 3, academy: 0 },
  /** Clearing a planet's mission. */
  planet_cleared: { amount: 20 },
} as const;
export type OrbReason = keyof typeof ORB_RULES;

/** Orbs for clearing a wave on shot number `attempts`. */
export function waveClearOrbs(mode: "campaign" | "practice" | "academy", attempts: number) {
  const r = ORB_RULES.wave_clear;
  return mode === "academy" ? r.academy : attempts === 1 ? r.firstTry : r.later;
}
export const planetClearOrbs = () => ORB_RULES.planet_cleared.amount;
