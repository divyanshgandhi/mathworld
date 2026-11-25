/**
 * The teaching layer's budget, as code: how long a line stays up and how long it may be.
 * See docs/teaching.md for where these numbers come from.
 */

/** The longest instruction or greeting, in words. */
export const MAX_WORDS = 12;

/** The words in a line ("Let's" and "Power-Ups" count as one word each). */
export function words(text: string): string[] {
  return text.split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter(Boolean);
}

/** The sentences in a line, split after . ! or ? */
export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * How long a line must stay on screen, in ms: at least 1.5 s plus 0.3 s a word.
 * A greeting leaves after this time; a guided step waits at least this long before it moves on by itself.
 */
export function readMs(text: string): number {
  return 1500 + 300 * words(text).length;
}
