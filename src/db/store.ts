import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { DB } from "./index";
import { normalize, type EventInput, type EventType } from "./events";
import { events, players, type Player } from "./schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createPlayer(db: DB, input: { name: string; avatar: string }): Promise<Player> {
  const [p] = await db.insert(players).values(input).returning();
  return p;
}

/** The player for a cookie value, or null if it is missing, malformed or unknown. */
export async function findPlayer(db: DB, id: string | undefined): Promise<Player | null> {
  if (!id || !UUID.test(id)) return null;
  const [p] = await db.select().from(players).where(eq(players.id, id));
  return p ?? null;
}

export async function touchPlayer(db: DB, id: string) {
  await db.update(players).set({ lastSeenAt: sql`now()` }).where(eq(players.id, id));
}

/** A client's id for an event, if it sent a usable one. */
const clientIdOf = (ids: unknown, i: number) => { const id = Array.isArray(ids) ? ids[i] : undefined; return typeof id === "string" && id.length > 0 && id.length <= 64 ? id : null; };

/**
 * Appends validated events in order. Correctness is recomputed here, never trusted from the client.
 * `ids` are the client's ids, one for each event: an event whose id this cadet has already stored is
 * skipped by the database itself, so a retried save is stored once on any server, in any order.
 * Returns the rows that were stored.
 */
export async function appendEvents(db: DB, playerId: string, list: EventInput[], ids?: unknown) {
  const paired = Array.isArray(ids) && ids.length === list.length ? ids : undefined;
  return db
    .insert(events)
    .values(list.map((e) => normalize(e)).map((e, i) => ({ playerId, type: e.type, payload: e.payload as Record<string, unknown>, clientId: clientIdOf(paired, i) })))
    .onConflictDoNothing({ target: [events.playerId, events.clientId] })
    .returning({ id: events.id, type: events.type, createdAt: events.createdAt });
}

/** The player's log, oldest first: the input to the director's fold. */
export async function listEvents(db: DB, playerId: string) {
  return db.select().from(events).where(eq(events.playerId, playerId)).orderBy(asc(events.id));
}

export async function hasEvent(db: DB, playerId: string, type: EventType) {
  const [row] = await db.select({ id: events.id }).from(events).where(and(eq(events.playerId, playerId), eq(events.type, type))).limit(1);
  return !!row;
}

/** Every cadet, newest first (the /admin dashboard). */
export async function listPlayers(db: DB) {
  return db.select().from(players).orderBy(desc(players.createdAt));
}

/** Every event, oldest first, grouped by player (the /admin dashboard: a handful of testers, read whole). */
export async function eventsByPlayer(db: DB) {
  const rows = await db.select().from(events).orderBy(asc(events.id));
  const out = new Map<string, typeof rows>();
  for (const r of rows) { const l = out.get(r.playerId); if (l) l.push(r); else out.set(r.playerId, [r]); }
  return out;
}

/** What the client may see of a player. */
export const publicPlayer = (p: Player) => ({ id: p.id, name: p.name, avatar: p.avatar, worldId: p.worldId });
