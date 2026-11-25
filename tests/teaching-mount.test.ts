import { describe, expect, it } from "vitest";
import { COMBAT_LINES } from "@/battle/lines";
import { PLANET_THEMES } from "@/battle/planets";
import { fold } from "@/director/fold";
import { nextWave } from "@/director/next";
import { GREETINGS } from "@/teach/greetings";
import { words } from "@/teach/words";

/** The teaching layer as mounted on the game (docs/teaching.md, Part 2). */
describe("the first battle", () => {
  it("serves a brand-new cadet one squad of three to five ships first, never an empty fleet", () => {
    const fresh = fold([]);
    const seen = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const w = nextWave(fresh, seed);
      expect(w.a).toBe(1);
      expect(w.b).toBeGreaterThanOrEqual(3);
      expect(w.b).toBeLessThanOrEqual(5);
      expect(w.tier).toBe(0);
      seen.add(w.b);
    }
    expect([...seen].sort()).toEqual([3, 4, 5]);
  });

  it("opens with Nova's one-line greeting, not the old three-idea intro", () => {
    expect(PLANET_THEMES.earth.intro).toBe("nova_greet_battle");
    expect(COMBAT_LINES.nova_greet_battle).toBe(GREETINGS.battle.text);
    expect(words(COMBAT_LINES.nova_greet_battle).length).toBeLessThanOrEqual(12);
  });
});
