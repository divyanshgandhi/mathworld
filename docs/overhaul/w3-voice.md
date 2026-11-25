# Wave 3: voice

Every line in the code tables now has a clip that says its caption, and every clip belongs to a line.

## What changed

- `src/worlds/space/lines.ts`: six lines rewritten (`nova_hi`, `nova_err_under`, `nova_err_over`, `nova_err_wild`, `captain_danger`, `captain_brief2`); `captain_brief3`, `captain_brief4`, `nova_radar` and `nova_invite` removed; `ERROR_LINE.wild_guess` points at `nova_err_way_off`, the line the arena plays (its type widened to `LineId | CombatLineId`).
- `scripts/bake-voices.py`: the same rewrites; 22 new lines (greetings, guide, the combat track's lines); retired and orphan lines removed.
- `public/vo/`: 28 clips baked (6 rewrites, 22 new), 13 removed, `vo.json` to match. `nova_guide_count` was 5.9 dB under the median, so it was raised 5.5 dB with ffmpeg and `--measure` refreshed its `end`.
- `src/components/teach/FirstShotGuide.tsx`: each step starts its clip with `audio.say(id, still)`, the sound engine the battle's voice uses. One voice at a time, so a new step cuts the last clip; muted it plays at zero gain; a step left before its clip loads never starts late. The caption plate is unchanged.
- `tests/voice-clips.test.ts` (new): a line with no clip, a clip with other words, a clip with no line, a manifest entry with no file (or the reverse), a clip outside 0.4–9 s, or a retired id coming back all fail. `tests/film.test.ts`: the two caption tests that quoted the old Captain lines now use lines that still exist.
- `docs/overhaul/lines-to-bake.md`: what is baked and what is still caption only.

Voices and settings are the existing ones: Nova is `Zoey`, the Captain `Miles`, local Gradium Phonon (`phonon-31m-en`, q8) from the cached model, mp3 at 96k. Nothing was downloaded or installed.

The film paces every line on its clip (`audio.spoken`), not on fixed times, so no film timing was changed.

## How to use it

Change a line's words in its code table and in `scripts/bake-voices.py`, then `bun run voices <id>` (about a second a line). `bun run check` tells you if the two disagree.

## How it was verified

SAW, in the browser on this track's origin, muted (`mw:mute` = 1), with the stage paused and stepped:
- 1440 x 900: the Captain's danger line is one whole caption; the next line (the teacher) starts after it. In the hangar: `captain_brief1` at 2.0 s, `captain_brief2` "This is your rocket." at 8.0 s, `captain_nova` at 11.5 s, `nova_hi` at 15.5 s, one caption at a time, each whole.
- 375 x 812: the danger line splits at its sentences ("Deep space is in danger. Earth needs sharp young minds." then "Five cadets start today."), and the teacher follows at 22.5 s. In the hangar `captain_brief2` and `nova_hi` are each one caption.
- All 131 clips in `vo.json` answer 200. No console errors on the film, a practice battle, the Star map, the Hangar, the Academy or the Resting Bay.
- `bun run check` green (307 tests).

NOT SEEN: the guided first shot in a real first battle (`/play/earth?dev` is a practice battle and shows no guide), so the clip per step is checked by reading the code and by the test that each guide id has a clip, not watched. Nothing was heard. Small phone (360 x 640) and phone landscape were not checked.

## Measurements

Speech is `end` (where the words stop). Nova's clips run 1.76–4.81 words a second and the new ones 2.0–3.8, inside that. The Captain's older clips run 1.89–3.30; `captain_danger` is 2.79, and `captain_brief2` is 4.18 (four words in 0.96 s), a little quicker than his others but slower than Nova's quick lines, so it was kept. Median loudness −22.9 LUFS; every clip is within 6 dB of it. None is silent (lowest mean volume −31.1 dB before the fix, −28.1 now). Lengths 0.4–9 s, all.

| Id | Voice | Length s | Speech s | Words/s | Mean dB | LUFS |
| --- | --- | --- | --- | --- | --- | --- |
| `captain_brief1` | Miles | 4.64 | 4.10 | 3.17 | -25.7 | -24.9 |
| `captain_brief2` | Miles | 1.84 | 0.96 | 4.18 | -26.6 | -23.4 |
| `captain_danger` | Miles | 5.68 | 5.02 | 2.79 | -26.3 | -25.1 |
| `captain_jump_asteroid-belt` | Miles | 3.92 | 3.23 | 2.48 | -25.1 | -23.5 |
| `captain_jump_deep-space` | Miles | 3.84 | 3.25 | 2.15 | -25.6 | -24.0 |
| `captain_jump_jupiter` | Miles | 3.60 | 2.94 | 2.04 | -25.2 | -23.8 |
| `captain_jump_mars` | Miles | 3.52 | 2.98 | 2.01 | -25.6 | -24.2 |
| `captain_jump_saturn` | Miles | 3.44 | 2.87 | 2.09 | -26.0 | -24.2 |
| `captain_jump_uranus` | Miles | 3.76 | 3.17 | 1.89 | -25.7 | -24.0 |
| `captain_names` | Miles | 1.92 | 1.21 | 3.30 | -26.5 | -22.9 |
| `captain_nova` | Miles | 3.60 | 3.02 | 2.64 | -26.6 | -25.4 |
| `kid_eight` | Fennick the Young Elf | 3.36 | 2.76 | 1.81 | -23.0 | -21.5 |
| `kid_two` | Fennick the Young Elf | 2.56 | 1.97 | 2.54 | -23.5 | -21.7 |
| `nova_all_locked` | Zoey | 2.56 | 1.76 | 2.28 | -25.2 | -23.3 |
| `nova_bullseye` | Zoey | 2.00 | 1.14 | 1.76 | -23.7 | -21.6 |
| `nova_dead_on` | Zoey | 1.44 | 0.68 | 2.95 | -24.5 | -21.1 |
| `nova_earth_clear` | Zoey | 2.96 | 2.36 | 2.97 | -23.5 | -22.2 |
| `nova_err_added` | Zoey | 4.08 | 3.46 | 2.31 | -25.9 | -24.3 |
| `nova_err_group` | Zoey | 2.80 | 2.06 | 2.43 | -24.2 | -22.4 |
| `nova_err_over` | Zoey | 3.68 | 3.06 | 2.29 | -25.0 | -23.1 |
| `nova_err_place` | Zoey | 2.32 | 1.62 | 3.08 | -24.7 | -23.3 |
| `nova_err_under` | Zoey | 3.68 | 3.04 | 2.30 | -24.3 | -22.1 |
| `nova_err_unit` | Zoey | 1.76 | 0.90 | 4.46 | -24.6 | -21.3 |
| `nova_err_way_off` | Zoey | 2.88 | 2.25 | 3.11 | -25.2 | -22.8 |
| `nova_err_wild` | Zoey | 2.80 | 2.22 | 2.70 | -24.7 | -22.6 |
| `nova_greet_academy` | Zoey | 3.28 | 2.70 | 3.70 | -24.9 | -23.1 |
| `nova_greet_battle` | Zoey | 2.32 | 1.62 | 3.08 | -25.1 | -23.8 |
| `nova_greet_bay` | Zoey | 3.52 | 2.87 | 3.13 | -24.2 | -22.9 |
| `nova_greet_flashcards` | Zoey | 4.24 | 3.56 | 3.09 | -25.5 | -24.5 |
| `nova_greet_hangar` | Zoey | 3.20 | 2.64 | 3.78 | -23.4 | -22.2 |
| `nova_greet_map` | Zoey | 3.36 | 2.71 | 3.69 | -24.5 | -23.2 |
| `nova_guide_count` | Zoey | 1.68 | 0.99 | 3.02 | -26.0 | -23.6 |
| `nova_guide_fire` | Zoey | 1.76 | 0.99 | 3.03 | -24.8 | -22.2 |
| `nova_guide_type` | Zoey | 1.76 | 0.94 | 3.19 | -28.1 | -25.0 |
| `nova_hi` | Zoey | 4.40 | 3.86 | 2.33 | -22.4 | -21.3 |
| `nova_hold_fire` | Zoey | 4.24 | 3.58 | 2.80 | -23.7 | -22.3 |
| `nova_incoming_short` | Zoey | 1.84 | 1.08 | 1.85 | -26.2 | -23.5 |
| `nova_invite_help` | Zoey | 2.56 | 1.92 | 2.60 | -26.5 | -23.8 |
| `nova_invite_power` | Zoey | 3.84 | 3.21 | 3.11 | -24.0 | -22.4 |
| `nova_jump_asteroid-belt` | Zoey | 3.44 | 2.71 | 3.31 | -23.7 | -22.5 |
| `nova_jump_deep-space` | Zoey | 3.20 | 2.63 | 3.05 | -24.3 | -23.2 |
| `nova_jump_jupiter` | Zoey | 2.96 | 2.36 | 2.96 | -23.8 | -22.7 |
| `nova_jump_mars` | Zoey | 2.88 | 2.37 | 2.96 | -24.0 | -22.8 |
| `nova_jump_saturn` | Zoey | 2.88 | 2.32 | 3.02 | -23.8 | -22.6 |
| `nova_jump_uranus` | Zoey | 3.12 | 2.55 | 2.75 | -24.0 | -22.8 |
| `nova_mirror` | Zoey | 4.08 | 3.47 | 3.46 | -23.6 | -22.4 |
| `nova_mirror_repeat` | Zoey | 4.96 | 4.36 | 2.98 | -22.5 | -22.2 |
| `nova_misfit` | Zoey | 3.36 | 2.76 | 3.26 | -24.3 | -23.1 |
| `nova_perfect` | Zoey | 1.60 | 0.76 | 2.64 | -27.2 | -23.7 |
| `nova_planet_clear` | Zoey | 3.20 | 2.60 | 2.70 | -25.0 | -23.4 |
| `nova_practice_done` | Zoey | 3.28 | 2.65 | 1.89 | -27.4 | -25.9 |
| `nova_sector_no` | Zoey | 2.88 | 2.28 | 2.63 | -26.1 | -24.4 |
| `nova_sector_ok` | Zoey | 1.68 | 0.94 | 2.14 | -27.5 | -24.0 |
| `nova_ships_incoming` | Zoey | 1.76 | 1.00 | 2.00 | -25.9 | -23.5 |
| `nova_show_me` | Zoey | 2.00 | 1.12 | 2.67 | -26.6 | -24.6 |
| `nova_too_few` | Zoey | 2.64 | 1.98 | 2.53 | -24.6 | -22.4 |
| `nova_too_many` | Zoey | 2.72 | 2.16 | 2.32 | -25.3 | -23.1 |
| `nova_zero_ask` | Zoey | 3.20 | 2.64 | 3.78 | -23.0 | -22.2 |
| `nova_zero_each` | Zoey | 3.36 | 2.83 | 2.83 | -24.3 | -22.8 |
| `nova_zero_squads` | Zoey | 3.20 | 2.50 | 3.60 | -22.1 | -20.9 |
| `principal_intro` | Preston | 3.20 | 2.44 | 3.69 | -25.2 | -23.8 |
| `principal_sorry` | Preston | 2.72 | 1.89 | 2.11 | -22.7 | -21.5 |
| `pu_bigsmall` | Zoey | 4.40 | 3.82 | 2.88 | -23.1 | -22.3 |
| `pu_borrow` | Zoey | 4.24 | 3.69 | 2.98 | -22.2 | -21.1 |
| `pu_double` | Zoey | 3.36 | 2.77 | 2.52 | -23.6 | -22.5 |
| `pu_easy` | Zoey | 3.20 | 2.65 | 2.64 | -24.2 | -22.5 |
| `pu_easy5` | Zoey | 3.04 | 2.44 | 3.28 | -24.7 | -22.8 |
| `pu_fast` | Zoey | 3.12 | 2.49 | 2.81 | -23.7 | -22.1 |
| `pu_flip` | Zoey | 3.44 | 2.87 | 2.09 | -25.6 | -24.0 |
| `pu_half` | Zoey | 3.92 | 3.28 | 2.44 | -23.8 | -22.3 |
| `pu_jump` | Zoey | 3.12 | 2.51 | 3.19 | -23.8 | -22.6 |
| `pu_mirror` | Zoey | 4.08 | 3.44 | 2.91 | -21.9 | -21.1 |
| `pu_sector` | Zoey | 3.68 | 3.03 | 2.31 | -25.6 | -23.9 |
| `pu_split` | Zoey | 3.68 | 3.04 | 2.63 | -25.2 | -23.4 |
| `teacher_eight_close` | Hadley | 3.92 | 3.31 | 2.41 | -24.6 | -23.8 |
| `teacher_eight_ok` | Hadley | 3.20 | 2.59 | 1.93 | -24.6 | -23.1 |
| `teacher_intro` | Hadley | 7.20 | 6.59 | 3.19 | -24.4 | -23.8 |
| `teacher_mult` | Hadley | 4.08 | 3.51 | 1.42 | -25.0 | -23.7 |
| `teacher_names` | Hadley | 5.36 | 4.78 | 2.30 | -25.9 | -24.5 |
| `teacher_pick_generic` | Hadley | 2.96 | 2.33 | 2.58 | -25.1 | -24.2 |
| `teacher_proud` | Hadley | 5.12 | 4.49 | 2.67 | -25.8 | -24.8 |
| `teacher_q2` | Hadley | 2.40 | 1.73 | 3.47 | -24.0 | -21.9 |
| `teacher_two_close` | Hadley | 3.68 | 3.06 | 2.28 | -24.8 | -22.8 |
| `teacher_two_ok` | Hadley | 2.24 | 1.45 | 1.38 | -27.9 | -25.3 |
| `teacher_yes` | Hadley | 2.40 | 1.64 | 1.83 | -25.6 | -23.8 |
| `tr_all_total` | Zoey | 2.56 | 1.93 | 3.62 | -23.9 | -23.0 |
| `tr_borrow_brief` | Zoey | 2.96 | 2.28 | 3.07 | -22.4 | -21.1 |
| `tr_carriers_ones_brief` | Zoey | 2.80 | 2.24 | 2.23 | -25.4 | -24.1 |
| `tr_carriers_tens_brief` | Zoey | 2.96 | 2.41 | 2.49 | -25.3 | -24.0 |
| `tr_double2_why` | Zoey | 3.28 | 2.56 | 2.35 | -22.4 | -21.3 |
| `tr_double4_why` | Zoey | 3.84 | 3.28 | 2.13 | -22.4 | -21.4 |
| `tr_half_brief` | Zoey | 2.56 | 1.95 | 3.08 | -22.8 | -21.7 |
| `tr_jump3_why` | Zoey | 2.56 | 1.93 | 4.15 | -23.5 | -22.4 |
| `tr_jump6_why` | Zoey | 2.64 | 1.96 | 4.08 | -23.5 | -22.3 |
| `tr_jump7_why` | Zoey | 2.40 | 1.87 | 3.74 | -22.5 | -21.4 |
| `tr_jump8_why` | Zoey | 2.24 | 1.68 | 4.16 | -23.2 | -22.2 |
| `tr_left` | Zoey | 1.52 | 0.77 | 2.61 | -28.3 | -25.0 |
| `tr_mirror_brief` | Zoey | 3.52 | 2.94 | 3.06 | -23.1 | -22.5 |
| `tr_mirror_each` | Zoey | 4.64 | 4.01 | 3.74 | -23.7 | -22.7 |
| `tr_pods_ask_10` | Zoey | 2.88 | 2.31 | 3.03 | -25.8 | -24.5 |
| `tr_pods_ask_2` | Zoey | 2.80 | 2.26 | 3.10 | -25.1 | -23.6 |
| `tr_pods_ask_3` | Zoey | 2.80 | 2.25 | 3.11 | -25.7 | -24.1 |
| `tr_pods_ask_4` | Zoey | 2.80 | 2.25 | 3.11 | -24.9 | -23.6 |
| `tr_pods_ask_5` | Zoey | 2.88 | 2.31 | 3.03 | -24.6 | -23.0 |
| `tr_pods_ask_6` | Zoey | 2.88 | 2.30 | 3.05 | -26.2 | -24.6 |
| `tr_pods_ask_7` | Zoey | 2.88 | 2.36 | 2.97 | -24.7 | -23.4 |
| `tr_pods_ask_8` | Zoey | 2.88 | 2.31 | 3.03 | -25.2 | -23.7 |
| `tr_pods_ask_9` | Zoey | 2.80 | 2.25 | 3.11 | -24.7 | -23.3 |
| `tr_pods_brief` | Zoey | 2.56 | 1.95 | 3.59 | -23.7 | -22.4 |
| `tr_pods_why` | Zoey | 3.76 | 3.12 | 3.20 | -22.5 | -21.8 |
| `tr_sector_brief` | Zoey | 2.88 | 2.26 | 3.09 | -25.3 | -23.6 |
| `tr_sectors_total` | Zoey | 2.80 | 2.21 | 3.17 | -24.7 | -23.8 |
| `tr_shy19` | Zoey | 2.72 | 2.09 | 3.34 | -24.7 | -23.5 |
| `tr_shy199` | Zoey | 3.04 | 2.42 | 2.89 | -23.7 | -22.6 |
| `tr_shy29` | Zoey | 2.72 | 2.13 | 3.29 | -24.5 | -23.2 |
| `tr_shy9` | Zoey | 2.24 | 1.63 | 4.31 | -22.7 | -21.4 |
| `tr_shy99` | Zoey | 2.80 | 2.23 | 3.13 | -22.8 | -21.6 |
| `tr_tens_ones_brief` | Zoey | 2.96 | 2.40 | 2.50 | -25.1 | -23.8 |
| `tr_total` | Zoey | 1.60 | 0.87 | 3.46 | -25.5 | -23.3 |
| `tr_twin_why` | Zoey | 3.76 | 3.01 | 3.32 | -24.1 | -22.6 |
| `tr_zero_each` | Zoey | 4.80 | 4.22 | 2.85 | -22.9 | -22.1 |
| `unlock_big-small-split` | Zoey | 2.72 | 2.12 | 4.25 | -21.2 | -20.4 |
| `unlock_borrow-take-back` | Zoey | 2.72 | 2.12 | 4.25 | -21.4 | -20.5 |
| `unlock_double-it` | Zoey | 2.16 | 1.49 | 4.69 | -21.4 | -20.1 |
| `unlock_easy-5-10` | Zoey | 2.80 | 2.20 | 4.09 | -22.4 | -21.5 |
| `unlock_empty-mirror` | Zoey | 2.56 | 1.90 | 4.21 | -21.4 | -20.4 |
| `unlock_fast-adding` | Zoey | 2.32 | 1.70 | 4.11 | -23.0 | -21.4 |
| `unlock_flip-it` | Zoey | 2.08 | 1.46 | 4.81 | -21.5 | -19.9 |
| `unlock_half-double` | Zoey | 2.40 | 1.73 | 4.63 | -21.5 | -20.3 |
| `unlock_jump-one-more` | Zoey | 2.64 | 1.97 | 4.07 | -21.8 | -20.9 |
| `unlock_split-and-add` | Zoey | 2.40 | 1.80 | 4.45 | -23.1 | -21.5 |

## Not done

- The greetings on the map, Hangar, Academy, flashcards and bay have clips but `Greeting.tsx` plays none (not this track's file).
- The Empty lesson's first line has no matching clip and says "invader" (`src/rig/tricks.ts`, not this track's file).
- `nova_err_under`, `nova_err_over` and `nova_err_wild` are re-baked as asked, but the arena plays `nova_too_few`, `nova_too_many` and `nova_err_way_off` instead; they stay as entries other callers can use. `nova_incoming_short` and `captain_jump_*` are also still in `BATTLE_LINES` with clips, though the arena now plays `nova_ships_incoming` and `nova_jump_*`.
