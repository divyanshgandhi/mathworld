# Console track (wave 2): handoff

Branch `overhaul/w2-console`. The floating calculator is gone. The battle's 2D layer is now a cockpit:
- a mission strip along the top;
- one fixed console on the edge;
- a small set of cards, each with one primary action.

The world owns the middle of the screen.

## What changed

| File | What it is |
| --- | --- |
| `src/components/battle/BattleHud.tsx` | Rewritten. It composes the strip, the console and the cards for every battle: planets, Cadet Bay in the film, the Academy. Same export and props as before. |
| `src/components/battle/Console.tsx` | New. `Console` (the instrument band), `useEntry` (the typed number and every input-safety rule), `Slot` and `EmptySlot` (Power-Up slots), `CARD_OPEN`, `fmtN`. |
| `src/components/battle/MissionStrip.tsx` | New. `MissionStrip` (menu, wave dots, the question, orbs, sound, and two reserved message lines) and `useOrbReward` (orbs fly to the counter, then it ticks up). |
| `src/components/battle/Cards.tsx` | New. `Card`, `BriefingCard`, `UnlockCard`, `OfferCard`, `ClearCard`, `PLANET_TEACHES`. |
| `src/components/battle/PauseMenu.tsx` | Rewritten. Resume is the primary action, then How to play, Sound, Star map and Resting Bay. Pausing really pauses. Also exports `usePauseWhenHidden`. |
| `src/components/battle/pause.ts` | New. `hold`: one switch with named reasons (`menu`, `card`, `hidden`). It drives `window.__mw.stage.paused` and suspends or resumes the audio context (voice, music bed, effects). |
| `src/components/battle/layout.ts` | New. `layoutFor(w, h)`, `useConsoleLayout()` and `useReducedMotion()`. |
| `src/components/battle/PowerUpGlyph.tsx` | New. One drawn mark per trick, in the kit's icon style: a small picture of what the trick does to rows and columns. Also `POWERUP_DOES` (one plain line per trick) and `SECTOR_LOCK_DOES`. |
| `src/components/battle/cockpit.css` and `cockpit.ts` | New. Every cockpit style, using token variables only. Each class is prefixed `mwc-`, and `css.fire` is `"mwc-fire"`. See the note below. |
| `src/components/WaveArena.tsx` | The game root is focusable and focused, so the keyboard works without a click. No selection, `touch-action: manipulation`. Passes `structure: "discover"`. The end-card buttons moved into `BattleHud`. |
| `src/components/WarmupDrill.tsx` | Mercury and Venus use the same strip, console, briefing and clear card. There is no help, and the Power-Up slots stay quiet. |
| `src/app/dev/console/` | Review route `/dev/console`. Shows the console in each state (ready, loaded, miss, lesson, Your turn, Sector-Lock, warm-up), every card, and the ten glyphs. |
| `tests/console.test.ts` | Covers the layout per screen shape, a line for every Power-Up (with no answer in it), and a briefing for every planet and warm-up. |

### The console
It is one band with the same parts everywhere: Power-Ups, keypad, Fire and help. Its arrangement depends only on the screen, never on the game:

| Layout | When | Where |
| --- | --- | --- |
| `pad` | portrait (`h >= w`) | A band along the bottom. A 3 × 4 keypad on the left (`0` is two keys wide), Fire two rows tall on the right, Power-Ups and "Show me how" under Fire. `env(safe-area-inset-bottom)`. Keys are `clamp(48px, 7.2dvh, 60px)`; content is at most 500 px wide. |
| `column` | landscape under 540 px tall | A column on the right: Power-Up row, keypad, then Nova's round help button and Fire across the bottom. Keys are 48 px. The strip spans only the free area. |
| `strip` | landscape, 540 px tall or more | A slim strip along the bottom. Power-Ups on the left (named from 1300 px wide, glyphs only below). In the middle, two rows of digits (1–5 and 6–0), delete, then Fire. Help on the right. |

- **Fire** is the largest control. It reads "Fire" when empty (neutral dim, disabled) and "Fire 42" when loaded (gold edge). During Sector-Lock it reads "Lock 120". It is never an input box.
- Keys and Fire do nothing while `ui.canFire` is false, a card is open, or the menu is open.
- A visually hidden `aria-live` line announces "42 plasma balls loaded".
- **`useEntry` rules:**
  - Digits, Backspace and Enter from the window.
  - Key auto-repeat is ignored.
  - Input is capped at `digits(a × b) + 1`.
  - `00` becomes `0`, and `0` is a valid answer.
  - `arena.setCharge(n | null)` runs on every change.
  - Enter on a focused button presses that button instead.
- Console buttons `preventDefault` on mouse down, so a tap never takes focus from the game and Enter still fires afterwards.
- **Power-Ups:**
  - Only the belt items with `fits`, at most three, in belt order. The hinted one and any active one are always kept.
  - Empty slots are blank and keep their place.
  - The Power-Up named by `ui.hint.powerUp` gets a dashed gold orbit that turns slowly. There is no glow, and it is static under reduced motion.
- **Sector-Lock:** the Power-Up slot becomes one scrolling row of sectors. Locked sectors have a gold edge and the current one a white edge. On the strip, "3 of 12 locked" stays pinned at the start of the row. On phones the count moves to the second message line, because the slot is too narrow. When every sector is locked, their sum loads onto Fire and the sum shows under the question.

### The mission strip
- The question sits top centre in the display voice and is the largest type on screen. Long fleets step the size down instead of wrapping.
- Under it are two reserved lines, so nothing moves when they fill:
  - Line 1: the outcome ("Exactly right · +5 orbs", "5 ships got away. Try again.", "5 plasma balls flew past. Try again."), or the lesson ("Nova shows you Double It!", then "YOUR TURN" in gold label caps).
  - Line 2: the structure words, the lesson's why or equation, or the Sector-Lock sum.
- Structure words ("6 squads", "7 ships each") show **only** when `ui.hint.squads` / `ui.hint.each` is `"on"` (normal) or `"soft"` (dimmer). With `hint` null they never show.
- Miss counts come from the shot itself: `|fired − a × b|`. `outcome.value` is only a fallback. Ember is used, never the word wrong, never a flash.
- WaveDots:
  - campaign: in-tier waves (3 on Earth, 4 elsewhere) and `mission.solved` from `fold(arena.log())`;
  - practice: `wave.of` and `wave.index`;
  - Academy: none.
- The strip mounts `topBars` so the floating sound button hides. The `orbs` wrapper is the target of the reward flight. `ui.radar` is never read.

### Cards (ui-sdk `Dialog`, plain scrim, no blur, one primary each)
- **Briefing** (`launch` and not started):
  - the planet as `PlanetSprite`;
  - its own name ("Earth", never "Cadet Bay");
  - what it teaches, from `PLANET_TEACHES`;
  - "Win 3 of 4 waves." (Earth "Win 2 of 3 waves.", practice "5 practice waves.");
  - Launch, which has focus, so Enter launches.
- **New Power-Up:** queued from `ui.unlock`, held until "Got it". It holds the game still (`hold.on("card")`), because the arena clears `ui.unlock` after 3.2 s. It shows the glyph in a dashed gold ring, the name, and what it does to the fleet. Sector-Lock gets its own name, lock glyph and line.
- **Hyper-Jump:** titled with the planet. "You are flying through these. Jump ahead to Jupiter?" Jump (primary), Stay here.
- **Planet clear:**
  - the sprite inside a gold ring that closes in over `MOTION.moment` (the one authored moment);
  - "The Moon is clear";
  - "+40 orbs" earned in this battle;
  - "Mars is open.";
  - Fly to Mars (primary), then Star map and Resting Bay.
  - With `doneActions` (Academy, film), those buttons are used instead.
- **Pause:** Resume (primary), How to play, Sound, Star map, Resting Bay.
  - Escape toggles it, but not while another card is up.
  - A hidden tab holds the game and resumes it exactly where it was; a pause the player chose stays a pause.

### Telling the 3D side where the cockpit is
`useCockpitSafe` measures on mount, resize and rotation only, and calls:
- `pad`: `arena.setSafe({ top: strip bottom + 6, right: 0, bottom: console height + 76 })` and `arena.captionAt(console height + 10, "centre")`. Nova's caption has its own 76 px band right above the keypad.
- `column`: `setSafe({ top, right: console width, bottom: 64 })` and `captionAt(8, "left")`.
- `strip`: `setSafe({ top, right: 0, bottom: console height + 8 })` and `captionAt(console height + 14, "left")`.
- It never sets `left`, which belongs to the X-Ray.

### Note on CSS
`next.config.ts` has a Turbopack rule that runs every `*.css` file through Tailwind as `*.css`, so CSS Modules do not work: `.module.css` comes out global, with no class map. The cockpit styles are therefore a global sheet with an `mwc-` prefix, and `cockpit.ts` maps names to classes.

## APIs other tracks should use
```ts
import { BattleHud, missLine, planetName, useCockpitSafe, type Safe } from "@/components/battle/BattleHud";
import { Console, useEntry, Slot, EmptySlot, CARD_OPEN, fmtN } from "@/components/battle/Console";
import { MissionStrip, useOrbReward } from "@/components/battle/MissionStrip";
import { Card, BriefingCard, UnlockCard, OfferCard, ClearCard, PLANET_TEACHES } from "@/components/battle/Cards";
import { PauseMenu, usePauseWhenHidden } from "@/components/battle/PauseMenu";
import { hold } from "@/components/battle/pause";              // hold.on(reason) / hold.off(reason) / hold.clear()
import { layoutFor, useConsoleLayout, useReducedMotion } from "@/components/battle/layout";
import { PowerUpGlyph, POWERUP_DOES, SECTOR_LOCK_DOES } from "@/components/battle/PowerUpGlyph";
import { css } from "@/components/battle/cockpit";            // css.root === "mwc-root"
```
- `BattleHud({ arena, ui, onFly?, dev?, drone?, doneActions?, launch?, menu? })` is unchanged and source-compatible.
- `PauseMenu({ label = "Paused", blocked?, onOpenChange? })`: new optional props only.
- **Guide anchors** for the guided first shot (manual):

  | Anchor | Element |
  | --- | --- |
  | `data-guide="question"` | the `h1` |
  | `data-guide="keypad"` | the console's grid: keys, Fire, slots and help |
  | `data-guide="fire"` | Fire |
  | `data-guide="help"` | Show me how (absent in warm-ups and the Academy) |
  | `data-guide="powerups"` | the Power-Up slot area |
  | `data-guide="orbs"` | the orb counter |

  Each digit key also carries `data-key="0".."9"`, so a guide can point at one key. The game root carries `data-cockpit`.
- **Open card test:** ui-sdk dialogs are `div[data-slot=dialog-content][data-open]`, not `<dialog>`, so `dialog[open]` never matches. Use `CARD_OPEN`.
- **Arena contract used:** `fire`, `setCharge`, `setSafe`, `captionAt`, `showMeHow`, `powerUp`, `selectSector`, `lockSector`, `start`, `acceptJump`, `declineJump`, `log`, and `ArenaUi` (`wave`, `canFire`, `outcome`, `hint`, `belt`, `sectors`, `lockTotal`, `lesson`, `unlock`, `offer`, `done`, `orbs`, `invite`, `mode`, `started`, `planet`). `radar` and `poke` are not used.

## Mounting (for the integrator)
Nothing extra to wire. `/play/[planet]` already renders `WaveArena` and `WarmupDrill`. IntroFilm (Cadet Bay) and the Academy get the new cockpit through `BattleHud` with no change to their files.

After merging:
1. Check that combat's `mountArena` still accepts `structure: "discover"`. `WaveArena` passes it, because battles run discover per decision 2.
2. Once the guided first shot exists, check the guide anchors above.
3. Optional: drop the `?discover` dev switch in `mountArena`, which is now redundant on planets.

## How I verified it
`bun run check` is green: 205 tests (202 plus 3 new).

All of the following was seen in my browser tab on `console.localhost:3321`, muted, with the stage stepped by hand.

**Bounding boxes.** At each size I measured the console, Fire, the 1 key and the strip at five moments: the start of a wave, after a miss, after a Power-Up, during Show me how, and on the next wave. They were identical at every size:

| Size | Layout | Console | Keys |
| --- | --- | --- | --- |
| 1440×900 | strip | 139 px (15% of the height) | 52 px |
| 360×640 | pad | 231 px (36%) | 48 px |
| 812×375 | column | 221 px wide | 48 px |
| 768×1024 (Jupiter) | pad | 279 px (27%) | 60 px |

375×812 was also checked: pad, 273 px (34%), boxes identical through a miss and a lesson. 1024×768 (strip) was reached by rotating mid-wave from 768×1024, and the layout and safe area updated.

**Flows seen:**
- Moon 6×7: under ("2 ships got away"), over ("8 plasma balls flew past"), hint words appearing only when `ui.hint` said so (soft "6 squads" on a new fact; then "6 squads · 7 ships each" on miss 2), the pulsing Power-Up, Show me how ("Nova shows you Jump One More", then "YOUR TURN / 36 + 6 = ?"), and an exact shot. Five orb flyers were created, the counter went from 0 to 5, and the next wave and its dot moved on.
- A double click on Fire fired once.
- Typing 9 digits on 27×73 stopped at 5. `00` became `0`. Moon 0×7 with `0` gave exactly right.
- Earth campaign played through with the keyboard: the Hyper-Jump card (Stay here), then "EARTH IS CLEAR", "+40 orbs", "Fly to the Moon".
- Saturn 16×24 Sector-Lock: four locks, sum "200 + 40 + 120 + 24 = 384" loaded on Fire, fired, next fleet.
- Jupiter on the tablet: three misses into Show me how, and the New Power-Up card for Big & Small Split held the game until "Got it".
- Pause with Escape: stage clock frozen, audio context suspended, digits ignored. Escape again resumed and gave focus back to the game root. A simulated hidden tab paused and resumed.
- Mercury warm-up: briefing, a miss ("1 drone got away"), all five, then "WARM-UP DONE", "+4 orbs", "4 of 5 on the first try".
- The Academy (Double It! film) and the film's Cadet Bay chapter render the new cockpit.
- `/dev/console`: every card, and the 360×640 clear card with no overflow after a fix.

**Console errors.** None from these files. The only errors seen were `InvalidStateError: Transition was aborted ... Document hidden` from route View Transitions while the pane was hidden (see Requests).

**Inferred, not seen:**
- The orbs' flight path mid-air. The pane was hidden, so I saw the flyers created and the count tick, but not a frame of the flight.
- Real touch devices and real safe-area insets.

## Not done or not verified
- The number on the rocket's nose is combat's (I call `setCharge`). I saw `ui.charge` update, not a drawn number.
- Not tried on a physical phone or tablet; emulated sizes only. Not checked with a screen reader.
- Holding the game when the tab is hidden covers the stage clock and audio. The warm-up's 0.9–1.5 s "ready" delay and any wall-clock caption timers in `voice.ts` still run.
- On tablet-landscape widths under 1300 px the Power-Ups show glyphs without names (names are in `aria-label` and `title`). Phones in both orientations show glyphs only. The New Power-Up card teaches each glyph with its name.
- The 3D framing issues listed under Requests were seen, not fixed (not my files).
- No spoken lines were added.

## Requests for other tracks
- **combat**
  - During Show me how on desktop (1440×900, Moon 6×7), the lesson framing pushed the rocket down behind the console. Please keep the rocket above `safe.bottom` in the lesson frame too.
  - On phones (375×812, 360×640) the fleet and rocket sat off-centre in the free area. It looks like the reserved axis-label pad on one side. Please centre the fleet and rocket in the free area.
  - `outcome.value` today is the remainder or the extra. The console no longer depends on it (it uses the fired number), so either meaning is fine.
  - The arena's `done.title` strings ("NAILED IT", "PRACTICE COMPLETE", "Cadet Bay clear") are mapped to plain sentence-case titles here. A structured `done.kind` would be cleaner.
- **film** (owns `src/worlds/space/lines.ts`): `nova_invite` still says "Try a Power-Up, the Radar, or Show Me How". The Radar is gone, so the line needs new words and a re-bake.
- **front**
  - `RouteFade`: the `ViewTransition` promise rejects with `InvalidStateError ... Document hidden` when a route changes in a hidden tab. Please catch it.
  - `next.config.ts` (frozen for me): the Turbopack `*.css` rule disables CSS Modules. If that is unintended, a `*.module.css` exception would let tracks scope styles.
  - Optional: if the kit wants the ten Power-Up glyphs in `Icon`, they are in `PowerUpGlyph.tsx`.
- **places:** `SolarMap.tsx` checks `document.querySelector("dialog[open]")`, which never matches ui-sdk dialogs. Use `[data-slot=dialog-content][data-open]`. The same is true of `Keypad` in the frozen `battle/ui.tsx`, which no battle uses any more.
- **manual:** anchors as listed above. `data-guide="keypad"` is the whole instrument cluster. Use `[data-key="1"]` to point at a single key.

## Lines to bake
None. Every new word in this track is on-screen copy, not speech.
