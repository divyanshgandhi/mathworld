import { seeded } from "@/engine/util";
import { fold, type LoggedEvent } from "@/director/fold";
import { acceptHyperJump, housekeeping, nextWave } from "@/director/next";
import type { TrickId } from "@/rig/tricks";
import { BOTS, playWave } from "../sim/bots";

/**
 * A log that has really earned its place: a strong player plays the real director's waves until the
 * cadet stands on `tier` (planet clears only; Hyper-Jumps are declined) or, with `jump`, until a
 * Hyper-Jump is on offer and taken. Forged clears and jumps change nothing in the fold, so fixtures
 * that need a later planet are played there.
 */
export function reach(tier: number, { seed = 3, jump = false } = {}): LoggedEvent[] {
  const log: LoggedEvent[] = [{ type: "intro_completed", payload: {} }], rng = seeded(seed), learned = new Set<TrickId>(), clock = { t: 0 };
  for (let i = 0; i < 2000; i++) {
    const s = fold(log);
    if (!jump && s.tier >= tier) return log;
    const offer = acceptHyperJump(s);
    if (offer && jump) { log.push(offer); return log; }
    const hk = housekeeping(s);
    if (hk.length) { log.push(...hk); continue; }
    log.push(...playWave(BOTS["adult-speedrunner"], nextWave(s, seed), s, learned, rng, clock));
  }
  throw new Error(`could not reach tier ${tier}`);
}
