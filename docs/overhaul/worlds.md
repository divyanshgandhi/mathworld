# Track: worlds (lighting, planets, the title)

Branch `overhaul/w1-worlds`. One light story for every 3D scene, one planet factory, one Earth, and the title rebuilt from `design/title.html`.

## What changed

- **Planet factory** (`src/worlds/space/planets.ts`). Every body comes from `makeBody`: the Sun, Mercury, Venus, Earth, the Moon, Mars, the Asteroid Belt, Jupiter, Saturn (with rings), Uranus (with its faint ring), Neptune and Deep Space.
  - One texture set per body, painted procedurally by `planetMaps.ts`:
    - Earth: real continents, rasterised from coarse outlines and given fractal coasts, plus a separate cloud map.
    - the Moon: maria where the real seas are, and craters with a height map.
    - Jupiter: banded, with the Great Red Spot.
    - Saturn: radial rings with the Cassini division.
  - The maps are painted in a worker (`planetMaps.worker.ts`), with a main-thread fallback, and cached for the session.
  - Two levels of detail. `low` covers the title, small sprites and far bodies. `high` shows the low maps first, then sharpens when its own maps land: Earth 2048, the Moon 2048, Mars 2048, the others 1024.
  - Bodies are matte and lit by the scene. The material adds a faint shadow-blue floor on the night side and a thin fresnel rim in the look's rim colour, both far under the bloom threshold. Earth also has a soft atmosphere that fades to nothing at the limb.
  - The Sun is a granulated surface with limb darkening toward ember, plus a soft additive halo sprite. It is the only body above the bloom threshold.
- **One Earth.** `buildEarth` (`earth.ts`) now uses `makeBody("earth", 30, { lod: "high" })`, and its Moon uses `makeBody("moon")`. The battle sky (`skies.ts`) also builds every planet with `makeBody`. That includes the small Earth behind the Moon battle, which used to be a plain blue ball. The painted ellipse continents are gone.
- **Looks** (`src/worlds/looks.ts`).
  - The `space` and `hero` looks are final, and their colours are derived from the tokens. The key is gold mixed 60% toward approach, so it is warm without staining grey bodies yellow. The fill is disk mixed halfway to void, and the rim is sky.
  - `applyLook` now also resets the grade tint.
  - New: `tone(a, b, t)` and `lookLights(look, opts)`.
  - `createStage` starts every stage in the `space` look (background, exposure, bloom and grade).
- **Materials** (`src/engine/materials.ts`).
  - `PALETTE` keeps every key, and its values are derived from the tokens.
  - The ink outline is now a light hairline: approach at 42%. Its width is constant on screen, about 1.25 CSS px at any size and distance (a clip-space normal offset). See "How a mesh opts in" below.
- **Starfield.** `starfield(n, radius, rnd, at?)` keeps its signature. It now draws two pin-sharp layers in fixed pixel sizes, mostly cool white with a few sky and gold stars, all under the bloom threshold. Every scene this track owns uses it.
- **Title** (`title.ts`, `TitleScreen.tsx`).
  - The scene is an orrery in the space look. The Sun is the only glow. The planets are matte factory bodies. Orbits are dashed hairlines (`Line2`, 1 CSS px), with Earth's brighter (0.42 against 0.16). The Moon goes round Earth, and a small rocket with an ember trail flies on its own dashed orbit. The Asteroid Belt is a faint ring of dust.
  - The camera flies in from deep space with an exponential ease-out over 5.5 s, then drifts slowly about the Sun.
  - **Framing.** `frameAround(box)` takes the words' box. The view offset puts the Sun right of the words on wide screens (over 820 px) and above them on narrow ones. The zoom is fitted so the outermost orbit stays clear of the box. The drift turns the camera about the Sun at a fixed height and distance, so the fit holds for the whole drift, and no planet can pass behind the words at any width.
  - **The words.** The wordmark has the ring logo, followed by the prototype's one line, then Start game in the primary pill (a gradient edge that turns gold on hover, with the ring-and-rocket glyph), then "Welcome back, Cadet <name>".
    - They are revealed after the fly-in settles. A 6.5 s fallback covers a device without WebGL.
    - Start game appears only once the player fetch has returned, so it is never shown disabled.
  - Start, sign-up, `?dev` links and routing work exactly as before. The `?dev` panel also links `/dev/planets`. The sign-up button label lost its "▶" glyph and now reads "Begin".
  - Styles come straight from the tokens. **The kit track's shared button replaces the local `.mw-start` pill once it merges.**
- **Planet sprites** (`src/worlds/sprites.ts`, `src/components/world/PlanetSprite.tsx`). Each body is rendered once by the same factory, in the space look (gold from the upper left, the sky rim on the right), into a cached transparent PNG. The `/dev/planets` page shows every body large (360 px), then at 48, 96 and 200 px, on the void.

### Palette mapping (old key → new value)

| key | was | now |
|---|---|---|
| ink | near-black navy | `void` |
| ink2 | deep navy | `panel` |
| clay | warm white | `approach` |
| cream | cream | `approach` warmed 22% toward `gold` |
| coral | coral | `ember` |
| lilac | lilac | `sky` |
| sky | pale cyan | `sky` |
| slate | grey-violet | `horizon` lifted 30% toward `sky` |
| dark | dark slate | `shadow` |
| invader | toon green | `disk` (the ships track owns the drones' final colour) |
| lime | brand lime | `gold` |
| cyan | neon cyan | `sky` |
| gold | gold | `gold` |
| shot | yellow | `gold` lifted 45% toward `approach` |

## APIs for other tracks

```ts
// src/worlds/space/planets.ts
type BodyId = "sun" | "mercury" | "venus" | "earth" | "moon" | "mars" | "asteroid-belt" | "jupiter" | "saturn" | "uranus" | "neptune" | "deep-space";
makeBody(M: Materials, id: BodyId, r: number, o?: { lod?: "low" | "high"; look?: LookId; clouds?: boolean; halo?: boolean; seed?: number; glow?: number /* ignored, kept for old callers */ }): Body
interface Body { group; spin; mats: MeshStandardMaterial[]; radius; clouds?: Mesh; ready: Promise<void>; sharp: Promise<void>; update(dt): void }
starfield(n: number, radius: number, rnd: Rng, at?: Vector3): THREE.Points
preloadBody(id: BodyId, lod?: "low" | "high"): void      // start painting before a route opens
rockMaterial(look?: LookId), rockGeometry(r, rnd)          // loose rocks that match the Asteroid Belt
BODY_IDS, BODY_NAME                                         // also from src/worlds/space/bodies.ts (no three.js)

// src/worlds/space/earth.ts (unchanged signature; the return value gains fields)
EARTH_RADIUS = 30
buildEarth(scene, M, rnd, at) → { sun: DirectionalLight /* off until you set intensity */, update(dt), earth: Body, moon: Body, group }

// src/worlds/space/skies.ts (unchanged)
mountSky(stage, planet: PlanetId, origin) → { update(dt), dispose() }

// src/worlds/looks.ts
applyLook(stage, "space" | "interior" | "hero"): Look
lookLights(look, { sun?: Vector3; keyFrom?: Vector3; rimFrom?: Vector3; target?: Vector3; rim?: boolean }): { group, key, fill, rim }
tone(a: tokenColour, b: tokenColour, t: number): number    // two token colours mixed, as a three.js hex

// src/worlds/sprites.ts
planetSprite(id: BodyId, sizePx: number): Promise<string>  // PNG data URL, cached per body, size and pixel ratio
planetSpriteAlt(id: BodyId): string

// src/components/world/PlanetSprite.tsx
<PlanetSprite id="earth" size={96} />                // alt defaults to the body's name
<PlanetSprite id="moon" size={48} alt="" />          // decorative

// src/worlds/space/title.ts
mountTitle(stage) → { frameAround(box | null), onSettled(fn) → unsubscribe, settled, dispose() }

// src/engine/materials.ts
PALETTE (same keys), OUTLINE { width, color, strength }, outline(mesh, mats)  // same signature as before
```

### How a mesh opts in to the ink outline
Call `outline(mesh, stage.mats)` once after you build the mesh.
- Use it on small heroes only: the rocket, drones and Nova. Never on planets or sets.
- It works best on smooth, closed meshes: lathes, spheres and capsules. A hard-edged box shows gaps at its corners, so bevel boxes or leave them out.
- The width is set for a whole stage, in CSS px: `stage.mats.outline.uniforms.width.value`.

## How I verified it
All of this was on my own origin, muted, at 1440x900 and with the mobile preset. The console showed no errors on any route below.
- **`/dev/planets`.** Every body renders, both as a 360 px sprite and at 48, 96 and 200 px. I saw the loading state too: hairline circles that the sprites fade in over.
  - Earth reads as Earth: Africa, Europe and Arabia face the viewer, with clouds and ice caps.
  - The Moon has soft maria and craters.
  - Jupiter has its bands and the spot.
  - Saturn's rings tilt toward the viewer.
- **`/` at 1440x900, 1024x768 and 375x812.**
  - The system sits right of the words on wide screens and above them on the phone.
  - I measured the projected orbit against the words' box, and the outermost orbit clears the box.
  - With the bloom strength raised to 4 (`stage.bloom.strength = 4`), only the Sun bloomed.
  - The welcome-back line appears for a returning cadet. I created a local test cadet on my own origin to check it.
- **`/intro?dev`.** The opening Earth is the factory Earth, with clouds and the Moon. I also checked the Dive chapter close-up.
- **Battle backdrops.**
  - `/play/moon?dev`: the backdrop rendered and a practice battle started. The drones show the light hairline.
  - `/play/saturn?dev` and `/play/asteroid-belt?dev`: the backdrops rendered.
- **Retired scenes.** `/map`, `/bay` and `/hangar` still render.
- **Checks.** `bun run check` is green. It includes `tests/planets.test.ts`, which checks:
  - continents in the right places and a sea fraction of about 60–80% between 60° south and 60° north
  - deterministic maps
  - a seamless date line
  - the Cassini division
  - the palette mapping

Because the preview tab runs hidden, the game clock there runs slow. So I inspected the title's settled frame by pausing the stage and calling `stage.step(9)`.

## Not done or not verified
- **Reduced motion.** I did not check it in a browser. The code skips the fly-in and the drift, freezes the orbits, and the CSS reveal has no transition.
- **Mid-width desktops.** At 821–1100 px wide, the system is correct but small: it fits in the space right of the words. A later pass could stack the layout up to about 1100 px.
- **Sprite renderer.** It keeps one WebGL context alive for the session, and its sprites are data URLs held in memory.
- **`M.glow`.** It still allows an intensity above 1, and other tracks call it with values up to 2.6 (Nova's screen and ring, hangar strips, plasma balls). I did not clamp it, because that would change other tracks' scenes. I documented the rule on the method instead.
- **Title rocket.** At title scale it is a capsule a few pixels long with an ember trail. It is not the hangar's rocket model.
- **Uranus's ring.** It is barely visible in sprites because of its real tilt.

## Requests for other tracks
- **ships:** `hangar.ts` still paints its own Earth (line 60). Please replace it with `makeBody(M, "earth", 12, { lod: "high" })`, which gives the same Earth everywhere. Please also set the drones' final colour, which is `PALETTE.invader` (now `disk`).
- **engine:** `arena.ts` sets the bloom (strength 0.12, threshold 1.4), the exposure and the background by hand, around line 1100. It also builds its own light rig, with a rim in the old cyan `0x7dfcff`. When the visual freeze lifts, use `applyLook(stage, "space")` and `lookLights(look, …)`.
- **film:** `intro.ts` `setEnv` sets the background, bloom and exposure by hand, and the space colour is `0x030612`, not the void. Please move it to `applyLook`. `buildEarth`'s light (`earth.sun`) is now the space key colour.
- **kit:** swap the title's local `.mw-start` pill for the shared primary button, and the dev panel's links for the secondary style. `CadetSignUp` (`battle/ui.tsx`) still uses the old lime, glass and mono look. If you want the planet albedo colours with the other tokens, move the `ALBEDO` table from `planetMaps.ts` into `tokens.ts` as `BODY`.
- **Next wave (bay, map, briefing cards):** use `<PlanetSprite id size />` for every 2D planet. Call `preloadBody(id)` early on routes that will show a planet in 3D.
