# Track: places (wave 2). Handoff

Branch `overhaul/w2-places`. The Star map and the Academy are 2D screens in Void and Gold, drawn with the planet sprites the battles' factory makes. Sprites are ready when a screen is. `bun run check` is green (215 tests; 13 new in `tests/places.test.ts`).

## What changed

### Star map (`/map`, `src/components/SolarMap.tsx`)
- It is one 2D screen on a quiet static starfield. The 3D map scene (`src/worlds/space/solarMap.ts`) is deleted.
- A dashed hairline path runs out from the Sun (the only glow) through the ten stops in order: Mercury, Venus, Earth, the Moon, Mars, the Asteroid Belt, Jupiter, Saturn, Uranus, Deep Space.
  - Wide screens (at least 1100 x 600): a gentle arc. The whole journey fits 1440 wide with no scrolling.
  - Anything smaller (phones, phone landscape, tablets): a vertical path that opens scrolled to the cadet's stop, with its panel and Launch in view.
  - The path is brighter from the Sun to the cadet, quieter beyond.
- Each stop shows its `PlanetSprite`, its name and what it teaches in a child's words ("×2, ×5 and ×10"; far planets say "Big numbers times small numbers"). The copy is in `src/components/world/words.ts`.
- Each state reads without colour:
  - cleared: a gold ring and a check badge (words on phones: "Cleared");
  - you are here: the ring-and-rocket glyph, and the only planet at full brightness;
  - open: the planet, slightly dimmer;
  - locked: a grey, dim silhouette with a lock badge. Choosing it says what opens it ("Clear Mars to open the Asteroid Belt.").
- Choosing a stop opens its panel in place (not a modal). The panel has the name, what it teaches, the cadet's marks for its tables (ten per table; past the tables, the facts met there), the Hyper-Jump line when it applies, and one primary action: Launch, Practise (a cleared planet), Warm up (Mercury, Venus), or nothing for a locked stop. On wide screens the panel sits under the chosen stop; on phones it opens inside the list under the stop.
- The Hyper-Jump line appears only when it is close (one perfect shot in) or earned:
  - close: "2 more perfect shots in a row and you can jump ahead to Jupiter."
  - earned: "You can jump ahead to Jupiter! Launch Mars to take the Hyper-Jump."
- Top bar: home, "Star map", orbs, help (when `onHelp` is passed) and sound. It sticks to the top on phones.
- Keyboard:
  - Tab goes through the stops in path order. The panel's action comes right after the chosen stop.
  - Arrow keys, Home and End walk the path from anywhere on the page.
  - Enter on a stop, or on the page, launches the chosen stop. Space only chooses it.
  - A locked stop never launches, by click, Enter, held Enter or arrows. Held Enter never launches twice.

### Academy (`/academy`, `src/components/AcademyScreen.tsx`)
- The ten tricks are one list, not a grid of cards. The list runs planet by planet in the order the journey meets the tricks, on the same dashed path, with a small planet sprite at each stop:
  - Earth: Empty & Mirror
  - the Moon: Fast Adding, Flip It!, Double It!, Easy 5s & 10s, Borrow & Take Back (2 × 9 is a Moon fact)
  - Mars: Jump One More, Split & Add
  - Jupiter: Big & Small Split
  - Saturn: Half & Double
- Each row has the kid name, one plain reason, the example fact (no answer shown), and a small true picture of the trick in dots.
  - The picture is an SVG generated from the numbers. Each kind of dot is one path, so Half & Double's 900 dots are three elements.
  - Watched tricks wear a gold ring and the word "Watched".
  - The first unwatched trick the cadet has reached says "Start here".
  - Tricks on planets not reached yet say "You will meet this on Jupiter."
- Choosing a trick plays its trick film in the 3D battle (`mountArena`, academy mode), then the battle HUD shows "Your turn". After a right answer the HUD's done card offers:
  - "Try 2 × 3", the sister fleet (primary);
  - "Watch again";
  - "All tricks".
- The film is in the URL (`/academy?watch=flip-it`). So:
  - Back returns to the list;
  - refresh replays the film;
  - a direct link opens it;
  - an unknown trick shows the list.
- "All tricks" is always on screen during a film, in the HUD's `menu` slot (top left). Escape also returns to the list.
- `/academy?trick=<id>` still highlights and scrolls to a trick, as before.
- Top bar: home, "Academy", orbs, help (when `onHelp` is passed), sound. Phone layout: the picture with its fact sits above the words.

### Planet sprites
- `src/components/world/spriteStore.ts` is new and has no three.js. Sprites are kept in memory for the session and in Cache Storage across visits.
  - The cache name is `mw-sprites-<SPRITE_VERSION>-<hash of the token colours>`. Old caches are deleted on first read.
  - `sprites.ts` also fingerprints the space look, the sprite camera and the extents. If those change, it clears the stored sprites.
  - A returning visit never loads three.js for sprites.
- `PlanetSprite` changes:
  - It reads the store synchronously, so a sprite drawn earlier shows at once, with no fade and no placeholder.
  - Until then, a hairline circle exactly the size of the body's disc holds its place. The size comes from `spriteDisc(id)` in `bodies.ts`, and rings and the Sun's halo are accounted for.
  - A large sprite (over 240 device px) first shows a quick low-detail picture, then sharpens in place.
  - The first fade uses the Web Animations API, so it is skipped under reduced motion. No CSS was added outside my files.
- Planet maps (`planets.ts`):
  - The worker pool now hands out the smallest maps first, so a screen's quick maps land before any 2048 map.
  - A worker that fails to load or crashes falls back to painting on the main thread. So does one that has not answered in 20 s. Before this, a failed worker left sprites waiting forever.
- Sprite rendering:
  - Each sprite is painted before it joins the single render queue, so a large sprite waiting for its sharp maps no longer holds up small ones.
  - Rendering no longer waits on `canvas.toBlob`, whose callback a background tab holds back. That had cost about one second per sprite.
- Measured on `/dev/planets` (48 sprites, the tab in front):
  - before: no sprite after 35 s in a background pane;
  - with an empty cache: everything shown about 2.5 s after load, with the large ones sharp by about 5 s;
  - with the cache: everything shown at once on hydration, and three.js never loads.

### Earth's atmosphere rim (decision 9)
I checked it in the code and on screen, and I changed nothing.
- **Seen:** on the 360 px sprite and in the Earth battle's 3D backdrop, a thin cool line at the limb, with no bloom.
- **Code:** the atmosphere is one additive shell at 1.035 × the radius. Its brightest value is about 0.09 linear luminance, against a bloom threshold of 1.0 (space look, strength 0.55). The sprite and the 3D scene use the same material and look, so the rim matches.
- **Measured on the sprite:** the shell outside the limb is a band about 3.5% of the radius wide, peaking near RGB 60/86/124 and fading to nothing at its edge.
- **Known nit:** the additive shell writes alpha 1 into the transparent sprite canvas. Over the void this makes no difference. Over a lighter fill (a hovered row) the band is opaque dark blue, about 1 px at 48 px. I left it, because fixing it means splitting the shell's alpha from its colour, and I judged it not worth the risk this wave.

## APIs for other tracks

```ts
// src/components/world/PlanetSprite.tsx (props added: style; everything else unchanged)
<PlanetSprite id="earth" size={96} />            // alt defaults to the name; alt="" when the name is written beside it
<PlanetSprite id="moon" size={48} alt="" style={{ filter: "brightness(0.8)" }} />

// src/components/world/spriteStore.ts (no three.js; safe anywhere on the client)
preloadSprites([{ id: "earth", size: 360 }, { id: "moon", size: 48 }])  // start drawing what a screen will show, most important first
getSprite(id, sizePx): Promise<string>     // memory, then Cache Storage, then a render
spriteNow(id, sizePx): string | null       // synchronous: already drawn this session?
SPRITE_VERSION                              // bump when the painter, the factory or the sprite camera changes a picture

// src/worlds/sprites.ts (unchanged signatures)
planetSprite(id, sizePx): Promise<string>  // now an object URL or a data URL (was always a data URL)
planetSpriteAlt(id)
renderSprite(id, px)                       // new, used by the store

// src/worlds/space/bodies.ts (added)
SPRITE_EXTENT, SPRITE_MARGIN, spriteDisc(id)   // the body's disc as a fraction of its sprite square

// src/components/SolarMap.tsx and AcademyScreen.tsx
<SolarMap onHelp={() => openManual("map")} />   // onHelp optional; STOP_NAMES still exported
<AcademyScreen onHelp={() => openManual("academy")} />

// src/rig/academy.ts (added; FILMS and filmOf unchanged)
FIRST_MET: Record<TrickId, PlanetId>       // where the journey first shows each trick (a test derives it from the router)
FILMS_BY_JOURNEY: Film[]

// src/components/world/ (new, mine)
journey(state), hereIndex(stops), hyperJump(state), stopMarks(state, id)   // journey.ts, pure
trickPicture(trick, a, b), layoutPicture(pic, w, h), solidDots(panel)      // trickPictures.ts, pure
<TrickPicture trick a b width height />    // TrickPicture.tsx, server-safe
<Starfield count seed />                   // Starfield.tsx
STOP_WORDS, STATE_WORDS, ACTION_WORDS, TRICK_REASON, ACADEMY_WORDS, jumpLine, lockedLine   // words.ts, all the copy
```

The Field Manual or the Bay can use `<TrickPicture>` for a trick's picture. It is true to any fact the trick routes to, not only the Academy's examples; the test covers every film and its sister fact.

## Mounting (for the integrator)
1. Nothing is required: `/map` and `/academy` work as they are. Their pages still render `<SolarMap />` and `<AcademyScreen />`.
2. To wire help, pass `onHelp` from the page or a wrapper once the Field Manual lands, for example `<SolarMap onHelp={...} />`. I did not edit the pages to import the manual track's code.
3. When the console track's new battle HUD lands, check that it still accepts these three props:
   - `menu`: the Academy puts "All tricks" there;
   - `doneActions`: the three buttons above;
   - `launch={false}`.

   If those props change, the Academy's `TrickFilm` (the bottom of `AcademyScreen.tsx`) is the only place to adapt.
4. The Academy's film listens for Escape to go back to the list. If the new HUD uses Escape for its pause menu, one of the two should give way. I suggest that the HUD's pause menu wins when it is mounted with a `menu`.

## How I verified it
All of this was on `http://places.localhost:3324`, muted, with my own tab in front. In a hidden background pane React never finishes hydrating, because Suspense reveal waits on `requestAnimationFrame`, so I fronted my tab to test.

I seeded three cadets by posting events for my own cadet (sign-up, `intro_completed`, `planet_cleared`):

| Cadet | Where I checked |
| --- | --- |
| brand-new | the map at 1440x900, 375x812, 360x640, 812x375 and 768x1024; the Academy at 1440x900 and 375x812 |
| on Mars, with a few answers | the map at 1440x900 and 375x812 |
| everything cleared | the map at 375x812 (Deep Space shows the rocket and the gold ring); the Academy at 1440x900 |

- **Seen:**
  - at 1440x900 the whole path is on screen with no scrolling, and the cadet's panel with Launch is under its stop;
  - at 375x812 and 360x640 the list opens on the cadet's stop with Launch in view;
  - at 812x375 Launch sits at the bottom edge (3 px clipped);
  - no horizontal overflow at any size.
- **Keyboard:**
  - ArrowRight to the Asteroid Belt, then Enter three times: it stayed on `/map`, and the panel said "Clear Mars to open the Asteroid Belt."
  - ArrowLeft twice to the Moon showed Practise, and Enter opened `/play/moon`. Back returned to the map.
  - Tab focus shows the gold ring, and the panel follows it.
- **Academy:**
  - I opened Flip It!: the film played, and "All tricks" was on screen and returned to the list (stage disposed).
  - I opened `?watch=fast-adding` directly, watched it to "Your turn: load it and fire!", answered 12 on the keypad, and got "Nailed it" with "Try 2 × 3", "Watch again" and "All tricks".
  - "Try 2 × 3" played the sister fleet, and Escape returned to the list. Fast Adding then read "Watched" with the gold ring.
- No console errors on `/map`, `/academy`, `/dev/planets` or `/play/earth?dev`.
- `impeccable detect` on the changed files: no findings.
- Tests (`tests/places.test.ts`):
  - the journey for a new cadet, a Mars cadet and an all-cleared cadet;
  - no stop offers an action the director's `canLaunch` would refuse;
  - the Hyper-Jump wording;
  - mastery rows;
  - `FIRST_MET` derived from `lesson()` over every planet's facts (the test caught Borrow & Take Back on the Moon);
  - every trick picture (examples and sisters) has exactly a × b solid dots per panel and no overlaps, and Flip It! and Double It! are exactly as the brief describes;
  - pictures fit their box.

## Not done, or not verified
- **Help is not wired.** `onHelp` is accepted but the pages pass nothing, so the help button is hidden until the manual track lands.
- **Not checked on a real device:** reduced motion, rotation, or a real phone. Rotation is handled with `matchMedia`, but I only resized the viewport.
- **Typing an answer during the Academy's "Your turn":** I could not check typing from the keyboard. Keypad taps worked; my typed keys did not reach the HUD. The HUD's keyboard handling belongs to the console track and is being rebuilt.
- **No mastery legend in the map panel.** The marks have spoken names ("The 3s: 2 Got it, 8 New") but no visible legend. The Bay's table sheet shows one.
- **Tablet and phone landscape use the vertical path.** Under 1100 px wide that is roomy but sparse.
- **Sprites on another browser:** I measured Cache Storage only on this Chromium. Where it is unavailable (an insecure origin, private mode), sprites still work for the session.
- **Earth's sprite band:** the alpha nit described under decision 9.

## Requests for other tracks
- **front** (`globals.css`, `RouteFade`): in a background tab, nothing hydrates until `requestAnimationFrame` runs (React's Suspense reveal). Players won't hit this, but every agent testing in the hidden pane will. Front your tab before testing.
- **front** (`RestingBayScreen`): call `preloadSprites([{ id: planet, size: 360 }])` as early as possible, and consider `<Starfield>` from `world/` instead of the bay's own `Stars`, so the two screens share one sky.
- **console**: keep `BattleHud`'s `menu`, `doneActions` and `launch` props (or tell the integrator the new names). The Academy relies on them.
- **manual**: the Field Manual can show a trick with `<TrickPicture trick a b />`, and planets with `<PlanetSprite>`.
- **economy** (`hub.ts`): `TEACHES` still says "2-digit × 1-digit". The map no longer reads it, so you may retire it or point it at `STOP_WORDS`.

## Lines to bake
None. Neither screen speaks. Every new word is on screen, and all of it is in `src/components/world/words.ts`.
