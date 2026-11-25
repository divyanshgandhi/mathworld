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
- **Wave 1 (foundations, in parallel):**
  - `kit`: tokens to CSS and Tailwind, Saira, the component kit, the top bar, the route fade, `DESIGN.md`.
  - `engine`: the battle split into a tested state machine, an event bus, systems and registries. No visual change.
  - `film`: the intro film fixed and re-lit, captions and cards in the new language, the cast redesigned.
  - `worlds`: looks, one planet factory, one Earth, the title scene, planet sprites for 2D.
  - `ships`: rocket, invader drones with squad leaders, pods and big ships, the hangar scene.
- **Wave 2:** Title and sign-up, Resting Bay in 2D, the battle as a cockpit with the hint ladder and real hit effects, Star map, Academy, Hangar shop, pause menu, economy logic.
- **Wave 3:** the teaching layer (guided first shot, Field Manual, first-visit lines, briefing cards), economy UI and the daily patrol, one copy pass.
- **Wave 4:** a full test sweep on desktop and phone, fixes, and documentation.

## Working rules for every track
- Work only inside your own worktree and commit only to your own branch. Never switch branches, never push, never edit another worktree or the `main` checkout.
- Edit only the files your track owns. If you need a change in a file you do not own, write it down in your handoff note; do not make it.
- Do not add dependencies unless there is no other way; say so in your handoff note if you do.
- Keep the public API of files other tracks import from you, or document the change.
- Write a handoff note at `docs/overhaul/<track>.md`: what changed, the APIs others should use, how you verified it, what is not done.
- Verify by playing it in a browser on your own origin, on desktop and at phone size. Check the console for errors.
