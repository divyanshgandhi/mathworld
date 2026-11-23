import { describe, expect, it } from "vitest";
import { fold, type LoggedEvent } from "@/director/fold";
import { nextWave, practiceWave, PRACTICE_WAVES } from "@/director/next";
import { seeded } from "@/engine/util";
import { fireOrder, fleetOf, unitLabel, volley } from "@/rig/fleet";
import { drawFrom } from "@/rig/pools";

const count = (a: number, b: number) => {
  const f = fleetOf(a, b), by: Record<string, number> = {};
  for (const s of f.ships) by[unitLabel(s.k)] = (by[unitLabel(s.k)] ?? 0) + 1;
  return by;
};

describe("Base-10 fleet", () => {
  it("single digits are plain fighters, rows × columns", () => {
    expect(count(3, 8)).toEqual({ 1: 24 });
    expect(fleetOf(3, 8).sectors).toHaveLength(1);
  });

  it("packs every 10 into a Squadron Pod, so ×10 never means dozens of fighters", () => {
    expect(count(7, 10)).toEqual({ 10: 7 });
    expect(count(10, 7)).toEqual({ 10: 7 });
    expect(fleetOf(10, 7).sectors[0].orient).toBe("v"); // the tens come from the squads
    expect(fleetOf(7, 10).sectors[0].orient).toBe("h");
    expect(count(10, 10)).toEqual({ 100: 1 });
    expect(count(1, 10)).toEqual({ 10: 1 });
  });

  it("Jupiter 6 × 24: 12 Squadron Pods on the left, 24 Fighters on the right", () => {
    const f = fleetOf(6, 24);
    expect(count(6, 24)).toEqual({ 10: 12, 1: 24 });
    expect(f.sectors.map((s) => s.value)).toEqual([120, 24]);
  });

  it("Saturn 16 × 24: four Battle Sectors, 2 Carriers, 4 + 12 Pods, 24 Fighters", () => {
    const f = fleetOf(16, 24);
    expect(f.sectors.map((s) => [s.rowPart, s.colPart, s.value, s.rows * s.cols])).toEqual([[10, 20, 200, 2], [10, 4, 40, 4], [6, 20, 120, 12], [6, 4, 24, 24]]);
    expect(count(16, 24)).toEqual({ 100: 2, 10: 16, 1: 24 });
  });

  it("sector values and ship values always add up to a × b", () => {
    const rng = seeded(4);
    for (let t = 0; t < 8; t++) for (let i = 0; i < 60; i++) {
      const { a, b } = drawFrom(t, rng, i % 5), f = fleetOf(a, b);
      expect(f.sectors.reduce((s, x) => s + x.value, 0)).toBe(a * b);
      expect(f.ships.reduce((s, x) => s + x.value, 0)).toBe(a * b);
      // never more than 9 × 9 ships in a sector, so even Deep Space stays drawable
      for (const s of f.sectors) expect(s.rows * s.cols).toBeLessThanOrEqual(81);
    }
  });

  it("a volley takes biggest ships first and can stop inside one", () => {
    const f = fleetOf(6, 24);
    const v120 = volley(f, 120);
    expect(v120.hits.every((h) => f.ships[h.ship].k === 1 && h.full)).toBe(true);
    expect(v120.hits).toHaveLength(12);
    expect(v120.remaining).toBe(24);
    const v105 = volley(f, 105);
    expect(v105.hits).toHaveLength(11);
    expect(v105.hits[10]).toMatchObject({ amount: 5, full: false });
    expect(v105.remaining).toBe(39);
    expect(volley(f, 180)).toMatchObject({ remaining: 0, extra: 36 });
    expect(volley(f, 0)).toMatchObject({ hits: [], remaining: 144, extra: 0 });
    expect(volley(fleetOf(0, 7), 0)).toMatchObject({ hits: [], remaining: 0, extra: 0 });
    expect(fireOrder(fleetOf(16, 24))[0].k).toBe(2);
  });

  it("labels ship classes", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(unitLabel)).toEqual(["1", "10", "100", "1K", "10K", "100K", "1M", "10M"]);
  });
});

describe("practice runs", () => {
  it("serve a planet's problem string and leave the campaign alone", () => {
    const s0 = fold([]);
    const waves = Array.from({ length: PRACTICE_WAVES }, (_, k) => practiceWave(s0, 5, k, 7));
    expect(waves.map((w) => w.role)).toEqual(["anchor", "discovery", "application", "adaptive", "boss"]);
    const log: LoggedEvent[] = waves.map((w) => ({
      type: "attempt_submitted",
      payload: { a: w.a, b: w.b, planetId: "saturn", guess: w.a * w.b, latencyMs: 4000, errorType: null, attemptIndex: 1, usedRadar: false, powerUpUsed: null, isTransferCheck: false, waveRole: "practice" },
    }));
    const s = fold(log);
    expect(s.tier).toBe(0);
    expect(s.mission).toEqual(s0.mission);
    expect(s.waves).toBe(0);
    expect(s.history).toEqual([]);
    expect(Object.keys(s.facts).length).toBeGreaterThan(0);
    expect(nextWave(s, 7)).toEqual(nextWave(s0, 7)); // the campaign's next wave is unchanged
  });
});
