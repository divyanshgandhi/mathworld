import { describe, expect, it } from "vitest";
import { fold, type LoggedEvent } from "@/director/fold";
import { missionLength } from "@/rig/adaptive";
import { drawFrom, PLANETS_BY_TIER, type PlanetId } from "@/rig/pools";
import { seeded } from "@/engine/util";
import { buttonOf, cardLine, chipOf, journey, openingPage } from "@/components/world/journey";
import { mapLayout } from "@/components/world/mapLayout";

const cleared = (p: PlanetId): LoggedEvent[] => {
  const tier = PLANETS_BY_TIER.indexOf(p), rng = seeded(tier + 3);
  const shots = Array.from({ length: missionLength(tier) }, (): LoggedEvent => {
    const { a, b } = drawFrom(tier, rng);
    return { type: "attempt_submitted", payload: { a, b, planetId: p, guess: a * b, latencyMs: 9000, errorType: null, attemptIndex: 1, usedRadar: false, powerUpUsed: null, isTransferCheck: false, waveRole: tier === 0 ? "tutorial" : "discovery" } };
  });
  return [...shots, { type: "planet_cleared", payload: { planetId: p } }];
};
const intro: LoggedEvent = { type: "intro_completed", payload: {} };
const fresh = () => journey(fold([intro]));
const onMars = () => journey(fold([intro, ...cleared("earth"), ...cleared("moon")]));
const allCleared = () => journey(fold([intro, ...PLANETS_BY_TIER.flatMap(cleared)]));
const at = (j: ReturnType<typeof journey>, id: string) => j.find((s) => s.id === id)!;

describe("Star map pager: which page opens", () => {
  it("opens on the cadet's own planet", () => {
    expect(fresh()[openingPage(fresh())].id).toBe("earth");
    expect(onMars()[openingPage(onMars())].id).toBe("mars");
    expect(allCleared()[openingPage(allCleared())].id).toBe("deep-space");
  });
  it("opens on ?at= after a reload, then on ?locked=, and ignores names that are not stops", () => {
    const j = fresh();
    expect(j[openingPage(j, { at: "venus", locked: "moon" })].id).toBe("venus");
    expect(j[openingPage(j, { locked: "moon" })].id).toBe("moon");
    expect(j[openingPage(j, { at: "pluto", locked: "nowhere" })].id).toBe("earth");
  });
});

describe("Star map card", () => {
  it("puts one chip above the name for each state", () => {
    expect(chipOf(at(fresh(), "earth"))).toEqual({ text: "You are here", icon: "rocket" });
    expect(chipOf(at(onMars(), "moon"))).toEqual({ text: "Cleared", icon: "check" });
    expect(chipOf(at(fresh(), "moon"))).toEqual({ text: "Locked", icon: "lock" });
    expect(chipOf(at(fresh(), "mercury")).text).toBe("Warm-up");
  });
  it("names the next planet to clear on the route, never one two steps away", () => {
    expect(cardLine(at(fresh(), "moon"))).toBe("Clear Earth first.");
    expect(cardLine(at(fresh(), "deep-space"))).toBe("Clear Earth first.");
    expect(cardLine(at(onMars(), "asteroid-belt"))).toBe("Clear Mars first.");
    expect(cardLine(at(onMars(), "saturn"))).toBe("Clear Mars first.");
    const moonNext = journey(fold([intro, ...cleared("earth")]));
    expect(cardLine(at(moonNext, "mars"))).toBe("Clear the Moon first.");
  });
  it("says what an open planet teaches in one line", () => {
    expect(cardLine(at(fresh(), "earth"))).toBe("×0 and ×1");
  });
  it("offers one button: Launch here, a quieter Practise when cleared, Warm up on the warm-ups, none when locked", () => {
    expect(buttonOf(at(onMars(), "mars"))).toEqual({ text: "Launch", primary: true });
    expect(buttonOf(at(onMars(), "earth"))).toEqual({ text: "Practise", primary: false });
    expect(buttonOf(at(onMars(), "venus"))).toEqual({ text: "Warm up", primary: false });
    expect(buttonOf(at(onMars(), "jupiter"))).toBeNull();
  });
});

describe("Star map layout", () => {
  const sizes: [number, number][] = [[1440, 824], [1024, 692], [768, 948], [375, 736], [360, 564], [812, 311]];
  it("puts the planet beside its card on wide pages and above it on tall ones, inside the page", () => {
    for (const [w, h] of sizes) {
      const L = mapLayout(w, h, 300);
      expect(L.mode).toBe(w > h * 1.1 && w >= 600 ? "side" : "stack");
      expect(L.heroCx - L.hero / 2).toBeGreaterThanOrEqual(0);
      expect(L.dotEach * 10).toBeLessThanOrEqual(w);
      if (L.mode === "side") expect(L.cardLeft).toBeGreaterThan(L.heroCx + L.hero / 2);
      else expect(L.cardTop + 300).toBeLessThanOrEqual(L.dotsTop);
    }
  });
  it("keeps a phone on its side's dots clear of the card", () => {
    const L = mapLayout(812, 311, 260);
    expect(L.short).toBe(true);
    expect(L.dotsCx + (L.dotEach * 10) / 2).toBeLessThanOrEqual(L.cardLeft);
  });
});
