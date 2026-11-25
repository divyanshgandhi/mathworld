# Film track, wave 2: handoff

Branch `overhaul/w2-film`. The intro film (`/intro`) had its beauty pass and got the controls of a finished film. The story, the cast and the meaning of every line are unchanged. The three wave 1 defects (flickering light, flickering door, children standing inside their chairs) were measured again and are still gone.

## What changed, by file

- `src/worlds/space/intro.ts`: rewritten.
  - **Composed shots.** `compose()` fits a setup's subject into the part of the frame that captions and buttons leave free, for the frame it is shown in. A phone held upright, a tablet and a phone on its side each get their own picture, and a turned phone gets the setup composed again.
  - **A shot list as data** (`SETUPS`, 34 setups) and `film.still(id)`, which runs the film to any setup.
  - **Captions** are published to React, cut into pieces of at most two lines, and each piece is held for its reading time (1.5 s plus 0.3 s a word). A set change never cuts one off.
  - **Controls:** `skip()`, `pause()` (the tab being hidden calls it), a kind carry-along at every wait, `calm` (reduced motion).
  - **Light:** one soft key (`eyeLight`) follows the subject of each setup, so a face is the brightest thing in its frame. The colour script is a grade that eases from the gold morning to the cooler picture after the knock.
  - **Launch** is a sequence: three beats of lights, a held breath, fire, lift-off, cloud, orbit.
  - **Performance:** only the set on screen is drawn and only its lights spend a shadow pass; every set is drawn once off screen before Play.
- `src/worlds/space/classroom.ts`: pale lifted ceiling with a cornice and two beams that run to the board; the sun moved off the board (the writing stays in even light) and lower (it reaches the teacher's face); sun shafts as faint additive geometry; a number line over the board, a larger solar-system poster, "3 rows of 4" dots and a hundred square on the door wall; soft contact shadows under desks, chairs and shelves; every set colour mixed from the tokens. New: `BOARD_TEXT`, `room.set(open)`, `room.shadows`.
- `src/worlds/space/town.ts`: rebuilt. Rolling land in three greens, a mown lawn, road with kerbs, pavement and a crossing, a fence and gate, hedges and planters, a porch with double doors, broadleaf trees (five masses) and poplars (three), a windbreak, an avenue, two streets of houses, far hills, a low sun with long soft shadows. Trees are two instanced meshes.
- `src/worlds/space/hangar.ts`: rebuilt as a cathedral for one rocket: a dark vault on pointed ribs with hairlines, a round window that draws the solar system in dashed orbits, a matte deck with orbit rings and an aisle (no grid), an oculus over the pad, twelve countdown studs, gold key and sky rim from the `hero` look. No cyan or yellow rings. New: `PAD`, `hangar.set({ lamps, burn, rise })`, `hangar.shadows`. Earth is no longer seen from the hangar: it is the last shot's.
- `src/worlds/space/cast.ts`: skin and hair mixed from the tokens (`WARM`); `contactShadow()`; a soft shadow under every character; `recolour()`; `cadetCloth()`; acting: breath in the chest and shoulders, a blink at the start of a big turn of the head, small glances of the eyes, a hand that goes up on a spring with a dip of the shoulder first.
- `src/worlds/space/hand.ts`: `setSleeve(colour)`.
- `src/worlds/space/lines.ts`: `FILM_LINES` (the film's words, in story order); glossary words in the battle lines.
- `src/components/IntroFilm.tsx`: kit `Button` and `NovaLine`; captions, Skip, replay; no raw colours.
- `src/engine/overlay.ts`: `readingTime`, `splitCaption`, `scheduleCaptions` (pure, tested). The DOM caption plate stays for the battle.
- `src/app/dev/cast/CastReview.tsx`: moving previews and the contact sheet.
- `src/worlds/looks.ts`: the `interior` entry only, now built from the tokens.
- `scripts/bake-voices.py`, `public/vo/`: see "Words".
- `tests/film.test.ts`: caption splitting and timing, film words against the bake, the glossary, no raw colours in film files.

## APIs other tracks should use

```ts
// src/worlds/space/intro.ts
mountIntro(stage, { onUi?, onEnd?, fits?, colour?, calm? }): Film
film.play() | jump(chapter) | raise() | pick(n) | ignite()      // as before
film.skip()                 // one tap: dip to the void, the film's last frame, then onEnd (once)
film.pause(on: boolean)     // picture, captions and sound together; a hidden tab does this by itself
film.setName(name)          // as before (also prepares the spoken name)
film.setCadet(name)         // the name for captions and cards only: nothing is spoken, no sound is unlocked
film.setColour(tokenColour) // the hoodie and the first-person sleeve
film.still(id)              // put one setup on screen (pause the stage first)
film.setups, SETUPS         // the shot list: { id, chapter, title, purpose, seconds, tallOnly? }
film.ready                  // resolves when the first picture has its maps
film.state                  // { played, step, t, saying, env, fov, sound }
FilmUi                      // gains caption: { who, text } | null, canSkip, paused

// src/worlds/space/cast.ts (additions; everything from wave 1 still works)
contactShadow(w, d, strength?)   recolour(character, cloth)   cadetCloth(tokenColour)   WARM   PLAIN

// src/engine/overlay.ts (additions)
readingTime(text)   splitCaption(text, fits)   scheduleCaptions(pieces, spokenSeconds)
```

## Mounting, for the integrator

1. **Replay.** Link to `/intro?replay&from=/bay` (or any path on the site) from wherever "Watch the film again" lives. A cadet who has finished the intro sees a gate ("The film", Play, Back), then the film; the end and Skip both go to `from` with `router.replace`. Cadet Bay is not mounted, so nothing is recorded. Without `replay`, a finished cadet is sent to `/bay` as before. `from` must be a path on this site; anything else falls back to `/bay`.
2. **The cadet's colour** needs nothing: `IntroFilm` reads `player.avatar` and calls `film.setColour(CADET[avatar])`.
3. **The hand-off into Cadet Bay.** The film's last frame is the battle's opening frame as measured today: camera at `BAY + (0, 2.77, 10.9)` looking straight down −z, lens 48°, the frame lifted by 12% of its height, the rocket at `BAY + (0, 1.16, 1.8)` at scale 0.55. These are `BAY` and `LAST` at the top of `intro.ts`. If the battle's opening frame moves, change them there. The battle shifts its frame sideways for the console (about one rocket's width at 1440 px); the film stays centred, as the contract says.
4. **Light across the cut.** On `dispose()` the film leaves its Earth sun at (space key − `LOOK.light.key.intensity` from `src/battle/look.ts`) and its fill at 0, both still in the scene, so the battle's own key and fill bring the Earth back to what the last frame showed. Before this the Earth was lit twice and its limb bloomed.
5. **Review flags:** `?dev` (chapter dock), `?calm` (the film as reduced motion sees it).

## The shot list, before and after

Stepped at 1440 × 900 and 390 × 844. "Before" is the film as wave 1 left it.

| # | Setup | Before | After |
| --- | --- | --- | --- |
| 1 | Earth from orbit (4.6 s) | Good: the factory Earth, a card low in the frame. | Unchanged picture; the card now stays for its reading time. |
| 2 | The dive (2.6 s) | A plunge into cloud. | Unchanged; for reduced motion the camera holds and the cloud closes over it. |
| 3 | Over Maple Hill (4.2 s) | A flat green plane, ball-on-stick trees scattered at random, hard shadow edges. | Rolling land, a mown lawn, an avenue and a windbreak, a fence and a crossing, rooftops in the foreground, long soft shadows; on a phone the school, the road and one roof stack up the frame. |
| 4 | The school door (2.2 s) | The porch flat on, jagged shadows on the columns, a bare panel for a door. | Double doors under the name, steps, planters and hedges, the gate posts as a frame in the foreground, soft column shadows. |
| 5–7 | Eyes open, the yawn, the look (8 s) | A dark brown slab of ceiling across the top of every frame. | Pale ceiling with beams that lead to the board; the number line and the clock over the sum; the hand keeps its sleeve colour. |
| 8 | The teacher asks (7 s) | The teacher small and dim at the left, her face in shadow, the caption over her legs. | A knee-up two-shot: her face in the window's light at the left, the sum beside her, the caption in clear floor. On a phone it is her portrait, then a cut to the sum on the phrase "four plus four is". |
| 9 | The sum on the board (phone) | Did not exist. | The sum fills the width, under the clock and the number line. |
| 10 | The class waits (7.5 s) | Dim room, classmates as dark shapes in the foreground, the button over the cadet's body. | The cadet in the middle in their own colour, the board ahead, the button in the floor band under them. On a phone: sum, cadet, button, top to bottom. |
| 11 | Hand up (2.5 s) | Good framing, but the teacher's caption was hidden under the prompt. | The cut lands on the arm; "Hand up" and the teacher's line are one stack under the cadet. |
| 12 | The answer (8 s) | The sum and both buttons were drawn across the cadet's hoodie, with the hood cords showing through above them. | What the cadet is looking at: the board with the sum, the teacher waiting with a smile, and the two answers under it in clear space. Nothing is drawn over anyone. |
| 13 | You answer (2.3 s) | The cadet's head cropped by the top of the frame. | A portrait with headroom; on a phone the head's width is part of the fit. |
| 14 | She is pleased (3.4 s) | As 8. | As 8, with her happy face and the finished sum. |
| 15 | The second question (2.6 s) | The class from the board side under the dark ceiling. | The same idea, lit, with the hundred square and the pin-board behind; on a phone it is the cadet's own face, listening. |
| 16 | A classmate answers (2.6 s) | Fine. | The same, with the soft key on the child's face. Also plays if the cadet raises a hand and then does not answer. |
| 17 | Today's word (4.6 s) | A dark ceiling and a lamp bar; the teacher tiny. | The word on the board under the number line, the signs poster and the globe to the right, heads in the foreground. On a phone it is seen from high at the back, over the cadet. |
| 18 | The knock (1.6 s) | Faces from the board side. | Every face turned to the lens, which stands by the door; windows behind. On a phone, one surprised face close with two behind. |
| 19 | The door (4 s) | A plain wall and a door. | The same door, with the dots poster beside it and the hall's cooler light. |
| 20 | The visitors (6 s) | Flat light, the caption over their legs. | Both lit by the soft key, the caption in the floor between them. |
| 21 | The Captain (8 s) | The principal's face half in frame at the right edge. | Square on to the Captain, the open door and the hall behind him; nobody is cut by the edge. |
| 22 | The teacher is proud (5.5 s) | The wide teacher shot again. | Her face, close: surprise, then pride, with the solar-system poster behind. |
| 23 | The names (7.5 s) | From the back corner: backs of heads. | From beside the teacher: every face, and each child rising into clear space. On a phone, the front pair from the corner by the board, then (24) the back pair from high over the middle row. |
| 25 | The fifth cadet (6 s) | Cheering hands near the top edge. | The camera follows the rise and holds the whole cheer; both hands stay in the frame at both sizes. For reduced motion it is one cut. |
| 26 | The hangar (2.4 s) | A black grid floor, round arches, Earth and a pale moon, sky-coloured strips and rings. | Square on down the aisle: pointed ribs, the rocket on its pad, the round window behind its nose like a halo. |
| 27 | The Captain's welcome (5.5 s) | His face in the shadow of his cap. | The key is low enough to reach under the peak; the window's rim behind him. |
| 28 | Your ship (6 s) | A three-quarter wide with the grid. | The rocket from low down with the window beside it; Nova at the porthole. |
| 29 | The rule (6 s) | The same wide for a 12 s line. | Its own frame for "Too few, too many": the Captain and the ship together (on a phone he stands in front of it). |
| 30 | Nova (9 s) | Fine; the shell was close to blowing out. | Nova in the middle with Launch under her in clear deck; her light is kept low. |
| 31 | The countdown (2.5 s) | Did not exist: the rocket left on the press. | Low on the aisle: the pad's twelve studs light in three beats, then a breath. |
| 32 | Ignition (0.8 s) | A wide. | Close and low at the pad: the ring and the flame are the one glow in the film. |
| 33 | Lift-off (2.4 s) | The rocket slid away past Earth. | The camera tips back to follow it up to the oculus, then cloud. |
| 34 | Orbit (5.9 s) | A cut to a title card on the void. | The cloud clears on Earth's horizon; the rocket climbs to bottom centre along a dashed hairline orbit; the frame the battle opens on. |

## How it was verified

In a browser on this track's own origin, muted, with a test cadet whose colour is violet.

- **Every setup at both sizes.** `film.still(id)` for all 34 setups at 1440 × 900 and 390 × 844, each looked at, most of them two or three times as they were changed. Spot checks at 812 × 375, 768 × 1024 and 360 × 640. Turning 812 × 375 into 768 × 1024 in the middle of a setup composed it again.
- **The whole film, stepped.** A script stepped the film at 30 frames a second from the first frame to the end, raising the hand and answering. At 1440 × 900 (right answer, 163.9 s), at 390 × 844 (wrong answer, 166.1 s) and with `?calm` (162.4 s): no script errors; 25 to 27 captions; none on screen for less than 1.5 s plus 0.3 s a word; none on screen across a change of set; at most two lines at 17 px on the phone (measured in the page, plate 289 px wide).
- **Nobody acts** (replay, stepped): classmates answer both questions and Nova launches after 20 s; the film ends by itself at 185.3 s.
- **Skip:** absent before 3 s; a 97 × 44 px button after; a double click ended the film once, on the last frame's camera, and Cadet Bay opened. No event was posted.
- **Hidden tab:** with the film running in real time, a hidden tab froze the film's clock (0.000 s in 1.5 s) and suspended the sound clock; showing it again resumed both.
- **Replay:** `/intro?dev&replay&from=/dev/cast` showed the gate, played, and returned to `/dev/cast` at the end; the event count did not change.
- **Refresh mid-film:** back to the gate; Play starts from the top.
- **The three wave 1 defects.** Light: over 400 frames in the classroom the sun (7.000), the window fill (1.540), the rim (1.100) and the sky fill (1.250) did not change. Door: at most 0.054 rad a frame, settling at −1.45 with 0.002 rad of overshoot; the hall spill moves by at most 4.6% of its range a frame. Standing: seen in the names and picked setups at both sizes, and in `/dev/cast`.
- **Reduced motion** (`?calm`): outside the first-person shots the camera moved only on cuts.
- **Frame rate:** the stepped run drew and read back about 138 frames a second at 2880 × 1800 device pixels. That is a throughput figure from a paused stage, not a watched 60 fps.
- `bun run check` is green (211 tests). The design detector found nothing in the changed UI files.

## Words

Re-baked, locally and offline, with `--measure` after:

| Id | Text |
| --- | --- |
| `captain_brief1` | Welcome, cadets. You will protect Earth from the ships that attack from space. |
| `captain_brief2` | You have a spaceship, your co-pilot, and plasma balls to clear every squad. |
| `captain_brief3` (new id) | Remember, plasma balls are precious. |
| `captain_brief4` (new id) | Too few, and ships slip past. Too many, and we burn extra fuel. |
| `nova_l0_intro` | Welcome to Cadet Bay! Drones fly in squads. Count every drone, load that many plasma balls, and fire! |
| `nova_zero` | Zero squads means empty space. Not a single ship! |
| `nova_incoming` | Squads incoming! One plasma ball for every drone. |
| `nova_incoming_short` | Squads incoming! |
| `nova_err_wild` | Way off! Count the squads first. |
| `nova_invite` | Sneaky squad! Try a Power-Up, or ask for Show Me How. |
| `nova_hold_fire` | Hold fire, cadet! Take a breath, and try a Power-Up. |
| `nova_zero_squads` (first bake) | No squads at all! How many ships is that? |
| `nova_zero_each` (first bake) | Every squad here is empty. Count the ships! |

The Captain's long briefing line was one 33-word clip; it is now one thought a clip, so each caption is on screen with the words it shows. No story was added. The three lines that named the Radar (which is gone) now point at the squads, a Power-Up or Show Me How.

## Lines to bake

None outstanding.

## Not done, or not verified

- **Nothing was heard.** Every clip above was baked and measured, never listened to.
- **The film is longer:** about 164 s for a cadet who answers (it was about 137 s). The reading-time rule holds each caption a little past its voice, and the launch is now a sequence. Skip is there from 3 s.
- **Not watched at true speed** for more than a few seconds at a time; the pane is throttled. Pacing is from the stepped runs.
- **No real phone, no Safari.**
- **Replay for a finished cadet without `?dev`** was read in the code, not run: the test cadet has not cleared Cadet Bay.
- **Reduced motion** was run with `?calm`, not with the system setting.
- **Left alone on purpose:** `nova_radar` ("Radar is up. Pick a target!") still exists and has a clip; the Show Me How lines (`tr_*`) still say Squadron Pod, Fighters and invader, because their words must match `src/rig/showme.ts`, which is frozen.
- **Rough edges:** the phone frame of the back row (24) holds two small figures and a lot of floor; the teacher's phone portrait is tight; the town has no people in it; the orbit in the last shot is a one-pixel line.
- **`STATE.md` and `docs/overhaul/README.md`** are not mine this wave and are unchanged.

## Requests for other tracks

- **combat (`stage.ts`):** nothing blocking. The film warms its sets by rendering each once into a 32 px target with `stage.renderer`; a `stage.warm(camera?)` that did this would let other scenes share it.
- **combat (`ships.ts`):** the rocket's flame still changes size about six times a second (`flicker`). At launch it is long; a slower, smaller wobble would sit better.
- **combat (battle):** see "Mounting" 3 and 4. Exporting the battle's opening camera and rocket place as constants would let the film import them and stay matched.
- **front (kit):** a `hand` icon in the icon set (the film draws its own for "Raise your hand"); `NovaLine` with `portrait={false}` and with no speaker (the film passes an empty fragment, and uses a plain paragraph for the knock).
- **front, manual, places:** a "Watch the film again" link to `/intro?replay&from=<this screen>`.
- **economy (`hero` look):** the Launch glow is the pad ring's emissive (1.9) over the `hero` bloom threshold (1.15, strength 0.2). If that look changes, tell the film.
- **wave 3 copy pass:** retire `nova_radar` and its clip; bring the `tr_*` lines to the glossary together with `src/rig/showme.ts`.
