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

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (!url && process.env.VERCEL) throw new Error("DATABASE_URL is not set: add the Supabase pooler URL in the Vercel project settings.");
  if (!url) return openPglite(process.env.PGLITE_DIR ?? ".data/pg");
  const [{ default: postgres }, { drizzle }] = await Promise.all([import("postgres"), import("drizzle-orm/postgres-js")]);
  // prepare: false is required by Supabase's transaction pooler (port 6543)
  return drizzle(postgres(url, { prepare: false, max: 5 }), { schema }) as unknown as DB;
}

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
