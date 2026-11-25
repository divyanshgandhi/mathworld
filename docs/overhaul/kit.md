# Track: kit (wave 1). Handoff

Branch `overhaul/w1-kit`. Status: the design system is built, every older screen has been restyled into it, and `bun run check` is green. `DESIGN.md` is the system reference and `/kit` is the live showcase.

## What changed

- **Tokens as CSS and Tailwind.**
  - `src/design/tokens.ts` gained additions only (nothing was renamed or removed): `FONT`, `FILL`, `SIZE`, `CADET` and `CSS_VARS`.
  - `src/app/globals.css` declares every value as a CSS variable in `@theme static`, so the Tailwind utilities and the raw variables both exist.
  - `tests/design-tokens.test.ts` fails on any drift between the two files, on an unknown design variable, on a raw colour in `kit.css`, or on a text colour under 4.5:1.
- **Type.**
  - Geist and Geist Mono are gone. The body is Saira.
  - `font-mono` resolves to Saira (label width, equal-width digits), so older monospace text changed at once.
  - `font-code` is a real monospace for `/admin` only.
  - The voices are utility classes: `type-display`, `type-label`, `type-label-sm`, `type-body`, `type-body-sm`, `type-child`, `type-name` and `type-number`.
  - `text-xs` is raised to 13 px, the label minimum.
- **The kit.**
  - Components live in `src/components/kit/`; their styles are in `kit.css`, imported once in `layout.tsx`.
  - Controls are ui-sdk parts and every one is named.
- **Compatibility.**
  - `battle/ui.tsx` keeps every export: `btn`, `ghost`, `lime`, `glass`, `backdrop`, `dialogBox`, `Keypad`, `CadetSignUp` and `Cadet`. They now draw in Void and Gold.
  - New exports: `quiet`, `primary` (the same as `lime`) and `padKey`.
  - The `CadetSignUp` default label is now "Start". It strips a leading glyph from any `cta` a caller passes ("▶ Begin" shows as "Begin" with the rocket glyph). Its colours come from `CADET` in tokens, and none is the invaders' green.
- **Restyle-only sweep.** Class names and kit icons only, with no behaviour, prop or structure changes. The sweep covered:
  - `RestingBayScreen`, `SolarMap`, `HangarScreen`, `AcademyScreen`, `WarmupDrill`, `WaveArena`;
  - `hub/Flashcards`;
  - `battle/BattleHud`, `battle/PauseMenu`, `battle/XRay`;
  - `admin/AdminLogin`, `admin/Dashboard`, `app/admin/page.tsx`, `app/not-found.tsx`.

  What it removed:
  - emoji icons;
  - monospace;
  - lime;
  - glass blur;
  - text under 13 px.

  Two copy changes came with it:
  - uppercase strings became sentence case, and the CSS draws the capitals where the label voice wants them;
  - a few dashes inside debug text became words.
- **Debug readout.** The battle's "shots (s) / lessons (s)" text shows only while the Shift+D X-Ray is open (a CSS `:has()` on the open drawer), placed beside the drawer.
- **SoundToggle.**
  - `SoundButton` is the kit icon button.
  - The floating `SoundToggle` hides while any `TopBar` is mounted.
  - The M key works either way.
- **RouteFade.** It is mounted in the root layout. Each route change dips to void and back in 240 ms through React `<ViewTransition>`, keyed by pathname. Updates inside one route do not animate.
- **`/kit`.** It shows every component in every state. Hover, focus and pressed are pinned with `data-force` so they sit side by side. It also measures the contrast ratios live.
- **Docs.** `DESIGN.md` (the system as built) and `docs/glossary.md` (18 canonical terms and the words they retire).

## APIs for other tracks

```ts
import {
  Button, IconButton, PillLink, HomeLink, buttonClass,   // client
  Sheet, sheetClass, Icon, RocketGlyph, ICON_NAMES,
  MasteryMark, Pips, MasteryKeyLegend, masterySummary, WaveDots,
  Wordmark, RingLogo, NovaLine, NovaPortrait,
  TopBar, OrbCount, RouteFade, topBars,
  type IconName, type ButtonVariant, type ButtonSize, type KitButtonProps,
} from "@/components/kit";
import { SoundButton, SoundToggle } from "@/components/SoundToggle";
import { contrast, over } from "@/design/contrast";
import { CSS_VARS, FONT, FILL, SIZE, CADET } from "@/design/tokens"; // additions
```

- `Button({ variant?: "primary"|"secondary"|"quiet"|"icon" = "secondary", size?: "sm"|"md"|"lg" = "md", glyph?: boolean, icon?: IconName, ...ui-sdk ButtonProps })`
- `IconButton({ icon: IconName, label: string, ...ButtonProps })`
- `PillLink({ href: string, variant?, size?, icon?, glyph?, disabled?, ... })` and `HomeLink({ href = "/bay", label = "Resting Bay" })`
- `buttonClass(variant = "secondary", size = "md", glyph = false): string`, for `DialogClose`, `DialogTrigger` and `TabsTab`.
- `Sheet({ as?: "div"|"section"|"aside"|"form", className, ...html })`. Also `sheetClass = "mw-sheet"`, and `mw-tile` for a hairline tile.
- `Icon({ name: IconName, size = 20, label?: string, ...svg })` and `RocketGlyph({ size = 44 })`
- `MasteryMark({ level: MasteryKey, size = 8, label = false })`, `Pips({ marks: MasteryKey[], columns = 5, size = 7, label? })`, `WaveDots({ total, won, current = false, words = true })`
- `Wordmark({ size: "sm"|"lg" })`, `NovaLine({ speaker = "Nova", portrait?, children, size: "child"|"body", live = false })`
- `TopBar({ title?, left?: ReactNode, orbs?: number|null, onHelp?: () => void, helpLabel?, right? })` and `OrbCount({ n })`
- CSS:
  - type: `type-display` `type-label` `type-label-sm` `type-body` `type-body-sm` `type-child` `type-name` `type-number` `font-code`;
  - colours: `bg-void` `text-ink-1..3` `border-line-1..3` `bg-lift` `bg-raised` `bg-sheet` `bg-scrim` `text-gold` `text-sky` `text-ember`;
  - shapes and motion: `rounded-panel` `rounded-chip` `rounded-pill` `ease-out` `duration-quick|route|moment`;
  - raw variables: `var(--edge-rest)` and `var(--edge-hot)`.
- Canvas text: the family is `"Saira"` (`FONT.sans`). Await `document.fonts.load('400 16px Saira')` before drawing.

## How I verified it

- `bun run check` passed before every commit: typegen, tsc, eslint, and vitest at 163 tests. The design tests are part of that run.
- I played on my origin, muted, at 1440x900 and at the phone preset (375x812). Seen in the browser:
  - **`/kit`:** checked every section. There is no horizontal overflow at phone width (scroll width 375), the four top bars have no overlapping children, the dialog sheet opens and closes, and the console shows no errors.
  - **Title and sign-up:** typed a name, picked a colour and submitted. It routed to `/intro`, and I caught the route fade mid-dip.
  - **Resting Bay:** checked at desktop and phone. This found and fixed the desk buttons overlapping and the phone top row overlapping.
  - **Star map:** checked at desktop and phone. This found and fixed the planet name truncating and the arrows overlapping the sheet.
  - **Hangar:** checked at desktop and phone. This found and fixed tab names wrapping inside pills.
  - **Academy:** checked at desktop.
  - **Battle** (`/play/moon?dev&a=7&b=8`):
    - firing from the keyboard and the keypad;
    - a right answer earned orbs and moved on;
    - an under-shot showed the ember chip ("5 still flying");
    - the debug text is hidden until Shift+D;
    - the X-Ray restyle;
    - the pause menu (Escape);
    - phone layout: fixed the plate overlapping the corner buttons.
  - **Mercury warm-up** start card.
  - **404 page.**
  - The only console error seen was the 404's own resource error, which is expected.
- Contrast is measured by the test on void, panel, a sheet over void and lift. The ratios on void:

  | Colour | Ratio |
  | --- | --- |
  | ink-1 | 17.6 |
  | ink-2 | 10.7 |
  | ink-3 | 5.6 |
  | sky | 9.5 |
  | gold | 13.1 |
  | ember | 7.1 |
  | recede | 5.7 |
  | disk | 4.5 (marks and large display only) |

## Design debt left (report from `tests/design-debt.test.ts`)

| Metric | Before | Now | Where it is now |
| --- | --- | --- | --- |
| Raw hex colours | 56 | 5 | `IntroFilm` 4, `TitleScreen` 1 |
| `font-mono` | 67 | 4 | `IntroFilm` 2, `TitleScreen` 2 |
| Lime accents | 76 | 8 | `IntroFilm` 3, `TitleScreen` 5 |
| Blur | 4 | 0 | |
| Text under 13 px | 34 | 0 | |
| Glyph characters | 58 | 18 | see below |

Most of the 18 glyph characters left are not rendered. They are the internal key id `⌫` in the keypads and the `→` in admin text. The rendered ones are in `IntroFilm` and `TitleScreen`.

## Not done or not verified

- I did not adopt `TopBar` on existing screens, because that changes layout structure. The screens keep their own corner chrome, now restyled. Wave 2 screens should mount `TopBar`.
- I did not touch `IntroFilm.tsx` or `TitleScreen.tsx`, which other tracks own. They inherit the restyled `lime`, `ghost`, `glass` and `CadetSignUp`, and Saira through `font-mono`, but still carry lime, raw colours and emoji in their own classes.
- The route fade depends on View Transitions. Browsers without it cut straight to the new screen, on the void. I saw it run in Chromium only.
- I did not run `next build`, to avoid disturbing the running dev server. `RouteFade` wraps `usePathname` in Suspense, as the Next 16 cacheComponents docs ask for dynamic params.
- I did not run a test with a screen reader. Roles and names come from ui-sdk parts plus explicit labels.
- The battle dock is still the old layout (it is wave 2's cockpit). With `?dev` and all ten Power-Ups it is tall on phones.
- I did not play a full mission to its end card or a Hyper-Jump offer. Those cards are restyled but unseen.
- I did not open Quick Flashcards or the Resting Bay's poster and trick-card dialogs in the browser. Their classes are restyled.

## Requests for other tracks

- **Title and film (wave 2):**
  - use `Wordmark size="lg"`, `Button variant="primary" size="lg"` and `NovaLine`;
  - remove the `lime-*`, `font-mono` and raw `#…` classes and the `▶`, `🚀` and `✋` glyphs in `TitleScreen.tsx` and `IntroFilm.tsx`;
  - the film's caption chip should be `NovaLine`.
- **Every wave 2 screen:**
  - mount `<TopBar left={<HomeLink/>} title="…" orbs={state.orbs} onHelp={…} />` and drop the per-screen corner chips;
  - drop the `right-16` orb pills, which only exist to dodge the floating sound button.
- **Worlds:**
  - `BAND_COLOURS` in `worlds/space/restingBay.ts` still drives the bay posters with its own palette;
  - map it to `MASTERY` (Gold, Got it, Learning, New) so the 2D marks and the 3D posters agree.
- **Engine:** none.
