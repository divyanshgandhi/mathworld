# STATE: mathworld

_Updated 24 Nov 2026, Phase 2_

## What changed
- **Commits:** `5788d64` baseline · `e0920e2` Phase 0 · `d952818` ui-sdk · `6802a1c` Phase 1 rig · `2067f26` intro + Level 0 · `a57d1b3` game shell · `e6f119f` rig fixes · `611c0ca` Phase 2 battles · this commit (anti-mash queueing, lesson pacing, framing, STATE).
- **Base-10 fleet** (`src/rig/fleet.ts`, pure, tested): rows and columns split by place value into Battle Sectors. Each sector uses the biggest ship that tiles it: Fighter 1, Squadron Pod 10, Carrier 100, Dreadnought 1K+ (badges show 1K, 10K, 1M and so on). `volley(fleet, n)` pops exactly n ships' worth, biggest ships first, and can stop inside a pod (6 × 24 hit with 105 leaves 5 micro-fighters and 1 pod). A ×10 fact is now a few pods, never dozens of fighters.
- **Ships** (`ships.ts`): pod with 2 × 5 poppable micro-fighters and a "10" tag, carrier with 100 cells in 10 strips, dreadnought with a damage meter, dashed ghost fighter, lite fighter for armadas over 140 ships, Hangar style hooks (hull, thruster, blaster ids). No halos: ships stay under the bloom threshold, and plasma balls sit just over it.
- **Battle engine** (`src/worlds/space/arena.ts`): one engine for every planet and for Cadet Bay. In campaign mode the wave comes from `fold` + `nextWave` + `housekeeping`. Replays and `?dev&a=&b=` drills use `practiceWave` and log `waveRole: "practice"`. The fold moves mastery for those waves only: no mission, streak or clear, and a test covers this. Outcomes play out in the world: survivors wink with a "N still flying" chip; overshoot shows orange balls flying past with "+N flew past"; exact gives a clean pop and orbs. Scaffolding: a close miss gets an error-classified line, way off or 10 s idle brings the Radar, miss 2 gets the invite, miss 3 or a tap starts Show Me How (Phase 2 form: `lesson()` beats over the live fleet). Then the We-Do shot, with `explanation_completed` logged before that attempt. Anti-mash: 3 wild misses within 12 s, each fired within 4 s, gets the hold-fire line. Hyper-Jump offer (accept or decline), planet clear, practice complete, and `intro_completed` from Earth.
- **Power-Up belt** (unlocked = tricks seen; `?dev` unlocks all). Each acts on the live fleet without giving the answer:
  - Flip It turns the fleet a quarter and swaps the axes.
  - Split & Add adds a laser slice at 5.
  - Double It shows halves.
  - Jump One More marks the anchor block plus one squad.
  - Borrow & Take Back adds a ghost per squad.
  - Easy 5s & 10s pulses the pods, or adds twin ghosts for ×5.
  - Fast Adding counts squads one by one with running totals; the last one shows "?".
  - Big & Small Split separates the bands. On 2d × 2d and up it turns into Sector-Lock: tap a sector, type its sub-product, lock it; the sum loads into the readout and the cadet fires. A wrong sub-product gets a line and nothing is logged.
  - A misfit gets the coaching line and `powerup_used valid:false`.
- **HUD** (`src/components/battle/BattleHud.tsx`): the big `a × b` plate with both axes named. The keypad docks right on desktop and at the bottom on phones, with a scrolling belt, Radar and sector chips. The stage frames the fleet inside the HUD's free area (`setSafe` plus camera view offset). `/play/[planet]` (`WaveArena.tsx`) has sign-up if there is no cadet, a Launch gate, and auto-launch when flying in from another battle. The intro's Cadet Bay uses the same engine and HUD. `/` is now a dev launch list with drills; `/wave` redirects to `/play/moon`.
- **Shot budget:** the volley takes at most ~1.2 s, the outcome ~1 s, Nova says one short line, and the shields regroup in 0.4 s. 39 new short lines were baked with Phonon (`lines.ts` ↔ `bake-voices.py`). Reactions never cut a line off; one that arrives mid-line is dropped, except the hold-fire line, which waits.
- **Plumbing:** an ordered event outbox (`src/engine/outbox.ts`). The stage clock keeps ticking when frames are starved or the tab is hidden. The overlay caption sizes to its text.

## What's verified (played in the Claude_Browser pane; Playwright still has no Chrome)
- `bun run check` is green with 61 tests. New tests: fleet decomposition (6 × 24, 16 × 24, ×10), sector and ship sums over every tier, volley partial / extra / 0, and practice runs leaving the campaign alone.
- **Shot timings (fire → ready again):** 2.1–4.2 s across Earth, Moon (7 × 10, 10 × 8, 2 × 10), Mars (3 × 8, 4 × 9, 7 × 3), Asteroid Belt, Jupiter (6 × 24, 2 × 89), Saturn (16 × 24, 24 × 16, campaign), Uranus (7 × 345) and Deep Space (343 × 4536). Timings over 10 s in the logs came only from my own `stage.paused` inspection.
- **One fresh cadet, campaign:** Earth (0 accepted as an answer on 0 × 7 and 10 × 0, overshoot, Earth clear) → Moon (Gold probe → Hyper-Jump offer → accepted) → Asteroid Belt (Show Me How tapped on 7 × 7, Split & Add unlocked and fired from the belt, transfer check served, clear) → Jupiter (3 misses → auto Show Me How → Big & Small Split unlocked; misfit coaching) → Saturn on a phone viewport (Sector-Lock by tapping keypad buttons, Hyper-Jump offered and declined, clear). Events were checked in `/api/events` in order: attempts, `powerup_used` (valid and invalid), `explanation_started` and `explanation_completed`, `planet_cleared`, `hyper_jump_taken`, orbs, `intro_completed`.
- Cadet Bay through `/intro?dev` → Cadet Bay with another fresh cadet: Nova's welcome, the mirror lesson on the third miss, clear, and `introCompleted: true`.
- Anti-mash hold-fire line fires. Show Me How repeat runs in `fast` mode.
- Desktop at 1280 × 760 and phone at 375 × 812 screenshots reviewed. No new console errors.

## Next
- **Phase 3:** the full in-world Show Me How beat player (camera push-in, one visual per beat), plus Academy films.
- **Fast replay length:** on a flipped fact, the repeat is two doc lines (Flip It + trick), about 10–11 s when only captions play. In this pane live Phonon speech never returned within 1.2 s, so I could not hear or time real voice. Phase 3 should bring the repeat to ≤ 8 s.
- **Phase 4:** title screen, Resting Bay, map (it can link to `/play/[planet]`, which shows a practice run on any planet that is not the cadet's current one), Hangar (style hooks exist), and flashcards.

## Open risks
- **Live voice unverified:** this session never heard Phonon speech. Lesson beats fell back to captions paced on reading time. Baked lines play (manifest-driven), but I did not listen to them.
- **Performance:** Deep Space 343 × 4536 is about 5.7k meshes, about 11 ms per frame on this Mac. Phones will struggle at Uranus and Deep Space sizes. InstancedMesh batching is the fix (ROADMAP "after Wednesday").
- **Practice access:** any planet can be opened in practice mode by URL; no lock screen yet (Phase 4 map). `/play/<unknown>` streams the not-found page with HTTP 200 (params are read inside Suspense for instant navigation).
- **Director repeats:** the director can serve the same fact twice in a row (1 × 4 after Show Me How in Cadet Bay). This is existing `nextWave` behaviour, not changed here.
- **Uncommitted change, not mine:** `src/engine/audio.ts` has an uncommitted change that is not mine (a mute flag via `NEXT_PUBLIC_MW_MUTE`, `?mute` or localStorage). I left it out of my commits.
- **Carried over:** the Vercel and Supabase deploy (owner), the flashcard ceiling decision, the intro is left untrimmed by request, and the history rewrite for owner names before going public.
