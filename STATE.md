# STATE: mathworld

_Updated 24 Nov 2026, Phase 3_

## What changed
- **Commits:** `5788d64` baseline · `e0920e2` Phase 0 · `d952818` ui-sdk · `6802a1c` Phase 1 rig · `2067f26` intro + Level 0 · `a57d1b3` game shell · `e6f119f` rig fixes · `611c0ca` Phase 2 · `0d98ec8` polish · Phase 2 review `79986d7`…`0b9a101` · **Phase 3:** `e4b874c`, `6c4da9d`, and this commit (STATE).
- **One Beat Player** (`src/engine/beatPlayer.ts`) runs Show Me How over the live fleet:
  - The background dims, the camera pushes in, and Nova hovers beside the fleet lip-syncing via `audio.level()`. Her glow is off in battle.
  - Each beat's typed Show is drawn on the ships with value badges (`stageBeat` in `arena.ts`). This covers splits, place-value bands, sectors, ghost rows (coral at the We-Do), the ×5 twin fading, the Half & Double hologram, and Fast Adding running totals.
  - The banner shows the card name and the WHY. The dock shows the We-Do equation. The first sight of a trick unlocks its card onto the belt, with a toast and its baked line.
- **Shot budget, planned in pure code** (`src/rig/showme.ts`):
  - In battle Nova says one line: the doc's WHY on first sight, or a one-line `brief` on a repeat. The doc's other beats are silent labelled moves, followed by the short We-Do `ask`.
  - First sight fits in ≤ 10 s and a repeat in ≤ 8 s. Tests check this for every fact to 12 × 12 and for sampled multi-digit tiers.
  - The keypad stays live for the whole lesson, and a shot ends it cleanly.
  - `film: true` speaks every line, for the Academy (Phase 4).
  - ×5 lessons no longer flip (8 × 5 stays 8 squads of 5).
- **Safety net:** on Earth to the Asteroid Belt, a miss on a single-digit fact after a lesson drops to Fast Adding. The fewer squads are swept one at a time with running totals.
- **Voice:**
  - 46 new Nova clips (`tr_*`, `unlock_*`), 118 in total. A lesson line uses a clip when `lineKey()` matches its words; otherwise it is live Phonon (Zoey), and if that is not ready, captions alone.
  - Pre-fetch: Beat 1 at wave start; every line after miss 1; the safety-net lines when a lesson starts.
  - Cancellation is strict: voice, caption, waits, and the synthesis of lines no longer needed.
  - The intro warms the Hadley and Zoey voices, and a battle warms Zoey.
- `docs/tricks.md` and SPEC §4.4 describe the battle compilation.

## What's verified (Claude_Browser pane, :3200)
- `bun run check` is green with 68 tests. The new tests cover plans, budgets, WHY, safety net, equations, spoken forms and clip matching.
- **Every trick played over its live fleet:** 3×8, 10×8, 8×5, 4×7, 7×2 (flip), 6×8, 7×6 (flip), 4×9, 3×4 (flip), 0×7, 1×4 (Earth), 6×24, 24×16, 18×25, 19×24.
  - First-sight lessons measured 5.3–8.7 s from start to the end of the question.
  - Fast Replays measured 4.1–5.6 s.
  - The safety net (3×8 → Fast Adding) took 6.8 s.
- **Moon campaign, fresh cadet:** three misses on 10 × 8.
  - The keypad was ready 2.6 s after the third miss; the lesson took 6.9 s with the keypad live; every shot took 2.6–3.6 s.
  - Two waves later a transfer check (6 × 5) was logged with `isTransferCheck: true`.
  - `explanation_started/completed` were logged per trick, and they reached `/api/events`.
- Firing mid-lesson stops the voice, clears the caption and visuals, and logs `wedoCorrect`. 0 works as the We-Do answer.
- Live Phonon is not too slow: about 0.5 s per line on one thread (no COOP/COEP). The lessons used live and baked lines, never captions-only.
- **Lip-sync:** with the voice routed to the analyser at master gain 0, Nova's mouth opened to 2.6×.
- Phone at 375 × 812: the caption is clear of the fleet, the banner and dock read well, and Nova is in frame.

## Next
- **Phase 4:** title screen, Resting Bay (Trick Cards on the desk launch `planShowMeHow(…, { film: true })`), map, Hangar, flashcards.

## Open risks
- **Not heard by ear.** The dev env mutes on purpose (`NEXT_PUBLIC_MW_MUTE` in `.env.development.local`, plus `mw:mute` in localStorage), so all voice checks were by buffers, timing and analyser level. Someone should listen once with sound on.
- **Lesson length is a judgment call.** A first lesson in battle says only the WHY line plus the question. The doc's middle lines ("Left side: 3 squads of 5 makes 15") show as badges, not speech. This keeps the 5–10 s rule; the full spoken walkthrough is kept for the Academy. Owner call if more speech is wanted in battle.
- **Visual nits:**
  - Half & Double's hologram makes the fleet read small.
  - The "Squadrons incoming" line is cut off if Show Me How is tapped in the first ~1.3 s of a wave.
  - The dim mostly darkens stars; planets near the fleet stay bright.
- **Uncommitted, not ours:** the mute flag in `src/engine/audio.ts` is still left out of every commit. Phase 3's `audio.ts` hunk was staged separately.
- **Carried over:**
  - Not tested on a real phone or touch device, or in Safari (Phonon's SIMD fallback is untested).
  - Deep Space performance.
  - `/play/<unknown>` returns status 200.
  - Any planet can be opened by URL.
  - The deploy (owner) and the flashcard ceiling decision.
  - The untrimmed intro (by request).
  - The history rewrite for owner names before going public.
