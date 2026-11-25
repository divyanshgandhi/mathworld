# STATE: mathworld, branch `overhaul/void-and-gold`

_Updated 26 Nov 2026, after the review round's fix pass. `main` still holds the previous version, untouched._

## What changed
- **Review round** (the owner's seven points in `OVERHAUL.md` "Review round"). Five tracks merged; their notes are `docs/overhaul/r1-*.md`, indexed in `docs/overhaul/README.md`. Six testers then judged the merged build, and this fix pass followed:
  - Film: the classroom waits 3 s, not 5, and a classmate's hand goes up 1 s in. The hangar join is 3.8 s (was 5.0), and the principal speaks 0.4 s sooner after the knock. Run with sound and no input, the film is about 107 s (was about 157 before the round).
  - Star map: the card is as wide as its words, with no 320 px floor. Each page centres its planet and card as one group, and the map also reads a resize from the window. The address keeps `?dev` bare.
  - Tours: the target scrolls into view at once, and scrolls back in after a rotation. The one-row plate is used only where it clears the ring. A cadet who has not flown gets no "Welcome back" line. The Hangar's first line is now "Paint, blasters and thrusters for your rocket." The Academy tour adds "Tap a trick to watch it." on the first trick (new anchor `academy-watch`).
  - Cockpit: the Power-Ups button is always on the console with its word. With an empty belt it is quiet, has no tour anchor, and its list says "No Power-Ups yet. Tap Show me how: each trick you watch becomes one." The button gets a gold edge when something fits. Dim rows keep their one line.
  - Playfield: when a scan follows a miss, the survivors gather without the "N left" label (decision 3).

## What is verified
- `bun run check` is green (410 tests), and `bun run build` passes at the last commit.
- Browser checks, muted, on a new cadet:
  - Map: the card hugs its words (1 px spare), and the group is centred at 1440 (margins 380 and 384). Resizing 1440 to 375 to 812x375 keeps the arrows, dots and launch in view. Map tour step 1 at 812x375 has no overlap.
  - Bay tour: step 3 is lit at 375x812 and 812x375, and it re-scrolls after a rotation. There is no welcome line.
  - Academy tour: both steps at 1440 and 375 with no overlap.
  - Power-Ups: the empty-belt list on Earth at 375 holds the game, and Close resumes it. The gold edge and the dim rows' lines on Jupiter 12x14.
  - Miss on 7x8 at 1440: the strip line comes first, there is no "55 left", the scan counts 1..7 one at a time, and "7 squads" comes last.
  - Film: the classroom invitation holds 3.0 s, stepped. The schedule shows only three gaps over 1 s: 3, 3 and 3.8.
  - No console errors.
- Not heard: sound. Not run: a real phone, Safari, reduced motion, the battle tour at phone sizes, and the mission-over card in a real campaign.

## Next, and open risks
- **The owner's seven points:**
  1. Film pacing: *answered, mostly.* Every reply is in range and the waits are cut to 3 s. The 5 s Launch wait stays, and listener reactions are still off camera.
  2. Power-Ups popup: *answered.* One button, the list, and the game holds. A new cadet now meets the button.
  3. Phone cockpit: *answered.* The console is three rows of 44 px or more. On a phone held sideways, Show me how is still an icon.
  4. Map card: *answered.* The card hugs its words and the group is centred.
  5. Map movement: *answered.* A small trackpad flick still snaps back.
  6. Guided helpers: *answered on the screens checked.* The bay, map and academy now work on phones. Bay step 2 on a phone held sideways still overlaps by about 20 px, because the table strip is 227 px of a 375 px screen.
  7. Play area: *partly.* The count is clean and the total comes last. But ships are about 10 px on a 360x640 phone (target 20). The strip reserves room down to y=166, and a 76 px caption band sits under the rocket. Shrinking either is a layout call.
- Not fixed:
  - Sector-Lock's row does not re-fit the fleet.
  - The Show me how "Your turn" beat says the question twice (Nova's caption and the strip).
  - The strip says "0 won" after retry or bonus wins with no reason given.
  - Uranus looks small inside its ring.
  - Nova's greeting overlaps the first guide line.
  - The nose number touches the fleet's box on 10x10 and 12x14 (not zoomed).
- **For the design lead:**
  - Does a locked planet name the cadet's next planet ("Clear Earth first." on Mars), or the one just before it?
  - The empty-belt Power-Ups line is new on-screen copy.
  - Should the film's Launch wait for the tap?
- **Lines to bake (film track only):** "Now count the ships in one squad." and "One squad. How many ships in it?", plus the list in `docs/overhaul/lines-to-bake.md`.
- **Still open from before:**
  - Offline answers pay once after reconnecting.
  - The bay with a times table open is an overload.
  - The retry guard lives in server memory.
  - Learning events are client-trusted.
