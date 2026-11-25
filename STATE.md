# STATE: mathworld, branch `overhaul/void-and-gold`

_Updated 25 Nov 2026, after the wave 1 fix pass. `main` still holds the previous version, untouched._

## What changed
- **Wave 1 merged** (kit, worlds, ships, engine, film; one `--no-ff` merge each), integration seams wired. Handoff notes are indexed in `docs/overhaul/README.md`.
- **Wave 1 fix pass** (four testers' findings, each reproduced before fixing):
  - **Battle dock:** fits every screen. On phones the sectors and Power-Ups are single scrolling rows and Show me sits beside the readout, so a 12-sector Deep Space fleet sits between the plate and the dock (it was hidden). The desktop dock never exceeds the viewport. Long `a × b` steps its size down instead of overflowing.
  - **Radar:** only from miss 2 (`scaffold(misses)`), never on idle or on a first wild miss. It was offering four answers, one of them right, as a first hint.
  - **Pause:** Escape opens and closes it (it reopened itself before), plus How to play, a sound row, Star map and Resting Bay.
  - **Battle frame:** the rocket stays fully in view; Nova's caption sits bottom-left on desktop and in a reserved band above the dock on phones; axis labels are in the hint sky colour and kept about 26 px tall on screen; `10 × b` is drawn as ten true rows (it was `b` ten-frame pods, which read as `b × 10`).
  - **Looks:** the battle, warm-ups and Star map take bloom from the `space` look; balls, sparks and lasers sit under its threshold. `tests/looks-rule.test.ts` fails if any other file touches the bloom.
  - **Resting Bay in 2D** (`design/bay-accretion.html`): next mission, planet sprite, wave dots, one Launch, the times tables as mastery marks that open to their facts and flashcards, places to go, How to play. The 3D bay scene is deleted.
  - **Academy:** one list of tricks with full reasons; no wall of New badges; one Show Me How during a film.
  - **Film:** the cadet's raised hand is shot from the front in clear space; on a portrait phone the names beat shows the front pair from the back wall, then the back pair; the cheer no longer covers the classmates' faces; the stand is 1.5 s with a smaller hip shift; town clouds no longer go storm grey on a phone; speaker labels 16 px; happy, thinking and oops faces exaggerated.
  - **Title:** Start game is up within about a second (it waited for the 5.5 s fly-in).
  - **Route fade:** skipped view transitions (hidden tab, slow commit) no longer surface as uncaught errors.
  - **Words:** Star map everywhere, no kicker lines, Bonus wave for waves that do not count, Hyper-Jump explained, Hangar tabs one word each, a first-sight line for zero fleets, opaque flashcards, sign-up colours in rows of three on phones, New mark raised to about 3:1.

## What is verified
- `bun run check` green on every commit (201 tests).
- In the browser at `fix.localhost:3300`, muted, desktop 1440 × 900 and phone 375 × 812:
  - Deep Space 343 × 4,536 with Sector-Lock: phone dock 394 px tall (was 692), fleet visible; desktop dock 720 px (was 990).
  - Moon 10 × 8 as ten rows; 75 leaves 5; 6 × 7 volley without halos; 0 × 7 line shows and `0` fires.
  - Pause: real Escape opens, closes, and focus returns to Menu.
  - Film by stepping the stage: the raised hand, phone names beat, the cheer, the town on a phone, every named child standing clear of the chair.
  - Bay, Academy, Star map and `/dev/cast` at both sizes.
- Not measurable here: CSS transition timing (the pane's document timeline does not advance while hidden), real-time flicker, audio.

## Next, and open risks
- **Wave 2** per `OVERHAUL.md`: the cockpit (digits on the cannon), the hint ladder driving the plate's "N squads · N each" line (still printed from the start), `TopBar` and help on every screen, the kill beat.
- **Needs a voice re-bake** (`bun run voices`): the Captain's hangar line still says "squadron" and "plasma cells"; `nova_zero_squads` and `nova_zero_each` are captions only.
- **Decisions for the owner:**
  - Flashcards still pay 1 orb per right card; the brief says nothing rewards grinding.
  - The battle's Power-Up fit is stricter than `powerUpFits` for Fast Adding and Split & Add with a = 10 (`docs/overhaul/engine.md`).
- **Not done:** a film skip and replay; Earth's additive atmosphere shell; renaming the `lime`/`glass` class aliases; planet sprites that bake late on `/dev/planets`; the title's asteroid belt vs the prototype.
- **Risks:** nothing heard; no real phone or Safari; the 3 fps harness cannot judge motion.
