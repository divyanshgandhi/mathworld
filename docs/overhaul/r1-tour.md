# Review round, track `tour`: the spotlight tours (owner's point 6)

Branch `overhaul/r1-tour`. Decision 8 of the review round: a dimmed screen with a cut-out round one control, one line of ten words or fewer, dots, Next and Skip; four steps at most; shown once (`tour:<id>`); replayable from the help button; never with the guided first shot or during a wave's action; it replaces that screen's greeting.

## What changed
- `src/teach/tour.ts` (new): the five tours as data (`TOURS`), `tourKey(id)` = `tour:<id>`, `TOURED_SCREENS`, `liveSteps` and `nextStep` (steps whose anchor is missing are passed over), and the pure placement `placePlate(ring, plate, view)` (below, above, right, left; inside the view; off the ring; `fits: false` when no side has room) with `ringOf` and `clipTo`.
- `src/teach/tourState.ts` (new): page state the tours share: whether the guided first shot is running, which screen tour is mounted, and a replay asked for from the manual.
- `src/components/teach/Tour.tsx` (new): `Tour`, `useTour`, `ScreenTour`, `findAnchor`, `pageBusy`.
  - Spotlight: a scrim of `--color-scrim` (the one black) as the spread of a rounded cut-out, a 1 px gold ring, no glow. Plate: Nova's portrait, the line at 19 px, step dots, "Next" ("Got it" on the last), a quiet "Skip"; both 44 px tall.
  - The plate picks its side and never covers its target; it stays inside the screen less its safe areas (read from `env(safe-area-inset-*)`). On a short screen (a phone on its side) it becomes one low row, 580 px wide at most. If no side has room, the target is scrolled to the top once so the plate fits below it.
  - It follows the target every frame, and also on scroll, resize, rotation and a 250 ms clock (frames stop in a hidden tab). The target is scrolled into view first.
  - It starts once the screen has been calm for 0.6 s: no visible `[role=dialog]`, `[role=alertdialog]`, `dialog[open]` or `[aria-modal=true]`, and the guided first shot not running. It is marked seen when its first step shows. If no anchor turns up within 2.5 s it ends without being marked seen.
  - If a dialog or card opens over it, or `when` turns false, it closes.
  - Focus moves to Next and stays in the plate (Tab cycles Skip and Next). Escape skips. Enter goes on. Other keys do not reach the game (stopped in the capture phase). The line is `aria-live="polite"`. Taps outside the plate do nothing.
  - Under reduced motion the ring and plate cut, they do not move.
  - `hold` holds the battle with `hold.on("tour")` while it shows and lets go when it closes or unmounts.
- `Greeting`: renders nothing for `bay`, `map`, `hangar` and `academy` (a screen with a tour shows the tour). `always` keeps it for the /dev/teach review. Flashcards and the Cadet Bay battle keep their greetings.
- `FieldManual`: a first item in its header, "Show me around", shown only when a `ScreenTour` is mounted. It closes the manual and runs that screen's tour again once the manual has gone.
- `FirstShotGuide`: tells the tours while it runs (`tourState.guideOn()`), so no tour starts with it. It also mounts the battle tour for review when the URL has `?dev&tour=battle`.
- Mounted, with anchors (attribute edits plus one mount line each):
  - `RestingBayScreen.tsx`: `bay-launch` (the Launch link), `bay-tables` (the tables block), `bay-places` (the "Go to" nav); `<ScreenTour id="bay" seen={{ seen: state.seen, emit }} />`.
  - `HangarScreen.tsx`: `hangar-list` (the Paint / Blasters / Thrusters tabs), `hangar-rocket` (the first look in the open list), `hangar-buy` (the dock); `<ScreenTour id="hangar" … />`.
  - `AcademyScreen.tsx`: `academy-list` (the first planet's group of tricks, so the ring is not taller than the screen); `<ScreenTour id="academy" … />`.
  - kit `TopBar.tsx`: `orbs` on `OrbCount`, `help` on the help button.
- `/dev/teach/tour` (new): the tour on mock targets: each side, a long line, every edge and corner, a missing anchor (and a hidden one), nothing there at all, a target that moves, and one far down the page.
- `docs/teaching.md`: Part 4, where each tour sits in the first five minutes, and the rule that a tour introduces nothing the screen has not already shown.
- `tests/tour.test.ts` (new, 12 tests): the data (at most 4 steps, at most 10 words, sentence case, valid seen keys), missing anchors skipped, nothing to show, seen and replay through `tourState`, the guide flag, and the placement over 1,600 targets on 5 screen sizes (never over the target when any side has room, always on screen).

## APIs for other tracks
- `import { ScreenTour, Tour, useTour, TOURS, tourKey, tourState } from "@/components/teach"`.
- `<ScreenTour id="bay" | "battle" | "map" | "hangar" | "academy" seen? when? hold? force? onDone? />`
  - `seen`: the hub's `{ seen: state.seen, emit }`; leave it out in the battle (it reads and posts through the outbox itself).
  - `when` (default true): false holds it back; turning false while it shows closes it.
  - `hold`: `hold.on("tour")` while it shows (the battle).
  - `onDone(how)`: `"done" | "skipped" | "nothing" | "interrupted"`.
- `<Tour id steps seen? when? hold? force? onDone? />` with `steps: { anchor, line }[]` (the contract's shape).
- Anchors are found by `[data-guide="<name>"]`, first visible match. Names are the contract's.

## Mounting for the integrator (one line each)
1. Battle (`WaveArena.tsx`, cockpit track), next to `FirstShotGuide`:
   ```tsx
   {arena && <ScreenTour id="battle" hold when={tourMoment} />}
   ```
   `tourMoment` is true only between wave 1 and wave 2 of the cadet's first planet battle (campaign mode, no planet cleared yet), after the first wave's result has gone and before wave 2's fleet is live. To hold wave 2 until the tour has gone, start it from `onDone`. If the tour has been seen, it renders nothing and `onDone` is never called, so do not wait on it then (check `state.seen["tour:battle"]`). It will not start while the guided first shot runs or while a dialog shows.
2. Star map (`SolarMap.tsx`, map track):
   ```tsx
   <ScreenTour id="map" seen={{ seen: state.seen, emit }} />
   ```
   Its steps need `map-planet`, `map-next`, `map-dots` and `map-launch`. Any that are missing are skipped. The map's `Greeting` already renders nothing.
3. Nothing else is needed for the Field Manual: "Show me around" appears wherever a `ScreenTour` is mounted.

## How it was verified
SEEN in the browser on my own origin (silent, `mw:mute`), a fresh cadet, pane hidden:
- /dev/teach/tour at 1440x900: each side (below, above, and the tall side targets), the long line (19 px, 3 lines), the missing anchor (shows steps 1 and 4 only, dots for 2, ends "done"), nothing there (never shows, ends "nothing"), the moving target (followed, never overlapped), the far target (scrolled into view first). Escape ended "skipped"; Enter went to step 2.
- Bay tour, first visit at 1440x900: 4 steps, no overlap, inside the screen, Skip 70x44, Next 96x44, focus on Next / Got it, no floating greeting. Replayed from the help button ("Show me around" 150x44; the manual closed and the tour ran) at 375x812, 360x640 and 812x375. At 812x375 the tables block no longer fits beside a plate: it is scrolled to the top and the plate sits below it, with no overlap.
- Hangar tour: first visit at 812x375, replays at 1440x900, 375x812 and 360x640. All 3 steps, no overlap, inside the screen, no greeting.
- Academy tour: first visit at 360x640, replays at 812x375 and 1440x900. Closed with Enter.
- Battle tour on /play/moon?dev&tour=battle with today's anchors:
  - The briefing card was up and no tour showed over it.
  - After Launch, the guided first shot ran ("Count the ships", "Type how many") and no tour showed.
  - Once the shot resolved, the tour ran "Power-Ups…" then "Stuck?…". `dots` and `pause` were skipped, so there were 2 dots.
  - A key typed during the tour did not reach the keypad.
  - Resizing to 375x812 mid-tour, the plate followed the target with no overlap.
- `bun run check` green (346 tests).

INFERRED, not seen:
- The motion between steps. Transitions do not run in the hidden pane.
- The scrim's look on a real phone.
- Safe-area insets on a notched device. They are read from `env()`, which is 0 here.
- Reduced motion. The code sets `transition: none`; I did not emulate the setting.
- That `hold.on("tour")` was the reason the stage was paused. The stage was paused, but the hidden tab also holds it.

Seen, an artifact of this dev server: on a full load of `/hangar`, the server HTML lacked `data-guide="help"` on the top bar's help button. React logged a hydration-attribute mismatch, which it does not patch. On a client navigation the attribute is there. Touching `TopBar.tsx` did not refresh the server render. I take it to be a stale server-side module cache in this long-running `next dev`, since the same file's `orbs` edit renders. A fresh server should not show it. Please check after the merge.

## Not done
- The battle and map tours are not mounted for real (files not mine). The lines are above.
- `?dev&tour=battle` forces the battle tour as soon as the screen is calm, even mid-wave. It is for review only.
- No tablet (768x1024) pass. The placement tests include that size.

## Requests
- cockpit: put `data-guide="pause"` on the PauseMenu trigger and `data-guide="dots"` on the mission's wave dots. Mount the battle tour (line 1 above).
- cockpit: as a second guard, `Console`'s and `Keypad`'s window key listeners could ignore keys while `hold.held`. The tour already stops keys in the capture phase.
- map: the Star map anchors from the contract (`map-planet`, `map-card`, `map-prev`, `map-next`, `map-dots`, `map-launch`), and the map tour mount (line 2 above).
- integrator: restart the dev server after the merge and confirm no hydration warning on `/hangar`.

## Lines to bake
None. Tours are captions only, with no voice (decision 10).
