import { describe, expect, it } from "vitest";
import { scaffold } from "@/director/next";
import {
  battleFleet, eachScan, GAP, laneBoxes, layoutFleet, MAX_EXTRAS, planVolley, scanTiming, SCAN_MAX_SQUADS, SQUAD_GAP, squadBox, squadScan,
  targetOrder, volleySchedule, VOLLEY_MAX,
} from "@/battle/formation";
import { volley } from "@/rig/fleet";

const small: [number, number][] = [];
for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) small.push([a, b]);
const multi: [number, number][] = [[12, 4], [4, 12], [6, 24], [24, 6], [16, 24], [19, 24], [10, 12], [12, 10], [3, 12], [20, 5], [99, 7], [7, 99], [11, 11]];
const all = [...small, ...multi];

describe("battle fleet", () => {
  it("draws every fact up to 10 × 10 as single ships in true rows and columns", () => {
    for (const [a, b] of small) {
      const f = battleFleet(a, b);
      expect(f.total).toBe(a * b);
      expect(f.ships.length).toBe(a * b);
      expect(f.ships.every((s) => s.k === 0 && s.value === 1)).toBe(true);
    }
  });
  it("keeps the rig's place-value fleet beyond 10 (pods, carriers), worth exactly a × b", () => {
    for (const [a, b] of multi) {
      const f = battleFleet(a, b);
      expect(f.ships.reduce((s, x) => s + x.value, 0)).toBe(a * b);
    }
    expect(battleFleet(12, 4).ships.some((s) => s.k === 1)).toBe(true);
  });
});

describe("layout", () => {
  it("leaves a much bigger gap between squads than between ships in a squad", () => {
    expect(SQUAD_GAP).toBeGreaterThan(GAP * 3);
    const l = layoutFleet(battleFleet(6, 7));
    const row0 = l.slots.filter((s) => s.squad === 0).sort((p, q) => p.x - q.x), row1 = l.slots.filter((s) => s.squad === 1);
    const along = row0[1].x - row0[0].x - row0[0].w, down = row0[0].y - row1[0].y - row0[0].h;
    expect(down).toBeGreaterThan(along * 3);
  });
  it("puts each ship in its squad, leader first, and counts squads truly for stood-up pods", () => {
    for (const [a, b] of all) {
      const l = layoutFleet(battleFleet(a, b));
      if (!a || !b) { expect(l.slots).toEqual([]); continue; }
      // every squad is covered, and each squad holds b ships' worth
      for (let s = 0; s < Math.min(a, 30); s++) {
        const worth = l.slots.filter((x) => s >= x.squad && s < x.squad + x.span).reduce((n, x) => n + x.worth, 0);
        expect(worth, `${a}×${b} squad ${s}`).toBe(b);
      }
      expect(l.slots.filter((x) => x.squad === 0).some((x) => x.index === 0)).toBe(true);
    }
    const l = layoutFleet(battleFleet(12, 4));
    expect(l.slots.filter((s) => s.span === 10).length).toBe(4); // four stood-up pods hold squads 1–10
    expect(Math.max(...l.slots.map((s) => s.squad))).toBe(11);
  });
});

describe("target order and volley plan", () => {
  it("takes ships in reading order, squad by squad", () => {
    const l = layoutFleet(battleFleet(3, 4)), order = targetOrder(l);
    expect(order.map((id) => l.slots[id].squad)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]);
    expect(order.slice(0, 4).map((id) => l.slots[id].index)).toEqual([0, 1, 2, 3]);
  });
  it("reads a turned fleet as the cadet sees it: its last column on top", () => {
    const l = layoutFleet(battleFleet(3, 4)), order = targetOrder(l, true);
    expect(order.slice(0, 3).map((id) => l.slots[id].index)).toEqual([3, 3, 3]);
    expect(order.slice(0, 3).map((id) => l.slots[id].squad)).toEqual([0, 1, 2]);
  });
  it("pops exactly n ships' worth, leaves the rest, and counts what flies past", () => {
    for (const [a, b] of all) for (const n of [0, 1, Math.floor((a * b) / 2), a * b - 1, a * b, a * b + 5, a * b * 3 + 7]) {
      if (n < 0) continue;
      const f = battleFleet(a, b), p = planVolley(f, n, targetOrder(layoutFleet(f))), r = volley(f, n);
      expect(p.hits.reduce((s, h) => s + h.amount, 0)).toBe(Math.min(n, a * b));
      expect(p.remaining).toBe(r.remaining);
      expect(p.extra).toBe(r.extra);
      expect(p.hits.filter((h) => !h.full).length).toBeLessThanOrEqual(1);
    }
  });
  it("leaves the last squads, so survivors are whole rows plus one part row", () => {
    const f = battleFleet(6, 7), l = layoutFleet(f), p = planVolley(f, 30, targetOrder(l));
    const hit = new Set(p.hits.map((h) => h.ship));
    const left = l.slots.filter((s) => !hit.has(s.id));
    expect(left.length).toBe(12);
    expect(new Set(left.map((s) => s.squad))).toEqual(new Set([4, 5]));
  });
});

describe("volley schedule", () => {
  const sched = (a: number, b: number, n: number) => {
    const f = battleFleet(a, b), l = layoutFleet(f), plan = planVolley(f, n, targetOrder(l));
    return { plan, l, ...volleySchedule(plan, (h) => l.slots[h.ship].row) };
  };
  it("finishes any count inside the budget", () => {
    for (const [a, b] of all) for (const n of [a * b, a * b + 3, a * b * 10 + 1, 999]) {
      const { end } = sched(a, b, n);
      expect(end, `${a}×${b} n=${n}`).toBeLessThanOrEqual(VOLLEY_MAX + 0.01);
    }
  });
  it("the number on the nose counts down to exactly 0", () => {
    for (const [a, b] of all) for (const n of [0, 1, a * b, a * b + 4, a * b + 500]) {
      const { shots } = sched(a, b, n);
      expect(shots.reduce((s, x) => s + x.worth, 0), `${a}×${b} n=${n}`).toBe(n);
      expect(shots.filter((x) => x.hit === null).length).toBeLessThanOrEqual(MAX_EXTRAS);
    }
  });
  it("breathes between squads, so 10 × 10 reads as ten bursts", () => {
    const { shots, l, plan } = sched(10, 10, 100);
    const gapIn: number[] = [], gapOut: number[] = [];
    for (let i = 1; i < shots.length; i++) {
      const same = l.slots[plan.hits[shots[i].hit!].ship].squad === l.slots[plan.hits[shots[i - 1].hit!].ship].squad;
      (same ? gapIn : gapOut).push(shots[i].t - shots[i - 1].t);
    }
    expect(gapOut.length).toBe(9);
    expect(Math.min(...gapOut)).toBeGreaterThan(Math.max(...gapIn) * 3);
    // the hit tick climbs along each squad
    expect(shots.slice(0, 10).map((s) => s.step)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("is in time order, extras last", () => {
    const { shots } = sched(6, 7, 47);
    for (let i = 1; i < shots.length; i++) expect(shots[i].t).toBeGreaterThanOrEqual(shots[i - 1].t);
    expect(shots.slice(-5).every((s) => s.hit === null)).toBe(true);
  });
});

describe("scans", () => {
  it("every squad scan counts 1, 2 … a, one step per squad", () => {
    for (const [a, b] of all) {
      const steps = squadScan(layoutFleet(battleFleet(a, b)), a, b);
      if (a === 0 || a > SCAN_MAX_SQUADS) { expect(steps).toBeNull(); continue; }
      expect(steps, `${a}×${b}`).not.toBeNull();
      const counts = steps!.map((s) => s.count);
      expect(counts[counts.length - 1]).toBe(a);
      for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]);
      if (a <= 10 && b <= 10) expect(counts).toEqual(Array.from({ length: a }, (_, i) => i + 1));
      // top to bottom
      for (let i = 1; i < steps!.length; i++) expect(steps![i].box.y).toBeLessThan(steps![i - 1].box.y);
    }
  });
  it("a row of stood-up pods is one step that counts its ten squads", () => {
    expect(squadScan(layoutFleet(battleFleet(12, 4)), 12, 4)!.map((s) => s.count)).toEqual([10, 11, 12]);
    expect(squadScan(layoutFleet(battleFleet(16, 24)), 16, 24)!.map((s) => s.count)).toEqual([10, 11, 12, 13, 14, 15, 16]);
  });
  it("an a × 0 fleet's squad scan steps down its empty lanes", () => {
    expect(squadScan(layoutFleet(battleFleet(7, 0)), 7, 0)?.map((s) => s.count)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(laneBoxes(7).length).toBe(7);
    expect(squadScan(layoutFleet(battleFleet(0, 7)), 0, 7)).toBeNull(); // no squads: the plain "0 squads" label
  });
  it("every each scan ends on b, counting what each ship holds of the squad", () => {
    for (const [a, b] of all) {
      const steps = eachScan(layoutFleet(battleFleet(a, b)), b);
      if (!a || !b) { expect(steps).toBeNull(); continue; }
      expect(steps, `${a}×${b}`).not.toBeNull();
      expect(steps![steps!.length - 1].count).toBe(b);
      for (let i = 1; i < steps!.length; i++) expect(steps![i].count).toBeGreaterThan(steps![i - 1].count);
    }
    expect(eachScan(layoutFleet(battleFleet(6, 24)), 24)!.map((s) => s.count)).toEqual([10, 20, 21, 22, 23, 24]);
    expect(eachScan(layoutFleet(battleFleet(12, 4)), 4)!.map((s) => s.count)).toEqual([1, 2, 3, 4]);
  });
  it("a squad box is a strip of a stood-up pod, not the whole pod", () => {
    const l = layoutFleet(battleFleet(12, 4)), s0 = squadBox(l, 0)!, s1 = squadBox(l, 1)!, s10 = squadBox(l, 10)!;
    expect(s0.hy).toBeCloseTo(s1.hy);
    expect(s0.y).toBeGreaterThan(s1.y);
    expect(s1.y).toBeGreaterThan(s10.y);
  });
  it("a scan counts about 0.4 s a step, faster above nine, and takes 4 s or less in all", () => {
    for (let n = 1; n <= 9; n++) expect(scanTiming(n).step).toBeCloseTo(0.4);
    for (let n = 10; n <= 24; n++) expect(scanTiming(n).step).toBeLessThan(0.4);
    for (let n = 1; n <= 24; n++) {
      expect(scanTiming(n).total).toBeLessThanOrEqual(4 + 1e-9);
      expect(scanTiming(n).settle).toBeGreaterThan(0); // a short beat before the total lands
    }
  });
});

describe("scaffold", () => {
  it("never offers the Radar: no multiple choice", () => {
    for (let m = 0; m <= 6; m++) expect(scaffold(m).radar).toBe(false);
    expect(scaffold(2).invite).toBe(true);
    expect(scaffold(3).showMeHow).toBe(true);
  });
});
