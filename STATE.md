# STATE: mathworld

_Updated 24 Nov 2026, Phase 2 review_

## What changed
- **Commits:** `5788d64` baseline · `e0920e2` Phase 0 · `d952818` ui-sdk · `6802a1c` Phase 1 rig · `2067f26` intro + Level 0 · `a57d1b3` game shell · `e6f119f` rig fixes · `611c0ca` Phase 2 battles · `0d98ec8` battle polish · Phase 2 review: `79986d7`, `5accbc0`, `9b4aeb1`, `c69a023`, `409cd71`, `30031be`, and this commit (STATE).
- **Phase 2 (built before the review):** the Base-10 fleet (`src/rig/fleet.ts`), the ship models (`ships.ts`), one battle engine (`arena.ts`), the HUD (`BattleHud.tsx`), the Power-Up belt, Sector-Lock, scaffolding, Hyper-Jump, practice runs and the event outbox. Details are in the commit messages for `611c0ca` and `0d98ec8`.
- **Review fixes (shot budget, ×10 in Level 1):**
  - On a third miss the game goes straight into Show Me How, with no reaction line first.
  - A 10 × b lesson turns the pods with no spoken Flip It beats. A new cadet's 10 × 8 at the Moon took 16.7 s and now takes 6.4 s.
  - A repeat Flip It turns the fleet without its line. Fast Replay is one reminder line plus the We-Do, and `lesson()` now returns `flipBeats`.
  - The dev shot timer now includes the lesson a shot triggers.
- **Review fixes (HUD and visuals):**
  - The outcome chip has its own reserved row under the plate, so it no longer covers the fleet's "10 each" label. Show Me How's card name and We-Do question moved into the keypad dock, and the last lesson caption no longer stays on screen into the next wave.
  - For 0 × 7 and 5 × 0, the axis labels now sit outside the zero ring.
  - Pod "10" badges stay upright when the fleet is flipped.
  - The rocket flame halo is gone in battle.
- **Review fixes (logic):**
  - Borrow & Take Back on 2-digit fleets (19 × 24) adds the ghost squad, built from ships of the same class.
  - Labels to the right of the fleet no longer overlap it.
  - On a ×0 fleet only Empty & Mirror fits.
  - Tapping another Power-Up leaves Sector-Lock cleanly. Tapping Sector-Lock again keeps the locks already made.
  - Practice runs and Earth's tutorial never serve the fleet just played again.
  - In the outbox, one bad event no longer drops the rest of its batch.

## What's verified (Claude_Browser pane; Playwright has no Chrome)
- `bun run check` green, 62 tests. New tests: the tutorial no-repeat rule, ×0 fits and `flipBeats`.
- **Fire → ready timings measured:**
  - Plain shots on ×10 facts take 2.1–3.8 s across a full Moon campaign run.
  - Third miss into Show Me How: 7 × 10 Fast Replay 7.5 s; 10 × 8 first lesson 6.4 s (was 16.7 s); 10 × 8 Fast Replay 7.6 s (was 12.5 s); 7 × 2 Fast Replay on a flipped fact 5.8 s.
  - Cadet Bay mirror lesson: 6.3 s.
- **Played paths:**
  - Fresh cadet: `/intro?dev` → Cadet Bay. Three misses, then the mirror lesson, then clear. `intro_completed` and `planet_cleared` were logged, and "Fly to The Moon" auto-launched the Moon.
  - Keyboard: 0 is accepted, Backspace works, Enter twice fires only once, and Enter starts the battle.
  - Saturn: Sector-Lock combined with other Power-Ups. Borrow ghosts on 19 × 24.
  - Phone at 375 × 812: Jupiter and Saturn Sector-Lock.
- The server event log matched the client log (76 of 76, same order). No new console errors; the `/play` "URL data" errors in the pane were old entries and did not come back on fresh loads or link navigations.

## Next
- **Phase 3:** the in-world Show Me How beat player and Academy films, with live Phonon timing.
- **Phase 4:** title screen, Resting Bay, map, Hangar, flashcards.

## Open risks
- **First-time lessons can still go over 10 s:**
  - A cadet's first Show Me How on a trick still runs the full `docs/tricks.md` walkthrough. With captions it takes 11–21 s, for example 5 × 7, 8 × 5 with a first Flip It, or 8 × 2 with a first Flip It plus Double It (15.7 s measured).
  - SPEC 4.4 treats the first walkthrough as full-length on purpose. Owner decision: should the 5–10 s rule cover first lessons too? If yes, trim the scripts in `docs/tricks.md` or split a two-trick lesson.
- **Live voice unverified:** Phonon never answered within 1.2 s in the pane, so lessons were paced on captions. Real voice timing is not measured.
- **Performance:** Deep Space is about 5.7k meshes. Not tested on a real phone or in Safari.
- `/play/<unknown>` returns the not-found page with status 200. This comes from streaming params inside Suspense under `partialPrefetching`.
- Any planet can be opened by URL as a practice run (Phase 4 map).
- The campaign director can still serve a struggled fact again two waves later. That repeat is deliberate. Only an immediate repeat is blocked, and only on Earth and in practice.
- **Uncommitted, not ours:** the mute flag in `src/engine/audio.ts` is still left out of every commit.
- **Carried over:** the deploy (owner), the flashcard ceiling decision, the untrimmed intro (by request), and the history rewrite for owner names before going public.
