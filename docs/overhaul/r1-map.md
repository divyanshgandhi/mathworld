# Review round: map track (points 4 and 5)

The Star map is a pager now: one planet a page, a card as wide as its words, ten journey dots for the whole route.

## What changed
- `src/components/SolarMap.tsx`, rewritten. The arc (desktop) and the vertical list (phone) are gone.
  - **Pager.** A sideways scroller with `scroll-snap` (mandatory, `snap-always`), so a trackpad or a finger moves it a page at a time and snaps. The scrollbar is hidden; `overscroll-x-contain` keeps a swipe from turning into the browser's Back.
  - **Moving.** Arrow buttons at the two sides (48 px, kit `IconButton`, absent on the first and last page; focus passes to the other arrow when one vanishes). Left and right arrow keys, Home and End, from anywhere on the screen except inside a dialog or a field. Ten dots under the page; tapping one goes there. A scripted move (arrow, key, dot) is a 240 ms exponential ease-out (`MOTION.route`), whatever the distance; none under reduced motion. A hand scroll is the browser's own.
  - **Opening.** On the cadet's planet at once (the scroll position is set before the first paint, with no ride past the others). `?at=<planet>` opens there (a reload), else `?locked=<planet>`, else the cadet's planet. The address follows the page with `history.replaceState` (`?at=`, and `locked` is dropped), so Back leaves the map rather than walking the planets.
  - **Page.** The planet is the hero (`PlanetSprite`, up to 400 px on desktop, 360 on a tablet). Its neighbours peek in dim (opacity, no filter) and small at the edges, on a dashed hairline that runs across every page, so the path reads as one line while you scroll. The Sun sits before Mercury as scenery. Marks on the hero: a gold ring and a check when cleared, a lock (and a grey planet) when locked, the ring-and-rocket glyph on the cadet's own.
  - **Card.** `w-max`, 320 to 420 px (less on a small phone), every line on one left edge: chip ("You are here" with the rocket, "Cleared" with a check, "Locked" with a lock, "Warm-up", "Open"), the name in the display voice, one line (`STOP_WORDS[id].teaches`, unchanged), the table rows with the kit's `Pips`, the Hyper-Jump line on the cadet's planet when it is close, then one button: **Launch** (primary) on the cadet's planet, a quieter **Practise** (secondary) on a cleared planet, **Warm up** (secondary) on Mercury and Venus, none on a locked planet, which says "Clear Earth first." (the next planet to clear on the route).
  - **Composition** (`src/components/world/mapLayout.ts`, pure). Wider than tall: the planet left of centre, the card to its right, the two centred as one group. Taller than wide: the planet above, the card below, the two centred as one column over the dots; the room left for the planet is what the tallest card leaves, so the button is in view on every page. A phone on its side: planet left, card right, dots under the planet (clear of the card). Every page of one size shares one geometry, so the planet lands on the same spot on every page.
  - **Sprites.** Pages within two of the one in view draw their planet; the rest hold its place with a hairline circle of the same size (nothing shifts when a sprite lands, `PlanetSprite`'s own placeholder does the same). Preloading runs nearest first: the page in view, its neighbours (hero and peek sizes), the Sun, then the rest. Sprite sizes snap to 8 px steps, so a small resize does not redraw.
  - Pages other than the one in view are `inert` and `aria-hidden`, so Tab never lands on a page out of view. The pager is a `region` with `aria-roledescription="carousel"`; each page is a `group` "3 of 10: Earth".
  - The greeting floats under the top bar (`edge="top"`), so on a phone on its side it does not cover the card's button.
- `src/components/world/journey.ts`, additions only: `JourneyStop.clearFirst`, `openingPage`, `chipOf`, `cardLine`, `buttonOf`. `lockedBy` stays as it was.
- `src/components/world/words.ts`, addition only: `clearFirstLine(id)` ("Clear the Moon first."). No existing words changed.
- `tests/map-pager.test.ts`: which page opens, the chip for each state, the locked line naming the next planet (never two steps away), the one button, and the layout at the six verification sizes.

## APIs and anchors
- Anchors (`data-guide`), on the page in view only, so `querySelector` finds the right one: `map-planet` (the hero), `map-card`, `map-launch` (the card's one button, whatever its word; absent on a locked page). Always present: `map-dots`. `map-prev` and `map-next` are absent on the first and last page.
- `openingPage(stops, { at, locked })`, `chipOf(stop)`, `cardLine(stop)`, `buttonOf(stop)` from `@/components/world/journey`; `mapLayout(w, h, cardH)` from `@/components/world/mapLayout`.
- `<SolarMap onHelp? />` is unchanged; `/map` mounts it as before.

## Mounting
Nothing to wire. `/map`, `/map?locked=<planet>` (the battle's gate in `WaveArena.tsx` already sends locked planets there) and `/map?at=<planet>` all work as they are.

## How it was verified
SAW, in the browser on this track's own origin, with sound muted:
- 1440x900, 1024x768, 768x1024, 375x812, 360x640, 812x375: one planet a page; the card beside the planet (wide) or under it (tall); the card's button inside the viewport (measured); main copy 17 px or more (measured: chip 17, line 19, row labels 17, button 17; the name is 28 to 40); the document never wider than the window.
- A new cadet (Earth: "You are here", Launch; the Moon locked: "Clear Earth first."), a cadet on Mars (Earth and the Moon cleared, Practise; Mars Launch), a cadet with everything cleared (Deep Space "You are here, cleared", no next arrow, nine filled dots and a gold ring).
- The arrow keys, Home, the prev arrow, a dot, a programmatic scroll and a partial scroll (it snaps to the next page) all move the page and the address follows (`?at=`). A reload on `?at=mercury` opens on Mercury with the Sun beside it. `/map?locked=moon` and `?locked=jupiter` open on that planet with its locked line. Back from the map after moving pages returns to the Resting Bay. A resize from 1440 to 375 stays on the same page.
- `bun run check` green (342 tests).

INFERRED, not seen:
- Reduced motion (no tween) and a real touch swipe: the code paths are plain (`matchMedia`, native scroll-snap), but the pane could not emulate either.
- A real trackpad: five wheel ticks at 1440 wide snapped back to the same page; a larger gesture moves it.

## Not done
- The card is narrower than its 420 px maximum on most planets, so the group sits a little left of true centre on desktop (the planet keeps one spot on every page instead).
- On a 360x640 phone with every table met, the tallest card (the Asteroid Belt: four rows and a two-line name) leaves the planet about 128 px.
- Not seen: a cadet one perfect shot from a Hyper-Jump on a phone on its side. The jump line adds two lines to that card, which may push it past a 375 px tall page.
- The Next.js dev badge overlaps the first journey dot in development only.

## Requests for other tracks
- **tour (owner of `src/teach/greetings.ts`):** the map's greeting still says "Tap a planet. Win there to open the next one." With the pager, "tap a planet" no longer fits. Suggested existing-style line if a clip can be baked: "Swipe to see each planet. Launch where your rocket is." (or leave it silent until the film track bakes it). The tour can anchor on `map-planet`, `map-card`, `map-dots`, `map-next` and `map-launch`.
- **integrator:** nothing to wire.

## Lines to bake
None from this track.
