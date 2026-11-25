import { fleetOf, type Fleet, type Hit, type VolleyPlan } from "@/rig/fleet";

/**
 * The battle's formation, as pure maths (no three.js): which ships a fleet has, where each one sits,
 * which squad it belongs to, the order a volley takes them in, and when each ball leaves.
 *
 * Structure is discovered, not printed (OVERHAUL.md): the layout itself shows the groups. Squads are
 * rows, and the gap between two squads is several times the gap between two ships in a squad, so a
 * fleet reads as "6 rows of 7" before any word is shown.
 */

/** A fighter cell, a big ship's cell, the gap between ships in a squad, between squads, and between place-value bands in a squad. */
export const CELL = 1.0, BIG = 2.4, GAP = 0.16, SQUAD_GAP = 0.74, BAND_GAP = 0.5;
/** The pitch of ships along a squad and of squads down the fleet (fighters). */
export const PITCH = CELL + GAP, SQUAD_PITCH = CELL + SQUAD_GAP;

const exp10 = (p: number) => String(p).length - 1;

/**
 * The fleet the battle draws for a × b. Up to 10 × 10 every ship is a single fighter in true rows and
 * columns, so a side of 10 is ten real squads or ten real ships (Fast Adding can add 10 squads and
 * Split & Add can cut a 10 after 5). Bigger facts use the rig's place-value fleet (pods, carriers).
 */
export function battleFleet(a: number, b: number): Fleet {
  if (a <= 0 || b <= 0 || a > 10 || b > 10) return fleetOf(a, b);
  const ships = [];
  for (let row = 0; row < a; row++) for (let col = 0; col < b; col++) ships.push({ id: ships.length, sector: 0, row, col, k: 0, value: 1 });
  return {
    a, b, rowParts: [a], colParts: [b], ships, total: a * b,
    sectors: [{ i: 0, rowBand: 0, colBand: 0, rowPart: a, colPart: b, rows: a, cols: b, k: 0, value: a * b, orient: "h" }],
  };
}

/** One ship's place: centre and size (formation units), its squads and its place in them. */
export interface Slot {
  id: number;
  x: number; y: number; w: number; h: number;
  /** The first squad it belongs to (0 is the top squad). */
  squad: number;
  /** How many squads it spans: 1 for a fighter or a lying pod, 10 for a stood-up pod, and so on. */
  span: number;
  /** Its index along the squad, in ship slots (0 is the leader's place). */
  index: number;
  /** How many ships of each squad it spans holds (1 for a fighter, 10 for a lying pod). */
  worth: number;
  /** Its row in the layout, top first (rows of big ships count once). */
  row: number;
}
export interface Layout { slots: Slot[]; W: number; H: number; rows: number; squads: number }

/** Where every ship sits, centred on (0, 0), rows × columns true to the numbers. */
export function layoutFleet(f: Fleet): Layout {
  const colK = f.colParts.map((c, i) => { const s = f.sectors.find((x) => x.colBand === i); return !s || s.k === 0 ? 0 : exp10(c); });
  const rowK = f.rowParts.map((r, i) => { const s = f.sectors.find((x) => x.rowBand === i); return !s || s.k === 0 ? 0 : exp10(r); });
  const colW = f.colParts.map((c, i) => { const d = c / 10 ** colK[i], w = colK[i] === 0 ? CELL : BIG; return { d, w, span: d * w + (d - 1) * GAP }; });
  const rowH = f.rowParts.map((r, i) => { const d = r / 10 ** rowK[i], h = rowK[i] === 0 ? CELL : BIG; return { d, h, span: d * h + (d - 1) * SQUAD_GAP }; });
  const colX: number[] = [], rowY: number[] = [];
  colW.reduce((x, c, i) => { colX[i] = x; return x + c.span + BAND_GAP; }, 0);
  rowH.reduce((y, r, i) => { rowY[i] = y; return y + r.span + SQUAD_GAP; }, 0);
  const W = colW.length ? colX[colX.length - 1] + colW[colW.length - 1].span : 0;
  const H = rowH.length ? rowY[rowY.length - 1] + rowH[rowH.length - 1].span : 0;
  const before = (xs: number[], i: number) => xs.slice(0, i).reduce((s, x) => s + x, 0);
  const slots: Slot[] = f.ships.map((ship) => {
    const sec = f.sectors[ship.sector], cw = colW[sec.colBand], rh = rowH[sec.rowBand], kr = rowK[sec.rowBand], kc = colK[sec.colBand];
    return {
      id: ship.id,
      x: colX[sec.colBand] + ship.col * (cw.w + GAP) + cw.w / 2 - W / 2,
      y: H / 2 - (rowY[sec.rowBand] + ship.row * (rh.h + SQUAD_GAP) + rh.h / 2),
      w: cw.w, h: rh.h,
      squad: before(f.rowParts, sec.rowBand) + ship.row * 10 ** kr, span: 10 ** kr,
      index: before(colW.map((c) => c.d), sec.colBand) + ship.col, worth: 10 ** kc,
      row: before(rowH.map((r) => r.d), sec.rowBand) + ship.row,
    };
  });
  return { slots, W, H, rows: rowH.reduce((s, r) => s + r.d, 0), squads: f.a };
}

/**
 * The order a volley takes ships in: reading order, squad by squad, so the fleet empties one squad
 * at a time. `flipped`: the fleet is turned a quarter (Flip It!), so the squads the cadet sees are
 * its columns, the last column on top.
 */
export function targetOrder(l: Layout, flipped = false): number[] {
  const key = (s: Slot) => (flipped ? [-s.x, -s.y] : [-s.y, s.x]);
  return l.slots.slice().sort((p, q) => { const [a1, a2] = key(p), [b1, b2] = key(q); return a1 - b1 || a2 - b2; }).map((s) => s.id);
}

/** What `n` plasma balls do, taken in `order`: one ball per ship (a big ship takes its worth in one ball). */
export function planVolley(f: Fleet, n: number, order: number[]): VolleyPlan {
  let left = Math.max(0, n);
  const hits: Hit[] = [];
  for (const id of order) {
    if (left <= 0) break;
    const value = f.ships[id].value, amount = Math.min(value, left);
    hits.push({ ship: id, amount, full: amount === value });
    left -= amount;
  }
  return { hits, remaining: Math.max(0, f.total - n), extra: Math.max(0, n - f.total) };
}

/** Seconds a ball flies to its ship. */
export const FLIGHT = 0.42;
/** The whole volley, first ball to last landing (and the last extra's fizz), stays under this. */
export const VOLLEY_MAX = 3.4;
/** Extra balls drawn at most (the label always tells the true count). */
export const MAX_EXTRAS = 30;

export interface Shot {
  /** Seconds after the volley starts that this ball leaves. */
  t: number;
  /** The hit it makes (index into `plan.hits`), or null for an extra ball with nothing to hit. */
  hit: number | null;
  /** The ball's place along its squad (0 is the squad's first ball): the hit tick rises with it. */
  step: number;
  /** What it takes off the number on the nose as it leaves. */
  worth: number;
}

/**
 * When every ball leaves. Balls go squad by squad: quick inside a squad, a short breath between
 * squads, so even 10 × 10 reads as ten bursts. Large counts speed up (and several balls may leave on
 * one frame) so the volley always lands inside `VOLLEY_MAX`. Extras follow, at most `MAX_EXTRAS`
 * drawn; the last one drawn carries whatever is left of the number, so the nose still counts to 0.
 * `squadOf(hit)`: the squad a hit belongs to (the order it is taken in).
 */
export function volleySchedule(plan: VolleyPlan, squadOf: (h: Hit) => number, { reduced = false } = {}): { shots: Shot[]; end: number } {
  const n = plan.hits.length, extras = Math.min(plan.extra, MAX_EXTRAS);
  const squads: number[] = [];
  plan.hits.forEach((h) => { const s = squadOf(h); if (squads[squads.length - 1] !== s) squads.push(s); });
  // a breath between squads, and one before the extras fly on past the empty fleet
  const breaks = Math.max(0, squads.length - 1) + (n && extras ? 1 : 0);
  // the launch window: everything after it is the last ball's flight and the fizz of the extras
  const window = VOLLEY_MAX - FLIGHT - (extras ? 0.5 : 0.15);
  const breath = breaks ? Math.min(reduced ? 0.1 : 0.16, (window * 0.45) / breaks) : 0;
  const steps = Math.max(0, n + extras - 1 - breaks);
  const gap = steps > 0 ? Math.min(0.11, (window - breaks * breath) / steps) : 0;
  const shots: Shot[] = [];
  let t = 0, step = 0, prev: number | null = null;
  plan.hits.forEach((h, i) => {
    const s = squadOf(h);
    if (prev !== null) { if (s !== prev) { t += breath; step = 0; } else { t += gap; step++; } }
    prev = s;
    shots.push({ t, hit: i, step, worth: h.amount });
  });
  let left = plan.extra;
  for (let i = 0; i < extras; i++) {
    if (shots.length) t += i === 0 ? breath : gap;
    const worth = i === extras - 1 ? left : 1;
    left -= worth;
    shots.push({ t, hit: null, step: i, worth });
  }
  const last = shots.length ? shots[shots.length - 1].t : 0;
  return { shots, end: shots.length ? last + FLIGHT + (extras ? 0.45 : 0.12) : 0.35 };
}

/** A box in formation units: centre and half size. */
export interface Box { x: number; y: number; hx: number; hy: number }

/** One squad's strip: every ship (or the slice of a big ship) in squad `s`. */
export function squadBox(l: Layout, s: number): Box | null {
  const parts = l.slots.filter((x) => s >= x.squad && s < x.squad + x.span);
  if (!parts.length) return null;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of parts) {
    // a stood-up ship spans `span` squads top to bottom: squad s is one strip of it
    const sh = p.h / p.span, top = p.y + p.h / 2 - (s - p.squad) * sh;
    x0 = Math.min(x0, p.x - p.w / 2); x1 = Math.max(x1, p.x + p.w / 2); y0 = Math.min(y0, top - sh); y1 = Math.max(y1, top);
  }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, hx: (x1 - x0) / 2, hy: (y1 - y0) / 2 };
}

/** The empty lanes of an a × 0 fleet, one per squad, top first (formation units). */
export function laneBoxes(a: number): Box[] {
  return Array.from({ length: Math.max(0, a) }, (_, r) => ({ x: 0, y: ((a - 1) / 2 - r) * SQUAD_PITCH * 0.7, hx: 2.5, hy: 0.35 }));
}

/** One step of a scan: the bracket's box and the count that lands with it. */
export interface ScanStep { box: Box; count: number }
/** Squads a squad scan will step through; more than this and the plain label shows instead. */
export const SCAN_MAX_SQUADS = 20;
/** Stops an each scan will make along a squad. */
export const SCAN_MAX_STOPS = 24;

/**
 * The squad scan: one step per squad, top to bottom, counting 1, 2, 3… The last count is `a`.
 * Null when a scan cannot be truthful for this shape (no squads, too many to step): show the label.
 */
export function squadScan(l: Layout, a: number, b = 1): ScanStep[] | null {
  if (a <= 0 || a > SCAN_MAX_SQUADS || l.squads !== a) return null;
  // a × 0: the squads are there, every one of them empty: the scan steps down the lanes
  if (b === 0) return laneBoxes(a).map((box, i) => ({ box, count: i + 1 }));
  const steps: ScanStep[] = [];
  for (let s = 0; s < a; s++) { const box = squadBox(l, s); if (!box) return null; steps.push({ box, count: s + 1 }); }
  return steps;
}

/**
 * The each scan: along the top squad ship by ship, counting what each ship holds of that squad
 * (a fighter 1, a lying pod 10), so the last count is `b`. Null when there is nothing to step along.
 */
export function eachScan(l: Layout, b: number): ScanStep[] | null {
  if (b <= 0) return null;
  const parts = l.slots.filter((x) => x.squad === 0).sort((p, q) => p.x - q.x);
  if (!parts.length || parts.length > SCAN_MAX_STOPS) return null;
  let count = 0;
  const steps = parts.map((p) => {
    count += p.worth;
    const sh = p.h / p.span;
    return { box: { x: p.x, y: p.y + p.h / 2 - sh / 2, hx: p.w / 2, hy: sh / 2 }, count };
  });
  return count === b ? steps : null;
}

/**
 * How long each scan step takes: the whole scan fits in `max` seconds however many steps it has,
 * and the label settles after it. Soft scans (first sight of a fact) are quicker.
 */
export function scanTiming(steps: number, { soft = false, max = 2.5 } = {}) {
  const settle = soft ? 0.3 : 0.45, budget = (soft ? Math.min(max, 1.4) : max) - settle;
  const step = steps > 0 ? Math.min(soft ? 0.16 : 0.32, budget / steps) : 0;
  return { step, settle, total: steps * step + settle };
}
