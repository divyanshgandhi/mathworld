import type { EventInput, UPGRADE_SLOTS, WAVE_ROLES } from "@/db/events";
import {
  FLASHCARD_ALPHA, FLASHCARD_OBS, GOLD_STREAK_FOR_JUMP, JUMP, M0, OBS, STRUGGLES_FOR_CUSHION, TRANSFER_DELAY,
  band, ewma, fastMs, isGold, isSolved, isStruggle, missionLength, outcomeOf, solvesToClear,
  type FactStat, type Outcome,
} from "@/rig/adaptive";
import { classifyError } from "@/rig/errors";
import { factKey, MAX_TIER, tierOf, tierOfPlanet, type Fact } from "@/rig/pools";
import { selectTrick, type TrickId } from "@/rig/tricks";
import { dayNumber, ORB_RULES, ORB_WORDS, payWave, type OrbRule } from "@/battle/rewards";
import { isUnlocked, itemOf, priceFor } from "./hangar";
import { patrol } from "./hub";

/** An event as folded: the contract shape plus an optional timestamp (ms) for the anti-mash rule. */
export type LoggedEvent = EventInput & { at?: number };

/**
 * When an event happened, in ms, if anything says so: the live stamp `at`, else the server's
 * `loggedAt` that GET /api/events adds to each payload. Undefined for a log with no times.
 */
export const timeOf = (e: LoggedEvent): number | undefined => e.at ?? (e.payload as { loggedAt?: number }).loggedAt;

/** One line of the orb ledger: what earned or spent orbs, in plain words. Spending is negative. */
export interface OrbEntry {
  at?: number;
  amount: number;
  /** Plain words for the cadet: "First try", "New Gold fact", "Bought Solar Gold". */
  reason: string;
  rule: OrbRule;
  /** The fact it was for, when there is one ("3x8"). */
  fact?: string;
  /** Index of the event in the log that paid it. */
  event: number;
}
export type WaveRole = (typeof WAVE_ROLES)[number];

export interface WaveRecord {
  a: number; b: number; key: string; factTier: number; tier: number; role: WaveRole; outcome: Outcome; transfer: boolean;
  /** The trick this fleet calls for, and whether it had been explained before this wave (telemetry: transfer). */
  trick: TrickId; afterLesson: boolean;
  /** The mission it was played in (`mission.n` at the time; the planner's memory for repeats). */
  mission?: number;
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
  /** Orbs to spend now: everything earned minus everything spent. Never below zero. */
  orbs: number;
  /** Every orb earned and spent, oldest first (see `orbLedger`). Orbs are worked out from learning, never sent. */
  ledger: OrbEntry[];
  /** First-try clears in a row (every fifth pays the streak bonus). */
  firstTryStreak: number;
  /** Facts that have ever been paid for reaching Gold. */
  goldEver: Record<string, true>;
  /** When each fact was last answered, in ms (only when the log carries times). */
  lastSeen: Record<string, number>;
  /** The daily patrol: the last day it paid, and how many have paid. */
  patrol: { lastDay: number | null; done: number };
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
  /**
   * The cadet's record on this planet since arriving: wrong answers and Show Me Hows. A Hyper-Jump is
   * offered only on a clean record (see `cleanRecord`), so a struggling cadet is never sent ahead.
   */
  record: { misses: number; shown: number };
  struggleStreak: number;
  lastStruggle: Fact | null;
  transferQueue: { trick: TrickId; key: string; tier: number; due: number }[];
  transfer: { checks: number; passes: number };
  antiMashNudges: number;
  /** How many times each "seen" key was recorded (first-visit greetings, guided steps, help pages). */
  seen: Record<string, number>;
  open: OpenWave | null;
  offers: { hyperJumpTo: number | null; cushion: boolean; clear: boolean };
}

const freshMission = (n: number) => ({ n, waves: 0, inTier: 0, solved: 0, passed: false });

export const initialState = (): PlayerState => ({
  introCompleted: false, tier: 0, unlocked: 0, cleared: [], aceCleared: [], facts: {}, seenTricks: {}, orbs: 0,
  ledger: [], firstTryStreak: 0, goldEver: {}, lastSeen: {}, patrol: { lastDay: null, done: 0 }, equipped: {}, owned: [], warmups: { answered: 0, correct: 0 },
  waves: 0, history: [], mission: freshMission(0), goldStreak: 0, probePassed: false, record: { misses: 0, shown: 0 }, struggleStreak: 0, lastStruggle: null,
  transferQueue: [], transfer: { checks: 0, passes: 0 }, antiMashNudges: 0, seen: {}, open: null,
  offers: { hyperJumpTo: null, cushion: false, clear: false },
});

/**
 * Player state is a pure fold over the event log: the same events always give the same state,
 * nothing is stored that could drift from the log. Correctness and error types are recomputed here.
 */
/**
 * Two answers closer than this (by the log's clock) cannot both have been played: a volley alone takes
 * longer. The second one moves mastery as usual but pays no orbs.
 */
export const MIN_SHOT_MS = 1000;

/** A record clean enough for a Hyper-Jump: at most one wrong answer on this planet and no Show Me How. */
export const MAX_MISSES_FOR_JUMP = 1;
export const cleanRecord = (s: Pick<PlayerState, "record">) => s.record.misses <= MAX_MISSES_FOR_JUMP && s.record.shown === 0;

/**
 * Where a Hyper-Jump would go, or null: a Gold run of GOLD_STREAK_FOR_JUMP ending in a Gold probe from
 * the planet it skips, on a clean record. Three quick clears after a string of misses earn nothing.
 */
export const jumpOffer = (s: Pick<PlayerState, "record" | "probePassed" | "goldStreak" | "tier">) =>
  s.probePassed && s.goldStreak >= GOLD_STREAK_FOR_JUMP && cleanRecord(s) && s.tier < MAX_TIER ? Math.min(MAX_TIER, s.tier + JUMP) : null;

export function fold(events: LoggedEvent[]): PlayerState {
  const s = initialState();
  let wild: number[] = [];
  /** The event being folded: its index and time, for the ledger. */
  let at: number | undefined, index = 0;
  /** Day a Gold replay of each fact was last paid (-1: a log without times). */
  const replayPaid: Record<string, number> = {};
  /**
   * Facts answered right on a card (flashcard_answered: the patrol's own answers) since the last paid
   * patrol. A patrol pays only for facts reviewed that way, so a patrol event alone mints nothing.
   */
  let reviewed = new Set<string>();
  /**
   * The patrol a cadet is playing, read from the log itself (timed logs only): `offered` is how many
   * facts were due at its first card, `asked` the due facts answered since (right or wrong). A patrol
   * pays only once every offered fact has had its card, so one posted card cannot mint a patrol.
   */
  let offered = 0, asked = new Set<string>();

  const pay = (rule: OrbRule, amount: number, fact?: string) => {
    if (amount <= 0) return;
    s.orbs += amount;
    s.ledger.push({ at, amount, reason: ORB_WORDS[rule as Exclude<OrbRule, "spent">], rule, fact, event: index });
  };
  /** A fact that is Gold now and has never been paid for it: 10 orbs, once. */
  const goldCheck = (key: string) => {
    if (s.goldEver[key] || band(s.facts[key]) !== "gold") return;
    s.goldEver[key] = true;
    pay("new_gold", ORB_RULES.new_gold.amount, key);
  };

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
    s.record = { misses: 0, shown: 0 };
    s.struggleStreak = 0;
  };

  const complete = (w: OpenWave) => {
    const factTier = tierOf(w.a, w.b) ?? s.tier;
    const outcome = outcomeOf(w, factTier), key = factKey(w.a, w.b);
    const f = s.facts[key] ?? { m: M0, seen: 0, fastWins: 0 };
    const wasGold = band(s.facts[key]) === "gold";
    s.facts[key] = { m: ewma(f.m, OBS[outcome]), seen: f.seen + 1, fastWins: f.fastWins + (outcome === "fast" ? 1 : 0) };

    // orbs, from the rules table: the wave, the first-try run, then a first Gold
    const mode = w.role === "academy" ? "academy" : w.role === "practice" ? "practice" : "campaign";
    const day = at === undefined ? -1 : dayNumber(at);
    const paid = payWave({ mode, firstTry: w.attempts === 1 && !w.explained && !w.usedRadar, shown: w.explained, wasGold, replayPaidToday: replayPaid[key] === day, streak: s.firstTryStreak });
    // a shot faster than a volley can fly is not a shot that was played: it pays nothing and does not
    // feed the first-try run (forged answers posted in a burst mint nothing; see w2-economy.md)
    if (!tooFast) {
      for (const l of paid.lines) pay(l.rule, l.amount, key);
      s.firstTryStreak = paid.streak;
      if (paid.goldReplay) replayPaid[key] = day;
    }
    if (mode !== "academy") goldCheck(key);

    if (w.role === "practice" || w.role === "academy") {
      // Replaying another planet (or a dev drill): the fact's mastery moves, the mission does not.
      s.open = null;
      return;
    }
    const trick = selectTrick(w.a, w.b), lessonsBefore = (s.seenTricks[trick] ?? 0) - w.lessons.filter((t) => t === trick).length;
    s.history.push({ a: w.a, b: w.b, key, factTier, tier: s.tier, role: w.role, outcome, transfer: w.transfer, trick, afterLesson: lessonsBefore > 0, mission: s.mission.n });
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

  /** When the last answer was given, and whether this one came too soon after it to have been played. */
  let lastShotAt: number | undefined, tooFast = false;
  for (const e of events) {
    at = timeOf(e);
    switch (e.type) {
      case "intro_completed": s.introCompleted = true; break;
      case "attempt_submitted": {
        tooFast = at !== undefined && lastShotAt !== undefined && at - lastShotAt < MIN_SHOT_MS;
        if (at !== undefined) lastShotAt = at;
        const p = e.payload, w = openFor(p.a, p.b, p.waveRole, p.isTransferCheck);
        w.attempts++;
        if (w.attempts === 1) w.firstLatencyMs = p.latencyMs;
        w.usedRadar ||= p.usedRadar;
        w.powerUp ||= !!p.powerUpUsed;
        if (at !== undefined) s.lastSeen[factKey(p.a, p.b)] = at;
        if (p.guess === p.a * p.b) { complete(w); break; }
        if (w.role !== "practice" && w.role !== "academy") s.record.misses++;
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
        if (w.role !== "practice" && w.role !== "academy") s.record.shown++;
        w.lessons.push(e.payload.trickId);
        s.seenTricks[e.payload.trickId] = (s.seenTricks[e.payload.trickId] ?? 0) + 1;
        break;
      }
      case "planet_cleared": {
        const t = tierOfPlanet(e.payload.planetId);
        // only the planet in play, and only when its mission really passed (the director sends it then)
        if (t !== s.tier || !s.mission.passed) break;
        pay("planet_cleared", ORB_RULES.planet_cleared.amount);
        if (!s.cleared.includes(t)) s.cleared.push(t);
        // Deep Space has no next planet: a cleared mission opens the next, bigger sector instead.
        if (t < MAX_TIER) move(t + 1);
        else s.mission = freshMission(s.mission.n + 1);
        break;
      }
      case "hyper_jump_taken": {
        // only a jump the log has earned (the offer the director makes after a Gold run and a Gold probe),
        // and only to where that offer goes: a jump posted without one moves nothing
        const from = tierOfPlanet(e.payload.fromPlanet), to = tierOfPlanet(e.payload.toPlanet);
        const offered = jumpOffer(s);
        if (from === s.tier && to === offered) { for (let t = from; t < to; t++) s.aceCleared.push(t); move(to); }
        break;
      }
      case "orb_earned": break; // the client's claim: never believed (decision 4)
      case "upgrade_purchased": {
        // the catalogue sets the price (whatever the client sent) and the unlock; orbs never go below zero
        const { slot, itemId } = e.payload, cost = priceFor(slot, itemId, s.owned), item = itemOf(slot, itemId);
        if (!item || cost === null || cost > s.orbs) break;
        if (cost > 0 && !isUnlocked(item, s)) break;
        if (cost > 0) {
          s.orbs -= cost;
          s.ledger.push({ at, amount: -cost, reason: `Bought ${item.name}`, rule: "spent", event: index });
        }
        if (!s.owned.includes(`${slot}:${itemId}`)) s.owned.push(`${slot}:${itemId}`);
        s.equipped[slot] = itemId;
        break;
      }
      case "flashcard_answered": {
        // A gentle mastery nudge only: never a mission wave, a planet clear or a Hyper-Jump streak.
        // Flashcards pay no orbs (ORB_RULES.flashcard); a card that makes a fact Gold still pays the first Gold.
        const p = e.payload, key = factKey(p.a, p.b);
        // Timed logs: only a fact that was due for the patrol counts towards it (checked before this card moves its rest).
        const due = at === undefined ? null : patrol(s, at) ?? [], isDue = due === null || due.some((f) => f.key === key);
        if (due && isDue) { if (!asked.size) offered = due.length; asked.add(key); }
        if (at !== undefined) s.lastSeen[key] = at;
        if (p.guess === p.a * p.b && isDue) reviewed.add(key);
        if (p.guess !== p.a * p.b || p.latencyMs > fastMs(tierOf(p.a, p.b) ?? s.tier)) break;
        const f = s.facts[key] ?? { m: M0, seen: 0, fastWins: 0 };
        s.facts[key] = { m: Math.max(f.m, ewma(f.m, FLASHCARD_OBS, FLASHCARD_ALPHA)), seen: f.seen + 1, fastWins: f.fastWins + 1 };
        goldCheck(key);
        break;
      }
      case "patrol_completed": {
        // once per day, days only move forward, and only for facts answered right since the last patrol
        const { day, facts } = e.payload, keys = facts.map((x) => factKey(x.a, x.b));
        if (s.patrol.lastDay !== null && day <= s.patrol.lastDay) break;
        if (!keys.every((k) => reviewed.has(k))) break;
        if (at !== undefined && asked.size < offered) break;
        s.patrol = { lastDay: day, done: s.patrol.done + 1 };
        reviewed = new Set(); asked = new Set(); offered = 0;
        pay("patrol", ORB_RULES.patrol.amount);
        break;
      }
      case "seen": s.seen[e.payload.key] = (s.seen[e.payload.key] ?? 0) + 1; break;
      case "warmup_answered": { const p = e.payload; s.warmups.answered++; if (p.guess === (p.op === "add" ? p.a + p.b : p.a - p.b)) s.warmups.correct++; break; }
      default: break; // explanation_started: telemetry only
    }
    index++;
  }

  s.offers = {
    hyperJumpTo: jumpOffer(s),
    cushion: s.struggleStreak >= STRUGGLES_FOR_CUSHION,
    clear: s.mission.passed,
  };
  return s;
}

/** Every orb earned and spent, oldest first, with plain-word reasons (the UI and /admin read this). */
export const orbLedger = (events: LoggedEvent[]): OrbEntry[] => fold(events).ledger;

/**
 * The orbs earned (and spent) between two points of the same log: `before` is the log (or its
 * folded state) at the start of a battle or a screen, `after` is it now. The ledger only ever grows
 * at the end, so the new lines are the tail. Use it for the reward card: "+5 First try, +10 New Gold fact".
 */
export function orbsBetween(before: LoggedEvent[] | PlayerState, after: LoggedEvent[] | PlayerState) {
  const a = Array.isArray(before) ? fold(before) : before, b = Array.isArray(after) ? fold(after) : after;
  const entries = b.ledger.slice(a.ledger.length);
  return { entries, earned: entries.filter((e) => e.amount > 0).reduce((t, e) => t + e.amount, 0), net: b.orbs - a.orbs };
}

/** North-star: accuracy on transfer checks (sister problems after Show Me How). */
export const transferRate = (s: PlayerState) => (s.transfer.checks ? s.transfer.passes / s.transfer.checks : null);
