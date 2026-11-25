import type { Stop } from "@/director/hub";
import type { TrickId } from "@/rig/tricks";

/**
 * The words of the Star map and the Academy, in a child's language (Grade 3 reading, sentence case).
 * Copy lives here so a copy pass touches one file. Glossary: docs/glossary.md.
 * `STOP_WORDS` is the one place that says what a planet teaches: the battle's briefing card
 * (`PLANET_TEACHES`) and the hub's `TEACHES` read it.
 */
export type StopId = Stop["id"];

export interface StopWords {
  /** The name as a title: "The Moon". */
  name: string;
  /** The name inside a sentence: "the Moon". */
  inSentence: string;
  /** What the stop teaches, short enough to sit under its planet. */
  teaches: string;
  /** The same, as a sentence for the stop's panel and the battle's briefing card. Examples are written
   * rows first, as the battle draws them (6 × 24 is 6 squads of 24). */
  long: string;
  /** The times tables the stop trains, when it has tables (Earth to the Asteroid Belt). */
  tables: number[] | null;
}

export const STOP_WORDS: Record<StopId, StopWords> = {
  mercury: { name: "Mercury", inSentence: "Mercury", teaches: "Warm-up: adding", long: "A warm-up. Add numbers up to 20.", tables: null },
  venus: { name: "Venus", inSentence: "Venus", teaches: "Warm-up: taking away", long: "A warm-up. Take away with numbers up to 20.", tables: null },
  earth: { name: "Earth", inSentence: "Earth", teaches: "×0 and ×1", long: "Times 0 and times 1.", tables: [0, 1] },
  moon: { name: "The Moon", inSentence: "the Moon", teaches: "×2, ×5 and ×10", long: "The 2s, the 5s and the 10s.", tables: [2, 5, 10] },
  mars: { name: "Mars", inSentence: "Mars", teaches: "×3 and ×4", long: "The 3s and the 4s.", tables: [3, 4] },
  "asteroid-belt": { name: "The Asteroid Belt", inSentence: "the Asteroid Belt", teaches: "×6, ×7, ×8 and ×9", long: "The 6s, 7s, 8s and 9s: the last of the times tables.", tables: [6, 7, 8, 9] },
  jupiter: { name: "Jupiter", inSentence: "Jupiter", teaches: "Big numbers times small numbers", long: "Big numbers times small numbers, like 6 × 24.", tables: null },
  saturn: { name: "Saturn", inSentence: "Saturn", teaches: "Big numbers times big numbers", long: "Big numbers times big numbers, like 14 × 23.", tables: null },
  uranus: { name: "Uranus", inSentence: "Uranus", teaches: "Huge numbers times smaller ones", long: "Huge numbers times smaller ones, like 12 × 245.", tables: null },
  "deep-space": { name: "Deep Space", inSentence: "Deep Space", teaches: "Giant numbers that keep growing", long: "Giant numbers. The fleets out here keep growing.", tables: null },
};

/** What each state of a stop says, in words, so no state depends on colour. */
export const STATE_WORDS = {
  here: "You are here",
  cleared: "Cleared",
  open: "Open",
  locked: "Locked",
  warmup: "Warm-up",
} as const;

/** The panel's one action for a stop. */
export const ACTION_WORDS = { launch: "Launch", practise: "Practise", warmup: "Warm up" } as const;

export const lockedLine = (prev: StopId, id: StopId) => `Clear ${STOP_WORDS[prev].inSentence} to open ${STOP_WORDS[id].inSentence}.`;

/** The Hyper-Jump, said plainly. `more` perfect shots still to go (0: it is ready). */
export function jumpLine(more: number, here: StopId, to: StopId) {
  if (more <= 0) return `You can jump ahead to ${STOP_WORDS[to].inSentence}! Launch ${STOP_WORDS[here].inSentence} to take the Hyper-Jump.`;
  return `${more} more perfect ${more === 1 ? "shot" : "shots"} in a row and you can jump ahead to ${STOP_WORDS[to].inSentence}.`;
}

/** The Academy: one plain reason for each trick, for a child and an adult alike. */
export const TRICK_REASON: Record<TrickId, string> = {
  "empty-mirror": "Times 0 leaves nothing. Times 1 keeps the number the same.",
  "fast-adding": "Times is adding the same squad again and again.",
  "flip-it": "Turn the fleet on its side. Same ships, easier to count.",
  "double-it": "Times 2 is a double. Times 4 is a double, doubled.",
  "easy-5-10": "Tens are easy to count, and 5 is half of 10.",
  "jump-one-more": "Start from a fact you know, then add one more squad.",
  "split-and-add": "Split a long squad into 5 and the rest, then add them up.",
  "borrow-take-back": "9 is 1 less than 10. Count tens, then take the extras away.",
  "big-small-split": "Do the tens first, then the ones, then add them up.",
  "half-double": "Cut one side in half and double the other. Same ships.",
};

export const ACADEMY_WORDS = {
  heading: "Tricks",
  intro: "Pick a trick. Nova shows it on a real fleet, then it is your turn.",
  watched: "Watched",
  watch: "Watch",
  next: "Start here",
  back: "All tricks",
  meet: (planet: StopId) => `You will meet this on ${STOP_WORDS[planet].inSentence}.`,
  tryFact: (a: number, b: number) => `Try ${a} × ${b}`,
  again: "Watch again",
} as const;
