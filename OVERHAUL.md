# Math World overhaul: the shared brief

Branch `overhaul/void-and-gold`. `main` holds the previous version and is never touched by this work.

Read this file first, then `PRODUCT.md`, then the two approved prototypes, which are the visual truth:
- `design/bay-accretion.html` (Resting Bay, 2D)
- `design/title.html` (Title, 3D)

## Why this overhaul
A full audit found that the maths, the data model and the film's craft were sound, but the game did not feel like one game:
1. **Nothing teaches.** No screen shows how to shoot, no screen introduces itself, and there is no help anywhere.
2. **Answering is filling in a form.** A floating calculator panel does five jobs and moves while you tap.
3. **The UI has no art system.** Three font families, 14 text sizes, accents with no fixed meaning, about 25 button variants, emoji as icons.
4. **The big moments are the weakest thing on screen.** Tiny rocket and ships, a kill that is a 0.17 s shrink, a reward that is a text chip.
5. **No motion system.** Every HUD element pops in one frame, and every route change is a hard cut.
6. **Every 3D scene follows its own art rules.** Per-scene bloom and lighting, outlines on a few meshes, four different Earths.
7. **The hubs are dioramas with menus, not places.**
8. **Labels in the world look like debug output.**
9. **Names drift** (Resting Bay / Cadet Bay, Trick Cards / Tricks, mixed capitalisation).

## Non-negotiables
- **The maths core is exact and stays tested.** `src/rig/` owns all maths; state is folded from the event log (`src/director/fold.ts`). `bun run check` stays green on every commit.
- **Kid-first clarity beats cleverness.** Every screen must make sense to an 8-year-old with no explanation. Plain words. No invented jargon in copy. If a label needs a legend to be understood, redesign it.
- **One game for two ages.** Nothing talks down to an adult or overwhelms a child.
- **Learning comes first.** A game-feel idea that makes the maths less clear is rejected.
- **Public repository.** No secrets, no people's names, no paths outside the repo in any file or commit message.

## The learning model (protect this in every decision)
- **The answer is the action.** The player fires exactly as many plasma balls as their answer. The miss shows the error in the world: too few and ships survive, too many and balls fly past.
- **Multiplication is an array.** A fleet of `a × b` is `a` squads of `b` ships, always drawn as rows and columns that are true to the numbers.
- **Structure is discovered, not printed.** By default the formation itself shows the groups (gaps between squads, a leader ship per squad, a subtle tint per squad). Text labels for the structure appear only as hints after a miss:
  - Miss 1: the outcome plays out, Nova names the kind of mistake, then a squad scan counts the squads aloud.
  - Miss 2: an each scan counts the ships in one squad, and the Power-Up that fits starts to pulse.
  - Miss 3, or asking Nova: Show Me How (the worked example).
  - Facts the player has never met get a soft squad scan on first sight. Facts they know never get an unprompted hint.
- **Tricks are Power-Ups, free and unlimited.** They reshape the live fleet and never reveal the answer. They are never sold.
- **Mastery is honest.** It comes only from first-try accuracy and speed. Speed is measured silently; there are no visible timers. `0` is a valid answer.
- **Rewards follow learning.** Orbs come from first-try correct answers, Gold, streaks, clearing a planet and the daily patrol. Nothing rewards grinding.

## The design language: Void and Gold
Values live in `src/design/tokens.ts`. Never write a raw colour, font or duration anywhere else.
- **Ground:** one black, `#07070A`, on every screen, 2D and 3D.
- **Light:** one gold key light, a cool blue rim, ember for heat (exhaust, misses, the hot end of the action edge). **Only the Sun and the Launch moment glow.** Characters, ships and UI never glow or bloom.
- **Type:** Saira (variable, self-hosted).
  - Display: weight 200, stretch 125%, upper case. Titles, the wordmark, the big `a × b`.
  - Labels: weight 500–600, stretch 110–118%. Tracked capitals only on short labels.
  - Body: weight 400, sentence case, 16 px minimum. Anything a child must read is 17–20 px or more.
  - No monospace, no serif, no emoji, no Unicode glyphs standing in for icons.
- **Controls:**
  - Primary action: a pill with a blue-to-ember gradient edge on black and a ring-and-rocket glyph; the edge turns gold on hover. One primary action per screen.
  - Secondary: hairline pills. Icon buttons: round, 44 px.
  - Disabled is a neutral dim state. Never fade an accent colour to show disabled.
  - One drawn SVG icon set in one stroke weight.
- **Shapes:** hairline circles and dashed orbits are the house motif. Panels are rare: 16 px radius, 1 px hairline, near-black fill. No glass, no blur, no drop-shadow cards.
- **Mastery words and marks:** Gold (filled gold dot), Got it (filled white dot), Learning (blue outline dot), New (dim dot). Each mark reads without colour.
- **Motion:** one authored moment per screen. Exponential ease-out. A shared 200–250 ms fade between routes. Respect reduced motion.
- **3D:** three looks in `src/worlds/looks.ts`: `space` (title, battle), `interior` (the film's classroom), `hero` (hangar preview). All bodies are matte. Ink outlines only on small heroes (rocket, drones, Nova) at a consistent on-screen width.

### Refused defaults
These read as generic machine-made UI. Do not ship them:
- A small label ("kicker") above a heading.
- Same-size cards of icon plus heading plus text as page structure; cards inside cards.
- Glass or blur as decoration; gradient text; hard offset shadows; a coloured side border on cards.
- Monospace as a "technical" costume.
- Sparklines, progress rings and stat tiles standing in for content.
- A modal for something that needs no interruption.
- Text under 4.5:1 contrast (3:1 for large text).

## 2D and 3D
- **3D:** Title, battles (warm-ups included), the intro film, the hangar's rocket preview.
- **2D:** Resting Bay, Star map, Academy, pause menu, briefing cards, Field Manual, flashcards, sign-up.
- **The bridge:** 2D screens draw planets from the same planet factory the battle uses, so every Earth is the same Earth. Every 2D-to-3D hop is a designed transition.

## Game design principles for this pass
- **The world owns the centre.** Controls sit on the edges, in one fixed console that never reflows.
- **Eyes stay on the action.** What the player types appears on the cannon, not in a box.
- **Every action gets a reaction:** anticipation, impact, follow-through. A kill is a beat, not a fade.
- **Teach by doing.** The first shot is guided. Every screen greets the player once. Help is always one tap away.
- **Show only what is relevant now.** Two or three Power-Ups that fit this fleet, not ten.
- **One vocabulary.** See the glossary in `docs/glossary.md` once it exists; until then: Resting Bay, Star map, Hangar, Academy, squads, plasma balls, orbs, tricks, Gold.
- **Come back for mastery.** The return loop is a daily patrol of facts due for review and a wall of dots turning Gold.

## Plan
- **Wave 1 (done):** kit, engine, film, worlds and ships, merged, tested and fixed. Handoff notes: `docs/overhaul/README.md`.
- **Wave 2 (now):** seven tracks in parallel; see "Wave 2" below.
- **Wave 3:** wire the teaching layer into every screen (guided first shot, greetings, Field Manual links), the daily patrol on the bay, the film-to-battle hand-off, one copy pass and one voice bake.
- **Wave 4:** the final sweep on desktop and phone. Testers try everything that could break a child's game and score every screen for attention overload; fixers fix; a second pass confirms.

## Wave 2

### Decisions already made (do not reopen)
1. **No multiple choice.** The four-answer Targeting Radar row is gone for good. Hints are the ladder: squad scan, each scan, Show Me How.
2. **Structure is discovered by default.** Battles run with `structure: "discover"`. The "N squads · N ships each" line and the axis labels appear only when the ladder reveals them.
3. **The typed number lives on the rocket and on the Fire button** ("Fire 42"). There is no input box.
4. **Orbs are derived, not trusted.** The fold works out orbs from learning events. A client-sent amount is never believed.
5. **Flashcards pay no orbs.** The daily patrol pays once a day instead.
6. **The rig decides which Power-Ups fit** (`powerUpFits`). The battle draws every fleet so those tricks can act on it; no battle-only exceptions.
7. **Missions are named by their planet** on every label: Earth, the Moon, Mars. "Cadet Bay" stays only in the film's story lines. The hub is the Resting Bay.
8. **Orbs and Gold look different:** an orb is a gold ring with a count; Gold mastery is a filled gold bullseye.
9. **Earth may keep a thin atmosphere rim.** It never blooms. The Sun and the Launch moment are still the only glow.
10. **New spoken lines are captions first.** Only the film track bakes audio this wave. Everyone else lists new lines under "Lines to bake" in their handoff note.

### Tracks and what each owns
A file has one owner. Edit only what you own. Anything else goes in your handoff note as a request.

| Track | Builds | Owns |
| --- | --- | --- |
| `console` | The battle's 2D layer: the cockpit console, mission strip, Power-Up belt, briefing, reward, unlock and clear cards, pause menu | `src/components/battle/**` (not `ui.tsx`), `src/components/WaveArena.tsx`, `src/components/WarmupDrill.tsx` |
| `combat` | The battle's 3D layer: discover mode, scans, the number on the nose, volley, kill beat, misses, warp-in, backdrop, camera | `src/battle/**` (not `rewards.ts`), `src/worlds/space/{arena,warmup,skies,cadetBay,ships}.ts`, `src/engine/**` (not `overlay.ts`), `src/director/next.ts`, the `space` look |
| `front` | Title with sign-up, Resting Bay, flashcards, the kit, route transitions, error and loading states | `src/components/{TitleScreen,RestingBayScreen,SoundToggle}.tsx`, `src/components/hub/**`, `src/components/kit/**`, `src/design/**`, `src/app/{globals.css,layout.tsx,page.tsx,not-found.tsx,bay,kit}/**`, `src/worlds/space/title.ts`, `DESIGN.md`, `docs/glossary.md` |
| `places` | Star map in 2D, Academy in 2D, planet sprites | `src/components/{SolarMap,AcademyScreen}.tsx`, `src/components/world/**`, `src/app/{map,academy,dev/planets}/**`, `src/worlds/sprites.ts`, `src/worlds/space/{solarMap,planets,planetMaps,planetMaps.worker,bodies,earth}.ts`, `src/rig/academy.ts` |
| `economy` | Orb rules in the fold, the catalogue, the daily patrol logic, the Hangar shop | `src/director/{fold,hub,hangar,telemetry}.ts`, `src/battle/rewards.ts`, `src/db/**`, `src/app/{api,admin,hangar}/**`, `src/components/{HangarScreen.tsx,admin/**}`, `src/worlds/space/hangarBay.ts`, the `hero` look |
| `manual` | The Field Manual, first-visit greetings, the guided first shot, ship sprites | new `src/teach/**`, `src/components/teach/**`, `src/app/{manual,dev/teach}/**`, `src/worlds/shipSprites.ts`, `docs/teaching.md` |
| `film` | The intro film's beauty pass, Skip and replay, glossary words, the bake | `src/worlds/space/{intro,cast,classroom,town,hangar,hand,lines}.ts`, `src/components/IntroFilm.tsx`, `src/app/{intro,dev/cast}/**`, `src/engine/overlay.ts`, `public/vo/**`, `scripts/bake-voices.py`, the `interior` look |

Frozen for everyone: `src/rig/**` (except `academy.ts`), `src/components/battle/ui.tsx`, `package.json`, the lockfile, `OVERHAUL.md`, `PRODUCT.md`, `CLAUDE.md`, `STATE.md`. Build a replacement in a file you own instead of editing `ui.tsx`. Tests belong to whoever owns the code they test.

### Contracts between tracks
- **Console to arena** (all of these exist today): `arena.fire(n)`, `arena.setCharge(n | null)` on every keypad change, `arena.setSafe({ top, right, bottom, left })` with the console's footprint in px, `arena.captionAt(px, side)`, `arena.showMeHow()`, `arena.powerUp(id)`, `arena.bus.on(type, fn)`, and `ArenaUi` (`wave`, `canFire`, `outcome`, `hint`, `belt`, `sectors`, `lesson`, `unlock`, `offer`, `done`, `orbs`).
- **`ArenaUi.radar` is always `null`** from now on. Console does not read it. Combat keeps the field in the type and keeps `arena.radar` as a harmless alias of `fire`.
- **`ArenaUi.hint`** drives every structure word in the console: nothing about squads or ships each is shown unless `hint.squads` or `hint.each` is `"on"` or `"soft"`. `hint.powerUp` names the Power-Up to pulse.
- **Guide anchors:** the console marks its parts with `data-guide="question" | "keypad" | "fire" | "help" | "powerups" | "orbs"`. The guided first shot points at these.
- **Seen keys:** a first-visit greeting or guided step is recorded with `emit({ type: "seen", payload: { key } })` and read from `state.seen[key]`. Keys: `greet:<screen>`, `guide:<step>`, `manual:<page>`.
- **Help:** `TopBar`'s `onHelp` opens the Field Manual. Until the tracks merge, a screen may leave `onHelp` unset.
- **Planet art:** every 2D planet is `<PlanetSprite id size />`. Every 3D planet is `makeBody`.
- **The film's last frame** is the rocket at bottom centre on the void with Earth's horizon below. The Earth battle opens on the same frame, so the cut is clean.

## Review round (after the owner played the wave 2 build)

The owner played the merged build and gave seven points. They are the brief for this round, and they win over anything above that disagrees.

1. **Film pacing.** The pauses are too long. It does not feel like natural dialogue, between characters or between lines.
2. **Power-Ups as a popup.** Tapping Power-Ups opens a popup that shows the list properly.
3. **Phone cockpit.** On a phone the cockpit is crowded and jumbled.
4. **Star map card.** Too much empty space, not aligned with its text. "You are here" is a chip above the title.
5. **Star map movement.** One planet at a time, by natural scrolling or arrows, opening on the current planet. Not all the planets in one row.
6. **Guided helpers.** A highlighted guide that shows the student what is available, like the tour of a complex interface.
7. **The play area.** At a wave's start, squad lines and count numbers appear and collide, and the total is visible while the count runs. Everything that happens in the play area is to be dissected and put right.

### Decisions for this round (closed)
1. **Nothing is drawn on the fleet before the first answer.** No bracket, no row numbers, no "7 squads", for any fleet, met or never met, including 0 x n and 1 x n. The first-sight soft scan is retired; `ui.hint` never says `soft`.
2. **A scan counts one thing at a time.** One squad lights, one number shows beside it, big enough to read, in a lane outside the fleet. The number before it goes. The total ("7 squads") does not exist on screen, in the world or in the strip, until the last squad has been counted. `ui.hint.squads` and `ui.hint.each` turn `on` only when their count has finished.
3. **One voice at a time during a hint.** The strip's miss line, then the scan, then Nova's short line. Never four sources of words inside three seconds.
4. **One Power-Ups button.** The console has a single button with the word "Power-Ups". It opens a list: glyph, name, one line of what it does, and whether it fits this fleet. Tapping a row that fits closes the list and runs it. The game holds while the list is open. No icon-only Power-Up buttons anywhere.
5. **The phone console has three rows:** digits, digits, then Power-Ups, delete and Show me how, each with its word, each 44 px or more.
6. **The Star map is a pager.** One planet a page, swipe or scroll sideways, arrows at the sides, arrow keys, a row of ten dots for the whole journey. It opens on the cadet's planet. Neighbours peek at the edges.
7. **The map's card is as wide as its words.** Chip ("You are here", "Cleared", "Locked"), name, one line, the table rows, one button. A locked planet names the next planet to clear, not one two steps away.
8. **Tours are spotlights.** A dimmed screen with a cut-out round one control, one line of ten words or fewer, dots, Next and Skip. Four steps at most, one idea a step, shown once (`tour:<id>`), replayable from the help button. A tour never runs with the guided first shot, never during a wave's action, and replaces that screen's greeting.
9. **Dialogue has a rhythm.** A reply starts 0.15 to 0.45 s after the line before it ends; the same speaker's next thought 0.3 to 0.6 s; a change of scene 0.6 to 1.0 s. No silent hold over 1.2 s unless something is visibly happening. A heard caption leaves with its voice. Read alone (sound off), a caption holds 0.8 s plus 0.42 s a word.
10. **No new spoken line without its clip.** A changed line is re-baked in the same commit, by the film track only. Other tracks pick an existing line or stay silent.

### Tracks and what each owns (review round)
| Track | Builds | Owns |
| --- | --- | --- |
| `film` | Point 1: the pacing pass, with a timeline of every gap before and after | the film's files, `src/engine/overlay.ts`, `src/worlds/space/lines.ts`, `public/vo/**`, `scripts/bake-voices.py` |
| `cockpit` | Points 2 and 3: the Power-Ups list, the phone console, plus the orb counter that lags its "+N orbs" line and a card for a mission that was not won | `src/components/battle/**` (not `ui.tsx`), `src/components/WaveArena.tsx`, `src/components/WarmupDrill.tsx` |
| `map` | Points 4 and 5: the Star map as a pager with a compact card | `src/components/SolarMap.tsx`, `src/components/world/**`, `src/app/map/**` |
| `tour` | Point 6: the spotlight tour and its tours | `src/teach/**`, `src/components/teach/**`, `src/app/dev/teach/**`, `docs/teaching.md`; attribute-only edits (`data-guide`) in `RestingBayScreen.tsx`, `HangarScreen.tsx`, `AcademyScreen.tsx` and the kit's `TopBar` |
| `playfield` | Point 7: the dissection (`docs/overhaul/playfield.md`), the scan, labels that cannot collide, fleet size on phones | `src/battle/**` (not `rewards.ts`), `src/worlds/space/{arena,warmup,skies,cadetBay,ships}.ts`, `src/engine/**` (not `overlay.ts`, not `outbox.ts`), `src/director/next.ts` |

Frozen for every track: `src/rig/**`, `src/director/{fold,hub,hangar}.ts`, `src/db/**`, `src/app/api/**`, `package.json`, the lockfile, `OVERHAUL.md`, `PRODUCT.md`, `CLAUDE.md`, `STATE.md`.

### Contracts (review round)
- **Arena and console:** unchanged. `arena.powerUp(id)`, `ui.belt`, `ui.hint.powerUp`, `arena.setSafe`, `arena.captionAt`, `hold.on(reason)` and `hold.off(reason)`.
- **Hints:** `ui.hint.squads` and `ui.hint.each` are `'on' | 'off'`; `on` arrives when the count has finished. The console prints structure words only from `ui.hint`.
- **Guide anchors** (`data-guide`), which the tour finds by name:
  - battle: `question`, `keypad`, `fire`, `help`, `powerups` (the one button), `orbs`, `dots` (the mission's wave dots), `pause`;
  - Star map: `map-planet`, `map-card`, `map-prev`, `map-next`, `map-dots`, `map-launch`;
  - Resting Bay: `bay-launch`, `bay-tables`, `bay-places`, `orbs`, `help`;
  - Hangar: `hangar-list`, `hangar-rocket`, `hangar-buy`; Academy: `academy-list`.
- **Tour:** `<Tour id steps />` from `src/components/teach`, where a step is `{ anchor, line }`. Seen key `tour:<id>`. `hold.on('tour')` while it runs in a battle.
- **Handoff notes:** `docs/overhaul/r1-<track>.md`.

## Working rules for every track
- Work only inside your own worktree and commit only to your own branch. Never switch branches, never push, never edit another worktree or the `main` checkout.
- Edit only the files your track owns. If you need a change in a file you do not own, write it down in your handoff note; do not make it.
- Do not add dependencies unless there is no other way; say so in your handoff note if you do.
- Keep the public API of files other tracks import from you, or document the change.
- Write a handoff note at `docs/overhaul/<track>.md` (`w2-<track>.md` in wave 2): what changed, the APIs others should use, how you verified it, what is not done, and any "Lines to bake".
- Verify by playing it in a browser on your own origin, on desktop and at phone size. Check the console for errors.
- Stay silent: set `localStorage["mw:mute"] = "1"` on your own origin before anything plays. Never press M or click the speaker.
- The browser pane is shared and usually hidden. Pass your own `tabId` on every browser call. While hidden, CSS transitions do not advance and the 3D clock is slow: call `document.getAnimations().forEach(a => a.finish())` before a screenshot, and step the stage (`window.__mw.stage`) to judge motion.
