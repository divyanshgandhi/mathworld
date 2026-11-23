import type { ERROR_TYPES } from "@/db/events";
import type { Rng } from "@/engine/util";

export type ErrorType = (typeof ERROR_TYPES)[number];

/** Relative distance from the answer. A miss above 0.35 is "way off" and brings in the Radar. */
export function missRatio(a: number, b: number, guess: number) {
  const p = a * b;
  return p === 0 ? (guess === 0 ? 0 : Infinity) : Math.abs(guess - p) / p;
}
export const WAY_OFF = 0.35;
export const isWayOff = (a: number, b: number, guess: number) => missRatio(a, b, guess) > WAY_OFF && Math.abs(guess - a * b) > 2;

/** The classic slip in written multiplication: the units digit is written, its carry forgotten (6 × 24 → 124). */
export function forgotCarry(a: number, b: number): number | null {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  if (lo > 9 || hi < 10) return null;
  const v = Math.floor(hi / 10) * lo * 10 + ((hi % 10) * lo) % 10;
  return v === a * b ? null : v;
}

/** What kind of wrong a guess is, so Nova can name it. Null when the guess is right. */
export function classifyError(a: number, b: number, guess: number): ErrorType | null {
  const p = a * b;
  if (guess === p) return null;
  if (guess === a + b) return "added_instead";
  const groups = [a * (b + 1), (a + 1) * b, ...(b > 0 ? [a * (b - 1)] : []), ...(a > 0 ? [(a - 1) * b] : [])];
  // a squad of one is just one drone: 3 on 1 × 4 is "a hair off", not "one squad off"
  if (groups.includes(guess) && Math.abs(guess - p) > 1) return "off_by_one_group";
  if (p >= 10 && (guess === p * 10 || guess === Math.floor(p / 10) || guess === forgotCarry(a, b))) return "place_value";
  if (Math.abs(guess - p) <= 2) return "off_by_one_unit";
  if (missRatio(a, b, guess) > WAY_OFF) return "wild_guess";
  return guess < p ? "undershoot_close" : "overshoot_close";
}

/** Four Targeting Radar choices: the answer plus three plausible mistakes, shuffled. */
export function radarChoices(a: number, b: number, rng: Rng): number[] {
  const p = a * b;
  const tempting = [a + b, a * (b + 1), (a + 1) * b, a * (b - 1), (a - 1) * b, forgotCarry(a, b) ?? -1, p + 10, p - 10, p + 1, p + 2, p + 3];
  const pool = [...new Set(tempting.filter((v) => v >= 0 && v !== p))];
  const picked: number[] = [];
  while (picked.length < 3 && pool.length) picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  for (let k = 4; picked.length < 3; k++) if (!picked.includes(p + k)) picked.push(p + k);
  const all = [p, ...picked];
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all;
}
