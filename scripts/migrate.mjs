// Applies drizzle/ migrations to the hosted database. Runs in the Vercel build (see vercel.json).
// Plain ESM so it runs under Node or Bun. Locally, with no DATABASE_URL, the app uses PGlite and
// migrates itself on first open, so this script has nothing to do.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// Our own names first, then the ones Vercel sets when a Supabase database is added from the Storage tab.
// The query string is dropped: hosts add their own parameters, and TLS is decided below.
const env = process.env;
const raw = env.MIGRATION_DATABASE_URL || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL || env.POSTGRES_URL;
if (!raw) {
  console.log("migrate: no database address, skipping (local dev uses PGlite).");
  process.exit(0);
}
const url = (() => { try { const u = new URL(raw); u.search = ""; return u.toString(); } catch { return raw; } })();

// A hosted database is always reached over TLS; only a Postgres on this machine may go without.
const local = (() => { try { return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname); } catch { return false; } })();
const sql = postgres(url, { max: 1, prepare: false, ssl: local ? false : "require", onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
  console.log("migrate: database is up to date.");
} finally {
  await sql.end();
}
