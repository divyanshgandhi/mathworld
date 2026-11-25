import type { PlayerState } from "@/director/fold";
import { DECK_SIZE, flashcardDeck } from "@/director/hub";
import type { Rng } from "@/engine/util";
import { band, type Band } from "@/rig/adaptive";
import { factKey, type Fact } from "@/rig/pools";

const RANK: Record<Band, number> = { unseen: 0, practicing: 1, understood: 2, gold: 3 };

/**
 * Five cards from one times table ("Practise the 7s"): the facts furthest from Gold first (a fact
 * not met yet counts as furthest), ties broken at random, each card in a random order (7 × 3 or
 * 3 × 7). Pure and deterministic for a given `rng`. Without a table it is the director's own deck.
 */
export function deckFor(s: PlayerState, rng: Rng, table?: number | null): Fact[] {
  if (table == null) return flashcardDeck(s, rng);
  const facts = Array.from({ length: 10 }, (_, i) => ({ n: i + 1, r: RANK[band(s.facts[factKey(table, i + 1)])], tie: rng() }));
  facts.sort((x, y) => x.r - y.r || x.tie - y.tie);
  return facts.slice(0, DECK_SIZE).map(({ n }) => (rng() < 0.5 ? { a: table, b: n } : { a: n, b: table }));
}

/** The rows and columns of dots that show a fact as an array: `a` rows of `b`. */
export const arrayOf = (f: Fact) => ({ rows: f.a, cols: f.b, total: f.a * f.b });
