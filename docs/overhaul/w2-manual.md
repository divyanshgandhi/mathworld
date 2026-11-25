# Track: manual (wave 2). Handoff

Branch `overhaul/w2-manual`. This track built the teaching layer as self-contained parts:
- the Field Manual;
- first-visit greetings;
- the guided first shot;
- ship sprites;
- the script for the first five minutes.

None of it is mounted on a real screen yet. The mounting steps below are for the integrator.

## What changed

All files are new and inside this track's ownership.

| File | What it is |
| --- | --- |
| `docs/teaching.md` | The first five minutes as a script: the budget, step by step, what is left for later, the hub greetings, and 14 places where today's flow breaks the budget, each with its owner |
| `src/teach/words.ts` | `words`, `sentences`, `readMs` (1.5 s plus 0.3 s a word), `MAX_WORDS = 12` |
| `src/teach/keys.ts` | `SEEN_KEY_RE`, `greetKey`, `manualKey`, `GUIDE_FIRST_SHOT` |
| `src/teach/seen.ts` | `useSeen(key, source?)`, `memorySource()`, `resetSeen()` |
| `src/teach/greetings.ts` | `GREETINGS`: one line per screen |
| `src/teach/manual.ts` | `MANUAL_PAGES` (six pages), `ManualTopic`, `pageOf` |
| `src/teach/scenes.ts` | The manual pictures as pure layout and timing (true arrays, volleys, misses, the flip) |
| `src/teach/guide.ts` | The guided first shot's state machine, `placeCaption`, `freeArea` |
| `src/teach/shipKinds.ts` | Ship sprite kinds and boxes, and `squadLook` (the battle's `squadStyle` without three.js) |
| `src/worlds/shipSprites.ts` | `shipSprite(kind, sizePx, opts)`: bakes a ship once from the battle's builders |
| `src/components/teach/` | `FieldManual`, `ManualPicture`, `Greeting`, `FirstShotGuide`, `ShipSprite`, `useShipSprite`, `useLoop`, `useReducedMotion` |
| `src/app/manual/` | The `/manual` route (`?topic=<page>`) |
| `src/app/dev/teach/` | The `/dev/teach` review route, and `/dev/teach/console` (the mock console) |
| `tests/teach.test.ts` | 21 tests: copy, word list, seen keys, true-array counts, the guide's steps, caption placement |

### The Field Manual

It is "How to play": six pages. Each page has one live picture made from the real ship art and one or two short lines at child size (19 to 23 px).

| Page (`topic`) | Lines | Picture |
| --- | --- | --- |
| `squads` | Ships fly in squads. Each row is one squad. | 3 squads of 4, each squad outlined in gold, one after another |
| `count` | Count them. Type the number. | 3 × 4. Each ship gets a gold tick as it is counted, the number on the rocket counts up to 12, and the drawn Fire button reads "Fire 12" |
| `fire` | Press Fire. One plasma ball for each ship. | 2 × 3. Fire is pressed, six balls fly, one to each ship, and each ship leaves an empty socket |
| `miss` | Too few and some get away. Too many and some fly past. / Just try again. | Two halves. Left: 4 into 2 × 3, and 2 ships get away. Right: 8 into 2 × 3, and 2 balls fly past |
| `help` | Stuck? Press Show Me How. / Power-Ups change the shape so it is easier to count. | 6 squads of 2. The Flip It! Power-Up turns gold and the same 12 ships turn into 2 squads of 6 |
| `orbs` | First-try answers earn orbs. Facts you know in a flash turn Gold. | "3 × 4 = 12" with a check, the orb count goes 4 to 5, then the fact's mark steps Learning, Got it, Gold |

How it behaves:
- **Paging.** Arrow keys work from anywhere in the sheet; the viewport and the dots also handle their own. Swipe works on touch, the dots are a tablist with 44 px targets, and there are Back and Next buttons. Next becomes Done on the last page.
- **Leaving.** Close is always in the header. Escape closes too.
- **Phone layout.** On a phone it is full screen, with the dots above Back and Next. From 440 px up they share one row, and from 640 px up it is a centred sheet.
- **Motion.** A picture moves only while its page is in view. Under reduced motion each shows one still frame that still carries the idea. For example, the fire page's still frame has each ball just under its ship.
- **Seen keys.** Each page the player lands on is recorded as `manual:<page>`, once.

Copy notes:
- The brief wrote "Show me how". I used "Show Me How", the glossary term and the console's label.
- I wrote "Power-Ups change the shape…" instead of "They change the shape…", so the sentence names what it is about.
- The `miss` and `help` pages keep the brief's exact three short sentences, laid out in two lines. Every sentence is 12 words or fewer.

### Greetings

`<Greeting screen>` is built on the kit's `NovaLine`. It shows one line, once ever per screen (`greet:<screen>`):
- it takes no pointer events and no focus;
- it leaves on the first tap, click or key, or after `readMs(line)`;
- it shows nothing while the seen state is loading, so a returning player is never greeted twice.

The lines are in `docs/teaching.md` (Part 3) and under "Lines to bake" below.

### The guided first shot

`<FirstShotGuide ui bus />` coaches the player's very first wave and is gone for good after the first shot resolves (`guide:first-shot`).

1. It rings the fleet: "Count the ships." This stays at least 2.4 s.
2. It points at the keypad: "Type how many."
3. On the first digit it points at Fire: "Now press Fire." If the digits are cleared, it goes back to step 2.
4. Fire hides it. When the shot resolves, it records the key.

What it does around those steps:
- If the player types during step 1, it skips straight to Fire.
- It steps aside during Show Me How, a card or an offer, and comes back at the keypad.

How it draws:
- A dim scrim (the void at 50%) with a rounded cut-out, a 1 px gold ring, a dashed hairline orbit, and one caption. No blur and no glow.
- The ring draws in once, over `--transition-duration-moment`. It is still under reduced motion.

How it finds and avoids things:
- It finds its anchors by `data-guide` and measures them with a ResizeObserver, a MutationObserver (anchors that mount late), resize and orientation events, and a short rAF follow after each step change (a console that slides in).
- The caption is placed beside the anchor by `placeCaption`. It stays on screen, never touches the anchor, and keeps clear of the question and the keypad.
- It takes no pointer events and no focus, so it can never block or cover a control.

How it finds the fleet:
1. `fleetRect()` if the arena provides it;
2. else a `[data-guide="fleet"]` element;
3. else `freeArea()`, the free part of the screen that the arena frames the fleet into. This is computed from the `question` and `keypad` anchors. It is approximate.

If an anchor is missing, the guide shows nothing at all.

### Ship sprites

`shipSprite(kind, sizePx, { tone, style, blaster })` bakes a ship from `src/worlds/space/ships.ts` in the space look, front on and a little from above, into a cached PNG data URL.
- The kinds are `rocket` (no flame), `invader` and `leader` in `ember` or `apricot`, `pod` (the ten pod; it awaits Saira for its "10" plate) and `ball`.
- The cache is keyed by kind, options, size and pixel ratio.
- The renderer is created for a batch and disposed with `forceContextLoss()` when the queue empties, so no WebGL context stays open.

`<ShipSprite kind size tone alt />` draws one as an `<img>`, with a same-size hairline placeholder while it bakes. `useShipSprite` gives the URL to SVG pictures. The pod's box is wide (`shipSpriteBox`); every other kind is square.

## APIs for other tracks

```ts
import { FieldManual, Greeting, FirstShotGuide, ShipSprite, useShipSprite, ManualPicture, useSeen, memorySource, type SeenSource } from "@/components/teach";
import { GREETINGS, MANUAL_PAGES, pageOf, readMs, words, GUIDE_FIRST_SHOT, greetKey, manualKey, type ManualTopic, type GreetScreen } from "@/teach";
import { shipSprite, shipSpriteBox, SHIP_KINDS, type ShipKind } from "@/worlds/shipSprites";
```

- `FieldManual({ open: boolean; onClose: () => void; topic?: ManualTopic | null; seen?: SeenSource })`. `ManualTopic` is one of `"squads" | "count" | "fire" | "miss" | "help" | "orbs"`.
- `Greeting({ screen: GreetScreen; seen?: SeenSource; enabled?: boolean = true; placement?: "float" | "inline" = "float"; className?; onDone? })`. `GreetScreen` is one of `"bay" | "map" | "hangar" | "academy" | "flashcards" | "battle"`.
  - `float` is fixed above the bottom edge, at z-30.
  - `inline` sits in the layout, and takes no space once it has gone.
- `FirstShotGuide({ ui: ArenaUi | null; bus: Bus | null; seen?: SeenSource; fleetRect?: () => DOMRect | null; root?: HTMLElement | null })`. It renders at z-15: above a console at z-10, below cards at z-20.
- `useSeen(key, source?) → { seen: boolean | null; mark(): void }`.
  - `source = { seen: state.seen, emit }` on a hub, from `useCadet()`.
  - Without a source, it reads `/api/events` once per page load and posts through the outbox. It posts nothing if there is no cadet on this device.
  - Marks are shared across the page at once.
- `shipSprite(kind, sizePx, opts?) → Promise<string>` and `<ShipSprite kind size tone? alt? />`. Use `alt=""` for ships inside a labelled picture.
- Routes:
  - `/manual?topic=<page>`. Close goes back if the player came from inside the game, and to `/bay` otherwise.
  - `/dev/teach` and `/dev/teach/console` (`?fleet=0` tests the fallback with no fleet anchor).

## Mounting steps (for the integrator)

Use the same `seen` source on a screen for every teaching part on it. On the hubs that is `const seen = state ? { seen: state.seen, emit } : undefined` from `useCadet()`. Everything works without it, but then it does one extra fetch.

### 1. Resting Bay: `src/components/RestingBayScreen.tsx` (front)

- **Help.**
  1. Replace the `help` Dialog ("How to play", the long text) with `<FieldManual open={help} onClose={() => setHelp(false)} topic="squads" seen={seen} />`.
  2. Keep `TopBar onHelp={() => setHelp(true)}`.
- **Greeting.** Mount `<Greeting screen="bay" seen={seen} />` once `state` is loaded, as the last child of the screen's root `div`. The seen key is `greet:bay`.
- **Nova's own line.** While `state.seen["greet:bay"]` is unset, its first words should not be "Welcome back". Request to front: say "Hi, {name}!" on a first visit.
- **Flashcards.** In `src/components/hub/Flashcards.tsx`, mount `<Greeting screen="flashcards" placement="inline" seen={seen} />` under the deck's counter. The key is `greet:flashcards`. Pass `seen` down from the bay.

### 2. Star map: `src/components/SolarMap.tsx` (places)

- Mount `<Greeting screen="map" seen={seen} />` at the end of the root. The key is `greet:map`.
- Help: `TopBar onHelp` opens `<FieldManual topic="squads" … />`.

### 3. Hangar: `src/components/HangarScreen.tsx` (economy)

- Mount `<Greeting screen="hangar" seen={seen} />`. The key is `greet:hangar`.
- Help: `<FieldManual topic="orbs" … />`.

### 4. Academy: `src/components/AcademyScreen.tsx` (places)

- Mount `<Greeting screen="academy" seen={seen} />`. The key is `greet:academy`.
- Help: `<FieldManual topic="help" … />`.

### 5. Battles: `src/components/WaveArena.tsx` (console), and the Cadet Bay battle in `src/components/IntroFilm.tsx` (film)

- **Guide.** Mount `<FirstShotGuide ui={ui} bus={arena?.bus ?? null} />` as a sibling after the console, inside the full-screen root.
  - Mount it in both places. A brand-new player meets their first wave in Cadet Bay at the end of `/intro`, which IntroFilm renders. WaveArena covers a player whose first shot happens elsewhere, such as a refresh, a `?dev` drill or a skipped film.
  - The seen key is `guide:first-shot`.
  - Leave `seen` unset: the guide reads the log itself.
  - Pass `fleetRect={arena.fleetRect}` once combat adds it.
- **Anchors.** The console must carry `data-guide="question" | "keypad" | "fire" | "help" | "powerups" | "orbs"`, exactly as in OVERHAUL.md.
  - `fire` must be the Fire button itself, inside or outside `keypad`.
  - `keypad` must be the digit grid.
- **Help.** The `data-guide="help"` button opens `<FieldManual topic="count" … />`. The pause menu's "How to play" button opens it too, and its paragraph text goes.
- **Greeting.** Do not mount `<Greeting screen="battle">` in Cadet Bay while the arena speaks its own intro line. Two captions would compete. Instead, combat swaps `nova_l0_intro` for the `greet:battle` line (see the requests below). Use `<Greeting screen="battle" enabled={!!ui?.wave} />` only on a battle with no intro line of its own.

### 6. Anywhere else

- A help link to the manual is `/manual?topic=<page>`, for example from the title or a 404.
- 2D pictures of ships: `<ShipSprite kind="invader" tone="ember" size={32} alt="" />`.

## How I verified it

`bun run check` is green on every commit: typegen, tsc, eslint and vitest, at 223 tests (202 before, plus 21 here).

What the tests prove:
- **Copy.** Every sentence the teaching layer shows is 12 words or fewer. Every word is on a reviewed list of plain words or is a glossary word. None of the retired words appear ("squadron", "load", "radar", "calibrate", "drone"…).
- **Seen keys.** Every seen key passes the real event schema.
- **True arrays.**
  - Every manual array is `a` rows of `b`, with unique places, and styled exactly like the battle's `squadStyle`.
  - A volley of n is n balls.
  - A miss leaves exactly the difference: 6 − 4 = 2 get away, and 8 − 6 = 2 fly past.
  - The flip maps 12 ships one to one into 2 × 6.
  - The count reaches the real total.
- **The guide.** Its full step sequence, the skip to Fire, stepping aside for Show Me How, caption placement on phone and desktop docks, and the free-area fallback.

What I saw in the browser, on `http://manual.localhost:3326`, muted:
- **`/dev/teach` at 1440 × 900.**
  - All six pictures render from baked ship art, and every row shows its pennant leader.
  - The sprite sheet shows every kind and tone at 32, 48 and 96 px.
  - The page does not scroll sideways at 375.
- **The manual as a sheet (desktop).**
  - It opens on page 1, with focus in the pages.
  - ArrowRight twice reached "Fire", mid-volley.
  - Escape closed it, and focus returned to the button that opened it.
- **`/manual?topic=miss` at 375 × 812, the phone preset with touch.**
  - It opens full screen on the miss page.
  - Every target measured 44 px or more (Close, six dots, Back and Next).
  - The lines render at 20.25 px.
  - A drag swiped it to the next page. Next went to the last page, where Next becomes Done. Done went to `/bay`, because the page was opened directly.
- **`/manual?topic=help` at 812 × 375 (landscape).** The picture and the words sit side by side, with nothing cut off. Close, Back, Next and the dots are all on screen.
- **Reduced motion,** simulated by overriding `matchMedia`. The fire page holds one still frame, with one ball under each of its six ships, and it does not change over time.
- **The guided first shot, on `/dev/teach/console`.**
  - At 375 × 812 the steps went in order: "Count the ships." (a ring round the fleet, the caption under it), then "Type how many." (the keypad ringed, the caption above the whole console), then "Now press Fire." after typing 1. After "2" and Enter the guide was gone and stayed gone.
  - At 1440 × 900 with a side dock, the keypad step shows the caption above the dock.
  - At 360 × 640 with `?fleet=0`, the fallback free area is ringed, then the keypad step follows.
- **A greeting at 375.** It floats inside the screen, takes no pointer events, and left on the first key press.
- **Console.** The only errors were the route fade's "Transition was aborted… Document hidden", which comes from the hidden pane and the kit's RouteFade, not from this track. One hydration warning in my own mock (it read `?fleet` during render) was fixed.

What I infer, not saw:
- The pane was hidden, so frames and timers ran slowly. Step timings were read from the DOM over time, not judged by eye.
- The real console's footprint will differ from the mock's, but the guide measures whatever carries the anchors.

## Not done or not verified

- **Nothing is mounted on a real screen.** That is by design: wave 3 mounts it.
- **No anchors exist yet.** The console's `data-guide` anchors are not in the current `BattleHud`, so the guide has nothing to point at in a real battle until the console track lands. The mock console carries them.
- **`fleetRect`** does not exist on the arena yet. Until it does, the guide uses `[data-guide="fleet"]` or the approximate free area.
- **Reading level.** The word list is a reviewed allowlist, not a graded word-frequency check. I read every line as an 8-year-old would. "Power-Ups", "plasma" and "orbs" are game words that the game itself teaches.
- **Untested inputs and states.** Reduced motion was simulated in the page, not set in the OS. A real touch swipe was simulated with a mouse drag, which ui-sdk treats as the same gesture. Phone landscape was checked on the manual only, not on the guide.
- **A caption can cover the question.** On a very short phone with no fleet anchor (360 × 640, `?fleet=0`), the "Count the ships." caption has no free room and sits over the question plate. That plate is a "soft" box, covered before any control is.
- **The "every picture is a true array" test** covers the five pictures that show ships. The sixth (orbs and Gold) shows a fact, a mark and an orb count, not a fleet.

## Requests for other tracks

- **combat:**
  - add `arena.fleetRect(): DOMRect | null`, the fleet's screen box in CSS px, and give it to the guide;
  - make the very first wave of a new player `1 × b` with b from 3 to 5, never an empty fleet (`src/director/next.ts`, tier 0);
  - replace `nova_l0_intro` with `nova_greet_battle`;
  - while `guide:first-shot` is unseen and the guide shows, do not queue Nova lines (`nova_zero_squads` and `nova_zero_each` on the first wave) and keep the fleet's idle motion at rest until the first digit;
  - rewrite the battle lines that use retired words (see "Lines to bake").
- **console:**
  - carry the six `data-guide` anchors;
  - drop the "N squads · N ships each" line from the first frame (decision 2);
  - help and the pause menu's "How to play" open `FieldManual`;
  - the pause menu's capture-phase Escape handler should leave Escape alone while a `FieldManual` is open, so Escape closes the manual and not the pause menu underneath. Check `document.querySelector('[data-slot="dialog-content"][data-open]')` other than its own.
- **film:**
  - shorten `captain_brief2` to one idea, and `nova_hi` without "calibrate" (see `docs/teaching.md`, items 1 to 3);
  - mount `FirstShotGuide` beside the Cadet Bay `BattleHud` in `IntroFilm.tsx`.
- **front:**
  - on the bay, a first-visit Nova line without "Welcome back";
  - mount the greeting and the manual as above;
  - the kit could take `ShipSprite` if other screens want it.
- **economy:** the Hangar's 13 px "Earn Orbs…" note should be child size and say "orbs". Flashcards should stop showing "+N orbs" (decision 5).
- **places:** shorten the Academy's 26-word intro; the greeting covers it.

## Lines to bake

New lines, captions first (decision 10). The ids follow `public/vo/vo.json`.

| id | text | where |
| --- | --- | --- |
| `nova_greet_bay` | This is your Resting Bay. Press Launch to fly. | first visit to the Resting Bay |
| `nova_greet_map` | Tap a planet. Win there to open the next one. | first visit to the Star map |
| `nova_greet_hangar` | Spend your orbs here to change how your rocket looks. | first visit to the Hangar |
| `nova_greet_academy` | Pick a trick. I will show it on real ships. | first visit to the Academy |
| `nova_greet_flashcards` | Type the answer. There is no timer, so take your time. | first flashcard deck |
| `nova_greet_battle` | Welcome to Cadet Bay! Let's clear these ships. | replaces `nova_l0_intro` |
| `nova_guide_count` | Count the ships. | guided first shot, step 1 |
| `nova_guide_type` | Type how many. | guided first shot, step 2 |
| `nova_guide_fire` | Now press Fire. | guided first shot, step 3 |

Suggested rewrites of existing lines, for combat and film to decide on. Each keeps its id:

| id | today | suggested |
| --- | --- | --- |
| `nova_err_under` | Too few! Load a few more. | Too few! Some got away. Try again. |
| `nova_err_over` | Too many! Load a few less. | Too many! Some flew past. Try again. |
| `nova_err_wild` | Way off! Radar is up. | Way off! Count the squads again. |
| `nova_incoming_short` | Squadrons incoming! | Ships incoming! |
| `nova_hi` | Hey! I am Nova, your co-pilot! Together we will calibrate every shot dead on. Ready for launch? | Hi! I am Nova, your co-pilot. Ready for launch? |
