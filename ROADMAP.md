# Math World — Execution Roadmap (0 → 1)

This roadmap sequences the build of [SPEC.md](./SPEC.md) by what is load-bearing.
**Core rule:** Freeze all further intro/art polish until **Phase 0 (DB + Vercel)**, **Phase 1 (Rig + Simulation)**, **Phase 2 (Playable Single + Multi-Digit Wave + Power-Ups)**, and **Phase 3 (Show Me How + Phonon Voice)** are live and verified.

---

## North-Star Numbers We Measure

| Metric | Why it matters | Target |
|---|---|---|
| **Post-explanation transfer accuracy** | Accuracy on a sister problem using the same trick 2 waves after `Show Me How` / Power-Up | Rise from ~50% before to **> 75%** after |
| **Placement accuracy (5 simulated bots)** | Proves adaptive leveling + Hyper-Jump works for kids and adults | All 5 bot profiles converge within **≤ 15 questions**, 0 tier leaks |
| **Day-2 voluntary return** | Do real kids want to come back without being asked? | 3 of 5 test kids |

---

## Architecture Contract (Shared Skeleton vs. Space World Pack)

| Layer | Owns | Path | Shared? |
|---|---|---|---|
| **Rig** | Disjoint planet pools, Problem-String waves, EWMA per-fact mastery, Hyper-Jump, error classifier, deterministic trick beat compiler (`docs/tricks.md`) | `src/rig/` | Yes (pure TS + Vitest) |
| **Director** | Event-log fold (`events[] → PlayerState`), next-wave selection, scaffolding escalation, transfer queue | `src/director/` | Yes (pure TS + Vitest) |
| **Data** | Drizzle schema (`players`, append-only `events`), Supabase Postgres in prod, PGlite locally & in tests | `src/db/` | Yes |
| **Stage & Voice** | Three.js renderer (`stage`, `camera`, `materials`, `director`, `overlay`), procedural SFX (`sound`), **2-layer Gradium Phonon** (`voice.ts`: pre-baked `public/vo/` + client-side `phonon-tts` Web Worker) | `src/engine/` | Yes |
| **Space World Pack** | `1 / 10 / 100 / 1K` ships, Hangar cosmetics, Solar System planets, Nova co-pilot, Classroom intro, Resting Bay, Academy | `src/worlds/space/` | Per-world |
| **App Routes** | Thin Next.js 16 pages & API handlers (`/`, `/intro`, `/bay`, `/map`, `/play/[planet]`, `/hangar`, `/academy`, `/admin`) | `src/app/` | Thin shell |

---

## The Wednesday Cut (Phases 0 → 6)

Commit cleanly after every completed phase (`bun run check` green before each commit).

### Phase 0 — Commit Baseline, Database & Live Vercel Deploy
- Make initial baseline commit of the scaffolded engine, intro, and Moon wave lookbook.
- Add Drizzle ORM + `pg`/`postgres` (Supabase Postgres) + `@electric-sql/pglite` (local/test).
- Implement `src/db/schema.ts` (`players`, append-only `events`) + `src/db/index.ts` (dual driver: `DATABASE_URL` → Supabase Postgres, local fallback → PGlite).
- Implement `/api/player` (create/resume via `mw_cadet_id` cookie) and `/api/events` (zod-validated append-only event writer).
- Deploy to Vercel with Supabase connected right now so every subsequent phase deploys live.
- **Done when:** Deployed Vercel URL loads, creates a player cookie, persists an event in Supabase, and `bun run check` passes.

### Phase 1 — Pure Math Rig, Event Fold & 5-Bot Simulation Proof (`src/rig/`, `src/director/`)
- Build `src/rig/pools.ts`: strictly disjoint pools `T0` (`×0,×1`) through `T7+` (`3d×3d` → `5d×3d` unbounded). Assert `pool(Ti) ∩ pool(Tj) === ∅`.
- Build `src/rig/errors.ts`: 5-type error classifier (`added_instead`, `off_by_one_group`, `off_by_one_unit`, `place_value`, `undershoot_close` / `overshoot_close` / `wild_guess`) + smart 4-choice Radar distractor generator.
- Build `src/rig/adaptive.ts` & `src/director/fold.ts`:
  - Per-fact EWMA mastery over canonical commutative pairs (`min(a,b)xMax(a,b)`).
  - Tier-scaled silent speed thresholds (`You Do` Gold vs. `We Do` Mint vs. `I Do` Practice).
  - 5-Wave **Problem-String Mission** generator (Anchor → Discovery → Application → Adaptive/Transfer → Boss).
  - **Hyper-Jump** (3 consecutive unassisted Gold shots offers jump `+2` planets for fast kids/adults) + **Gentle Cushion** (2 consecutive misses injects anchor shield-recharge wave).
- Build `src/rig/tricks.ts`: Deterministic trick router & beat compiler implementing all tricks in [docs/tricks.md](./docs/tricks.md) (`empty-mirror`, `fast-adding`, `flip-it`, `double-it`, `easy-5-10`, `jump-one-more`, `split-and-add`, `borrow-take-back`, `big-small-split`, `half-double`). Assert every trick's partial products equal `a × b` across `0–999 × 0–99` fuzz tests.
- Build `tests/rig.test.ts` + generate `docs/levelling-proof.md`: simulate 5 bot profiles (`struggling-3rd-grader`, `average-5th-grader`, `adult-speedrunner`, `random-masher`, `trick-learner`) and assert placement within ≤ 15 questions.
- **Done when:** All unit tests + 5-bot simulation harness pass in Vitest and `docs/levelling-proof.md` is generated.

### Phase 2 — Playable Core Loop, Base-10 Multi-Digit Ships & Live Trick Power-Ups (`We Do`)
- Extend `src/worlds/space/ships.ts` with the **4-Tier Base-10 Ship Taxonomy**:
  - `makeInvader` (`1` Fighter)
  - `makeTenSquadPod` (`10` Squadron Pod visibly holding `2 × 5` individually poppable micro-fighters + `10` emblem)
  - `makeCarrier` (`100` Carrier with 10 glowing cyan strips + `100` emblem)
  - `makeDreadnought` (`1,000` / `10K` Flagship core)
  - Live Hangar upgrade styling hooks on `makeRocket` (hull paint, blaster FX, thruster trail).
- Turn `src/worlds/space/wave.ts` + `src/components/WaveArena.tsx` into the full playable battle engine:
  - Desktop keyboard (`0–9`, `Backspace`, `Enter`) + touch cockpit keypad (`inputMode="none"` so mobile OS keyboard never covers the 3D arena). **`0` must be a valid answer!**
  - Explicit axis labels (`3 squads` left, `8 fighters each` top).
  - Physical firing outcomes: **Undershoot** (remaining ships/micro-fighters stay hovering & winking + exact remaining count), **Overshoot** (saturates fleet + `+N` extra orange plasma balls visibly shoot past into space + shield reset), **Exact** (wave clear + bloom burst + Orbs).
  - Anti-mash volley lock (~500ms) + Nova calming nudge on 3 wild guesses in `< 4s`.
  - Progressive scaffolding: Close miss → 1-line error-classified Nova nudge; Way-off (`> 35%`) or `> 10s` idle → 4-choice **Targeting Radar** slides in; Miss #2 → warm invite to Trick Power-Up / Radar / Show Me How.
  - **Live Tactical Trick Power-Up Belt (`We Do`):** Free, unlimited buttons for unlocked tricks that physically rotate (`Flip It!`), laser-slice (`Split & Add`, `Big & Small Split`), project dashed ghost invaders (`Borrow & Take Back`), or highlight halves (`Double It!`) on the live 3D fleet *without giving away the answer* — plus **Sector-Lock Mode** on `2d×2d` through `5d×3d`!
  - Every action persists to `/api/events`.
- **Done when:** You can play Earth (`×0,×1`), Moon (`3×4`), Asteroid Belt (`3×8`, `4×9`), Jupiter (`6×24` Ten-Squads + Fighters), and Saturn (`24×16` 4-Sector Armada) end-to-end on desktop and mobile with live Power-Ups and events stored in Supabase.

### Phase 3 — Embedded In-World `Show Me How` (`I Do`) & 2-Layer Gradium Phonon Voice
- **Phonon Spike + Integration (`src/engine/voice.ts`):**
  - Pre-bake static intro, Captain briefing, and core fixed Nova quips locally via Phonon into `public/vo/` + `public/vo/vo.json`.
  - Wire client-only (`"use client"`) `phonon-tts` Web Worker that silently warms and caches in `Cache API` during the Title Screen / Intro (verify COOP/COEP headers & Chrome + Safari compatibility; never import in SSR or API routes).
  - Predictive pre-fetch of Beat 1 while the player is thinking; strict Web Audio cancellation on step/exit so lines never overlap. Always-on synced captions.
- **In-World `Show Me How` Beat Player:**
  - Runs directly over the live 3D fleet (dimmed background, smooth camera push-in, Nova hovering & lip-syncing).
  - First time seeing a trick (`seenCount === 0`): full paced beats from `docs/tricks.md` (with Card Name banner + explicit *WHY*) ending on interactive **We-Do** final tap → unlocks Trick Card + Power-Up!
  - Repeat (`seenCount >= 1`): ≤ 8-second Fast Replay + We-Do tap.
  - Early-level safety net: drops to **Fast Adding** if stuck after a trick.
- **Done when:** Every trick in `docs/tricks.md` plays visually + vocally over the live 3D fleet, unlocks onto the Tactical Belt, shortens cleanly on repeat, and logs transfer checks.

### Phase 4 — Title Screen, Auto-Routing, Resting Bay, Solar System Map, Hangar & Trimmed Intro
- **Title Screen (`/`):** 3D Sun + orbiting planets fly-through, **`MATH WORLD`** title, single **`Start Game`** CTA (unlocks audio + starts Phonon Web Worker).
- **Auto-Magic Cookie + DB Routing:**
  - Returning player (`introCompleted === true`) → directly to **Resting Bay (`/bay`)** (no intro replay, no skip button clutter).
  - New player → 1-card Name + Avatar sign-up → trimmed **≤ 25–30s Intro Film (`/intro`)** calling **`[Player's Name]!`** → **Captain's exact briefing** → Level 0 (`×0,×1`) → emits `intro_completed`.
- **Resting Bay (`/bay`):**
  - **Wall Times-Table Posters (`×1–×10`):** live color-coded from event-folded mastery (dim / sky / mint / gold).
  - **Desk:** Collected Trick Cards (click to launch Academy trick walkthrough) + **Quick Flashcards** (5-card low-pressure recall deck).
  - **Three Doors:** **Launch to Space (`/map`)**, **The Hangar (`/hangar`)**, **The Academy (`/academy`)**, plus a subtle **Switch Cadet** link in the corner.
- **Scrollable Solar System Map (`/map`):** Mercury (quick Addition warmup), Venus (quick Subtraction warmup), Earth → Moon → Mars → Asteroid Belt → Jupiter → Saturn → Uranus → Deep Space, centered on current frontier planet, with Hyper-Jump status.
- **The Hangar (`/hangar`):** Spend permanent Orbs on 3 live-rendered ship upgrade slots (Hull Paint, Blaster FX, Thruster Trail) immediately visible in battle.
- **The Academy (`/academy`):** Reuses the single parameterized Beat Player to watch/practice any of the 9 Trick Films on demand.
- **Done when:** Both new-player and returning-player flows work cleanly on the deployed Vercel URL across page refreshes.

### Phase 5 — Telemetry, `/admin`, Real-Kid Testing & Iteration
- Add hidden **`Shift+D` Live Telemetry X-Ray** drawer (per-fact EWMA, active error type, transfer queue, live Transfer Rate).
- Build `/admin` dashboard: per-player Fact Mastery heatmap, Post-Explanation Transfer Rate, event timeline, and Day-2 return status.
- Test on the live Vercel URL with **3–5 real kids (age 8–12) + 1 adult**, watching silently. Fix the top 3 friction points discovered from real play and log before/after changes.
- **Done when:** Real-kid field notes and transfer-rate results are verified in `/admin` and documented in `README.md`.

### Phase 6 — Polish, Optional "Talk to Nova" & Ship
- *(Optional stretch, ONLY if Phases 0–5 are 100% green and kid-tested)*: Add **Talk to Nova** comms drawer (`/api/nova` streaming 6 validated Stage Tools → existing Beat Player + `phonon-tts`).
- Update `README.md` with architecture, pedagogy choices, 5-bot leveling proof, real-kid test results, and what's next.
- Final `bun run check`, `bun run build`, and live Vercel smoke test on desktop + phone.

---

## After Wednesday (Post-v1 Expansion)
- **Second & Custom Worlds (`WorldPack` plugin):** Add Dragon Kitchen / Dino Island / Custom Interest world swapping only `src/worlds/<slug>/` with zero changes to `src/rig/`, `src/director/`, or `src/db/`.
- **Division Supply Runs:** Inverse formations reusing the exact same Base-10 fleet engine.
- **Full Audio Mastering & Mobile 60fps Budget Pass:** InstancedMesh batching for large squadrons and layered adaptive music.
