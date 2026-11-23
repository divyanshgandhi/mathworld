import { BOTS } from "./bots";
import { runMany, share, type Run } from "./run";

/** The levelling claims, measured over many seeded runs. Shared by the test and the proof doc. */
export const SEEDS = 200;
const nine = (r: Run) => r.final.history.some((h) => h.outcome === "show_me_how" && [h.a % 10, h.b % 10].includes(9) && ![h.a, h.b].some((x) => [0, 1, 2, 5, 10].includes(x)));

export interface Claim { bot: string; claim: string; rate: number; min: number }
export function measure(): { claims: Claim[]; runs: Record<string, Run[]> } {
  const runs = Object.fromEntries(Object.keys(BOTS).map((k) => [k, runMany(BOTS[k], SEEDS)]));
  const c = (bot: string, claim: string, f: (r: Run) => boolean, min: number): Claim => ({ bot, claim, rate: share(runs[bot], f), min });
  const claims = [
    c("struggling-3rd-grader", "on Mars (its frontier) at question 15", (r) => r.tierAt(15) === 2, 0.9),
    c("struggling-3rd-grader", "never beyond the Asteroid Belt in 30 questions", (r) => r.tierAt(30) <= 3, 0.95),
    c("average-5th-grader", "on Jupiter (2d × 1d, its frontier) at question 15", (r) => r.tierAt(15) === 4, 0.9),
    c("adult-speedrunner", "at multi-digit (Jupiter+) by question 10", (r) => r.tierAt(10) >= 4, 0.9),
    c("adult-speedrunner", "at Uranus or Deep Space by question 15", (r) => r.tierAt(15) >= 6, 0.85),
    c("random-masher", "never beyond the Moon in 30 questions", (r) => r.tierAt(30) <= 1, 0.99),
    c("random-masher", "gets the anti-mash nudge", (r) => r.final.antiMashNudges > 0, 0.95),
    c("random-masher", "gets Shield Recharge waves", (r) => r.steps.some((s) => s.wave.role === "recharge"), 0.95),
    c("trick-learner", "reaches the Asteroid Belt (its ×9 gap) by question 15", (r) => r.tierAt(15) >= 3, 0.7),
    c("trick-learner", "needs Show Me How on a hard ×9 fact", nine, 0.9),
    c("trick-learner", "passes a transfer check afterwards", (r) => r.final.transfer.passes > 0, 0.85),
    c("trick-learner", "advances past the Asteroid Belt by question 30", (r) => r.tierAt(30) >= 4, 0.95),
  ];
  return { claims, runs };
}
