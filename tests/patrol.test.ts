import { describe, expect, it } from "vitest";
import { patrolDay } from "@/db/events";
import { fold, type LoggedEvent } from "@/director/fold";
import { patrol, PATROL_REST } from "@/director/hub";
import { patrolPaid, patrolReport, patrolSlotState } from "@/components/hub/patrolSlot";

const H = 3_600_000, DAY = 24 * H;
const t0 = 400 * DAY + 10 * H;
/** A battle first try at a time (makes a fact Learning or Got it). */
const shot = (a: number, b: number, at: number, guess = a * b, i = 1): LoggedEvent => ({
  type: "attempt_submitted", at,
  payload: { a, b, planetId: "moon", guess, latencyMs: 9000, errorType: null, attemptIndex: i, usedRadar: false, powerUpUsed: null, isTransferCheck: false, waveRole: "discovery" },
});
const card = (a: number, b: number, at: number, guess = a * b): LoggedEvent => ({ type: "flashcard_answered", at, payload: { a, b, guess, latencyMs: 1500 } });
const done = (day: number, facts: { a: number; b: number }[], at: number): LoggedEvent => ({ type: "patrol_completed", at, payload: { day, facts } });
/** Three facts met in battle (a miss then a fix: Learning), on day 0. */
const played: LoggedEvent[] = [[3, 8], [4, 7], [6, 7]].flatMap(([a, b], k) => [shot(a, b, t0 + k * 10, a * b + 1), shot(a, b, t0 + k * 10 + 1, a * b, 2)]);

describe("the bay's patrol slot (src/components/hub/patrolSlot.ts)", () => {
  it("shows nothing for a new cadet, facts when due, and done once today's patrol paid", () => {
    expect(patrolSlotState(fold([]), t0).kind).toBe("none");
    expect(patrolSlotState(fold(played), t0 + H).kind).toBe("none"); // day one: still resting
    const later = t0 + PATROL_REST.practicing + H, due = patrolSlotState(fold(played), later);
    expect(due.kind).toBe("due");
    if (due.kind !== "due") return;
    expect(due.facts.length).toBe(3); // a list shorter than five
    const answers = due.facts.map((f, k) => card(f.a, f.b, later + k));
    const log = [...played, ...answers, done(patrolDay(later), due.facts.map(({ a, b }) => ({ a, b })), later + 99)];
    expect(patrolSlotState(fold(log), later + 60_000).kind).toBe("done");
    expect(patrolSlotState(fold(log), later + DAY + PATROL_REST.practicing).kind).toBe("due"); // tomorrow
  });

  it("pays once per day through the real fold: a refresh's second report and a forged one pay nothing", () => {
    const at = t0 + PATROL_REST.practicing + H, day = patrolDay(at), facts = patrol(fold(played), at)!;
    const ans = facts.map((f, k) => card(f.a, f.b, at + k)), rep = facts.map(({ a, b }) => ({ a, b }));
    const once = [...played, ...ans, done(day, rep, at + 50)];
    expect(patrolPaid(once, day)).toBe(15);
    expect(fold(once).orbs - fold(played).orbs).toBe(15);
    const twice = [...once, ...ans.map((e, k) => ({ ...e, at: at + 60 + k })), done(day, rep, at + 90)];
    expect(fold(twice).orbs).toBe(fold(once).orbs);
    expect(patrolPaid([...played, done(day, rep, at)], day)).toBeNull(); // closed mid-patrol: no answers, no pay
    const next = [...twice, ...ans.map((e, k) => ({ ...e, at: at + DAY + k })), done(day + 1, rep, at + DAY + 50)];
    expect(patrolPaid(next, day + 1)).toBe(15);
    expect(fold(next).orbs - fold(once).orbs).toBe(15);
  });

  it("reports only facts the patrol listed and answered right, each once", () => {
    const at = t0 + PATROL_REST.practicing + H, deck = patrol(fold(played), at)!;
    const keys = new Set(deck.map((f) => f.key));
    const results = [
      { a: deck[0].a, b: deck[0].b, guess: 0, ok: false },
      { a: 9, b: 9, guess: 81, ok: true }, // never listed
      ...deck.map((f) => ({ a: f.a, b: f.b, guess: f.a * f.b, ok: true })),
      { a: deck[0].a, b: deck[0].b, guess: deck[0].a * deck[0].b, ok: true }, // the miss coming back
    ];
    const out = patrolReport(deck, results);
    expect(out.length).toBe(deck.length);
    for (const f of out) expect(keys.has(`${f.a}x${f.b}`)).toBe(true);
    expect(patrolReport(deck, [{ a: deck[0].a, b: deck[0].b, guess: 1, ok: false }])).toEqual([]);
  });
});

describe("a failed save's retry (patrolUnreviewed)", () => {
  it("re-sends only the answers the server lost since the last paid patrol", async () => {
    const { patrolUnreviewed } = await import("@/components/hub/patrolSlot");
    const at = t0 + PATROL_REST.practicing + H, facts = patrol(fold(played), at)!.map(({ a, b }) => ({ a, b }));
    expect(patrolUnreviewed(played, facts)).toEqual(facts);
    const some = [...played, card(facts[0].a, facts[0].b, at), card(facts[1].a, facts[1].b, at + 1, 0)];
    expect(patrolUnreviewed(some, facts)).toEqual(facts.slice(1));
    const paid = [...played, ...facts.map((f, k) => card(f.a, f.b, at + k)), done(patrolDay(at), facts, at + 9)];
    expect(patrolUnreviewed(paid, facts)).toEqual(facts); // a paid patrol starts the count again
  });
});
