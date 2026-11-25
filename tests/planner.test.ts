import { describe, expect, it } from "vitest";
import { initialState, type PlayerState, type WaveRecord } from "@/director/fold";
import { nextWave } from "@/director/next";
import type { Outcome } from "@/rig/adaptive";
import { factKey, tierOf } from "@/rig/pools";
import { selectTrick } from "@/rig/tricks";

/** A cadet on `tier` who has played these waves in mission 0, with mastery set by hand. */
function cadet(tier: number, waves: [number, number, Outcome][], m: Record<string, number> = {}): PlayerState {
  const s = initialState();
  s.tier = tier; s.unlocked = tier; s.introCompleted = true;
  for (const [a, b, outcome] of waves) {
    const key = factKey(a, b);
    s.history.push({ a, b, key, factTier: tierOf(a, b) ?? tier, tier, role: tier === 0 ? "tutorial" : "discovery", outcome, transfer: false, trick: selectTrick(a, b), afterLesson: false, mission: 0 } satisfies WaveRecord);
    s.facts[key] = { m: 0.6, seen: 1, fastWins: outcome === "fast" ? 1 : 0 };
    s.waves++;
  }
  for (const [k, v] of Object.entries(m)) s.facts[k] = { ...(s.facts[k] ?? { seen: 1, fastWins: 0 }), m: v };
  s.mission.waves = waves.length; s.mission.inTier = waves.length;
  return s;
}
const keysOf = (s: PlayerState) => Array.from({ length: 40 }, (_, i) => { const w = nextWave(s, i + 1); return factKey(w.a, w.b); });

describe("wave planner", () => {
  it("never serves a fact cleared first try again in the same mission (the empty fleet 0 x 10)", () => {
    // 0 x 10 cleared first try, then made the weakest fact on purpose: it still must not come back
    const s = cadet(0, [[1, 3, "fast"], [1, 5, "fast"], [0, 10, "thoughtful"], [1, 4, "self_corrected"]], { "0x10": 0.01 });
    expect(keysOf(s)).not.toContain("0x10");
    // nor as a bonus wave: a Shield Recharge or a transfer check
    expect(keysOf({ ...s, offers: { ...s.offers, cushion: true } })).not.toContain("0x10");
    expect(keysOf({ ...s, transferQueue: [{ trick: selectTrick(0, 5), key: "0x5", tier: 0, due: 0 }] })).not.toContain("0x10");
    // a later mission may serve it again
    expect(keysOf({ ...s, mission: { ...s.mission, n: 1, waves: 0 } })).toContain("0x10");
  });

  it("brings a missed fact back once, later, never next", () => {
    const missed = cadet(0, [[1, 3, "fast"], [1, 5, "fast"], [1, 7, "self_corrected"]], { "1x7": 0.01 });
    expect(keysOf(missed)).not.toContain("1x7"); // not straight after the miss
    const later = cadet(0, [[1, 3, "fast"], [1, 5, "fast"], [1, 7, "self_corrected"], [1, 4, "fast"]], { "1x7": 0.01 });
    expect(new Set(keysOf(later))).toEqual(new Set(["1x7"])); // later, it comes back
    const back = cadet(0, [[1, 3, "fast"], [1, 5, "fast"], [1, 7, "self_corrected"], [1, 4, "fast"], [1, 7, "self_corrected"], [1, 2, "fast"]], { "1x7": 0.01 });
    expect(keysOf(back)).not.toContain("1x7"); // once only
  });

  it("keeps bonus and warm-up waves inside what the cadet has met or the planet teaches", () => {
    // Earth: a Shield Recharge is an Earth fact, and no empty fleet before two clears
    const earth = cadet(0, [[1, 4, "self_corrected"], [1, 6, "show_me_how"]]);
    earth.lastStruggle = { a: 1, b: 6 };
    for (const k of keysOf({ ...earth, offers: { ...earth.offers, cushion: true } })) {
      const [a, b] = k.split("x").map(Number);
      expect(tierOf(a, b)).toBe(0);
      expect(a === 0 || b === 0).toBe(false);
    }
    // a cadet who jumped from Earth to Mars never met the Moon: Mars recharges come from Mars
    const mars = cadet(2, [[3, 7, "self_corrected"], [4, 8, "show_me_how"]]);
    mars.lastStruggle = null;
    for (let seed = 1; seed < 40; seed++) {
      const w = nextWave({ ...mars, offers: { ...mars.offers, cushion: true } }, seed);
      expect(w.role).toBe("recharge");
      expect(tierOf(w.a, w.b)).toBe(2);
    }
    // warm-ups (the anchor wave) never reach a planet above this one
    for (let seed = 1; seed < 40; seed++) {
      const w = nextWave(cadet(2, []), seed);
      expect(w.role).toBe("anchor");
      expect(tierOf(w.a, w.b)!).toBeLessThanOrEqual(2);
    }
  });
});
