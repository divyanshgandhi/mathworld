import type { EventInput } from "@/db/events";
import { seeded, type Rng } from "@/engine/util";
import { GOLD_STREAK_FOR_JUMP, M0 } from "@/rig/adaptive";
import { drawFrom, ENUMERABLE_TIERS, factKey, factsOf, MAX_TIER, PLANETS_BY_TIER, tierOf, type Fact, type PlanetId } from "@/rig/pools";
import { placeParts, selectTrick, type TrickId } from "@/rig/tricks";
import type { PlayerState, WaveRole } from "./fold";

export interface Wave extends Fact {
  tier: number;
  planetId: PlanetId;
  role: WaveRole;
  trick: TrickId;
  isTransferCheck: boolean;
  /** 2d × 2d and up: the fleet is shown as place-value Battle Sectors. */
  sectorLock: boolean;
}

/** Deterministic seed mixing, so the client and the simulator pick the same wave from the same state. */
export function mix(...xs: number[]) {
  let h = 2166136261;
  for (const x of xs) { h ^= x | 0; h = Math.imul(h, 16777619) >>> 0; }
  return (h % 2147483646) + 1;
}
const keyHash = (key: string, seed: number) => mix(seed, ...[...key].map((c) => c.charCodeAt(0)));

const orient = (f: Fact, rng: Rng, tier: number): Fact => (tier <= 3 && rng() < 0.5 ? { a: f.b, b: f.a } : f);

/**
 * The weakest fact in a tier: lowest mastery first, ties broken by a per-mission hash so the
 * choice is stable within a mission (an anchor wave cannot change it) but varies between missions.
 */
function weakest(s: PlayerState, tier: number, seed: number, exclude: Set<string> = new Set()): Fact {
  const m = (f: Fact) => s.facts[factKey(f.a, f.b)]?.m ?? M0;
  const pool = factsOf(tier).filter((f) => !exclude.has(factKey(f.a, f.b)));
  const list = pool.length ? pool : factsOf(tier);
  return list.reduce((best, f) => {
    const d = m(f) - m(best);
    return d < 0 || (d === 0 && keyHash(factKey(f.a, f.b), seed) < keyHash(factKey(best.a, best.b), seed)) ? f : best;
  });
}

/** An easier fact that sets up the trick for a × b (Wave 1 of a problem string). */
export function anchorOf(a: number, b: number): Fact | null {
  const lo = Math.min(a, b), hi = Math.max(a, b), other = (x: number) => (a === x ? b : a);
  const has = (n: number) => a === n || b === n;
  switch (selectTrick(a, b)) {
    case "borrow-take-back": { const x = [9, 19, 29, 99, 199].find(has)!; return { a: other(x), b: x + 1 }; }
    case "easy-5-10": return has(5) ? { a: other(5), b: 10 } : { a: other(10), b: 1 };
    case "double-it": { const k = [2, 4].find((x) => has(x) && ![5, 9, 10].includes(other(x)))!; return { a: k / 2, b: other(k) }; }
    case "jump-one-more": return Math.abs(a - b) === 1 && lo >= 6 ? { a: lo, b: lo } : has(3) ? { a: 2, b: other(3) } : { a: 5, b: other(6) };
    case "split-and-add": return { a: lo === hi ? lo : Math.min(a, b), b: 5 };
    case "fast-adding": return { a: Math.max(1, a - 1), b };
    case "big-small-split": return lo <= 9 ? { a: lo, b: placeParts(hi)[0] } : { a: placeParts(lo)[0], b: hi };
    case "half-double": { const [e, f] = a % 2 === 0 && b % 10 === 5 ? [a, b] : [b, a]; return { a: e / 2, b: (f * 2) / 10 }; }
    default: return null;
  }
}

/** Another problem from the same tier that the same trick solves (Wave 3, transfer checks). */
function sister(trick: TrickId, tier: number, exclude: string, rng: Rng, ramp = 0): Fact | null {
  if (ENUMERABLE_TIERS.includes(tier)) {
    const list = factsOf(tier).filter((f) => selectTrick(f.a, f.b) === trick && factKey(f.a, f.b) !== exclude);
    return list.length ? orient(list[Math.floor(rng() * list.length)], rng, tier) : null;
  }
  for (let i = 0; i < 300; i++) { const f = drawFrom(tier, rng, ramp); if (selectTrick(f.a, f.b) === trick && factKey(f.a, f.b) !== exclude) return f; }
  return null;
}

function boss(s: PlayerState, tier: number, rng: Rng): Fact {
  if (!ENUMERABLE_TIERS.includes(tier)) return drawFrom(tier, rng, s.mission.n + 1);
  const recent = new Set(s.history.slice(-3).map((w) => w.key));
  const fresh = factsOf(tier).filter((f) => !recent.has(factKey(f.a, f.b)));
  const notGold = (fresh.length ? fresh : factsOf(tier)).filter((f) => (s.facts[factKey(f.a, f.b)]?.m ?? M0) < 0.82);
  const pool = (notGold.length ? notGold : factsOf(tier)).slice().sort((x, y) => y.a * y.b - x.a * x.b).slice(0, 3);
  return orient(pool[Math.floor(rng() * pool.length)], rng, tier);
}

/** The mission's target for this tier: weakest listed fact, or a ramped draw for big tiers. */
function target(s: PlayerState, tier: number, seed: number): Fact {
  const rng = seeded(mix(seed, tier, s.mission.n, 1));
  return ENUMERABLE_TIERS.includes(tier) ? orient(weakest(s, tier, mix(seed, s.mission.n)), rng, tier) : drawFrom(tier, rng, s.mission.n);
}

/**
 * The next wave. Order of precedence:
 * 1. Shield Recharge after two struggles (an anchor for the last struggled fact).
 * 2. A transfer check that has come due (a sister problem for a trick just explained).
 * 3. A Hyper-Jump probe after two Golds in a row (a fact from the planet that would be skipped).
 * 4. The mission's problem string: Earth is a 3-wave tutorial; elsewhere
 *    anchor → discovery → application → adaptive → boss.
 */
export function nextWave(s: PlayerState, seed: number): Wave {
  const tier = s.tier, rng = seeded(mix(seed, s.waves, tier, s.mission.n));
  const make = (f: Fact, role: WaveRole, isTransferCheck = false): Wave => ({
    ...f, tier, planetId: PLANETS_BY_TIER[tier], role, trick: selectTrick(f.a, f.b), isTransferCheck, sectorLock: Math.min(f.a, f.b) >= 10,
  });

  if (s.offers.cushion) {
    const last = s.lastStruggle;
    return make((last && anchorOf(last.a, last.b)) ?? (ENUMERABLE_TIERS.includes(tier) ? weakest(s, Math.max(0, tier - 1), seed) : { a: 2, b: 5 }), "recharge");
  }

  const due = s.transferQueue.find((q) => q.due <= s.waves);
  if (due) {
    const f = sister(due.trick, tier, due.key, rng, s.mission.n) ?? sister(due.trick, due.tier, due.key, rng);
    if (f) return make(f, "transfer", true);
  }

  // Two Golds in a row: probe the next planet. A third Gold there earns the Hyper-Jump over it.
  if (s.goldStreak === GOLD_STREAK_FOR_JUMP - 1 && tier < MAX_TIER) {
    const next = tier + 1;
    return make(ENUMERABLE_TIERS.includes(next) ? orient(weakest(s, next, mix(seed, s.waves, 3)), rng, next) : drawFrom(next, rng), "probe");
  }

  // the tutorial never serves the fleet just played again (after a Show Me How it is the weakest)
  // a brand-new cadet's very first fleet is one squad of three to five ships: something to count, never empty
  if (tier === 0 && s.waves === 0) return make({ a: 1, b: 3 + Math.floor(rng() * 3) }, "tutorial");
  if (tier === 0) return make(orient(weakest(s, 0, mix(seed, s.waves), new Set(s.history.slice(-1).map((w) => w.key))), rng, 0), "tutorial");

  const goal = target(s, tier, seed);
  switch (s.mission.waves) {
    case 0: {
      const anchor = anchorOf(goal.a, goal.b);
      const easy = anchor && factKey(anchor.a, anchor.b) !== factKey(goal.a, goal.b) && (tierOf(anchor.a, anchor.b) ?? 0) <= tier;
      return make(easy ? anchor : { a: 1, b: goal.b }, "anchor");
    }
    case 1: return make(goal, "discovery");
    case 2: return make(sister(selectTrick(goal.a, goal.b), tier, factKey(goal.a, goal.b), rng, s.mission.n) ?? target(s, tier, seed + 7), "application");
    case 3: {
      const seen = new Set(s.history.slice(-3).map((w) => w.key));
      return make(ENUMERABLE_TIERS.includes(tier) ? orient(weakest(s, tier, mix(seed, s.waves), seen), rng, tier) : drawFrom(tier, rng, s.mission.n), "adaptive");
    }
    default: return make(boss(s, tier, rng), "boss");
  }
}

/**
 * Events the director appends on its own before the next wave: clearing a passed planet.
 * (Hyper-Jumps are offers: the cadet accepts with a tap, see `acceptHyperJump`.)
 */
export function housekeeping(s: PlayerState): EventInput[] {
  return s.offers.clear && s.offers.hyperJumpTo === null ? [{ type: "planet_cleared", payload: { planetId: PLANETS_BY_TIER[s.tier] } }] : [];
}
export function acceptHyperJump(s: PlayerState): Extract<EventInput, { type: "hyper_jump_taken" }> | null {
  const to = s.offers.hyperJumpTo;
  return to === null ? null : { type: "hyper_jump_taken", payload: { fromPlanet: PLANETS_BY_TIER[s.tier], toPlanet: PLANETS_BY_TIER[Math.min(MAX_TIER, to)] } };
}

/**
 * Scaffolding after a miss (SPEC 4.2, as the overhaul's hint ladder has it): the first miss is answered
 * in the world and by Nova (the squad scan follows), with free input still open; a second miss invites a
 * Power-Up or Show Me How (the each scan follows); a third miss starts Show Me How. There is no multiple
 * choice: the four-answer Targeting Radar is gone for good (OVERHAUL.md, wave 2 decision 1), so `radar`
 * is always false. The field stays so callers compile.
 */
export function scaffold(misses: number) {
  return {
    nudge: misses >= 1,
    radar: false as const,
    invite: misses === 2,
    showMeHow: misses >= 3,
  };
}

/** Waves in a practice run (a replay of a cleared planet, or a dev drill). */
export const PRACTICE_WAVES = 5;

/**
 * Wave `k` of a practice run on `tier`: the same problem string a mission there would serve
 * (anchor → discovery → application → adaptive → boss), from the cadet's real mastery, but logged
 * as role "practice" so the fold moves mastery and leaves the campaign alone.
 */
export function practiceWave(s: PlayerState, tier: number, k: number, seed: number): Wave {
  const ps: PlayerState = {
    ...s, tier, waves: s.waves + k, goldStreak: 0, struggleStreak: 0, transferQueue: [],
    mission: { n: s.mission.n + tier, waves: k % PRACTICE_WAVES, inTier: 0, solved: 0, passed: false },
    offers: { hyperJumpTo: null, cushion: false, clear: false },
  };
  return { ...nextWave(ps, mix(seed, 101, tier)), isTransferCheck: false };
}
