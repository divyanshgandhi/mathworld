# Math World

A multiplication game where the answer is the action. Invaders arrive in squadrons and you load one cannonball for each. Load too many and the extras fly past; load too few and invaders are left standing. Every miss explains itself, and Nova, your co-pilot, shows you the trick, inside the world.

## Run it

```bash
bun install
bun run dev      # http://localhost:3200
bun run check    # route types, typecheck, lint, tests
```

- `/intro`: the opening film. Earth, an ordinary Tuesday, waking up in class, two quick questions, the knock, cadet selected.
- `/wave`: a Moon wave in the Math World look. Click it once for sound.
- In the browser console, `window.__mw.stage.step(seconds)` advances time by hand, and `window.__mw.intro.jump("knock")` jumps to a chapter.

Locally the database is PGlite in `.data/pg`, created and migrated on first use (delete the folder to start fresh). Set `DATABASE_URL` to use Postgres instead.

## API

| Route | What |
|---|---|
| `GET /api/player` | The cadet behind the `mw_cadet_id` cookie, plus `introCompleted`, or `{ player: null }` |
| `POST /api/player` | Sign up `{ name, avatar }`; creates the cadet and sets the cookie (httpOnly) |
| `DELETE /api/player` | Switch Cadet: forgets the cookie; the history stays |
| `POST /api/events` | Append one event or `{ events: [...] }` (up to 50), validated by `src/db/events.ts`; correctness is recomputed on the server |
| `GET /api/events` | The cadet's log, oldest first |

The `events` table is append-only: a database trigger rejects `UPDATE`, `DELETE` and `TRUNCATE`.

## Deploy (Vercel + Supabase)

1. **Supabase:** create a project. From *Connect*, copy the **transaction pooler** URL (port 6543) as `DATABASE_URL`. Optionally copy the **session pooler** URL (port 5432) as `MIGRATION_DATABASE_URL`.
2. **Vercel:** import the GitHub repo (it's detected as Next.js), and add both variables for Production and Preview. `vercel.json` installs with Bun and runs `scripts/migrate.mjs` before `next build`, so every deploy migrates the database first.
3. **Smoke test:**
   ```bash
   curl -c jar -X POST -H 'content-type: application/json' -d '{"name":"Test"}' https://<app>/api/player
   curl -b jar -X POST -H 'content-type: application/json' -d '{"type":"intro_completed"}' https://<app>/api/events
   curl -b jar https://<app>/api/player   # introCompleted: true
   ```

## How the code is laid out

| Path | What |
|---|---|
| `src/engine/` | Shared by every world. `stage` (renderer, bloom, colour grade, loop), `materials` (the clay, toon and glow material base, plus builder helpers), `camera` (cuts and glides), `director` (steps of a film), `overlay` (captions, titles, fades, eyelids, choices), `sound` (placeholder effects). |
| `src/worlds/space/` | The space world pack: `cast` (characters and Nova), `classroom`, `town`, `earth`, `ships` (rocket and invader), `intro` (the film), `wave` (the Moon wave). |
| `src/components/` | Thin React components that mount a scene and draw the controls around it. |
| `src/db/` | Drizzle schema (`players`, append-only `events`), the event contract (zod), the dual driver (Supabase Postgres or PGlite), and the store functions. |
| `src/app/api/` | Thin route handlers for `player` and `events`. |
| `drizzle/` | SQL migrations (generated, plus the append-only trigger and RLS). |
| `tests/` | Vitest tests for the pure parts. |

## Docs
- `SPEC.md`: the locked end-to-end product, pedagogy, visual unit, audio, and database specification.
- `ROADMAP.md`: the phased execution plan from 0 to 1, with the numbers we track.
- `docs/tricks.md`: the kid-named trick scripts and deterministic router.
- `design/lookbook/`: the original single-file prototypes, for reference only.
