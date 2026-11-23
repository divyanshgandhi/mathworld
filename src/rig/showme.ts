import { CARD, lesson, type Lesson, type Show, type TrickId } from "./tricks";

/**
 * Show Me How (I Do), planned in pure code: which beats play over the live fleet, what Nova says
 * on each (the caption, and the words the voice reads), the Card Name banner with its WHY, the
 * We-Do equation, and how long it should take. The stage only renders what this says.
 *
 * - First sight of a trick: the full docs/tricks.md walkthrough, WHY included.
 * - Seen before: the Fast Replay, one reminder line and the We-Do (≤ 8 s, SPEC §4.4).
 * - Safety net (early levels): stuck after a trick, the cadet drops to Fast Adding, squads swept
 *   one at a time with running totals.
 */
export interface Step {
  /** What the caption shows (the doc's line, symbols and all); empty for a silent beat. */
  caption: string;
  /** What the voice reads: symbols spelled out ("3 × 5 = 15" → "3 times 5 is 15"); empty: silent. */
  speech: string;
  show: Show;
  why: boolean;
  /** The card this beat belongs to (a first Flip It! is its own card, before the main trick). */
  card: string;
  /** A silent beat: how long its visual move holds before the next one (s). */
  hold: number;
  /** Light the squads one after another while the line plays (the Fast Adding sweep). */
  sweep?: boolean;
}

export interface Plan {
  lesson: Lesson;
  trick: TrickId;
  /** Tricks this lesson teaches, in order; each one is logged and unlocked. */
  tricks: TrickId[];
  mode: "full" | "fast";
  fallback: boolean;
  /** Turn the fleet first, with no line of its own (a repeat Flip It!, or 10 × b whose pods say it). */
  silentFlip: boolean;
  steps: Step[];
  banner: { card: string; why: string | null };
  /** The We-Do combine, as the HUD shows it: "15 + 9 = ?". */
  equation: string;
  answer: number;
  /** Estimated seconds from the start of the lesson to the end of the We-Do question (turn included). */
  seconds: number;
}

/** The WHY, in a few words, for the Card Name banner (the spoken WHY is in the beats). */
export const WHY: Record<TrickId, string> = {
  "empty-mirror": "×0 is empty space · ×1 is a mirror",
  "fast-adding": "multiplying is fast adding",
  "flip-it": "same ships, easier to count",
  "double-it": "×2 is a double · ×4 is double, double",
  "easy-5-10": "a 10 is one Pod · 5 is half of 10",
  "jump-one-more": "start from a fact you know",
  "split-and-add": "×5 is super fast",
  "borrow-take-back": "9 is just 1 shy of 10",
  "big-small-split": "big ships first, then small",
  "half-double": "same ships, an easier shape",
};

/** The banner's WHY for this fleet (Easy 5s & 10s says the half that applies). */
export function whyFor(t: TrickId, a: number, b: number) {
  if (t === "easy-5-10") return a === 10 || b === 10 ? "a squad of 10 is one Pod" : "5 is half of 10";
  if (t === "double-it") return [2, 4].find((k) => (a === k || b === k) && ![5, 9, 10].includes(k === a ? b : a)) === 2 ? "×2 is a double" : "×4 is double, then double again";
  if (t === "borrow-take-back") { const x = [199, 99, 29, 19, 9].find((n) => a === n || b === n) ?? 9; return `${x} is just 1 shy of ${x + 1}`; }
  return WHY[t];
}

const fmt = (n: number) => n.toLocaleString("en-US");

/** The words for the voice: symbols spelled out, so live speech and baked clips read the same. */
export function spokenForm(text: string) {
  return text
    .replace(/(\d)\s*×\s*(\d)/g, "$1 times $2").replace(/×/g, " times ")
    .replace(/\s*=\s*/g, " is ").replace(/\s*−\s*/g, " minus ").replace(/(\d)\s*\+\s*(\d)/g, "$1 plus $2")
    .replace(/\b5s\b/g, "fives").replace(/\b10s\b/g, "tens").replace(/&/g, "and")
    .replace(/\s*—\s*/g, ", ").replace(/…/g, "...").replace(/Ten-Squads/g, "Ten Squads")
    .replace(/\s+/g, " ").trim();
}

const SMALL = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
/** A key for matching a line to a baked clip: same words, whatever the punctuation or "5" vs "five". */
export function lineKey(text: string) {
  return spokenForm(text).toLowerCase().replace(/'/g, "").replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(\d|10)\b/g, (d) => SMALL[Number(d)]).replace(/\s+/g, " ").trim();
}

/** How many words a number takes to say (342 → "three hundred forty two" → 4). */
export function numberWords(n: number) {
  if (n === 0) return 1;
  let w = 0, i = 0;
  for (let x = Math.floor(Math.abs(n)); x > 0; x = Math.floor(x / 1000), i++) {
    const g = x % 1000, h = Math.floor(g / 100), r = g % 100;
    if (!g) continue;
    if (h) w += 2;
    if (r) w += r <= 20 || r % 10 === 0 ? 1 : 2;
    if (i > 0) w += 1;
  }
  return w;
}

/** Nova's measured pace: baked clips read 2.3–3.8 words a second (median about 2.7), live Phonon about 2.4–2.6. */
export const WORDS_PER_SEC = 2.6;
/** The breath after a line, from where the words stop (as the intro film's dialogue). */
export const BREATH = 0.55;
export function speechSeconds(speech: string) {
  const words = speech.split(/\s+/).filter(Boolean).reduce((s, t) => {
    const n = t.replace(/[^\d]/g, "");
    return s + (n && /^[\d,.!?:;]+$/.test(t) ? numberWords(Number(n)) : 1);
  }, 0);
  return words / WORDS_PER_SEC;
}

function equation(l: Lesson): string {
  const p = l.parts, lo = Math.min(l.a, l.b);
  switch (l.trick) {
    case "empty-mirror": return lo === 0 ? `${fmt(l.a)} × ${fmt(l.b)} = ?` : `1 × ${fmt(p[0])} = ?`;
    case "fast-adding": return `${fmt((p.length - 1) * p[0])} + ${fmt(p[0])} = ?`;
    case "easy-5-10": return p.length === 1 ? `${fmt(p[0] / 10)} × 10 = ?` : `½ of ${fmt(p[0])} = ?`;
    case "half-double": {
      const r = l.beats.find((x) => x.show.kind === "reshape")?.show as Extract<Show, { kind: "reshape" }> | undefined;
      return r ? `${fmt(r.a)} × ${fmt(r.b)} = ?` : `${fmt(l.a)} × ${fmt(l.b)} = ?`;
    }
    default: return `${p.map((x, i) => (i === 0 ? fmt(x) : x < 0 ? `− ${fmt(-x)}` : `+ ${fmt(x)}`)).join(" ")} = ?`;
  }
}

const step = (caption: string, show: Show, card: string, o: { why?: boolean; sweep?: boolean; hold?: number; silent?: boolean } = {}): Step => ({
  caption: o.silent ? "" : caption, speech: o.silent ? "" : spokenForm(caption), show, why: !!o.why, card, hold: o.hold ?? 0, ...(o.sweep ? { sweep: true } : {}),
});

/** Early levels (single-digit facts, Earth to the Asteroid Belt): where the Fast Adding safety net applies. */
export const safetyNetApplies = (tier: number, a: number, b: number) => tier <= 3 && Math.max(a, b) <= 10 && Math.min(a, b) >= 2;

/** The shot budget (SPEC §4.1): a lesson in battle ends within this many seconds; a Fast Replay within 8. */
export const BUDGET = { full: 10, fast: 8 } as const;
export const SILENT_HOLD = 0.8, SILENT_MIN = 0.45;
/** The Flip It! quarter-turn (the stage plays it in 0.8 s before the first beat). */
export const FLIP_SEC = 0.8;
/** Estimated length of a plan: spoken lines, a breath after each, and the silent beats' holds. */
export const estimate = (steps: Step[]) => steps.reduce((s, x, i) => s + (x.speech ? speechSeconds(x.speech) + (i < steps.length - 1 ? BREATH : 0) : x.hold), 0);

/** The name the banner already shows need not be said: "6 is 1 more than easy 5! Let's Jump One More." → the first sentence. */
const dropCardName = (line: string) => line.replace(/\s*Let's (use )?[A-Z][^.!?]*[.!]$/, "").trim() || line;

export interface PlanOpts {
  /** Stuck after a trick on an early level: Fast Adding, squads swept with running totals. */
  fallback?: boolean;
  /** The Academy film (no shot budget): every beat of the doc spoken, as written. */
  film?: boolean;
}

/**
 * Plan a Show Me How over the live fleet. In battle (the default) the lesson keeps the shot budget:
 * Nova says ONE line (first sight: the doc's WHY beat; repeat: a one-line reminder), the doc's other
 * beats play as silent visual moves that label their numbers on the fleet, and it ends on the We-Do
 * question. The fleet turns for Flip It! without a line (the banner names it). `film` speaks every beat.
 */
export function planShowMeHow(a: number, b: number, seen: Partial<Record<TrickId, number>> = {}, { fallback = false, film = false }: PlanOpts = {}): Plan {
  if (fallback) {
    // the fewer squads, the fewer additions: 8 × 3 is counted as 3 squads of 8
    const flip = a > b, [ra, rb] = flip ? [b, a] : [a, b];
    const l = lesson(ra, rb, {}, { trick: "fast-adding" }), again = (seen["fast-adding"] ?? 0) >= 1, card = CARD["fast-adding"];
    const sweep: Show = { kind: "rows", upTo: ra - 1, total: (ra - 1) * rb };
    const steps = [step(again ? l.brief : l.beats[0].say, sweep, card, { why: !again, sweep: true }), step(l.ask, { kind: "wedo", answer: a * b }, card)];
    return {
      lesson: { ...l, a, b }, trick: "fast-adding", tricks: ["fast-adding"], mode: again ? "fast" : "full", fallback: true, silentFlip: flip,
      steps, banner: { card, why: again ? null : WHY["fast-adding"] }, equation: equation(l), answer: a * b, seconds: estimate(steps) + (flip ? FLIP_SEC : 0),
    };
  }
  const l = lesson(a, b, seen), wedo: Show = { kind: "wedo", answer: a * b };
  const banner = { card: l.card, why: l.mode === "full" ? whyFor(l.trick, a, b) : null };
  const base = { lesson: l, trick: l.trick, tricks: l.tricks, mode: l.mode, fallback: false, banner, equation: equation(l), answer: a * b };
  if (film) {
    const steps = l.beats.map((x, i) => step(x.say, x.show, i < l.flipBeats ? CARD["flip-it"] : l.card, { why: !!x.why }));
    return { ...base, silentFlip: false, steps, seconds: estimate(steps) };
  }
  // battle: the turn is silent; the main trick's beats follow. A Fast Replay still plays the whole
  // visual sequence (the split, then each part with its number), with its one reminder line.
  const fast = l.mode === "fast", whole = fast ? lesson(a, b, { ...seen, [l.trick]: 0 }) : l;
  const own = whole.beats.slice(whole.flipBeats, -1);
  const visual = own.filter((x) => x.show.kind !== "fleet" || (x.why && !fast));
  const spokenAt = fast ? Math.max(0, visual.findIndex((x) => x.show.kind !== "fleet")) : Math.max(0, visual.findIndex((x) => x.why));
  const plan = (hold: number, short: 0 | 1 | 2, brief = fast): Step[] => [
    ...visual.map((x, i) => i === spokenAt
      ? step(brief ? l.brief : dropCardName(x.say), x.show, l.card, { why: !brief && !!x.why })
      : step(x.say, x.show, l.card, { silent: true, hold })),
    // the HUD shows the equation, so a long question can shrink to its last words
    step(short === 2 || (short === 1 && l.parts.length > 2) ? (l.parts.some((x) => x < 0) ? "What's left?" : "What's the total?") : l.ask, wedo, l.card),
  ];
  const turn = l.flipBeats > 0 ? FLIP_SEC : 0, budget = BUDGET[l.mode] - turn;
  let steps = plan(SILENT_HOLD, 0);
  if (estimate(steps) > budget) steps = plan(SILENT_MIN, 0);
  const quick = Math.min(SILENT_MIN, 3.5 / Math.max(1, visual.length - 1));
  if (estimate(steps) > budget) steps = plan(quick, 1);
  // a very big armada: the WHY stays on the banner and Nova says the one-line version
  if (estimate(steps) > budget) steps = plan(quick, 1, true);
  if (estimate(steps) > budget) steps = plan(quick, 2, true);
  return { ...base, silentFlip: l.flipBeats > 0, steps, seconds: estimate(steps) + turn };
}
