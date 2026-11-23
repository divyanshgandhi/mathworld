# STATE: mathworld

_Updated 24 Nov 2026, final integration pass_

## What changed
- **Commits:** … Phase 5 `f6c28f3`, `ee8f977`, `2cd7877` · **Integration:** `e756237` (dev mute flag, the previously uncommitted `audio.ts` change), `3c8c014` (integration fixes), the phone polish commit, and this commit (README, regenerated levelling proof, STATE).
- **Fixes from playing it end to end:**
  - A miss chip turns into "Last shot: 15 still flying" once the shields restore the fleet. Before, "15 still flying" sat over all 20 ships.
  - 3 on 1 × 4 is now "Just a hair off!", not "So close! One squad off." A squad of one is one drone (`rig/errors.ts`, tested).
  - The keypad wait label says "Stand by…". It used to say "Volley in flight…" during Nova's intro line. Digit and Enter in the same frame are never lost now (a ref in BattleHud).
  - Split lasers stop just past the fleet. They used to cross the axis labels and run under the keypad.
  - `/play/<unknown>` is a real 404 with a game-styled not-found screen. `params` is awaited outside Suspense, and `instant = false` is set on that route (every real planet is prerendered).
  - Phones: the `a × b` plate no longer sits under the menu button. Sign-up focuses the name field.
- **README rewritten:** how to run, what a new cadet plays, architecture, pedagogy choices, the levelling proof summary, telemetry, deploy, what's next.
- **`docs/levelling-proof.md` regenerated:** only the random-masher's numbers moved by a point or two. All claims still pass.

- **Sound toggle (`4195783`):** a speaker button sits top-right on every screen, and M toggles it too. Muting sets the master volume to 0, so pacing is identical. The dev env mute flag is gone, and the game is unmuted.

## What's verified (Claude_Browser pane, :3200, audio muted)
- **New cadet, desktop (1024 × 768):**
  - Title → Start → sign-up → the full intro film, played through (~119 s).
  - Captions are text only and no line was cut off. The cadet's name is spoken live and captioned. A late Space press let the classmate answer, as designed.
  - Ignite → Cadet Bay: undershoot 3, overshoot 6, Show Me How (Empty & Mirror), We-Do 4, **0 on 0 × 7**, the Power-Up on 4 × 1, the clear card.
  - `/bay` → flashcard (49) → `/map` → Moon. 10 × 8 with three misses (18, 88, 70) auto-started the ×10 lesson. The Radar on a wild miss.
  - The Hyper-Jump to the Asteroid Belt.
  - Asteroid Belt: the Easy 5s & 10s Power-Up, Show Me How on 7 × 5 and 7 × 7 (Split & Add).
  - Pause menu → bay → Hangar: bought Solar Gold, and the gold hull flies in the next battle.
  - Academy: Double It! film and the NAILED IT card.
  - The returning cadet: Start → `/bay`, and `/intro` → `/bay`.
- **Shot times measured (`ui.shots`, fire → ready):** correct and miss shots 1.9–3.8 s. The third miss on 10 × 8 plus its lesson took 1.9 + 4.8 s. First-sight lessons took 4.8–6.6 s. Nothing came near 10 s.
- **Phone (375 × 812):**
  - Title, sign-up and the intro start. Raising your hand with Space then answering 9 got "Ooh, super close!".
  - Cadet Bay via `?dev`, an Asteroid Belt battle by touch with the Radar, `/bay`, `/map`, `/hangar`, `/academy`.
- **Checks:** `bun run check` is green (83 tests), and `bun run build` passes alongside the running dev server.

## Next
- **The owner's part:** run `docs/test-protocol.md` with real kids, fix the top 3 friction points, fill in README → Field notes.
- Deploy (Vercel + Supabase, `MW_ADMIN_KEY`), then a smoke test on a real phone with sound.

## Open risks
- **Not heard by ear:** pacing was judged from clip lengths and captions.
- **Not tried yet:** Safari, real touch, or a deployed URL.
- **Resting Bay:** a small diorama with empty space above and below on 4:3 and phone screens. It works, but it reads small.
- **Flipped ×10 lesson** (8 × 10 turned into a column of Pods): at 1024 × 768 the axis labels and Pod tags render small.
- **Cushion:** asking for Show Me How without a miss counts as a struggle, so two such waves bring a Shield Recharge wave (by design in `fold.ts`; worth watching with kids).
- **Carried over:**
  - Orb farming via warm-ups and flashcards.
  - `/admin` reads every event on each load.
  - The X-Ray's "this session" is since the page opened.
  - The local `MW_ADMIN_KEY` in the gitignored `.env.development.local`.
  - The history rewrite for owner names before going public.
- **Hint wording (found in the final play-test):** 40 on 5 × 9 (5 squads of 9 on screen) gets "So close! One squad off." The cadet is really one fighter short in *each* squad, which is only "one squad" if the fleet is flipped. The fix is in `rig/errors.ts`: an off-by-`a` miss should get its own line, and that line needs baking.
