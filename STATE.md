# STATE: mathworld

_Updated 23 Nov 2026, 23:30 IST_

## What changed
- **Commits:**
  - `5788d64` baseline
  - `e0920e2` Phase 0 (database, API, Vercel prep)
  - `d952818` ui-sdk wiring, deliberate by Divyansh
  - Phase 1 (this commit)
- **Phase 0:** done locally. The Vercel and Supabase deploy is deferred to the end, by Divyansh's call: all phases are built locally first.
- **Phase 1: the pure maths core and the levelling proof.**
  - `src/rig/pools.ts`: `tierOf(a, b)` puts each fact in one planet, so the pools are disjoint by construction.
    - Earth: ×0, ×1. Moon: ×2, ×5, ×10. Mars: ×3, ×4. Asteroid Belt: 6–9 × 6–9.
    - Jupiter: 2d×1d. Saturn: 2d×2d. Uranus: 3d × 1–2d.
    - Deep Space grows in sectors: 3d×3d, then 4d×2d, 4d×3d, and 5d×3d onward.
    - Random draws, with multi-digit sizes ramping up mission by mission.
  - `src/rig/errors.ts`: the error classifier (added_instead, off_by_one_group, place_value including a forgotten carry, off_by_one_unit, close and wild misses), and 4-choice Radar distractors.
  - `src/rig/adaptive.ts`:
    - EWMA mastery (m0 0.25, alpha 0.35) and the observation scores from SPEC
    - silent fast thresholds per tier
    - Gold, Mint, Sky and Slate bands
    - the solved, Gold and struggle rules
    - mission lengths and clear thresholds
  - `src/rig/tricks.ts`:
    - the `docs/tricks.md` router, applied verbatim
    - a beat compiler for all 10 tricks (full on first sight, a ≤2-beat replay after), each beat with a typed `Show` for the Phase 3 player
    - Flip It! runs first on tall fleets
    - Power-Up fit checks
    - every lesson asserts its parts add up to a × b
  - `src/director/fold.ts`: events become `PlayerState`, as a pure function.
    - It covers mastery per fact, mission progress, the Gold and probe streaks, struggles, the transfer queue and its rate, tricks seen, orbs and upgrades, and anti-mash.
    - It recomputes correctness and error types itself.
  - `src/director/next.ts`: the wave planner.
    - Precedence: Shield Recharge, then a due transfer check, then a Hyper-Jump probe, then the problem string (anchor → discovery → application → adaptive → boss; Earth is a 3-wave tutorial).
    - Also: `housekeeping` (planet clear), `acceptHyperJump`, and the `scaffold` escalation from SPEC 4.2.
  - `sim/`: five bots, a simulator, and the claims. `bun run proof` writes `docs/levelling-proof.md`.
  - The contract gains an optional `waveRole` on attempts, including `probe`.

## What's verified
- `bun run check` passes with 50 tests:
  - pools disjoint for every pair up to 120 × 120, and draws stay in their tier
  - the classifier and Radar
  - tricks compiled for every a × b from 0 to 99 × 99, plus samples up to 5d × 3d, in both full and replay mode; parts and the We-Do answer always equal a × b
  - fold and planner unit tests
  - all 12 levelling claims across 200 seeded runs per bot

## Decisions for Divyansh
1. **The router starves Split & Add and Jump One More.** Under `docs/tricks.md`'s "first match wins" order, rule 4 (Double It) catches 3×8, 6×8, 7×8 and 4×7. Split & Add is then reached only by 7×7, and every Split & Add and Jump example in the doc routes to Double It. Implemented as written. To change it, narrow rule 4 (for example, Double It only when the other factor is 2–4, or when the 2/4/8 is the per-squad count).
2. **Two levelling rules changed because the harness caught failures:**
   - **Hyper-Jump:** a third Gold must come from a probe of the planet being skipped. With plain "3 Golds → +2", the struggler jumped over Mars and the 5th-grader over Jupiter.
   - **Planet clear:** 3 of the 4 in-tier waves must be first-try own answers; Power-Ups count, Radar and Show Me How don't. With the spec's "≥3 of 5 without Show Me How", lucky Radar picks walked strugglers off their frontier.
   - Both are explained in `docs/levelling-proof.md`.
3. **Flashcards** don't affect mastery yet; they are telemetry only. That needs a decision when the Resting Bay is built (Phase 4).

## Next
- **Phase 2:** the playable core loop.
  - Base-10 ships: 1 Fighter, 10 Squadron Pod, 100 Carrier, 1K Dreadnought.
  - `/wave` becomes `WaveArena`, driven by `nextWave`, `scaffold` and `fold`:
    - keyboard and touch keypad (`inputMode="none"`), with 0 accepted as an answer
    - undershoot and overshoot shown in the world
    - the Radar and the anti-mash rule
    - the Power-Up belt
    - Sector-Lock for 2d × 2d and up
  - Events go to `/api/events`.

## Open risks
- The Vercel and Supabase deploy is deferred to the end. It needs a Supabase project and a Vercel import, both by Divyansh.
- The intro film is about 72 s and says "…and you!". Trimming waits for Phase 4, by rule.
- Do a short `phonon-tts` Web Worker spike at the start of Phase 3.
