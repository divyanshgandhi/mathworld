import { PATROL_SIZE } from "@/db/events";
import { band, GOLD_STREAK_FOR_JUMP, JUMP, type Band } from "@/rig/adaptive";
import { ENUMERABLE_TIERS, factKey, factsOf, MAX_TIER, parseKey, PLANETS_BY_TIER, tierOf, type Fact, type PlanetId } from "@/rig/pools";
import type { Rng } from "@/engine/util";
import type { PlayerState } from "./fold";
import { STOP_WORDS } from "@/components/world/words";

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
/** Flashcards pay no orbs (wave 2 decision 5): the daily patrol pays once a day instead. Kept for callers. */
export const FLASHCARD_ORBS = 0;

// ---- The daily patrol: a few facts due for review, once a day (its screen comes in wave 3) ----
const HOUR = 3_600_000, DAY = 24 * HOUR;
/**
 * How long each kind of fact rests before the patrol asks for it again (spacing: a review is worth
 * most once the fact has had time to fade). Learning facts rest 8 hours, so the patrol is
 * tomorrow's job, not the tail of today's session.
 */
export const PATROL_REST = { practicing: 8 * HOUR, understood: 2 * DAY, gold: 7 * DAY } as const;
export interface PatrolFact extends Fact { key: string; band: Band }

/**
 * The facts due for review now, at most five: Learning facts first, then Got it facts not seen for
 * two days, then Gold facts not seen for seven; oldest first within each. Times-table and
 * Jupiter-sized facts only (the listable planets): a Deep Space sum is never met twice.
 * A fact with no known time counts as seen long ago. Null when nothing is due.
 */
export function patrol(s: PlayerState, now: number): PatrolFact[] | null {
  const groups: Record<"practicing" | "understood" | "gold", { key: string; seen: number }[]> = { practicing: [], understood: [], gold: [] };
  for (const [key, f] of Object.entries(s.facts)) {
    if (f.seen === 0) continue;
    const { a, b } = parseKey(key), t = tierOf(a, b);
    if (t === null || !ENUMERABLE_TIERS.includes(t)) continue;
    const b0 = band(f);
    if (b0 === "unseen") continue;
    const seen = s.lastSeen[key] ?? 0;
    if (now - seen >= PATROL_REST[b0]) groups[b0].push({ key, seen });
  }
  const order = (["practicing", "understood", "gold"] as const).flatMap((g) => groups[g].sort((x, y) => x.seen - y.seen || (x.key < y.key ? -1 : 1)));
  const due = order.slice(0, PATROL_SIZE).map(({ key }) => ({ ...parseKey(key), key, band: band(s.facts[key]) }));
  return due.length ? due : null;
}
/** Whether the patrol has already paid for this calendar day (`patrolDay(Date.now())` from src/db/events). */
export const patrolDone = (s: PlayerState, day: number) => s.patrol.lastDay !== null && s.patrol.lastDay >= day;

// ---- The Solar System map ----
export type StopStatus = "warmup" | "cleared" | "ace" | "frontier" | "open" | "locked";
export interface Stop { id: "mercury" | "venus" | PlanetId; tier: number | null; status: StopStatus; teaches: string }

/** What each planet teaches, in a child's words: the Star map's words (`STOP_WORDS`), the one source. */
export const TEACHES: Record<Stop["id"], string> = Object.fromEntries(Object.entries(STOP_WORDS).map(([id, w]) => [id, w.teaches])) as Record<Stop["id"], string>;

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
