# Lines to bake (wave 2)

Every spoken line that wave 2 added or changed, gathered from the handoff notes. They play as captions today (OVERHAUL.md, wave 2 decision 10). The film track's voice bake (`bun run voices`, `scripts/bake-voices.py`) turns them into clips under the same ids in `public/vo/`. Until then a line with no clip is a caption paced on reading time.

## New lines

| Id | Text | Where it plays | From |
| --- | --- | --- | --- |
| `nova_greet_battle` | Let's clear these ships, cadet! | The first battle's first wave, once (`greet:battle`). Live now: it replaced `nova_l0_intro`. Changed in the fix pass: "Cadet Bay" is not said on a battle (decision 7) | manual, fix pass |
| `nova_guide_count` | Count the ships. | Guided first shot, step 1 | manual |
| `nova_guide_type` | Type how many. | Guided first shot, step 2 | manual |
| `nova_guide_fire` | Now press Fire. | Guided first shot, step 3 | manual |
| `nova_greet_map` | Tap a planet. Win there to open the next one. | First visit to the Star map | manual |
| `nova_greet_hangar` | Spend your orbs here to change how your rocket looks. | First visit to the Hangar | manual |
| `nova_greet_academy` | Pick a trick. I will show it on real ships. | First visit to the Academy | manual |
| `nova_greet_flashcards` | Type the answer. There is no timer, so take your time. | First flashcard deck | manual |
| `nova_greet_bay` | This is your Resting Bay. Press Launch to fly. | First visit to the Resting Bay, inside `bay.first` below | manual |
| `nova_err_way_off` | Way off! Count the squads with me. | A wild guess | combat |
| `nova_invite_power` | Tricky one! Try a Power-Up, or tap Show me how. | The second miss, when the belt has a Power-Up that fits (it pulses) | fix pass |
| `nova_invite_help` | Stuck? Tap Show me how. | The second miss, with no Power-Up to try yet (Show me how pulses) | fix pass |
| `nova_ships_incoming` | Ships incoming! | The first wave of a mission, every planet (replaces `nova_incoming_short`, which said "squads" before any miss) | fix pass |
| `nova_too_few` | Too few! Some got away. | A near miss, too few (replaces `nova_err_under`) | fix pass |
| `nova_too_many` | Too many! Some flew past. | A near miss, too many (replaces `nova_err_over`) | fix pass |
| `nova_earth_clear` | Earth is clear! The Moon is open. | Earth cleared (replaces `nova_l0_clear`, "Cadet Bay is clear!") | fix pass |
| `nova_jump_<planet>` | You know these. Jump ahead to <planet>? | The Hyper-Jump offer, six lines, one per planet (replace the Captain's `captain_jump_*`, "Ace telemetry!") | fix pass |

The guide's three lines are captions in the guide's own plate. If they are baked, the guide should start each clip with its step.

## The Resting Bay's lines

Nova's line on the bay. `{name}` and the planet are live words, so these suit live speech, or a clip per planet with the name spoken live. Today they are captions only, and the bay plays no voice.

| Id | Text | From |
| --- | --- | --- |
| `bay.first` | Hi, {name}! This is your Resting Bay. Press Launch to fly. | front, changed at mounting: it is now the bay's greeting (`greet:bay`), so it uses `nova_greet_bay` |
| `bay.cleared` | You cleared {planet}, {name}! {next planet} is next. | front |
| `bay.jumped` | You jumped all the way to {planet}, {name}! Same rules out here. | front |
| `bay.all-clear` | Every planet is clear, {name}. Keep your facts Gold with flashcards. | front |
| `bay.mission-won` | Great flying, {name}! Launch to see what is next. | front |
| `bay.nearly-gold` | Welcome back, {name}! Your {n}s are nearly Gold. | front |
| `bay.back` | Welcome back, {name}! Ready for {planet}? | front |

## Rewrites of baked lines (same id, new words)

These clips exist and say words the glossary retired, or say too much at once. Each needs new text in `src/worlds/space/lines.ts` and a re-bake; changing the text alone would put a caption over a voice that says something else.

| Id | Today | Suggested | Why |
| --- | --- | --- | --- |
| `nova_hi` | Hey! I am Nova, your co-pilot! Together we will calibrate every shot dead on. Ready for launch? | Hi! I am Nova, your co-pilot. Ready for launch? | "calibrate"; 17 words |
| `nova_err_under` | Too few! Load a few more. | Too few! Some got away. Try again. | "load" is retired |
| `nova_err_over` | Too many! Load a few less. | Too many! Some flew past. Try again. | "load"; "a few less" |
| `nova_err_wild` | Way off! Count the squads first. | Way off! Count the squads again. | `ERROR_LINE.wild_guess` still points here, though the arena plays `nova_err_way_off` |
| `captain_danger` | There is grave danger in deep space. Earth needs its sharpest young minds. We are enrolling five cadets today. | (story line; shorter words) | "grave", "enrolling"; above Grade 3 |
| `captain_brief2` | You have a spaceship, your co-pilot, and plasma balls to clear every squad. | This is your rocket. | four ideas in one line (docs/teaching.md, item 1) |

## Retired (no longer played; drop the clip at the next bake)

| Id | Why |
| --- | --- |
| `nova_l0_intro` | Replaced by `nova_greet_battle` (three ideas, retired words, an 8 s wait before the keypad woke) |
| `captain_brief3`, `captain_brief4` | Cut from the film's hangar at mounting: the miss rule is shown in the first battle, not told before it |
| `nova_radar` | The Targeting Radar is gone (decision 1) |
| `nova_invite` | Replaced by `nova_invite_v2`, itself replaced in the fix pass |
| `nova_invite_v2` | Never baked. Replaced by `nova_invite_power` and `nova_invite_help` ("Sneaky squad" was vague, and it offered a Power-Up to a cadet with none) |
| `nova_incoming_short` | Replaced by `nova_ships_incoming` (decision 2) |
| `nova_err_under`, `nova_err_over` | Replaced by `nova_too_few` and `nova_too_many` (so their rewrites above are no longer needed) |
| `nova_l0_clear` | Replaced by `nova_earth_clear` |
| `captain_jump_*` | Replaced by `nova_jump_*` (Nova is the only voice in battle; "Ace" and "telemetry" are out) |
| `nova_bullseye`, `nova_perfect` | No longer played: a right answer always gets `nova_dead_on` (one praise word) |

## Not for baking

Scan captions are built at run time: the count so far ("1, 2, 3"), then "6 squads." or "7 in each squad.".
