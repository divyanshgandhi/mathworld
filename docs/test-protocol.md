# Real-kid test protocol (Phase 5)

How to run a silent play test with 3–5 kids aged 8–12 and 1 adult, what to watch, what to log, and how
to read `/admin` before and after. The game measures the maths; you watch the faces.

## Before the day

1. **One URL, one device each.** Use the deployed game (or a laptop on the same network). Each tester
   signs up on their own device; the cadet lives in a cookie on that device. On a shared device, use
   *Switch Cadet* in the Resting Bay between testers.
2. **Sound on.** Headphones per tester if they sit together. Check that Nova speaks on the Title's
   Start Game before anyone arrives.
3. **Turn on `/admin`.** Set `MW_ADMIN_KEY` (10+ characters) in the server environment, open
   `/admin`, enter the passphrase, and screenshot the players table: that is your **before** state.
   Note which cadet names already exist so you can tell testers apart.
4. **Print the log sheet** (below), one per tester.
5. **Consent.** A parent or guardian agrees to the test and to you writing notes. Use first names or
   nicknames only, never surnames, in the game and in your notes.

## The session (about 20 minutes per tester)

| Minute | What happens | You |
| --- | --- | --- |
| 0–1 | "This is a space game. Play it however you like. I can't help, but I'm curious what you think." | Say nothing else about maths. |
| 1–5 | Title → sign-up → intro film → Cadet Bay (Level 0) | Silent. Time how long the film holds them. |
| 5–15 | Resting Bay → map → The Moon and beyond, at their own pace | Silent. Log every friction point. |
| 15–18 | Free choice: Hangar, Academy, flashcards, more battles | Watch what they pick first. |
| 18–20 | Three questions (below) | Write their words down exactly. |

**Stay silent.** Do not point, explain a trick, read a sum aloud or say "try Show Me How". If a tester is
stuck for more than about 60 seconds with no idea what to do, say only "What do you think you could
try?" and log it as a friction point. That stuck moment is the data.

**The adult** plays the same 20 minutes after the kids, alone. Adults find different friction (reading
speed, impatience with the film, Hyper-Jump) and they set the ceiling for "too slow".

**The X-Ray.** On a second screen or after the session, Shift+D in any battle opens the Live
Telemetry X-Ray: the fleet's mastery (EWMA), the error in play, the transfer queue and the session's
Transfer Rate. Don't open it on the tester's screen while they play.

## What to watch

- **The numbers.** Do they read the big `a × b` plate first, or count ships? Do they say the sum aloud?
- **Show Me How.** Do they tap it on their own, or only get it on the third miss? Do they watch the
  lesson or fire straight through it? Do they get the We-Do right?
- **The sister problem.** About two waves after a lesson the director serves a sister fact that uses
  the same trick. Does the tester use the trick (a Power-Up from the belt, or the shape of the fleet)?
- **Speed.** Any moment where they wait and look away: a shot, a line, the film. Note the second count.
- **Power-Ups.** Do they find the belt? Do they try a trick that doesn't fit?
- **Mood.** Smiles, sighs, "again!", "this is boring", leaning in, leaning back. Who wants to keep going.
- **0 and 1.** Do zero-ship fleets confuse them? Does anyone answer 0 correctly?

## The log sheet

One row per moment, written as it happens:

| Time | Where (screen / planet / fact) | What they did or said (their words) | Friction? (1 = annoyed … 3 = stuck) |
| --- | --- | --- | --- |
| | | | |

At the end, three questions, answers written down word for word:

1. "What was the best bit?"
2. "What was annoying or confusing?"
3. "Would you play again tomorrow?" (and then check: did they? see Day 2 below)

## Reading `/admin`

Open `/admin` after the session (**after** state) and compare with the **before** screenshot.

- **Players table.**
  - *Transfer checks*: the north star. Of the sister problems served after a Show Me How, how many
    were solved on the first try, unassisted or with a Power-Up.
  - *First try: before → after a lesson*: first-try accuracy on fleets whose trick had not been
    explained yet, against fleets whose trick had. A good session moves the right-hand number up.
  - *Day 2*: `Day 1` on the test day; `Day 2: not back yet` the next day; `returned · day N` when they
    came back on their own; `did not return` once Day 2 has passed.
- **One cadet** (click the name):
  - *Fact mastery*: the 0–10 × 0–10 heatmap (EWMA × 100; sky practising, mint understood, gold).
    Holes in ×6–×9 are expected on a first day. A row that stays sky after several waves is a fact to
    watch.
  - *Planets*: facts met, mean mastery and Gold facts per planet.
  - *Transfer rate*: the same rates by trick, then the sessions (a gap of 30+ minutes starts a new one).
  - *Event timeline*: every shot with the guess, the error type, the latency and any radar, Power-Up or
    transfer check. Line it up with your log sheet's times to see what the game saw at each friction
    point.

Fewer than about 5 transfer checks per tester is too few to call a rate; report the counts
(`3/4`) rather than the percentage.

## After the day

1. Pick the **top 3 friction points** across all testers (frequency × severity from the log sheets).
2. Fix them one at a time, each in its own commit, with the before → after in the message.
3. Write the field notes into `README.md` → *Field notes*: date, testers (age, no names), the top 3,
   what changed, and the `/admin` numbers before and after (transfer checks, before → after a lesson,
   Day-2 returns).
4. Check `/admin` again the next day for Day-2 returns, and add them to the notes.
