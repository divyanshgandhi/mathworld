@AGENTS.md

# Math World

A space multiplication game for kids (Grade 3+) and adults: answer to fire plasma cannonballs, learn visually from every miss, unlock tricks as live tactical power-ups (`We Do`), and climb the Solar System from `0 × 0` up to unbounded multi-digit armadas.

Read in this exact order before making changes:
1. `OVERHAUL.md` — the brief for the current overhaul: the learning model, the Void and Gold design language, the plan and the working rules. It wins over older documents where they disagree.
2. `PRODUCT.md` — product truth: users, purpose, positioning, principles
3. `STATE.md` — current status
4. `SPEC.md` — the product, pedagogy, audio and database specification (its visual sections are superseded by `OVERHAUL.md`)
5. `docs/tricks.md` — the exact kid-named trick scripts

## Engineering & Execution Rules

- **Follow `OVERHAUL.md`.** Values come from `src/design/tokens.ts`; 3D lighting comes from `src/worlds/looks.ts`.
- **Small vertical slices + clean commits.** Commit after each working phase or sub-slice with a crisp commit message. Run `bun run check` (`next typegen`, `tsc`, `eslint`, `vitest`) after every step and confirm it is green.
- **Code owns the math and structure; AI writes words only.** All pools, mastery math, error classification, and trick beat breakdowns live in pure TypeScript under `src/rig/` with Vitest assertions proving partial products equal `a × b`.
- **Event-sourced persistence.** Every player action appends to `events` (`src/db/schema.ts`); `PlayerState` is folded purely by `src/director/fold.ts`. Never store loose mutable mastery columns that drift from the event log.
- **Trick scripts come from `docs/tricks.md`.** Turn those exact scripts and kid-friendly names into deterministic beats; never invent generic textbook explanations.
- **Client-only Gradium Phonon (`phonon-tts`).** Never import `phonon-tts` in Server Components, SSR, or Vercel API routes. Pre-bake static intro/briefing audio into `public/vo/` and run `phonon-tts` exclusively inside a browser Web Worker.
- **Zero private leaks.** This repository is public and shareable. Keep secrets, API keys, personal notes, and paths outside `mathworld/` completely out of files, comments, and commits.
- **Do not import from `design/lookbook/`.** Lookbook HTML files are static visual reference only.
- **UI controls use `@ui-sdk/react` + `@ui-sdk/core`.** Before building any UI control (buttons, dialogs, drawers, popovers, tabs, toolbars, radio groups, toasts), follow the installed `ui-sdk` skill and read `node_modules/@ui-sdk/react/docs/llms.txt` (and search `core.md` by heading only when defining a custom primitive). Name every control cleanly so `createAgent` / WebMCP works out of the box.
- **Verify by playing it.** Open the live routes in a browser, test desktop keyboard AND mobile touch (`inputMode="none"`), test `0` as a valid answer, test undershoot/overshoot, test `Show Me How` repeat shortening, and check console errors.
- Before ending any session, update `STATE.md`.
