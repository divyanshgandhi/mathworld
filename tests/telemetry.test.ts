import { describe, expect, it } from "vitest";
import { fold, type LoggedEvent } from "@/director/fold";
import { dayTwo, describe as line, masteryGrid, sessions, tierProgress, transferReport, xray } from "@/director/telemetry";
import { checkAccess, tokenFor } from "@/app/admin/access";

let clock = 0;
const shot = (a: number, b: number, guess: number, o: { transfer?: boolean; i?: number; at?: boolean; role?: "discovery" | "transfer" } = {}): LoggedEvent => ({
  type: "attempt_submitted", ...(o.at === false ? {} : { at: (clock += 1000) }),
  payload: { a, b, planetId: "moon", guess, latencyMs: 1500, errorType: null, attemptIndex: o.i ?? 1, usedRadar: false, powerUpUsed: null, isTransferCheck: !!o.transfer, waveRole: o.role ?? (o.transfer ? "transfer" : "discovery") },
});
const lesson = (a: number, b: number, trickId: "easy-5-10" | "double-it" = "easy-5-10"): LoggedEvent => ({ type: "explanation_completed", payload: { trickId, a, b, mode: "full", wedoCorrect: true } });
const moon: LoggedEvent[] = [{ type: "intro_completed", payload: {} }, { type: "planet_cleared", payload: { planetId: "earth" } }];

describe("telemetry (src/director/telemetry.ts)", () => {
  it("splits first-try accuracy by whether the fleet's trick was explained before the wave", () => {
    // 10 × 7 missed twice, then Show Me How (its own wave counts as neither), then the sister 10 × 4 as a transfer check
    const log = [...moon, shot(10, 7, 60), shot(10, 7, 50, { i: 2 }), lesson(10, 7), shot(10, 7, 70, { i: 3 }), shot(5, 2, 9), shot(5, 2, 10, { i: 2 }), shot(10, 4, 40, { transfer: true })];
    const s = fold(log);
    expect(s.history.map((w) => [w.key, w.trick, w.afterLesson])).toEqual([["7x10", "easy-5-10", false], ["2x5", "easy-5-10", true], ["4x10", "easy-5-10", true]]);
    const r = transferReport(s);
    expect(r.checks).toEqual({ n: 1, solved: 1, rate: 1 });
    expect(r.before).toEqual({ n: 0, solved: 0, rate: null });
    expect(r.after).toEqual({ n: 2, solved: 1, rate: 0.5 }); // 5 × 2 self-corrected, 10 × 4 first try
    expect(r.byTrick[0]).toMatchObject({ trick: "easy-5-10", card: "Easy 5s & 10s" });
  });

  it("X-Ray: the fleet on screen, its misses classified, the queue and this session's transfer rate", () => {
    const history = [...moon, shot(2, 6, 12, { at: false }), shot(10, 8, 70, { at: false }), shot(10, 8, 90, { at: false, i: 2 }), lesson(10, 8), { ...shot(10, 8, 80, { at: false, i: 3 }) }];
    const live = [...history, shot(10, 3, 30, { transfer: true }), shot(2, 7, 9)];
    const x = xray(live, { a: 2, b: 7 });
    expect(x.planet).toBe("moon");
    expect(x.current).toMatchObject({ key: "2x7", attempts: 1, seen: 0 });
    expect(x.activeError).toEqual({ type: "added_instead", a: 2, b: 7, guess: 9 });
    expect(x.recent.map((f) => f.key)).toEqual(["2x7", "3x10", "8x10", "2x6"]);
    expect(x.session).toEqual({ n: 1, solved: 1, rate: 1 }); // only the stamped (live) events
    expect(x.overall.n).toBe(1);
    // a Show Me How wave queues its sister problem until the transfer check is served
    const queued = xray(history, null);
    expect(queued.queue).toEqual([{ trick: "easy-5-10", card: "Easy 5s & 10s", key: "8x10", inWaves: 2 }]);
    expect(queued.session.rate).toBeNull();
    expect(xray(live, { a: 2, b: 7 }).queue).toEqual([]);
  });

  it("builds a symmetric 0–10 mastery grid and per-planet progress", () => {
    const s = fold([...moon, shot(3, 8, 24), shot(10, 7, 70)]);
    const g = masteryGrid(s);
    expect(g).toHaveLength(11);
    expect(g[3][8].seen).toBe(1);
    expect(g[8][3]).toMatchObject({ key: "3x8", seen: 1, a: 8, b: 3 });
    expect(g[0][0].band).toBe("unseen");
    const p = tierProgress(s);
    expect(p[1]).toMatchObject({ planet: "moon", seen: 1 });
    expect(p[2]).toMatchObject({ planet: "mars", seen: 1 });
    expect(p[1].total).toBeGreaterThan(20);
    expect(p[7].total).toBeNull();
  });

  it("finds sessions and the Day-2 return", () => {
    const h = 3_600_000, day = 24 * h, t0 = Date.UTC(2026, 10, 20, 9);
    expect(sessions([t0, t0 + 60_000, t0 + 2 * h, t0 + 2 * h + 5000])).toEqual([{ start: t0, end: t0 + 60_000, events: 2 }, { start: t0 + 2 * h, end: t0 + 2 * h + 5000, events: 2 }]);
    expect(dayTwo([], t0)).toEqual({ status: "new" });
    expect(dayTwo([t0], t0 + 3 * h)).toEqual({ status: "today" });
    expect(dayTwo([t0], t0 + day)).toEqual({ status: "due" });
    expect(dayTwo([t0], t0 + 3 * day)).toEqual({ status: "missed" });
    expect(dayTwo([t0, t0 + day + h], t0 + 5 * day)).toEqual({ status: "returned", day: 1 });
    expect(dayTwo([t0, t0 + 3 * day], t0 + 5 * day)).toEqual({ status: "returned", day: 3 });
  });

  it("writes one short timeline line per event", () => {
    expect(line(shot(10, 7, 60))).toBe("10 × 7 → 60 ✗ off_by_one_group · 1.5 s · moon");
    expect(line(shot(10, 4, 40, { transfer: true }))).toBe("10 × 4 → 40 ✓ · 1.5 s · moon · transfer check, transfer");
    expect(line(lesson(10, 7))).toBe("lesson done Easy 5s & 10s · We-Do ✓");
  });

  it("guards /admin with a passphrase from the environment, never a built-in one", () => {
    expect(checkAccess(undefined, { query: "anything" })).toBe("off");
    expect(checkAccess("short", { query: "short" })).toBe("off"); // too short to be a passphrase
    expect(checkAccess("orbit-lantern-42", {})).toBe("locked");
    expect(checkAccess("orbit-lantern-42", { query: "orbit-lantern-41" })).toBe("locked");
    expect(checkAccess("orbit-lantern-42", { query: "orbit-lantern-42" })).toBe("ok");
    expect(checkAccess("orbit-lantern-42", { cookie: tokenFor("orbit-lantern-42") })).toBe("ok");
    expect(checkAccess("orbit-lantern-42", { cookie: "orbit-lantern-42" })).toBe("locked"); // the cookie holds a hash, not the key
  });
});
