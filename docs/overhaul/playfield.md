# The play area, dissected (review round, point 7)

Everything drawn in the battle's play area (between the question strip and the console), when it comes
and goes, where it sits, its size on screen and what it can overlap. Measured with `arena.playfield()`
(see "The overlap report" below) on `/play/moon?dev&a=…&b=…`, the stage paused and stepped in 0.1 s steps.
Times are stage seconds from the moment named. "SAW" is measured in the browser; "INFER" is read from
the code and not measured.

## The lanes

The fleet's box holds ships only. Words and numbers go in lanes round it (`src/battle/lanes.ts`):

| Lane | Holds | When |
| --- | --- | --- |
| left | one squad count (1, 2 …) beside the squad being counted, then "7 squads" centred on the fleet | after miss 1 |
| top | one ship count above the ship being counted, then "8 in each squad" | after miss 2 (miss 1 on 1 x n) |
| right and bottom | the miss marks: "12 left" under the gathered survivors, "5 too many" under the fizz dots | from the miss to the fleet's return |
| below the fleet | the rocket and the number on its nose | always |

A hairline (0.035 world units) runs between the fleet and the left and top lanes, only with its label.

## One wave, before any answer

| Element | Comes | Goes | Where | Size 1440x900 (7 x 8) | Size 375x812 (6 x 7) | Overlaps |
| --- | --- | --- | --- | --- | --- | --- |
| Fleet (true a x b array) | warps in squad by squad over ~1.2 s | when cleared | centre of the free area | 249 x 285 px, a ship 27 px (SAW) | 169 x 189 px, a ship 21 px (SAW) | nothing |
| Rocket | always | never | bottom centre of the free area | 99 x 252 px box incl. the nose number (SAW) | 62 x 160 px (SAW) | nothing (2 px gap to a 10 x 10 fleet on a phone) |
| Number on the nose | first digit typed | after the volley | above the nose | 44 px figures (INFER, arena) | 28–30 px (INFER) | nothing |
| Nova's drone | the fleet lands | lesson end | hovers at the fleet's top-left edge | about 30 px (SAW, screenshot) | smaller | nothing |
| Bracket, row numbers, "7 squads" | **never before an answer now** | | | | | |

Before (the owner's complaint, SAW by the lead): ~2.5 s after arrival a soft scan drew a hairline down
the left, seven 8 px numbers at once, and "7 squads" on top of the 4. That scan is gone (decision 1):
`nextHint` returns null before a miss for every fleet. SAW after the change: 7 x 8, 1 x 4, 0 x 10,
10 x 10, 12 x 14 and 6 x 7 show zero marks for 4–6 s after arrival.

## Typing and the volley

| Element | Comes | Goes | Size | Overlaps |
| --- | --- | --- | --- | --- |
| Number on the nose | each key | counts down one per ball | as above | nothing |
| Balls | Enter | land in reading order | small | ships (by design) |
| Kill ring and shards | each hit | ~0.25 s (shards drift on) | ring about a ship | ships |
| Leader's pennant | a squad cleared | ~0.75 s | small, gold | its squad |
| Squad tick (1, 2, 3…) | a squad cleared | 0.9 s | 20 px, left of the squad's leader | **was** 2–3 on screen at once and the "6" tick under "6 left" (SAW); **now** one at a time, cleared when a miss shows, and not drawn while "7 squads" holds the left lane (that collision SAW on miss 2 before the fix) |

## Miss 1 (too few; 50 on 7 x 8)

t = 0 is the moment the strip's line shows ("6 ships got away. Try again.").

| Element | Comes | Goes | Where | Size 1440x900 | Notes |
| --- | --- | --- | --- | --- | --- |
| Strip's miss line (HUD) | 0 | next shot | under the question | HUD | the first voice |
| Survivors gather | 0–0.45 s | return at 1.65 s | top-left rows | | the miss in the world |
| Bracket + "6 left" | ~0.5 s | 1.65 s | under the survivors | 24 px | one frame overlaps the fleet box as it grows (SAW) |
| Fleet back | 1.65 s | | | | keypad live at 2.0 s |
| Squad scan | 2.1 s | | | | starts ≥ 0.6 s after the strip line |
| – lock-on bracket | each step | next step | round the squad | 35 px tall | |
| – the rest of the fleet dims a little | each step | the beat | void panes over the other squads | | |
| – one number | every 0.4 s | the next number | left lane, right edge 0.35 units off the fleet | 24–25 px (SAW); 24 px at 375x812 | one at a time (SAW: never two) |
| – the beat | after 7 x 0.4 s | 0.35 s | nothing new | | |
| "7 squads" label | 2.1 + 2.8 + 0.35 s | the wave ends | left lane, centred on the fleet | 90 x 26 px (SAW) | no overlap (SAW) |
| `ui.hint.squads` = on | with the label | | HUD | | never before (SAW: off through the count) |
| Nova's line | after the label | | caption band | | dropped when it only repeats the strip ("Too few!", "Too many!", "Way off!") |

## Miss 2

Same miss marks, then the each scan along the first squad: one number at a time in the top lane
(SAW: 1…8 at y ≈ 220, the fleet's top at 223+), the squads label quiet (60%), then "8 in each squad"
(144 x 27 px, SAW) and `ui.hint.each` on. The fitting Power-Up is flagged. Nova's invite line
("Tricky one! Try a Power-Up, or tap Show me how.") comes after the label (INFER, from the code).

## Miss 3 or Show me how

Both labels are on in the HUD; in the world the axis words step back while the lesson runs. The
"Your turn" beat (Jump One More on 7 x 8, SAW): the fleet, its two plates and the divide, the tag
"49" (78 x 51 px), the tag "+ 7" (79 x 51 px), the rocket, Nova's drone. Before the change the axis
words and both hairlines were also up (nine marks); no overlap is reported now.

## 1 x n, 0 x n, n x 0

- 1 x 4 (SAW): nothing before an answer; miss 1 counts the ships 1, 2, 3, 4 in the top lane, then
  "4 in each squad". No squads scan, ever.
- 0 x 10 (SAW): the empty ring only; nothing said before a miss (the "nova_zero_*" line no longer
  plays at arrival); after a miss "7 too many" with its fizz dots and no scan (SAW); Nova's "No squads at all! How
  many ships is that?" after the miss (INFER, from the code; captions not checked); Show me how on miss 3.

## A Power-Up run, a wave clear, Sector-Lock

- Power-Up: its plates, lasers and tags are the `visual` marks (src/battle/powerups, src/battle/systems/marks.ts);
  measured only for Jump One More inside Show me how (above). INFER: the other Power-Ups use the same
  marks group and the same overlap report applies.
- Wave clear: the last kill's hit-stop and camera jolt, then the HUD's card. Nothing new in the play area.
- Sector-Lock (12 x 14, a 10s band): the squad scan counts 10, 11, 12 (a band of ten counts as ten at
  once), the each scan 10, 11, 12, 13, 14; no overlap (SAW). Sector marks themselves: not measured.

## The overlap report

`window.__mw.arena.playfield()` (dev) returns `{ time, fleet, rocket, shipPx, marks[], overlaps[], scan, hint, words, safe, band, lift }`:
every label, hairline, scan count and bracket, miss mark, Power-Up mark and kill tick as a screen
rectangle in CSS px, and every pair of words that overlap (lines crossing lines and a lesson's tags on
its own plates are not counted). The pure version is `playfieldMoments()` in `src/battle/lanes.ts`,
proved in `tests/playfield-lanes.test.ts` for 1 x 4, 0 x 10, 6 x 7, 7 x 8, 10 x 10 and 12 x 14 at seven
zooms (12–120 px a world unit, which covers 360x640 to 1440x900).

## Phones

| Size | Fleet | A ship | Free area (from the console's `setSafe`) |
| --- | --- | --- | --- |
| 375x812 | 6 x 7 | 21 px (SAW) | top 173, bottom 251 |
| 375x812 | 10 x 10 | 14.3 px (SAW; 12.7 before the band change) | top 175, bottom 251 |
| 360x640 | 6 x 7 | 12.4 px (SAW; 8.5 before) | top 173, bottom 251: 216 px of height for fleet and rocket |
| 812x375 | | not measured | |

The 360x640 target (20 px a ship) cannot be met inside a 216 px free area. The strip's text ends at
about 107 px and the keypad starts at 474 px; the console reports more than that (a request to the
cockpit track is in `r1-playfield.md`).
