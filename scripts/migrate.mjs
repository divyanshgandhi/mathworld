// Applies drizzle/ migrations to the hosted database. Runs in the Vercel build (see vercel.json).
// Plain ESM so it runs under Node or Bun. Locally, with no DATABASE_URL, the app uses PGlite and
// migrates itself on first open, so this script has nothing to do.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.log("migrate: no DATABASE_URL, skipping (local dev uses PGlite).");
  process.exit(0);
}

// A hosted database is always reached over TLS; only a Postgres on this machine may go without.
const local = (() => { try { return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname); } catch { return false; } })();
const sql = postgres(url, { max: 1, prepare: false, ssl: local ? false : "require", onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
  console.log("migrate: database is up to date.");
} finally {
  await sql.end();
}
