import { describe, expect, it } from "vitest";
import { fold, transferRate, type LoggedEvent, type WaveRole } from "@/director/fold";
import { acceptHyperJump, housekeeping, nextWave, scaffold } from "@/director/next";
import { band, ewma } from "@/rig/adaptive";
import { deepSpaceSector, factKey, tierOf } from "@/rig/pools";

const planets = ["earth", "moon", "mars", "asteroid-belt", "jupiter", "saturn", "uranus", "deep-space"] as const;
let clock = 0;
const shot = (a: number, b: number, guess: number, o: { tier?: number; ms?: number; role?: WaveRole; radar?: boolean; transfer?: boolean; i?: number } = {}): LoggedEvent => ({
  type: "attempt_submitted", at: (clock += o.ms ?? 1000),
  payload: { a, b, planetId: planets[o.tier ?? tierOf(a, b) ?? 0], guess, latencyMs: o.ms ?? 1000, errorType: null, attemptIndex: o.i ?? 1, usedRadar: !!o.radar, powerUpUsed: null, isTransferCheck: !!o.transfer, waveRole: o.role ?? "discovery" },
});
const right = (a: number, b: number, o: Parameters<typeof shot>[3] = {}) => shot(a, b, a * b, o);

describe("fold", () => {
  it("is pure: the same log always gives the same state", () => {
    const log = [right(3, 4, { tier: 2 }), shot(7, 8, 54), right(7, 8, { i: 2 })];
    expect(fold(log)).toEqual(fold(log));
  });

  it("recomputes correctness and moves mastery by how the wave was solved", () => {
    const s = fold([shot(3, 8, 23, { tier: 2 }), right(3, 8, { tier: 2, i: 2 }), right(5, 6, { ms: 1200 }), right(8, 7, { ms: 9000 })]);
    expect(s.history.map((h) => h.outcome)).toEqual(["self_corrected", "fast", "thoughtful"]);
    expect(s.facts["3x8"].m).toBeCloseTo(0.25 + 0.35 * (0.65 - 0.25));
    expect(s.facts["8x7"]).toBeUndefined(); // 8 × 7 is filed under 7x8
    expect(s.facts["7x8"].seen).toBe(1);
  });

  it("never serves the tutorial fleet just played again, even right after a Show Me How", () => {
    const explained: LoggedEvent = { type: "explanation_completed", payload: { trickId: "empty-mirror", a: 1, b: 4, mode: "full", wedoCorrect: true } };
    const log = [shot(1, 4, 5, { role: "tutorial" }), shot(1, 4, 3, { role: "tutorial", i: 2 }), shot(1, 4, 6, { role: "tutorial", i: 3 }), explained, right(1, 4, { role: "tutorial", i: 4 })];
    const s = fold(log);
    expect(s.tier).toBe(0);
    for (let seed = 1; seed < 40; seed++) expect(factKey(nextWave(s, seed).a, nextWave(s, seed).b)).not.toBe("1x4");
  });

  it("clears Earth's tutorial on 2 of 3 first-try solves, and moves on when the director says so", () => {
    let log: LoggedEvent[] = [right(0, 5, { role: "tutorial", ms: 9000 }), shot(1, 7, 8, { role: "tutorial" }), right(1, 7, { role: "tutorial", i: 2 }), right(1, 3, { role: "tutorial", ms: 9000 })];
    let s = fold(log);
    expect(s.offers.clear).toBe(true);
    log = [...log, ...housekeeping(s)];
    s = fold(log);
    expect(s.tier).toBe(1);
    expect(s.cleared).toEqual([0]);
  });

  it("offers a Hyper-Jump only after two Golds and a Gold probe from the planet it skips", () => {
    const golds = [right(0, 3, { role: "tutorial" }), right(1, 6, { role: "tutorial" })];
    expect(fold(golds).offers.hyperJumpTo).toBeNull();
    expect(nextWave(fold(golds), 1).role).toBe("probe");
    expect(fold([...golds, right(2, 7, { tier: 0, role: "probe", ms: 9000 })]).offers.hyperJumpTo).toBeNull(); // slow probe
    const s = fold([...golds, right(2, 7, { tier: 0, role: "probe" })]);
    expect(s.offers.hyperJumpTo).toBe(2);
    const after = fold([...golds, right(2, 7, { tier: 0, role: "probe" }), acceptHyperJump(s)!]);
    expect(after.tier).toBe(2);
    expect(after.aceCleared).toEqual([0, 1]);
  });

  it("brings a Shield Recharge after two struggles, then calms down", () => {
    const log = [shot(3, 7, 10, { tier: 2 }), right(3, 7, { tier: 2, i: 2, radar: true }), shot(4, 6, 20, { tier: 2 }), right(4, 6, { tier: 2, i: 2 })];
    const s = fold(log);
    expect(s.offers.cushion).toBe(true);
    const w = nextWave(s, 1);
    expect(w.role).toBe("recharge");
    expect(fold([...log, right(w.a, w.b, { role: "recharge" })]).offers.cushion).toBe(false);
  });

  it("queues a transfer check after Show Me How and scores it", () => {
    const smh: LoggedEvent[] = [
      shot(7, 9, 70, { tier: 3 }), shot(7, 9, 70, { tier: 3, i: 2 }), shot(7, 9, 70, { tier: 3, i: 3 }),
      { type: "explanation_completed", payload: { trickId: "borrow-take-back", a: 7, b: 9, mode: "full", wedoCorrect: true } },
      right(7, 9, { tier: 3, i: 4 }),
    ];
    let s = fold(smh);
    expect(s.seenTricks["borrow-take-back"]).toBe(1);
    expect(s.transferQueue).toEqual([{ trick: "borrow-take-back", key: "7x9", tier: 3, due: 3 }]);
    s = fold([...smh, right(6, 6, { tier: 3 }), right(7, 7, { tier: 3 })]);
    const w = nextWave(s, 1);
    expect(w).toMatchObject({ role: "transfer", isTransferCheck: true, trick: "borrow-take-back" });
    s = fold([...smh, right(6, 6, { tier: 3 }), right(7, 7, { tier: 3 }), right(w.a, w.b, { tier: 3, transfer: true, role: "transfer" })]);
    expect(s.transfer).toEqual({ checks: 1, passes: 1 });
    expect(transferRate(s)).toBe(1);
    expect(s.transferQueue).toEqual([]);
  });

  it("nudges a masher who fires three wild shots inside four seconds", () => {
    clock = 0;
    const s = fold([shot(3, 4, 90, { ms: 400 }), shot(3, 4, 0, { ms: 400, i: 2 }), shot(3, 4, 70, { ms: 400, i: 3 })]);
    expect(s.antiMashNudges).toBe(1);
  });

  it("lets a fast, correct flashcard polish a Mint fact to Gold without touching missions or streaks", () => {
    const card = (a: number, b: number, guess: number, latencyMs: number): LoggedEvent => ({ type: "flashcard_answered", payload: { a, b, guess, latencyMs } });
    const careful = Array.from({ length: 7 }, () => right(7, 8, { tier: 3, ms: 9000 }));
    const before = fold(careful);
    expect(before.facts["7x8"].m).toBeGreaterThanOrEqual(0.82);
    expect(band(before.facts["7x8"])).toBe("understood"); // Mint: careful, never fast
    const after = fold([...careful, card(8, 7, 56, 1500)]);
    expect(band(after.facts["7x8"])).toBe("gold");
    expect(after.facts["7x8"].m).toBe(before.facts["7x8"].m); // a correct card never lowers mastery
    // no mission wave, clear, Hyper-Jump streak or history; the only orbs are the first Gold (flashcards pay nothing)
    const rest = (x: typeof after) => ({ ...x, facts: null, orbs: null, ledger: null, goldEver: null, lastSeen: null });
    expect(rest(after)).toEqual(rest(before));
    expect(after.orbs - before.orbs).toBe(10);
    expect(after.ledger.at(-1)).toMatchObject({ amount: 10, reason: "New Gold fact", fact: "7x8" });
    // Below the observation it is a gentle step: alpha 0.18 toward 0.78.
    const low = fold([right(6, 7, { tier: 3, ms: 9000 }), card(6, 7, 42, 1000)]);
    expect(low.facts["6x7"].m).toBeCloseTo(ewma(ewma(0.25, 0.85), 0.78, 0.18));
    // Slow or wrong cards change nothing.
    expect(fold([...careful, card(7, 8, 56, 9000)]).facts["7x8"]).toEqual(before.facts["7x8"]);
    expect(fold([...careful, card(7, 8, 54, 1000)]).facts["7x8"]).toEqual(before.facts["7x8"]);
  });

  it("keeps Deep Space moving: every mission there is new and the sectors ramp", () => {
    let log: LoggedEvent[] = [{ type: "hyper_jump_taken", payload: { fromPlanet: "earth", toPlanet: "deep-space" } }];
    const goals: string[] = [], anchors: string[] = [], sectors: (number | null)[] = [], applied: (number | null)[] = [], ns: number[] = [];
    for (let i = 0; i < 25; i++) {
      let s = fold(log);
      const hk = housekeeping(s);
      if (hk.length) { log = [...log, ...hk]; s = fold(log); }
      const w = nextWave(s, 7);
      expect(w.tier).toBe(7);
      if (w.role === "anchor") { anchors.push(factKey(w.a, w.b)); ns.push(s.mission.n); }
      if (w.role === "discovery") { goals.push(factKey(w.a, w.b)); sectors.push(deepSpaceSector(Math.min(w.a, w.b), Math.max(w.a, w.b))); }
      if (w.role === "application") applied.push(deepSpaceSector(Math.min(w.a, w.b), Math.max(w.a, w.b)));
      log = [...log, right(w.a, w.b, { tier: 7, role: w.role, ms: 5000 })];
    }
    expect(ns).toEqual([0, 1, 2, 3, 4]);
    expect(new Set(goals).size).toBe(goals.length);
    expect(new Set(anchors).size).toBe(anchors.length);
    expect(sectors).toEqual([0, 1, 2, 3, 3]); // 3d×3d → 4d×2d → 4d×3d → 5d×3d onward
    expect(applied).toEqual(sectors);
    expect(fold(log).cleared).toEqual([7]);
  });

  it("works orbs out from the waves, ignores the client's amounts, and charges the catalogue price", () => {
    clock = 0;
    // seven first tries on different facts: 7 × 5, plus 5 for the fifth in a row = 40
    const waves = [[2, 3], [2, 4], [2, 6], [2, 7], [2, 8], [2, 9], [3, 3]].map(([a, b]) => right(a, b, { role: "practice", ms: 9000 }));
    const s = fold([
      ...waves,
      { type: "orb_earned", payload: { amount: 40, reason: "wave" } },
      { type: "upgrade_purchased", payload: { slot: "hull", itemId: "solar-gold", cost: 20 } },
    ]);
    expect(s.orbs).toBe(10);
    expect(s.equipped.hull).toBe("solar-gold");
    expect(s.ledger.at(-1)).toMatchObject({ amount: -30, reason: "Bought Solar Gold", rule: "spent" });
  });

  it("counts what the cadet has seen, by key, and nothing else moves", () => {
    const s = fold([{ type: "seen", payload: { key: "greet:bay" } }, { type: "seen", payload: { key: "greet:bay" } }, { type: "seen", payload: { key: "guide:first-shot" } }]);
    expect(s.seen).toEqual({ "greet:bay": 2, "guide:first-shot": 1 });
    expect(s.orbs).toBe(0);
    expect(s.waves).toBe(0);
  });
});

describe("scaffolding", () => {
  it("escalates gently: nudge, then the invite and Radar on miss 2, then Show Me How", () => {
    expect(scaffold(1)).toMatchObject({ nudge: true, radar: false, showMeHow: false });
    // way off on the first miss is answered in the world, not with four answers to pick from
    expect(scaffold(1)).toMatchObject({ radar: false });
    expect(scaffold(2)).toMatchObject({ radar: false, invite: true }); // no Radar: multiple choice is gone (wave 2)
    expect(scaffold(3)).toMatchObject({ showMeHow: true });
    expect(scaffold(0).radar).toBe(false);
  });
});

describe("problem strings", () => {
  it("runs anchor → discovery → application → adaptive → boss on the Asteroid Belt", () => {
    let log: LoggedEvent[] = [{ type: "hyper_jump_taken", payload: { fromPlanet: "earth", toPlanet: "asteroid-belt" } }];
    const roles: string[] = [];
    for (let i = 0; i < 5; i++) {
      const w = nextWave(fold(log), 42);
      roles.push(w.role);
      if (w.role !== "anchor") expect(w.tier).toBe(3);
      log = [...log, right(w.a, w.b, { tier: 3, role: w.role, ms: 6000 })];
    }
    expect(roles).toEqual(["anchor", "discovery", "application", "adaptive", "boss"]);
  });
});
