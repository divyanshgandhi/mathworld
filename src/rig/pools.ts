import type { Rng } from "@/engine/util";

/** Planets in order of the multiplication frontier. The index is the tier: Earth is T0, Deep Space is T7. */
export const PLANETS_BY_TIER = ["earth", "moon", "mars", "asteroid-belt", "jupiter", "saturn", "uranus", "deep-space"] as const;
export type PlanetId = (typeof PLANETS_BY_TIER)[number];
export const MAX_TIER = PLANETS_BY_TIER.length - 1;
export const tierOfPlanet = (p: string) => PLANETS_BY_TIER.indexOf(p as PlanetId);

export interface Fact { a: number; b: number }

const inRange = (x: number, lo: number, hi: number) => x >= lo && x <= hi;

/**
 * The one tier a problem belongs to, or null. Every pool is defined through this function,
 * so pools are disjoint by construction: a fact can never belong to two planets.
 * Order does not matter (3 × 8 and 8 × 3 are the same fact).
 */
export function tierOf(a: number, b: number): number | null {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  if (lo <= 1) return 0; // ×0, ×1
  if (hi <= 10) {
    if ([2, 5, 10].includes(lo) || [2, 5, 10].includes(hi)) return 1; // ×2, ×5, ×10
    if (lo === 3 || lo === 4) return 2; // ×3, ×4 (with 3..9, no 5)
    if (lo >= 6 && hi <= 9) return 3; // 6..9 × 6..9
    return null;
  }
  if (inRange(lo, 2, 9) && inRange(hi, 12, 99) && hi % 10 !== 0) return 4; // 2d × 1d
  if (inRange(lo, 11, 99) && inRange(hi, 12, 99)) return 5; // 2d × 2d
  if (inRange(lo, 3, 99) && inRange(hi, 105, 999)) return 6; // 3d × 1–2d
  if (deepSpaceSector(lo, hi) !== null) return 7;
  return null;
}

/** Deep Space grows in sectors: 3d×3d, then 4d×2d, 4d×3d, and 5d×3d onward. */
export function deepSpaceSector(lo: number, hi: number): number | null {
  if (inRange(lo, 100, 999) && inRange(hi, 100, 999)) return 0;
  if (inRange(lo, 10, 99) && inRange(hi, 1000, 9999)) return 1;
  if (inRange(lo, 100, 999) && inRange(hi, 1000, 9999)) return 2;
  if (inRange(lo, 100, 999) && inRange(hi, 10000, 99999)) return 3;
  return null;
}

export const factKey = (a: number, b: number) => `${Math.min(a, b)}x${Math.max(a, b)}`;
export const parseKey = (k: string): Fact => { const [a, b] = k.split("x").map(Number); return { a, b }; };

/** Tiers small enough to list every fact (as unordered pairs, smaller factor first). */
export const ENUMERABLE_TIERS = [0, 1, 2, 3, 4];
const cache = new Map<number, Fact[]>();
export function factsOf(tier: number): Fact[] {
  if (!ENUMERABLE_TIERS.includes(tier)) throw new Error(`tier ${tier} is too large to list`);
  if (!cache.has(tier)) {
    const out: Fact[] = [];
    // Earth lists ×0 and ×1 up to 10 (the tutorial); larger ×0/×1 facts still belong to T0 when they appear.
    for (let a = 0; a <= 9; a++) for (let b = a; b <= (tier === 0 ? 10 : 99); b++) if (tierOf(a, b) === tier) out.push({ a, b });
    cache.set(tier, out);
  }
  return cache.get(tier)!;
}

const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T,>(rng: Rng, xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];

/**
 * A random problem from a tier, as rows × per-row (a × b).
 * - Single-digit tiers come in either orientation, so 8 × 3 and 3 × 8 both appear (Flip It!).
 * - Multi-digit tiers put the smaller factor as rows: 6 × 24 is 6 lanes of 24.
 * `ramp` (0, 1, 2…) grows multi-digit sizes mission by mission, starting with friendly pairs.
 */
export function drawFrom(tier: number, rng: Rng, ramp = 0): Fact {
  let lo: number, hi: number;
  switch (tier) {
    case 0: lo = int(rng, 0, 1); hi = int(rng, 0, 10); break;
    case 1: lo = pick(rng, [2, 5, 10]); hi = int(rng, 2, 10); break;
    case 2: lo = pick(rng, [3, 4]); hi = pick(rng, [3, 4, 6, 7, 8, 9]); break;
    case 3: lo = int(rng, 6, 9); hi = int(rng, 6, 9); break;
    case 4: lo = int(rng, 2, 9); do hi = int(rng, 12, 99); while (hi % 10 === 0); break;
    case 5: { const cap = Math.min(99, 25 + 15 * ramp); lo = int(rng, 11, cap); hi = int(rng, 12, cap); break; }
    case 6: lo = int(rng, 3, Math.min(99, 12 + 20 * ramp)); hi = int(rng, 105, Math.min(999, 250 + 150 * ramp)); break;
    default: {
      const s = Math.min(3, ramp);
      [lo, hi] = s === 0 ? [int(rng, 100, 999), int(rng, 100, 999)] : s === 1 ? [int(rng, 10, 99), int(rng, 1000, 9999)] : s === 2 ? [int(rng, 100, 999), int(rng, 1000, 9999)] : [int(rng, 100, 999), int(rng, 10000, 99999)];
    }
  }
  if (tier <= 3) return rng() < 0.5 ? { a: lo, b: hi } : { a: hi, b: lo };
  return { a: Math.min(lo, hi), b: Math.max(lo, hi) };
}
