import { bigserial, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** A cadet. Everything about their progress lives in `events`, never in columns here. */
export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  avatar: text("avatar").notNull().default("cadet-1"),
  worldId: text("world_id").notNull().default("space"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The append-only event log. A database trigger rejects UPDATE, DELETE and TRUNCATE, so the log
 * can only grow. Player state (intro done, mastery, tricks, orbs…) is folded from these rows.
 */
export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    playerId: uuid("player_id").notNull().references(() => players.id),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_player_id_idx").on(t.playerId, t.id)],
);

export type Player = typeof players.$inferSelect;
export type EventRow = typeof events.$inferSelect;
