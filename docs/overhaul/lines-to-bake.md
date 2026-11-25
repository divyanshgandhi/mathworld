# Lines to bake

Wave 3 baked every line on this list (see `docs/overhaul/w3-voice.md` for the measurements). `tests/voice-clips.test.ts` fails when a line in a code table has no clip, a clip says other words than its caption, or a clip belongs to no line. To change a line: change its text in the code table and in `scripts/bake-voices.py`, then `bun run voices <id>`, in one commit.

## Baked in wave 3

| Id | Text | Where it plays |
| --- | --- | --- |
| `nova_greet_battle` | Let's clear these ships, cadet! | The first battle's first wave, once |
| `nova_guide_count` | Count the ships. | Guided first shot, step 1 (the guide starts the clip) |
| `nova_guide_type` | Type how many. | Guided first shot, step 2 |
| `nova_guide_fire` | Now press Fire. | Guided first shot, step 3 |
| `nova_greet_map` | Tap a planet. Win there to open the next one. | First visit to the Star map (caption; see below) |
| `nova_greet_hangar` | Spend your orbs here to change how your rocket looks. | First visit to the Hangar (caption; see below) |
| `nova_greet_academy` | Pick a trick. I will show it on real ships. | First visit to the Academy (caption; see below) |
| `nova_greet_flashcards` | Type the answer. There is no timer, so take your time. | First flashcard deck (caption; see below) |
| `nova_greet_bay` | This is your Resting Bay. Press Launch to fly. | First visit to the Resting Bay (caption; see below) |
| `nova_err_way_off` | Way off! Count the squads with me. | A wild guess (`ERROR_LINE.wild_guess` points here now) |
| `nova_invite_power` | Tricky one! Try a Power-Up, or tap Show me how. | The second miss, a Power-Up fits (replaces `nova_invite_v2`, which never shipped) |
| `nova_invite_help` | Stuck? Tap Show me how. | The second miss, no Power-Up yet |
| `nova_ships_incoming` | Ships incoming! | A mission's first wave |
| `nova_too_few` | Too few! Some got away. | A near miss, too few |
| `nova_too_many` | Too many! Some flew past. | A near miss, too many |
| `nova_earth_clear` | Earth is clear! The Moon is open. | Earth cleared |
| `nova_jump_<planet>` (6) | You know these. Jump ahead to <planet>? | The Hyper-Jump offer |

Re-baked with new words (same id): `nova_hi` (Hi! I am Nova, your co-pilot. Ready for launch?), `nova_err_under` (Too few! Some got away. Try again.), `nova_err_over` (Too many! Some flew past. Try again.), `nova_err_wild` (Way off! Count the squads again.), `captain_danger` (Deep space is in danger. Earth needs sharp young minds. Five cadets start today.), `captain_brief2` (This is your rocket.).

Removed (clip, manifest entry and bake line): `nova_l0_intro`, `captain_brief3`, `captain_brief4`, `nova_radar`, `nova_invite`, and seven clips no code played or matched (`nova_exact`, `nova_over`, `nova_under`, `nova_retry`, `nova_l0_clear`, `nova_incoming`, `nova_wave_clear`), plus `nova_zero`, whose words no longer match the Empty and Mirror lesson line.

## Still caption only

- **The greetings on the Star map, Hangar, Academy, flashcards and Resting Bay.** Their clips exist, but `Greeting.tsx` (not the voice track's file) shows the caption and plays no sound. To voice them, have it call `audio.say(line.id)` when it shows.
- **The Resting Bay's lines** (`bay.cleared`, `bay.jumped`, `bay.all-clear`, `bay.mission-won`, `bay.nearly-gold`, `bay.back`): they carry a live name or planet, so they stay captions.
- **Scan captions** ("1, 2, 3", then "6 squads."): built at run time, never baked.
- **The Empty lesson's first line** ("Zero squads means empty space — not a single invader!", in `src/rig/tricks.ts`): no clip matches its words, so it plays live speech or a caption. It also says "invader", which the glossary retired; the fix belongs to the trick script's owner.
