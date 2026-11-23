# Math World — End-to-End Product & Engineering Specification

**Math World** is a space-themed multiplication game for kids (Grade 3+) that also scales seamlessly for older learners and adults (from `0 × 0` up to unbounded multi-digit problems like `5-digit × 3-digit`).

Every architectural and pedagogical choice below is locked. Build against this document directly; do not invent alternative progression systems, generic quiz UIs, or unscripted AI explanations.

---

## 1. Core Design Philosophy

1. **The answer is the action.** A player loads `N` plasma cannonballs to clear an enemy formation of `a × b` ships.
   - **Too few (`N < a × b`):** Cannonballs pop ships sequentially; the remaining ships stay hovering and winking with the exact remaining count. The player physically sees how many are left.
   - **Too many (`N > a × b`):** All targets saturate, and the `N − (a × b)` extra plasma balls visibly fly past the fleet into deep space with a `+extra` badge; shields shimmer back on so the player calibrates.
   - **Exact (`N === a × b`):** Clean sequential wave clear, bloom burst, Orbs awarded, ship advances.
2. **Zero punishment, zero streak anxiety.** There is no Game Over, no brittle streak counter that snaps to 0, and no ticking countdown timer on screen. Progress only ratchets upward (unlocked planets, lit times-table posters, collected trick cards, permanent Orbs & Hangar upgrades).
3. **Three-step agency (`I Do` → `We Do` → `You Do`):**
   - **`I Do` (`Show Me How`):** Nova freezes time, dims the battlefield, and walks through a named trick beat-by-beat with voice + visual animation, ending on a 1-tap finish by the player.
   - **`We Do` (Tactical Trick Power-Ups):** Once a trick is learned, it mounts on the rocket's Tactical Belt as a **free, unlimited power-up**. Firing it at a live battalion visually slices, rotates, or projects ghost ships *without revealing the answer*, so the player does the mental math themselves.
   - **`You Do` (Mental Fluency):** Solving unassisted & fast lights that fact up **Gold** on the player's Resting Bay Times-Table Posters and awards maximum Orbs.
4. **Pedagogy grounded in research:** Follows Bay-Williams & Kling's *Foundational → Derived → Mastery* sequence and Pam Harris's *Problem Strings* (waves are sequenced so anchor facts lead into derived neighbors) plus *Relational Thinking* across all 5 multiplication properties (Zero, Identity, Commutative, Distributive, Associative).
5. **Code owns math & truth; AI writes words only.** All partial products, splits, answers, and mastery calculations are pure deterministic TypeScript in `src/rig/` verified by unit tests. No LLM ever generates raw canvas code or unverified math.
6. **One world perfected first, extensible by contract.** Ship **Space** to 10/10 polish behind the `WorldPack` boundary (`src/worlds/space/`) so future worlds (Dragons, Bakery, Custom Interest) swap visuals/story without touching `src/rig/`, `src/director/`, or `src/db/`.

---

## 2. Full User Journey & Screen Architecture

### 2.1 Preloader → Title Screen (`/`)
- **Preloader:** Brief smooth load pass initializing Three.js assets and pre-baked static intro audio (`public/vo/`).
- **Title Screen (`MATH WORLD`):** Live 3D camera drifting smoothly past a glowing bloom-lit Sun and orbiting planets. Single bold title **`MATH WORLD`** and one primary button: **`Start Game`**.
- **Audio Autoplay Unlock:** Clicking **`Start Game`** immediately calls `unlockAudio()` (resuming `AudioContext`) AND silently starts loading the client-side `phonon-tts` Web Worker in the background so voice is warm and cached by the time gameplay starts.

### 2.2 Auto-Magic Returning Player Routing (Cookie + DB)
On clicking **`Start Game`**:
- Check cookie `mw_cadet_id` against Postgres `players` table:
  - **Returning player (`introCompleted === true`):** Goes **directly to the Resting Bay (`/bay`)**. The intro movie never replays and needs no cluttered "Skip" button.
  - **New player:** Shows a crisp 1-card Cadet Sign-Up (**Name + Avatar picker**) → creates `player` row + sets `mw_cadet_id` cookie → launches directly into the **Intro Film (`/intro`)**.
- **Demo / Sibling Profile Switch:** Place a small, unobtrusive **"Switch Cadet"** button in the corner of the Resting Bay (never on the intro film) so multiple kids on one device—or reviewers testing both new and returning flows—can switch/create profiles cleanly.

### 2.3 New-Player Intro Film (`/intro` — Target ≤ 25–30 seconds total)
Tightened cut of the existing Three.js film in `src/worlds/space/intro.ts`:
1. **Quick Earth → School Transition (~4s):** Keep the Earth-to-school dive punchy (trim the 15s prelude down to ~4s so the kid wakes up fast).
2. **Sleepy Tuesday Classroom (`film` ↔ `play`):**
   - Teacher: *"Class, now you've learned addition and subtraction. As we all know, `4 + 4` is… who's going to tell me?"*
   - **5-second interactive Raise Hand (`SPACE` / Tap / Choice):** Player answers if they press in time; otherwise a classmate answers *"8!"* automatically (zero failure, zero stall).
   - Quick subtraction beat: *"And what's `5 − 3`?"* (same 5-second interactive hand-raise).
3. **The Knock & Cadet Selection (~10s):**
   - Teacher: *"Okay class, today we're starting multiplication…"*
   - **KNOCK! KNOCK!** Door opens outward, golden hallway light floods the muted room, Principal + Captain walk in.
   - Captain: *"There is grave danger in space. We are enrolling five of your brightest students as cadets."*
   - Teacher reads 4 classmate names (`Maya… Leo… Aarav… Zoe…`), pauses, looks at the player, and calls **`[Player's Name]!`** (never generic `"you"` when name is known).
4. **Smash Cut → Starfleet Hangar & Captain's Briefing (~8s):**
   - Transition from flat classroom lighting into bloom-lit Space Hangar.
   - **Captain's exact briefing script:**
     > *"Welcome, cadets. You are going to be the protectors of Earth against enemies in space. You have a spaceship, you have your co-pilot, and you have plasma balls which you will use to destroy enemies. Remember—plasma cells are precious. Too few and drones slip past; too many and we burn extra fuel. Nova here is your co-pilot; together you'll calibrate every shot until it's dead-on."*
5. **Level 0 Tutorial (Earth · Cadet Bay):** 3 fast, joyful shots teaching `×0` and `×1` (remember: `0` MUST be accepted as a valid shot!). Completing Level 0 emits `intro_completed`, unlocks **The Moon**, and flies the player into the **Resting Bay** (or straight to the Moon with a 1-tap launch).

### 2.4 The Resting Bay (`/bay` — Returning Player Hub)
Returning players always land in their cozy Starfleet cabin overlooking the Solar System. Everything lives diegetically in the room (not a sterile settings menu):
1. **Wall Times-Table Posters (`×1` through `×10` / `×12`):**
   - Neat wall-mounted multiplication tables.
   - Every canonical fact lights up live from the player's event-folded mastery:
     - **Dim slate:** Unseen
     - **Sky blue:** Practicing (`m < 0.55`)
     - **Mint:** Understood (`0.55 ≤ m < 0.82` — solved with tricks/careful thinking)
     - **Gold:** Instant Fluency (`m ≥ 0.82` + at least 1 fast unassisted solve)
   - Clicking any poster inspects that table cleanly.
2. **Desk Surface — Collected Trick Cards & Quick Flashcards:**
   - **Trick Cards:** Every named trick the cadet has visited/unlocked sits on the desk; tapping any card opens its Imbibe trick walkthrough.
   - **Quick Flashcards:** A low-pressure 5-card recall deck pulled from the cadet's recently learned / shaky facts (earns bonus Orbs, builds instant recall without timers or streak loss). A fast, correct card gives the fact a gentle mastery nudge (§5.3), so a Mint fact can polish to Gold; cards never count toward missions, planet clears or Hyper-Jumps.
3. **Three Doors / Navigation Exits:**
   - **Launch to Space (`/map` → `/play/[planet]`):** Opens the **Scrollable Solar System Level Selector**.
   - **The Hangar (`/hangar`):** Spend collected **Orbs** on live-rendered ship upgrades.
   - **The Academy (`/academy`):** Watch/replay the interactive **Trick Films** (plus quick Addition/Subtraction warmups).

### 2.5 Scrollable Solar System Level Selector (`/map`)
All planets lined up across a horizontally scrollable 3D/parallax starfield (touch swipe, mouse wheel, arrow keys), centered on the cadet's current frontier planet:
- **Before Earth (Inner Warmup Planets):**
  - **Mercury:** Quick Addition warmup (up to 20) — lightweight interactive drill reusing the core stage & keypad.
  - **Venus:** Quick Subtraction warmup (up to 20) — lightweight interactive drill reusing the core stage & keypad.
- **Multiplication Frontier (Earth Outward):**
  - **0. Earth · Cadet Bay (`T0`):** `×0`, `×1`
  - **1. The Moon (`T1`):** `×2`, `×5`, `×10`
  - **2. Mars (`T2`):** `×3`, `×4`
  - **3. Asteroid Belt (`T3`):** `×6`, `×7`, `×8`, `×9` (including Perfect Squares `6×6`–`9×9`)
  - **4. Jupiter (`T4`):** `2-digit × 1-digit` (`12–99 × 2–9`)
  - **5. Saturn (`T5`):** `2-digit × 2-digit` (`12–99 × 11–99`)
  - **6. Uranus (`T6`):** `3-digit × 1–2 digit` (`105–999 × 3–99`)
  - **7. Neptune / Deep Space (`T7+`):** Unbounded open-ended frontier (`3d×3d` → `4d×2d` → `4d×3d` → `5d×3d` → endless sectors!)
- Locked outer planets appear as glowing silhouettes ahead; cleared planets shine warmly with a replay button.

### 2.6 The Hangar (`/hangar` — Retention Without Streaks)
Permanent **Orbs** earned on every cleared wave (never lost) buy **3 live-rendered ship upgrade slots** that immediately change the actual 3D rocket & weapon VFX in `ships.ts` and `wave.ts`:
1. **Hull & Paint:** Cadet White (starter) → Solar Gold → Nebula Violet → Obsidian Stealth.
2. **Blaster FX:** Plasma Ball (starter) → Twin Plasma → Ion Arc → Nova Beam.
3. **Thruster Trail:** Amber Flame (starter) → Cyan Ion → Starlight Comet.

---

## 3. Visual Units & Base-10 Ship Collection Taxonomy

Multiplication is **always** shown visually as **`Attack Lanes (rows) × Ships Per Lane (columns)`**, with explicit on-screen axis labels (`3 squads` on left, `8 fighters each` on top) so rows vs. columns are never ambiguous.

To scale cleanly from `3 × 4` up to `5-digit × 3-digit` without breaking the Space metaphor into abstract rectangles, all enemy ships follow a **4-Tier Base-10 Fleet Taxonomy** implemented in `src/worlds/space/ships.ts`:

| Value | Ship Class | 3D Silhouette & Color (Clay + Ink Outline + Selective Glow) | Visual Intuition |
|---|---|---|---|
| **`1`** | **Fighter** | Existing green/amber clay saucer with cyan glowing eyes (`makeInvader`) | Countable 1-by-1 |
| **`10`** | **Squadron Pod** | Elongated cyan twin-rail formation pod visibly holding **`2 × 5` micro-fighters** inside + crisp `10` hull emblem | Literally shows 10 fighters packed in one pod; partial hits pop exact micro-fighters (`5` of `10`!) |
| **`100`** | **Carrier** | Heavy violet twin-deck cruiser visibly holding **10 glowing cyan `10`-strips** + crisp `100` emblem | Clearly `10 × 10 = 100` ships |
| **`1,000`+** | **Dreadnought** | Massive gold/crimson flagship with reactor rings + `1K` / `10K` core badge | Extends cleanly to `4d` / `5d` battles |

### Formation Layout by Scale
1. **Single-Digit (`T0–T3`, e.g., `3 × 8`, `4 × 9`):** `rows` lanes × `perRow` Fighters (`1`s).
2. **`2-Digit × 1-Digit` (`T4`, e.g., `6 × 24`):** `6` lanes, each lane holds **2 Squadron Pods (`20`)** on the left + **4 Fighters (`4`)** on the right.
   - Firing `120` clears all 12 Squadron Pods and leaves all **24 Fighters hovering & winking** on the right.
   - Firing `105` clears 10 Squadron Pods + **5 micro-fighters inside the 11th Pod**.
   - Firing `180` saturates all 144 ships and shoots **`+36` extra orange plasma balls** visibly past the armada into deep space.
3. **`2-Digit × 2-Digit` (`T5`) through `5-Digit × 3-Digit` (`T6–T7+`) — Tactical Sector Armada:**
   - Both axes group by place value (e.g., `24 × 16` = top `20 | 4` × left `10 | 6`), rendering **4 Battle Sectors** (`2 Carriers = 200`, `4 Pods = 40`, `12 Pods = 120`, `24 Fighters = 24`).
   - **Two ways to defeat:**
     - **Direct Ace Shot:** Type the full product (`384`) and fire one mega-volley across all sectors.
     - **Sector-Lock Mode (via `[Big & Small Split]` Power-Up):** Tap each Battle Sector to enter its sub-product (`200`, `40`, `120`, `24`), lighting up and summing each sector on screen into the final plasma lock—making `342 × 26` or `12,450 × 134` genuinely fun without paper!

---

## 4. Gameplay Mechanics: Input, Scaffolding, Power-Ups & `Show Me How`

### 4.1 Input Ergonomics (Desktop + Mobile/Tablet Parity)
- **Desktop:** Full physical keyboard support (`0–9`, `Backspace`, `Enter` to fire, `Space` for intro hand-raise).
- **Mobile / Tablet:** Set `inputMode="none"` on the display readout so the OS virtual keyboard never covers the 3D arena; render a chunky built-in cockpit number pad right below the canvas.
- **Critical Edge Cases:**
  - **`0` MUST be a valid submittable answer** (for Level 0 `×0` problems — never reject `num <= 0`!).
  - **Anti-Mash Guard:** Lock input while a volley is in flight. If 3 wild misses occur in `< 4s`, Nova smiles: *"Hold fire, cadet! Take a breath—try slicing this fleet with a Trick Power-Up."* (In play a shot takes ~3–4 s end to end, so the client counts 3 wild misses within 12 s, each fired within 4 s of the fleet being ready.)
  - **Shot budget:** no single shot takes more than 5–10 s from fire to ready again (volley capped at ~1.5 s, outcome ~1 s, one short Nova line, ~0.4 s shield regroup). Numbers of 10 and up are Base-10 ships, never dozens of single fighters.

### 4.2 Progressive Wrong-Answer Escalation (No Freezing, No Nagging)
1. **Miss #1 (Close, `|guess − answer| / answer ≤ 0.25`):**
   - Physical undershoot/overshoot plays out in 3D + 1 short Nova line (using the **Error Classifier**: e.g., if they entered `a + b`, Nova says *"Careful—that added `3 + 8`, we have 3 squads of 8!"*).
   - Keep free input open so the kid gets the thrill of self-correcting.
2. **Miss #1 (Way Off, `> 0.35`) OR `> 10s` idle hesitation:**
   - Quietly slide in **4 Targeting Radar choices** below the keypad (1 correct + 3 plausible distractors from the error classifier: `a + b`, `a × (b ± 1)`, nearby multiple).
3. **Miss #2:**
   - Nova invites warmly: *"This squad is sneaky! Fire the **[Trick Name]** power-up, pick from Radar, or tap **Show Me How**."*
4. **Miss #3 (or anytime player taps `Show Me How`):**
   - Launch embedded in-world **`Show Me How` (`I Do`)** right over the live 3D fleet.
5. **Always finish with agency:** Every wave ends with the player themselves tapping/firing the winning shot.

### 4.3 Live Tactical Trick Power-Ups (`We Do`)
Once a trick is unlocked (via Academy or first `Show Me How`), it appears as a **free, unlimited button** on the rocket's Tactical Belt during battle:
- **`[Flip It!]`:** Smoothly rotates the 3D formation 90° (`8 × 3` → `3 × 8`).
- **`[Double It!]`:** Highlights half the rows and pulses the mirror double (`4 × 7` → two halves of `2 × 7`).
- **`[Split & Add]`:** Fires a golden laser beam slicing column 5 from the rest (`3 × 8` → `3 × 5` cyan + `3 × 3` amber) *without revealing `15` or `9`*.
- **`[Borrow & Take Back]`:** Projects glowing dashed ghost invaders onto `×9` / `×19` / `×99` rows to form a clean `×10` / `×20` / `×100` visual.
- **`[Big & Small Split]`:** Slices between Squadron Pods / Carriers and Fighters (or unlocks **Sector-Lock Mode** on `2d×2d`+).
- **Strategy-Selection Coaching:** If a player activates a trick that doesn't fit the current problem (e.g., `[Borrow & Take Back]` on `3 × 4`), Nova grins: *"That one's magic on 9s—try `Fast Adding` or `Double It` here!"*

### 4.4 Embedded `Show Me How` (`I Do`) & Academy Trick Films
All trick scripts live as declarative data in **`docs/tricks.md`** and are compiled deterministically by `src/rig/tricks.ts` (every beat's partial products are asserted to sum to `a × b`).
- **One shared Imbibe/Three.js Beat Player** drives BOTH **Academy Films** (using canonical examples) and **In-Battle `Show Me How`** (using the live `a × b` formation):
  - **First time seeing a trick (`seenCount === 0`):** Plays the full paced walkthrough (Card Name banner → explicit **WHY** → one visual change per spoken beat → **We-Do** interactive final combine tap → unlocks Trick Card onto Resting Bay desk!).
  - **Repeat visits (`seenCount ≥ 1`):** Plays the **≤ 8-second Fast Replay** (skips the intro, jumps straight to the visual split + 1-line reminder + **We-Do** final tap).
  - **Foundation Fallback:** If a cadet misses an early small fact even after a trick, drop cleanly to **Fast Adding** (`4 + 4 + 4`).
  - **In battle (shot budget, §4.1):** Nova speaks one line per lesson (the WHY on first sight, a one-line reminder on repeat), the other beats are silent visual moves with their numbers labelled on the fleet, and it ends on the We-Do question. First sight fits in ≤ 10 s, a Fast Replay in ≤ 8 s, and the keypad stays live throughout. Academy films speak the full script. See `docs/tricks.md`.

---

## 5. Adaptive Leveling, Problem-String Waves & Simulation Proof (`src/rig/`)

All math logic lives in pure TypeScript under `src/rig/` (zero React, Three.js, or DB imports) and is proven by Vitest before UI wiring.

### 5.1 Disjoint Planet Pools
Unit test invariant: **`pool(Ti) ∩ pool(Tj) === ∅`** (higher planets never leak lower-planet facts).
- `T0` (Earth): `a ∈ {0,1}` or `b ∈ {0,1}`
- `T1` (Moon): `min/max ∈ [2..10]` where at least one factor is `∈ {2, 5, 10}`
- `T2` (Mars): factors `∈ [3..9] \ {5}`, at least one factor `∈ {3, 4}`
- `T3` (Asteroid Belt): both factors `∈ {6, 7, 8, 9}` (includes Perfect Squares `6×6`–`9×9`)
- `T4` (Jupiter): `2-digit (12–99, excl. multiples of 10) × 1-digit (2–9)`
- `T5` (Saturn): `2-digit (12–99) × 2-digit (11–99)` (ramps from friendly pairs like `14 × 12`, `18 × 25` upward)
- `T6` (Uranus): `3-digit (105–999) × 1–2 digit (3–99)`
- `T7+` (Deep Space): unbounded progression (`3d×3d` → `4d×2d` → `4d×3d` → `5d×3d` → infinite)

### 5.2 5-Wave Problem-String Missions
Each planet mission consists of **5 waves (~2–3 minutes)**:
1. **Wave 1 (Anchor Warmup):** Foundational anchor setting up the planet's trick (e.g., `10 × 7` on Asteroid Belt, `6 × 20` on Jupiter).
2. **Wave 2 (Discovery Step):** Direct neighbor (`9 × 7` right after `10 × 7`, or `6 × 4` → `6 × 24` right after `6 × 20`).
3. **Wave 3 (Fresh Application):** New pair using the same strategy.
4. **Wave 4 (Adaptive / Transfer Check):** If the cadet used `Show Me How` on Waves 1–3, serves a **sister problem** using the exact same trick with zero prompt and marks `is_transfer_check = true`; otherwise serves the cadet's lowest-mastery fact in the current tier.
5. **Wave 5 (Planet Boss):** Slightly larger Commander formation for that tier. Clearing Wave 5 awards bonus Orbs, lights up the planet permanently, and opens the next planet.

### 5.3 Per-Fact Mastery & Error Classifier
- **Canonical fact key:** `${Math.min(a,b)}x${Math.max(a,b)}` (exploits Commutative symmetry).
- **Attempt observation score `obs`:**
  - Unassisted Try 1, fast (`latencyMs ≤ tierFastMs`): `1.0` (**Gold**)
  - Unassisted Try 1, thoughtful: `0.85`
  - Solved via **Trick Power-Up (`We Do`)**, Try 1: `0.72` (**Conceptual Win — never penalized**)
  - Self-corrected after 1 close miss: `0.65`
  - Solved via 4-choice Radar: `0.45`
  - Needed **`Show Me How` (`I Do`)**: `0.20` *(queues sister Transfer Check for `+2` waves)*
- **EWMA update:** `m_new = m_old + 0.35 * (obs - m_old)` (default `m_0 = 0.25`).
- **Resting Bay flashcards (gentle nudge):** a correct card answered within the fact's `tierFastMs` moves mastery with `alpha = 0.18` toward `obs = 0.78`, never lowering it: `m_new = max(m_old, m_old + 0.18 * (0.78 - m_old))`, and it counts as the fast unassisted solve Gold needs. So a Mint fact already at `m ≥ 0.82` (careful solves, never fast) turns Gold on one fast card; below that, cards lift it gently toward `0.78` and battle waves do the rest. Slow or wrong cards change nothing. A card is never a mission wave, never counts toward a planet clear, and never extends or resets the Hyper-Jump Gold streak.
- **Silent tier-scaled fast thresholds:** `T0–T1: 3500ms`, `T2–T3: 5000ms`, `T4: 10000ms`, `T5: 22000ms`, `T6+: 45000ms`.
- **Error classifier (`classifyError(a, b, guess)`):**
  - `added_instead`: `guess === a + b`
  - `off_by_one_group`: `guess === a * (b ± 1)` or `(a ± 1) * b`
  - `off_by_one_unit`: `|guess - a*b| <= 2`
  - `place_value`: `guess === a*b*10` or `guess === Math.floor(a*b/10)` or missing tens carry
  - `undershoot_close` / `overshoot_close` (`≤ 25%`) / `wild_guess` (`> 35%`)

### 5.4 Two-Speed Leveling (Kids & Adults)
- **Hyper-Jump Upward:** after **2 consecutive in-tier Gold shots** (fast, unassisted, first try; anchor and Shield Recharge waves don't count), the next wave is a **probe** from the next planet, the one the jump would skip. A **third Gold, on that probe**, triggers the Captain radio offer: *"Ace telemetry! Hyper-Jump straight to [Planet + 2]?"* One tap jumps older kids & adults from Moon → Asteroid Belt → Saturn → Deep Space within ~25 seconds (marking skipped planets as *Ace Cleared*). A probe that is not Gold resets the streak; probes never count as mission waves or struggles. Deep Space has no jump.
- **Gentle Cushion Downward:** 2 consecutive misses or `Show Me How`s silently injects a confidence-rebuilding anchor wave (*"Shield Recharge!"*) next—never a harsh demotion screen.
- **Planet clear:** a mission is the anchor warm-up plus 4 in-tier waves, and the planet clears when **≥ 3 of those 4 in-tier waves are the cadet's own first-try answers** (fast, thoughtful, or via a Power-Up). Radar picks and `Show Me How` do not count; the anchor does not count. Earth's tutorial clears on 2 of its 3 waves. A mission that falls short starts a fresh mission on the same planet.
- **Deep Space keeps growing:** every completed Deep Space mission (cleared or not) advances the mission counter, so no anchor or discovery problem repeats and the sectors ramp `3d×3d` → `4d×2d` → `4d×3d` → `5d×3d` onward.

### 5.5 Simulated-Learner Harness (`tests/rig.test.ts` + `docs/levelling-proof.md`)
Simulate **5 bot profiles** over 20–30 questions each and assert exact placement within ≤ 15 questions:
1. `struggling-3rd-grader` (knows `×0,×1,×2,×5,×10`; struggles on `×3,×4,×6–9`)
2. `average-5th-grader` (solid single digits; shaky on `2d × 1d`)
3. `adult-speedrunner` (fast & accurate across all tiers → Hyper-Jumps to multi-digit within ≤ 10 questions)
4. `random-masher` (guesses wildly → stays safely cushioned, triggers Radar & anti-mash coaching)
5. `trick-learner` (misses `×9` initially, learns via `Show Me How`, nails transfer checks → advances cleanly)

---

## 6. Two-Layer Voice Architecture (Gradium Phonon)

Use **Gradium Phonon (`phonon-31m-en`, Apache 2.0)** in a **2-layer client-side architecture** — **\$0 runtime server TTS cost, zero Vercel serverless compute, zero quota failures, and zero robotic Chrome `speechSynthesis`**:

1. **Layer 1 — Pre-Baked Static Intro & Story Clips (`public/vo/` + `vo.json`):**
   - Generate ~20 fixed lines locally with Phonon (Classroom Teacher, Classmate, Principal, Captain's Briefing, fixed Nova quips) using distinct Phonon voices (*Harper / Freya* for Teacher/Nova, *Sterling* for Captain, *Toby* for Classmate).
   - Store durations in `public/vo/vo.json` for frame-accurate lip-sync (`talk(t, beat.on)`) with instant 0ms playback on first load.
2. **Layer 2 — Client-Side `phonon-tts` Web Worker (Dynamic Speech on Device):**
   - **Never import `phonon-tts` in SSR or Vercel API routes.** Dynamically import client-only (`"use client"`) inside a Web Worker when the Title Screen mounts, so weights download and cache in the browser `Cache API` silently during the 25-second intro.
   - Once warm (~8ms TTFA), `phonon-tts` speaks:
     - The player's actual name (*"Cadet Jannat!"*)
     - Every dynamic `Show Me How` beat for *any* `a × b` up to `5-digit × 3-digit`
     - Nova's error-classified nudges & Academy examples
   - **Predictive Pre-Fetch:** Synthesize Beat 1 of the current problem's `Show Me How` silently while the player is thinking so tapping `Show Me How` starts speaking in 0ms.
   - **Clean Teardown:** Strictly abort/stop active Web Audio buffers when stepping beats or closing `Show Me How` so two lines can *never* overlap or stutter.
   - **Always-on synced captions** so muted devices still get 100% clarity.

---

## 7. Event-Sourced Database & Telemetry (`src/db/`)

Hosted on **Supabase Postgres** (Vercel production) with **PGlite** locally and in-memory for Vitest, managed via **Drizzle ORM**:

### Tables
1. **`players`:** `id (uuid pk)`, `name`, `avatar`, `worldId ('space')`, `createdAt`, `lastSeenAt`.
2. **`events` (append-only log):** `id (bigserial pk)`, `playerId (fk)`, `type`, `payload (jsonb)`, `createdAt`.
   - Core event types:
     - `intro_completed`
     - `attempt_submitted` (`{ a, b, planetId, guess, correct, latencyMs, errorType, attemptIndex, usedRadar, powerUpUsed, isTransferCheck }`)
     - `powerup_used` (`{ trickId, a, b, valid }`)
     - `explanation_started` / `explanation_completed` (`{ trickId, a, b, mode: 'full' | 'fast', wedoCorrect }`)
     - `planet_cleared` / `hyper_jump_taken` (`{ fromPlanet, toPlanet }`)
     - `orb_earned` / `upgrade_purchased` (`{ slot, itemId, cost }`)
     - `flashcard_answered` (`{ a, b, correct, latencyMs }`)

Practice waves (replaying a cleared planet, or a dev drill) are logged with `waveRole: "practice"`: they move fact mastery but never the mission, streaks or planet clears.

All player state (`introCompleted`, `currentPlanet`, `unlockedPlanets`, `factMastery`, `seenTricks`, `orbs`, `equippedUpgrades`, `transferQueue`) is **purely folded** from `events` by `src/director/fold.ts` (unit-tested and deterministic!).

### Telemetry & Admin Surfaces
- **Hidden Live X-Ray (`Shift+D`):** Toggles a sleek translucent overlay showing live per-fact EWMA mastery, current tier, active error classification, transfer-check queue, and session Transfer Rate.
- **`/admin` Dashboard:** Clean table per player showing:
  1. **Post-Explanation Transfer Rate** (north-star metric: accuracy on sister fact after `Show Me How` / Power-Up vs. before)
  2. **Fact Mastery Grid** (`0–10 × 0–10` heatmap + multi-digit tier progress)
  3. **Event Timeline** & Day-2 Return Indicator (for real-kid testing sessions).

---

## 8. Post-Core Stretch Goal (Build ONLY After Phases 0–4 Are Deployed & Green): Live "Talk to Nova"

If time remains after real-kid testing, add a mini-comms drawer on Nova's portrait (works both mid-battle and in the Academy):
- Input: Push-to-Talk mic (browser `SpeechRecognition`), text box, and 3 one-tap question pills (*"Why split it that way?"*, *"Show me another way"*, *"Give me a hint"*).
- Thin streaming route `/api/nova` emitting **6 validated Stage Tool Calls** (never raw code): `show_fleet(a, b)`, `highlight_lanes(count)`, `flip_fleet()`, `slice_fleet(left, right)` (validated `left + right === b`), `add_ghosts(perRow)`, `ask_kid(prompt, choices, answer)`.
- Rendered by the **exact same Three.js Beat Player + `phonon-tts` Web Worker**—zero new renderer needed.
