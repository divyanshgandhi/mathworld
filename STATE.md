# STATE: mathworld, branch `overhaul/void-and-gold`

_Updated 25 Nov 2026, after the wave 1 integration. `main` still holds the previous version, untouched._

## What changed
- **Wave 1 merged**, in this order: kit, worlds, ships, engine, film. Each is one `--no-ff` merge commit. The only file two tracks both touched was `src/worlds/looks.ts`, and git merged it cleanly: the space and hero entries come from worlds, the interior entry from film. The handoff notes are indexed in `docs/overhaul/README.md`.
  - **kit:** tokens as CSS and Tailwind, Saira, `src/components/kit/`, the route fade, every older screen restyled, `/kit`.
  - **worlds:** one planet factory and one Earth, the space and hero looks, the new title scene, planet sprites, `/dev/planets`.
  - **ships:** the rocket, ember and apricot drones with leaders, ten-frame pods and big ships, the Hangar product shot, `/dev/ships`.
  - **engine:** the battle split into a phase machine, an event bus, systems and registries, with no visual change.
  - **film:** steady light, a real door, children who stand up properly, the cast redesigned, `/dev/cast`.
- **Integration seams wired** (small commits after the merges):
  - Battle fleets use `squadStyle`: squads alternate ember and apricot by row, and each squad's first ship has a gold pennant. A squad of one ship has no leader.
  - The stage renders into a 4-sample multisampled target, so thin edges no longer crawl. It uses `PCFShadowMap`, so the console no longer warns.
  - The film's hangar shows the factory Earth.
  - Bay posters use the mastery colours.
  - Holo labels and bay posters draw in Saira.
  - The battle and the warm-up sit on the void, not `#030612`.
  - The Hangar blurbs match the new paints and trails.
  - `/dev/planets` no longer scrolls sideways on a phone.
- **A bug the smoke test found, now fixed:** the Targeting Radar appears after a miss or after 10 s idle. It used to push the phone keypad up by one row, so a tap on Fire landed on a radar chip and fired that chip's number (21 went out as 31, and 0 as 10). The radar now sits above the readout, and the dock is anchored at the bottom on every screen size.

## What is verified
- `bun run check` is green after every merge and every fix (200 tests), and `bun run build` passes beside the dev server.
- **Played as a new cadet** in the browser on this branch's dev server, muted:
  - **Desktop, 1440 × 900:**
    - Title, then sign-up, then the whole film. The light and the door held steady; seen at real time, not frame by frame.
    - Cadet Bay 1 × 4: the shot hit and earned 5 orbs.
    - `/bay?dev`, `/map?dev`, `/hangar?dev`, `/academy?dev`.
    - `/play/moon?dev`: a 20 on 4 × 6 undershot, a 24 then hit, then 5 × 9 and 2 × 9. Tones and leaders showed.
    - `/kit`, `/dev/cast`, `/dev/planets`, `/dev/ships`.
  - **Phone, 375 × 812:**
    - The same hubs, plus `/kit` and the `/dev` pages, with no sideways scroll on any of them.
    - The welcome-back card on `/intro`, then Cadet Bay 0 × 7 and 10 × 0.
    - Moon 3 × 7 and 6 × 7 by tapping. Measured with the fix: the keypad stays put when the radar appears.
- No console errors or warnings on any route above.

## Next, and open risks
- **Wave 2** per `OVERHAUL.md`:
  - the battle cockpit;
  - `TopBar` on every screen;
  - replace `src/battle/look.ts` with tokens and looks (the lime labels, cyan rim and glowing plasma balls are still the old look);
  - `makePlasmaBall`, `rocket.noseWorld()` and `rocket.recoil()` in the cannon;
  - `ui.hint` driving the plate's "N squads · N each" line in discover mode;
  - `setCharge` on each keypad change;
  - title and film controls swapped for kit components;
  - the Star map and the bay drawn with `PlanetSprite`.
- **Decision needed:** the battle's Power-Up fit is stricter than `powerUpFits` for Fast Adding with a = 10 and for Split & Add with a 10 (see `docs/overhaul/engine.md`).
- **Risks:**
  - **Moon battles:** the small factory Earth in the backdrop can sit behind a drone in the fleet, which hurts counting. It was in the same place before, but it is more visible now.
  - **Phones:** battle labels ("7 each", "3 squads") are very small.
  - **Not done yet:**
    - nothing heard (all checks were muted);
    - no real phone or Safari;
    - the film was watched at real time only once, on desktop.
