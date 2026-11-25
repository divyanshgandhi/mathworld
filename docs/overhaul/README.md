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

## Wave 2 handoff notes
Merged into `overhaul/void-and-gold` in this order (ownership is in `OVERHAUL.md`, "Wave 2"):

| Track | Note | What it built |
| --- | --- | --- |
| economy | [w2-economy.md](w2-economy.md) | Orbs derived from learning events (`ORB_RULES`, `orbLedger`, `orbsBetween`), the catalogue registry, daily patrol logic, the Hangar shop, the admin Orbs tab |
| combat | [w2-combat.md](w2-combat.md) | Discover mode, squad and each scans, the number on the nose, the squad-by-squad volley, the kill beat, misses in the world, warp-in, camera and backdrop |
| console | [w2-console.md](w2-console.md) | The fixed cockpit console, mission strip, briefing, New Power-Up, offer and clear cards, the pause menu |
| front | [w2-front.md](w2-front.md) | Title with sign-up in place, the Resting Bay, calm flashcards, kit additions, the app shell |
| places | [w2-places.md](w2-places.md) | The Star map and the Academy in 2D, planet sprites that persist |
| manual | [w2-manual.md](w2-manual.md) | The Field Manual, greetings, the guided first shot, ship sprites (built, not yet mounted) |
| film | [w2-film.md](w2-film.md) | The film's beauty pass, Skip and replay, captions, the hand-off frame |

## Integration (wave 2)
After the merges, these seams were wired:
- Battles take the arena's default `structure: "discover"`, so `?dev&labels` turns the old labels back on. Structure words in the console come only from `ui.hint` and use the scan's words ("6 squads", "7 in each squad").
- Orbs: the battle's counter is the folded total and its "+N orbs" is what the shot's events earn in the fold (`orbsBetween`). Nothing on the client posts `orb_earned`; the Academy writes `waveRole: "academy"`; warm-ups and flashcards pay nothing.
- Sign-up: every caller uses `hub/CadetSignUp.tsx` (the film's gate and dev drills in a `Sheet`). `battle/ui.tsx` keeps only the class strings still imported.
- What a planet teaches comes from one place, `STOP_WORDS` in `components/world/words.ts`: the briefing card and the hub's `TEACHES` read it. Every 2D planet is a `PlanetSprite`.
- Battle cards open one at a time: a New Power-Up card is read before the clear or offer card.
- Removed: the unused `STOP_NAMES` alias and the framework favicon.

## Review routes
Run the dev server and open these. Add `?dev` to the game routes to skip progress gates.

| Route | What to look at |
| --- | --- |
| `/kit` | Every kit component in every state, with live contrast ratios |
| `/dev/planets` | Every body from the planet factory, as large sprites and at 48, 96 and 200 px |
| `/dev/ships` | Every ship at battle scale, plus 6 × 8 and 3 × 10 fleets in phone and desktop frames |
| `/dev/cast` | The cast: live previews, faces, and a contact sheet of every film setup at wide and phone frames |
| `/` | The title scene |
| `/intro` | The film, from Earth to the first battle in Cadet Bay |
| `/play/moon?dev&a=4&b=6` | A practice battle with a chosen fact |
| `/bay?dev`, `/map?dev`, `/hangar?dev`, `/academy?dev` | The hubs |
| `/dev/console` | Every console state, every card and the ten Power-Up glyphs |
| `/dev/economy` | This device's orb ledger and patrol status |
| `/dev/teach`, `/dev/teach/console` | The Field Manual pictures, greetings, ship sprites and the guided first shot on a mock console |
| `/intro?replay&from=/bay` | The film again for a cadet who has seen it; Skip and the end return to `from` |
