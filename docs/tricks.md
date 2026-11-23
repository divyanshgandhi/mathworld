# Math World — The Kid-Named Trick Scripts (`docs/tricks.md`)

These scripts are the single source of truth for **Nova's in-world `Show Me How` walkthroughs**, **Academy Trick Films**, and **Live Tactical Power-Ups (`We Do`)**.

**Rules for `src/rig/tricks.ts`:**
- Code computes every number deterministically and asserts that all partial pieces sum (or subtract) to `a × b`.
- **One idea per beat.** Show the visual move first, then speak one short sentence (6–12 words max).
- **Always answer "WHY?"** on the first encounter (e.g., *"Why split 8 into 5 and 3? Because ×5 is fast!"*).
- **First encounter (`seenCount === 0`):** Full paced beats + interactive **We-Do** final tap → unlocks the Trick Card on the Resting Bay desk and mounts the Power-Up on the rocket's Tactical Belt.
- **Repeat encounters (`seenCount >= 1`):** Fast ≤ 8-second replay using the **Repeat line** + immediate visual move + **We-Do** final tap.

---

## Deterministic Trick-Router Priority (`selectTrick(a, b)`)

First matching rule wins:
1. `a === 0 || b === 0` or `a === 1 || b === 1` → **`empty-mirror`**
2. Either factor is `≥ 11` (multi-digit: `2d×1d`, `2d×2d`, `3d×2d`+) → **`big-small-split`** *(or **`borrow-take-back`** if a factor is `19`, `29`, `99`, `199`, or **`half-double`** if one factor is even and the other ends in `5` at `T5+`)*
3. Both factors `≤ 4` and small (`a * b <= 12`, or fallback after a miss on small facts) → **`fast-adding`**
4. Either factor is `2`, `4`, or `8` (and other `≤ 10`, not `5` or `9` or `10`) → **`double-it`**
5. Either factor is `5` or `10` → **`easy-5-10`**
6. Either factor is `9` → **`borrow-take-back`**
7. Adjacent single-digits (`|a − b| === 1`, e.g., `6 × 7`, `7 × 8`) or `3 × n` / `6 × n` → **`jump-one-more`**
8. Remaining hard single-digits (e.g., `3 × 8`, `7 × 4`, `7 × 6`) → **`split-and-add`**
9. *Modifier (`flip-it`):* Whenever `a > b` makes the visual/mental grouping awkward (e.g., `8 × 3`), offer **`[Flip It!]`** to rotate 90° into `3 × 8` first!

---

## 0. Empty & Mirror (`empty-mirror`)
- **Card Name:** `Empty & Mirror`
- **Power-Up Action:** Highlights empty space (`×0`) or single squad mirror (`×1`).
- **When:** Any fact with `0` or `1` (Earth · Cadet Bay tutorial).
- **Frames & Lines (for `a × 0`):**
  1. *Show empty space with `0` glowing outline.* → `"Zero squads means empty space — not a single invader!"`
  2. *We-Do tap (`0`).* → `"How many plasma balls do we need for empty space?"`
- **Frames & Lines (for `1 × b` or `a × 1`):**
  1. *Highlight the single squad with a mirror glow.* → `"One squad is just a mirror — it keeps the exact same number."`
  2. *We-Do tap (`b`).* → `"So 1 squad of {b} is… tap it!"`
- **Repeat line:** `"Remember Empty & Mirror: times 0 is 0, times 1 stays the same!"`

---

## 1. Fast Adding (`fast-adding`)
- **Card Name:** `Fast Adding`
- **Power-Up Action:** Highlights squads one row at a time with running totals (`4`, `8`, `...`).
- **When:** Early small facts (`3 × 4`, `3 × 3`, `2 × 4`) and foundation fallback whenever a player misses an early fact after a trick.
- **Frames & Lines (example `3 × 4`):**
  1. *Axis labels glow: `3 squads` on left, `4 each` on top.* → `"Multiplication is just fast adding — 3 squads of 4."`
  2. *Row 1 lights up with badge `4`.* → `"First squad gives us 4."`
  3. *Row 2 lights up, running pill `4 + 4 = 8`.* → `"Add the second squad: 4 plus 4 is 8."`
  4. *Row 3 pulses + We-Do (`8 + 4 = ?`).* → `"One last squad of 4! What is 8 plus 4?"`
- **Repeat line:** `"Fast Adding! Count one squad at a time: {step1}, {step2}…"`

---

## 2. Flip It! (`flip-it`)
- **Card Name:** `Flip It!`
- **Power-Up Action:** Tractor beam smoothly rotates the entire 3D formation 90° (`8 × 3` → `3 × 8`).
- **When:** Any `a × b` where swapping order makes the groups friendlier (e.g., `8 × 3`, `9 × 2`, `7 × 5`).
- **Frames & Lines (example `8 × 3`):**
  1. *Highlight tall `8 squads of 3`.* → `"8 tiny squads feels long — let's use Flip It!"`
  2. *Rotate formation smoothly 90° into `3 squads of 8`.* → `"Turn the fleet sideways! Same ships, just easier to count."`
  3. *Hand off to the matching anchor/split or We-Do.* → `"Now it's just {min} squads of {max}!"`
- **Repeat line:** `"Flip It! Turn {a} × {b} sideways into {b} × {a} — exact same ships."`

---

## 3. Double It! (`double-it`)
- **Card Name:** `Double It!`
- **Power-Up Action:** Splits `×4` into two twin halves (`2 × n` + `2 × n`) or `×8` into twin `×4` waves.
- **When:** `×2` (double once), `×4` (double, then double again), `×8` (double three times).
- **Frames & Lines (example `4 × 7`):**
  1. *Highlight `4 squads of 7`.* → `"Multiplying by 4? Just Double It — twice!"`
  2. *Top 2 rows glow cyan (`2 × 7 = 14`).* → `"First double 7: 7 plus 7 makes 14."`
  3. *Bottom 2 rows mirror in amber (`2 × 7 = 14`).* → `"That's half the fleet! The bottom half is another 14."`
  4. *Both halves pulse + We-Do (`14 + 14 = ?`).* → `"Double 14 to clear them all! What is 14 plus 14?"`
- **Repeat line:** `"Double It! Double {n} to get {2n}, then double again!"`

---

## 4. Easy 5s & 10s (`easy-5-10`)
- **Card Name:** `Easy 5s & 10s`
- **Power-Up Action:** For `×10`, packs each row into a glowing cyan Squadron Pod (`10`). For `×5`, projects the full `×10` twin and slices it cleanly in half!
- **When:** Any fact with `×10` or `×5`.
- **Frames & Lines (example `8 × 5`):**
  1. *Show `8 squads of 5`.* → `"5 is the secret twin of 10 — it's exact half!"`
  2. *Mirror 5 ghost ships per row to show `8 × 10 = 80`.* → `"Easy! 8 squads of 10 is 80."`
  3. *Laser slices cleanly down the middle; ghost half fades.* → `"Since 5 is half of 10, we just take half of 80."`
  4. *We-Do (`Half of 80 = ?`).* → `"What is half of 80?"`
- **Repeat line:** `"Easy 5s & 10s! {n} × 10 is {10n}, so {n} × 5 is half of {10n}!"`

---

## 5. Jump One More (`jump-one-more`)
- **Card Name:** `Jump One More`
- **Power-Up Action:** Highlights the easy anchor block (`×2`, `×5`, or Perfect Square `n × n`) in cyan and pulls the **1 extra row** out in glowing amber!
- **When:** `×3` (from `×2`), `×6` (from `×5`), and Near Squares (`6 × 7` from `6 × 6`, `7 × 8` from `7 × 7`).
- **Frames & Lines (example `7 × 8` via square `7 × 7`, or `6 × 8` via `5 × 8`):**
  1. *Show full fleet `6 × 8`.* → `"6 is just 1 more than easy 5! Let's Jump One More."`
  2. *First 5 rows glow cyan (`5 × 8 = 40`).* → `"Start with what you know: 5 squads of 8 is 40."`
  3. *6th row drops down slightly in bright amber (`+ 8`).* → `"Now jump 1 more squad of 8!"`
  4. *We-Do (`40 + 8 = ?`).* → `"Add that last squad: what is 40 plus 8?"`
- **Repeat line:** `"Jump One More! Start at {anchorA} × {b} = {anchorVal}, then add one more {b}!"`

---

## 6. Split & Add (`split-and-add`)
- **Card Name:** `Split & Add`
- **Power-Up Action:** Fires a golden laser splitter down column 5, physically separating every row into **5 cyan fighters** + **remainder amber fighters**!
- **When:** Hard single-digit facts like `3 × 8`, `4 × 7`, `7 × 8`, `7 × 6` (any factor `6–8`).
- **Frames & Lines (example `3 × 8`):**
  1. *Show `3 squads of 8` with clear labels.* → `"8 in a row feels big — let's use Split & Add!"`
  2. *Golden laser slices column 5 → rows slide apart into `5` and `3`.* → `"Why split 8 into 5 and 3? Because times 5 is super fast!"`
  3. *Left cyan block pulses (`3 × 5 = 15`).* → `"Left side: 3 squads of 5 makes 15."`
  4. *Right amber block pulses (`3 × 3 = 9`).* → `"Right side: 3 squads of 3 makes 9."`
  5. *Both blocks glow + We-Do (`15 + 9 = ?`).* → `"Put both halves back together! What is 15 plus 9?"`
- **Repeat line:** `"Split & Add! Slice {big} into 5 and {rem}: {small}×5 = {p1}, {small}×{rem} = {p2}!"`

---

## 7. Borrow & Take Back (`borrow-take-back`)
- **Card Name:** `Borrow & Take Back`
- **Power-Up Action:** Hologram projector spawns **1 dashed ghost ship at the end of every row** (`×9` → `×10`, or `×19` → `×20`, `×99` → `×100`).
- **When:** Any `×9`, and multi-digit landmarks ending in `9` (`19`, `29`, `99`, `199`).
- **Frames & Lines (example `4 × 9`):**
  1. *Show `4 squads of 9`.* → `"9 is just 1 shy of 10! Let's use Borrow & Take Back."`
  2. *4 glowing dashed ghost ships materialize at the end of each row.* → `"Borrow 1 ghost ship per row so every row has 10."`
  3. *All 40 light up cyan (`4 × 10 = 40`).* → `"Easy! 4 rows of 10 makes 40."`
  4. *The 4 ghost ships blink coral (`− 4`) + We-Do (`40 − 4 = ?`).* → `"Now zap away the 4 ghosts we borrowed! What is 40 minus 4?"`
- **Repeat line:** `"Borrow & Take Back! {a} × {round} is {bigTotal}, now take back {borrow}!"`

---

## 8. Big & Small Split (`big-small-split`)
- **Card Name:** `Big & Small Split`
- **Power-Up Action:**
  - On **`2d × 1d` (`6 × 24`):** Laser slices cleanly between the **Squadron Pods (`10`s)** and **Fighters (`1`s)**.
  - On **`2d × 2d` up to `5d × 3d` (`24 × 16`, `342 × 26`):** Activates **Sector-Lock Mode** so the player can crack each Base-10 Battle Sector one by one and watch them sum into the final plasma lock!
- **When:** All multi-digit problems (`Jupiter`, `Saturn`, `Uranus`, `Deep Space`).
- **Frames & Lines (example `6 × 24`):**
  1. *Show 6 fleets of `[2 Ten-Squads + 4 Fighters]`.* → `"24 looks huge — split it into Tens and Ones: 20 and 4!"`
  2. *Laser slices between Pods and Fighters; left cyan Pods pulse (`6 × 20 = 120`).* → `"Count the Ten-Squads first: 6 times 2 is 12 Ten-Squads — that's 120!"`
  3. *Right amber Fighters pulse (`6 × 4 = 24`).* → `"Now the Fighters on the right: 6 times 4 is 24."`
  4. *Both groups glow + We-Do (`120 + 24 = ?`).* → `"Combine both parts of the armada! What is 120 plus 24?"`
- **Repeat line:** `"Big & Small Split! Multiply the {bigPart} first, then the {smallPart}, then add!"`

---

## Bonus Pro Card (Saturn / Deep Space): Half & Double (`half-double`)
- **Card Name:** `Half & Double`
- **Power-Up Action:** Slices the even side in half and stacks it onto the other side (`18 × 25` visibly reshapes into `9 × 50`!).
- **When:** Multi-digit pairs where one factor is even and the other ends in `5` (`18 × 25`, `14 × 15`, `16 × 25`).
- **Frames & Lines (example `18 × 25`):**
  1. *Show `18 × 25` armada.* → `"Secret pro move: cut one side in half, and double the other!"`
  2. *Armada splits horizontally and stacks cleanly beside itself → `9 × 50`.* → `"Half of 18 is 9. Double 25 is 50. Same exact ships!"`
  3. *We-Do (`9 × 50 = ?`).* → `"Way easier! 9 times 5 is 45 — so what is 9 times 50?"`
- **Repeat line:** `"Half & Double! Turn {a} × {b} into {a/2} × {b*2}!"`
