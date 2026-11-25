import { describe, expect, it } from "vitest";
import { EventInput } from "@/db/events";
import { createBus, type BattleEvents } from "@/battle/bus";
import { attachPersistence } from "@/battle/persistence";
import { createScheduler } from "@/battle/scheduler";
import { attachSound } from "@/battle/sound";
import { attachTelemetry } from "@/battle/telemetry";

const fire = (over: Partial<BattleEvents["fire"]> = {}): BattleEvents["fire"] => ({
  n: 24, a: 3, b: 8, planet: "moon", latencyMs: 4100, attempt: 1, radar: false, usedRadar: false, errorType: null, powerUp: null,
  isTransferCheck: false, waveRole: "anchor", ...over,
});

describe("battle bus", () => {
  it("delivers in subscription order, synchronously, and unsubscribes", () => {
    const bus = createBus(), seen: string[] = [];
    const off = bus.on("charge", (p) => seen.push(`a${p.n}`));
    bus.on("charge", (p) => seen.push(`b${p.n}`));
    bus.onAny((t) => seen.push(t));
    bus.emit("charge", { n: 2 });
    expect(seen).toEqual(["a2", "b2", "charge"]);
    off();
    bus.emit("charge", { n: 3 });
    expect(seen.slice(3)).toEqual(["b3", "charge"]);
    bus.clear();
    bus.emit("charge", { n: 4 });
    expect(seen).toHaveLength(5);
  });
});

describe("persistence from the bus", () => {
  const record = () => {
    const bus = createBus(), log: EventInput[] = [];
    attachPersistence(bus, (e) => log.push(e));
    return { bus, log };
  };

  it("writes exactly the stored event types and fields the battle always wrote", () => {
    const { bus, log } = record();
    bus.emit("lesson_completed", { tricks: ["flip-it", "fast-adding"], a: 8, b: 3, mode: "full", wedoCorrect: true });
    bus.emit("fire", fire({ errorType: "undershoot_close", n: 20, attempt: 2, usedRadar: true, powerUp: "flip-it", waveRole: "practice" }));
    bus.emit("orb_burst", { amount: 5, reason: "wave_clear" });
    bus.emit("powerup_applied", { id: "double-it", a: 3, b: 8, fits: false });
    bus.emit("lesson_started", { tricks: ["easy-5-10"], a: 5, b: 6, mode: "fast", auto: true, fallback: false });
    bus.emit("record", { event: { type: "intro_completed", payload: {} } });
    // in-battle events with no stored form write nothing
    bus.emit("hit", { ship: 0, amount: 1, full: true, t: 1 });
    bus.emit("hint_shown", { id: "squads", level: 1, a: 3, b: 8, soft: false, trigger: "miss", reveal: ["squads"], powerUp: null });
    bus.emit("charge", { n: 12 });
    expect(log).toEqual([
      { type: "explanation_completed", payload: { trickId: "flip-it", a: 8, b: 3, mode: "full", wedoCorrect: true } },
      { type: "explanation_completed", payload: { trickId: "fast-adding", a: 8, b: 3, mode: "full", wedoCorrect: true } },
      {
        type: "attempt_submitted",
        payload: { a: 3, b: 8, planetId: "moon", guess: 20, latencyMs: 4100, errorType: "undershoot_close", attemptIndex: 2, usedRadar: true, powerUpUsed: "flip-it", isTransferCheck: false, waveRole: "practice" },
      },
      { type: "orb_earned", payload: { amount: 5, reason: "wave_clear" } },
      { type: "powerup_used", payload: { trickId: "double-it", a: 3, b: 8, valid: false } },
      { type: "explanation_started", payload: { trickId: "easy-5-10", a: 5, b: 6, mode: "fast" } },
      { type: "intro_completed", payload: {} },
    ]);
    // field order is part of the payload the server sees
    expect(Object.keys(log[2].payload)).toEqual(["a", "b", "planetId", "guess", "latencyMs", "errorType", "attemptIndex", "usedRadar", "powerUpUsed", "isTransferCheck", "waveRole"]);
    for (const e of log) expect(EventInput.safeParse(e).success, e.type).toBe(true);
  });

  it("0 is stored as a guess like any other", () => {
    const { bus, log } = record();
    bus.emit("fire", fire({ n: 0, a: 0, b: 7 }));
    expect(log[0]).toMatchObject({ type: "attempt_submitted", payload: { guess: 0, a: 0, b: 7 } });
    expect(EventInput.safeParse(log[0]).success).toBe(true);
  });
});

describe("sound cues from the bus", () => {
  it("throttles shots and hit ticks on the stage clock; ticks climb along a squad; the last ship bursts", () => {
    const bus = createBus(), played: string[] = [];
    attachSound(bus, (s, o) => played.push(o ? `${s}:${o.step}` : s));
    bus.emit("wave_started", { a: 3, b: 8, index: 0, role: "anchor" });
    bus.emit("launch", { extra: false, t: 1.0 });
    bus.emit("launch", { extra: false, t: 1.03 }); // inside 0.06 s: no second shot
    bus.emit("launch", { extra: false, t: 1.1 });
    bus.emit("launch", { extra: true, t: 2 });
    bus.emit("hit", { ship: 0, amount: 1, full: true, t: 1.42, step: 0 });
    bus.emit("hit", { ship: 1, amount: 1, full: true, t: 1.45, step: 1 }); // inside 0.035 s: no second tick
    bus.emit("hit", { ship: 2, amount: 1, full: true, t: 1.5, step: 2 });
    bus.emit("hit", { ship: 3, amount: 1, full: true, t: 1.51, step: 3, last: true }); // the last ship always lands
    bus.emit("resolved", { correct: false, n: 20, product: 24, attempt: 1 });
    bus.emit("regroup", {});
    bus.emit("resolved", { correct: true, n: 24, product: 24, attempt: 2 });
    bus.emit("cue", { sfx: "blip_ok" });
    bus.emit("battle_done", { kind: "academy" });
    bus.emit("battle_done", { kind: "clear" });
    expect(played).toEqual(["flyby", "shot", "shot", "tick:0", "tick:2", "burst", "shield", "clear", "blip_ok", "clear"]);
  });
});

describe("telemetry from the bus", () => {
  it("times fire → ready and lesson start → last line", () => {
    let t = 1000; // a wall clock, never 0
    const bus = createBus(), reports: { shots?: number[]; lessons?: number[] }[] = [];
    attachTelemetry(bus, (r) => reports.push(r), () => t);
    bus.emit("ready", {}); // no shot yet: nothing
    bus.emit("fire", fire());
    t = 4200;
    bus.emit("ready", {});
    t = 5000;
    bus.emit("lesson_started", { tricks: ["fast-adding"], a: 3, b: 8, mode: "full", auto: false, fallback: false });
    t = 10000;
    bus.emit("lesson_spoken", { ms: 5000 });
    bus.emit("fire", fire());
    t = 12500;
    bus.emit("ready", {});
    expect(reports).toEqual([{ shots: [3200] }, { lessons: [5000] }, { shots: [3200, 2500] }]);
  });
});

describe("stage-clock scheduler", () => {
  it("runs due callbacks newest first, and only on the stage clock", async () => {
    const clock = { time: 0 }, at = createScheduler(clock), order: string[] = [];
    at.at(0.5, () => order.push("a"));
    at.at(0.5, () => order.push("b"));
    at.at(1, () => order.push("c"));
    const done = at.after(1).then(() => order.push("after"));
    clock.time = 0.4; at.tick();
    expect(order).toEqual([]);
    clock.time = 0.5; at.tick();
    expect(order).toEqual(["b", "a"]);
    clock.time = 2; at.tick();
    await done;
    expect(order).toEqual(["b", "a", "c", "after"]);
    expect(at.pending).toBe(0);
  });
});
