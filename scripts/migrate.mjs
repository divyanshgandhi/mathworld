// Applies drizzle/ migrations to the hosted database. Runs in the Vercel build (see vercel.json).
// Plain ESM so it runs under Node or Bun. Locally, with no database address, the app uses PGlite and
// migrates itself on first open, so this script has nothing to do.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// Our own names first, then the ones Vercel sets when a Supabase database is added from the Storage tab.
// A migration address comes before a runtime one; if it cannot be reached from the build machine
// (a direct address can be IPv6 only), the next one is tried.
// Vercel's own names count only on Vercel, so settings pulled to a laptop never reach the live database.
const env = process.env;
const hosted = env.VERCEL ? [env.POSTGRES_URL_NON_POOLING, env.POSTGRES_URL] : [];
const candidates = [env.MIGRATION_DATABASE_URL, hosted[0], env.DATABASE_URL, hosted[1]].filter(Boolean);
if (candidates.length === 0) {
  console.log("migrate: no database address, skipping (local dev uses PGlite).");
  process.exit(0);
}

// The query string is dropped: hosts add their own parameters, and TLS is decided below.
const clean = (raw) => { try { const u = new URL(raw); u.search = ""; return u.toString(); } catch { return raw; } };
const where = (url) => { try { const u = new URL(url); return `${u.hostname}:${u.port || 5432}`; } catch { return "the database"; } };
const isLocal = (url) => { try { return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname); } catch { return false; } };
const UNREACHABLE = new Set(["ENETUNREACH", "EHOSTUNREACH", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "ECONNREFUSED", "CONNECT_TIMEOUT"]);

const urls = [...new Set(candidates.map(clean))];
for (const [i, url] of urls.entries()) {
  // A hosted database is always reached over TLS; only a Postgres on this machine may go without.
  const sql = postgres(url, { max: 1, prepare: false, ssl: isLocal(url) ? false : "require", connect_timeout: 20, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
    console.log(`migrate: database is up to date (${where(url)}).`);
    await sql.end();
    process.exit(0);
  } catch (err) {
    await sql.end({ timeout: 2 }).catch(() => {});
    // the driver's error may be wrapped: look down the chain of causes for its code
    let code; for (let e = err; e && !code; e = e.cause) code = e.code ?? e.errno;
    const last = i === urls.length - 1;
    if (last || !UNREACHABLE.has(code)) throw err;
    console.log(`migrate: could not reach ${where(url)} (${code}); trying the next address.`);
  }
}
