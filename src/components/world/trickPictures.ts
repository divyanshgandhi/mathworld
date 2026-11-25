import type { TrickId } from "@/rig/tricks";

/**
 * A small, true picture of each trick, drawn as dots and generated from the numbers: `a × b` is always
 * `a` rows of `b` dots, so every panel holds exactly `a × b` solid dots (tests/academy.test.ts checks it).
 * Hollow dots are the borrowed or "twin" ships a trick imagines; they are never counted.
 *
 *   Flip It! 8 × 3   -> 8 rows of 3 beside 3 rows of 8
 *   Double It! 4 × 7 -> 2 rows of 7, a gap, 2 more rows of 7
 *
 * Pure: the component in TrickPicture.tsx only draws what this returns.
 */
export type DotKind = "one" | "two" | "ghost";
export interface Dot { x: number; y: number; kind: DotKind }
export interface Panel {
  /** The fact this panel shows, as rows × dots per row. */
  a: number; b: number;
  dots: Dot[];
  /** Size in dot units (one unit per dot, plus gaps). */
  w: number; h: number;
  /** Words for a screen reader. */
  says: string;
}
export interface Picture { trick: TrickId; panels: Panel[]; alt: string }

/** The extra space between two groups (squads, or the two parts of a split), in dot units. */
export const GAP = 0.9;

/** Rows of dots: `rows` × `cols`, starting at (x, y), with a gap before each column index in `splitAt`. */
function block(rows: number, cols: number, x: number, y: number, kind: (col: number) => DotKind, splitAt: number[] = []): Dot[] {
  const out: Dot[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const gaps = splitAt.filter((k) => c >= k).length;
      out.push({ x: x + c + gaps * GAP, y: y + r, kind: kind(c) });
    }
  }
  return out;
}
const one = () => "one" as const;
const extent = (dots: Dot[], fallback: [number, number]): [number, number] =>
  dots.length ? [Math.max(...dots.map((d) => d.x)) + 1, Math.max(...dots.map((d) => d.y)) + 1] : fallback;
const rowsOf = (a: number, b: number) => `${a} ${a === 1 ? "row" : "rows"} of ${b}`;
function panel(a: number, b: number, dots: Dot[], says: string, empty: [number, number] = [Math.max(1, b), Math.max(1, a)]): Panel {
  const [w, h] = extent(dots, empty);
  return { a, b, dots, w, h, says };
}

function plain(a: number, b: number) { return panel(a, b, block(a, b, 0, 0, one), `${rowsOf(a, b)} dots`); }
/** Rows split into stacked groups: `groups` are row counts, top to bottom, each its own colour. */
function stacked(a: number, b: number, groups: number[], says: string) {
  const dots: Dot[] = [];
  let y = 0;
  groups.forEach((g, i) => { dots.push(...block(g, b, 0, y, () => (i % 2 ? "two" : "one"))); y += g + GAP; });
  return panel(a, b, dots, says);
}

const BUILD: Record<TrickId, (a: number, b: number) => Panel[]> = {
  "empty-mirror": (a, b) => {
    const n = a <= 1 ? b : a, zero = a === 0 || b === 0;
    const mirror = a <= 1 ? plain(1, n) : plain(n, 1);
    if (!zero) return [mirror];
    const empty = panel(a, b, [], `${rowsOf(a, b)}: empty space, no dots`);
    return [empty, mirror];
  },
  "fast-adding": (a, b) => [stacked(a, b, Array(a).fill(1), `${a} squads of ${b} dots, one under another`)],
  "flip-it": (a, b) => [plain(a, b), plain(b, a)],
  "double-it": (a, b) => {
    // rows stay rows (a × b is a rows of b); the double is the rows, or each row, cut into two equal halves
    if (a === 2 || a === 4) return [stacked(a, b, [a / 2, a / 2], `${rowsOf(a / 2, b)} dots, twice`)];
    return [panel(a, b, block(a, b, 0, 0, (c) => (c < b / 2 ? "one" : "two"), [b / 2]), `${a} rows of ${b / 2} and ${b / 2} dots`)];
  },
  "easy-5-10": (a, b) => {
    if (a === 10 || b === 10) return [plain(a, b)];
    const rows = b === 5 ? a : b;
    // each row of 5 sits beside the hollow 5 that would make it 10: 5 is half of 10
    const dots = block(rows, 10, 0, 0, (c) => (c < 5 ? "one" : "ghost"), [5]);
    return [panel(rows, 5, dots, `${rowsOf(rows, 5)} dots, each beside 5 empty places that would make 10`)];
  },
  "jump-one-more": (a, b) => [stacked(a, b, [a - 1, 1], `${rowsOf(a - 1, b)} dots, then 1 more row of ${b}`)],
  "split-and-add": (a, b) => {
    const left = Math.min(5, b - 1);
    return [panel(a, b, block(a, b, 0, 0, (c) => (c < left ? "one" : "two"), [left]), `${a} rows, each split into ${left} and ${b - left} dots`)];
  },
  "borrow-take-back": (a, b) => {
    // a rows of b, each with one hollow borrowed dot that makes it a round number
    const dots = block(a, b + 1, 0, 0, (c) => (c < b ? "one" : "ghost"), [b]);
    return [panel(a, b, dots, `${rowsOf(a, b)} dots, each with 1 borrowed empty place that makes ${b + 1}`)];
  },
  "big-small-split": (a, b) => {
    const tens = Math.floor(b / 10) * 10;
    if (tens === 0 || tens === b) return [plain(a, b)];
    return [panel(a, b, block(a, b, 0, 0, (c) => (c < tens ? "one" : "two"), [tens]), `${a} rows, each split into ${tens} and ${b - tens} dots`)];
  },
  "half-double": (a, b) => {
    const [h, d] = a % 2 === 0 ? [a / 2, b * 2] : [a * 2, b / 2];
    return [plain(a, b), plain(h, d)];
  },
};

/** The picture of `trick` on the fact `a × b` (rows × dots per row). */
export function trickPicture(trick: TrickId, a: number, b: number): Picture {
  const panels = BUILD[trick](a, b);
  return { trick, panels, alt: panels.map((p) => p.says).join(", beside ") };
}

/** How many solid dots a panel draws (the count that must equal a × b). */
export const solidDots = (p: Panel) => p.dots.filter((d) => d.kind !== "ghost").length;

export interface Placed { panel: Panel; x: number; y: number }
/**
 * Lay the panels out in a box of `boxW` × `boxH` px: side by side or stacked, whichever lets the dots be
 * larger, never more than `maxUnit` px per dot. Returns the unit size and each panel's offset (in units).
 */
export function layoutPicture(p: Picture, boxW: number, boxH: number, maxUnit = 9, between = 2.4) {
  const ws = p.panels.map((q) => q.w), hs = p.panels.map((q) => q.h), n = p.panels.length;
  const row = { w: ws.reduce((s, w) => s + w, 0) + between * (n - 1), h: Math.max(...hs) };
  const col = { w: Math.max(...ws), h: hs.reduce((s, h) => s + h, 0) + between * (n - 1) };
  const fit = (d: { w: number; h: number }) => Math.min(boxW / d.w, boxH / d.h, maxUnit);
  const across = fit(row) >= fit(col);
  const dim = across ? row : col, unit = fit(dim);
  let at = 0;
  const placed: Placed[] = p.panels.map((panel) => {
    const out = across ? { panel, x: at, y: (dim.h - panel.h) / 2 } : { panel, x: (dim.w - panel.w) / 2, y: at };
    at += (across ? panel.w : panel.h) + between;
    return out;
  });
  return { unit, w: dim.w, h: dim.h, placed };
}
