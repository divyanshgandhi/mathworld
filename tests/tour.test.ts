import { describe, expect, it } from "vitest";
import { GREETINGS } from "@/teach/greetings";
import { SEEN_KEY_RE } from "@/teach/keys";
import { clipTo, liveSteps, nextStep, placePlate, ringOf, tourKey, TOUR_IDS, TOUR_MAX_STEPS, TOUR_MAX_WORDS, TOURED_SCREENS, TOURS } from "@/teach/tour";
import { tourState } from "@/teach/tourState";
import { words } from "@/teach/words";

type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Box, v: Box) => a.x >= v.x - 0.5 && a.y >= v.y - 0.5 && a.x + a.w <= v.x + v.w + 0.5 && a.y + a.h <= v.y + v.h + 0.5;

describe("the tours as data", () => {
  it("keeps every tour to four steps at most, one short line a step", () => {
    for (const id of TOUR_IDS) {
      const steps = TOURS[id];
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.length).toBeLessThanOrEqual(TOUR_MAX_STEPS);
      for (const s of steps) {
        expect(words(s.line).length, s.line).toBeLessThanOrEqual(TOUR_MAX_WORDS);
        expect(s.line[0]).toBe(s.line[0].toUpperCase()); // sentence case
        expect(s.line).toMatch(/[.!?]$/);
      }
      expect(new Set(steps.map((s) => s.anchor)).size).toBe(steps.length);
    }
  });

  it("records each tour under a valid seen key, tour:<id>", () => {
    for (const id of TOUR_IDS) expect(tourKey(id)).toMatch(SEEN_KEY_RE);
    expect(tourKey("bay")).toBe("tour:bay");
  });

  it("gives every toured screen a tour (its greeting gives way to it)", () => {
    for (const s of TOURED_SCREENS) {
      expect(TOUR_IDS as readonly string[]).toContain(s);
      expect(Object.keys(GREETINGS)).toContain(s);
    }
  });
});

describe("steps whose anchor is missing", () => {
  const steps = TOURS.battle; // powerups, help, dots, pause
  it("are passed over, in order", () => {
    const today = new Set(["question", "keypad", "fire", "help", "powerups", "orbs"]);
    expect(liveSteps(steps, (a) => today.has(a)).map((s) => s.anchor)).toEqual(["powerups", "help"]);
    expect(nextStep(steps, -1, (a) => today.has(a))).toBe(0);
    expect(nextStep(steps, 0, (a) => today.has(a))).toBe(1);
    expect(nextStep(steps, 1, (a) => today.has(a))).toBe(-1);
  });
  it("leave nothing to show when every anchor is missing", () => {
    expect(liveSteps(steps, () => false)).toEqual([]);
    expect(nextStep(steps, -1, () => false)).toBe(-1);
  });
  it("skip from the middle when one goes", () => {
    const has = (a: string) => a !== "help";
    expect(nextStep(steps, 0, has)).toBe(2);
  });
});

describe("seen and replay", () => {
  it("replays the mounted screen's tour once, then forgets the ask", () => {
    const off = tourState.mount("bay");
    expect(tourState.current).toBe("bay");
    tourState.askReplay();
    expect(tourState.replay).toBe("bay");
    expect(tourState.takeReplay("hangar")).toBe(false);
    expect(tourState.takeReplay("bay")).toBe(true);
    expect(tourState.takeReplay("bay")).toBe(false);
    off();
    expect(tourState.current).toBe(null);
  });
  it("asks nothing when no tour is mounted, and drops an ask when its tour leaves", () => {
    tourState.askReplay();
    expect(tourState.replay).toBe(null);
    const off = tourState.mount("hangar");
    tourState.askReplay();
    off();
    expect(tourState.replay).toBe(null);
  });
  it("knows when the guided first shot is running", () => {
    expect(tourState.guideRunning).toBe(false);
    const a = tourState.guideOn(), b = tourState.guideOn();
    expect(tourState.guideRunning).toBe(true);
    a(); a();
    expect(tourState.guideRunning).toBe(true);
    b();
    expect(tourState.guideRunning).toBe(false);
  });
});

describe("placing the plate", () => {
  const screens = [
    { w: 1440, h: 900 }, { w: 375, h: 812 }, { w: 360, h: 640 }, { w: 812, h: 375 }, { w: 768, h: 1024 },
  ];
  const targets = [{ w: 44, h: 44 }, { w: 120, h: 48 }, { w: 220, h: 64 }, { w: 300, h: 90 }];
  const plate = (sw: number) => ({ w: Math.min(340, sw - 16), h: 128 });

  it("never covers its target and never leaves the screen, wherever the target is", () => {
    let cases = 0;
    for (const s of screens) {
      const view = { x: 8, y: 8, w: s.w - 16, h: s.h - 16 };
      for (const t of targets) {
        for (let fx = 0; fx <= 1; fx += 0.125) {
          for (let fy = 0; fy <= 1; fy += 0.125) {
            const target = { x: fx * (s.w - t.w), y: fy * (s.h - t.h), ...t };
            const ring = clipTo(ringOf(target, 6), { x: 0, y: 0, w: s.w, h: s.h });
            const p = plate(s.w);
            const at = placePlate(ring, p, view);
            expect(inside(at, view), JSON.stringify({ s, target, at })).toBe(true);
            // whenever some side has room, it is used and the target stays clear
            const room = ring.y - view.y >= p.h + 12 || view.y + view.h - (ring.y + ring.h) >= p.h + 12
              || ring.x - view.x >= p.w + 12 || view.x + view.w - (ring.x + ring.w) >= p.w + 12;
            if (room) {
              expect(at.fits).toBe(true);
              expect(overlaps(at, ring), JSON.stringify({ s, target, at })).toBe(false);
            }
            cases++;
          }
        }
      }
    }
    expect(cases).toBeGreaterThan(1000);
  });

  it("prefers below, then above, then the sides", () => {
    const view = { x: 0, y: 0, w: 1000, h: 800 };
    expect(placePlate({ x: 400, y: 100, w: 100, h: 40 }, { w: 300, h: 120 }, view).side).toBe("below");
    expect(placePlate({ x: 400, y: 700, w: 100, h: 40 }, { w: 300, h: 120 }, view).side).toBe("above");
    expect(placePlate({ x: 20, y: 100, w: 100, h: 640 }, { w: 300, h: 120 }, view).side).toBe("right");
    expect(placePlate({ x: 880, y: 100, w: 100, h: 640 }, { w: 300, h: 120 }, view).side).toBe("left");
  });

  it("says when nothing fits (a target as big as the screen) and still stays on screen", () => {
    const view = { x: 8, y: 8, w: 359, h: 624 };
    const at = placePlate({ x: 0, y: 0, w: 375, h: 640 }, { w: 340, h: 128 }, view);
    expect(at.fits).toBe(false);
    expect(inside(at, view)).toBe(true);
  });
});
