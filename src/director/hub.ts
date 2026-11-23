import { band, GOLD_STREAK_FOR_JUMP, JUMP, type Band } from "@/rig/adaptive";
import { factKey, factsOf, MAX_TIER, PLANETS_BY_TIER, tierOf, type Fact, type PlanetId } from "@/rig/pools";
import type { Rng } from "@/engine/util";
import type { PlayerState } from "./fold";

/**
 * What the Resting Bay and the Solar System map show, read from the folded state: the times-table
 * posters, the Quick Flashcard deck, and each planet's status. Pure, so it is tested like the rig.
 */

// ---- Wall posters: ×1 to ×10, every fact coloured by mastery (SPEC §2.4) ----
export const POSTER_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export interface PosterCell { n: number; key: string; band: Band }
export interface Poster { table: number; cells: PosterCell[]; band: Band; gold: number }

const RANK: Record<Band, number> = { unseen: 0, practicing: 1, understood: 2, gold: 3 };

/**
 * One poster: table × 1 … × 10. The poster itself takes the colour every one of its facts has
 * reached (all Gold → gold, all at least Mint → mint), sky once any fact is seen, dim before that.
 */
export function poster(s: PlayerState, table: number): Poster {
  const cells = POSTER_TABLES.map((n) => { const key = factKey(table, n); return { n, key, band: band(s.facts[key]) }; });
  const low = Math.min(...cells.map((c) => RANK[c.band]));
  const any = cells.some((c) => c.band !== "unseen");
  const b: Band = low === 3 ? "gold" : low === 2 ? "understood" : any ? "practicing" : "unseen";
  return { table, cells, band: b, gold: cells.filter((c) => c.band === "gold").length };
}
export const posters = (s: PlayerState) => POSTER_TABLES.map((t) => poster(s, t));

// ---- Quick Flashcards: 5 low-pressure cards from recently learned or shaky facts ----
export const DECK_SIZE = 5;
/** Times-table facts only (Earth to the Asteroid Belt): a flashcard is a quick recall, not a long sum. */
const cardable = (key: string) => { const [a, b] = key.split("x").map(Number); const t = tierOf(a, b); return t !== null && t <= 3 && b <= 10; };

/**
 * The deck, most useful first: facts the cadet has met but not yet made Gold (lowest mastery,
 * then most recent), then Gold facts to keep warm, then unseen facts from planets already open.
 * Each card comes in a random orientation (8 × 3 or 3 × 8). Deterministic for a given `rng`.
 */
export function flashcardDeck(s: PlayerState, rng: Rng): Fact[] {
  const recent = new Map<string, number>();
  s.history.forEach((w, i) => recent.set(w.key, i));
  const seen = Object.entries(s.facts).filter(([k, f]) => f.seen > 0 && cardable(k));
  const shaky = seen.filter(([, f]) => band(f) !== "gold").sort(([ka, a], [kb, b]) => a.m - b.m || (recent.get(kb) ?? -1) - (recent.get(ka) ?? -1)).map(([k]) => k);
  const gold = seen.filter(([, f]) => band(f) === "gold").sort(([ka], [kb]) => (recent.get(kb) ?? -1) - (recent.get(ka) ?? -1)).map(([k]) => k);
  const fresh: string[] = [];
  for (let t = 0; t <= Math.min(3, s.unlocked); t++) for (const f of factsOf(t)) { const k = factKey(f.a, f.b); if (!s.facts[k] && cardable(k) && f.a > 0) fresh.push(k); }
  // shuffle the fresh ones so a new cadet does not always get 1 × 2, 1 × 3, …
  for (let i = fresh.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [fresh[i], fresh[j]] = [fresh[j], fresh[i]]; }
  const keys = [...new Set([...shaky, ...gold, ...fresh])].slice(0, DECK_SIZE);
  return keys.map((k) => { const [a, b] = k.split("x").map(Number); return rng() < 0.5 ? { a, b } : { a: b, b: a }; });
}
/** One bonus Orb for each correct card: never lost, never a streak. */
export const FLASHCARD_ORBS = 1;

// ---- The Solar System map ----
export type StopStatus = "warmup" | "cleared" | "ace" | "frontier" | "open" | "locked";
export interface Stop { id: "mercury" | "venus" | PlanetId; tier: number | null; status: StopStatus; teaches: string }

export const TEACHES: Record<Stop["id"], string> = {
  mercury: "Addition warm-up · up to 20", venus: "Subtraction warm-up · up to 20",
  earth: "×0 and ×1", moon: "×2, ×5, ×10", mars: "×3, ×4", "asteroid-belt": "×6, ×7, ×8, ×9",
  jupiter: "2-digit × 1-digit", saturn: "2-digit × 2-digit", uranus: "3-digit × 1–2-digit", "deep-space": "Unbounded armadas",
};

/** Mercury and Venus first (always open), then the multiplication frontier, Earth outward. */
export function mapStops(s: PlayerState): Stop[] {
  const warm = (["mercury", "venus"] as const).map((id): Stop => ({ id, tier: null, status: "warmup", teaches: TEACHES[id] }));
  const frontier = PLANETS_BY_TIER.map((id, t): Stop => {
    const status: StopStatus = s.cleared.includes(t) ? "cleared" : s.aceCleared.includes(t) ? "ace" : t === s.tier ? "frontier" : t <= s.unlocked ? "open" : "locked";
    return { id, tier: t, status, teaches: TEACHES[id] };
  });
  return [...warm, ...frontier];
}
/** A planet the cadet may fly to now (warm-ups always; locked planets never). */
export const canLaunch = (s: PlayerState, id: string) => (id === "mercury" || id === "venus" ? true : mapStops(s).some((x) => x.id === id && x.status !== "locked"));

/** Hyper-Jump status for the map: how close the Gold streak is, and where a jump would land. */
export function hyperJumpStatus(s: PlayerState) {
  if (s.tier >= MAX_TIER) return { available: false, streak: 0, need: GOLD_STREAK_FOR_JUMP, to: null as PlanetId | null, label: "Deep Space has no jump: it keeps growing" };
  const to = PLANETS_BY_TIER[Math.min(MAX_TIER, s.tier + JUMP)];
  const streak = Math.min(s.goldStreak, GOLD_STREAK_FOR_JUMP);
  if (s.offers.hyperJumpTo !== null) return { available: true, streak, need: GOLD_STREAK_FOR_JUMP, to, label: `Hyper-Jump ready · launch ${PLANETS_BY_TIER[s.tier]} to take it` };
  return { available: false, streak, need: GOLD_STREAK_FOR_JUMP, to, label: `Hyper-Jump · ${streak}/${GOLD_STREAK_FOR_JUMP} Gold shots in a row` };
}
