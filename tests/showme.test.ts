import { describe, expect, it } from "vitest";
import { TRICKS } from "@/db/events";
import { seeded } from "@/engine/util";
import { drawFrom, factsOf, ENUMERABLE_TIERS } from "@/rig/pools";
import { BUDGET, lineKey, numberWords, planShowMeHow, safetyNetApplies, SHOT, shotSeconds, spokenForm, whyFor } from "@/rig/showme";
import { selectTrick, type TrickId } from "@/rig/tricks";

const ALL: Partial<Record<TrickId, number>> = Object.fromEntries(TRICKS.map((t) => [t, 1]));
/** One fact per trick in docs/tricks.md (Flip It! rides on 8 × 3). */
const EXAMPLES: [number, number, TrickId][] = [
  [0, 7, "empty-mirror"], [1, 6, "empty-mirror"], [3, 4, "fast-adding"], [8, 3, "flip-it"], [4, 7, "double-it"], [2, 7, "double-it"],
  [8, 5, "easy-5-10"], [7, 10, "easy-5-10"], [6, 8, "jump-one-more"], [3, 8, "split-and-add"], [4, 9, "borrow-take-back"],
  [6, 24, "big-small-split"], [24, 16, "big-small-split"], [18, 25, "half-double"],
];

describe("Show Me How plans (src/rig/showme.ts)", () => {
  it("plays every trick in docs/tricks.md: a banner, the spoken WHY on first sight, visual beats, and the We-Do", () => {
    for (const [a, b, t] of EXAMPLES) {
      const p = planShowMeHow(a, b, {});
      expect(p.tricks, `${a}×${b}`).toContain(t);
      expect(p.banner.why).toBe(whyFor(p.trick, a, b));
      expect(p.steps.at(-1)?.show).toEqual({ kind: "wedo", answer: a * b });
      expect(p.steps.at(-1)?.speech).not.toBe("");
      // a 2-digit × 2-digit Sector-Lock is too long to say within the shot: the banner keeps its WHY
      // and Nova says the one-line version (the Academy film speaks it in full)
      expect(p.steps.filter((s) => s.why && s.speech).length, `${a}×${b} spoken WHY`).toBe(Math.min(a, b) >= 10 && t === "big-small-split" ? 0 : 1);
      // one spoken line plus the question; every other beat is a visual move
      expect(p.steps.filter((s) => s.speech).length).toBe(2);
      for (const s of p.steps.slice(0, -1)) expect(s.speech ? true : s.hold > 0, `${a}×${b} ${s.show.kind}`).toBeTruthy();
    }
    expect(planShowMeHow(8, 3).silentFlip).toBe(true);
    expect(planShowMeHow(10, 8).silentFlip).toBe(true);
    expect(planShowMeHow(3, 8).silentFlip).toBe(false);
  });

  it("keeps the shot budget: a third miss is ready again within 10 s, a Fast Replay sooner", () => {
    const check = (a: number, b: number) => {
      const first = planShowMeHow(a, b, {}), again = planShowMeHow(a, b, ALL);
      expect(first.seconds, `${a}×${b} first ${first.trick}`).toBeLessThanOrEqual(BUDGET.full);
      expect(shotSeconds(first), `${a}×${b} shot`).toBeLessThanOrEqual(SHOT.max);
      expect(again.seconds, `${a}×${b} again ${again.trick}`).toBeLessThanOrEqual(BUDGET.fast);
      expect(again.mode).toBe("fast");
      expect(again.banner.why).toBeNull();
      if (safetyNetApplies(3, a, b)) expect(planShowMeHow(a, b, {}, { fallback: true }).seconds, `${a}×${b} fallback`).toBeLessThanOrEqual(BUDGET.full);
    };
    for (let a = 0; a <= 12; a++) for (let b = 0; b <= 12; b++) check(a, b);
    const rng = seeded(4);
    for (const t of [4, 5, 6, 7]) for (let i = 0; i < 300; i++) { const f = ENUMERABLE_TIERS.includes(t) ? factsOf(t)[i % factsOf(t).length] : drawFrom(t, rng, i % 12); check(f.a, f.b); }
  });

  it("speaks the doc's WHY line on first sight, without repeating the card name the banner shows", () => {
    // the HUD shows "15 + 9 = ?", so the question shrinks before the WHY does
    expect(planShowMeHow(3, 8).steps.map((s) => s.speech)).toEqual(["Why split 8 into 5 and 3? Because times 5 is super fast!", "", "", "What's the total?"]);
    expect(planShowMeHow(8, 3).steps[0].speech).toBe("Why split 8 into 5 and 3? Because times 5 is super fast!");
    expect(planShowMeHow(7, 1).steps[0].speech).toBe("One ship in each squad is just a mirror, it keeps the exact same number.");
    expect(planShowMeHow(6, 8).steps[0].speech).toBe("6 is just 1 more than easy 5!");
    expect(planShowMeHow(4, 9).steps[0].speech).toBe("9 is just 1 shy of 10!");
    expect(planShowMeHow(3, 8, ALL).steps[0].speech).toBe("Slice 8 into 5 and 3!");
    expect(planShowMeHow(10, 8, {}).steps.map((s) => s.show.kind)).toEqual(["pods", "wedo"]);
  });

  it("keeps every ×10 miss short: the Pods turn under one short line, then the question (~6 s end to end)", () => {
    for (let n = 2; n <= 10; n++) for (const [a, b] of [[10, n], [n, 10]]) {
      const p = planShowMeHow(a, b, {});
      expect(p.steps.map((s) => s.speech), `${a}×${b}`).toEqual(["Each squad of 10 is one Pod!", `${n} Pods of 10: how many ships?`]);
      expect(p.steps[0].why).toBe(true);
      expect(p.banner.why).toBe("a squad of 10 is one Pod");
      expect(shotSeconds(p), `${a}×${b} (an upper estimate: the baked clips run ~6 s)`).toBeLessThanOrEqual(8.1);
      expect(safetyNetApplies(1, a, b), `${a}×${b} needs no second lesson`).toBe(false);
    }
    expect(planShowMeHow(10, 8).turnUnderLine).toBe(true);
    expect(planShowMeHow(8, 3).turnUnderLine).toBe(true);
    expect(planShowMeHow(3, 8).turnUnderLine).toBe(false);
  });

  it("drops to Fast Adding on the safety net: fewer squads, swept with running totals", () => {
    const p = planShowMeHow(8, 3, {}, { fallback: true });
    expect(p.trick).toBe("fast-adding");
    expect(p.silentFlip).toBe(true);
    expect(p.steps[0]).toMatchObject({ sweep: true, show: { kind: "rows", upTo: 2, total: 16 } });
    expect(p.equation).toBe("16 + 8 = ?");
    expect(p.answer).toBe(24);
    expect(safetyNetApplies(1, 8, 3)).toBe(true);
    expect(safetyNetApplies(4, 6, 24)).toBe(false);
    expect(safetyNetApplies(0, 1, 7)).toBe(false);
  });

  it("writes the We-Do as an equation without giving the answer away", () => {
    expect(planShowMeHow(4, 9).equation).toBe("40 − 4 = ?");
    expect(planShowMeHow(8, 5).equation).toBe("½ of 80 = ?");
    expect(planShowMeHow(18, 25).equation).toBe("9 × 50 = ?");
    expect(planShowMeHow(7, 10).equation).toBe("7 × 10 = ?");
    expect(planShowMeHow(0, 7).equation).toBe("0 × 7 = ?");
    for (let a = 0; a <= 12; a++) for (let b = 0; b <= 12; b++) expect(planShowMeHow(a, b).equation, `${a}×${b}`).not.toContain(`= ${a * b}`);
  });

  it("spells symbols out for the voice and matches lines to baked clips by their words", () => {
    expect(spokenForm("Split & Add! 3×5 = 15, 40 − 4")).toBe("Split and Add! 3 times 5 is 15, 40 minus 4");
    expect(spokenForm("Easy 5s & 10s! Each Pod — count")).toBe("Easy fives and tens! Each Pod, count");
    expect(lineKey("Remember Empty & Mirror: times 0 is 0")).toBe(lineKey("Remember Empty and Mirror: times zero is zero"));
    expect(lineKey("Zero squads means empty space — not a single invader!")).toBe(lineKey("Zero squads means empty space. Not a single invader!"));
    for (const [a, b] of [[3, 8], [24, 16], [342, 26], [4, 9]]) for (const s of planShowMeHow(a, b).steps) expect(s.speech).not.toMatch(/[×=−&—]/);
    expect([0, 7, 15, 40, 342, 4536, 1_000_000].map(numberWords)).toEqual([1, 1, 1, 1, 4, 6, 2]);
    expect(selectTrick(8, 3)).toBe("split-and-add");
  });
});
