import { describe, expect, it } from "vitest";
import { fold, type LoggedEvent, type WaveRole } from "@/director/fold";
import { acceptHyperJump, nextWave } from "@/director/next";

let clock = 0;
const shot = (a: number, b: number, guess: number, o: { ms?: number; role?: WaveRole; i?: number } = {}): LoggedEvent => ({
  type: "attempt_submitted", at: (clock += 5000),
  payload: { a, b, planetId: "earth", guess, latencyMs: o.ms ?? 1000, errorType: null, attemptIndex: o.i ?? 1, usedRadar: false, powerUpUsed: null, isTransferCheck: false, waveRole: o.role ?? "tutorial" },
});
const right = (a: number, b: number, o: Parameters<typeof shot>[3] = {}) => shot(a, b, a * b, o);
const missed = (a: number, b: number): LoggedEvent[] => [shot(a, b, a * b + 1), right(a, b, { i: 2 })];
const shown = (a: number, b: number): LoggedEvent[] => [
  { type: "explanation_completed", payload: { trickId: "empty-mirror", a, b, mode: "full", wedoCorrect: true } }, right(a, b),
];
/** Two Gold tutorial clears and a Gold probe from the Moon: the run that used to earn the jump. */
const run = (): LoggedEvent[] => [right(1, 6), right(1, 8), right(2, 7, { role: "probe" })];

describe("Hyper-Jump needs a clean record", () => {
  it("is not offered after twelve Earth waves with eleven misses and a Show Me How, then three first-try clears", () => {
    const facts: [number, number][] = [[1, 4], [0, 5], [1, 7], [1, 3], [0, 9], [1, 5], [1, 9], [0, 3], [1, 2], [0, 7], [1, 10]];
    const struggle = [...facts.flatMap(([a, b]) => missed(a, b)), ...shown(1, 4)];
    const before = fold(struggle);
    expect(before.history).toHaveLength(12);
    expect(before.record).toEqual({ misses: 11, shown: 1 });
    // no probe is served either: the run cannot become an offer
    const twoGolds = fold([...struggle, right(1, 6), right(1, 8)]);
    expect(twoGolds.goldStreak).toBe(2);
    expect(nextWave(twoGolds, 1).role).not.toBe("probe");
    const s = fold([...struggle, ...run()]);
    expect(s.offers.hyperJumpTo).toBeNull();
    expect(acceptHyperJump(s)).toBeNull();
    // a jump posted anyway moves nothing
    expect(fold([...struggle, ...run(), { type: "hyper_jump_taken", payload: { fromPlanet: "earth", toPlanet: "mars" } }]).tier).toBe(0);
  });

  it("is not offered after any Show Me How on the planet, even with no misses", () => {
    expect(fold([...shown(1, 4), ...run()]).offers.hyperJumpTo).toBeNull();
  });

  it("is not offered after two misses on the planet", () => {
    expect(fold([...missed(1, 4), ...missed(0, 5), ...run()]).offers.hyperJumpTo).toBeNull();
  });

  it("is still offered on a clean record: one slip and a Gold run", () => {
    expect(fold([...missed(1, 4), ...run()]).offers.hyperJumpTo).toBe(2);
    expect(fold(run()).offers.hyperJumpTo).toBe(2);
  });

  it("starts each planet with a fresh record", () => {
    const s = fold([...missed(1, 4), ...run()]);
    const after = fold([...missed(1, 4), ...run(), acceptHyperJump(s)!]);
    expect(after.tier).toBe(2);
    expect(after.record).toEqual({ misses: 0, shown: 0 });
  });
});
