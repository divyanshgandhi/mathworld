# Teaching: the first five minutes

This is the script for a brand-new 8-year-old: what they see, in order, the one new idea each step adds, and how the game shows it instead of saying it. It was written against the real flow on branch `overhaul/void-and-gold` (wave 2 start). The flow was read from these files:
- `src/worlds/space/intro.ts` and `public/vo/vo.json` for the film and its lines;
- `src/worlds/space/cadetBay.ts`, `src/worlds/space/arena.ts` and `src/director/next.ts` for the first battle;
- `src/components/battle/BattleHud.tsx` for the battle's words;
- the hub screens.

The parts that teach are in `src/teach/` (logic and copy) and `src/components/teach/` (components). How to mount them is in `docs/overhaul/w2-manual.md`.

## The budget

Every step follows these rules. `src/teach/words.ts` and `tests/teach.test.ts` enforce the numbers.

| Rule | Limit |
| --- | --- |
| New ideas per step | One. Never two at once. |
| Caption length | 12 words at most, in plain words a Grade 3 reader knows. |
| Time on screen | At least 1.5 s plus 0.3 s a word (`readMs`). "Count the ships." stays at least 2.4 s. |
| Motion | Nothing else moves for attention while an instruction is up. Voice, caption and animation never compete. |
| Waiting | No wait longer than about 5 s with nothing to do. |
| Order | Show it first, in the world. Words come second, or not at all. |

## The script

### Part 1: the film (owned by the film track)

The film tells a story. It should teach only one game idea: you answer by pressing.

| # | What they see | The one new idea | Shown, not told | Words on screen |
| --- | --- | --- | --- | --- |
| 1 | Earth from orbit, then a dive into a town | This is our world | A slow fly-in, with one title card | "Earth" / "An ordinary blue planet" |
| 2 | A classroom. The teacher asks 4 + 4 | You answer by pressing | A big "Raise your hand" button, then two answers to tap | "Know the answer? Put your hand up." |
| 3 | The board says Multiplication | Today is about times | The word on the board | the teacher's line |
| 4 | A knock. The Captain asks for five cadets, and the teacher calls your name | You are a cadet | You stand up. The card reads "Cadet <name>" | the Captain's lines |
| 5 | The hangar: your rocket, and Nova | Nova is your helper | Nova flies in to the front of the shot | "Hi! I am Nova, your co-pilot." |
| 6 | Launch | Off you go | The one glow of the film. The card reads "Cadet Bay" | "Launch" |

The film should not explain plasma balls, squads or misses. The battle shows them a minute later, which is better than any line.

### Part 2: the first battle, Cadet Bay

| # | What they see | The one new idea | Shown, not told | Caption | Time |
| --- | --- | --- | --- | --- | --- |
| 7 | The fleet warps in above Earth. Nova greets them | You are here to clear ships | The ships fly in as rows with gaps, one tone per row and a leader at the start of each | Greeting: "Let's clear these ships, cadet!" | 3.9 s, then it goes |
| 8 | The fleet is ringed and the rest dims | Count the ships | A hairline ring round the fleet. The rows are already the squads: nobody says "squad" yet | Guide: "Count the ships." | 2.4 s at least |
| 9 | The keypad is ringed | Type the number | Ring and cut-out round the keypad. The keypad was live all along | Guide: "Type how many." | until a digit |
| 10 | The first digit appears on the rocket's nose and on Fire | Fire sends that many plasma balls | "Fire 4" on the button and "4" on the rocket. Fire is ringed | Guide: "Now press Fire." | until Fire |
| 11 | The volley | One plasma ball for each ship | Each ball flies to one ship and pops it | none | the volley |
| 12a | Right answer: the fleet is gone | You did it | Every ship pops. "Dead on" appears, with orbs | Nova: "Dead on!" | 1.4 s |
| 12b | Too few: some ships are still flying | The miss shows the error | The ships that no ball reached stay, and they are easy to count | Nova: "Too few! Some got away." (the strip says how many, and "Try again.") | 2.7 s |
| 12c | Too many: some balls fly past | The miss shows the error | The extra balls fly on past the fleet into space | Nova: "Too many! Some flew past." | 2.7 s |
| 13 | Wave 2, with no guide. A miss brings the squad scan, then the each scan | Ships come in squads | The scan counts the rows aloud. This is the first time the word "squad" appears, as a hint | the hint ladder's lines | per the ladder |
| 14 | A third miss, or tapping it | Help is always there | Show Me How sits on the console from the start. The ladder starts it by itself on miss 3 | Nova: "Watch this, cadet." | the lesson |
| 15 | A Power-Up lands on the belt after its first Show Me How | Power-Ups change the shape | The trick acts on the live fleet: the same ships, an easier shape. Its slot pulses; there is no card (fix pass) | "Flip It is on your belt now!" | 3 s |
| 16 | A first-try right answer | Orbs | The orb count goes up by the amount on the chip | "+3 orbs" on the chip | with step 12a |
| 17 | Earth clear | The next planet opens | The clear card names the Moon; Fly to the Moon is the one primary | "Earth is clear" / "The Moon is open" | until a tap |

Steps 13 to 16 happen when the player needs them, not on a timer. A player who never misses meets them later.

### Part 3: the hubs, first visit

Each hub greets the player once (`<Greeting>`, seen key `greet:<screen>`). The line says what the place is for and the one thing to do there. It never blocks a tap, and it goes on the first action.

| Screen | Seen key | First-visit line | Time |
| --- | --- | --- | --- |
| Resting Bay | `greet:bay` | "This is your Resting Bay. Press Launch to fly." | 4.2 s |
| Star map | `greet:map` | "Tap a planet. Win there to open the next one." | 4.2 s |
| Hangar | `greet:hangar` | "Spend your orbs here to change how your rocket looks." | 4.5 s |
| Academy | `greet:academy` | "Pick a trick. I will show it on real ships." | 4.2 s |
| Flashcards | `greet:flashcards` | "Type the answer. There is no timer, so take your time." | 4.8 s |
| First battle | `greet:battle` | "Let's clear these ships, cadet!" | 3.9 s |

Help is one tap away everywhere: the top bar's help button opens the Field Manual (`<FieldManual>`) on the page that fits the screen.

### Part 4: the tours (review round, decision 8)

A tour is a spotlight: the screen dims, one control shows through a rounded cut-out with a gold hairline ring, and Nova says one line of ten words or fewer beside it. "Next" moves on, "Skip" ends it, Escape skips, Enter goes on. Four steps at most, one idea a step. Each is shown once (seen key `tour:<id>`, recorded when its first step shows, so a skipped tour is still seen) and can be replayed from the Field Manual's first item, "Show me around". The tours live in `src/teach/tour.ts`; the component is `Tour` (and the drop-in `ScreenTour`) in `src/components/teach`.

**The rule: a tour introduces nothing the screen has not already shown.** It names controls that are on screen now, in the glossary's words (`docs/glossary.md`). It never explains a game idea (squads, misses, tricks): the battle shows those. A step whose control is not on screen is skipped; a tour with nothing on screen does not show and is not marked seen.

Where each tour sits in the first five minutes:

| When | Tour | Steps (anchor: line) | Why here |
| --- | --- | --- | --- |
| ~2:30, first arrival at the Resting Bay, after the film and the first battle | `bay` | `bay-launch`: "Press Launch to fly your next mission." / `bay-tables`: "Your times tables. Dots fill in as you learn." / `bay-places`: "More places to visit." / `orbs`: "Orbs. You win them by learning." | The first calm screen. The player has just won orbs and met a times table, so every step names something they have already seen happen. Nova's in-page line still says hello; the floating greeting is gone. |
| ~3:30, before the second wave of the first planet battle | `battle` | `powerups`: "Power-Ups help with tricky fleets." / `help`: "Stuck? Nova shows you how." / `dots`: "Win these to clear the planet." / `pause`: "Need a break? Pause here." | After the guided first shot (never with it) and between waves (never during a wave's action). The game holds still (`hold.on("tour")`). One shot has been fired, so the controls around Fire are what is new. |
| First visit to the Star map | `map` | `map-planet`, `map-next`, `map-dots`, `map-launch` | The map is a pager; the tour shows where the next planet is and where Launch is. |
| First visit to the Hangar | `hangar` | `hangar-list`: "Looks for your rocket." / `hangar-rocket`: "Tap one to try it on." / `hangar-buy`: "Buy it with orbs." | The player has orbs by then; try-on is free, buying is the dock. |
| First visit to the Academy | `academy` | `academy-list`: "Every trick, shown with real ships." | One step: the list is the whole screen. |

A screen with a tour shows the tour, not its greeting (`Greeting` renders nothing for `bay`, `map`, `hangar` and `academy`). The Flashcards and the first battle in Cadet Bay keep their greetings: they have no tour.

When it starts: once the screen has settled (no dialog, card or sheet open for 0.6 s, the guided first shot not running) and at least one of its controls is on screen. One tour a visit at most: a screen mounts one tour and it decides once. If a card opens over a tour, the tour closes. Under reduced motion the ring and plate cut from step to step instead of moving.

## Left for later, on purpose

These come in when the player needs them, never in the first five minutes:
- **Gold.** The word arrives when the first fact turns Gold, or on the manual's last page. The bay's marks show it without words first.
- **Spending orbs.** The Hangar greets them when they first go there.
- **Tricks by name, and the Academy.** A trick is met first in battle, as a Power-Up after its Show Me How.
- **Big ships.** Pods of ten, carriers, Battle Sectors and Hyper-Jumps belong to later planets.
- **The warm-ups, flashcards and the daily patrol.**
- **The mastery words** Got it, Learning and New. They appear on the bay's tables with the marks.

## Where today's flow breaks the budget

This is what I saw in the code and the baked lines, not in play. Each item names the owner.

**Status after mounting (wave 2 sign-off).** Fixed: 4 (the greeting replaced `nova_l0_intro`), 5 (the first fleet is `1 × b`), 6 (the console shows structure only from the hint ladder), 8 (no empty-fleet line on the guided wave), 9 in part (no Nova line or first-sight scan during the guide; the fleet's idle bob, about 0.015 units, still runs), 10, 11, 12 (the Hangar's line is child size now), 13 (the Academy's line waits for the second visit), 14, 7 in battle (fix pass: "Ships incoming!", "Too few! Some got away.", "Too many! Some flew past." are new caption-first lines; the Radar lines are no longer played). Also from the fix pass: a new cadet meets no empty fleet until two Earth fleets are cleared, so zero and "squads" never arrive together. The film's hangar no longer tells the miss rule (part of 1). Open, because they need a re-bake: 1 (`captain_brief2`), 2, 3, 7 (see `docs/overhaul/lines-to-bake.md`).

1. **The hangar briefing teaches four ideas by telling** (film). `captain_brief2`:
   - it is 30 words in 4 sentences, with 11.9 s of audio;
   - its ideas are a spaceship, a co-pilot, plasma balls, and too few or too many;
   - it uses retired or hard words: "squadron", "plasma cells", "invaders", "burn extra fuel".

   Cut it to one idea ("This is your rocket.") and let the battle show the rest.
2. **Nova's first line has jargon** (film). `nova_hi` has 17 words and says "calibrate every shot dead on". Try "Hi! I am Nova, your co-pilot."
3. **The Captain's lines are above Grade 3** (film). `captain_danger` has 19 words in 3 sentences and uses "grave danger" and "enrolling". `teacher_intro` has 21 words. Story lines can run longer than instructions, but each caption is still over 12 words.
4. **The first battle opens with three ideas at once, and a long wait** (combat). `nova_l0_intro` has 19 words: "Drones fly in squadrons. Count every drone, load that many plasma balls, and fire!"
   - It asks the player to count, to load and to fire.
   - It uses two retired words, "squadrons" and "load".
   - The keypad stays locked until the line ends. The fly-in (0.75 s) plus the line (7.3 s) is about 8 s with nothing to do.

   Replace it with the `greet:battle` line, and let `FirstShotGuide` teach the shot.
5. **The first fleet can be empty** (combat, `src/director/next.ts`). Cadet Bay serves tier 0 (`× 0` and `× 1` facts), and the first wave is the "weakest" fact, tie-broken by a hash. So a brand-new player can meet 0 × b as the very first fleet, and "Count the ships." would point at nothing. Ask: the very first wave of a new player is 1 × b with b from 3 to 5. Empty fleets come after the first shot has resolved.
6. **The plate prints the structure from the first frame** (console). `BattleHud` shows "N squads · N drones each" on every wave. That tells the player what the formation should show, and it breaks decision 2. The console rebuild removes it.
7. **Retired words in battle lines** (combat):
   - "Squadrons incoming!" (`nova_incoming_short`, `nova_incoming`);
   - "Load a few more" and "Load a few less" (`nova_err_under`, `nova_err_over`; "a few less" should be "fewer");
   - "Radar is up" (`nova_err_wild`, `nova_radar`, `nova_invite`), although the Radar is gone (decision 1);
   - "Trick Power-Up" (`nova_hold_fire`).

   Suggested lines are under "Lines to bake" in `docs/overhaul/w2-manual.md`.
8. **Two lines can queue on the first wave** (combat). After the intro line, `nova_zero_squads` or `nova_zero_each` is queued on an empty first fleet. That puts two voices and two ideas in a row before the player can act.
9. **Things move while the guide is up** (combat). The fleet's idle drift and any queued Nova line run during the guide. Ask:
   - hold Nova's lines while `guide:first-shot` is unseen and a guide step shows;
   - keep the fleet's idle motion at rest until the first digit.
10. **The Resting Bay says "Welcome back" on a first visit** (front). Its Nova line is "Welcome back, <name>!" even on the very first visit. The bay's own "How to play" dialog runs 27 words in one sentence, below child size. `FieldManual` replaces it.
11. **The pause menu's "How to play" is three paragraphs of text** (console). Replace it with a button that opens `FieldManual` on the `count` page.
12. **The Hangar's only explanation is small** (economy). "Earn Orbs by clearing waves. They are never lost." is set at 13 px, under child size, with "Orbs" capitalised mid-sentence.
13. **The Academy opens on a long paragraph** (places). It is 26 words and uses "battle belt". The `greet:academy` line covers it.
14. **Flashcards still show orbs earned** (economy). The deck-done card says "+N orbs", but decision 5 says flashcards pay no orbs.
