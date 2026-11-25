# Review round: playfield (point 7)

Branch `overhaul/r1-playfield`. The dissection is `docs/overhaul/playfield.md`.

## What changed

- **Nothing on the fleet before the first answer** (decision 1). `nextHint()` returns null before a miss
  or an ask, for every fleet and every fact; `soft` is always false. The arena no longer climbs the
  ladder when a wave starts, and no longer says `nova_zero_squads` / `nova_zero_each` at arrival.
- **The scan counts one thing at a time** (decision 2, `src/battle/systems/scan.ts`). A lock-on bracket
  frames one squad, the rest of the fleet dims a little, and ONE number (24 px on screen) shows in the
  left lane; the number before it goes. After the last count a 0.35 s beat with nothing new, then the
  label lands in that lane ("7 squads", centred on the fleet) and only then `ui.hint.squads` turns on.
  0.4 s a step, faster above nine, 4 s at most (2.4 s with reduced motion). The each scan is the same
  along the first squad, in the top lane, then "8 in each squad"; the squads label is quiet (60%) while
  it runs. Typing or firing skips to the end, as before. The scan writes no captions.
- **1 x n** skips the squads rung: miss 1 counts the ships (the each rung, reveal `["each"]`).
  **0 x n / n x 0** have no scan rung; after a miss Nova's line is the zero line that fits; Show me how
  stays on miss 3.
- **One voice at a time** (decision 3). On a miss with a scan due, the strip's line comes first, the
  scan starts when the whole fleet is back (2.0 s, so at least 0.6 s later), and Nova's reaction is
  said after the label lands, or dropped when it would only repeat the strip (`nova_too_few`,
  `nova_too_many`, `nova_err_way_off`). The hold-fire line and Show me how keep their old order.
- **Labels cannot collide.** Lanes are pure geometry in `src/battle/lanes.ts`; the axis labels and
  hairlines are placed through it. The volley's squad ticks now show one at a time, go when a miss
  shows, and are not drawn while "7 squads" holds the left lane (that collision was SAW).
- **Show me how**: the axis words step back while a lesson runs; the "Your turn" beat now holds the
  fleet with its plates and divide, the two tags ("49", "+ 7") and the rocket (SAW on 7 x 8).
- **Phones**: the lane room is capped by the fleet's size (it was asked for in px and pulled the camera
  back every frame on a small phone); the rocket's band shrinks on short free areas
  (`rocketBand`), and on the smallest band the fleet keeps clear of the number on the nose.

## APIs and anchors

- `nextHint(state, tier?, shape?)` in `src/battle/hints` — `shape: { a, b }` as the cadet sees the fleet
  (added, optional). Old two-argument calls still compile.
- `scanTiming(steps, { max = 4 })` — `soft` accepted, ignored.
- `src/battle/lanes.ts`: `LANE`, `COUNT_PX`, `squadCountAt`, `eachCountAt`, `squadsLabelAt`,
  `eachLabelAt`, `overlaps`, `playfieldMoments`, `textAspect`.
- `arena.playfield()` (dev): every mark round the fleet as screen rectangles, the overlaps, the scan's
  current step, ship size in px, the camera's safe area and band. Read it from
  `window.__mw.arena.playfield()` with the stage paused.
- `scan.debug()`, `kill.clearTicks()` (added).
- `ui.hint.squads` / `ui.hint.each` are only ever `"on" | "off"` now (the type still allows "soft").
- Nothing for the integrator to mount.

## How it was verified

- `bun run check` green (380 tests). New: `tests/playfield-lanes.test.ts` (no overlap for 1 x 4, 0 x 10,
  6 x 7, 7 x 8, 10 x 10, 12 x 14 at seven zooms, 12–120 px a unit; counts in their lanes, 17 px or
  more; true counts); the ladder tests in `tests/battle.test.ts` (no first sight, the 1 x n rule, the
  empty rule) and the timing test in `tests/battle-formation.test.ts`.
- In the browser, stage paused and stepped 0.1 s at a time (SAW):
  - 1440x900, 7 x 8: no mark for 6 s after arrival; miss 1: numbers 1…7 one at a time every 0.4 s
    at x ≈ 563 (fleet from 596), 24–25 px; nothing for 0.4 s; "7 squads" (26 px) and
    `ui.hint.squads` on together; miss 2: 1…8 above the fleet, then "8 in each squad"; no overlap.
  - 1440x900: 1 x 4 counts ships 1–4, no squads; 0 x 10 no scan, no hint; 12 x 14 counts 10, 11, 12
    then 10…14; Show me how's "Your turn" five marks, no overlap.
  - 375x812: 6 x 7 21 px a ship, scan numbers 24 px left of the fleet; 10 x 10 14.3 px a ship and a
    clean scan (screenshot). 360x640: 6 x 7 10.1 px, scan clean. 812x375: 6 x 7 9.1 px.
  - No console errors.

## Not done or not verified

- **Ship size at 360x640 and 812x375 misses the target** (20 px for 6 x 7): the console reports a safe
  area of top 173 / bottom 251 (216 px left) at 360x640, though the strip's text ends near 107 and the
  keypad starts at 474. See requests.
- Miss marks are not moved to right and bottom lanes: they sit under the gathered survivors and fizz
  dots and are gone before any scan; a one-frame overlap of "N left" with the fleet's box as it grows
  is reported.
- Sector-Lock's own marks and the Power-Ups other than Jump One More were not measured.
- Nova's caption order after a miss was read from the code, not watched (sound off).
- No `/dev/playfield` route; the report is a method on the arena.

## Requests for other tracks

- **cockpit**: `arena.setSafe` on a phone should report the strip's bottom (about 110 px) and the
  console's top (about 474 px at 360x640), plus the caption band only while a caption shows. The fleet
  cannot reach 20 px a ship inside 216 px.
- **cockpit**: `BattleHud.tsx` still styles `"soft"` for `ui.hint.squads`; it never arrives now and can go.
- **docs**: add `playfield.md` and `r1-playfield.md` to `docs/overhaul/README.md`.

## Lines to bake

None added or changed. Wanted (film track):
- A line for after the squads count that names the next step without the number, e.g. "Now count the
  ships in one squad."
- A 1 x n line for after the ship count: "One squad. How many ships in it?"
