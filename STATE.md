# STATE: mathworld

_Updated 24 Nov 2026, 00:05 IST_

## What changed
- **Commits:**
  - `5788d64` baseline
  - `e0920e2` Phase 0 (database, API, Vercel prep)
  - `d952818` ui-sdk wiring (the owner's deliberate choice)
  - `6802a1c` Phase 1 (maths rig, event fold, wave planner, levelling proof)
  - Intro + Level 0 rework (this commit, done on the owner's request ahead of Phases 2–3)
- **The intro film follows the Gemini showcase storyline and audio:**
  - 33 baked Gradium Phonon clips in `public/vo/` (`bun run voices`, `scripts/bake-voices.py`).
    - `vo.json` records each clip's spoken `end` (before trailing silence).
    - `--measure` refreshes `end` without re-baking.
  - The cadet's name is spoken live in the teacher's voice by `phonon-tts` in the browser.
    - The bundle is vendored to `public/vendor/` on install and is git-ignored.
  - `src/engine/audio.ts`: clips, mood beds, synthesised SFX including a procedural yawn, and lip-sync level.
- **Pacing:**
  - Dialogue runs through `dialogue()` beats in `src/worlds/space/intro.ts`. Each line waits for the last one's words to stop, plus a 0.55 s breath. Mouths close in the pauses, and no line is cut by the next shot.
  - Bridging lines were added so the story reads as one scene:
    - `principal_intro`
    - `teacher_proud` and `captain_names` (between "five cadets" and the names)
    - `captain_nova`
    - `teacher_yes`
- **Classroom questions:**
  - The teacher finishes asking, then a 5 s "Raise hand" window opens (Space or the button).
  - Raising your hand gets "Yes? Go ahead!", then the two answer choices.
  - If no hand goes up, a classmate answers.
- **Visuals:**
  - The town glide ends square on to the porch, so "MAPLE HILL SCHOOL" reads in full. The flagpole moved off the centre line; title cards can sit at the top.
  - The first-person hand was rebuilt (`hand.ts`): a tapered palm, jointed fingers with knuckles and nails, and the thumb on its mound. It comes up palm-in to cover the yawn.
  - Characters:
    - The teacher has a top knot and a fringe.
    - Eyes are larger, and curly hair is finer.
    - Arms rest with a slight bend and gesture while talking.
    - Speakers face the class instead of their own heads.
  - Medium shots on the teacher, the captain and the picked cadet. Nova gets her own frame. The sunbeams are dimmer.
- **Level 0 (Cadet Bay, `cadetBay.ts`):** starts after the launch.
  - Waves come from `fold` and `nextWave`, and events are posted to `/api/events`.
  - One plasma ball per drone, with over and under shown in the world.
  - Nova's voice gives the nudges, and Show Me How runs after 2 misses.
  - Reframed so the ship reads against space, and a 10 × 8 probe fits the frame.
- `stage.paused` freezes the clock for frame-by-frame review with `stage.step()`. ESLint ignores `public/vendor/**`.

## What's verified
- The intro was played and reviewed frame by frame in the browser: town sign, wake, yawn hand, raise-hand → choices → reply, knock, officers, captain → teacher → names, picked cadet (live name), hangar, Nova and CTA, launch, then Cadet Bay. A miss, a hit and event persistence were checked, with no console errors.
- `bun run check` passes with 50 tests:
  - pools disjoint for every pair up to 120 × 120, and draws stay in their tier
  - the classifier and Radar
  - tricks compiled for every a × b from 0 to 99 × 99, plus samples up to 5d × 3d, in both full and replay mode; parts and the We-Do answer always equal a × b
  - fold and planner unit tests
  - all 12 levelling claims across 200 seeded runs per bot

## Decisions for the owner
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
- The Vercel and Supabase deploy is deferred to the end. It needs a Supabase project and a Vercel import, both by the owner.
- The intro film now runs about 85 s with pauses. Trimming waits for Phase 4.
- The procedural yawn and the overall mix have not been checked by ear. Frames were reviewed one by one in the browser.
- `STATE.md` named the owner in commits before this one. Rewrite that history before the repo goes public if needed.
- `phonon-tts` live speech works in the browser on a single thread (no COOP/COEP), with a timeout fallback to the generic baked line.
