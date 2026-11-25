# STATE: mathworld, branch `overhaul/void-and-gold`

_Updated 26 Nov 2026, at the wave 2 sign-off for testing. `main` still holds the previous version, untouched._

## What changed
- **Wave 2 merged**: seven tracks (economy, combat, console, front, places, manual, film), each `--no-ff`, then the seams wired (orbs from the fold, one sign-up, one source for planet words, cards one at a time). Index and seams: `docs/overhaul/README.md`.
- **The teaching layer is mounted** (the audit's "Nothing teaches"):
  - Help is one tap away: the top bar on the Resting Bay, Star map, Hangar and Academy, and How to play in the battle's pause menu, open the Field Manual on the page that fits. Escape closes the manual before the menu.
  - Each hub greets once (`greet:<screen>`); the bay's Nova line is its greeting. Cadet Bay opens with `nova_greet_battle` instead of `nova_l0_intro`.
  - The guided first shot runs on a new cadet's very first wave (Cadet Bay or a planet battle): count, type, Fire, one idea a step, with nothing else talking or scanning meanwhile. The first fleet is `1 × b`, b 3 to 5. The arena exposes `fleetRect()` and `rocketRect()`.
  - "Watch the film again" sits in the Field Manual on the hubs (`/intro?replay&from=…`).
- **Fixes from the walks**: Cadet Bay gets the pause menu and a focusable game root (Enter reopened the menu instead of firing); the bay's Escape no longer closes the table behind a sheet; the film's hangar drops the miss rule (`captain_brief3`, `captain_brief4`); the Academy's intro line waits for the second visit; "Welcome back, {name}" without a question mark.
- Spoken lines to bake: `docs/overhaul/lines-to-bake.md`.

## What is verified
- `bun run check` green (300 tests) and `bun run build` passes at the last commit.
- Browser, muted, on a fresh origin, two brand-new cadets:
  - The film on the answer-a-question path (raise hand by click and Space, answers by click and key 1), Launch pressed, then Cadet Bay: greeting, then "Count the ships." on a ringed 1 × 4, "Type how many." on the digit keys, "Now press Fire." after a digit, gone for good after the shot (`guide:first-shot`, `greet:battle` in the log). Film Skip also lands there.
  - Guide steps placed at 1440 × 900, 375 × 812, 360 × 640, 812 × 375 and 768 × 1024: next to their anchor, off the rocket and its number, never over a control.
  - Pause, How to play (manual on "count"), Escape, Escape, then typed digits and Enter fire.
  - First-visit greetings on the bay (both sizes), Star map, Hangar, Academy, flashcards; none on a return. The Hangar's greeting was seen at the top on desktop; its final narrowing beside the shop was checked by layout, not seen live. Field Manual on each hub at 1440 × 900, 375 × 812 and 812 × 375. Film replay from the bay's manual, Skip back to `/bay`.
  - Returning cadet at 1440 × 900: title, Continue, bay, Launch, three Moon waves, pause, Resting Bay, Star map, Hangar, Academy. No console errors on any route. No sideways overflow on the four hubs at 360 × 640, 812 × 375, 768 × 1024.

## Next, and open risks
- **Wave 3 copy pass and bake**: the rewrites in `lines-to-bake.md` (`nova_hi`'s "calibrate", `captain_brief2`'s four ideas, `nova_err_under`/`over`'s "load", the Captain's "grave danger"). Captions must not change without the clip.
- **Not verified**: reduced motion, real touch and safe areas, audio (muted throughout), the film at true speed, Hyper-Jump, Sector-Lock and warm-ups after the merge, `/admin`.
- **Known rough edges**: the fleet's idle bob still runs during the guide (tiny); a reload before the first shot in Cadet Bay replays the whole film; from the bay a battle starts without its briefing card (sound is already unlocked); fleets of 6 × 7 are about 10–12 px a ship on 360 × 640 and 812 × 375; the Show Me How beat labels ("mirror · 4") read as debug text; the daily patrol screen is not built (`RestingBayScreen` `patrol` slot).
- **Economy risk**: a forged `hyper_jump_taken` still moves progress; the server cannot tell a real answer from a forged one.
- Test cadets exist in the local dev database only.
