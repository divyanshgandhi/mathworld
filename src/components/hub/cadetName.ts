/**
 * The cadet-name rules, in one pure place (tested in tests/design-signup.test.ts).
 * A name is 1 to 16 characters of letters (any alphabet, accents included), numbers and spaces.
 * It is trimmed and inner runs of spaces collapse to one. Nothing else is asked: no email, no surname.
 */
export const NAME_MAX = 16;

const ALLOWED = /^[\p{L}\p{M}\p{N} ]*$/u;
/** Count characters the way a reader does (an accented letter or a pasted emoji is one). */
const chars = (s: string) => Array.from(s);

export type NameProblem = "empty" | "symbols" | null;

/** What a child sees beside the field for each problem. Plain words, no blame. */
export const NAME_WORDS: Record<Exclude<NameProblem, null>, string> = {
  empty: "Type your name first.",
  symbols: "Use letters, numbers and spaces only.",
};
/** Shown (not as an error) when a paste or a long name was cut to fit. */
export const NAME_CUT = `Names can be up to ${NAME_MAX} letters, so we kept the first ${NAME_MAX}.`;

/**
 * What the field should hold after a change: anything over the limit is cut (so a 40-character paste
 * becomes 16), and `cut` says so. Symbols are kept so the child can see what to remove.
 */
export function limitName(raw: string): { value: string; cut: boolean } {
  const c = chars(raw.replace(/[\r\n\t]+/g, " "));
  // leading spaces never count toward the limit
  const start = c.findIndex((ch) => ch !== " ");
  const body = start < 0 ? [] : c.slice(start);
  return body.length > NAME_MAX ? { value: body.slice(0, NAME_MAX).join(""), cut: true } : { value: body.join(""), cut: false };
}

/** The name to save, or the problem with it. */
export function checkName(raw: string): { name: string; problem: NameProblem } {
  const name = raw.trim().replace(/ {2,}/g, " ");
  if (!name) return { name, problem: "empty" };
  if (!ALLOWED.test(name)) return { name, problem: "symbols" };
  return { name: chars(name).slice(0, NAME_MAX).join("").trim(), problem: null };
}
