# Math World

A multiplication game where the answer is the action. Invaders arrive in squadrons and you load one cannonball for each. Load too many and the extras fly past; load too few and invaders are left standing. Every miss explains itself, and Nova, your co-pilot, shows you the trick, inside the world.

## Run it

```bash
bun install
bun run dev      # http://localhost:3200
bun run check    # route types, typecheck, lint, tests
```

- `/intro`: the opening film. Earth, an ordinary Tuesday, waking up in class, two quick questions, the knock, cadet selected.
- `/wave`: a Moon wave in the Math World look. Click it once for sound.
- In the browser console, `window.__mw.stage.step(seconds)` advances time by hand, and `window.__mw.intro.jump("knock")` jumps to a chapter.

## How the code is laid out

| Path | What |
|---|---|
| `src/engine/` | Shared by every world. `stage` (renderer, bloom, colour grade, loop), `materials` (the clay, toon and glow material base, plus builder helpers), `camera` (cuts and glides), `director` (steps of a film), `overlay` (captions, titles, fades, eyelids, choices), `sound` (placeholder effects). |
| `src/worlds/space/` | The space world pack: `cast` (characters and Nova), `classroom`, `town`, `earth`, `ships` (rocket and invader), `intro` (the film), `wave` (the Moon wave). |
| `src/components/` | Thin React components that mount a scene and draw the controls around it. |
| `tests/` | Vitest tests for the pure parts. |

## Docs
- `SPEC.md`: the locked end-to-end product, pedagogy, visual unit, audio, and database specification.
- `ROADMAP.md`: the phased execution plan from 0 to 1, with the numbers we track.
- `docs/tricks.md`: the kid-named trick scripts and deterministic router.
- `design/lookbook/`: the original single-file prototypes, for reference only.
