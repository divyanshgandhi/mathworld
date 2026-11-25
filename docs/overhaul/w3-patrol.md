# Track: daily patrol (wave 3). Handoff

Branch `overhaul/w3-patrol`. The daily patrol's screen: the bay's slot, the patrol on the flashcards sheet, and an end card that shows what the fold really paid.

## What changed
- **`src/components/hub/DailyPatrol.tsx`** (new).
  - `PatrolSlot`: one quiet line and one secondary action under Launch. Launch stays the only primary.
    - Facts due: "Daily patrol. 3 quick facts." with the orb ring and 15, and "Start patrol".
    - Done today: "Patrol done. Come back tomorrow."
    - Nothing due: nothing at all. A brand-new cadet has nothing due on day one.
  - `DailyPatrol`: the slot plus the patrol. The due facts are fixed when it opens, so answering does not change the list under the cadet. It runs on the flashcards sheet with dots for progress, no timer and no Nova line. A miss shows the true array and comes back once at the end.
  - At the end, `patrol_completed` (the facts answered right, each once) goes through the outbox after the answers, exactly once (a ref guard). The end card shows "Patrol done." and "Saving..." until the server's log, folded, shows the patrol's ledger line. Then it shows that amount with the orb ring. A failed save says "That did not save. Check the connection and try again." with Try again. Try again first asks the server, then re-sends only the answers the server lost (`patrolUnreviewed`) and the report.
  - If nothing was answered right, nothing is posted: "Good practice. Get one right on the next patrol to earn orbs." The patrol stays due.
  - `RestingBayWithPatrol`: the bay with the patrol in its slot. `/bay` mounts it.
  - `useClock()`: the time, read again every minute, so the slot follows the day rolling over.
- **`src/components/hub/patrolSlot.ts`** (new, pure): `patrolSlotState`, `patrolReport`, `patrolPaid`, `patrolUnreviewed`.
- **`src/components/hub/patrol.css`** (new): the slot line and the progress dots. Token variables only, nothing moves.
- **`Flashcards.tsx`**: optional props added. Nothing was renamed: `facts`, `title`, `retryMisses`, `progress="dots"`, `greet`, `onFinish`, `end`, plus `CardResult`.
- **`RestingBayScreen.tsx`**: `patrol` may also be a function given `{ state, log, emit }` (the bay's own cadet). A node still works.
- **`/dev/patrol`** (dev only): the three slot states, and this device's cadet with "now" shifted 0, 1, 3 or 8 days. The shift only changes which facts are chosen. Done-today and pay use the real clock.
- **Tests:** `tests/patrol.test.ts`.
  - The slot's three states from folded state.
  - One pay per day through the real fold with event times. That includes a second report the same day, a report with no answers, and the next day paying again.
  - The report never lists a fact that `patrol()` did not return.
  - The retry re-sends only lost answers.

New spoken lines: none. Nova says nothing on the patrol, so there is no `greet:patrol`.

## How I verified it
`bun run check` passed (306 tests). Muted origin `patrol.localhost:3331`, with cadets seeded through the API (battle misses then fixes, so facts were Learning).

What I SAW:
- **Nothing due.** On `/bay` for the new cadet, the slot was empty and there was one primary.
- **A whole patrol at 800x538** (the pane's own size), from `/dev/patrol` at 8 days:
  - 3 facts. A miss on 3 × 8 showed the 3 rows of 8 and "You said 20.", and a fourth dot was added. 3 × 8 came back at the end.
  - The end card read "Patrol done." and +15.
  - The server log had exactly one `patrol_completed`.
  - Enter mashing and then "Back to the bay" closed the sheet with no second event.
- **Done today.** At 1440x900, `/bay` after a refresh: "Patrol done. Come back tomorrow." and still one event. At 375x812 the line was 17 px, with no sideways scroll.
- **Phones.** At 360x640, the miss card had a 44 px close and the Next card button, with no overflow. At 812x375, the miss card fit (812 by 375, no overflow).
- **Closed mid-patrol.** A reload after one answer gave no `patrol_completed`, the slot still due, and the same orbs.
- **Failed save.** With every `/api/events` fetch failing, the end card showed the failure line and Try again. After restoring it, a double click on Try again gave +15, one `patrol_completed`, and the 5 lost answers re-sent once.
- **Console.** No errors on `/dev/patrol`.

What I INFER (not seen in the browser):
- The "due" slot on the real `/bay`. A fresh cadet's facts rest 8 hours, so I saw the due slot only on `/dev/patrol`. It is the same component in the same slot.
- Pay across real days. The day rolling over and "tomorrow pays again" are proven only in unit tests with event times. The dev shift does not move the pay day.
- The back button during the patrol leaves `/bay` with nothing posted, the same as a reload. I did not press it.

## Not done
- The local log appends `patrol_completed` at once, so if the save fails and the cadet leaves with "Back to the bay", the bay may say "Patrol done." and show +15 until a refresh. The server is never paid without the answers.
- The sheet's close button keeps its "Close flashcards" name on the patrol.
- The end card's title says "Patrol done." even while showing a failed save.
