# STATE: mathworld

_Updated 24 Nov 2026, Phase 5 (software side)_

## What changed
- **Commits:** … Phase 4 `3d919f7`, `618f27c`, `7370ca3` · **Phase 5:** `f6c28f3` (×10 shot length), `ee8f977` (X-Ray + `/admin`), and this commit (protocol, README, STATE).
- **×10 on The Moon is shorter** (owner: no shot over 5–10 s; ×10 felt long):
  - `rig/showme.ts` has a whole-shot budget: `SHOT` = volley cap 1.8 s + outcome pause 0.3 s (was 0.7) + lesson ≤ 10 s. `shotSeconds()` is tested for every fact up to 12 × 12 and the tier 4–7 draws.
  - On 10 × b, the Pods turn while Nova says the short WHY ("Each squad of 10 is one Pod!", already baked). Before, there was a silent 1 s Flip It card first.
  - Other flipped lessons also turn under their first line when that line opens over the whole fleet (8 × 3 keeps its spoken WHY).
  - The question shrinks to "What's the total?" before a WHY is ever dropped (the HUD shows the equation). Only 2-digit × 2-digit Sector-Lock first lessons now say the one-line version in battle; their WHY stays on the banner.
  - There is no Fast Adding safety net on ×10: the Pods already are the fast adding.
- **Telemetry, pure and tested** (`director/telemetry.ts`, `tests/telemetry.test.ts`, 83 tests in all):
  - Transfer report: first-try accuracy before vs after a fleet's trick was explained, plus strict transfer checks, broken down by trick. The fold's history now records each wave's `trick` and `afterLesson`.
  - Also: the X-Ray read-out, the 0–10 mastery grid, per-planet progress, sessions (30 min gap), Day-2 return and the timeline lines.
- **Shift+D X-Ray** (`components/battle/XRay.tsx`, in every battle via BattleHud):
  - A non-modal ui-sdk Drawer on the left: tier and mission, Transfer Rate (this session and all time), before → after, the active error, the transfer queue, and the EWMA of recent facts.
  - The cadet keeps typing while it is open, and the fleet re-frames to the right of it.
- **`/admin`** (not linked):
  - The players table shows transfer checks, before → after a lesson, and Day-2 status.
  - Each cadet has three tabs: Fact mastery (heatmap plus planets), Transfer rate (by trick, plus sessions) and Event timeline (the last 300 events).
  - Access is off unless `MW_ADMIN_KEY` (10+ characters) is set. The passphrase form (`POST /api/admin/session`) stores a sha256 of the key in an httpOnly cookie scoped to `/admin` for 12 h. `?key=` also works, and Lock clears the cookie.
- **Docs:** `docs/test-protocol.md` (the silent test with 3–5 kids and 1 adult, what to watch and log, how to read `/admin`). The README has a Telemetry section and a Field notes placeholder, and `.env.example` has `MW_ADMIN_KEY`.

## What's verified (Claude_Browser pane, :3200)
- **×10 timing** (fresh cadet, 10 × 8, three misses then a wrong We-Do):
  - Before: fire to the end of Nova's question was 8.9 s, then an 8.6 s Fast Adding lesson.
  - After: **6.5 s**, then a normal ~3 s miss.
  - Correct ×10 shots: 3.5–3.7 s (unchanged).
  - Frames: the 10 × 6 Pods mid-turn and settled, and 8 × 3 Split & Add turning under its WHY with upright 15 / 9 badges.
- **X-Ray, played with the keyboard:**
  - Shift+D toggled it, and digits and Enter still fired while it was open.
  - 10 × 8 misses showed `wild_guess` and `added_instead`. The lesson queued "Easy 5s & 10s from 8 × 10 · in 2 waves". The served 6 × 5 transfer check gave **100% (1/1)** this session and emptied the queue.
- **`/admin`:**
  - With no key it shows "off". A wrong passphrase shows the alert, and the right one opens the table (14 local cadets; one shows "returned · day 2" from yesterday's play).
  - The heatmap, transfer and timeline tabs show my own play. `?key=` works and Lock re-locks.
  - A fresh tab had no console errors.
- `bun run check` is green.

## Next
- **The owner's part of Phase 5:** run `docs/test-protocol.md` with real kids, fix the top 3 friction points, fill in README → Field notes.
- Then Phase 6 polish and the deploy.

## Open risks
- **Not run:** `next build` (it would disturb the running dev server, which shares `.next`). `/admin` uses `connection()` plus Suspense under `cacheComponents`, and dev showed no prerender error after that fix, but run `bun run build` before deploying.
- **Local admin key:** a generated `MW_ADMIN_KEY` was appended to the gitignored `.env.development.local`. Change it or remove it as you like; production needs its own key in Vercel.
- **Session scope:** "this session" in the X-Ray means events since the battle page opened. Server history carries no `at` stamp in the client, by design.
- **Admin scale:** it reads every event of every cadet on each load. That is fine for a handful of testers, not for many.
- **×10 lesson line:** the first-sight ×10 lesson now speaks the short WHY ("Each squad of 10 is one Pod!"), not "Every squad of 10 packs into one glowing Squadron Pod!". The Academy film still speaks the long one.
- **Still not heard by ear** (dev audio muted). Still not tested on a real phone, touch device or Safari.
- **Unexplained console noise:** two `404` errors with no URL on game routes. They did not appear on a fresh `/admin` tab.
- **Carried over:**
  - The uncommitted mute flag in `src/engine/audio.ts` (another agent's).
  - `/play/<unknown>` returns status 200.
  - Orb farming via warm-ups and flashcards.
  - The deploy, and the history rewrite for owner names.
