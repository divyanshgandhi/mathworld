import { TRICKS } from "@/db/events";
import { CARD, type TrickId } from "./tricks";

/**
 * The Academy (SPEC §4.4): one Trick Film per card, played by the same Beat Player as battle, on the
 * canonical fleet from docs/tricks.md. A film speaks every line of the doc (no shot budget), then
 * the cadet tries the We-Do and a sister fleet on the keypad.
 */
export interface Film { trick: TrickId; card: string; a: number; b: number; sister: [number, number] }

const EXAMPLES: Record<TrickId, [number, number, [number, number]]> = {
  "empty-mirror": [0, 7, [1, 6]],
  "fast-adding": [3, 4, [2, 3]],
  "flip-it": [8, 3, [7, 3]],
  "double-it": [4, 7, [2, 8]],
  "easy-5-10": [8, 5, [7, 10]],
  "jump-one-more": [6, 8, [6, 7]],
  "split-and-add": [3, 8, [8, 8]],
  "borrow-take-back": [4, 9, [6, 9]],
  "big-small-split": [6, 24, [4, 23]],
  "half-double": [18, 25, [16, 15]],
};

export const FILMS: Film[] = TRICKS.map((t) => { const [a, b, sister] = EXAMPLES[t]; return { trick: t, card: CARD[t], a, b, sister }; });
export const filmOf = (t: string) => FILMS.find((f) => f.trick === t) ?? null;
