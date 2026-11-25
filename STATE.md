# STATE: mathworld, branch `overhaul/void-and-gold`

_Updated 26 Nov 2026, after the review round's integration. `main` still holds the previous version, untouched._

## What changed
- **Review round** (the owner's seven points, `OVERHAUL.md` "Review round"; five tracks merged, notes in `docs/overhaul/r1-*.md`, index in `docs/overhaul/README.md`):
  - Film pacing: replies 0.15 to 0.45 s, heard captions leave with the voice, read-alone captions 0.8 s + 0.42 s a word, waits of 5 s, joins of 1 s. Sound on, the film plays in about 98 s (was about 157). The clock is data in `src/worlds/space/pace.ts` with a test.
  - Battle: nothing drawn on the fleet before the first answer; a scan counts one number at a time in a lane outside the fleet and the total lands last; `ui.hint` is only `on` or `off`. One Power-Ups button opens a list (a sheet on phones); the phone console has three rows; the orb counter agrees with its line; a lost mission shows a card.
  - Star map: a pager, one planet a page, opening on the cadet's planet; a card as wide as its words; a locked planet names the next planet to clear.
  - Tours: spotlight tours on the bay, battle (wave 2 of the first planet battle), Star map, Hangar and Academy, replayable from the help button's "Show me around". They replace those screens' greetings.
  - Integration fixes: no tour spotlights an empty Power-Ups space; the bay's first-arrival greeting is gone; the film's first battle has "Leave for now" in its pause menu; on phone widths the wave dots drop "0 won", which ran under the orb counter.
- Before that: wave 2, the patrol and voice bake, and two sweep rounds (saves through the outbox, gates by `location.replace`, Switch cadet, the planner's memory). See git history and `docs/overhaul/README.md`.

## What is verified
- `bun run check` green (410 tests) and `bun run build` passes at the last commit.
- Browser, muted, two brand-new cadets (1440x900 and 375x812): sign-up, film with Skip, the guided first shot, the battle tour at wave 2 holding the game, nothing on the fleet before an answer, a miss counting one number at a time with the total last, the Power-Ups list (dialog on desktop, sheet on the phone, holds the game, Flip It! runs), the bay tour on a first visit with no greeting, the Star map pager (opens on the Moon, arrows, `?at=`) and its tour (and its replay on the phone), the Hangar tour. No console errors; no hydration warning on a full load of `/hangar` after a dev-server restart.
- Not heard: sound. Not run: reduced motion, a real phone, Safari, 360x640 and 812x375 after the merge (the tracks checked those sizes on their own branches).

## Next, and open risks
- **Phones:** a 6 x 7 fleet is about 10 px a ship at 360 x 640 and 9 px at 812 x 375 (target 20). Needs the console's `setSafe` to report its real edges (cockpit) and the fleet to re-fit when Sector-Lock's row appears mid-wave (playfield).
- **Decisions for the owner:** the film's name card now rises under the cheer instead of 4 s alone on black; Launch launches itself after 5 s; the opening is still 19.9 s before the first word; Nova's "Too few!" lines are dropped after a scan; tablets get the Power-Ups dialog, not the sheet; the journey dots are 34 px wide at 360 px.
- **Lines to bake (film track only):** "Now count the ships in one squad.", "One squad. How many ships in it?" (playfield), plus the older list in `docs/overhaul/lines-to-bake.md`.
- **Still open from before:** offline answers pay once after reconnecting; the bay with a times table opened is an overload; the retry guard lives in server memory; learning events are client-trusted.
