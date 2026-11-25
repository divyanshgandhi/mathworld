import { squadLook, type ShipTone as InvaderTone } from "./shipKinds";

/**
 * The Field Manual's pictures, as pure layout and timing: every frame of every scene is computed
 * here, so tests can prove the counts (a fleet of a × b is a squads of b ships, a volley of n is n
 * balls, a miss leaves exactly the difference) and the component only draws what it is given.
 *
 * Coordinates are in a 320 × 200 picture; the component scales the picture to fit.
 * Times are in ms inside one loop. Under reduced motion each scene shows one still frame.
 */
export const SCENE_W = 320, SCENE_H = 200;

export interface ShipCell { i: number; squad: number; index: number; x: number; y: number; tone: InvaderTone; leader: boolean }

export interface ArrayOpts { cell?: number; gap?: number; squadGap?: number; cx?: number; top?: number }

/**
 * A true array: `squads` rows of `each` ships, in reading order. Squads alternate the two invader
 * tones and the first ship of a squad is its leader (none in a squad of one), exactly as the battle
 * draws them (`squadStyle`, repeated as `squadLook`). The gap between squads is a little wider than the gap between ships.
 */
export function arrayLayout(squads: number, each: number, o: ArrayOpts = {}): ShipCell[] {
  const cell = o.cell ?? 30, gap = o.gap ?? 8, squadGap = o.squadGap ?? 12, cx = o.cx ?? SCENE_W / 2, top = o.top ?? 14;
  const w = each * cell + Math.max(0, each - 1) * gap;
  const out: ShipCell[] = [];
  for (let s = 0; s < squads; s++) for (let k = 0; k < each; k++) {
    const st = squadLook(s, k);
    out.push({ i: out.length, squad: s, index: k, x: cx - w / 2 + k * (cell + gap) + cell / 2, y: top + s * (cell + squadGap) + cell / 2, tone: st.tone, leader: each > 1 && st.leader });
  }
  return out;
}

/** The size of an array in the picture: its box, for outlines and for placing the rocket under it. */
export function arrayBox(ships: ShipCell[], cell: number) {
  if (!ships.length) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = ships.map((s) => s.x), ys = ships.map((s) => s.y);
  const x = Math.min(...xs) - cell / 2, y = Math.min(...ys) - cell / 2;
  return { x, y, w: Math.max(...xs) + cell / 2 - x, h: Math.max(...ys) + cell / 2 - y };
}

/** Exponential ease-out, the house curve (MOTION.ease is its CSS form). */
export const easeOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : (1 - 2 ** (-10 * t)) / (1 - 2 ** -10));
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ---------- 1. Ships fly in squads: each squad is outlined, one after another ---------- */
export const SQUADS = { step: 900, hold: 1800 } as const;
export const squadsPeriod = (squads: number) => squads * SQUADS.step + SQUADS.hold;
/** How many squads are outlined at time `t` (all of them in the still frame). */
export function squadsFrame(squads: number, t: number | null) {
  if (t === null) return { outlined: squads };
  return { outlined: Math.min(squads, Math.floor(t / SQUADS.step) + 1) };
}

/* ---------- 2. Count them, type the number: ships are counted in reading order ---------- */
export const COUNT = { lead: 400, step: 380, hold: 1800 } as const;
export const countPeriod = (n: number) => COUNT.lead + n * COUNT.step + COUNT.hold;
/** How many ships have been counted: the number on the rocket and on Fire. */
export function countFrame(n: number, t: number | null) {
  if (t === null) return { counted: n };
  return { counted: Math.max(0, Math.min(n, Math.floor((t - COUNT.lead) / COUNT.step) + 1)) };
}

/* ---------- 3 and 4. A volley: one ball per number typed, one ship per ball ---------- */
export const VOLLEY = { press: 700, first: 900, every: 160, flight: 520 } as const;

export interface BallFrame { x: number; y: number; on: boolean }
export interface VolleyFrame { typed: number; pressed: boolean; balls: BallFrame[]; popped: boolean[]; escaped: number; past: number }

/**
 * A volley of `typed` balls from the nose at (`nx`, `ny`) into `ships`. Ball k flies to ship k; balls
 * past the last ship fly on beyond the fleet (too many), and ships no ball reaches get away (too few).
 * `t` is time since this volley began; `null` is the still frame (every ball at its end).
 */
export function volleyFrame(ships: ShipCell[], typed: number, nx: number, ny: number, t: number | null): VolleyFrame {
  const n = ships.length, done = t === null ? Infinity : t;
  const balls: BallFrame[] = [], popped = ships.map(() => false);
  for (let k = 0; k < typed; k++) {
    const t0 = VOLLEY.first + k * VOLLEY.every, p = clamp01((done - t0) / VOLLEY.flight), e = easeOut(p);
    const target = k < n ? ships[k] : ships[(k - n) % Math.max(1, n)];
    // a ball with no ship left flies past the fleet and out of the top of the picture
    // (in the still frame it waits just above the fleet, where you can see it went past)
    const tx = target ? target.x : nx, ty = k < n ? target.y : t === null ? (ships[0]?.y ?? 20) - 26 : -12;
    if (k < n && p >= 1) popped[k] = true;
    balls.push({ x: lerp(nx, tx, e), y: lerp(ny, ty, e), on: t === null ? k >= n : p > 0 && (p < 1 || k >= n) });
  }
  const finished = done >= VOLLEY.first + Math.max(0, typed - 1) * VOLLEY.every + VOLLEY.flight;
  return { typed, pressed: done >= VOLLEY.press, balls, popped, escaped: finished ? Math.max(0, n - typed) : 0, past: finished ? Math.max(0, typed - n) : 0 };
}
/** When a volley of `typed` balls has landed. */
export const volleyEnd = (typed: number) => VOLLEY.first + Math.max(0, typed - 1) * VOLLEY.every + VOLLEY.flight;

export const FIRE = { hold: 1100, back: 500, rest: 500 } as const;
export const firePeriod = (n: number) => volleyEnd(n) + FIRE.hold + FIRE.back + FIRE.rest;
/** The fire scene: the volley, a hold on the cleared space, then the ships come back for the next loop. */
export function fireFrame(ships: ShipCell[], nx: number, ny: number, t: number | null) {
  const n = ships.length;
  if (t === null) {
    // the still frame: each ball just under its ship, one for each, before it lands
    const balls = ships.map((s) => ({ x: s.x, y: s.y + 22, on: true }));
    return { typed: n, pressed: true, balls, popped: ships.map(() => false), escaped: 0, past: 0, back: 1 };
  }
  const end = volleyEnd(n) + FIRE.hold;
  const v = volleyFrame(ships, n, nx, ny, t < end ? t : null);
  const back = t < end ? 0 : clamp01((t - end) / FIRE.back);
  return { ...v, balls: t < end ? v.balls : [], popped: back > 0 ? ships.map(() => false) : v.popped, back };
}

/* ---------- 4. Too few and too many: two volleys side by side ---------- */
export const MISS = { half: 2600, hold: 1600, escape: 700 } as const;
export const missPeriod = () => MISS.half * 2 + MISS.hold;
/** Where a ship that got away has drifted to: up and out of the picture over `MISS.escape` ms. */
export function escapeOffset(sinceLanded: number | null) {
  if (sinceLanded === null) return 16; // the still frame: just leaving its row
  return easeOut(clamp01(sinceLanded / MISS.escape)) * 70;
}
export function missFrame(left: ShipCell[], right: ShipCell[], under: number, over: number, nose: { l: [number, number]; r: [number, number] }, t: number | null) {
  const lt = t === null ? null : Math.min(t, MISS.half * 2 + MISS.hold);
  const rt = t === null ? null : t - MISS.half;
  const a = volleyFrame(left, under, nose.l[0], nose.l[1], lt);
  const b = rt === null ? volleyFrame(right, over, nose.r[0], nose.r[1], null) : rt < 0 ? null : volleyFrame(right, over, nose.r[0], nose.r[1], rt);
  const landedL = lt === null ? null : lt - volleyEnd(under);
  return { under: a, over: b, escape: landedL === null ? escapeOffset(null) : landedL < 0 ? 0 : escapeOffset(landedL) };
}

/* ---------- 5. A Power-Up changes the shape: Flip It turns 6 squads of 2 into 2 squads of 6 ---------- */
export const FLIP = { press: 1000, go: 1400, move: 1000, hold: 2000, rest: 400 } as const;
export const flipPeriod = () => FLIP.go + FLIP.move + FLIP.hold + FLIP.move + FLIP.rest;
/**
 * The same ships, turned sideways: the ship in squad r, place c moves to squad c, place r. So the
 * picture is always a true array: `squads` × `each` before, `each` × `squads` after, the same count.
 */
export function flipLayouts(squads: number, each: number, o: ArrayOpts = {}, oAfter: ArrayOpts = o) {
  const before = arrayLayout(squads, each, o), after = arrayLayout(each, squads, oAfter);
  const to = before.map((s) => after[s.index * squads + s.squad]);
  return { before, after, to };
}
export function flipFrame(t: number | null) {
  if (t === null) return { k: 1, pressed: true };
  const out = FLIP.go + FLIP.move + FLIP.hold;
  const k = t < FLIP.go ? 0 : t < FLIP.go + FLIP.move ? easeOut((t - FLIP.go) / FLIP.move) : t < out ? 1 : 1 - easeOut(clamp01((t - out) / FLIP.move));
  return { k, pressed: t >= FLIP.press && t < out };
}

/* ---------- 6. Orbs and Gold ---------- */
export const REWARD = { right: 1000, got: 2400, gold: 3600, hold: 2000 } as const;
export const rewardPeriod = () => REWARD.gold + REWARD.hold;
/** A first-try answer adds one orb; then the fact's mark steps Learning, Got it, Gold. */
export function rewardFrame(orbsBefore: number, t: number | null) {
  const at = t ?? Infinity;
  const right = at >= REWARD.right;
  const level = at >= REWARD.gold ? "gold" : at >= REWARD.got ? "got" : "learn";
  return { right, orbs: orbsBefore + (right ? 1 : 0), level } as const;
}
