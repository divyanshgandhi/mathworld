import { describe, expect, it } from "vitest";
import { COLOR, hex } from "@/design/tokens";
import { PALETTE } from "@/engine/materials";
import { paintBody, paintRing } from "@/worlds/space/planetMaps";

/** The colour at a longitude/latitude (degrees) of an equirectangular map whose row 0 is the south pole. */
function at(m: { w: number; h: number; albedo: Uint8ClampedArray }, lon: number, lat: number) {
  const i = Math.min(m.w - 1, Math.floor(((lon + 180) / 360) * m.w)), j = Math.min(m.h - 1, Math.floor(((lat + 90) / 180) * m.h));
  const k = (j * m.w + i) * 4;
  return [m.albedo[k], m.albedo[k + 1], m.albedo[k + 2]];
}
const isOcean = ([r, g, b]: number[]) => b > r + 20 && b > g;

describe("planet maps", () => {
  const earth = paintBody("earth", 256);

  it("paints the same maps every time", () => {
    expect(paintBody("moon", 64).albedo).toEqual(paintBody("moon", 64).albedo);
  });

  it("has the real continents where they are", () => {
    for (const [lon, lat] of [[15, 20], [20, 0], [-60, -10], [-100, 45], [135, -25], [90, 55]]) expect(isOcean(at(earth, lon, lat)), `land at ${lon},${lat}`).toBe(false);
    for (const [lon, lat] of [[-150, 0], [-30, 30], [75, -20], [-160, -40], [170, 20]]) expect(isOcean(at(earth, lon, lat)), `sea at ${lon},${lat}`).toBe(true);
  });

  it("covers about a third of Earth with land and the rest with sea", () => {
    let ocean = 0, total = 0;
    for (let j = 0; j < earth.h; j++) {
      const lat = ((j + 0.5) / earth.h) * 180 - 90, w = Math.cos((lat * Math.PI) / 180);
      if (Math.abs(lat) > 60) continue;
      for (let i = 0; i < earth.w; i++) { total += w; if (isOcean(at(earth, (i / earth.w) * 360 - 180, lat))) ocean += w; }
    }
    expect(ocean / total).toBeGreaterThan(0.6);
    expect(ocean / total).toBeLessThan(0.8);
  });

  it("gives Earth a separate cloud layer and the rocky bodies a height map", () => {
    expect(earth.clouds?.length).toBe(earth.w * earth.h * 4);
    expect(paintBody("moon", 64).height?.length).toBe(64 * 32);
    expect(paintBody("jupiter", 64).height).toBeUndefined();
  });

  it("wraps seamlessly at the date line", () => {
    const m = paintBody("jupiter", 256);
    let diff = 0;
    for (let j = 0; j < m.h; j++) for (let c = 0; c < 3; c++) diff += Math.abs(m.albedo[(j * m.w) * 4 + c] - m.albedo[(j * m.w + m.w - 1) * 4 + c]);
    expect(diff / (m.h * 3)).toBeLessThan(6);
  });

  it("paints Saturn's rings with the Cassini division", () => {
    const ring = paintRing("saturn", 512), alpha = (t: number) => ring[Math.round(t * 511) * 4 + 3];
    expect(alpha(0.4)).toBeGreaterThan(150);
    expect(alpha(0.61)).toBeLessThan(40);
  });
});

describe("palette", () => {
  it("derives from the tokens: the old accents map into Void and Gold", () => {
    expect(PALETTE.lime).toBe(hex(COLOR.gold));
    expect(PALETTE.cyan).toBe(hex(COLOR.sky));
    expect(PALETTE.coral).toBe(hex(COLOR.ember));
    expect(PALETTE.ink).toBe(hex(COLOR.void));
  });
});
