# Combat track (wave 2): handoff

Branch `overhaul/w2-combat`. The battle's 3D layer: structure discovered, not printed; the number on the nose; the squad-by-squad volley; the kill beat; misses shown in the world; the warp-in; the backdrop and the camera. Files: `src/battle/**` (not `rewards.ts`), `src/worlds/space/{arena,warmup,skies,cadetBay,ships}.ts`, `src/engine/{audio,materials}.ts`, `src/director/next.ts`, tests.

## What changed

### Structure is discovered (the hint ladder, drawn)
- `mountArena` defaults to `structure: "discover"`. No axis labels when a fleet arrives. `?labels` in a dev URL brings the old always-on labels back.
- **The formation shows the groups.** `src/battle/formation.ts` lays every fleet out:
  - The gap between squads (`SQUAD_GAP` 0.56) is 3.5 times the gap between ships in a squad (`GAP` 0.16).
  - Each squad's first ship is its leader, with the gold pennant.
  - The two squad tones were retuned in `ships.ts` (`INVADER.ember` is now a deep, hot red-orange; `INVADER.apricot` a pale warm sand). They now differ in lightness as well as hue, and read as bands at phone size (checked in battles and on `/dev/ships`).
- **Up to 10 × 10 every ship is a single fighter** (`battleFleet`). A side of 10 is ten real squads or ten real ships, so:
  - 10 × 8 is ten rows of 8;
  - 9 × 10 is nine rows of 10;
  - pods appear only from 11 up (12 × 4 is four stood-up pods and two rows of 4).
- **Squad scan** (`systems/scan.ts`). It runs after miss 1, once Nova's reaction line has ended and the full fleet is back. A soft version (quicker, 55% strength, no caption) runs on first sight of a fact the player has never met.
  - A hairline lock-on bracket in sky steps down the fleet squad by squad.
  - A count lands at each leader (1, 2, 3…), and Nova's caption counts along ("1, 2, 3, 4").
  - Then "6 squads" settles on the axis, and the caption says "6 squads.".
  - A row of stood-up pods is one step that counts ten (12 × 4 counts 10, 11, 12).
  - The lanes of an a × 0 fleet are stepped too (7 × 0 counts 1…7).
- **Each scan** runs after miss 2, also once the full fleet is back. The bracket runs along the first squad ship by ship (1, 2 … 7), and "7 in each squad" settles. A pod counts what it holds of the squad (6 × 24 counts 10, 20, 21, 22, 23, 24). `ui.hint.powerUp` names the Power-Up that fits.
- **Timing and skipping.** Every scan takes 2.5 s or less however many steps it has (`scanTiming`). Typing (`setCharge` with a number) or firing skips it to its end.
- **The HUD hears late on purpose.** `ui.hint` updates when a label settles, not when its scan starts, so the console never spoils it.
- **Plain label instead of a scan** where a scan cannot be truthful or readable:
  - 0 squads;
  - more than 20 squads;
  - more than 24 stops along a squad;
  - a fleet turned by Flip It!.
- Miss 3, or asking: Show Me How (unchanged). It reveals both labels at once.
- Revealed labels stay for that fleet. A known fact gets nothing unprompted.

### No Radar
- `scaffold()` returns `radar: false` always. `routeMiss` never offers it, and `ui.radar` is always `null`. `arena.radar(n)` is an alias of `fire(n)`.
- Lines that mentioned it are replaced by two new caption lines in `src/battle/lines.ts` (see "Lines to bake"). `voice.ts` reads them after `BATTLE_LINES`.

### The charge (the number on the nose)
`systems/charge.ts`:
- It is drawn in the display voice (Saira 200, expanded), anchored at `rocket.noseWorld()`, and faces the camera.
- The figures are 44 px tall on a large screen, and 30 px (28 on very short screens) on a phone.
- Each digit gives a small pulse. Typing 0 shows "0", and null hides it.
- When the volley fires, it counts down as balls leave: a fighter takes 1, a pod's ball takes 10, and the last extra drawn carries what is left. It always ends on 0.

### The volley
- Balls are `makePlasmaBall` in the equipped blaster style, pooled. `rocket.recoil` fires on every shot, with an envelope matched to the shot rate.
- Ships are taken in reading order, squad by squad (`targetOrder`; a turned fleet reads its columns, last column on top). Big ships take their worth in one ball (`planVolley`, worth exactly the rig's `volley` counts; tested).
- `volleySchedule` sets the timing:
  - quick inside a squad, a breath between squads, so 10 × 10 reads as ten bursts;
  - one breath before the extras;
  - extras capped at 30 drawn;
  - every count lands inside 3.4 s. Scheduled lengths: 1 × 9 1.42 s, 3 × 4 and 12 × 4 1.85 s, 6 × 7, 9 × 10, 10 × 10 and 16 × 24 3.37 s. Measured fire → resolved for 9 × 10: 3.40 s.

### The kill beat (all under the bloom threshold; nothing glows)
- **Anticipation:** the target leans back and squashes in the last 0.14 s of the ball's flight.
- **Impact:** a quick squash and pop, gone in 0.16 s, with a hairline ring that is gone in 0.25 s. A few matte shards in the ship's colours drift and shrink away (one instanced draw, pooled, capped at 320). These are in `systems/kill.ts`.
- **A squad fully cleared:** the leader's gold pennant drops, and one small count ticks beside the squad (1, 2, 3… or 10, 11 for pod rows). This counts the squads again without a word.
- **The last ship:** a 65 ms hit-stop (the squash holds), a bigger ring and more shards, and a small camera nudge.
- **Sound:** `audio.sfx("tick", { step })` is a short tick that climbs a whole tone per ship along a squad. The last ship lands with the existing `burst`. Additive in `audio.ts`, through the master gain, so mute holds.
- **Reduced motion:** shorter pops, no hit-stop, no camera nudge, no warp stretch, no flinch or wink hop.

### Misses shown in the world (`systems/misses.ts`)
- **Too few.** The survivors glide into true rows at the top left (survivor i takes the place of the i-th ship in reading order). Then they give a cheeky wink (a hop and a tilt), and a hairline sky bracket frames them with "12 left".
  - In fleets with pods or carriers the survivors stay where they are (they are already the last squads), and the label sits above them.
- **Too many.** The extra balls fly on past the empty fleet and fizz out at the far end in true rows of b. Each leaves a small hollow mark, and a bracket counts them: "5 too many".
- **Way off** (more than 3 rows or 30 extras). Balls stream past and fizz out far away, and only the true count is written ("855 too many").
- **Never a punishment.** No red, no flash, no buzzer.
  - The full fleet is back 1.65 s after the outcome; the returning ships pop into place.
  - The keypad is live again at 2.0 s.
  - The old blue regroup "shield" panel is gone (`LOOK.shield.peak` 0).

### Arrivals and exits
- A fleet warps in squad by squad: each squad lands as a unit, leader first, with a small landing squash. It takes 1.2 s or less in all. The keypad goes live as the last squad lands.
- After a correct shot the next fleet starts arriving 0.8 s later, so the gap between waves is about 1.9 s.
- **Planet clear:** a gold hairline ring draws itself round the planet (`sky.clearRing()`, behind the HUD's clear card).
- **The Earth battle** (`/play/earth`) opens with the rocket at the bottom centre on the void and Earth's horizon just below it.

### Backdrop and frame
- **No planet sits behind the fleet** (`skies.ts`). Every world is placed every frame from the camera, in one of two ways:
  - **The ground:** Moon, Mars and Earth have their horizon just under the rocket.
  - **A corner body:** Jupiter, Saturn, Uranus and the Asteroid Belt sit low left; Deep Space and Earth-from-the-Moon sit low right, outside the fleet's box.
  - Asteroid rocks are pushed low and far back.
- **No raw values.** `src/battle/look.ts` is built only from tokens and the `space` look. The battle and the warm-ups light with `lookLights(LOOKS.space)`.
- **The camera** (`systems/camera.ts`):
  - It frames inside `cam.safe` (from `arena.setSafe`) at every aspect ratio.
  - A band at the bottom of the free area belongs to the rocket: `rocketBand(fh)`, 86–196 px. The rocket rests at the bottom centre, the same size on screen whatever the fleet.
  - The fleet fills the rest, as large as it allows. A fighter cell is capped at about 120 px so 1 × 4 is not four giants.
  - The box is symmetric, so the rocket stays centred. A left margin holds the counts.

### Power-Ups fit exactly when `powerUpFits` says so
- The two battle-only exceptions are gone. Fast Adding with a = 10 now has ten real squads, and Split & Add with a 10 cuts ten real ships after 5.
- Easy 5s & 10s on a fleet of single ships plates each group of ten in gold. The Show Me How "pods" beat does the same.
- The test now asserts `fits === powerUpFits` everywhere.

### Warm-ups
`warmup.ts` uses the battle's cannon (balls, recoil), the kill beat (flinch, squash, ring, shards), the charge countdown, the camera rig with the rocket band, `lookLights` and the tokens. Its API is unchanged, plus `setCharge(n)`.

### Performance
- Fighter fleets over 16 ships are drawn instanced (`systems/instanced.ts`): one InstancedMesh per part per style.
- The outline shader in `materials.ts` now supports instancing.
- 10 × 10 went from 503 to 85 draw calls (the whole scene, post passes included).
- Every shot shader is compiled at mount (`prewarm`), so the first volley does not stall.
- The cheap fighter is now only for fleets over 140 fighters.

## APIs for other tracks (all additive)
- **Arena** (`@/worlds/space/arena`). `ArenaUi` and every method keep their shape. Additions:
  - `arena.devClearRing()` (dev only);
  - bus `hit` gains optional `step` and `last`;
  - a new bus event, `squad_cleared: { squad, count, t }`.
  - `ui.radar` is always `null`.
  - `ui.hint` updates when a label settles.
- **`setCharge(n)`.** Call it on every keypad change: the number appears on the nose and typing skips a running scan. While a shot plays out the digits wait and show when the keypad is live again.
- **Warm-up** (`@/worlds/space/warmup`): `warmup.setCharge(n | null)`.
- **Formation** (`@/battle/formation`, pure):
  - `battleFleet`, `layoutFleet`, `targetOrder`, `planVolley`, `volleySchedule`;
  - `squadScan`, `eachScan`, `squadBox`, `laneBoxes`, `scanTiming`;
  - `CELL`, `GAP`, `SQUAD_GAP`, `PITCH`, `SQUAD_PITCH`, `VOLLEY_MAX`, `MAX_EXTRAS`.
- **Look** (`@/battle/look`): `reducedMotion()`, `sairaReady()`.
- **Audio** (`@/engine/audio`): `audio.sfx(name, { step? })`, plus the new `"tick"`.
- **Camera** (`@/battle/systems/camera`): `rocketBand(freeH)`.
- **Fleet view** (`@/battle/systems/fleetView`): `squadsText(n)` and `eachText(n)` (the exact words: "6 squads", "7 in each squad"). If the console prints structure words, use these so 2D and 3D say the same.
- **Ships** (`@/worlds/space/ships`): `INVADER.ember` and `INVADER.apricot` have new values; same keys.

## Mounting (for the integrator)
Nothing new to mount; the console wires two calls:
1. `arena.setCharge(n | null)` on every keypad change (today's wave 1 dock does not call it, so in this branch the nose number shows only when set from the console or a test).
2. `arena.setSafe({ top, right, bottom, left })` with the console's whole footprint, including the band Nova's caption uses. The rocket band sits at the bottom of what is left.

The warm-up drill does the same with `warmup.setCharge` and `warmup.setSafe`.

## How I verified it
On `http://combat.localhost:3322`, muted (`mw:mute` = 1), stage paused and stepped frame by frame.

**What I saw:**
- **`/play/moon?dev`, 1440 × 900.**
  - 6 × 7: a correct shot, one squad too few (35), five too many (47), a wild guess (900), three misses in a row.
  - On the 35, the 7 survivors glided to the top row with a "7 left" bracket. The squad scan stepped 1…6 with the caption counting, and "6 squads" settled.
  - On 3 × 4, miss 2 ran the each scan; it settled "4 in each squad", and `hint.powerUp` was `fast-adding`. Miss 3 went to Show Me How with both labels.
  - The 17 into 3 × 4 fizzed in a row of 4 plus 1, with a "5 too many" bracket.
  - The 900 gave "855 too many" with Nova's "Way off! Count the squads with me.".
- **`/play/moon?dev`, the other fleets.**
  - 3 × 4 and 1 × 9 (correct shots).
  - 0 × 7: 0 is correct, "Dead on", and the plain "0 squads" label.
  - 7 × 0: 7 too many with 7 marks; the miss 1 scan stepped down the seven lanes.
  - 10 × 8: the warp-in, frame by frame, squad by squad.
  - 9 × 10: a correct shot, fire to resolved 3.40 s.
  - 10 × 10: a correct shot.
- **`/play/jupiter?dev`.** 12 × 4: the soft scan counted 10, 11, 12. 44 left "4 left" above the last squad, and the squad ticks ran 10, 11. Jupiter sits in the lower-left corner.
- **`/play/saturn?dev`.** 16 × 24: the soft scan, then 360 left "24 left" in place, with squad ticks 10…15.
- **`/play/mercury?dev`.** The warm-up fires with the new balls, ring, shards and countdown.
- **`/intro?dev` Cadet Bay.** 1 × 4 plays above the film's Earth.
- **`/play/earth?dev`.** Before Launch: the rocket at bottom centre with Earth's horizon below.
- **`/dev/ships`.** The retuned tones read as bands.
- **The gold clear ring** (via `devClearRing`) draws round Jupiter.
- **Sizes:** 1440 × 900, 375 × 812, 360 × 640, 812 × 375 and 768 × 1024.
- **No console errors** on `/intro?dev` (Cadet Bay) or `/play/moon?dev` 9 × 10 in a fresh tab. Earlier errors in my first tab were transient compile errors while files were half-written.
- **10 × 10 frame times.** Measured on this Mac with the stage stepped (`step(1/60)`) and a GPU sync (`readPixels`) per frame, over a full 100-ball volley with shards:
  - 375 × 812 (buffer 750 × 1624): median 2.3 ms, p95 3.9 ms, max 13.6 ms; idle median 2.3 ms.
  - 1440 × 900 (buffer 2880 × 1800): median 5.1 ms, p95 7.0 ms.
  - Before instancing and the precompile, the same phone-size run had a 114 ms first-shot stall and a 429 ms spike.
- **`bun run check`** is green: 221 tests, from 202. The new tests are in `tests/battle-formation.test.ts`; `battle.test.ts` and `battle-bus.test.ts` were updated.

**What I infer:**
- At 85 draws, 60 fps on a mid phone is likely, but I did not measure it on a real phone.
- On phones the fleet's size is now bounded by the HUD's footprint. With the wave 1 dock and its caption band, the free area at 375 × 812 is about 260 px tall, and at 360 × 640 and 812 × 375 it is under 200 px, so fleets are still small there. The console's new footprint decides this.

## Not done or not verified
- **Planet clear:** "the last ships flee" is not built. Only the gold ring is.
- **Reduced motion:** not checked in a browser (the pane cannot emulate it). The code paths are in `reducedMotion()` users.
- **Warp streaks:** drawn as a stretch along the flight, with no streak lines.
- **The clear ring** is a 1-device-pixel gold line: true hairline, but faint on a big screen.
- **Partly verified:**
  - The film-to-battle cut itself (only the Earth battle's opening frame).
  - Phone landscape and the small phone: the rocket band works, but the wave 1 HUD leaves almost no free area, and its caption box covers the rocket there.
  - The guided-first-shot interplay (wave 3).
- **Flip It!** turns any scan into the plain label (by design: a scan on a turned fleet would not be truthful about rows).
- **`tests/fold.test.ts`** (an economy-owned file) has a one-line edit: `scaffold(2)` now expects `radar: false`. That test tests `next.ts`, which is mine.

## Requests for other tracks
- **console:**
  - Call `arena.setCharge` on every keypad change, and `warmup.setCharge` in `WarmupDrill`.
  - Report the full footprint with `setSafe`, the caption band included (on tablet and landscape the caption box sits over the rocket today).
  - Stop printing "6 squads · 7 ships each" under `a × b` unless `ui.hint.squads` / `ui.hint.each` is on; use `squadsText` and `eachText` for the words.
  - Consider dropping the outcome chip ("7 still flying", "+5 flew past"): the world now says "7 left" and "5 too many", and two counts at once is one too many.
  - The Radar row can go (`ui.radar` is always null).
- **film (`lines.ts`):**
  - `nova_err_wild` ("Radar is up"), `nova_radar` and `nova_invite` mention the Radar. The battle no longer plays them: it uses `nova_err_way_off` and `nova_invite_v2` from `src/battle/lines.ts`. Please retire them, and bake the new lines below.
  - `ERROR_LINE.wild_guess` still points at `nova_err_wild`; the arena bypasses it.
- **ships (`/dev/ships`):** its page text says "ember and apricot"; the tones are now deep red-orange and pale sand under those same names.

## Lines to bake
Captions only until baked (decision 10):

| Id | Text |
| --- | --- |
| `nova_err_way_off` | Way off! Count the squads with me. |
| `nova_invite_v2` | Sneaky squad! Try a Power-Up, or ask me to show you how. |

Scan captions are built at run time and are not for baking:
- the count so far ("1, 2, 3");
- then "6 squads." or "7 in each squad.".
