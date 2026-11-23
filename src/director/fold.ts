import type { EventInput, UPGRADE_SLOTS, WAVE_ROLES } from "@/db/events";
import {
  FLASHCARD_ALPHA, FLASHCARD_OBS, GOLD_STREAK_FOR_JUMP, JUMP, M0, OBS, STRUGGLES_FOR_CUSHION, TRANSFER_DELAY,
  ewma, fastMs, isGold, isSolved, isStruggle, missionLength, outcomeOf, solvesToClear,
  type FactStat, type Outcome,
} from "@/rig/adaptive";
import { classifyError } from "@/rig/errors";
import { factKey, MAX_TIER, tierOf, tierOfPlanet, type Fact } from "@/rig/pools";
import { selectTrick, type TrickId } from "@/rig/tricks";
import { priceFor } from "./hangar";

/** An event as folded: the contract shape plus an optional timestamp (ms) for the anti-mash rule. */
export type LoggedEvent = EventInput & { at?: number };
export type WaveRole = (typeof WAVE_ROLES)[number];

export interface WaveRecord {
  a: number; b: number; key: string; factTier: number; tier: number; role: WaveRole; outcome: Outcome; transfer: boolean;
  /** The trick this fleet calls for, and whether it had been explained before this wave (telemetry: transfer). */
  trick: TrickId; afterLesson: boolean;
}
interface OpenWave { a: number; b: number; role: WaveRole; transfer: boolean; attempts: number; usedRadar: boolean; powerUp: boolean; explained: boolean; firstLatencyMs: number; lessons: TrickId[] }

export interface PlayerState {
  introCompleted: boolean;
  /** Current planet as a tier: 0 Earth … 7 Deep Space. */
  tier: number;
  unlocked: number;
  cleared: number[];
  aceCleared: number[];
  facts: Record<string, FactStat>;
  seenTricks: Partial<Record<TrickId, number>>;
  orbs: number;
  equipped: Partial<Record<(typeof UPGRADE_SLOTS)[number], string>>;
  /** Hangar items bought so far, as "slot:id" (re-equipping one is free). */
  owned: string[];
  /** Mercury and Venus warm-up answers (telemetry: they never move multiplication mastery). */
  warmups: { answered: number; correct: number };
  waves: number;
  history: WaveRecord[];
  mission: { n: number; waves: number; inTier: number; solved: number; passed: boolean };
  goldStreak: number;
  /** The last wave was a Gold probe from the next planet: the Hyper-Jump is earned. */
  probePassed: boolean;
  struggleStreak: number;
  lastStruggle: Fact | null;
  transferQueue: { trick: TrickId; key: string; tier: number; due: number }[];
  transfer: { checks: number; passes: number };
  antiMashNudges: number;
  open: OpenWave | null;
  offers: { hyperJumpTo: number | null; cushion: boolean; clear: boolean };
}

const freshMission = (n: number) => ({ n, waves: 0, inTier: 0, solved: 0, passed: false });

export const initialState = (): PlayerState => ({
  introCompleted: false, tier: 0, unlocked: 0, cleared: [], aceCleared: [], facts: {}, seenTricks: {}, orbs: 0, equipped: {}, owned: [], warmups: { answered: 0, correct: 0 },
  waves: 0, history: [], mission: freshMission(0), goldStreak: 0, probePassed: false, struggleStreak: 0, lastStruggle: null,
  transferQueue: [], transfer: { checks: 0, passes: 0 }, antiMashNudges: 0, open: null,
  offers: { hyperJumpTo: null, cushion: false, clear: false },
});

/**
 * Player state is a pure fold over the event log: the same events always give the same state,
 * nothing is stored that could drift from the log. Correctness and error types are recomputed here.
 */
export function fold(events: LoggedEvent[]): PlayerState {
  const s = initialState();
  let wild: number[] = [];

  const openFor = (a: number, b: number, role: WaveRole = "discovery", transfer = false) => {
    if (s.open && (s.open.a !== a || s.open.b !== b)) s.open = null; // abandoned wave
    s.open ??= { a, b, role, transfer, attempts: 0, usedRadar: false, powerUp: false, explained: false, firstLatencyMs: 0, lessons: [] };
    return s.open;
  };

  const move = (to: number) => {
    s.tier = Math.min(MAX_TIER, to);
    s.unlocked = Math.max(s.unlocked, s.tier);
    s.mission = freshMission(0);
    s.goldStreak = 0;
    s.probePassed = false;
    s.struggleStreak = 0;
  };

  const complete = (w: OpenWave) => {
    const factTier = tierOf(w.a, w.b) ?? s.tier;
    const outcome = outcomeOf(w, factTier), key = factKey(w.a, w.b);
    const f = s.facts[key] ?? { m: M0, seen: 0, fastWins: 0 };
    s.facts[key] = { m: ewma(f.m, OBS[outcome]), seen: f.seen + 1, fastWins: f.fastWins + (outcome === "fast" ? 1 : 0) };
    if (w.role === "practice") {
      // Replaying another planet (or a dev drill): the fact's mastery moves, the mission does not.
      s.open = null;
      return;
    }
    const trick = selectTrick(w.a, w.b), lessonsBefore = (s.seenTricks[trick] ?? 0) - w.lessons.filter((t) => t === trick).length;
    s.history.push({ a: w.a, b: w.b, key, factTier, tier: s.tier, role: w.role, outcome, transfer: w.transfer, trick, afterLesson: lessonsBefore > 0 });
    s.waves++;

    const inTier = factTier === s.tier || w.role === "tutorial";
    s.probePassed = false;
    if (w.role === "probe") {
      // A probe from the next planet: Gold completes the streak, anything else resets it. It never
      // counts toward the mission and never counts as a struggle.
      if (isGold(outcome)) { s.goldStreak++; s.probePassed = true; } else s.goldStreak = 0;
      s.open = null;
      return;
    }
    const countsForMission = w.role !== "recharge" && !(w.role === "transfer" && !inTier);
    if (countsForMission) {
      s.mission.waves++;
      if (w.role !== "anchor") { s.mission.inTier++; if (isSolved(outcome)) s.mission.solved++; }
    }
    if (w.role !== "anchor" && w.role !== "recharge" && inTier) s.goldStreak = isGold(outcome) ? s.goldStreak + 1 : 0;
    if (w.role === "recharge") s.struggleStreak = 0;
    else if (isStruggle(outcome)) { s.struggleStreak++; s.lastStruggle = { a: w.a, b: w.b }; }
    else s.struggleStreak = 0;

    if (w.transfer) {
      s.transfer.checks++;
      if (isSolved(outcome)) s.transfer.passes++;
      const i = s.transferQueue.findIndex((q) => q.trick === trick);
      s.transferQueue.splice(i >= 0 ? i : 0, s.transferQueue.length ? 1 : 0);
    }
    if (outcome === "show_me_how") {
      if (!s.transferQueue.some((q) => q.trick === trick)) s.transferQueue.push({ trick, key, tier: factTier, due: s.waves + TRANSFER_DELAY });
    }

    if (s.mission.waves >= missionLength(s.tier)) {
      if (s.mission.solved >= solvesToClear(s.tier)) s.mission.passed = true;
      else s.mission = freshMission(s.mission.n + 1);
    }
    s.open = null;
  };

  for (const e of events) {
    switch (e.type) {
      case "intro_completed": s.introCompleted = true; break;
      case "attempt_submitted": {
        const p = e.payload, w = openFor(p.a, p.b, p.waveRole, p.isTransferCheck);
        w.attempts++;
        if (w.attempts === 1) w.firstLatencyMs = p.latencyMs;
        w.usedRadar ||= p.usedRadar;
        w.powerUp ||= !!p.powerUpUsed;
        if (p.guess === p.a * p.b) { complete(w); break; }
        if (classifyError(p.a, p.b, p.guess) === "wild_guess" && e.at !== undefined) {
          wild = [...wild.filter((t) => e.at! - t < 4000), e.at];
          if (wild.length >= 3) { s.antiMashNudges++; wild = []; }
        }
        break;
      }
      case "powerup_used": if (e.payload.valid) openFor(e.payload.a, e.payload.b).powerUp = true; break;
      case "explanation_completed": {
        const w = openFor(e.payload.a, e.payload.b);
        w.explained = true;
        w.lessons.push(e.payload.trickId);
        s.seenTricks[e.payload.trickId] = (s.seenTricks[e.payload.trickId] ?? 0) + 1;
        break;
      }
      case "planet_cleared": {
        const t = tierOfPlanet(e.payload.planetId);
        if (t !== s.tier) break;
        if (!s.cleared.includes(t)) s.cleared.push(t);
        // Deep Space has no next planet: a cleared mission opens the next, bigger sector instead.
        if (t < MAX_TIER) move(t + 1);
        else s.mission = freshMission(s.mission.n + 1);
        break;
      }
      case "hyper_jump_taken": {
        const from = tierOfPlanet(e.payload.fromPlanet), to = tierOfPlanet(e.payload.toPlanet);
        if (from === s.tier && to > from) { for (let t = from; t < to; t++) s.aceCleared.push(t); move(to); }
        break;
      }
      case "orb_earned": s.orbs += e.payload.amount; break;
      case "upgrade_purchased": {
        // the catalogue sets the price (whatever the client sent); Orbs never go below zero
        const { slot, itemId } = e.payload, cost = priceFor(slot, itemId, s.owned);
        if (cost === null || cost > s.orbs) break;
        s.orbs -= cost;
        if (!s.owned.includes(`${slot}:${itemId}`)) s.owned.push(`${slot}:${itemId}`);
        s.equipped[slot] = itemId;
        break;
      }
      case "flashcard_answered": {
        // A gentle mastery nudge only: never a mission wave, a planet clear or a Hyper-Jump streak.
        const p = e.payload;
        if (p.guess !== p.a * p.b || p.latencyMs > fastMs(tierOf(p.a, p.b) ?? s.tier)) break;
        const key = factKey(p.a, p.b), f = s.facts[key] ?? { m: M0, seen: 0, fastWins: 0 };
        s.facts[key] = { m: Math.max(f.m, ewma(f.m, FLASHCARD_OBS, FLASHCARD_ALPHA)), seen: f.seen + 1, fastWins: f.fastWins + 1 };
        break;
      }
      case "warmup_answered": { const p = e.payload; s.warmups.answered++; if (p.guess === (p.op === "add" ? p.a + p.b : p.a - p.b)) s.warmups.correct++; break; }
      default: break; // explanation_started: telemetry only
    }
  }

  s.offers = {
    hyperJumpTo: s.probePassed && s.goldStreak >= GOLD_STREAK_FOR_JUMP && s.tier < MAX_TIER ? Math.min(MAX_TIER, s.tier + JUMP) : null,
    cushion: s.struggleStreak >= STRUGGLES_FOR_CUSHION,
    clear: s.mission.passed,
  };
  return s;
}

/** North-star: accuracy on transfer checks (sister problems after Show Me How). */
export const transferRate = (s: PlayerState) => (s.transfer.checks ? s.transfer.passes / s.transfer.checks : null);
