import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { openPglite, type DB } from "@/db";
import { EventBody, EventInput, NewPlayer } from "@/db/events";
import { appendEvents, createPlayer, findPlayer, hasEvent, listEvents } from "@/db/store";

const attempt = (a: number, b: number, guess: number, correct = true) => ({
  type: "attempt_submitted" as const,
  payload: { a, b, planetId: "moon" as const, guess, correct, latencyMs: 2400, errorType: null, attemptIndex: 1, usedRadar: false, powerUpUsed: null, isTransferCheck: false },
});

describe("database", () => {
  let db: DB;
  beforeEach(async () => { db = await openPglite(); });

  it("creates a player and finds them again by id", async () => {
    const p = await createPlayer(db, { name: "Maya", avatar: "cadet-2" });
    expect(p.worldId).toBe("space");
    expect((await findPlayer(db, p.id))?.name).toBe("Maya");
    expect(await findPlayer(db, "not-a-uuid")).toBeNull();
    expect(await findPlayer(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("appends events in order and reports whether a type exists", async () => {
    const p = await createPlayer(db, { name: "Leo", avatar: "cadet-1" });
    expect(await hasEvent(db, p.id, "intro_completed")).toBe(false);
    await appendEvents(db, p.id, [{ type: "intro_completed", payload: {} }, attempt(3, 4, 12)]);
    const log = await listEvents(db, p.id);
    expect(log.map((e) => e.type)).toEqual(["intro_completed", "attempt_submitted"]);
    expect(log[0].id).toBeLessThan(log[1].id);
    expect(await hasEvent(db, p.id, "intro_completed")).toBe(true);
  });

  it("recomputes correctness on the server, whatever the client claims", async () => {
    const p = await createPlayer(db, { name: "Zoe", avatar: "cadet-3" });
    await appendEvents(db, p.id, [attempt(3, 8, 23, true), attempt(0, 7, 0, false)]);
    const [wrong, zero] = await listEvents(db, p.id);
    expect(wrong.payload.correct).toBe(false);
    expect(zero.payload.correct).toBe(true); // 0 is a valid answer
  });

  it("refuses to update, delete or truncate the event log", async () => {
    const p = await createPlayer(db, { name: "Aarav", avatar: "cadet-4" });
    await appendEvents(db, p.id, [{ type: "intro_completed", payload: {} }]);
    // Drizzle wraps the database error; the trigger's message is on the cause.
    const reason = (q: Promise<unknown>) => q.then(() => "allowed", (e: Error & { cause?: Error }) => e.cause?.message ?? e.message);
    expect(await reason(db.execute(sql`update events set type = 'x'`))).toMatch(/append-only \(UPDATE/);
    expect(await reason(db.execute(sql`delete from events`))).toMatch(/append-only \(DELETE/);
    expect(await reason(db.execute(sql`truncate events`))).toMatch(/append-only \(TRUNCATE/);
    expect(await listEvents(db, p.id)).toHaveLength(1);
  });

  it("rejects events for a player that does not exist", async () => {
    await expect(appendEvents(db, "00000000-0000-4000-8000-000000000000", [{ type: "intro_completed", payload: {} }])).rejects.toThrow();
  });
});

describe("event contract", () => {
  it("accepts every documented event type", () => {
    const ok = [
      { type: "intro_completed" },
      attempt(24, 16, 384),
      { type: "powerup_used", payload: { trickId: "split-and-add", a: 3, b: 8, valid: true } },
      { type: "explanation_started", payload: { trickId: "borrow-take-back", a: 4, b: 9, mode: "full" } },
      { type: "explanation_completed", payload: { trickId: "borrow-take-back", a: 4, b: 9, mode: "fast", wedoCorrect: true } },
      { type: "planet_cleared", payload: { planetId: "moon" } },
      { type: "hyper_jump_taken", payload: { fromPlanet: "moon", toPlanet: "asteroid-belt" } },
      { type: "orb_earned", payload: { amount: 5, reason: "wave_clear" } },
      { type: "upgrade_purchased", payload: { slot: "hull", itemId: "solar-gold", cost: 40 } },
      { type: "flashcard_answered", payload: { a: 6, b: 7, guess: 42, latencyMs: 1800 } },
    ];
    for (const e of ok) expect(EventInput.safeParse(e).success, JSON.stringify(e)).toBe(true);
    expect(EventBody.safeParse({ events: ok }).success).toBe(true);
  });

  it("rejects unknown types, bad shapes and oversized batches", () => {
    expect(EventInput.safeParse({ type: "score_hacked", payload: {} }).success).toBe(false);
    expect(EventInput.safeParse({ type: "planet_cleared", payload: { planetId: "pluto" } }).success).toBe(false);
    expect(EventInput.safeParse({ ...attempt(3, 4, 12), payload: { ...attempt(3, 4, 12).payload, a: -1 } }).success).toBe(false);
    expect(EventInput.safeParse({ type: "intro_completed", payload: { sneaky: 1 } }).success).toBe(false);
    expect(EventBody.safeParse({ events: Array.from({ length: 51 }, () => ({ type: "intro_completed" })) }).success).toBe(false);
  });

  it("validates new player names", () => {
    expect(NewPlayer.parse({ name: "  Jannat " })).toEqual({ name: "Jannat", avatar: "cadet-1" });
    expect(NewPlayer.safeParse({ name: "" }).success).toBe(false);
    expect(NewPlayer.safeParse({ name: "x".repeat(25) }).success).toBe(false);
  });
});
