import { describe, expect, it } from "vitest";
import { layoutFor } from "@/components/battle/layout";
import { POWERUP_DOES } from "@/components/battle/PowerUpGlyph";
import { PLANET_TEACHES } from "@/components/battle/Cards";
import { PLANETS_BY_TIER } from "@/rig/pools";
import { TRICKS } from "@/db/events";

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
