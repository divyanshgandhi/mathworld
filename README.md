# Math World

A space multiplication game where the answer is the action. Invaders fly in as `a` squads of `b`, and you load one plasma ball for each ship. Load too few and the ships that are left keep flying; load too many and the extras fly past into space. Every miss explains itself, and Nova, your co-pilot, shows you the trick inside the world. It works for a Grade 3 cadet on `0 × 7` and for an adult on `343 × 4,536`.

## Run it

```bash
bun install
bun run dev      # http://localhost:3200
bun run check    # route types, typecheck, lint, tests
bun run build    # production build
bun run proof    # regenerate docs/levelling-proof.md from the bot harness
```

Locally the database is PGlite in `.data/pg`, created and migrated on first use (delete the folder to start fresh). Set `DATABASE_URL` to use Postgres instead. `NEXT_PUBLIC_MW_MUTE=1`, `?mute` or `localStorage["mw:mute"] = "1"` silences all audio while everything still paces on the baked clip lengths.

### What a new cadet plays

1. **`/` Title:** the Solar System fly-by, `MATH WORLD`, one **Start Game**. It unlocks sound and warms the voice worker. A new cadet signs up on one card (name + colour); a returning cadet goes straight to the Resting Bay.
2. **`/intro` Opening film (about 2 minutes):** Earth, an ordinary Tuesday in class, two quick questions (raise your hand with Space), the knock, the Captain, the cadet called by name (spoken live), the hangar briefing, Nova, ignition.
3. **Cadet Bay (Level 0, Earth):** three waves of `×0` and `×1` on the battle engine, ending with the first Trick Card, Empty & Mirror.
4. **`/bay` Resting Bay:** the cadet's cabin. Times-table posters `×1`–`×10` light up from mastery, the desk holds Trick Cards and Quick Flashcards, and three doors lead to the map, the Hangar and the Academy.
5. **`/map` Solar System:** Mercury and Venus (addition and subtraction warm-ups), then Earth → Moon → Mars → Asteroid Belt → Jupiter → Saturn → Uranus → Deep Space.
6. **`/play/<planet>` Battles:** five-wave missions; **`/hangar`** spends Orbs on hull paint, blaster and thruster (seen in the next battle); **`/academy`** replays any Trick Film on a canonical fleet.

Dev tools: `/?dev` lists every planet and exact drills (`/play/moon?dev&a=10&b=8`); `?dev` on a battle shows shot timings and unlocks every Power-Up; `/intro?dev` has a chapter dock. In the console, `window.__mw.stage.paused = true` plus `window.__mw.stage.step(s)` steps frames by hand.

## Architecture

| Layer | Path | What it owns |
|---|---|---|
| **Rig** (pure TS) | `src/rig/` | Disjoint planet pools, the error classifier and Radar distractors, per-fact EWMA mastery, the Base-10 fleet (`fleet.ts`), the trick router and beat compiler (`tricks.ts`), the Show Me How planner and shot budget (`showme.ts`), Academy films, warm-ups |
| **Director** (pure TS) | `src/director/` | `fold(events) → PlayerState`, next-wave selection (Problem Strings, Hyper-Jump probe, Shield Recharge, transfer checks), hub read-outs (posters, map stops, flashcards), the Hangar catalogue, telemetry |
| **Data** | `src/db/` | Drizzle schema (`players`, append-only `events` with a trigger that rejects `UPDATE` / `DELETE` / `TRUNCATE`), the zod event contract, the dual driver (Postgres or PGlite) |
| **Engine** | `src/engine/` | `stage` (renderer, bloom, grade, loop), `materials`, `camera`, `director` (steps of a film), `overlay` (text-only captions, cards, fades), `audio` (baked clips, SFX, mood beds), `voice` (live Phonon in a Web Worker), `beatPlayer`, `outbox` (event queue to `/api/events`) |
| **Space world pack** | `src/worlds/space/` | The intro film, the battle engine (`arena.ts`), ships (Fighter, Ten-Squad Pod, Carrier, Dreadnought), Nova and the cast, the Resting Bay, map, Hangar bay, skies, Nova's lines |
| **App** | `src/app/`, `src/components/` | Thin Next.js 16 routes; React draws the HUD (ui-sdk controls) over a full-screen stage |

**Event-sourced.** Every player action (`attempt_submitted`, `powerup_used`, `explanation_started` / `completed`, `orb_earned`, `upgrade_purchased`, `hyper_jump_taken`, …) is appended to `/api/events`; correctness is recomputed on the server. All state, from tier and mastery to Orbs and the Hangar, is `fold(events)`. Nothing mutable drifts from the log.

**Code owns the maths.** Every partial product, split and answer comes from `src/rig/` and is asserted by Vitest (`tests/rig.test.ts` fuzzes every trick across `0–999 × 0–99`). Words come from `docs/tricks.md`; nothing is generated at runtime.

**Voice.** Fixed lines are baked with Gradium Phonon into `public/vo/` (`scripts/bake-voices.py`, voices: Teacher, Captain, Nova, Principal, a kid). Lines with numbers or names are spoken live by `phonon-tts` in a browser Web Worker, never on the server. Dialogue paces on each clip's real speech end plus a short breath, so lines never cut each other off. Captions are text only.

### API

| Route | What |
|---|---|
| `GET /api/player` | The cadet behind the `mw_cadet_id` cookie, plus `introCompleted`, or `{ player: null }` |
| `POST /api/player` | Sign up `{ name, avatar }`; creates the cadet and sets the cookie (httpOnly) |
| `DELETE /api/player` | Switch Cadet: forgets the cookie; the history stays |
| `POST /api/events` | Append one event or `{ events: [...] }` (up to 50), validated by `src/db/events.ts` |
| `GET /api/events` | The cadet's log, oldest first |
| `POST /api/admin/session` | The `/admin` passphrase (see Telemetry) |

## Pedagogy choices

- **The answer is the action.** The fleet is laid out as `a` rows × `b` columns with both axes named ("3 squads", "8 each"), and the big `a × b` plate is always the most prominent thing on screen. An undershoot leaves the exact remainder flying; an overshoot sends the extras past. The cadet sees the size of the error, not just a red cross.
- **I Do → We Do → You Do.** *Show Me How* (I Do) walks a named trick over the live fleet and ends on the cadet's own shot. Then the trick sits on the Tactical Belt as a free Power-Up (We Do) that slices, flips or ghosts the fleet without revealing the answer. Fast, unaided answers light a fact Gold (You Do).
- **Kid-named tricks, routed deterministically** (`docs/tricks.md`): Empty & Mirror, Fast Adding, Flip It!, Double It!, Easy 5s & 10s, Jump One More, Split & Add, Borrow & Take Back, Big & Small Split (Sector-Lock on 2-digit × 2-digit and up), Half & Double. They follow Bay-Williams and Kling's foundational → derived → mastery sequence, and missions are Pam Harris-style Problem Strings (anchor → discovery → application → transfer → boss).
- **Escalation without nagging.** A close miss gets one short line naming the error (added instead, one squad off, place value, …). A way-off miss or 10 s of hesitation slides in a 4-choice Radar. The second miss invites a Power-Up, the Radar or Show Me How, and the third starts Show Me How. Three wild guesses in a row get a calm "Hold fire".
- **No punishment, no streaks, no timers on screen.** Orbs are never lost; progress only ratchets up.
- **Base-10 ships.** 10 is a Pod, 100 a Carrier, 1,000 a Dreadnought, so `24 × 16` is a few dozen ships, not 384, and place value is visible.
- **The shot budget.** No shot takes more than 10 s from fire to ready again: volleys are capped at ~1.8 s, Nova says one short line, and a first in-battle lesson fits in 10 s (a repeat in 8 s). `shotSeconds()` in `src/rig/showme.ts` is tested for every fact up to 12 × 12. Measured in the browser: correct shots 2–4 s, a third miss plus its lesson about 6.5 s.
- **Transfer is the metric.** Two waves after a trick is explained, the director serves a sister problem with the same trick. The telemetry compares first-try accuracy before and after the explanation.

## Levelling proof

`bun run proof` plays 200 seeded runs of 5 bot profiles, 30 questions each, through the real fold and director (`sim/`). The same claims are asserted in `tests/levelling.test.ts`. Full report: `docs/levelling-proof.md`.

| Bot | Result |
|---|---|
| Struggling 3rd grader (knows ×0, ×1, ×2, ×5, ×10) | On Mars, its real frontier, at question 15 in 93.5% of runs; never beyond the Asteroid Belt |
| Average 5th grader (all single-digit facts) | On Jupiter (2-digit × 1-digit) at question 15 in 92.5% of runs |
| Adult speedrunner | Multi-digit by question 10 in 91% of runs; Uranus or Deep Space by question 15 in 89% |
| Random masher | Never beyond the Moon; always gets the anti-mash nudge and Shield Recharge waves |
| Trick learner (stuck on hard ×9) | Needs Show Me How on ×9 (95.5%), then passes the transfer check (90%) and moves past the Asteroid Belt by question 30 (98%) |

The harness changed three rules: a Hyper-Jump must pass a Gold probe from the planet it would skip, planets clear on first-try answers only (Radar picks and Show Me How do not count), and Deep Space keeps growing in new sectors.

## Telemetry and testing

- **X-Ray:** in any battle, **Shift+D** opens the Live Telemetry X-Ray (per-fact EWMA, the error in play, the transfer-check queue, the session and all-time Transfer Rate). It is not linked anywhere.
- **`/admin`:** the testing dashboard, not linked from the game. Set `MW_ADMIN_KEY` (10+ characters) on the server, open `/admin` and enter it (a hash goes into an httpOnly cookie scoped to `/admin`; **Lock** clears it), or pass `?key=` once. With no key set, `/admin` is off. It shows every cadet's transfer rate and Day-2 return, and per cadet the 0–10 mastery heatmap, planet progress, rates by trick, sessions and the event timeline.
- **Protocol:** `docs/test-protocol.md` covers how to run 3–5 kids (8–12) and 1 adult silently, what to watch and log, and how to read `/admin` before and after.

## Field notes

_To be written after the real-kid sessions (Phase 5). For each session: the date, the testers (age only, no names), the top 3 friction points and what changed for each (before → after), and the `/admin` numbers before and after: transfer checks, first try before → after a lesson, and Day-2 returns._

| Date | Testers | Top friction points | Fix (commit) | Transfer checks | Before → after a lesson | Day-2 returns |
|---|---|---|---|---|---|---|
| | | | | | | |

## Deploy (Vercel + Supabase)

1. **Supabase:** create a project. From *Connect*, copy the **transaction pooler** URL (port 6543) as `DATABASE_URL`. Optionally copy the **session pooler** URL (port 5432) as `MIGRATION_DATABASE_URL`.
2. **Vercel:** import the GitHub repo (it's detected as Next.js), and add both variables for Production and Preview (plus `MW_ADMIN_KEY` to turn on `/admin`). `vercel.json` installs with Bun and runs `scripts/migrate.mjs` before `next build`, so every deploy migrates the database first.
3. **Smoke test:**
   ```bash
   curl -c jar -X POST -H 'content-type: application/json' -d '{"name":"Test"}' https://<app>/api/player
   curl -b jar -X POST -H 'content-type: application/json' -d '{"type":"intro_completed"}' https://<app>/api/events
   curl -b jar https://<app>/api/player   # introCompleted: true
   ```

## What's next

1. **Real kids.** Run `docs/test-protocol.md` with 3–5 kids and an adult, fix the top 3 friction points, and fill in Field notes with the `/admin` numbers.
2. **Deploy and smoke-test on a phone,** including Safari and touch (not yet done), with sound on.
3. **Polish:** the Resting Bay is a small diorama on narrow and 4:3 screens; Orbs can be farmed through warm-ups and flashcards; `/admin` reads every event on each load.
4. **Stretch:** *Talk to Nova* (SPEC §8), then a second world pack (only `src/worlds/<slug>/` changes) and division supply runs on the same fleet engine.

## Docs

- `SPEC.md`: the product, pedagogy, visual unit, audio and database specification.
- `ROADMAP.md`: the phased plan from 0 to 1, with the numbers we track.
- `docs/tricks.md`: the kid-named trick scripts and the deterministic router.
- `docs/levelling-proof.md`: the bot harness report.
- `docs/test-protocol.md`: the silent real-kid test and how to read `/admin`.
- `design/lookbook/`: the original single-file prototypes, for reference only.
