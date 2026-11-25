import { patrolDay, PATROL_SIZE } from "@/db/events";
import { fold, type LoggedEvent, type PlayerState } from "@/director/fold";
import { patrol, patrolDone, type PatrolFact } from "@/director/hub";
import type { Fact } from "@/rig/pools";

/** A card's answer, as the flashcards sheet reports it. */
type Answer = { a: number; b: number; guess: number; ok: boolean };

/** What the bay's patrol slot shows: facts due (with how many), today's patrol done, or nothing. */
export type PatrolSlotState = { kind: "due"; facts: PatrolFact[] } | { kind: "done" } | { kind: "none" };

/** The slot's state from folded state at a time: done today wins, then facts due, else nothing. `pickAt` (review only) shifts which facts are due, never the day. */
export function patrolSlotState(s: PlayerState, now: number, pickAt = now): PatrolSlotState {
  if (patrolDone(s, patrolDay(now))) return { kind: "done" };
  const due = patrol(s, pickAt);
  return due ? { kind: "due", facts: due } : { kind: "none" };
}

/** The facts a finished patrol reports: each fact answered right at least once, in order, never one outside the deck. */
export function patrolReport(deck: Fact[], results: Answer[]): Fact[] {
  const inDeck = new Set(deck.map((f) => `${f.a}x${f.b}`)), seen = new Set<string>(), out: Fact[] = [];
  for (const r of results) {
    const k = `${r.a}x${r.b}`;
    if (!r.ok || !inDeck.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push({ a: r.a, b: r.b });
  }
  return out.slice(0, PATROL_SIZE);
}

/** The orbs the fold paid the patrol for `day` in a log (from the ledger), or null if it has not paid. */
export function patrolPaid(log: LoggedEvent[], day: number): number | null {
  const s = fold(log);
  const line = s.ledger.find((e) => e.rule === "patrol" && e.event !== undefined && log[e.event]?.type === "patrol_completed" && (log[e.event].payload as { day: number }).day === day);
  return line ? line.amount : null;
}

