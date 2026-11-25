# Economy track (wave 2): handoff

Branch `overhaul/w2-economy`. Files: `src/battle/rewards.ts`, `src/director/{fold,hangar,hub,telemetry}.ts`, `src/db/{events,store}.ts`, `src/app/api/events/route.ts`, `src/components/HangarScreen.tsx`, `src/components/admin/Dashboard.tsx`, `src/worlds/space/hangarBay.ts`, the new review route `src/app/dev/economy/`, and the tests `tests/{economy,fold,hub,telemetry}.test.ts`.

## What changed

### Orbs come from learning, not from the client (decision 4)
The fold works out every orb from the learning events, using one table, `ORB_RULES` in `src/battle/rewards.ts`. It never reads the amount in an `orb_earned` event. That event is still accepted and stored, but only as the client's claim, which `/admin` shows beside the real figure.

| Rule | Orbs | Notes |
| --- | --- | --- |
| A wave cleared on the first try | 5 | First shot, with no Show Me How before it. Power-Ups are fine. |
| A wave cleared on a later try | 3 | Only if Show Me How did not run on that wave. |
| A wave cleared after Show Me How | 0 | The cadet types the answer Nova showed. Without this rule, a masher earned about 3 orbs a wave in the simulation. |
| The Academy | 0 | |
| A practice replay of a fact that is already Gold | 1 | Paid for the first such replay of that fact each day. 100 replays in one day pay 1. Gold replays neither add to nor break the first-try run. |
| A fact reaching Gold for the first time | 10 | Once per fact, however it got there: battle, flashcard or patrol. A fact that turns Gold in the Academy is paid at its next clear outside the Academy. |
| Every fifth first-try answer in a row | 5 | |
| A planet cleared | 20 | Only when its mission really passed. A forged `planet_cleared` now changes nothing: no orbs and no progress. |
| The daily patrol | 15 | Once per day. Days only move forward. It pays only for facts answered on cards since the last patrol. |
| Flashcards and the Mercury and Venus warm-ups | 0 | Warm-ups are always open and never reach Gold, so paying for them could be farmed. |

- Orbs never go below zero. A purchase is charged the catalogue price only when the cadet can afford it and has opened the item. Buying an item already owned is a free re-equip, so a doubled event charges once.
- **No migration.** No learner has played, so old logs need none. In any log that predates this change, the client's amounts are now ignored and orbs are recomputed from the waves.
- **Time.** The "once a day" rules need event times. The client's `history()` keeps only `type` and `payload`, so `GET /api/events` now adds `payload.loggedAt` (the server's `createdAt`, in ms) to every event it returns. It is never stored, and a client cannot set it, because zod strips unknown keys on POST. `timeOf(e)` in the fold reads `e.at`, then `payload.loggedAt`.
- **The patrol's day** is the device's calendar day (`patrolDay(ms)`). `normalize()` on the server keeps it within one day of UTC. Because days only move forward, a false time zone can at most move one patrol earlier. It can never add one.

### The catalogue is a registry (`src/director/hangar.ts`)
`ITEMS: Item[]`, where `Item` is `{ id, slot, name, cost, blurb, unlock?: { cleared: PlanetId }, swatch }`. To add a look, add one entry here plus its style in `ships.ts`. To add a slot, add one entry to `SLOTS` and its id to `UPGRADE_SLOTS`. `CATALOG`, `SLOT_NAMES` and `STARTER` are derived from these and keep their old shapes.

Twin Plasma is **not sold.** In battle it draws two balls a shot (`cannon.ts` checks `blaster.twin`), so an answer of 7 shows 14 balls and the answer stops being the count. A test fails if any blaster on sale has `twin: true`.

### Prices from the earning rate
I measured earnings with the real fold and the real wave planner on the levelling simulation's five bots (100 seeds, 150 waves each). These are median orbs after n waves, excluding the patrol:

| Bot | 8 waves | 15 | 30 | 60 | 90 | 150 |
| --- | --- | --- | --- | --- | --- | --- |
| struggling 3rd grader | 33 | 57 | 113 | 233 | 347 | 581 |
| average 5th grader | 45 | 72 | 130 | 245 | 369 | 587 |
| trick learner | 65 | 138 | 247 | 388 | 497 | 748 |
| adult speedrunner | 45 | 90 | 219 | 510 | 804 | 1397 |
| random masher | 11 | 19 | 39 | 71 | 102 | 158 |

What I assumed (inferred, not measured with a child): session one is the film and then about 8 waves. Later sessions run about 15 waves in 10 minutes (about 40 s a wave, briefings and cards included), plus the 15-orb patrol from day 2 on. On that basis a typical child, between the two child bots, has about:
- 33–45 orbs after session one;
- 100–115 after session two;
- 175–190 after session three;
- 250–265 after session four;
- 395–415 after session six;
- 535–555 after session eight;
- about 700 after session ten.

| Look | Slot | Orbs | Opens with | Total spent if bought cheapest first | Affordable around |
| --- | --- | --- | --- | --- | --- |
| Solar Gold | Paint | 30 | | 30 | session 1 |
| Ion Arc | Blasters | 70 | | 100 | session 2 |
| Cyan Ion | Thrusters | 90 | | 190 | session 3 |
| Nebula Violet | Paint | 110 | Clear the Moon | 300 | session 4 |
| Starlight Comet | Thrusters | 140 | Clear Mars | 440 | session 6 |
| Obsidian Stealth | Paint | 170 | Clear Mars | 610 | session 8–9 |
| Nova Beam | Blasters | 210 | Clear the Asteroid Belt | 820 | session 11–12 |

The pace is one new look about every one to two sessions, with the top looks after about ten. The planet unlocks mean that a richer but stuck cadet always sees a goal that learning opens. A masher earns about 1 orb a wave, so the first look takes them about 30 waves. An adult speedrunner owns everything in about 5 to 6 sessions; that is fine, because looks are not power. `tests/economy.test.ts` ("the earning rate") checks the first item in session one and the masher's rate.

### Daily patrol logic (its screen comes in wave 3)
- `patrol(state, now)` returns up to five `PatrolFact`s (`{ a, b, key, band }`), or `null` when nothing is due.
  - Learning facts come first, then Got it facts not seen for 2 days, then Gold facts not seen for 7 days, oldest first within each group.
  - Only the listable planets count (Earth to Jupiter). A Deep Space sum is never met twice.
  - **Tuning:** Learning facts rest 8 hours first (`PATROL_REST`), so the patrol is tomorrow's job and not the tail of today's session. A brand-new cadet therefore has nothing due on day one.
- `patrolDone(state, day)`.
- The `patrol_completed` event is `{ day, facts: {a, b}[] (1 to 5) }`.

### The Hangar shop
`HangarScreen.tsx` is rebuilt on the kit, with the rocket preview in `hangarBay.ts`.
- **Layout.**
  - The TopBar has home, "Hangar", the orbs (they tick down after a purchase), help when `onHelp` is given, and sound.
  - Wide screens put the shop in a column on the right, on the void.
  - Tall screens put the rocket in the top 45% and the shop in a sheet below, with the button pinned.
  - The scene frames the rocket in whatever part of the screen the shop leaves free (`setFrame`).
- **Rows.** Each row has a swatch drawn from token colours, the name, one line, and its state in words: Equipped, Owned, a price beside the orb ring, or "Clear the Moon first" with a lock.
- **Trying on.** Tapping a row tries the look on the rocket at once. A blaster fires, a paint pops, a thruster flares.
- **The one action under the list:**
  - "Buy for 30 orbs";
  - "Equip";
  - a neutral "39 more orbs to go" with "A first-try answer earns 5 orbs.";
  - a neutral "Clear Mars first", with how to open it and its price;
  - "On your rocket now", with the next goal.
- **Buying.**
  - It asks once, in place: "Buy Solar Gold for 30 orbs?" with Not now and Buy. Focus starts on Not now.
  - Presses on Buy within 450 ms of the question appearing are ignored, so a double tap cannot buy. Held keys (`repeat`) are ignored too.
  - The purchase is saved before the screen says it is done. Anything already queued in the outbox goes first, then this event, then the screen waits for the server.
  - A failed save says "That did not save. Your orbs are safe." with Try again, and nothing changes.
  - On success the look is equipped, the orbs tick down, and the rocket celebrates (`celebrate()`).
- **A new cadet** sees the starter set equipped, "On your rocket now", "Next: Solar Gold for 30 orbs. A first-try answer earns 5 orbs." and a Star map button.

### Hub and admin
- **Hub.** `TEACHES` is now in a child's words ("Times 2, 5 and 10", "Big numbers times small ones, like 23 × 4"). `FLASHCARD_ORBS` is 0 and still exported.
- **`/admin`** has an Orbs column and an Orbs tab for each cadet. The tab shows the ledger newest first, totals by reason, earned, spent, and the client's claimed total marked "not counted". `describe()` covers `patrol_completed`.
- **`/dev/economy`** (dev only) shows this device's cadet's ledger, with the same component, and their patrol status.

## APIs for other tracks
- **`@/battle/rewards`:**
  - `ORB_RULES` (`wave_clear` keeps `firstTry`, `later` and `academy`, and adds `afterShowMeHow`; new keys are `gold_replay`, `new_gold`, `streak`, `patrol`, `flashcard` and `warmup`);
  - `ORB_WORDS`, `OrbRule`, `payWave(w)`, `dayNumber(ms)`;
  - `waveClearOrbs` and `planetClearOrbs` are unchanged.
- **`@/director/fold`:**
  - `orbLedger(events): OrbEntry[]`, where `OrbEntry = { at?, amount, reason, rule, fact?, event }` (spending is negative, for example "Bought Solar Gold");
  - `orbsBetween(before, after)`, which takes logs or folded states and returns `{ entries, earned, net }`;
  - `timeOf(e)`;
  - `PlayerState` gains `ledger`, `firstTryStreak`, `goldEver`, `lastSeen` and `patrol: { lastDay, done }`.
- **`@/director/hangar`:**
  - `ITEMS`, `SLOTS`, `Item`, `Swatch`;
  - `isUnlocked`, `lockedWords`, `itemState(state, item)`, `nextGoal(state)`, `PLANET_IN_A_SENTENCE`;
  - `CATALOG`, `SLOT_NAMES`, `STARTER`, `itemOf`, `priceFor` and `purchase` keep their signatures. `purchase` now also refuses a locked item.
- **`@/director/hub`:** `patrol(state, now)`, `patrolDone(state, day)`, `PATROL_REST`, `PatrolFact`, `TEACHES`, `FLASHCARD_ORBS` (0).
- **`@/db/events`:**
  - the `patrol_completed` event, `PATROL_SIZE` (5) and `patrolDay(ms, tzOffsetMin?)`;
  - `WAVE_ROLES` gains `"academy"`;
  - `normalize(e, now?)`.
- **Components and scenes:**
  - `HangarScreen({ onHelp? })`.
  - `mountHangarBay(...)` gains `setFrame(rect | null)` and `celebrate()`.

## Mounting steps for the integrator
1. **Help in the Hangar:** in `src/app/hangar/page.tsx`, pass `onHelp` to `<HangarScreen onHelp={…} />` once the Field Manual exists. The page is a server component, so wrap it in a small client component if the handler is client-side.
2. **The daily patrol screen (wave 3):**
   - Show it when `patrol(state, Date.now())` is not null and `patrolDone(state, patrolDay(Date.now()))` is false.
   - Record each answer as a `flashcard_answered` event.
   - At the end, emit `{ type: "patrol_completed", payload: { day: patrolDay(Date.now()), facts } }` listing the facts answered right.
   - The fold pays 15. Show it with `orbsBetween(logBefore, logAfter)`.
3. Nothing else needs wiring: the fold, `/api/events` and `/admin` are live.

## How I verified it
- **`bun run check`** is green: 222 tests. 20 of them are new in `tests/economy.test.ts`; the fold, hub and telemetry tests were updated, and the levelling proof still passes. The tests prove:
  - orbs never go negative over 40 random runs of 120 events (forged purchases, forged orb events, forged clears), and the ledger always sums to the orbs;
  - a forged `orb_earned` of 9999 changes nothing;
  - replaying one Gold fact 100 times in a day earns 1 orb, and 100 times over 100 days earns 100;
  - the first-Gold, streak, Academy, Show Me How, planet-clear and patrol rules each hold;
  - the day clamp works;
  - every item on sale is a real ship style;
  - locked items cannot be bought, even with a forged event;
  - a doubled purchase event charges once.
- **In the browser** at `http://economy.localhost:3325` (muted), as a brand-new cadet. What I saw:
  - **Ten waves.** Over ten waves on `/play/earth` and `/play/moon` (driven through `arena.fire` on a paused, stepped stage; Earth was the real Cadet Bay tutorial, with one Gold probe and one miss on each planet), the ledger read 91 orbs: 8 first tries (40), 2 later tries (6), 2 planet clears (40) and one five-in-a-row (5). The Hangar's top bar showed 91 and `/dev/economy` showed the same 91, line by line. The battle's own counter showed 86, because it does not know the streak bonus (see Requests).
  - **Forged POSTs.**
    - `orb_earned` 9999: no change.
    - `planet_cleared` for Mars: no unlock and no orbs.
    - `patrol_completed`: no orbs.
    - `upgrade_purchased` for Nova Beam at cost 0: not equipped.
    - All of these were stored and all were ignored.
  - **Buying.** A double click on "Buy for 30 orbs" opened the question and bought nothing. One press, then Buy, bought Solar Gold: 91 went to 61, the row read Equipped, and the rocket celebrated. After a refresh: 61 orbs, Solar Gold equipped, and one purchase event.
  - **Not enough orbs.** Nebula Violet at 61 orbs showed "49 more orbs to go" (it was 39 before the prices changed) with no buy button.
  - **Failed save.** With POST blocked: "That did not save. Your orbs are safe." with Try again. After unblocking, Try again equipped the look.
  - **Sizes:** 1440×900, 375×812, 360×640, 812×375 (landscape) and 768×1024. No sideways scroll at 375 or 360.
  - **Console.** The only console error is the root `RouteFade`'s "Transition was aborted because of invalid state. Document hidden", which comes from the hidden pane.
  - **Design detector.** The Impeccable detector found nothing in the changed UI files.
- **Caveat about the hidden pane.** While the pane is hidden, React commits wait for a frame, so the Hangar can sit on "Opening the Hangar…" until something paints. A screenshot unsticks it. I believe this is the hidden pane, not the screen, but I did not prove it with the pane in front.

## Not done or not verified
- **`/admin` with the passphrase.** I did not open it, because the key lives in a local env file I may not read. The Orbs tab uses the same `OrbLedger` component I verified on `/dev/economy`, the page compiles and type-checks, and `/admin` still renders its locked view.
- **The Academy still pays like practice.** The arena writes Academy shots with `waveRole: "practice"`, so the fold cannot tell them apart; see Requests. Until that changes, an Academy clear pays 5 or 3, or 1 for a Gold fact once a day.
- **`hyper_jump_taken` is still believed without its offer.** The fold checks only `from === tier` and `to > from`, so a forged jump moves progress and opens the planet-unlocked looks. It mints no orbs. Gating it needs the fold fixtures in `fold.test.ts` that use forged jumps rewritten to earn them.
- **No patrol income until wave 3.** The patrol has no screen yet.
- **Tested in the shop only by click:** Escape on the question, and a held Enter. Both are coded (Escape closes the question; repeats are ignored) but I did not exercise them in the browser.
- **The ten waves were driven through `arena.fire`, not the keypad.** The console UI was not in the loop.
- **The session lengths in the pricing maths are assumptions** (about 15 waves in 10 minutes). No child has played.

## Requests for other tracks
- **combat** (`src/worlds/space/arena.ts`, `src/battle/persistence.ts`):
  - In the Academy, write `waveRole: "academy"` instead of `"practice"`.
  - Show orbs from the fold, not from `waveClearOrbs`. Set `ui.orbs` from `fold(log).orbs`. Build the wave and planet reward from `orbsBetween(logBeforeTheShot, log)` so the streak, first-Gold and Gold-replay lines show (today the battle said 86 where the ledger said 91).
  - The `orb_earned` writes can stay or go; the fold ignores them.
- **combat / ships** (`ships.ts`, `cannon.ts`): make `twin-plasma` one visible ball per shot (for example, one ball with two cores). Then add it back to `ITEMS` in `hangar.ts` at about 60 orbs (economy will do it).
- **console:**
  - The reward and clear cards should list `orbsBetween(...).entries` in their plain words ("First try +5", "New Gold fact +10").
  - `WarmupDrill.tsx` still emits `orb_earned` 1 per first-try warm-up; it pays nothing now, so drop it and any "+1".
- **front** (`src/components/hub/Flashcards.tsx`): `FLASHCARD_ORBS` is 0, so the line "+{right * FLASHCARD_ORBS} orbs" reads "+0 orbs". Remove that part, and the `orb_earned` emit.
- **places** (`SolarMap`): `TEACHES` is now longer and plain ("Big numbers times small ones, like 23 × 4"). Please check that it fits.
- **front** (`RouteFade`): the "Transition was aborted … Document hidden" console error appears on every route change while the tab is hidden.

## Lines to bake
None. The shop and the economy add no spoken lines.
