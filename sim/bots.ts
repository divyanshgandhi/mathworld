import { fastMs } from "@/rig/adaptive";
import { classifyError, isWayOff, radarChoices } from "@/rig/errors";
import { tierOf } from "@/rig/pools";
import { lesson, selectTrick, type TrickId } from "@/rig/tricks";
import type { Rng } from "@/engine/util";
import type { LoggedEvent, PlayerState } from "@/director/fold";
import type { Wave } from "@/director/next";

/**
 * Simulated learners with known skill. A bot answers a wave the way a cadet would: first try,
 * then a retry or the Radar, then a Power-Up or the Radar, then Show Me How, then the We-Do shot.
 */
export interface Skill { p: number; fast: boolean }
export interface Bot {
  name: string;
  /** Probability of a right first try, and whether a right answer comes fast. */
  skill(a: number, b: number, learned: Set<TrickId>): Skill;
  /** How likely a Radar pick is right. */
  radarP: number;
  /** Whether Show Me How teaches this bot the trick for good. */
  learns: boolean;
  /** Mashers type fast and ignore the Radar. */
  masher?: boolean;
}

const single = (a: number, b: number) => Math.max(a, b) <= 10;
const hasAny = (a: number, b: number, xs: number[]) => xs.includes(a) || xs.includes(b);

export const BOTS: Record<string, Bot> = {
  "struggling-3rd-grader": {
    name: "struggling-3rd-grader", radarP: 0.5, learns: false,
    skill: (a, b) => (hasAny(a, b, [0, 1, 2, 5, 10]) && single(a, b) ? { p: 0.95, fast: true } : { p: 0.2, fast: false }),
  },
  "average-5th-grader": {
    name: "average-5th-grader", radarP: 0.7, learns: false,
    skill: (a, b) => (single(a, b) ? { p: 0.95, fast: true } : Math.min(a, b) <= 9 && Math.max(a, b) % 10 === 0 ? { p: 0.8, fast: false } : { p: 0.3, fast: false }),
  },
  "adult-speedrunner": { name: "adult-speedrunner", radarP: 0.95, learns: true, skill: () => ({ p: 0.97, fast: true }) },
  "random-masher": { name: "random-masher", radarP: 0.25, learns: false, masher: true, skill: (a, b) => ({ p: 1 / (Math.max(3 * a * b, 20) + 1), fast: true }) },
  "trick-learner": {
    name: "trick-learner", radarP: 0.35, learns: true,
    skill: (a, b, learned) => {
      // the gap: ×9 the hard way (not 9 × 2, 9 × 5, 9 × 10, which have easier routes)
      const nine = hasAny(a, b, [9, 19, 29, 99, 199]) && !hasAny(a, b, [0, 1, 2, 5, 10]);
      if (nine && !learned.has("borrow-take-back")) return { p: 0.15, fast: false };
      return { p: single(a, b) || tierOf(a, b) === 4 ? 0.95 : 0.4, fast: false };
    },
  },
};

function wrongGuess(bot: Bot, a: number, b: number, rng: Rng) {
  const p = a * b, r = rng();
  if (bot.masher) return Math.floor(rng() * Math.max(3 * p, 20));
  const g = r < 0.25 ? a + b : r < 0.5 ? a * (b + 1) : r < 0.7 ? Math.max(0, p - 1 - Math.floor(rng() * 3)) : r < 0.85 ? p + 1 + Math.floor(rng() * 3) : Math.floor(rng() * 3 * p + 2);
  return g === p ? p + 1 : g;
}

/** Plays one wave and returns its events (with timestamps), advancing the clock. */
export function playWave(bot: Bot, w: Wave, s: PlayerState, learned: Set<TrickId>, rng: Rng, clock: { t: number }): LoggedEvent[] {
  const ev: LoggedEvent[] = [], p = w.a * w.b, thr = fastMs(tierOf(w.a, w.b) ?? w.tier);
  let n = 0, usedRadar = false;
  const lat = (fast: boolean) => (bot.masher ? 300 + Math.floor(rng() * 300) : Math.round(thr * (fast ? 0.5 : 1.6) * (0.8 + 0.4 * rng())));
  const attempt = (guess: number, latencyMs: number, powerUp: TrickId | null = null) => {
    clock.t += latencyMs;
    ev.push({
      type: "attempt_submitted", at: clock.t,
      payload: { a: w.a, b: w.b, planetId: w.planetId, guess, latencyMs, errorType: classifyError(w.a, w.b, guess), attemptIndex: ++n, usedRadar, powerUpUsed: powerUp, isTransferCheck: w.isTransferCheck, waveRole: w.role },
    });
    return guess === p;
  };
  const skill = bot.skill(w.a, w.b, learned);
  const tryOwn = (fastAllowed: boolean) => { const ok = rng() < skill.p; return attempt(ok ? p : wrongGuess(bot, w.a, w.b, rng), lat(ok && skill.fast && fastAllowed)); };
  const tryRadar = () => {
    usedRadar = true;
    const ok = rng() < bot.radarP, wrong = radarChoices(w.a, w.b, rng).filter((v) => v !== p);
    return attempt(ok ? p : wrong[Math.floor(rng() * wrong.length)], lat(false));
  };

  if (tryOwn(true)) return ev;
  const first = (ev.at(-1)!.payload as { guess: number }).guess;
  // miss 1: way off brings the Radar (mashers keep typing instead); a close miss keeps free input
  if (isWayOff(w.a, w.b, first) && !(bot.masher && rng() < 0.6) ? tryRadar() : tryOwn(false)) return ev;
  // miss 2: invited to fire a known Power-Up, or pick from the Radar
  const trick = selectTrick(w.a, w.b);
  if (learned.has(trick)) {
    clock.t += 800;
    ev.push({ type: "powerup_used", at: clock.t, payload: { trickId: trick, a: w.a, b: w.b, valid: true } });
    if (attempt(rng() < 0.9 ? p : wrongGuess(bot, w.a, w.b, rng), lat(false), trick)) return ev;
  } else if (bot.masher ? tryOwn(false) : tryRadar()) return ev;
  // miss 3: Show Me How, then the We-Do shot
  const l = lesson(w.a, w.b, s.seenTricks);
  clock.t += 500;
  ev.push({ type: "explanation_started", at: clock.t, payload: { trickId: l.trick, a: w.a, b: w.b, mode: l.mode } });
  clock.t += l.mode === "full" ? 15_000 : 7_000;
  ev.push({ type: "explanation_completed", at: clock.t, payload: { trickId: l.trick, a: w.a, b: w.b, mode: l.mode, wedoCorrect: true } });
  if (bot.learns) learned.add(l.trick);
  attempt(p, 1500);
  return ev;
}
