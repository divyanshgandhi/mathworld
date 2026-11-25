import { describe, expect, it } from "vitest";
import { ORB_RULES, payWave, planetClearOrbs, waveClearOrbs } from "@/battle/rewards";
import { EventInput, normalize, patrolDay } from "@/db/events";
import { seeded } from "@/engine/util";
import { fold, orbLedger, orbsBetween, type LoggedEvent, type WaveRole } from "@/director/fold";
import { CATALOG, isUnlocked, ITEMS, itemState, nextGoal, purchase, SLOTS, STARTER } from "@/director/hangar";
import { FLASHCARD_ORBS, patrol, patrolDone, TEACHES } from "@/director/hub";
import { housekeeping } from "@/director/next";
import { BOTS } from "../sim/bots";
import { simulate } from "../sim/run";

const DAY = 86_400_000;
let clock = 10 * DAY;
type Shot = { ms?: number; role?: WaveRole; i?: number; at?: number };
const shot = (a: number, b: number, guess: number, o: Shot = {}): LoggedEvent => ({
  type: "attempt_submitted", at: o.at ?? (clock += 1000),
  payload: { a, b, planetId: "moon", guess, latencyMs: o.ms ?? 1500, errorType: null, attemptIndex: o.i ?? 1, usedRadar: false, powerUpUsed: null, isTransferCheck: false, waveRole: o.role ?? "discovery" },
});
const right = (a: number, b: number, o: Shot = {}) => shot(a, b, a * b, o);
const card = (a: number, b: number, at: number, guess = a * b, latencyMs = 1500): LoggedEvent => ({ type: "flashcard_answered", at, payload: { a, b, guess, latencyMs } });
/** Careful first tries on different facts (none goes Gold): k × 5, plus 5 for every fifth in a row. */
const FACTS = [[2, 3], [2, 4], [2, 6], [2, 7], [2, 8], [2, 9], [3, 3], [3, 4], [3, 6], [3, 7], [3, 8], [3, 9], [4, 4], [4, 6], [4, 7], [4, 8], [4, 9], [6, 6], [6, 7], [6, 8]] as const;
const earn = (n: number, role: WaveRole = "practice") => FACTS.slice(0, n).map(([a, b]) => right(a, b, { role, ms: 9000 }));

describe("orb rules (src/battle/rewards.ts)", () => {
  it("keep the battle's callers working", () => {
    expect(waveClearOrbs("campaign", 1)).toBe(5);
    expect(waveClearOrbs("campaign", 2)).toBe(3);
    expect(waveClearOrbs("academy", 1)).toBe(0);
    expect(planetClearOrbs()).toBe(20);
  });
  it("pay a wave from one table", () => {
    const base = { mode: "campaign" as const, firstTry: true, shown: false, wasGold: false, replayPaidToday: false, streak: 0 };
    expect(payWave(base).lines).toEqual([{ rule: "first_try", amount: 5 }]);
    expect(payWave({ ...base, streak: 4 }).lines).toEqual([{ rule: "first_try", amount: 5 }, { rule: "streak", amount: 5 }]);
    expect(payWave({ ...base, firstTry: false })).toMatchObject({ lines: [{ rule: "later_try", amount: 3 }], streak: 0 });
    expect(payWave({ ...base, firstTry: false, shown: true }).lines).toEqual([]);
    expect(payWave({ ...base, mode: "academy" })).toMatchObject({ lines: [], streak: 0 });
    expect(payWave({ ...base, mode: "practice", wasGold: true, streak: 3 })).toMatchObject({ lines: [{ rule: "gold_replay", amount: 1 }], streak: 3 });
    expect(payWave({ ...base, mode: "practice", wasGold: true, replayPaidToday: true }).lines).toEqual([]);
    expect(ORB_RULES.flashcard.amount).toBe(0);
    expect(FLASHCARD_ORBS).toBe(0);
  });
});

describe("orbs are derived, not trusted (src/director/fold.ts)", () => {
  it("pays first tries, later tries and the fifth in a row, and the ledger adds up to the orbs", () => {
    const s = fold([...earn(5, "discovery"), shot(4, 4, 15), right(4, 4, { i: 2 })]);
    expect(s.ledger.map((e) => [e.reason, e.amount])).toEqual([
      ["First try", 5], ["First try", 5], ["First try", 5], ["First try", 5], ["First try", 5], ["Five first tries in a row", 5], ["Cleared the wave", 3],
    ]);
    expect(s.orbs).toBe(33);
    expect(s.firstTryStreak).toBe(0);
    expect(orbLedger([]).length).toBe(0);
  });

  it("ignores a forged orb_earned of 9999", () => {
    const honest = earn(3);
    const forged: LoggedEvent = { type: "orb_earned", payload: { amount: 9999, reason: "wave_clear" } };
    expect(EventInput.safeParse(forged).success).toBe(true); // the contract still accepts it (telemetry)…
    const a = fold(honest), b = fold([...honest, forged, forged]);
    expect(b.orbs).toBe(a.orbs); // …and the fold never believes it
    expect(b.ledger).toEqual(a.ledger);
    expect(fold([forged]).orbs).toBe(0);
  });

  it("never lets orbs go below zero, whatever is bought, forged or replayed", () => {
    const rng = seeded(5), items = ITEMS.map((i) => [i.slot, i.id] as const);
    for (let run = 0; run < 40; run++) {
      const log: LoggedEvent[] = [];
      for (let k = 0; k < 120; k++) {
        const r = rng();
        if (r < 0.45) { const [a, b] = FACTS[Math.floor(rng() * FACTS.length)]; log.push(shot(a, b, rng() < 0.7 ? a * b : a + b, { i: 1 + Math.floor(rng() * 3), role: rng() < 0.5 ? "practice" : "discovery" })); }
        else if (r < 0.75) { const [slot, itemId] = items[Math.floor(rng() * items.length)]; log.push({ type: "upgrade_purchased", payload: { slot, itemId, cost: Math.floor(rng() * 3) } }); }
        else if (r < 0.85) log.push({ type: "orb_earned", payload: { amount: 1 + Math.floor(rng() * 500), reason: "x" } });
        else log.push({ type: "planet_cleared", payload: { planetId: "earth" } });
        const s = fold(log);
        expect(s.orbs).toBeGreaterThanOrEqual(0);
        expect(s.ledger.reduce((t, e) => t + e.amount, 0)).toBe(s.orbs);
      }
    }
  });

  it("pays almost nothing for replaying one Gold fact: 1 orb a day", () => {
    const gold = [1, 2, 3, 4].map(() => right(6, 7, { ms: 900 }));
    const before = fold(gold);
    expect(before.goldEver["6x7"]).toBe(true);
    const day0 = clock;
    const same = Array.from({ length: 100 }, (_, i) => right(6, 7, { ms: 900, role: "practice", at: day0 + 1000 * (i + 1) }));
    const after = fold([...gold, ...same]);
    expect(after.orbs - before.orbs).toBe(1);
    // over a hundred days, one a day: 100 orbs in three months, the price of one mid look
    const daily = Array.from({ length: 100 }, (_, i) => right(6, 7, { ms: 900, role: "practice", at: day0 + DAY * (i + 1) }));
    expect(fold([...gold, ...daily]).orbs - before.orbs).toBe(100);
    // and Gold replays never feed the first-try run
    expect(after.firstTryStreak).toBe(before.firstTryStreak);
  });

  it("pays 10 the first time a fact turns Gold, once, by any route", () => {
    const s = fold([1, 2, 3, 4, 5, 6].map(() => right(3, 8, { ms: 900 })));
    expect(s.ledger.filter((e) => e.rule === "new_gold")).toEqual([expect.objectContaining({ amount: 10, fact: "3x8", reason: "New Gold fact" })]);
  });

  it("pays nothing in the Academy and nothing after Show Me How", () => {
    const academy = fold([1, 2, 3, 4, 5, 6].map(() => right(4, 9, { role: "academy", ms: 900 })));
    expect(academy.orbs).toBe(0);
    expect(academy.history).toEqual([]); // mastery only, never a mission wave
    const shown: LoggedEvent = { type: "explanation_completed", payload: { trickId: "borrow-take-back", a: 4, b: 9, mode: "full", wedoCorrect: true } };
    expect(fold([shot(4, 9, 30), shot(4, 9, 31, { i: 2 }), shot(4, 9, 32, { i: 3 }), shown, right(4, 9, { i: 4 })]).orbs).toBe(0);
  });

  it("pays a planet clear only when its mission really passed", () => {
    expect(fold([{ type: "planet_cleared", payload: { planetId: "earth" } }]).orbs).toBe(0); // forged
    let log: LoggedEvent[] = [right(0, 5, { role: "tutorial", ms: 9000 }), right(1, 7, { role: "tutorial", ms: 9000 }), right(1, 3, { role: "tutorial", ms: 9000 })];
    const s = fold(log);
    expect(s.offers.clear).toBe(true);
    log = [...log, ...housekeeping(s)];
    const t = fold(log);
    expect(t.ledger.at(-1)).toMatchObject({ amount: 20, reason: "Planet cleared" });
    expect(t.orbs).toBe(15 + 20);
    // replaying the clear changes nothing
    expect(fold([...log, ...housekeeping(s)]).orbs).toBe(35);
  });

  it("reports what a battle earned with orbsBetween", () => {
    const before = earn(4);
    const after = [...before, ...earn(6).slice(4)];
    const d = orbsBetween(before, after);
    expect(d.entries.map((e) => e.reason)).toEqual(["First try", "Five first tries in a row", "First try"]);
    expect(d.earned).toBe(15);
    expect(d.net).toBe(15);
    expect(orbsBetween(fold(before), fold(after)).earned).toBe(15);
  });
});

describe("the catalogue (src/director/hangar.ts)", () => {
  it("is a registry: every slot has one free starter and items with plain names and prices", () => {
    expect(SLOTS.map((s) => s.name)).toEqual(["Paint", "Blasters", "Thrusters"]);
    for (const s of SLOTS) {
      expect(CATALOG[s.id].filter((i) => i.cost === 0).map((i) => i.id)).toEqual([STARTER[s.id]]);
      expect(CATALOG[s.id][0].cost).toBe(0);
    }
    expect(new Set(ITEMS.map((i) => `${i.slot}:${i.id}`)).size).toBe(ITEMS.length);
    for (const i of ITEMS) {
      expect(i.blurb.length).toBeLessThanOrEqual(40);
      expect(i.blurb[0]).toBe(i.blurb[0].toUpperCase());
      expect(i.swatch.main + i.swatch.second).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i); // token variables only
    }
  });

  it("sells only the styles the rocket has", async () => {
    const { BLASTERS, HULLS, THRUSTERS } = await import("@/worlds/space/ships");
    const styles = { hull: HULLS, blaster: BLASTERS, thruster: THRUSTERS };
    for (const i of ITEMS) expect(Object.keys(styles[i.slot]), i.id).toContain(i.id);
  });

  it("ties the dearer looks to planets, and the shop always shows a goal", () => {
    const fresh = fold([]);
    const violet = CATALOG.hull.find((i) => i.id === "nebula-violet")!;
    expect(itemState(fresh, violet)).toEqual({ kind: "locked", words: "Clear the Moon first" });
    expect(itemState(fresh, CATALOG.hull[0])).toEqual({ kind: "equipped" });
    expect(itemState(fresh, CATALOG.hull[1])).toEqual({ kind: "price", cost: 30, short: 30 });
    expect(nextGoal(fresh)?.id).toBe("solar-gold");
    // rich but not there yet: a locked look cannot be bought, even with a forged event
    const rich = [...earn(20)];
    const s = fold(rich);
    expect(s.orbs).toBeGreaterThan(100);
    expect(purchase(s, "hull", "nebula-violet")).toBeNull();
    expect(fold([...rich, { type: "upgrade_purchased", payload: { slot: "hull", itemId: "nebula-violet", cost: 100 } }]).equipped.hull).toBeUndefined();
    // after the Moon, it opens
    const moon = { ...s, cleared: [0, 1] };
    expect(isUnlocked(violet, moon)).toBe(true);
    expect(purchase(moon, "hull", "nebula-violet")?.payload.cost).toBe(100);
  });

  it("buying twice charges once (a double tap sends the same event twice)", () => {
    const log = earn(7);
    const buy = purchase(fold(log), "hull", "solar-gold")!;
    const s = fold([...log, buy, buy]);
    expect(s.orbs).toBe(10);
    expect(s.ledger.filter((e) => e.rule === "spent")).toHaveLength(1);
  });
});

describe("the daily patrol (src/director/hub.ts)", () => {
  const H = 3_600_000;
  it("returns Learning first, then Got it after two days, then Gold after seven, oldest first, at most five", () => {
    const t0 = 100 * DAY;
    const log: LoggedEvent[] = [
      shot(3, 8, 23, { at: t0 }), right(3, 8, { i: 2, at: t0 + 1 }), // Learning (self-corrected), seen at t0
      shot(4, 7, 27, { at: t0 + 2 * H }), right(4, 7, { i: 2, at: t0 + 2 * H + 1 }), // Learning, later
      ...[1, 2, 3].map((k) => right(2, 6, { ms: 9000, at: t0 - 3 * DAY + k })), // Got it, three days ago
      ...[1, 2, 3].map((k) => right(2, 7, { ms: 9000, at: t0 - DAY + k })), // Got it, one day ago: resting
      ...[1, 2, 3, 4].map((k) => right(5, 6, { ms: 900, at: t0 - 8 * DAY + k })), // Gold, eight days ago
      ...[1, 2, 3, 4].map((k) => right(5, 7, { ms: 900, at: t0 - 3 * DAY + k })), // Gold, three days ago: resting
    ];
    const s = fold(log);
    const keys = (now: number) => patrol(s, now)?.map((f) => f.key) ?? null;
    expect(keys(t0 + H)).toEqual(["2x6", "5x6"]); // Learning facts are still resting (8 hours)
    expect(keys(t0 + 12 * H)).toEqual(["3x8", "4x7", "2x6", "5x6"]);
    expect(patrol(s, t0 + 12 * H)![0]).toMatchObject({ a: 3, b: 8, band: "practicing" });
    expect(keys(t0 + 10 * DAY)).toEqual(["3x8", "4x7", "2x6", "2x7", "5x6"]); // at most five
    expect(patrol(fold([]), t0)).toBeNull();
    expect(patrol(fold(earn(2)), clock + H)).toBeNull(); // a new cadet: nothing due until tomorrow
  });

  it("pays 15 once per day, only for facts really reviewed, and days only move forward", () => {
    const t0 = 200 * DAY, day = Math.floor(t0 / DAY);
    const done = (d: number, facts = [{ a: 3, b: 8 }]): LoggedEvent => ({ type: "patrol_completed", payload: { day: d, facts } });
    expect(fold([done(day)]).orbs).toBe(0); // nothing was answered: a forged patrol mints nothing
    expect(fold([right(3, 8, { at: t0 }), done(day)]).ledger.map((e) => e.rule)).toEqual(["first_try"]); // a battle answer is not a patrol
    const log = [card(3, 8, t0, 24), card(3, 8, t0 + 1), done(day)];
    let s = fold(log);
    expect(s.orbs).toBe(15);
    expect(s.ledger.at(-1)).toMatchObject({ reason: "Daily patrol", amount: 15 });
    expect(patrolDone(s, day)).toBe(true);
    expect(patrolDone(s, day + 1)).toBe(false);
    s = fold([...log, card(3, 8, t0 + 2), done(day)]); // a second patrol the same day
    expect(s.orbs).toBe(15);
    s = fold([...log, card(3, 8, t0 + DAY), done(day + 1), card(3, 8, t0 + DAY + 5), done(day - 3)]); // tomorrow pays; going back does not
    expect(s.orbs).toBe(30);
    expect(s.patrol).toEqual({ lastDay: day + 1, done: 2 });
  });

  it("keeps a patrol's day within a day of the server's clock", () => {
    const now = 300 * DAY + 5000, utc = 300;
    const e = (day: number) => normalize({ type: "patrol_completed", payload: { day, facts: [{ a: 2, b: 3 }] } }, now);
    const dayOf = (x: ReturnType<typeof e>) => (x.type === "patrol_completed" ? x.payload.day : null);
    expect(dayOf(e(utc + 40))).toBe(utc + 1);
    expect(dayOf(e(0))).toBe(utc - 1);
    expect(dayOf(e(utc))).toBe(utc);
    expect(patrolDay(Date.UTC(2026, 10, 25, 20), -330)).toBe(Math.floor(Date.UTC(2026, 10, 26, 1, 30) / DAY)); // India: already the 26th
  });
});

describe("the earning rate (the maths behind the prices)", () => {
  /** Orbs after `waves` waves, read off the ledger by event index. */
  const after = (bot: string, seed: number, waves: number) => {
    const r = simulate(BOTS[bot], seed, waves);
    return fold(r.events).orbs;
  };
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  it("lets a typical child buy a first look in session one and never pays a masher much", () => {
    const seeds = Array.from({ length: 15 }, (_, i) => 1000 + i);
    const first = Math.min(...ITEMS.filter((i) => i.cost > 0).map((i) => i.cost));
    // session one: the film, then about 8 waves
    for (const bot of ["struggling-3rd-grader", "average-5th-grader"]) expect(median(seeds.map((s) => after(bot, s, 8)))).toBeGreaterThanOrEqual(first);
    // a masher earns about one orb a wave; a careful child four or more
    expect(median(seeds.map((s) => after("random-masher", s, 30)))).toBeLessThan(30 * 1.5);
    expect(median(seeds.map((s) => after("struggling-3rd-grader", s, 30)))).toBeGreaterThan(30 * 3.5);
  });
  it("keeps the whole shop out of reach for a while: no child owns everything in five sessions", () => {
    const all = ITEMS.reduce((t, i) => t + i.cost, 0);
    expect(all).toBeGreaterThan(5 * 15 * 5); // five sessions of 15 waves at about 5 orbs a wave
  });
});

describe("the Star map words (TEACHES)", () => {
  it("say what each planet teaches in plain words", () => {
    expect(TEACHES.moon).toBe("Times 2, 5 and 10");
    for (const t of Object.values(TEACHES)) expect(t).not.toMatch(/·|digit|armada/i);
  });
});
