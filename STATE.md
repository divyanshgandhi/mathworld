# STATE: mathworld, branch `overhaul/void-and-gold`

_Updated 26 Nov 2026, after the wave 2 fix pass (six testers' findings). `main` still holds the previous version, untouched._

## What changed
- **Wave 2 merged and signed off** (seven tracks; index and seams in `docs/overhaul/README.md`), then one fix pass on what six testers found:
  - **Words in battle:** no structure word before a miss ("Ships incoming!"); miss lines without "load"; miss 2 offers a Power-Up only when the belt has one; one praise line; Earth is "Earth" on every battle label; the Hyper-Jump offer is Nova's, in plain words. New lines are captions first (`docs/overhaul/lines-to-bake.md`).
  - **First minutes:** a new cadet meets no empty fleet until two Earth fleets are cleared; the first clear's primary is Fly to the Moon; a new Power-Up pulses on the belt instead of a modal card.
  - **Orbs:** the clear card shows what the clear paid, line by line; a jump nobody offered moves nothing; answers posted in a burst pay for one (`MIN_SHOT_MS`). Fixtures that need a later planet play there (`tests/reach.ts`).
  - **Phones:** keypad in two rows on phones held upright; axis words framed from the first frame and shown once (strip on portrait phones, beside the fleet elsewhere); the fleet's box is what is really there (Show Me How's Your turn is about twice the size); the rocket's flame clears Nova's band; cards lie down on a short landscape screen; flashcards and the Hangar fit small screens.
  - **Input:** a double tap on a Power-Up is one press; the console ignores presses for 350 ms after a card or the menu closes; Not now in the Hangar waits out a double tap.
  - **Film:** Skip always ends (it could hang); the hand-off to Cadet Bay is a designed dip to the void.

## What is verified
- `bun run check` green (303 tests) at every commit; `bun run build` passes at the last.
- Browser, muted, own origin (`fix2.localhost`): a brand-new cadet through sign-up, film Skip, Cadet Bay (1 × 4, 1 × 10, then 10 × 0), the Earth clear card (+20, Fly to the Moon first) at 1440 × 900 and 375 × 812, the Moon's warm-up wave label. Battle framing measured at 1440 × 900, 768 × 1024, 375 × 812, 360 × 640 and 812 × 375; cards at 812 × 375 (briefing, clear, Hyper-Jump: no scroll); flashcards at 812 × 375; Hangar at 360 × 640; Skip stepped with irregular frame times.

## Next, and open risks
- **Needs the design lead:** place-value plasma balls (a ball for 10 or 100 ships, so 380 fires 38 balls); 3 orbs for a later-try clear (the brief says first tries); "Pod" in the first Show Me How (lives in the frozen `src/rig/tricks.ts`); a script posting plausible answers every second or two still earns like a fast player (needs server-issued waves).
- **Wave 3:** the copy pass and one bake (`lines-to-bake.md`, including the film's "calibrate", "grave danger", `captain_brief2`); captions must not change without their clip.
- **Not done:** Flip It! re-tint and leaders; Power-Up names on phones and at 1024; the film's first-person hair and hand, weak shots, hyphen splits in captions; Hangar try-on label and blaster oval; Academy list collapse; Star map on tablets; the voice files load while muted (by design, for timing).
- **Not verified:** reduced motion, real touch and safe areas, audio, the film at true speed, the dip's look with the pane in front, `/admin`.
- Test cadets exist in the local dev database only.
