# Ships track (wave 1): handoff

Branch `overhaul/w1-ships`. Files: `src/worlds/space/ships.ts`, `hangar.ts`, `hangarBay.ts`, `src/app/dev/ships/**`.

## What changed

**Colour story.** The player's side is cool, the invaders are warm. Every colour in `ships.ts` comes from `src/design/tokens.ts`, mixed in linear light where a tone sits between two tokens (`mix`, `mix3`, `lin`). No `PALETTE` values are used any more, so the worlds track's PALETTE remap cannot change a ship by accident.

**The rocket** (`makeRocket`) is a chubby toy: approach-white body, gold nose cap, dark porthole in a gold rim with one highlight, sky fins and band, and three big splayed fins that it stands on. It is matte. The flame is two additive lathe layers that hang from the nozzle (so `flicker` only lengthens it downwards), fade towards the tip, and render front faces only, so they stay under the bloom threshold.

**Invaders.**
- **Drone** (`makeInvader`): an ember bun with a saucer rim, a dark goggle visor, two light eyes, stubby feet and an antenna. Silly, not scary.
- **Squads** alternate two tones, ember and apricot. Apricot is ember mixed with gold, then towards approach-white, so the two rows differ in lightness as well as hue.
- **Leaders** are the same drone with a gold pennant on a taller antenna.
- **Cheap fighter** (`makeFighterLite`): the same silhouette and colours in three draws.
- **10 pod**: a dark tray with ten mini fighters in two rows of five, like a ten-frame. Each mini fighter sits in a dark socket, so a popped one leaves an empty hole and you can count what fell.
- **100 carrier**: ten strips of ten matte cells.
- **1K+ flagship**: a big drone of the same family with gold fins, a gold value plate and a ten-segment damage meter.
- **Ghost**: the drone's front silhouette drawn in thick dashes (meshes, not 1 px lines).
- **Plasma balls** (`makePlasmaBall`): matte, with a soft emissive under the threshold.

**Hull numbers** (`emblem`) are drawn in Saira on token plates, redrawn once the font arrives, with `toneMapped: false` so the token colours are exact.

**Hangar screen** (`hangarBay.ts`) is now a product shot on the void:
- `applyLook(stage, "hero")`, with key, fill and rim built from the look's values.
- The rocket hovers and turns over a dark pad that has a hairline edge and three dashed orbits, one of them gold with a small moon.
- It frames into the left part of the screen when the screen is wide, and into the top half when it is tall.
- Each slot answers the moment it changes: a new paint makes the rocket pop, a new trail flares, and a new blaster fires a three-shot volley up out of frame with recoil.
- There are no crates, no drone, no laser and no glowing cube. It no longer uses `buildHangar`.

**Intro hangar set** (`hangar.ts`, used by `intro.ts`). Its API and layout are unchanged, but:
- The crates and pad clamps are gone.
- The light strips and pad ring are matte.
- The glowing gold ring is now a dashed gold orbit with a hairline ring.
- The mist particles are round.
- The rocket stands on its fins. Its base height was recomputed for the new model.
- The pad lights gold only at the Launch moment.

**`/dev/ships`** is the review page:
- Every ship type on the void at battle scale.
- 6 × 8 and 3 × 10, laid out with the arena's own maths (cells, gaps, gutters, formation scale, fighter scale 0.78, camera fit). Both appear in true 375 px phone frames (with the bottom 42% kept free for the keypad) and in 1440 × 900 desktop frames.
- Each panel's stage is on `window.__mw[<panel id>]` (`lineup`, `p68`, `p310`, `d68`, `d310`).

## APIs for other tracks (all additive; every old export keeps its signature)

From `@/worlds/space/ships`:

- `makeRocket(M, style?)` returns everything it returned before (`group`, `flames`, `muzzle()`, `flicker(T, power)`), plus:
  - `body: THREE.Group`: the model inside `group`. Its origin is the rocket's middle, so aim and bank by rotating `group`.
  - `nose: THREE.Object3D`: an empty at the nose tip, a child of `group` at local `(0, 1.6, 0)`. **Anchor the cadet's typed number here.**
  - `noseWorld(out?: THREE.Vector3): THREE.Vector3`: the nose tip in world space.
  - `recoil(k: number)`: 0 is rest and 1 is a full kick. The body slides back 0.22 and squashes. Drive it with an envelope, e.g. `sin(PI * t / 0.22)` over 0.22 s.
- `makeInvader(M, opts?: DroneOpts)` and `makeFighterLite(M, opts?: DroneOpts)`, where `DroneOpts = { tone?: "ember" | "apricot"; leader?: boolean }`.
- `squadStyle(squad: number, index: number): { tone, leader }`. The tone alternates by squad (`gRow`) and the leader is `index === 0` (`gCol === 0`, where counting starts). **Next wave:** in `arena.ts` `build()`, pass `squadStyle(v.gRow, v.gCol)` to every builder. Use `leader: false` when a squad has only one ship (for example 3 × 10: one pod per squad); `/dev/ships` shows exactly that rule.
- `makeTenSquadPod(M, orient?, opts?)`, `makeCarrier(M, orient?, opts?)`, `makeDreadnought(M, label, orient?, opts?)`:
  - Their return values are unchanged: `{ group, micro, tag }`, `{ group, cells, popped(n), tag }` and `{ group, damaged(f), tag }`.
  - `opts.tone` colours the mini fighters, cells or hull. `opts.leader` adds a gold pennant, on `"h"` ships only (a stood-up ship spans ten squads).
  - `micro` is still in reading order, and stood-up pods read top-down. Mini fighters stay upright in a stood-up pod.
  - Footprint: every big ship fits about 2.2 × 0.9 (`"h"`), inside the arena's 2.4 × 1.0 cell, with a clear gap.
- `makeGhost()`. Recolouring still works: the arena's take-back code clones each child's material and sets its colour. `GHOST = { color, line, fill, dashes, width }` is the ghost look; the arena's pod and carrier ghosts should use `GHOST.color` / `GHOST.fill` instead of their raw values.
- `makePlasmaBall(M, blaster?: string, size = 1): THREE.Mesh`. The style's stretch points along +z: call `lookAt(target)`. The geometry is shared, so do not dispose it. `blasterOf(id?)` returns the style with a fallback.
- `BLASTERS[id]` gains `glow` (the emissive intensity to use). The arena's `M.glow(blaster.color, 1.45)` should become `makePlasmaBall(M, id, BALL_SIZE[kind])`, or at least `M.glow(color, blaster.glow)`.
- `HULLS[id]` gains `accent`. `THRUSTERS[id]` is now `{ outer, inner, length, width, sparks }` (it was `{ outer, inner }`).
- `INVADER` holds the invader tones (`ember`, `apricot`, `shade`, `hull`, `visor`, `eye`, `crest`). `INVADER_TONES` is the order they alternate in.
- `emblem(text, w?, h?, colors?)` has the same signature. Its default colours are now `[COLOR.approach, COLOR.void]`.

From `@/worlds/space/hangarBay`:
- `mountHangarBay(stage, initial)`, `ShipStyle` and `HangarBay` are unchanged.
- New: `demo()` fires the current blaster again, and `anchor("rocket" | "nose")` gives screen anchors for the wave 2 shop.

## How I verified it

On `http://ships.localhost:3315`, muted, desktop around 1126 × 1020 and the mobile preset.

What I saw:
- **`/dev/ships` at 375 px (mobile preset).**
  - 6 × 8 counts easily by rows and columns. The six squads read as six bands (ember, apricot, ember…), and the gold pennants mark the first ship of each row.
  - 3 × 10 shows three pods with "10" plates and ten-frame sockets.
  - The page does not scroll sideways.
- **Glow test.** With bloom strength raised to 4 on `/dev/ships` (space look, threshold 1.0) and `/hangar` (hero look), no ship, flame, ball or plate showed a halo.
- **`/play/moon?dev`, desktop and phone.** The new drones and rocket appear. A 5 into 1 × 8 shot played out and the fleet regrouped. No console errors.
- **`/play/jupiter?dev`.** 2 × 30 shows six pods. After a 25 shot, stepped frames showed two pods gone and the third pod with five empty sockets, matching "35 still flying".
- **`/hangar?dev`, desktop and phone.**
  - The rocket is framed clear of the shop panel.
  - Ion Arc fired a bolt up out of frame.
  - All four paints and three trails differ at a glance.
- **`/intro?dev`, Hangar chapter.** It plays: the rocket stands on its fins on the pad. No console errors.
- **`bun run check`** is green on every commit (83 tests).

What I infer:
- The drones will read better still once the worlds track's light hairline outline lands. I simulated a grey hairline at runtime on `/dev/ships` and the blobs separated more cleanly.

## Not done or not verified

- The arena does not pass `squadStyle` yet, so real battles show all-ember fleets with no leaders. That is the engine track's next-wave change; the API is ready.
- I did not compare side by side with `http://shipsold.localhost:3200`. My "before" is the same routes on my origin before my changes (moon battle) plus the audit's description of the old hangar.
- I did not verify `/play/saturn` (the cheap fighters over 140 ships, and carriers in a live battle), the 1K+ flagship in a live battle, or a `"v"` carrier or flagship. All of them are only on `/dev/ships`.
- There are no unit tests for the new ship code. `tests/` is not mine. `squadStyle` is pure and would be easy to test.
- The flame lives in the rocket. I did not build a recoil envelope or a muzzle flash in the arena (engine track).
- The "Nebula Violet" paint reads dusky plum rather than true violet: there is no violet token, so it is disk mixed with a little recede.

## Requests for other tracks

- **worlds (`materials.ts`).**
  - The ships call `outline(mesh, M)` on: the rocket body, nose, nozzle and fins; the drone body; the pennant; the pod and carrier trays; the flagship hull and fins.
  - Please size the hairline from each mesh's bounding radius, or in screen space. Drones are drawn at about 0.78 × formation scale and the rocket at 0.55 to 1.7.
  - A light hairline (close to `LINE[2]`) helps countability on the void.
- **engine (`arena.ts`).**
  - Pass `squadStyle(v.gRow, v.gCol)` to each builder, with no leader for one-ship squads.
  - Build balls with `makePlasmaBall`.
  - Anchor the typed number at `rocket.noseWorld()`.
  - Drive `rocket.recoil(k)` on each shot.
  - Replace the ghost pod's raw `0x9fe8ff` with `GHOST.color` and `GHOST.fill`.
  - `warmup.ts` should pass squad tones by row as well.
- **economy or copy (`director/hangar.ts`).**
  - Blurbs that no longer match: Ion Arc "Long cyan bolts" (now long blue bolts), Nova Beam "Lime streaks of light" (now gold streaks), Starlight Comet "A violet comet tail" (now a white comet with gold sparks), Obsidian Stealth "cyan trim" (sky blue).
  - The ids are unchanged.
- **film.** The intro hangar set lost its crates and clamps, and its glow is now matte. The Earth and the arches are untouched; the worlds track's single Earth should replace the one in `hangar.ts`.
