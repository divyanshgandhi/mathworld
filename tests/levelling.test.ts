import { describe, expect, it } from "vitest";
import { measure, SEEDS } from "../sim/proof";

/**
 * The levelling proof: five simulated learners with known skill, 200 seeded runs each, played
 * through the real fold and wave planner. Each claim must hold in at least `min` of the runs.
 */
describe(`levelling, ${SEEDS} seeded runs per bot`, () => {
  const { claims } = measure();
  for (const c of claims) {
    it(`${c.bot}: ${c.claim} (≥ ${Math.round(c.min * 100)}%)`, () => {
      expect(c.rate).toBeGreaterThanOrEqual(c.min);
    });
  }
});
