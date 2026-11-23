import { describe, expect, it } from "vitest";
import { seeded } from "@/engine/util";
import { band, ewma, M0, outcomeOf } from "@/rig/adaptive";
import { classifyError, forgotCarry, radarChoices } from "@/rig/errors";
import { deepSpaceSector, drawFrom, factsOf, factKey, MAX_TIER, tierOf } from "@/rig/pools";
import { lesson, placeParts, powerUpFits, selectTrick, type TrickId } from "@/rig/tricks";

describe("pools", () => {
  it("are disjoint: every fact up to 120 × 120 belongs to at most one tier", () => {
    // tierOf returns a single tier by construction; check the spec's pool rules agree with it
    const rule: ((lo: number, hi: number) => boolean)[] = [
      (lo) => lo <= 1,
      (lo, hi) => lo >= 2 && hi <= 10 && ([2, 5, 10].includes(lo) || [2, 5, 10].includes(hi)),
      (lo, hi) => lo >= 3 && hi <= 9 && lo !== 5 && hi !== 5 && (lo === 3 || lo === 4),
      (lo, hi) => lo >= 6 && hi <= 9,
      (lo, hi) => lo >= 2 && lo <= 9 && hi >= 12 && hi <= 99 && hi % 10 !== 0,
      (lo, hi) => lo >= 11 && lo <= 99 && hi >= 12 && hi <= 99,
      (lo, hi) => lo >= 3 && lo <= 99 && hi >= 105 && hi <= 999,
      (lo, hi) => deepSpaceSector(lo, hi) !== null,
    ];
    for (let a = 0; a <= 120; a++) for (let b = 0; b <= 120; b++) {
      const lo = Math.min(a, b), hi = Math.max(a, b), hits = rule.map((r, t) => (r(lo, hi) ? t : -1)).filter((t) => t >= 0);
      expect(hits.length, `${a}×${b} in tiers ${hits}`).toBeLessThanOrEqual(1);
      expect(tierOf(a, b)).toBe(hits[0] ?? null);
    }
  });

  it("draws only from the requested tier, at every ramp", () => {
    const rng = seeded(3);
    for (let t = 0; t <= MAX_TIER; t++) for (let ramp = 0; ramp < 5; ramp++) for (let i = 0; i < 200; i++) {
      const { a, b } = drawFrom(t, rng, ramp);
      expect(tierOf(a, b), `T${t} drew ${a}×${b}`).toBe(t);
    }
  });

  it("lists the single-digit tiers completely and canonically", () => {
    expect(factsOf(0).length).toBe(21); // 0×0..0×10 and 1×1..1×10
    expect(factsOf(3).map((f) => factKey(f.a, f.b))).toEqual(["6x6", "6x7", "6x8", "6x9", "7x7", "7x8", "7x9", "8x8", "8x9", "9x9"]);
    const all = [0, 1, 2, 3].flatMap(factsOf).map((f) => factKey(f.a, f.b));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("error classifier and radar", () => {
  it("names the classic mistakes", () => {
    expect(classifyError(3, 8, 24)).toBeNull();
    expect(classifyError(3, 8, 11)).toBe("added_instead");
    expect(classifyError(3, 8, 27)).toBe("off_by_one_group"); // 3 × 9
    expect(classifyError(3, 8, 32)).toBe("off_by_one_group"); // 4 × 8
    expect(classifyError(6, 24, 124)).toBe("place_value"); // forgot the carry
    expect(classifyError(6, 24, 1440)).toBe("place_value");
    expect(classifyError(7, 8, 55)).toBe("off_by_one_unit");
    expect(classifyError(7, 8, 50)).toBe("undershoot_close");
    expect(classifyError(7, 8, 62)).toBe("overshoot_close");
    expect(classifyError(7, 8, 9)).toBe("wild_guess");
    expect(classifyError(0, 7, 7)).toBe("added_instead");
    expect(forgotCarry(6, 24)).toBe(124);
  });

  it("offers four distinct choices including the answer", () => {
    const rng = seeded(5);
    for (const [a, b] of [[3, 8], [0, 4], [1, 1], [6, 24], [24, 16]]) {
      const c = radarChoices(a, b, rng);
      expect(c).toHaveLength(4);
      expect(new Set(c).size).toBe(4);
      expect(c).toContain(a * b);
      expect(c.every((v) => v >= 0)).toBe(true);
    }
  });
});

describe("mastery", () => {
  it("moves by EWMA toward each observation and bands it", () => {
    expect(ewma(M0, 1)).toBeCloseTo(0.5125);
    let m = M0;
    for (let i = 0; i < 4; i++) m = ewma(m, 1);
    expect(band({ m, seen: 4, fastWins: 4 })).toBe("gold");
    expect(band({ m, seen: 4, fastWins: 0 })).toBe("understood"); // gold needs a fast unassisted solve
    expect(band(undefined)).toBe("unseen");
    expect(band({ m: 0.4, seen: 2, fastWins: 0 })).toBe("practicing");
  });

  it("classifies how a wave was solved", () => {
    const w = { attempts: 1, usedRadar: false, powerUp: false, explained: false, firstLatencyMs: 2000 };
    expect(outcomeOf(w, 1)).toBe("fast");
    expect(outcomeOf({ ...w, firstLatencyMs: 9000 }, 1)).toBe("thoughtful");
    expect(outcomeOf({ ...w, firstLatencyMs: 9000 }, 4)).toBe("fast"); // Jupiter allows 10 s
    expect(outcomeOf({ ...w, powerUp: true }, 1)).toBe("powerup");
    expect(outcomeOf({ ...w, attempts: 2 }, 1)).toBe("self_corrected");
    expect(outcomeOf({ ...w, attempts: 2, usedRadar: true }, 1)).toBe("radar");
    expect(outcomeOf({ ...w, attempts: 3, explained: true }, 1)).toBe("show_me_how");
  });
});

describe("tricks", () => {
  it("routes the doc's examples", () => {
    const cases: [number, number, TrickId][] = [
      [0, 7, "empty-mirror"], [1, 9, "empty-mirror"], [3, 4, "fast-adding"], [4, 7, "double-it"], [8, 5, "easy-5-10"],
      [7, 10, "easy-5-10"], [4, 9, "borrow-take-back"], [6, 7, "jump-one-more"], [6, 6, "jump-one-more"], [7, 7, "split-and-add"],
      [6, 24, "big-small-split"], [24, 16, "big-small-split"], [6, 29, "borrow-take-back"], [18, 25, "half-double"],
    ];
    for (const [a, b, t] of cases) expect(selectTrick(a, b), `${a}×${b}`).toBe(t);
  });

  it("compiles every problem up to 99 × 99 and samples to 5-digit × 3-digit: parts add up and the We-Do is a × b", () => {
    const check = (a: number, b: number) => {
      for (const seen of [{}, { "flip-it": 1, "fast-adding": 1, "double-it": 1, "easy-5-10": 1, "jump-one-more": 1, "split-and-add": 1, "borrow-take-back": 1, "big-small-split": 1, "half-double": 1, "empty-mirror": 1 }]) {
        const l = lesson(a, b, seen);
        expect(l.parts.reduce((s, p) => s + p, 0)).toBe(a * b);
        expect(l.wedo.answer).toBe(a * b);
        expect(l.beats.at(-1)?.show).toEqual({ kind: "wedo", answer: a * b });
        for (const beat of l.beats) expect(beat.say, `${a}×${b} ${l.trick}`).not.toMatch(/undefined|NaN|\{/);
      }
    };
    for (let a = 0; a <= 99; a++) for (let b = 0; b <= 99; b++) check(a, b);
    const rng = seeded(9);
    for (let i = 0; i < 3000; i++) check(Math.floor(rng() * 1000), Math.floor(rng() * 100));
    for (let i = 0; i < 500; i++) check(100 + Math.floor(rng() * 900), 10_000 + Math.floor(rng() * 90_000));
  });

  it("plays the full script the first time and a short replay after", () => {
    const first = lesson(3, 8, {});
    const again = lesson(3, 8, { [first.trick]: 1 });
    expect(first.mode).toBe("full");
    expect(again.mode).toBe("fast");
    expect(again.beats.length).toBeLessThan(first.beats.length);
    expect(again.beats.length).toBeLessThanOrEqual(2);
  });

  it("uses the doc's lines with real numbers", () => {
    const l = lesson(4, 9);
    expect(l.trick).toBe("borrow-take-back");
    expect(l.beats.map((x) => x.say)).toEqual([
      "9 is just 1 shy of 10! Let's use Borrow & Take Back.",
      "Borrow 1 ghost ship per row so every row has 10.",
      "Easy! 4 rows of 10 makes 40.",
      "Now zap away the 4 ghosts we borrowed! What is 40 minus 4?",
    ]);
    expect(l.parts).toEqual([40, -4]);
    const s = lesson(6, 24);
    expect(s.beats[0].say).toBe("24 looks huge — split it into Tens and Ones: 20 and 4!");
    expect(s.beats[1].say).toBe("Count the Ten-Squads first: 6 times 2 is 12 Ten-Squads — that's 120!");
    expect(s.wedo.prompt).toBe("Combine both parts of the armada! What is 120 plus 24?");
  });

  it("flips tall fleets first, then teaches the friendlier way", () => {
    const l = lesson(8, 3);
    expect(l.tricks[0]).toBe("flip-it");
    expect(l.beats[0].say).toBe("8 tiny squads feels long — let's use Flip It!");
    expect(lesson(3, 8).tricks).not.toContain("flip-it");
  });

  it("knows which Power-Ups fit a problem", () => {
    expect(powerUpFits("borrow-take-back", 3, 4)).toBe(false);
    expect(powerUpFits("borrow-take-back", 7, 9)).toBe(true);
    expect(powerUpFits("big-small-split", 6, 24)).toBe(true);
    expect(placeParts(4053)).toEqual([4000, 50, 3]);
  });
});
