/**
 * The play area's lanes (review round, point 7): where every count and label may sit round the fleet,
 * as pure geometry, so a test can prove nothing collides.
 *
 * - The fleet's own box holds ships only.
 * - Left lane: the squad count while it runs (one number, beside the squad being counted), then the
 *   "7 squads" label, centred on the fleet. A hairline runs between the fleet and the lane.
 * - Top lane: the each count (one number, above the ship being counted), then "8 in each squad".
 * - Right and bottom lanes: the miss marks ("12 left", "5 too many").
 *
 * Units: the fleet's world units (the `labels` group), fleet centre at (0, 0). `upp`: world units per
 * CSS pixel at the fleet's plane, so on-screen sizes can be checked.
 */
export interface Rect { id: string; x0: number; y0: number; x1: number; y1: number }

/** Gaps (world units) between the fleet's edge and each lane, and the hairline's offset. */
export const LANE = { gap: 0.35, line: 0.22, topGap: 0.3 } as const;
/** On-screen height (CSS px) of a scan count. Anything meant to be read is 17 px or more. */
export const COUNT_PX = 24;

/** Where a squad count sits: right-aligned to the left lane's inner edge, level with its squad. */
export function squadCountAt(fw: number, squadY: number, w: number, h: number) {
  return { x: -fw / 2 - LANE.gap - w / 2, y: squadY, w, h };
}
/** Where an each count sits: centred over its ship, in the top lane. */
export function eachCountAt(fh: number, shipX: number, w: number, h: number) {
  return { x: shipX, y: fh / 2 + LANE.topGap + h / 2, w, h };
}
/** The squads label ("7 squads"): the left lane, centred on the fleet. */
export function squadsLabelAt(fw: number, w: number, h: number) {
  return { x: -fw / 2 - LANE.gap - w / 2, y: 0, w, h };
}
/** The each label ("8 in each squad"): the top lane, centred on the fleet. */
export function eachLabelAt(fh: number, w: number, h: number) {
  return { x: 0, y: fh / 2 + LANE.topGap + h / 2, w, h };
}

const rect = (id: string, c: { x: number; y: number; w: number; h: number }): Rect => ({ id, x0: c.x - c.w / 2, y0: c.y - c.h / 2, x1: c.x + c.w / 2, y1: c.y + c.h / 2 });

/** Every pair of rectangles that overlap (touching edges do not count). */
export function overlaps(rects: Rect[]): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const p = rects[i], q = rects[j];
    if (p.x0 < q.x1 - 1e-6 && q.x0 < p.x1 - 1e-6 && p.y0 < q.y1 - 1e-6 && q.y0 < p.y1 - 1e-6) out.push([p.id, q.id]);
  }
  return out;
}

/** Width over height of a label in Saira at weight 500 (an estimate; the canvas measures the real one). */
export const textAspect = (text: string) => 0.2 + text.length * 0.56;

export interface PlayfieldInput {
  /** Fleet size in world units, and the centre height of each squad / centre x of each first-squad ship. */
  fw: number; fh: number; squadYs: number[]; shipXs: number[];
  squadsText: string; eachText: string;
  /** World units per CSS px at the fleet. */
  upp: number;
  /** World height of the axis labels. */
  labelH: number;
}

/**
 * The rectangles on screen at each moment of a hint (the moments that can share the screen):
 * `scan-squads:i` (the fleet, the hairline, count i), `squads` (fleet, hairline, label), `scan-each:i`
 * (fleet, squads label, count i), `both` (fleet, both labels and hairlines).
 */
export function playfieldMoments(p: PlayfieldInput): Record<string, Rect[]> {
  const ch = COUNT_PX * p.upp, fleet = rect("fleet", { x: 0, y: 0, w: p.fw, h: p.fh });
  const lineL = rect("hairline-left", { x: -p.fw / 2 - LANE.line, y: 0, w: 0.035, h: Math.max(p.fh, 0.6) });
  const lineT = rect("hairline-top", { x: 0, y: p.fh / 2 + LANE.line, w: Math.max(p.fw, 0.6), h: 0.035 });
  const sq = rect("squads-label", squadsLabelAt(p.fw, textAspect(p.squadsText) * p.labelH, p.labelH));
  const ea = rect("each-label", eachLabelAt(p.fh, textAspect(p.eachText) * p.labelH, p.labelH));
  const out: Record<string, Rect[]> = {};
  p.squadYs.forEach((y, i) => { out[`scan-squads:${i}`] = [fleet, rect(`count-${i + 1}`, squadCountAt(p.fw, y, textAspect(String(i + 1)) * ch, ch))]; });
  out.squads = [fleet, lineL, sq];
  p.shipXs.forEach((x, i) => { out[`scan-each:${i}`] = [fleet, lineL, sq, rect(`count-${i + 1}`, eachCountAt(p.fh, x, textAspect(String(i + 1)) * ch, ch))]; });
  out.both = [fleet, lineL, sq, lineT, ea];
  return out;
}
