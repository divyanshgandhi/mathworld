# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Kids (Grade 3 and up) and adults, served equally. Kids learn their single-digit times tables. Adults practise multi-digit multiplication on the same planets further out. Both play alone in short sessions, on a laptop with a keyboard or on a phone or tablet by touch, with sound on.

## Product Purpose
Math World builds multiplication fluency from `0 × 0` up to unbounded multi-digit problems. Success means facts reach Gold, which is instant, unassisted recall, and the player understands why an answer is right, not just what it is.

## Positioning
Two mechanisms together:
- **The answer is the action.** The player fires exactly as many plasma balls as their answer. The miss itself shows the error: too few, and ships survive; too many, and balls fly past. Tricks are Power-Ups that reshape the live fleet.
- **Mastery you can see.** Every fact has a visible mastery state, from not met through Practising and Understood to Gold. It is driven by first-try accuracy and speed, and the game adapts to it.

## Operating Context
Played in a browser. A first-time player watches an intro film: the classroom, the principal's announcement, the Captain recruiting five cadets, and Nova the co-pilot. Then comes a first battle in Cadet Bay. After that the loop runs between hub screens (the Resting Bay, the Solar System map, the Hangar, the Academy, warm-ups and flashcards) and battles on each planet. Voice runs in the browser: baked clips plus live speech for the player's name. Captions are always shown.

## Capabilities and Constraints
- **Maths lives in the code.** It is pure TypeScript in `src/rig/`, with tests proving that the parts of every trick add up to `a × b`. AI writes words only.
- **Event-sourced.** Every action appends to an event log, and player state is folded from it.
- **Tricks.** There are ten, with kid names and scripts in `docs/tricks.md`. Power-Ups never reveal the answer. Show Me How demonstrates it.
- **Orbs** are earned in play and spent on cosmetic ship upgrades in the Hangar.
- **Routes:**
  - `/` (title and sign-up), `/intro` (film and Cadet Bay)
  - `/bay`, `/map`, `/hangar`, `/academy`
  - `/play/[planet]`, which includes the warm-ups
  - `/admin` (an adult telemetry dashboard)
- **Open product decisions:**
  - which surfaces are 2D and which 3D
  - the hint ladder
  - the economy beyond cosmetics
  - the character redesigns
  - the visual world

## Brand Commitments
- **Name:** Math World.
- **Story:** the Star Fleet cadet story and the classroom intro film.
- **Cast:** Nova the co-pilot, the Captain, the teacher, the principal and four classmates.

Everything visual, including the 3D style, is open to replacement.

## Evidence on Hand
- A levelling proof is in `docs/levelling-proof.md`: five simulated players, with every claim checked.
- 83 automated tests.
- A real-kid test protocol is in `docs/test-protocol.md`.
- **No learner has played it yet.** Do not invent testimonials, learner counts, outcomes or school use.

## Product Principles
- The miss teaches. Feedback shows what happened, in the world, before it explains.
- Mastery is visible and honest. Progress comes only from real recall, never from grinding or buying.
- One game for two ages. Nothing talks down to an adult or overwhelms an eight-year-old.
- The maths is exact. Every visual is true to the numbers it shows.

## Accessibility & Inclusion
- Full keyboard and touch play.
- `0` is a valid answer.
- Voice is always captioned.
- No visible timers: speed is measured silently.
- Text a child must read stays large and plain.
