# Review round: cockpit (points 2 and 3)

Branch `overhaul/r1-cockpit`. Owner's points 2 (Power-Ups as a popup) and 3 (the phone cockpit), decisions 4 and 5, and three faults testers found on the battle screen.

## What changed
- **One Power-Ups button** in every arrangement (pad, column, strip): the trick glyph in a small ring and the word "Power-Ups" at 17 px. The three round slots are gone from the battle. Its place is always reserved; with nothing on the belt it is an empty space of the same size. It rests during a lesson, a card, the menu, or while Sector-Lock's sectors are up.
- **The Power-Ups list** (`PowerUpList`). On a phone held upright (pad, under 600 px wide) it is the kit's bottom sheet (ui-sdk Popover `presentation="sheet"` with the kit's `mw-sheet mw-dialog` classes). Everywhere else it is a small dialog anchored to the button: above it on a laptop or a tablet held upright, to its left on a phone on its side. Title "Power-Ups". One row for each Power-Up on the belt: glyph, name, what it does (`POWERUP_DOES`, or `SECTOR_LOCK_DOES`), and "On" when it is switched on. A row that fits is a button. A row that does not fit is dim and says "Not for this fleet". The hinted row comes first with a "Try this" chip. Rows are 64 px or more, and the list scrolls after about five. When nothing fits, one line comes first: "No Power-Up fits this fleet. Tap Show me how."
  - Tapping a row that fits closes the list and calls `arena.powerUp(id)` once per opening, however fast it is tapped.
  - While it is open the game holds (`hold.on('powerups')`) and resumes on close.
  - It closes on Escape, the scrim or a press outside, or the Close button. Focus returns to the Power-Ups button. Arrow keys, Home and End move between rows. Enter runs a row. The key P opens it.
  - Enter on the Power-Ups button still fires the loaded number (`data-enter-fires`), so a player whose focus came back to it can keep playing from the keyboard. Space opens the list.
- **The hint orbit.** When `ui.hint.powerUp` names a Power-Up that fits (after the second miss), or one has just landed on the belt, the button's glyph ring takes the slow dashed gold orbit. Under reduced motion it is drawn but holds still. The list never opens by itself.
- **The phone console** (pad layout under 900 px tall) has three rows: digits 1 to 5, digits 6 to 0, and Fire spanning both rows on the right. The third row holds Power-Ups (glyph and word), Delete (its glyph, named "Delete"), and Show me how (in words). At 320 px wide or less, the words in the third row narrow on Saira's width axis instead of clipping. A tall pad (tablet) keeps its 3x4 keypad, with Power-Ups where the slots were.
- **Sector-Lock** moved out of the slots. Its sectors are a row under the question in every arrangement (`MissionStrip`'s new `below` prop). The count line ("1 of 4 sectors locked") now shows in every arrangement.
- **Orbs agree with their line.** The counter jumps to the new total at the same moment "+N orbs" appears. The flying orbs are only a flourish and no longer gate the number.
- **Mission over.** A mission that ends without a win no longer restarts silently. Before the next mission's first wave can be played, one card shows: "Mission over", "You won 1 of 3.", a primary "Try again" (closes the card; the next mission's first fleet is waiting) and a quiet "Resting Bay". The game holds while it is up (`hold.on('mission-over')`). Detection is a pure function, `missionOver(prev, state)` in `battle/mission.ts`, with tests.
- **Pause menu.** Added `data-guide="pause"` on its trigger and an optional `leave` prop for the first battle (see the requests below).
- **Anchors:** `data-guide="powerups"` is on the one button (or on its empty space), `"dots"` on the mission's wave dots, and `"pause"` on the menu button. `question`, `keypad`, `fire`, `help` and `orbs` are unchanged.
- `/dev/console` has a third row of pickers for the list: closed, empty belt, one fits, three, hinted, none fit, seven (scrolls). It also has a "mission-over" card. These work in all three arrangements; resize to switch.

## APIs (all additive; existing exports kept)
- `src/components/battle/PowerUps.tsx`:
  - `PowerUpsButton({ empty, disabled, orbit, reduced, open, onPress, buttonRef? })`
  - `PowerUpList({ open, onClose, onPick, belt, hinted, layout, anchor })`
  - `orderBelt(belt, hinted)`, `NONE_FIT`, `type BeltItem`
- `src/components/battle/mission.ts`: `missionOver(prev, state)` and `type MissionSeen`.
- `src/components/battle/Cards.tsx`: `MissionOverCard({ open, won, of, onAgain, onRest })`.
- `src/components/battle/layout.ts`: `useNarrow()`, true under 600 px wide.
- `src/components/battle/MissionStrip.tsx`: new optional prop `below`.
- `src/components/battle/PauseMenu.tsx`: new optional prop `leave?: { label, href }`, shown only with `places={false}`.
- `src/components/battle/Console.tsx`: `CARD_OPEN` now also matches an open popover, so keys rest and the pause menu leaves Escape to the list. `Slot` and `EmptySlot` are still exported but nothing in the battle uses them now.
- For the tour: spotlight `[data-guide="powerups"]` for the button. The list is `[data-pu-list]` inside `[data-slot="popover-content"]`.

## Mounting
Nothing for the integrator to wire: `BattleHud` mounts the button, the list and the mission-over card itself. `WarmupDrill` passes an empty `PowerUpsButton` so its console keeps the same size.

## Verified
SAW in the browser on `cockpit.localhost:3321`, in a real practice battle (`/play/moon?dev&a=6&b=8`, `&a=6&b=7`, `/play/jupiter?dev&a=12&b=14`) and on `/dev/console`:
- **Console bounding box unchanged** at wave start, after the first miss, after the second miss, and with the list open and closed: 1440x900 `[0,761,1440,139]`, 1024x768 `[0,629,1024,139]`, 812x375 `[591,0,221,375]`, 375x812 `[0,635,375,177]`.
- **Height share:** 375x812 is 22% (limit 34%); 360x640 is 28% (limit 38%); 320x568 is 31%. Every control is 44 px or more: keys 44x48 at 320, and the third row is 126 / 48 / 114 px wide with 8 px gaps. Both words fit without clipping at 320, 360 and 375.
- **The list:**
  - It is an anchored dialog above the button at 1440x900, 1024x768 and 768x1024, a bottom sheet at 375x812, and beside the button at 812x375, where it is whole, readable and scrolls.
  - It holds the game: `stage.paused` is true and `stage.time` did not move in 0.8 s. It resumes on close.
  - Focus lands on the first fitting row. ArrowDown moves it. Escape, Close and a tap on the scrim each close it, and focus returns to Power-Ups. Escape did not open the pause menu.
  - Choosing Flip It! from the list flipped the question to 7×6, and its row then showed "On". A triple click on the row ran it once.
  - Mashing open and close 12 times (click, P, Escape, Close) left no stuck state: closed, not paused, and the clock running.
- **Enter fires after the list closes**, with focus on Power-Ups: "Fire 42", then "Exactly right · +5 orbs" with the counter at 5 in the same frame.
- **After two misses** at 1440x900: the button has the orbit, and the list puts "Jump One More" first with "Try this".
- **Sector-Lock on 12 x 14** at 375x812: the sectors sit under the question, all four locked from the keyboard, and the line and Fire read 100 + 40 + 20 + 8 = 168 / "Fire 168". The console box did not change.
- **The mission-over card** renders at 375x812 on `/dev/console`.
- The console showed one hydration mismatch on `/dev/console` at the moment an edit hot-reloaded. The server's HTML was current afterwards. INFER: it was a stale-server artifact.

NOT verified in the browser: the mission-over card in a real campaign (reaching a failed mission needs a whole played mission). It is covered by unit tests of `missionOver`. Also not verified: rotating with the list open, and reduced motion (by code, the orbit holds still).

## Not done
- The list stays open through a rotation (pad to column). INFER: it re-anchors, but this is untested.
- Where Sector-Lock's row appears mid-wave, the strip grows by one row. The safe area is re-measured, but the fleet already on screen is not re-laid out, so at 375x812 the sector row touches the top of a 12 x 14 fleet (SAW).

## Requests for other tracks
- **film** (`src/components/IntroFilm.tsx`, line 259): give the first battle's pause menu a way out. One-line change: `menu={<PauseMenu places={false} leave={{ label: "Leave for now", href: "/" }} />}`. The menu then offers Resume, How to play, Sound and Leave for now. Point `href` wherever a cadet who has not finished the film should land.
- **playfield**:
  - When `arena.setSafe` changes top mid-wave (Sector-Lock's row appearing under the question), re-fit the fleet to the new free area.
  - At 375x812 I SAW row numbers (1 to 4) drawn on a 6 x 8 fleet before any answer. Decision 1 says nothing is drawn before the first answer.
- **tour**: the anchors are in place (`powerups`, `dots`, `pause`). The Power-Ups list holds the game under its own reason, `powerups`, so a tour step must not open it.
