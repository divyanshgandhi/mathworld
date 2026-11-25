import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/** Either driver: Supabase Postgres (postgres.js) in production, PGlite locally and in tests. */
export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");
const g = globalThis as unknown as { __mwDb?: Promise<DB> };

/**
 * The app's database, opened once per process (and kept across dev hot reloads).
 * - `DATABASE_URL` set: Supabase Postgres through the transaction pooler. Migrations run at build time.
 * - unset: PGlite on disk in `.data/pg`, migrated on first open.
 */
export function getDb(): Promise<DB> {
  // a failed connection is not cached, so the next request retries
  return (g.__mwDb ??= connect().catch((e) => { g.__mwDb = undefined; throw e; }));
}

/**
 * A connection string as the driver wants it: no query string. Hosts add their own (`sslmode=require`,
 * Supabase's `supa=base-pooler.x`), and TLS is decided here, in code, not by the address.
 */
export const cleanDbUrl = (url: string | undefined) => { if (!url) return undefined; try { const u = new URL(url); u.search = ""; return u.toString(); } catch { return url; } };

/**
 * The runtime database: `DATABASE_URL`, or `POSTGRES_URL`, which Vercel sets by itself when a Supabase
 * database is added from the project's Storage tab.
 */
export const databaseUrl = (env: Record<string, string | undefined> = process.env) => cleanDbUrl(env.DATABASE_URL || env.POSTGRES_URL);

async function connect(): Promise<DB> {
  const url = databaseUrl();
  if (!url && process.env.VERCEL) throw new Error("No database: add a Supabase database from the Vercel project's Storage tab, or set DATABASE_URL to the Supabase pooler URL.");
  if (!url) return openPglite(process.env.PGLITE_DIR ?? ".data/pg");
  const [{ default: postgres }, { drizzle }] = await Promise.all([import("postgres"), import("drizzle-orm/postgres-js")]);
  // prepare: false is required by Supabase's transaction pooler (port 6543).
  // A hosted database is always reached over TLS; only a Postgres on this machine may go without.
  return drizzle(postgres(url, { prepare: false, max: 5, ssl: isLocal(url) ? false : "require" }), { schema }) as unknown as DB;
}

/** Is this connection string for a Postgres on this machine (a local test database)? */
export const isLocal = (url: string) => { try { return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname); } catch { return false; } };

/** A PGlite database with migrations applied. No `dataDir` means in-memory (tests). */
export async function openPglite(dataDir?: string): Promise<DB> {
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const db = drizzle(new PGlite(dataDir), { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}
