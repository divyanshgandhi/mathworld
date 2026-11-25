# Overhaul: index

The brief is `OVERHAUL.md` at the repo root. The design system as built is `DESIGN.md`, and the words are in `docs/glossary.md`.

## Wave 1 handoff notes
Merged into `overhaul/void-and-gold` in this order:

| Track | Note | What it owns |
| --- | --- | --- |
| kit | [kit.md](kit.md) | Tokens as CSS and Tailwind, Saira, `src/components/kit/`, the route fade, the restyle of the older screens |
| worlds | [worlds.md](worlds.md) | `src/worlds/looks.ts`, the planet factory (`makeBody`), the one Earth, the title scene, planet sprites |
| ships | [ships.md](ships.md) | `src/worlds/space/ships.ts` (rocket, drones, pods, big ships), the Hangar product shot, the film's hangar set |
| engine | [engine.md](engine.md) | `src/battle/`: phase machine, event bus, systems, Power-Up, hint, reward and planet registries |
| film | [film.md](film.md) | The intro film: light, door, standing, cast, cuts, captions |

## Integration (wave 1)
After the merges, these seams were wired:
- Battle fleets call `squadStyle(gRow, gCol)`, so squads alternate ember and apricot and each squad has a leader. A squad of one ship has no leader.
- The stage renders its post chain into a 4-sample target, and uses `PCFShadowMap`.
- The film's hangar shows the factory Earth.
- Bay posters use the mastery colours.
- Holo labels, bay posters and the `fitText` default draw in Saira.
- The battle and the warm-up sit on the void token.
- The Hangar blurbs match the new paints and trails.
- The keypad never moves under a finger: the Targeting Radar sits above the readout, and the dock is anchored at the bottom.

## Review routes
Run the dev server and open these. Add `?dev` to the game routes to skip progress gates.

| Route | What to look at |
| --- | --- |
| `/kit` | Every kit component in every state, with live contrast ratios |
| `/dev/planets` | Every body from the planet factory, as large sprites and at 48, 96 and 200 px |
| `/dev/ships` | Every ship at battle scale, plus 6 × 8 and 3 × 10 fleets in phone and desktop frames |
| `/dev/cast` | The nine characters from three angles, with five faces each |
| `/` | The title scene |
| `/intro` | The film, from Earth to the first battle in Cadet Bay |
| `/play/moon?dev&a=4&b=6` | A practice battle with a chosen fact |
| `/bay?dev`, `/map?dev`, `/hangar?dev`, `/academy?dev` | The hubs |
