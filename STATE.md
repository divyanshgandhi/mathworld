# STATE: mathworld

_Updated 23 Nov 2026, 23:05 IST_

## What changed
- **Baseline committed:** `5788d64`. It holds the engine, the space world pack, the intro film, the Moon wave and the docs (SPEC, ROADMAP, tricks).
- **Phase 0 code complete:**
  - `src/db/schema.ts`:
    - `players` (uuid, name, avatar, worldId, createdAt, lastSeenAt)
    - an append-only `events` table (bigserial id, playerId foreign key, type, jsonb payload, createdAt), indexed on (playerId, id)
  - `drizzle/0001_events_append_only.sql`: a trigger rejects UPDATE, DELETE and TRUNCATE on `events`. RLS is enabled on both tables, so Supabase's REST API can't reach them.
  - `src/db/events.ts`: a zod contract for all 10 SPEC event types. Batches go up to 50. The server recomputes `correct` from a, b and guess.
  - `src/db/index.ts`, two drivers:
    - `DATABASE_URL` set: postgres.js with `prepare: false`, for the Supabase pooler.
    - unset: PGlite in `.data/pg`, migrated on first open. A failed connection is not cached, and on Vercel a missing URL fails with a clear error.
  - `src/db/store.ts`: createPlayer, findPlayer, touchPlayer, appendEvents, listEvents, hasEvent.
  - The API:
    - `GET`/`POST`/`DELETE /api/player`: resume, sign up and set an httpOnly `mw_cadet_id` cookie, switch cadet
    - `GET`/`POST /api/events`: read the log, append validated events
  - Deploy:
    - `vercel.json`: installs with Bun, then runs `node scripts/migrate.mjs && next build`
    - `.env.example`
    - deploy steps in the README

## What's verified
- `bun run check` passes: 15 tests, including PGlite in-memory database tests, the trigger refusing update, delete and truncate, server-side correctness, and the contract accepting and rejecting events.
- **Dev server (PGlite), checked with curl:**
  - no cookie gives null, and events without a cadet get a 401
  - bad input gets a 400
  - sign-up returns 201 with an httpOnly cookie, and resume works
  - a batch append returns 201, and an invalid type gets a 400
  - the log is ordered: the client claimed 3×8=23 was correct and the server stored false; 0×7=0 is stored as true
  - `introCompleted` flips once its event is logged, and switch cadet clears the cookie
- **Production path against a throwaway local Postgres 17:**
  - the migration runs twice, idempotently; both triggers and RLS are present
  - `next build` passes
  - `next start` with `DATABASE_URL`: sign-up sets an httpOnly, Secure cookie; events land in Postgres with server-computed `correct`; `/`, `/intro` and `/wave` return 200

## Next
- **Phase 0 deploy (needs Divyansh):**
  1. Create a Supabase project for Math World and hand over the two connection URLs. The CLI is signed in, but every existing project is paused.
  2. Push this repo to GitHub, import it in Vercel, set the env vars, deploy, then run the README smoke test.
- **Then Phase 1:** `src/rig/` (pools, errors, adaptive, tricks), `src/director/fold.ts`, and the 5-bot harness, with the output in `docs/levelling-proof.md`.

## Open risks
- The live deploy is blocked on the Supabase project and the Vercel import; both need account actions.
- The intro film is about 72 s and still says "…and you!". Trimming waits for Phase 4, by rule.
- Do a short `phonon-tts` Web Worker spike at the start of Phase 3.
