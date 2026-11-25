# STATE: mathworld, branch `overhaul/void-and-gold`

_Updated 26 Nov 2026, after the final sweep and its two fix rounds. `main` still holds the previous version, untouched._

## What changed
- **Wave 2** (seven tracks, merged): the cockpit console in place of the floating calculator, the battle in discover mode with scans after a miss, the title with sign-up, the 2D Resting Bay, Star map and Academy, orbs derived in the fold, the Hangar shop, the teaching layer (Field Manual, greetings, guided first shot) and the film's beauty pass.
- **Finishers:** the daily patrol on the Resting Bay (`docs/overhaul/w3-patrol.md`), and the voice bake: 131 clips, each tied to its line by `tests/voice-clips.test.ts` (`docs/overhaul/w3-voice.md`).
- **Final sweep, round 1** (ten testers, eight of whom ran; 49 findings, 4 blockers, 10 major):
  - Saves: answers queue, retry and show "Not saved yet"; a retried batch is stored once (client ids, `src/app/api/events/dedupe.ts`).
  - Gates: a hub never sticks on its loading line; a locked planet's address lands on the Star map with that planet picked and the reason; gates use `location.replace` (a soft replace from an async mount effect can stall in this build).
  - The daily patrol pays only a patrol that was played. Switch cadet keeps the device's cadets and asks "Who is playing?".
  - Battle: miss lines are true of the picture; a Fire pressed while the fleet arrives waits for it; the briefing card has a Star map link.
  - Film: a reload after the film resumes at the battle (`seen` key `film:done`); the wait for a hand is 5 s; captions read alone hold at about 90 words a minute; "Pod" is in the glossary.
- **Round 2** (four testers, two fixers): purchases and the patrol save through the outbox; sign-up cannot put a name in the address and keeps the typed name on reload; focus returns to the opener; a Hyper-Jump needs a clean record (at most one miss, no Show me how); the wave planner remembers the mission (no first-try fact twice, a missed fact back once and later, bonus waves stay on the planet); a batch that failed to store is let through on its retry.

## What is verified
- `bun run check` green (334 tests) and `bun run build` compiles at the last commit.
- Round 2's testers re-tested round 1's fixes on the merged build: the five battle fixes hold; failed, slow and response-lost saves lose nothing and store nothing twice; gates, locked planets, the patrol forgery and Switch cadet hold.
- Round 2's own fixes were checked by their authors only (tests for the jump rule, the planner and the outbox; browser for sign-up and focus). No tester has replayed them.
- The retry guard end to end in the browser: one event posted, then the same batch again; the log grew by one.
- Attention scores for the 2D screens (25 rows): 17 calm, 6 busy, 2 overload (both the bay with a times table opened).

## Next, and open risks
- **The owner's review list comes first** (seven points, noted on 26 Nov, not started): film pacing; Power-Ups as a popup list; the phone cockpit; the Star map's card; the Star map moving planet to planet; a highlighted guide tour of what is available; the squad lines and count in the battle.
- **Open, major:**
  - Phones: a 6 x 7 fleet is about 12 px a ship at 360 x 640 and a 10 x 10 about 8 px. Not countable.
  - Answers played offline show as paid but pay once after reconnecting: the too-fast rule judges retried events by arrival time.
  - The orb counter runs one wave behind the "+N orbs" line.
  - A mission lost after a weak run restarts with no card saying so.
  - The bay with a times table opened is an overload (90 to 106 words, a four-word legend).
  - Structure words before any miss on 0 x n and 1 x n fleets, and the Show me how "Your turn" beat with about eleven things on screen. Left alone because they sit inside the owner's battle review.
  - The patrol's end card said "That did not save" for a patrol that had saved; the outbox change should cover it, not re-seen.
- **Open, smaller:** labels of 13 to 16 px on the hubs and the HUD; greetings that cover the Hangar's rocket and the Academy's last row; "Bonus wave" on a jump probe; the first battle's pause menu has no exits; practice on a fact that is not Gold pays; the locked reason names a planet two steps away; lines that need a re-bake (`unlock_easy-5-10`, the Empty lesson's "invader", `nova_err_added`).
- **Not verified at all:** sound (every check was muted; clips are measured, not heard), a real phone, Safari, reduced motion (code read only), motion at true speed (the test pane runs a few frames a second).
- **Saves:** the retry guard lives in server memory; an id column with a unique index is the lasting fix. Learning events are client-trusted: a paced script still earns what a fast player earns.
- **Decision pending:** captions read alone now hold longer, which makes a muted film slower; the owner's note says the film's pauses already feel long.
