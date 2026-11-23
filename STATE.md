# STATE: mathworld

_Updated 24 Nov 2026, 00:20 IST_

## What changed
- **Commits:** `5788d64` baseline · `e0920e2` Phase 0 · `d952818` ui-sdk · `6802a1c` Phase 1 rig · `2067f26` intro + Level 0 · `a57d1b3` game shell, a × b HUD, no battle glow, short volleys · rig fixes from the owner's Phase 0–1 review (this commit).
- **Rig fixes (owner's four decisions):**
  1. Trick router (`src/rig/tricks.ts`, `docs/tricks.md`): Double It is ×2 and ×4 only (the ×8 script is gone). Jump One More is ×6, near squares (|a − b| = 1) or 3 × (≤ 7). Now 3×8, 7×7, 8×8 → Split & Add; 6×7, 7×8, 6×8 → Jump One More. `anchorOf` and `powerUpFits` follow.
  2. Both levelling changes kept (Hyper-Jump needs a Gold probe of the planet being skipped; planet clear = 3 of 4 in-tier waves first-try own answers). SPEC §5.4 now says exactly that; ROADMAP's one-liner points to it.
  3. Flashcards: a correct card within the fact's fast threshold nudges mastery (alpha 0.18 toward 0.78, never lowering it) and counts as a fast win, so a Mint fact at m ≥ 0.82 turns Gold. No effect on missions, clears or Hyper-Jump streaks. SPEC §4 and §5.3 synced.
  4. Deep Space: `planet_cleared` at the last tier now advances `mission.n` instead of resetting it, so missions never repeat and sectors ramp 3d×3d → 4d×2d → 4d×3d → 5d×3d. Application and transfer sister draws now use the mission's ramp too. `docs/levelling-proof.md` regenerated with a note on this.

## What's verified
- `bun run check` green: 53 tests. New: router routes and ranges for 0–10 × 0–10; parts still sum to a × b for every 0–99 × 0–99; flashcard nudge (Mint → Gold, state otherwise identical, slow or wrong cards ignored); five consecutive Deep Space missions with distinct anchors and goals, `mission.n` 0→4, sectors [0, 1, 2, 3, 3]. The Deep Space test fails on the old fold.
- `bun run proof`: 12/12 claims hold. The adult's Deep Space run now ramps (389 × 135 / 675 × 778, then 98 × 4226, then 507 × 6870, boss 343 × 43536).
- Browser: `/wave` loads on the dev server after hot reload. These are rig-only changes. No battle that reaches the new routes (×8 facts, Deep Space) was played; that UI does not exist yet.

## Next
- **Shot length (the owner's latest ask):** no single shot may take more than 5–10 s end to end. ×10 facts in Level 1 (Moon) feel too long right now. Measure fire → outcome → Nova line → ready, and cut there (volley cap, Base-10 pods for ×10, shorter Nova lines). Not touched in this rig pass.
- **Phase 2:** the playable core loop. Base-10 ships, `WaveArena` driven by `nextWave` / `scaffold` / `fold`, keypad with 0, Radar and anti-mash, Power-Up belt, Sector-Lock, events to `/api/events`.
- **Phase 4:** the Resting Bay flashcard deck must post `flashcard_answered` with `latencyMs` so the nudge works.

## Open risks
- The Vercel and Supabase deploy is deferred to the end. It needs a Supabase project and a Vercel import, both by the owner.
- The intro film runs about 85 s with pauses. The owner approved it as is: do not trim; returning players skip it.
- **Flashcard ceiling (a decision for the owner):** the nudge observation 0.78 is below the Gold line 0.82. So cards alone lift a Mint fact only toward 0.78. They turn it Gold only once battles have already brought m to 0.82 or more. A correct card never lowers m: that `max()` guard is my addition, not part of the brief. For cards alone to reach Gold, raise the observation above 0.82.
- The procedural yawn and the overall mix have not been checked by ear. Frames were reviewed one by one in the browser.
- `STATE.md` named the owner in commits before this one. Rewrite that history before the repo goes public if needed.
- `phonon-tts` live speech works in the browser on a single thread (no COOP/COEP), with a timeout fallback to the generic baked line.
