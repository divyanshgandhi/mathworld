# STATE: mathworld

_Updated 23 Nov 2026, 22:50 IST_

## What changed
- **End-to-end documentation locked:**
  - `SPEC.md`: complete locked specification covering Title fly-through → auto cookie/DB routing → Resting Bay (Wall Times-Table Posters, Desk Trick Cards, Quick Flashcards, Space/Hangar/Academy doors) → trimmed ≤30s Classroom Intro + Captain's Briefing → Base-10 Ship Units (`1 / 10 / 100 / 1K`) & Sector Armada → Live Tactical Trick Power-Ups (`We Do`) → Embedded `Show Me How` (`I Do`) → Adaptive Rig + Problem-String Waves + Hyper-Jump → 2-layer Gradium Phonon voice → Event-sourced Supabase Postgres schema → `/admin` + `Shift+D` telemetry.
  - `docs/tricks.md`: all 9 kid-named trick scripts + deterministic trick router priority (`empty-mirror`, `fast-adding`, `flip-it`, `double-it`, `easy-5-10`, `jump-one-more`, `split-and-add`, `borrow-take-back`, `big-small-split`, plus `half-double`).
  - `ROADMAP.md` & `CLAUDE.md`: aligned around the Wednesday cut (Phases 0 → 6), pulling multi-digit Base-10 ships, Live Trick Power-Ups (`We Do`), Resting Bay, and 2-layer client-side Phonon into the core deliverable.
- **Previously scaffolded (unchanged):**
  - Next.js 16.4, React 19.3, TypeScript, Tailwind 4, Bun, Three.js 0.187, Vitest (dev on `:3200`).
  - `src/engine/` (stage, bloom, clay/toon/glow materials, camera, director, overlay, placeholder SFX).
  - `src/worlds/space/` (intro film, characters + Nova, classroom, town, Earth, rocket, invader, auto-playing Moon wave lookbook).
  - Routes: `/`, `/intro`, `/wave`.

## What's verified
- `bun run check` passes (`next typegen`, `tsc`, `eslint`, 7 Vitest tests).
- `/intro` and `/wave` render in Three.js with zero console errors.

## Next (Start Here — Strictly In Order!)
1. **Phase 0 (Immediate):** Commit the baseline, add Drizzle + Supabase Postgres (PGlite local/test) with `players` + append-only `events`, wire `/api/player` & `/api/events`, and deploy to Vercel.
2. **Phase 1:** Build `src/rig/` (`pools.ts`, `errors.ts`, `adaptive.ts`, `tricks.ts`) + `src/director/fold.ts` + 5-bot Vitest simulation harness (`tests/rig.test.ts` → `docs/levelling-proof.md`).
3. **Phase 2:** Build Base-10 ships (`1 / 10 / 100 / 1K`) in `ships.ts` and turn `/wave` into the playable core loop (keyboard + touch keypad, `0` valid, undershoot/overshoot, Radar scaffolding, Live Trick Power-Ups `We Do`, Sector-Lock for `2d×2d`+).
4. **Phase 3:** Wire 2-layer Gradium Phonon (`public/vo/` pre-baked intro + client Web Worker `phonon-tts`) and the embedded in-world `Show Me How` (`I Do`) beat player.
5. **Phase 4:** Wire Title fly-through (`/`), auto cookie/DB routing, Resting Bay (`/bay`), Scrollable Solar System Map (`/map`), Hangar (`/hangar`), Academy (`/academy`), and trimmed ≤30s Intro + Captain's Briefing.
6. **Phase 5–6:** `/admin` + `Shift+D` telemetry, real-kid testing (3–5 kids + 1 adult), top fixes, README, ship.

## Open risks
- No git commits yet — commit baseline as the very first action of Phase 0.
- Intro film is currently ~72s and says "…and you!" instead of the player's name; trim to ≤30s and add Captain's briefing in Phase 4 (not before Phases 0–3 are live).
- Run a quick 10-minute `phonon-tts` Web Worker spike (Next.js 16 Turbopack + Chrome/Safari) at the start of Phase 3.
