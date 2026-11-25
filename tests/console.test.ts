import { describe, expect, it } from "vitest";
import { layoutFor } from "@/components/battle/layout";
import { POWERUP_DOES } from "@/components/battle/PowerUpGlyph";
import { PLANET_TEACHES } from "@/components/battle/Cards";
import { PLANETS_BY_TIER } from "@/rig/pools";
import { TRICKS } from "@/db/events";
import { NONE_FIT, orderBelt, type BeltItem } from "@/components/battle/PowerUps";
import { missionOver } from "@/components/battle/mission";
import { CARD_OPEN } from "@/components/battle/Console";

describe("battle console", () => {
  it("picks one arrangement per screen shape", () => {
    expect(layoutFor(375, 812)).toBe("pad");
    expect(layoutFor(360, 640)).toBe("pad");
    expect(layoutFor(768, 1024)).toBe("pad");
    expect(layoutFor(812, 375)).toBe("column");
    expect(layoutFor(640, 360)).toBe("column");
    expect(layoutFor(1024, 768)).toBe("strip");
    expect(layoutFor(1440, 900)).toBe("strip");
  });
  it("says what every Power-Up does, in one plain line that never gives an answer", () => {
    for (const t of TRICKS) {
      expect(POWERUP_DOES[t], t).toBeTruthy();
      expect(POWERUP_DOES[t]).not.toMatch(/=|\d{3,}/);
    }
  });
  it("briefs every planet and both warm-ups", () => {
    for (const p of [...PLANETS_BY_TIER, "mercury", "venus"]) expect(PLANET_TEACHES[p], p).toBeTruthy();
  });
});

describe("the Power-Ups list", () => {
  const B = (id: BeltItem["id"], fits: boolean): BeltItem => ({ id, card: id, fits, active: false });
  it("puts the hinted one first, then what fits, then the rest, in belt order", () => {
    const belt = [B("empty-mirror", false), B("double-it", true), B("flip-it", true), B("easy-5-10", false), B("split-and-add", true)];
    expect(orderBelt(belt, null).map((t) => t.id)).toEqual(["double-it", "flip-it", "split-and-add", "empty-mirror", "easy-5-10"]);
    expect(orderBelt(belt, "split-and-add").map((t) => t.id)).toEqual(["split-and-add", "double-it", "flip-it", "empty-mirror", "easy-5-10"]);
    // a hint never lifts a row that does not fit
    expect(orderBelt(belt, "easy-5-10")[0].id).toBe("double-it");
  });
  it("says what to do when nothing fits, in plain words", () => {
    expect(NONE_FIT).toBe("No Power-Up fits this fleet. Tap Show me how.");
  });
  it("counts as a card that is up, so keys rest and Escape is the list's", () => {
    expect(CARD_OPEN).toContain("popover-content");
  });
});

describe("a mission that ends without a win", () => {
  type H = Parameters<typeof missionOver>[1]["history"][number];
  const h = (mission: number, outcome: H["outcome"], role: H["role"] = "adaptive"): H =>
    ({ a: 2, b: 3, key: "2x3", factTier: 1, tier: 1, role, outcome, transfer: false, trick: "double-it", afterLesson: false, mission });
  const state = (n: number, waves: number, history: H[]) => ({ tier: 1, mission: { n, waves, inTier: 0, solved: 0, passed: false }, history });
  const played = [h(4, "fast", "anchor"), h(4, "fast"), h(4, "show_me_how"), h(4, "self_corrected")];
  it("says how many of the counted waves were won, seen from the next mission's first wave", () => {
    expect(missionOver({ n: 4, tier: 1 }, state(5, 0, played))).toEqual({ won: 1, of: 3 });
  });
  it("stays quiet on a reload, a new planet, or a mission still in play", () => {
    expect(missionOver(null, state(5, 0, played))).toBeNull();
    expect(missionOver({ n: 4, tier: 0 }, state(5, 0, played))).toBeNull();
    expect(missionOver({ n: 4, tier: 1 }, state(4, 2, played))).toBeNull();
    expect(missionOver({ n: 5, tier: 1 }, state(5, 0, played))).toBeNull();
  });
});
