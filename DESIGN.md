# Math World design system: Void and Gold

This is the system as built. `OVERHAUL.md` holds the brief and wins where the two disagree. The approved look is in `design/bay-accretion.html` and `design/title.html`. The live reference is the `/kit` route: every component in every state, on the void, at desktop and phone width.

## Where values live

| Layer | File | What it holds |
| --- | --- | --- |
| Source of truth | `src/design/tokens.ts` | colours, ink, hairlines, fills, the action edge, mastery, type, sizes, radii, motion, cadet colours, `CSS_VARS` |
| CSS and Tailwind | `src/app/globals.css` | the same values as CSS variables in `@theme static`, the type voices as utilities, the route fade |
| Components | `src/components/kit/kit.css` | button, sheet, tile, input, marks, wave dots and top bar styles; token variables only |
| React | `src/components/kit/` | the kit (`import { Button, Sheet, ... } from "@/components/kit"`) |

`tests/design-tokens.test.ts` fails if `globals.css` and `tokens.ts` drift, if the stylesheet declares a design variable that `tokens.ts` does not know, or if `kit.css` writes a raw colour. It also checks the contrast of every text colour. `tests/design-debt.test.ts` counts what is left of the old look and never fails. Run it with `bunx vitest run tests/design-debt.test.ts --silent=false`.

Never write a raw colour, font or duration in a component. If a value is missing, add it to `tokens.ts` and `globals.css` together, and the test tells you if you missed one.

## Colour

One black on every screen. Gold is the key light. Sky is the cool rim. Ember is heat.

| Token | Tailwind | Use | On void |
| --- | --- | --- | --- |
| `void` `#07070a` | `bg-void` | the only background | n/a |
| `panel` `#0a0c14` | `bg-panel` | a sheet, a text field | n/a |
| `shadow` `#1a1f33` | `bg-shadow` | a pressed primary, the night side of a planet | n/a |
| `horizon` `#2b2f3d` | `bg-horizon` | dividers on raised surfaces | n/a |
| `approach` `#e6f1ff` | `text-approach`, `text-ink-1` | primary ink, the Got it mark | 17.6:1 |
| `ink-2` (78%) | `text-ink-2` | body copy, secondary words | 10.7:1 |
| `ink-3` (55%) | `text-ink-3` | the quietest readable text; disabled | 5.6:1 |
| `sky` `#8fb4ec` | `text-sky` | Nova, the Learning mark, hints | 9.5:1 |
| `disk` `#4a79bb` | `text-disk` | the cold end of the edge; marks and large display only | 4.5:1 |
| `gold` `#ffc857` | `text-gold` | Gold mastery, orbs, focus rings, a right answer | 13.1:1 |
| `ember` `#ff6a3d` | `text-ember` | a miss, exhaust, the warm end of the edge | 7.1:1 |
| `recede` `#ff3e1f` | `text-recede` | the hottest end of the edge | 5.7:1 |

All text colours keep at least 4.5:1 on `void`, `panel`, a sheet over the void and `lift`. The test checks every pair.

- Hairlines: `border-line-1` (14%) for resting edges, `border-line-2` (24%) for controls, `border-line-3` (50%) for hover.
- Fills: `bg-lift` is the inside of a hovered primary pill, `bg-raised` a hovered or chosen tile, `bg-sheet` a sheet over a 3D scene, `bg-scrim` the backdrop behind a modal sheet.
- The action edge: `var(--edge-rest)` runs cool to hot. `var(--edge-hot)` is the gold edge on hover. Only the primary pill uses it.
- Nothing glows except the Sun and the Launch moment. No `box-shadow` glow, no drop-shadow cards, no blur.

## Type

One family, Saira (variable width and weight, self-hosted). The family name `"Saira"` is a contract: canvas text in the 3D worlds uses it too, after `document.fonts.load('400 16px Saira')`.

| Voice | Class | Spec | For |
| --- | --- | --- | --- |
| Display | `type-display` (size with `text-*`) | weight 200, width 125%, tracking 0.03em, capitals | titles, the wordmark, the big `a × b`, planet names |
| Label | `type-label` (15 px), `type-label-sm` (13 px) | weight 500, width 115%, tracked capitals | short labels only: a screen's name, "Plasma balls" |
| Body | `type-body` (17 px), `type-body-sm` (16 px) | weight 400, sentence case | anything an adult reads |
| Child | `type-child` (19 px) | weight 400, sentence case | anything a child must read: Nova's lines, mission status |
| Name | `type-name` | weight 500, width 110%, sentence case | places and things on buttons: "Star map", "Hull Paint" |
| Number | `type-number` | equal-width digits, width 112% | orbs, the readout, any number that changes in place |

Minimums: labels 13 px, body 16 px, child text 17 px or more. Tailwind's `text-xs` is raised to 13 px so the smallest step of the scale is the label minimum.

- `font-mono` now resolves to Saira in the label's width with equal-width digits, so older monospace text changed at once. Do not use it in new code.
- `font-code` is a real monospace, only for the adult `/admin` dashboard.
- No serif, no monospace, no emoji, no Unicode glyphs standing in for icons.

## Shape and motion

- Radii: `rounded-panel` (16 px), `rounded-chip` (14 px), `rounded-pill`.
- Hairline circles and dashed orbits are the house motif (the ring logo, the rocket glyph's dashed orbit).
- One curve: `ease-out` is the exponential ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`), also the default for every `transition`.
- Durations: `duration-quick` (180 ms, controls, also the default), `duration-route` (240 ms, the fade between screens), `duration-moment` (1100 ms, the one authored moment per screen).
- Reduced motion switches transitions, animations and the route fade off.

## Components

Import from `@/components/kit`. Every control is a ui-sdk part (`@ui-sdk/react`), so it has a role, a name, keyboard support and state attributes.

### Button

`<Button variant="primary" | "secondary" | "quiet" | "icon" size="sm" | "md" | "lg" icon? glyph?>`. Sizes are 44, 52 and 72 px tall.

- **Primary:** the gradient-edge pill on black with the ring-and-rocket glyph on the right (`glyph={false}` drops it). The edge turns gold on hover and the rocket lifts. Words are short tracked capitals.
  - Do: use one per screen, for the move that takes the player forward (Launch, Start game, Resume). On phones, make it full width with `className="w-full justify-between"`.
  - Do not: use two on one screen, use it for a price or a filter, or colour it in by hand.
- **Secondary:** a hairline pill in sentence case, with an optional icon. Its edge turns gold on hover. Use it for places and second choices (Star map, Hangar, Keep flying here).
- **Quiet:** words only, for the third most important thing (Switch cadet, Close deck).
- **Icon:** round, 44 px. Use `<IconButton icon="help" label="How to play" />`; the label is required and names the control.
- **States:** hover, focus-visible (a 2 px gold ring 4 px out), pressed (1 px down; a primary darkens to `shadow`), chosen (`aria-pressed="true"` or `data-selected`: a white edge on `raised`), disabled.
  - Disabled is the same neutral dim on every variant: `ink-3` words, a `line-1` edge, a grey glyph.
  - Never fade an accent colour to show disabled.
- `buttonClass(variant, size)` gives the class string for parts that render their own element (`DialogClose`, `DialogTrigger`, `TabsTab`).

### PillLink and HomeLink

`<PillLink href variant size icon>` is a link drawn as a button: a Next `Link` through the ui-sdk Button, so `disabled` really stops navigation. `<HomeLink />` is the round home button to the Resting Bay. Use links for places, buttons for actions.

### Sheet

`<Sheet>` or `className={sheetClass}`: the rare raised panel, with a 16 px radius, a 1 px hairline and a near-black fill.

- Do: use a sheet for something opened on top: one table's facts, the pause menu, the sign-up card.
- Do not: use a sheet as page structure, put cards inside cards, or add glass, blur or a shadow.

### Tile

`className="mw-tile"`: a hairline tile on the void for a times table, a trick or a shop item. It turns `raised` with a stronger edge on hover, `aria-expanded`, `aria-pressed` or `data-selected`.

### Icon and RocketGlyph

`<Icon name size label?>` draws from one set on a 24 px grid in a single 1.7 px stroke and `currentColor`. The names are `rocket`, `orb`, `plasma`, `play`, `map`, `help`, `sound-on`, `sound-off`, `home`, `menu`, `lock`, `trick`, `cards`, `close`, `back`, `forward`, `jump`, `check`, `flag`, `star`, `delete`, `cadet`, `hangar`, `academy`, `bay`, `plus` and `minus`. An icon is decorative unless you pass `label`. To add one, add a path to `PATHS` in `Icon.tsx`, never an emoji. `<RocketGlyph>` is the multicoloured ring-and-rocket that rides on primary actions.

### MasteryMark, Pips, MasteryKeyLegend

Each mastery level has a word and a mark, and each mark reads without colour:

| Level | Mark |
| --- | --- |
| Gold | gold bullseye (a core inside a ring) |
| Got it | filled white dot |
| Learning | blue outline |
| New | small dim dot |

- `<MasteryMark level size label?>` draws one mark.
- `<Pips marks columns>` draws a grid of marks (a table's ten facts) with one accessible name such as "3 Gold, 2 Got it, 5 New".
- `<MasteryKeyLegend>` shows the four marks with their words, the first time a screen shows marks.

### WaveDots

`<WaveDots total won current?>` shows the waves of a mission:

- won waves are filled gold;
- the wave in play has a white outline (with `current`);
- the rest are hairline rings.

The words beside the dots say the same thing ("1 won").

### Wordmark, RingLogo, NovaPortrait, NovaLine

- `<Wordmark size="sm" | "lg">` is the ring logo with MATH WORLD in the display voice. At `sm` the name hides on phones.
- `<NovaLine speaker? portrait?>` is the one style for spoken lines in the bay, in battle and in the film. It shows a portrait, the speaker's name in sky, and the words at child size. Pass `live` to announce it.

### TopBar and OrbCount

`<TopBar left title orbs onHelp right>` is the one bar every screen shares. On the left are a home or menu slot and the screen's name; on the right are orbs, help (only when `onHelp` is given) and sound. It is 64 px tall on phones and 76 px on desktop, and it never reflows. While a TopBar is mounted it owns the sound button and the floating one hides; the M key works either way. `<OrbCount n>` is the gold orb, the number, and the word "orbs" (hidden on phones).

### RouteFade

It is mounted once in the root layout. Every route change dips the old screen to void and raises the new one in `MOTION.route` (240 ms) through React's `<ViewTransition>`. Changes inside one route never animate. Browsers without View Transitions cut straight to the new screen, still on the void.

### SoundButton

`SoundButton` is exported from `src/components/SoundToggle.tsx`: the kit icon button for mute.

## Older screens

`src/components/battle/ui.tsx` keeps its exported names and now draws in this language:

| Export | Now |
| --- | --- |
| `btn` | a pill base |
| `ghost` | secondary |
| `lime` (also `primary`) | the primary edge pill |
| `quiet` | quiet |
| `glass` | a sheet |
| `backdrop` | the scrim |
| `dialogBox` | a centred sheet |
| `padKey` | a keypad key |

New code should use the kit components instead.

## Refused defaults

These read as generic machine-made UI. Do not ship them (from `OVERHAUL.md`):

- a small label ("kicker") above a heading;
- same-size cards of icon, heading and text as page structure, or cards inside cards;
- glass or blur as decoration, gradient text, hard offset shadows, or a coloured side border on cards;
- monospace as a "technical" costume;
- sparklines, progress rings or stat tiles standing in for content;
- a modal for something that needs no interruption;
- text under 4.5:1 contrast (3:1 for large text).

## Words

Player-facing names are in `docs/glossary.md`. Use sentence case everywhere except proper names and the tracked capitals of the label voice, which come from CSS, not from the string.
