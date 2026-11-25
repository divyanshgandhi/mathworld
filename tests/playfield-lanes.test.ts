import { describe, expect, it } from "vitest";
import { battleFleet, eachScan, layoutFleet, squadScan } from "@/battle/formation";
import { COUNT_PX, overlaps, playfieldMoments, squadCountAt, eachCountAt, textAspect } from "@/battle/lanes";
import { scanTiming } from "@/battle/formation";

/**
 * The play area's labels cannot collide (review round, point 7). The fleet is laid out exactly as the
 * battle lays it out (src/battle/systems/fleetView.ts: scale, minimum size) and every moment of a hint
 * is projected to rectangles at the zooms the four test sizes give (px per world unit, from a 6 px cell
 * on a 360 x 640 phone with a 12 x 14 fleet up to a 120 px cell for 1 x 4 on a desktop).
 */
const FLEETS: [number, number][] = [[1, 4], [0, 10], [6, 7], [7, 8], [10, 10], [12, 14]];
const PPU = [12, 20, 30, 45, 60, 80, 120];
const AXIS_H = 0.5, AXIS_PX = 26;

function fleetGeometry(a: number, b: number) {
  const l = layoutFleet(battleFleet(a, b));
  const scale = Math.min(1.55, 11 / Math.max(l.W, 1), 8 / Math.max(l.H, 1));
  let fw = Math.max(l.W * scale, 3), fh = Math.max(l.H * scale, 2);
  if (a === 0 || b === 0) { const ring = 3 * scale; fw = Math.max(fw, ring, a > 0 ? 5 * scale : 0); fh = Math.max(fh, ring); }
  const sq = squadScan(l, a, b) ?? [], ea = eachScan(l, b) ?? [];
  return { l, scale, fw, fh, squadYs: sq.map((s) => s.box.y * scale), shipXs: ea.map((s) => s.box.x * scale), sq, ea };
}

describe("play area lanes", () => {
  for (const [a, b] of FLEETS) for (const ppu of PPU) {
    it(`${a} x ${b} at ${ppu} px a unit: no label, count or hairline overlaps another`, () => {
      const g = fleetGeometry(a, b), upp = 1 / ppu, labelH = Math.min(2.2, Math.max(AXIS_H, AXIS_PX * upp));
      const moments = playfieldMoments({ fw: g.fw, fh: g.fh, squadYs: g.squadYs, shipXs: g.shipXs, squadsText: `${a} squads`, eachText: `${b} in each squad`, upp, labelH });
      for (const [name, rects] of Object.entries(moments)) expect(overlaps(rects), `${a} x ${b} ${name}`).toEqual([]);
    });
  }

  it("a scan shows one number at a time, in a lane outside the fleet's box, 17 px or more", () => {
    expect(COUNT_PX).toBeGreaterThanOrEqual(17);
    for (const [a, b] of FLEETS) {
      const g = fleetGeometry(a, b), h = COUNT_PX / 30;
      for (const y of g.squadYs) { const c = squadCountAt(g.fw, y, textAspect("12") * h, h); expect(c.x + c.w / 2).toBeLessThan(-g.fw / 2); }
      for (const x of g.shipXs) { const c = eachCountAt(g.fh, x, textAspect("14") * h, h); expect(c.y - c.h / 2).toBeGreaterThan(g.fh / 2); }
    }
  });

  it("the counts are the true counts, and the last one is the total the label then says", () => {
    for (const [a, b] of FLEETS) {
      const g = fleetGeometry(a, b);
      // squad by squad (a band of ten lying pods counts as ten at once): rising, ending on a
      if (g.sq.length) {
        const c = g.sq.map((s) => s.count);
        expect(c[c.length - 1]).toBe(a);
        c.forEach((n, i) => i && expect(n).toBeGreaterThan(c[i - 1]));
        if (a <= 10) expect(c).toEqual(Array.from({ length: a }, (_, i) => i + 1));
      }
      if (g.ea.length) expect(g.ea[g.ea.length - 1].count).toBe(b);
      expect(scanTiming(Math.max(g.sq.length, g.ea.length)).total).toBeLessThanOrEqual(4);
    }
  });
});
