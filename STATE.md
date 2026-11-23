# STATE: mathworld

_Updated 24 Nov 2026, Phase 4_

## What changed
- **Commits:** … Phase 3 `e4b874c`, `6c4da9d`, `1475404` · **Phase 4:** `3d919f7` rig, `618f27c` screens, and this commit (STATE).
- **Pure logic, tested** (`tests/hub.test.ts`, 76 tests in all):
  - `director/hub.ts`: ×1–×10 posters from folded mastery, the 5-card flashcard deck (shaky facts first), map stops and Hyper-Jump status.
  - `director/hangar.ts`: the catalogue. The fold now charges the catalogue price, never lets Orbs go below zero, and re-equips owned items for free (`owned` in PlayerState).
  - `rig/academy.ts`: a film fleet and a sister fleet per Trick Card. `rig/warmup.ts` + a new `warmup_answered` event (checked server-side; it never touches multiplication mastery).
- **Screens** (all full-screen game shells; shared `useScene` + `Anchor` pins HUD buttons to 3D points):
  - `/` Title: Solar System fly-through, MATH WORLD, Start Game (unlocks sound, warms Phonon). It routes a returning cadet to `/bay` and a new one to sign-up, then `/intro`. Dev links show only with `?dev`.
  - `/intro`: with no cadet it goes to `/`; with the intro done it goes to `/bay`. After a refresh past the film, it offers Continue into Cadet Bay. The film itself is untouched. Level 0 ends on Enter the Resting Bay, or Fly to The Moon.
  - `/bay`: a cut-away 3D cabin with three doors, the poster wall (Dialog per table), the desk (Trick Cards Dialog leads to the Academy), Quick Flashcards and Switch Cadet. On phones a dock replaces the pinned buttons.
  - `/map`: the planets in a line (wheel, drag, arrows, ◀ ▶), centred on the frontier. Locked planets are dark silhouettes, cleared ones warm with a gold ring. `/play/<locked>` now redirects to `/map` (except `?dev`).
  - `/play/mercury`, `/play/venus`: five addition or subtraction warm-ups on the battle look and keypad.
  - `/hangar`: the intro's hangar with the cadet's own rocket. Preview, Buy and Equip each slot; the blaster test-fires.
  - `/academy`: every film over a live fleet with every line spoken (`academy` mode in `arena.ts`), then the We-Do and a sister fleet. Films give no Orbs.
  - Battles: a ☰ / Escape pause menu (Resume, Solar map, Resting Bay); the end card offers Fly, Solar map and Resting Bay.

## What's verified (Claude_Browser pane, :3200)
- **New cadet:** Title, Start, sign-up, then the intro auto-plays. I jumped to the hangar chapter by script, then Ignite took me to Cadet Bay. Refresh mid-Cadet Bay gave Continue on wave 2/3. Clearing it led to Enter the Resting Bay at `/bay`.
- **Returning cadet:** Start went straight to `/bay`, and `/intro` redirected to `/bay`. Switch Cadet returned to the Title, and `/bay` then redirected there.
- **Resting Bay:**
  - Posters coloured from mastery; the poster Dialog is centred.
  - Flashcards: 7 × 0 answered 0 was accepted; a wrong card showed the answer and moved on; correct cards earned an Orb. The events reached `/api/events`.
- **Warm-ups:** Mercury undershoot ("still flying") and overshoot ("flew past") both showed. A full Venus run went 5/5, shots 1.8–2.5 s.
- **Hangar:** Bought Solar Gold (43 → 13 Orbs); the gold hull showed in the next Moon battle.
- **Moon battle:** 16 shots at 2.5–3.5 s each, ×10 facts included (the pane was hidden, so timings are approximate). The pause menu worked.
- **Academy:** the Split & Add film took 22 s, with 4 lines live Phonon and 1 caption only. Firing mid-film ended it cleanly; the card unlocked onto the belt and Try 8 × 8 worked.
- **Phone 375 × 812:** checked the Title, Bay dock, map and Hangar.

## Next
- Phase 5: Shift+D telemetry, `/admin`, and real-kid testing.

## Open risks
- **Not heard by ear** (the dev env is muted). The Academy relies on live Phonon for most film lines, and the first one or two may be captions only while the model loads.
- **Never played end to end in one sitting:** the full intro film to Cadet Bay. I skipped the middle by script.
- **Bay look:** a diorama with a lot of empty black above and below on wide screens; the posters are small on desktop (the Dialog shows them clearly). Owner's taste call.
- **Map on phones** shows one planet at a time.
- **Unexplained console noise:** two `404` messages with no URL in the console, in every route tried. They are not in the resource timing list.
- **Uncommitted, not ours:** the mute flag in `src/engine/audio.ts`.
- **Carried over:**
  - Real phone, touch and Safari.
  - Deep Space performance.
  - `/play/<unknown>` returns status 200.
  - Deploy, flashcard ceiling, the history rewrite for owner names.
  - Mercury and Venus clips: no Nova lines were baked for them; the warm-ups are silent apart from SFX.
