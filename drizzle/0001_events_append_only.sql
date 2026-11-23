-- The event log can only grow: reject UPDATE, DELETE and TRUNCATE on events.
CREATE OR REPLACE FUNCTION events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'events is append-only (% rejected)', TG_OP;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER events_no_update_delete BEFORE UPDATE OR DELETE ON "events" FOR EACH ROW EXECUTE FUNCTION events_append_only();
--> statement-breakpoint
CREATE TRIGGER events_no_truncate BEFORE TRUNCATE ON "events" FOR EACH STATEMENT EXECUTE FUNCTION events_append_only();
--> statement-breakpoint
-- Supabase exposes the public schema over its REST API. With RLS on and no policies, only the
-- server's own database role can read or write these tables.
ALTER TABLE "players" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
