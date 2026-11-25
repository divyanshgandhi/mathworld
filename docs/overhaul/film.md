# Film track: handoff

Branch `overhaul/w1-film`. The intro film (`/intro`) is re-lit, re-cut, re-cast and re-lettered in the Void and Gold language. The story, the cast and the meaning of every line are unchanged.

## The three reported defects

| Defect | Cause | Fix |
| --- | --- | --- |
| The light flickers | `classroom.ts` built a deliberate "tired tube": a random on/off of a point light and its emissive panel. | Removed. Every light in the film is steady. The classroom key is now the morning sun through three real window openings. |
| The door flickers | The hallway spill snapped on at one door angle; the door carried an emissive panel; gaps round the leaf showed a bright emissive plane; the hallway floor shared a plane with the wall. | A real door: frame, stops behind the leaf, threshold, a matte pane. It swings into the room on a damped spring. The spill is a shadow-casting spot in the hallway, so the leaf and the wall shape it, and its strength eases with the door's angle. No two faces share a plane. |
| Children who stand stay at seat height, inside the chair | A child's standing height (1.27 m) was less than the same child's seated height on a 0.45 m chair, and standing moved them backward into the chair back. | One proportion system and child-size furniture (seat 0.32 m, desk 0.58 m). Standing is a timed move with anticipation and settle: legs and arms are placed by two-bone IK, the feet plant and stay planted, and the chair is pushed back. |

## What changed, by file

- `src/worlds/space/classroom.ts`: rebuilt. Walls are single meshes with real openings; the sun (key), a soft window fill, a rim, the hallway spot and a door-side fill all come from the `interior` look. Chairs are their own groups. The board, posters and clock are drawn in Saira after the font loads. Set dressing: a pin-board, a bookshelf, a dado, a globe.
- `src/worlds/space/cast.ts`: rewritten. See "The cast" below.
- `src/worlds/space/intro.ts`: rewritten shot list. A new setup is a cut and the camera only drifts inside it. One fade grammar (`FADE`, eased, void-coloured; the dive alone goes through cloud, in `COLOR.approach`). Each set calls `applyLook`. The desk in front of the cadet is empty, so the board and the teacher stay in view. A wider lens on a tall phone, and two setups that stand further back for it.
- `src/worlds/space/town.ts`: re-coloured from the tokens under the `interior` look; the sign and clock are in Saira; road markings no longer fight at a distance.
- `src/worlds/space/hand.ts`: the first-person hand redrawn in the cast's language (matte, chunky fingers, the cadet's hoodie cuff).
- `src/engine/overlay.ts`: captions, speaker names and title cards in Saira from the tokens. A title card has a title and one plain line, and no label above the title. Eyelids close to the corners of the frame.
- `src/components/IntroFilm.tsx`: the gate, the raise-hand invitation, the two answers and Launch, in Saira from the tokens, with no emoji.
- `src/app/dev/cast/`: new review route.
- `src/worlds/looks.ts`: the `interior` entry only (see "Requests").
- `scripts/bake-voices.py`, `public/vo/teacher_intro.mp3`, `public/vo/vo.json`: one line changed and re-baked.

## The cast

One build system (`BUILD` in `cast.ts`): a child is about 3.3 heads tall (1.29 m), an adult about 4.5 (1.70 to 1.88 m). Bodies are matte. Clothes take their colours from the tokens (gold for the cadet and the Star Fleet; sky, blue, ember and cream for the class; ink for the grown-ups). Skin and hair are declared once in `cast.ts`, because the tokens have no roles for them.

Faces act: eyes that blink, widen and close into arches; brows that lift and slant; a mouth that smiles, frowns, opens round and opens in a grin. Five expressions: `neutral`, `happy`, `thinking`, `oops`, `cheer`. Hair is a cap and a few solid locks, never beads.

Nova is matte: a white shell with an ink outline, a dark visor, two soft eyes, and a hairline ring carrying one gold bead. Her eyes are lit at 0.85 to 1.1 of `COLOR.sky`, which is under every look's bloom threshold.

Review them at `/dev/cast`: each character from the front, three-quarter and side, then the five faces.

## APIs other tracks should use

From `src/worlds/space/cast.ts` (the existing signatures still work):

```ts
makeCharacter(spec: Spec, M: Materials, rnd: Rng): Character
animateCharacter(c: Character, T: number, dt: number, rnd: Rng, level = 0): void
seat(c: Character, x: number, seatHeight: number, z: number, o?: { chair?: THREE.Object3D; desk?: number; edge?: number }): void
setExpression(c: Character, e: Expression, snap = false): void
headPosition(c: Character): THREE.Vector3
eyePosition(c: Character): THREE.Vector3
makeNova(M: Materials, opts?: { glow?: boolean }): { group: THREE.Group; express(e: Expression): void; animate(T: number, dt: number, baseY: number, voice = 0): void }
mix(a: string | number, b: string | number, t: number): number   // a colour between two colours, as a three.js hex
type Expression = "neutral" | "happy" | "thinking" | "oops" | "cheer"
PLAYER, TEACHER, PRINCIPAL, CAPTAIN: Spec;  CLASSMATES: Spec[];  NAMED: number[];  ANSWERERS: number[];  SKIN: number[];  BUILD
```

- `makeNova`'s `glow` option is accepted and ignored: she never glows. `express()` is new and optional to call.
- `character.rig.mood` is the expression; `rig.raise`, `rig.stand`, `rig.talking`, `rig.look` and `rig.walk` work as before; `rig.mime = true` moves the mouth when there is no voice to follow.
- `CLASSMATES` now has seven entries (it had eight): nothing outside the film read it.

From `src/engine/overlay.ts` (source-compatible):

```ts
createOverlay(container: HTMLElement, canvas: HTMLCanvasElement): Overlay
overlay.caption(speaker: string, text: string): void
overlay.captionAt(bottomPx: number): void
overlay.card(kicker: string, main: string, sub?: string, at?: "centre" | "top" | "low"): void   // the first argument is ignored
overlay.fade(opacity: number, color?: string): void;  overlay.lids(open: number): void;  overlay.blur(px: number): void;  overlay.timer(fraction: number | null): void
```

From `src/worlds/space/intro.ts`: `mountIntro`, `SPACE_AT`, `Film`, `Chapter` and `FilmUi` are unchanged, except that `FilmUi.prompt.stage` gains `"called"` (the hand is up and the teacher is calling on you).

From `src/worlds/space/classroom.ts` and `town.ts`: `buildClassroom(scene, M, rnd, look?)` and `buildTown(scene, M, rnd, at, look?)` take the look to light from. Only the film calls them.

## How it was verified

In a browser on this track's own origin, muted, at 1440 x 900 and at the phone preset (375 x 812).

1. **Every frame of the whole film.** A script in the page paused the stage, stepped the film at exactly 60 frames a second from the first frame to the last (7,900 frames, about 132 s of film), raised the hand and answered the first question, let a classmate answer the second, and pressed Launch. For each frame it measured the picture and logged every caption. Results at both sizes:
   - no frame where the whole picture gets brighter or darker for a single frame;
   - no script errors;
   - every caption and card complete and inside the frame (the longest caption is nine lines on the phone, from 577 px to 792 px of 812);
   - in the held dialogue shots (both questions, the lesson, the names, the Captain) no part of the picture pops between frames.
2. **The light.** With the camera fixed, every light's strength is constant to three decimals over 12 s before the knock and 10 s after it, and so are patches of ceiling, wall and board.
3. **The door.** Sampled at 60 fps through the swing: the angle moves at most 0.054 rad a frame and settles with 0.002 rad of overshoot; the spill rises with it by at most 4.6% of its range a frame. With the door open and nobody in frame, at most 10 of 70,000 pixels change sharply between frames as the camera sways (edge anti-aliasing).
4. **Standing.** A test stepped the move 400 times and measured each limb against the chair and the desk in side view: nothing passes through either, and no joint jumps. Then frame by frame in the browser from the side, front and back for Maya, Leo, Aarav, Zoe and the cadet.
5. **Interaction.** Real clicks on Play, Raise your hand, an answer and Launch; the Space, 1 and 2 keys. Raising a hand shows "Hand up" on the same frame.
6. **Camera.** The camera's motion was differentiated twice across the whole film to find pops. That found three cuts between near-identical framings and one small jump between two first-person shots; all four are fixed.
7. `bun run check` is green (83 tests).

Film times checked, in seconds: 0 Earth, 4.4 dive, 7.0 town, 12.6 waking, 15.7 yawn, 18.9 the look to the teacher, 20.8 first question, 27.8 the invitation, 37.0 second question, 53.0 the lesson, 57.7 the knock, 59.0 the door, 60.8 the visitors, 68.5 the Captain, 82.6 the names, 89.3 the fifth cadet, 97.1 the hangar, 118.7 Nova, 126.7 launch, 132 end.

## Not done, or still rough

- **Not heard.** Everything was checked muted. The re-baked teacher line was not listened to; its length and where its speech ends were measured (7.2 s, 6.59 s).
- **Not watched at true speed for the whole length.** The tab kept being put in the background, where the browser slows it down. The first 36 s ran at true speed (about 93 frames a second at 2880 x 1800). The rest is from the stepped pass above, which shows every frame but not how it feels to sit through. Nobody has run it on a real phone.
- **Edges are not anti-aliased.** The post chain renders into targets with no multisampling, so thin edges crawl a little when the camera moves fast (the town's windows during the crane). See "Requests".
- **The launch.** The rocket's flame changes size about six times a second and the mist flies fast. Both are in `ships.ts` and `hangar.ts`. The film's own shake is small and smooth, and is off for reduced motion.
- **The hangar set** still has its earlier colours (cyan and yellow pad rings, a pastel Earth). The film only adds a key light for the people in it.
- **The hand-off into the first battle** is a cut from a void card to the battle, as before (out of scope).
- **A phone held upright** sees a narrow slice of each shot. The film widens the lens and moves two setups back, but the wide of the names shows the middle of the room, not all four children.
- **The cadet's hoodie is always gold.** It does not follow the colour picked at sign-up.
- **Reduced motion** turns off the camera sway and shake. Fades and character animation stay.
- `/dev/cast` draws stills. It does not animate.

## Requests for other tracks

- **engine / worlds (`src/engine/stage.ts`):** give the composer a multisampled render target (4 samples) so edges are anti-aliased. Also, `PCFSoftShadowMap` no longer exists in this three.js and falls back with a console warning; `PCFShadowMap` with `shadow.radius` is what the film's lights are tuned for.
- **worlds (`src/worlds/looks.ts`):** I changed the `interior` entry: exposure 1.1, bloom strength 0, key 7, fill 1.3 with a warm ground colour, rim 0.9. Lights in this three.js are physical, so a daylight room needs these strengths; nothing indoors blooms. Please keep them when merging.
- **worlds (`earth.ts`):** the film calls `buildEarth(scene, M, rnd, at)` and uses `{ sun, update }`. It sets `sun.color` and `sun.intensity` from the `space` look.
- **ships (`hangar.ts`):** the film calls `buildHangar(scene, M, rnd, at)` and uses `group`, `nova`, `rocket`, `lights(on)`, `launch()`, `reset()` and `update(T, dt, voice, novaTalking)`. Its camera positions assume the pad at (0, 0, -1.8), the Captain at (-3.9, 0, 1.8) and Nova near (3.2, 2.8, 0.8). If the layout moves, the five hangar setups in `intro.ts` need re-framing.
- **kit:** `IntroFilm.tsx` draws its own primary pill (`Primary`), round answer buttons and dock buttons from the tokens, because the kit did not exist on this branch. Swap them for the kit's when it lands. The `CadetSignUp` card shown on `/intro?dev` with no player is still the old one.
- **engine (`src/engine/materials.ts`):** `PALETTE` and the `Georgia` default in `fitText` are no longer used by the film.
