import { seeded } from "@/engine/util";
import { fold, type LoggedEvent, type PlayerState } from "@/director/fold";
import { acceptHyperJump, housekeeping, nextWave, type Wave } from "@/director/next";
import type { TrickId } from "@/rig/tricks";
import { playWave, type Bot } from "./bots";

export interface Step { q: number; wave: Wave; tierAfter: number; outcome: string }
export interface Run { bot: string; seed: number; steps: Step[]; tierAt: (q: number) => number; final: PlayerState; events: LoggedEvent[] }

/**
 * Plays `questions` waves through the real fold and the real wave planner. Before each wave the
 * director's housekeeping runs (planet clears), and the bot accepts any Hyper-Jump on offer.
 */
export function simulate(bot: Bot, seed: number, questions = 30): Run {
  const events: LoggedEvent[] = [], rng = seeded(seed), learned = new Set<TrickId>(), clock = { t: 0 };
  const steps: Step[] = [];
  const tiers: number[] = [0];
  for (let q = 1; q <= questions; q++) {
    let s = fold(events);
    const jump = acceptHyperJump(s);
    if (jump) { events.push(jump); s = fold(events); }
    else { const hk = housekeeping(s); if (hk.length) { events.push(...hk); s = fold(events); } }
    const wave = nextWave(s, seed);
    events.push(...playWave(bot, wave, s, learned, rng, clock));
    s = fold(events);
    // count the clear or jump the cadet has just earned as part of this question
    const tierAfter = s.offers.hyperJumpTo ?? (s.offers.clear ? Math.min(7, s.tier + 1) : s.tier);
    tiers.push(tierAfter);
    steps.push({ q, wave, tierAfter, outcome: s.history.at(-1)?.outcome ?? "?" });
  }
  return { bot: bot.name, seed, steps, tierAt: (q) => tiers[Math.min(q, tiers.length - 1)], final: fold(events), events };
}

export const runMany = (bot: Bot, seeds: number, questions = 30) => Array.from({ length: seeds }, (_, i) => simulate(bot, 1000 + i, questions));
export const share = <T,>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length / xs.length;
