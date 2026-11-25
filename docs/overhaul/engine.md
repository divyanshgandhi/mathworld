# Engine track (wave 1): handoff

Branch `overhaul/w1-engine`. The battle is now a small engine under `src/battle/`. What the player sees and the events stored are unchanged (checked against the old version, below).

## What changed
`src/worlds/space/arena.ts` went from a 1,160-line closure to about 590 lines of glue (most of it the ArenaUi type, comments and the public methods). Everything else moved into `src/battle/`:

| File | What it is |
| --- | --- |
| `state.ts` | Pure phase machine and reducer: `briefing → next → aiming ⇄ lesson → volley → resolve / hint → cleared → next / offer / done`. Holds the wave, attempts, Radar use, lessons this wave, safety-net use, hint ladder, first-try streak, anti-mash (wild guesses) and the typed digits. `routeMiss()` decides safety net, Show Me How or a reaction, from `scaffold()`. |
| `bus.ts` | Typed, synchronous event bus (see the event list below). |
| `persistence.ts` | Bus → stored `EventInput` log: same types, fields, field order and event order as before. |
| `sound.ts` | Bus → `audio.sfx`, with the same throttles (shot 0.06 s, burst 0.05 s on the stage clock). |
| `telemetry.ts` | Bus → the ?dev readout (`ui.shots`, `ui.lessons`). |
| `scheduler.ts` | Timers on the stage clock (`stage.paused` + `stage.step` still inspect any frame). |
| `voice.ts` | Nova's `say()` and the Show Me How beat player. |
| `lessonBeats.ts` | Show Me How visuals per beat (was `stageBeat`). |
| `sectorLock.ts` | Sector-Lock state and visuals. |
| `look.ts` | Every raw colour and light value the battle draws today, in one file (see "Requests"). |
| `systems/fleetView.ts` | Formation, fly-in, kill (`land`), `wink`, `regroup`, axis labels, Flip It! turn, marks group. |
| `systems/marks.ts` | Plates, tags, badges, lasers, ghosts, outlines, `split`, `bands`: the kit Power-Ups and lessons share. |
| `systems/cannon.ts` | Rocket, plasma balls, `volley()` scheduling, typed-digits store (`setCharge`). |
| `systems/fx.ts` | Spark bursts, the lesson dim plane. |
| `systems/holo.ts` | The one world-label component: `holoText`, `holoLabel(text, "axis" \| "tag" \| "badge", opts)`, `holoPlate(rects, tone)`. Replaces `textPlane`, `tag`, `badge` and `plate`. |
| `systems/camera.ts` | `measure(fv)`, `frameBox()`, `createCameraRig()` (the framing maths, unchanged). |
| `systems/nova.ts` | Nova beside the fleet during a lesson. |
| `systems/backdrop.ts` | Sky, the three battle lights, the battle look on the stage. |
| `powerups/<id>.ts` + `index.ts` | Registry: `{ id, name, fits(a, b), keepsMarks?, apply(ctx), line(ctx) }`. Replaces the `applyPowerUp` switch and `visualFits`. |
| `hints/index.ts` | The hint ladder as data (`LADDER`) and pure `nextHint(state, band)`. |
| `rewards.ts` | Orb rules as data (`ORB_RULES`): 5 first try, 3 later, 0 in the Academy, 20 for a planet. |
| `planets/<id>.ts` + `index.ts` | Per-planet theme: backdrop, ground, music mood, briefing line, clear line (Cadet Bay intro lines on Earth). |

`cadetBay.ts` now reads its lines from `planets/earth.ts`. `warmup.ts` is untouched.

## APIs for other tracks
`mountArena(stage, opts)`, `ArenaUi`, `ArenaOpts`, `Arena` and every method the HUD, WaveArena, IntroFilm, AcademyScreen and WarmupDrill call are unchanged. Additions only:

- `ArenaOpts.structure?: "labels" | "discover"` (default `"labels"`). In dev, `?discover` in the URL also turns it on (temporary, inside `mountArena`).
- `arena.setCharge(n: number | null)`: store the digits being typed and emit a `charge` bus event. No visual yet. The HUD should call it on every keypad change (wave 2).
- `arena.bus`: `bus.on(type, fn)` returns an unsubscribe; `bus.onAny(fn)`. Events and payloads are in `BattleEvents` (`src/battle/bus.ts`): `wave_started`, `fire`, `launch`, `hit`, `miss`, `resolved`, `wave_cleared`, `regroup`, `ready`, `powerup_applied`, `hint_shown`, `lesson_started`, `lesson_completed`, `lesson_spoken`, `orb_burst`, `battle_done`, `charge`, `record`, `cue`.
- `arena.battle`: the read-only phase-machine state (`phase`, `attempts`, `streak`, `hint`, `charge`, …).
- `arena.structure`.
- `ArenaUi.structure?`, `ArenaUi.charge?: number | null`, `ArenaUi.hint?: { level: number; squads: "on" | "soft" | "off"; each: "on" | "soft" | "off"; powerUp: TrickId | null } | null` (null in "labels").
- `POWERUPS`, `fitsPowerUp(t, a, b)`, `fittingPowerUps(ids, a, b)` from `@/battle/powerups`.
- `nextHint`, `LADDER` from `@/battle/hints`; `ORB_RULES`, `waveClearOrbs`, `planetClearOrbs` from `@/battle/rewards`; `PLANET_THEMES`, `themeOf` from `@/battle/planets`.
- `holoText`, `holoLabel`, `holoPlate` from `@/battle/systems/holo`.

### Structure "discover" as built
Hidden at the start of a wave: the "N squads" and "N each" labels and their brackets. A fact never met shows the squads label at 60% opacity at once; a known fact shows nothing. Miss 1: the squads label shows once Nova's reaction line ends. Miss 2: the each label shows and `ui.hint.powerUp` names the Power-Up that fits (the fact's own trick if the cadet has it, else the first fitting one on the belt). Miss 3 or pressing Show Me How: both labels. Every step emits `hint_shown`. Plain visibility only; wave 2 animates the scans.

## How it was verified
- `bun run check` green: 113 tests (the 83 existing plus 30 new in `tests/battle.test.ts` and `tests/battle-bus.test.ts`). The Power-Up test checks `fits` against `powerUpFits` over 0–10 × 0–10 and 22 multi-digit facts.
- Old version against new, in the browser, same facts with `?dev&a=..&b=..`, on a paused stage stepped frame by frame. At each checkpoint I hashed the whole battle scene graph (every object's type, visibility, scale, x and z position, geometry, colour, opacity and draw order, plus camera position and the count of balls and sparks), a snapshot of `ArenaUi`, and every POST /api/events body (all fields except `latencyMs`).
  - Moon 3 × 8: undershoot, overshoot, Flip It!, Split & Add, exact, the next wave drawn (5 × 9 in both).
  - Moon 0 × 7: Empty & Mirror, a misfit (Flip It!), an overshoot, 0 as the answer.
  - Asteroid Belt 6 × 7: a wild miss (Radar), Jump One More, Fast Adding, a misfit (Double It!), Split & Add, a second miss (invite), a third miss (Show Me How), the We-Do answer.
  - Jupiter 6 × 24: 10 s idle (Radar), Big & Small Split, a misfit (Easy 5s & 10s), Flip It!, Show Me How by button, a Radar answer.
  - Saturn 16 × 24: Sector-Lock (a wrong lock, two right ones, select), a miss, exact.
  - Deep Space 342 × 2647: a miss, Sector-Lock, exact.
  - Result: every scene-graph hash, UI hash and event payload matched, except "after Show Me How" on the Asteroid Belt and Jupiter. Rerunning the Asteroid Belt on the new version gave the old version's exact hash, so it is run-to-run noise: lesson beats run on wall-clock time and the We-Do pulse keeps cycling.
- Shot timings on the stage clock (Moon 3 × 8: miss 1, miss 2, miss 3 into Show Me How, a miss during the lesson into the safety net, then 0). Old: 3.233, 3.25, 2.1, 1.083, 1.85 s. New: 3.267, 3.233, 2.083, 1.05, 1.85 s. All within two frames. The events matched.
- Wall-clock shot timings in real time: 3.54 and 3.35 s (old) against 3.59 and 3.70 s (new). My tab was a background tab, so timers were throttled. The 0.35 s gap on the second shot is outside the 0.3 s target. I put it down to throttling because the stage-clock timings agree, but I did not prove it with the tab in front.
- New version only (old and new test players had different histories, so the campaign could not be compared like for like): Cadet Bay from /intro?dev, played to "Earth · Cadet Bay clear" (events in the old order: `planet_cleared`, `intro_completed`, `orb_earned` 20), 0 as a Cadet Bay answer (9 × 0), the Hyper-Jump offer on the Moon, declining it, and accepting it (`hyper_jump_taken`, then on to the Asteroid Belt).
- Discover: 7 × 9 (never met) and 3 × 8 (known) with `?discover`. The ladder showed as described, `hint_shown` was emitted, and `setCharge` updated `ui.charge`, `arena.battle.charge` and the bus.
- Phone (375 × 812): Jupiter with Big & Small Split, laid out as before. No console errors.

## Differences found
- None in what is drawn, in the UI state or in the stored events, on the paths above.
- `ArenaUi` has three new optional fields (`structure`, `hint`, `charge`). `onUi` fires one extra time when a shot is fired after `setCharge`, because the digits reset.
- The `hint_shown` payload for the soft first-sight hint reports `level: 1` with `soft: true`. In state the ladder level stays 0, so miss 1 still firms the label up.

## Not done or not verified
- Wall-clock shot timings with the tab in front (see above).
- An old-against-new comparison of Cadet Bay and the Hyper-Jump (both verified on the new version only).
- `warmup.ts` still has its own rocket and volley code; it could use `createCannon` later.
- Holo labels still use the system sans font (zero visual change). Moving to Saira is a one-line change in `holo.ts`, after `document.fonts.load('400 16px Saira')`.
- "Discover" is reachable only by `opts.structure` or `?discover` in dev. No screen passes it yet.

## Requests for other tracks
- **HUD (kit / wave 2):** the battle plate prints "7 squads · 9 fighters each" under `a × b`, which gives away the structure that "discover" hides. In discover mode, drive that line from `ui.hint`. Use `ui.hint.powerUp` to flag the Power-Up, and call `arena.setCharge()` on every keypad change.
- **Restyle (wave 2):** replace `src/battle/look.ts` with values from `src/design/tokens.ts` and `src/worlds/looks.ts`. It is the only file under `src/battle/` with raw colours. I kept today's values on purpose, so this wave changes nothing on screen.
- **Worlds:** `src/battle/planets/*.ts` describes each sky (`backdrop`, `ground`). If the planet factory reads its battle settings from there, the battle and the 2D screens share one source.
- **Decision needed (maths and product):** the battle's `fits` is stricter than `powerUpFits` in exactly two cases, both where a side of 10 is drawn as Squadron Pods: Fast Adding with `a = 10`, and Split & Add with a 10. The test encodes these two exceptions. Either the rig adopts them, or wave 2 draws these fleets in a way the tricks can act on.
