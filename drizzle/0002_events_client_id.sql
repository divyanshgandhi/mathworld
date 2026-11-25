-- The id a client gives an event. A retried save carries the same id, and this index stores it once
-- for a cadet, on any server. Events saved without an id (NULL) are never treated as doubles.
ALTER TABLE "events" ADD COLUMN "client_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "events_player_client_id_uq" ON "events" USING btree ("player_id","client_id");