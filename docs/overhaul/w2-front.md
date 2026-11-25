# Track: front (wave 2). Handoff

Branch `overhaul/w2-front`. The title with sign-up built in, the Resting Bay to the prototype, flashcards as a calm sheet, the kit finished for wave 2 screens, and the app shell. `bun run check` is green (213 tests).

## What changed

- **Title (`/`)** (`TitleScreen.tsx`, `hub/title.css`, `worlds/space/title.ts`).
  - The words block is the whole interface and changes in place, never as a card over the planets:
    - a new player sees the line and Start game, which turns the block into the sign-up;
    - a returning player sees "Welcome back, Cadet <name>", Continue (to `/bay`, or to `/intro` if the film was never finished) and a quiet "Not <name>? Switch cadet";
    - Switch cadet asks first: "Start as a new cadet? This device will forget <name>. <name>'s orbs and Gold facts cannot be brought back." with Keep playing (primary) and New cadet. Escape goes back.
  - `/?new` opens the sign-up directly when there is no cadet (the bay's Switch cadet lands there).
  - Layout: "side" (words left, system right) from 1100 px wide and on short landscape screens (`(min-width: 1100px), (min-width: 640px) and (min-aspect-ratio: 16/10)`); "stack" (system above the words) otherwise. 821 to 1099 px now stacks instead of shrinking the system.
  - Framing: `frameAround(box, layout)` fits the whole system into the free region, solved in screen space, so no orbit leaves the frame at 1024 to 1920 (the old fit only cleared the words, so the outer orbit ran off the right edge at 1440). A change of the words' box eases the frame over; a resize snaps it. With no room worth drawing in (the sign-up on a 360x640 phone) the system rises out of the frame instead of sitting behind the words.
  - The words still arrive within 0.7 s if the fly-in has not settled.
- **Sign-up** (`hub/CadetSignUp.tsx`, `hub/cadetName.ts`). One question, a name of 1 to 16 letters, numbers and spaces (any alphabet), six named 44 px swatches, Begin.
  - Empty name: "Type your name first." on Begin. Symbols or emoji: "Use letters, numbers and spaces only." at once. A 40-character paste is cut to 16 with "Names can be up to 16 letters, so we kept the first 16."
  - Enter submits; a second submit while saving does nothing (one POST); a failed save keeps everything and says "That did not save. Check the connection and press Begin again."
- **Resting Bay** (`RestingBayScreen.tsx`, `hub/hub.css`).
  - The hero is the next mission's planet, named by the planet (`BODY_NAME`: "Earth", "The Moon"). Status: "Your first mission. Win both waves to unlock the Moon." on Earth, "Your next mission. Win 3 of 4 waves to unlock Mars." elsewhere, "Mission won. Launch to fly on to Mars." when the mission is won, and a line for Deep Space and for everything cleared. Never "2 of 2".
  - WaveDots, Launch (the one primary), and a slot under the mission for the daily patrol (`patrol` prop, `data-slot="daily-patrol"`).
  - The planet is a factory sprite inset inside a dashed orbit split into a far and a near half; the rocket passes behind and in front. It is the screen's one moving thing; it rests under reduced motion.
  - Nova's line, in this order: first arrival ("Welcome to the Resting Bay, Kit! This is home between missions. Launch when you are ready.", recorded once as `seen` key `greet:bay`), a planet just cleared, a Hyper-Jump just taken, everything cleared, a mission won, a table nearly Gold (6 to 9 Gold: "Your 7s are nearly Gold."), else "Welcome back, Kit! Ready for the Moon?".
  - Times tables x1 to x10 with 8 px pips; a tile opens in place to its ten facts, the four-word key, a plain count and "Practise the 7s" (flashcards on that table). Escape closes it; it scrolls into view.
  - Places: Star map, Hangar, Academy. The Tricks pill is gone.
  - TopBar with the screen name, orbs, help and sound. `onHelp` prop; without it, help opens a short How to play sheet.
  - Switch cadet asks first in a sheet (bottom sheet on phones), then forgets the cookie and goes to `/?new`.
  - Loading is the kit's orbit on the void, not a black frame.
- **Flashcards** (`hub/Flashcards.tsx`, `hub/deck.ts`). A full-screen sheet on the ui-sdk Dialog: one big fact with the typed number in its answer slot, the kit Keypad (Check), no timer, no orbs (the per-card `orb_earned` is gone, decision 5).
  - Right: the answer turns gold, "Right", next card after 0.9 s.
  - Not right: "3 × 5 = 15", 3 rows of 5 dots (a small gap after every fifth dot), "3 rows of 5 make 15. You said 9.", and Next card, which wakes after 1.2 s so a mashed Enter cannot skip the picture.
  - End: "4 of 5 right", the five facts with their answers, Done.
  - `table` prop: five facts of that table, furthest from Gold first (`deckFor`). Without it, the director's mixed deck.
  - Every card still appends `flashcard_answered`.
- **Kit** (`src/components/kit`). Additions only; nothing renamed or removed.
  - `Keypad`, `SheetDialog`, `SheetClose`, `scrimClass`, `dialogClass`, `EmptyState`, `Loading`, `PlanetStatusMark`, `PLANET_STATUS`, `PlanetStatus`.
  - `Pips` default size is 8.
  - `TopBar`: under 600 px the name is 13 px with tighter tracking and may take two balanced lines inside 64 px; no ellipsis. It pads with the safe-area insets.
  - The `orb` icon is now a gold ring with a highlight arc, not a bullseye (decision 8), so orbs and Gold mastery never share a shape. This changes every screen that shows orbs.
  - `tokens.ts`: `CADET_NAME` (the spoken colour names).
  - `/kit` shows every addition; the legacy section now describes the old strings instead of using them.
- **App shell** (`src/app`). `error.tsx` and `global-error.tsx` ("Something went wrong", "Your progress is safe", Try again, Resting Bay); `loading.tsx` (the orbit, fixed on the void); `not-found.tsx` ("Nothing out here", Resting Bay); `icon.tsx`, `apple-icon.tsx` and `manifest.ts` (the ring logo from tokens); `layout.tsx` viewport and web-app metadata; `globals.css` touch-action manipulation, no overscroll, `100dvh`, gold caret, themed scrollbars.
- **Docs.** `DESIGN.md` (new components, the Title, Bay and Flashcards rules, the app shell), `docs/glossary.md` (decisions 7 and 8; Mission, Flashcards, Daily patrol, Switch cadet, Launch).
- **Review route.** `/dev/front` triggers a real render error, shows the loading state and links to a missing page.

## APIs for other tracks

```ts
import {
  Keypad,                       // <Keypad value onValueChange onSubmit submitLabel="Go" disabled maxLength=6 keyboard label />
  SheetDialog, SheetClose,      // <SheetDialog open onOpenChange title description? actions? presentation="dialog"|"sheet"|"auto" size="sm"|"md"|"lg" dismissible close />
  scrimClass, dialogClass,      // for your own DialogBackdrop / DialogContent
  EmptyState, Loading,          // <EmptyState icon title action size="inline"|"page">words</EmptyState>, <Loading label />
  PlanetStatusMark, PLANET_STATUS, type PlanetStatus, // "cleared" | "now" | "open" | "locked"
} from "@/components/kit";
import { CadetSignUp, type Cadet } from "@/components/hub/CadetSignUp"; // <CadetSignUp onDone onBack? cta="Begin" />
import { checkName, limitName, NAME_MAX } from "@/components/hub/cadetName";
import { Flashcards } from "@/components/hub/Flashcards";             // <Flashcards state emit onClose table? />
import { deckFor } from "@/components/hub/deck";                       // deckFor(state, rng, table?)
import { RestingBayScreen } from "@/components/RestingBayScreen";      // <RestingBayScreen onHelp? patrol? />
import { CADET_NAME } from "@/design/tokens";
// title scene: frameAround(box, layout?: "side" | "stack")  (the second argument is new and optional)
```

- `Keypad` has no readout: show the number where the eyes are and pass it back as `value`. It ignores the keyboard while focus is in a text field or another modal is open, and never repeats a held digit or Enter.
- `SheetDialog` is opaque (panel fill) on a plain scrim. `presentation="auto"` becomes a bottom sheet on small touch screens.

## Mounting steps for the integrator

1. **Switch the other `CadetSignUp` callers** from `battle/ui` to `@/components/hub/CadetSignUp` (same `onDone`, same `cta`). It has no card of its own: where it used to float (`absolute inset-0 m-auto`), wrap it in `<Sheet className="p-6 md:p-8">` or place it in the screen's own layout.
2. **Field Manual:** in `src/app/bay/page.tsx`, render `<RestingBayScreen onHelp={() => openManual("bay")} />` with the manual track's opener. Until then the bay's help opens its own How to play sheet.
3. **Daily patrol (wave 3):** pass `<RestingBayScreen patrol={<DailyPatrol … />} />`: one line and one secondary action. Do not add a second primary.
4. **Greeting key:** the bay records `seen` key `greet:bay` the first time Nova's first-arrival line shows. If the manual track builds a bay greeting, it should be this line (or read the same key) so the cadet is not greeted twice.
5. **`viewportFit: "cover"`:** leave it off until the battle console, the film, the Star map, the Hangar and the Academy pad with `env(safe-area-inset-*)`; then add it to `viewport` in `layout.tsx`.
6. **Old favicon:** `src/app/favicon.ico` is the framework's default and is still emitted beside the new ring-logo `icon`. Delete it at merge so browsers only see the ring logo.

## How I verified it

All on my origin, muted. Screenshots taken after finishing animations and stepping the stage.

- **Title** at 1440x900, 1920x1080, 1024x768, 768x1024, 375x812, 360x640 and 812x375:
  - seen: the whole system inside the frame at every size (measured the free region and zoomed on the right edge at 1440 and 1920);
  - seen: stack layout at 1024x768, 768x1024 and the phones; side layout at 812x375, 1440 and 1920;
  - seen: the sign-up in place at 1440, 812x375, 375x812 and 360x640, with the wordmark stepping aside and the system rising out at 360x640;
  - seen: welcome back, Continue, the switch question, Escape back to welcome, and New cadet leading to the sign-up;
  - seen: a 16-character name wraps on the switch link at 375 with no horizontal scroll.
- **Sign-up**, seen in the browser: Enter on an empty name ("Type your name first."), an emoji ("Use letters, numbers and spaces only."), a 40-character paste (cut to 16 with the note), three `requestSubmit()` calls in a row (one POST, then `/intro`), a failed save (fetch rejected: the message shows, the name stays, busy clears).
- **Resting Bay** at 1440x900, 768x1024, 375x667, 375x812, 360x640 and 812x375, in all four states, seeded by posting events for my own cadet to `/api/events`:
  - brand new (all New, Earth, "Your first mission. Win both waves to unlock the Moon.", the first-arrival line);
  - a planet just cleared (the Moon, "You cleared Earth, Kit! The Moon is next.");
  - mid-way (1 of 4 waves won, 12 orbs, "Your 7s are nearly Gold.");
  - everything cleared (Deep Space, "Every planet is clear, Kit.").
  - Launch's bottom edge: 524 px at 375x667, 520 px at 360x640, 268 px at 812x375. No horizontal scroll at 360.
  - Opened the 7s, practised them, and the Switch cadet sheet (centred at 1440, a bottom sheet at 375).
- **Flashcards** at 1440x900 and 375x812: a right answer, a wrong answer (array, then Next card), a double Enter on a miss (it held), a full run to "4 of 5 right" and Done.
- **App shell:** `/nowhere-at-all` (404 page), `/dev/front` (a real render error, then Try again restored the screen), the icon (64 px) and apple icon (180 px) PNGs, the manifest, the viewport and theme-colour meta.
- **Console:** no errors on fresh loads of `/` and `/bay` and no failed resources. The errors in the log were mine and expected: a stale CSS import during a hot reload, the deliberate break on `/dev/front`, the 404 page's own resource, and one hydration mismatch from a hot reload.
- `bun run check` green before every commit. The Impeccable detector reports nothing on the changed files.

## Not done or not verified

- **Reduced motion** is coded (the fly-in, the reveal, the bay rocket, the loading orbit, the route fade) but I could not switch the preference in the browser pane, so it is unseen.
- **Real touch, a notched phone and a real on-screen keyboard** are unseen: I used the pane's device emulation only.
- **`viewport-fit=cover`** is not switched on (see mounting step 5), so the insets are 0 today and phones letterbox safely.
- **The route fade:** I did not change it; its reduced-motion rule was already there.
- **The title's slow-device path:** the 0.7 s fallback is unchanged and was not timed on a throttled CPU.
- **Planet sprite framing:** the bay insets the sprite by 14% because factory sprites currently fill their frame. If the places track changes sprite framing, `.mw-bay-sprite` needs the same change.
- **Flashcard mastery:** I did not check how fast a flashcard answer must be to move a fact; that is the fold's rule.
- I did not run `next build`.

## Requests for other tracks

- **Integrator:** steps 1 to 6 above. Also add this note to the wave 2 index in `docs/overhaul/README.md` (I do not own it).
- **Manual:** use `greet:bay` for the bay greeting, or tell me to drop mine. Wire `onHelp`.
- **Economy:** the daily patrol goes into `RestingBayScreen`'s `patrol` slot. `FLASHCARD_ORBS` in `director/hub.ts` is now unused by the front (decision 5); remove or keep as you see fit.
- **Places:** if sprite framing changes, tell the integrator (see above). `PlanetStatusMark` is there for the Star map if it helps.
- **Console:** `Keypad` from the kit is ready for warm-ups (`WarmupDrill.tsx`) if you want it there; the battle keeps its own cockpit.
- **Film:** none.

## Lines to bake

Nova's bay lines. They are captions today; the bay plays no voice yet. `{name}` and the planet are live words, so these suit live speech, or a baked clip per planet with the name spoken live.

| id | text |
| --- | --- |
| `bay.first` | Welcome to the Resting Bay, {name}! This is home between missions. Launch when you are ready. |
| `bay.cleared` | You cleared {planet}, {name}! {next planet} is next. |
| `bay.jumped` | You jumped all the way to {planet}, {name}! Same rules out here. |
| `bay.all-clear` | Every planet is clear, {name}. Keep your facts Gold with flashcards. |
| `bay.mission-won` | Great flying, {name}! Launch to see what is next. |
| `bay.nearly-gold` | Welcome back, {name}! Your {n}s are nearly Gold. |
| `bay.back` | Welcome back, {name}! Ready for {planet}? |
