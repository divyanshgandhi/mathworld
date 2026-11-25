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

## Teaching layer, mounted (wave 2 sign-off)
The manual track's parts are on the real screens now (steps in [w2-manual.md](w2-manual.md); the script is [docs/teaching.md](../teaching.md)):
- **Help, one tap away.** The top bar's help button opens the Field Manual on the Resting Bay (page "squads"), Star map ("squads"), Hangar ("orbs") and Academy ("help"). In a battle, the pause menu's How to play opens it on "count"; Escape closes the manual and leaves the menu. The console's Show me how stays Nova's worked example.
- **The film again.** On a hub, the manual carries a quiet "Watch the film again" (`/intro?replay&from=<screen>`). Battles leave it out.
- **Greetings, once.** Star map, Hangar, Academy and the first flashcard deck greet with `<Greeting>` (`greet:<screen>`). The bay's own Nova line is its greeting on the first arrival ("Hi, {name}! This is your Resting Bay. Press Launch to fly."), so it never shows two. The Hangar's floats over the rocket, the flashcards' over the card, so nothing moves when it goes. The Academy's intro line waits for the second visit.
- **The first battle** opens with `nova_greet_battle` (`greet:battle`, replacing `nova_l0_intro`), then the guided first shot: "Count the ships." rings the fleet (`arena.fleetRect()`), "Type how many." rings the digit keys, "Now press Fire." rings Fire. While the guide runs, the arena plays no briefing line, no first-sight scan and no empty-fleet line. A brand-new cadet's first fleet is `1 × b`, b from 3 to 5. Captions keep off the rocket and its number (`arena.rocketRect()`).
- **Cadet Bay** has the pause menu (Resume, How to play, Sound) and a focusable game root, so Enter fires after the menu closes.
- **The film** no longer tells the miss rule in the hangar (`captain_brief3`, `captain_brief4`); the battle shows it.
- Every spoken line still to bake is in [lines-to-bake.md](lines-to-bake.md).

## Review round handoff notes
The owner's seven points and the round's closed decisions are in `OVERHAUL.md`, "Review round". Merged in this order:

| Track | Note | What it built |
| --- | --- | --- |
| playfield | [r1-playfield.md](r1-playfield.md), dissection [playfield.md](playfield.md) | Nothing on the fleet before an answer, scans that count one number at a time in lanes outside the fleet, labels that cannot collide, fleet size on phones, `arena.playfield()` |
| cockpit | [r1-cockpit.md](r1-cockpit.md) | One Power-Ups button and its list, the three-row phone console, sectors under the question, orbs that agree with their line, the mission-over card |
| map | [r1-map.md](r1-map.md) | The Star map as a pager (one planet a page, arrows, keys, ten dots), a card as wide as its words |
| tour | [r1-tour.md](r1-tour.md) | Spotlight tours (bay, battle, map, Hangar, Academy) that replace the greetings, "Show me around" in the Field Manual |
| film | [r1-film.md](r1-film.md) | The pacing pass: replies 0.15 to 0.45 s, heard captions leave with the voice, waits of 5 s, joins of 1 s, the film's clock as data (`pace.ts`) |

## Integration (review round)
- The battle tour mounts in `WaveArena.tsx`: once (`tour:battle`), at the start of wave 2 of the cadet's first planet battle (campaign, no planet cleared), before any answer, holding the game (`hold.on("tour")`) while it shows.
- The Star map tour mounts in `SolarMap.tsx` in place of the map's greeting. The Hangar and Academy greeting mounts are gone; their tours speak for them. The map greeting's words stay in `src/teach/greetings.ts` for /dev/teach only.
- The film's first battle has a pause-menu way out ("Leave for now", to the Title).
- `ui.hint.squads` and `ui.hint.each` are typed `"on" | "off"` (`HintShow`); the console prints structure words only when one is `on`.
- Removed: the old icon-only Power-Up `Slot` and `EmptySlot` and their styles, and the bay's first-arrival greeting (its tour shows the screen instead).
- An empty belt's reserved Power-Ups space carries no `powerups` anchor, so the battle tour skips that step instead of spotlighting nothing.
- On phone widths (under 420 px) the wave dots drop their "0 won" words, which ran under the orb counter at 375 px.

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
| `/manual?topic=count` | The Field Manual on one page, full screen (Close goes back, or to the bay) |
| `/play/moon?dev&a=3&b=4` as a new cadet | The guided first shot on a planet battle (it shows once per cadet: sign up again to see it again) |
| `/intro` as a new cadet | The film, then Cadet Bay with its greeting and the guided first shot |
| `/intro?dev&pace=heard`, `/intro?dev&pace=read` | The film paced as with sound on, or as read alone (sound off); it stays muted |
| `/dev/teach/tour` | The spotlight tour on mock targets: every side, long lines, edges, missing and moving anchors |
| `/play/moon?dev&tour=battle` | The battle tour on the real cockpit, forced as soon as the screen is calm (review only) |
| `/map?at=<planet>`, `/map?locked=<planet>` | The Star map opened on one planet, or on a locked one with its line |
| `/dev/console` (Power-Ups pickers) | The Power-Ups list in every state, and the mission-over card |
