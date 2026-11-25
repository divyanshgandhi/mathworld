import { band, fastMs, isSolved, type Band } from "@/rig/adaptive";
import { classifyError, type ErrorType } from "@/rig/errors";
import { factKey, factsOf, ENUMERABLE_TIERS, PLANETS_BY_TIER, tierOf, MAX_TIER } from "@/rig/pools";
import { CARD, type TrickId } from "@/rig/tricks";
import { fold, type LoggedEvent, type PlayerState, type WaveRecord } from "./fold";

/**
 * Telemetry, read straight from the event log (Phase 5): the hidden Shift+D X-Ray in battle and the
 * /admin dashboard. Pure: the same events always give the same report, and nothing here writes.
 */

export interface Rate { n: number; solved: number; rate: number | null }
const rate = (n: number, solved: number): Rate => ({ n, solved, rate: n ? solved / n : null });
const rateOf = (waves: WaveRecord[]) => rate(waves.length, waves.filter((w) => isSolved(w.outcome)).length);

/**
 * The north-star metric (SPEC §7): how often a cadet solves a fleet on the first try, unassisted or with a
 * Power-Up, when its trick has already been explained to them, against before it was.
 * - `checks`: the sister problems served as transfer checks after a Show Me How (the strict measure).
 * - `before` / `after`: every mission wave, split by whether its trick had been explained yet
 *   (in battle, in the Academy, or in an earlier wave). A lesson's own wave counts as neither.
 */
export interface TransferReport { checks: Rate; before: Rate; after: Rate; byTrick: { trick: TrickId; card: string; before: Rate; after: Rate; checks: Rate }[] }
export function transferReport(s: PlayerState): TransferReport {
  const own = (w: WaveRecord) => w.outcome === "show_me_how";
  const waves = s.history.filter((w) => !own(w));
  const tricks = [...new Set(s.history.map((w) => w.trick))];
  return {
    checks: rate(s.transfer.checks, s.transfer.passes),
    before: rateOf(waves.filter((w) => !w.afterLesson)),
    after: rateOf(waves.filter((w) => w.afterLesson)),
    byTrick: tricks.map((t) => ({
      trick: t, card: CARD[t],
      before: rateOf(waves.filter((w) => w.trick === t && !w.afterLesson)),
      after: rateOf(waves.filter((w) => w.trick === t && w.afterLesson)),
      checks: rateOf(s.history.filter((w) => w.trick === t && w.transfer)),
    })),
  };
}

export interface FactRow { key: string; a: number; b: number; m: number; seen: number; fastWins: number; band: Band; tier: number | null }
const factRow = (s: PlayerState, key: string): FactRow => {
  const [a, b] = key.split("x").map(Number), f = s.facts[key];
  return { key, a, b, m: f?.m ?? 0, seen: f?.seen ?? 0, fastWins: f?.fastWins ?? 0, band: band(f), tier: tierOf(a, b) };
};

/** What the X-Ray shows during a battle. */
export interface XRay {
  tier: number;
  planet: string;
  waves: number;
  mission: PlayerState["mission"];
  goldStreak: number;
  struggleStreak: number;
  /** The fleet on screen: its EWMA, band, attempts so far and the silent "fast" threshold. */
  current: (FactRow & { attempts: number; fastMs: number }) | null;
  /** The most recently played facts, newest first (the current one included). */
  recent: FactRow[];
  /** The last miss on the fleet on screen (else the last miss of the session), classified. */
  activeError: { type: ErrorType; a: number; b: number; guess: number } | null;
  /** Sister problems waiting after a Show Me How: due after `inWaves` more waves (0: next). */
  queue: { trick: TrickId; card: string; key: string; inWaves: number }[];
  /** Transfer checks passed this session (events stamped `at`, logged since the battle opened) and overall. */
  session: Rate;
  overall: Rate;
  report: TransferReport;
}

const isAttempt = (e: LoggedEvent): e is Extract<LoggedEvent, { type: "attempt_submitted" }> => e.type === "attempt_submitted";

/**
 * The live X-Ray: fold the log, then read off the current fleet, recent facts, the error in play, the
 * transfer queue and the transfer rate. "This session" is the part of the log stamped with `at` (the
 * battle's own events); history fetched from the server carries no stamp.
 */
export function xray(events: LoggedEvent[], current: { a: number; b: number } | null = null, recentCount = 8): XRay {
  const s = fold(events);
  const prior = fold(events.filter((e) => e.at === undefined));
  const attempts = events.filter(isAttempt);

  const order: string[] = [];
  for (let i = attempts.length - 1; i >= 0 && order.length < recentCount; i--) {
    const k = factKey(attempts[i].payload.a, attempts[i].payload.b);
    if (!order.includes(k)) order.push(k);
  }
  const ck = current ? factKey(current.a, current.b) : null;
  if (ck && !order.includes(ck)) order.unshift(ck);

  // attempts on the fleet on screen: the trailing run of attempts at this a × b
  let onScreen = 0;
  for (let i = attempts.length - 1; i >= 0 && current; i--) {
    const p = attempts[i].payload;
    if (p.a !== current.a || p.b !== current.b || p.guess === p.a * p.b) break;
    onScreen++;
  }
  const misses = attempts.filter((e) => e.payload.guess !== e.payload.a * e.payload.b);
  const lastMiss = (current && onScreen ? attempts[attempts.length - 1] : null) ?? misses.filter((e) => e.at !== undefined).at(-1) ?? null;
  const activeError = lastMiss ? { type: classifyError(lastMiss.payload.a, lastMiss.payload.b, lastMiss.payload.guess)!, a: lastMiss.payload.a, b: lastMiss.payload.b, guess: lastMiss.payload.guess } : null;

  const sessionChecks = s.transfer.checks - prior.transfer.checks, sessionPasses = s.transfer.passes - prior.transfer.passes;
  const tier = s.tier;
  return {
    tier, planet: PLANETS_BY_TIER[Math.min(tier, MAX_TIER)], waves: s.waves, mission: s.mission, goldStreak: s.goldStreak, struggleStreak: s.struggleStreak,
    current: ck && current ? { ...factRow(s, ck), attempts: onScreen, fastMs: fastMs(tierOf(current.a, current.b) ?? tier) } : null,
    recent: order.map((k) => factRow(s, k)),
    activeError,
    queue: s.transferQueue.map((q) => ({ trick: q.trick, card: CARD[q.trick], key: q.key, inWaves: Math.max(0, q.due - s.waves) })),
    session: rate(sessionChecks, sessionPasses),
    overall: rate(s.transfer.checks, s.transfer.passes),
    report: transferReport(s),
  };
}

/** The 0–10 × 0–10 Fact Mastery grid (row a, column b; 3 × 8 and 8 × 3 share a fact, so the grid is symmetric). */
export function masteryGrid(s: PlayerState, size = 10): FactRow[][] {
  return Array.from({ length: size + 1 }, (_, a) => Array.from({ length: size + 1 }, (_, b) => ({ ...factRow(s, factKey(a, b)), a, b })));
}

/** Per planet: facts met, mean mastery of those, Gold facts, and (for the listable tiers) how many there are. */
export interface TierProgress { tier: number; planet: string; seen: number; total: number | null; gold: number; mean: number | null }
export function tierProgress(s: PlayerState): TierProgress[] {
  const rows = Object.keys(s.facts).map((k) => factRow(s, k)).filter((r) => r.seen > 0);
  return PLANETS_BY_TIER.map((planet, tier) => {
    const mine = rows.filter((r) => r.tier === tier);
    return {
      tier, planet, seen: mine.length, gold: mine.filter((r) => r.band === "gold").length,
      total: ENUMERABLE_TIERS.includes(tier) ? factsOf(tier).length : null,
      mean: mine.length ? mine.reduce((t, r) => t + r.m, 0) / mine.length : null,
    };
  });
}

/** Play sessions: runs of events with no gap longer than `gapMs` (default 30 minutes). */
export function sessions(times: number[], gapMs = 30 * 60_000) {
  const out: { start: number; end: number; events: number }[] = [];
  for (const t of [...times].sort((x, y) => x - y)) {
    const last = out.at(-1);
    if (last && t - last.end <= gapMs) { last.end = t; last.events++; } else out.push({ start: t, end: t, events: 1 });
  }
  return out;
}

/**
 * Day-2 return (for real-kid testing): did the cadet come back on a later calendar day than their first?
 * - `new`: no events yet · `today`: still their first day · `due`: it is their Day 2 and they have not played
 * - `returned`: played on a later day (`day` is the first such day, 1 = Day 2) · `missed`: Day 2 passed without play
 * `dayOf` turns a timestamp into a calendar day number in the tester's time zone.
 */
export type DayTwo = { status: "new" | "today" | "due" | "missed" } | { status: "returned"; day: number };
export const utcDay = (ms: number) => Math.floor(ms / 86_400_000);
export function dayTwo(times: number[], now: number, dayOf: (ms: number) => number = utcDay): DayTwo {
  if (!times.length) return { status: "new" };
  const first = dayOf(Math.min(...times));
  const later = times.map((t) => dayOf(t) - first).filter((d) => d >= 1);
  if (later.length) return { status: "returned", day: Math.min(...later) };
  const today = dayOf(now) - first;
  return { status: today <= 0 ? "today" : today === 1 ? "due" : "missed" };
}

const fmt = (n: number) => n.toLocaleString("en-US");
/** One event as a short line for the timeline. */
export function describe(e: LoggedEvent): string {
  switch (e.type) {
    case "attempt_submitted": {
      const p = e.payload, ok = p.guess === p.a * p.b, err = ok ? null : classifyError(p.a, p.b, p.guess);
      const extras = [p.usedRadar && "radar", p.powerUpUsed && `power-up ${p.powerUpUsed}`, p.isTransferCheck && "transfer check", p.waveRole && p.waveRole !== "discovery" && p.waveRole].filter(Boolean);
      return `${fmt(p.a)} × ${fmt(p.b)} → ${fmt(p.guess)} ${ok ? "✓" : `✗ ${err}`} · ${(p.latencyMs / 1000).toFixed(1)} s · ${p.planetId}${extras.length ? ` · ${extras.join(", ")}` : ""}`;
    }
    case "explanation_started": return `Show Me How ${CARD[e.payload.trickId]} on ${e.payload.a} × ${e.payload.b} (${e.payload.mode})`;
    case "explanation_completed": return `lesson done ${CARD[e.payload.trickId]} · We-Do ${e.payload.wedoCorrect ? "✓" : "✗"}`;
    case "powerup_used": return `Power-Up ${CARD[e.payload.trickId]} on ${e.payload.a} × ${e.payload.b}${e.payload.valid ? "" : " (did not fit)"}`;
    case "planet_cleared": return `cleared ${e.payload.planetId}`;
    case "hyper_jump_taken": return `Hyper-Jump ${e.payload.fromPlanet} → ${e.payload.toPlanet}`;
    case "orb_earned": return `+${e.payload.amount} orbs (${e.payload.reason})`;
    case "upgrade_purchased": return `bought ${e.payload.slot} ${e.payload.itemId}`;
    case "flashcard_answered": { const p = e.payload; return `flashcard ${p.a} × ${p.b} → ${p.guess} ${p.guess === p.a * p.b ? "✓" : "✗"} · ${(p.latencyMs / 1000).toFixed(1)} s`; }
    case "warmup_answered": { const p = e.payload, r = p.op === "add" ? p.a + p.b : p.a - p.b; return `warm-up ${p.a} ${p.op === "add" ? "+" : "−"} ${p.b} → ${p.guess} ${p.guess === r ? "✓" : "✗"}`; }
    case "intro_completed": return "finished the intro";
    case "seen": return `saw ${e.payload.key}`;
  }
}

export const pct = (r: Rate) => (r.rate === null ? "—" : `${Math.round(r.rate * 100)}%`);
