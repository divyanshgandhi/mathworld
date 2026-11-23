import type { TRICKS } from "@/db/events";

/**
 * The trick router and beat compiler, from docs/tricks.md. Code computes every number; the lines
 * are the doc's scripts with those numbers filled in. Every lesson asserts its parts add up to a × b.
 */
export type TrickId = (typeof TRICKS)[number];

export const CARD: Record<TrickId, string> = {
  "empty-mirror": "Empty & Mirror", "fast-adding": "Fast Adding", "flip-it": "Flip It!", "double-it": "Double It!",
  "easy-5-10": "Easy 5s & 10s", "jump-one-more": "Jump One More", "split-and-add": "Split & Add",
  "borrow-take-back": "Borrow & Take Back", "big-small-split": "Big & Small Split", "half-double": "Half & Double",
};

/** What the stage shows on a beat. The beat player (Phase 3) turns these into 3D moves. */
export type Show =
  | { kind: "fleet" }
  | { kind: "empty" }
  | { kind: "mirror" }
  | { kind: "rows"; upTo: number; total: number }
  | { kind: "rotate" }
  | { kind: "halves"; tone: "cyan" | "amber"; value: number }
  | { kind: "pods"; value: number }
  | { kind: "twin"; value: number }
  | { kind: "slice"; left: number; right: number }
  | { kind: "block"; tone: "cyan" | "amber" | "coral"; value: number }
  | { kind: "ghosts"; perRow: number; total: number }
  | { kind: "sector"; x: number; y: number; value: number }
  | { kind: "reshape"; a: number; b: number }
  | { kind: "wedo"; answer: number };
export interface Beat { say: string; show: Show }

export interface Lesson {
  a: number; b: number;
  /** The tricks used, in order (Flip It! comes first when the fleet is turned). */
  tricks: TrickId[];
  trick: TrickId;
  card: string;
  mode: "full" | "fast";
  beats: Beat[];
  /** How many leading beats are the Flip It! turn (0 when the fleet is not turned). */
  flipBeats: number;
  /** Signed addends that make a × b (e.g. 4 × 9 → [40, -4]). */
  parts: number[];
  wedo: { prompt: string; answer: number };
}

const NINES = [9, 19, 29, 99, 199];
const fmt = (n: number) => n.toLocaleString("en-US");
const ORD = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

/** docs/tricks.md router: first matching rule wins. */
export function selectTrick(a: number, b: number): TrickId {
  const lo = Math.min(a, b), hi = Math.max(a, b), has = (n: number) => a === n || b === n;
  if (lo <= 1) return "empty-mirror";
  if (hi >= 11) {
    if (NINES.some(has)) return "borrow-take-back";
    if (lo >= 11 && ((a % 2 === 0 && b % 10 === 5) || (b % 2 === 0 && a % 10 === 5))) return "half-double";
    return "big-small-split";
  }
  if (hi <= 4 && a * b <= 12) return "fast-adding";
  if ([2, 4].some((k) => has(k) && ![5, 9, 10].includes(k === a ? b : a))) return "double-it";
  if (has(5) || has(10)) return "easy-5-10";
  if (has(9)) return "borrow-take-back";
  if (has(6) || Math.abs(a - b) === 1 || (lo === 3 && hi <= 7)) return "jump-one-more";
  return "split-and-add"; // 3 × 8, 7 × 7, 8 × 8
}

/** Flip It! is offered when the fleet has more squads than ships per squad (8 × 3 → 3 × 8). */
export const shouldFlip = (a: number, b: number) => a > b && a <= 12 && b >= 2;

/** Whether firing a Power-Up at a × b makes sense (for Nova's strategy coaching). */
export function powerUpFits(t: TrickId, a: number, b: number): boolean {
  const lo = Math.min(a, b), hi = Math.max(a, b), has = (n: number) => a === n || b === n;
  if (lo === 0) return t === "empty-mirror"; // an empty fleet: only Empty & Mirror has anything to show
  switch (t) {
    case "empty-mirror": return lo <= 1;
    case "fast-adding": return lo >= 2 && hi <= 10;
    case "flip-it": return a !== b && lo >= 2;
    case "double-it": return [2, 4].some(has);
    case "easy-5-10": return has(5) || has(10);
    case "borrow-take-back": return NINES.some(has);
    case "jump-one-more": return hi <= 10 && lo >= 2 && (has(6) || Math.abs(a - b) === 1 || (lo === 3 && hi <= 7));
    case "split-and-add": return hi <= 10 && lo >= 2 && hi >= 6;
    case "big-small-split": return hi >= 11;
    case "half-double": return (a % 2 === 0 && b % 10 === 5) || (b % 2 === 0 && a % 10 === 5);
  }
}

interface Built { trick: TrickId; full: Beat[]; repeat: Beat; parts: number[]; prompt: string }
const say = (s: string, show: Show): Beat => ({ say: s, show });

function emptyMirror(a: number, b: number): Built {
  if (a === 0 || b === 0) {
    const line = a === 0 ? "Zero squads means empty space — not a single invader!" : "Zero ships in every squad means empty space — not a single invader!";
    return { trick: "empty-mirror", full: [say(line, { kind: "empty" })], repeat: say("Remember Empty & Mirror: times 0 is 0, times 1 stays the same!", { kind: "empty" }), parts: [0], prompt: "How many plasma balls do we need for empty space?" };
  }
  const n = a === 1 ? b : a;
  const line = a === 1 ? "One squad is just a mirror — it keeps the exact same number." : "One ship in each squad is just a mirror — it keeps the exact same number.";
  return { trick: "empty-mirror", full: [say(line, { kind: "mirror" })], repeat: say("Remember Empty & Mirror: times 0 is 0, times 1 stays the same!", { kind: "mirror" }), parts: [n], prompt: a === 1 ? `So 1 squad of ${fmt(b)} is… tap it!` : `So ${fmt(a)} squads of 1 is… tap it!` };
}

function fastAdding(a: number, b: number): Built {
  const full = [say(`Multiplication is just fast adding — ${a} squads of ${b}.`, { kind: "fleet" }), say(`First squad gives us ${b}.`, { kind: "rows", upTo: 1, total: b })];
  for (let r = 2; r < a; r++) full.push(say(`Add the ${ORD[r] ?? `next`} squad: ${(r - 1) * b} plus ${b} is ${r * b}.`, { kind: "rows", upTo: r, total: r * b }));
  return {
    trick: "fast-adding", full, parts: Array(a).fill(b),
    repeat: say(`Fast Adding! Count one squad at a time: ${b}, ${2 * b}…`, { kind: "rows", upTo: Math.min(2, a - 1), total: Math.min(2, a - 1) * b }),
    prompt: `One last squad of ${b}! What is ${(a - 1) * b} plus ${b}?`,
  };
}

function doubleIt(a: number, b: number): Built {
  // ×2 doubles once, ×4 doubles twice. (×8 is taught by Split & Add or Jump One More instead.)
  const k = [2, 4].find((x) => (a === x || b === x) && ![5, 9, 10].includes(x === a ? b : a)) ?? (a === 2 || b === 2 ? 2 : 4);
  const n = k === a ? b : a;
  if (k === 2) return { trick: "double-it", full: [say("Multiplying by 2? Just Double It!", { kind: "halves", tone: "cyan", value: n })], repeat: say(`Double It! Just add ${n} to itself.`, { kind: "halves", tone: "cyan", value: n }), parts: [n, n], prompt: `Double ${n}! What is ${n} plus ${n}?` };
  return {
    trick: "double-it",
    full: [
      say("Multiplying by 4? Just Double It — twice!", { kind: "fleet" }),
      say(`First double ${n}: ${n} plus ${n} makes ${2 * n}.`, { kind: "halves", tone: "cyan", value: 2 * n }),
      say(`That's half the fleet! The other half is another ${2 * n}.`, { kind: "halves", tone: "amber", value: 2 * n }),
    ],
    repeat: say(`Double It! Double ${n} to get ${2 * n}, then double again!`, { kind: "halves", tone: "cyan", value: 2 * n }),
    parts: [2 * n, 2 * n], prompt: `Double ${2 * n} to clear them all! What is ${2 * n} plus ${2 * n}?`,
  };
}

function easy510(a: number, b: number): Built {
  if (a === 10 || b === 10) {
    const n = b === 10 ? a : b;
    return { trick: "easy-5-10", full: [say("Every squad of 10 packs into one glowing Squadron Pod!", { kind: "pods", value: n })], repeat: say("Easy 5s & 10s! Each squad of 10 is one Pod — count the Pods!", { kind: "pods", value: n }), parts: [10 * n], prompt: `${n} Squadron Pods of 10 — how many ships?` };
  }
  const n = b === 5 ? a : b;
  return {
    trick: "easy-5-10",
    full: [
      say("5 is the secret twin of 10 — it's exact half!", { kind: "fleet" }),
      say(`Easy! ${n} squads of 10 is ${10 * n}.`, { kind: "twin", value: 10 * n }),
      say(`Since 5 is half of 10, we just take half of ${10 * n}.`, { kind: "slice", left: 5, right: 5 }),
    ],
    repeat: say(`Easy 5s & 10s! ${n} × 10 is ${10 * n}, so ${n} × 5 is half of ${10 * n}!`, { kind: "twin", value: 10 * n }),
    parts: [10 * n, -5 * n], prompt: `What is half of ${10 * n}?`,
  };
}

function borrow(a: number, b: number): Built {
  const x = NINES.includes(b) ? b : a, n = x === b ? a : b, round = x + 1, big = n * round;
  return {
    trick: "borrow-take-back",
    full: [
      say(`${x} is just 1 shy of ${round}! Let's use Borrow & Take Back.`, { kind: "fleet" }),
      say(`Borrow 1 ghost ship per row so every row has ${round}.`, { kind: "ghosts", perRow: 1, total: n }),
      say(`Easy! ${fmt(n)} rows of ${round} makes ${fmt(big)}.`, { kind: "block", tone: "cyan", value: big }),
    ],
    repeat: say(`Borrow & Take Back! ${fmt(n)} × ${round} is ${fmt(big)}, now take back ${fmt(n)}!`, { kind: "ghosts", perRow: 1, total: n }),
    parts: [big, -n], prompt: `Now zap away the ${fmt(n)} ghosts we borrowed! What is ${fmt(big)} minus ${fmt(n)}?`,
  };
}

function jumpOneMore(a: number, b: number): Built {
  // Near squares (6 × 7 from 6 × 6), otherwise ×3 from ×2 and ×6 from ×5.
  let n: number, anchor: [number, number], intro: string;
  if (Math.abs(a - b) === 1 && Math.min(a, b) >= 6) {
    const m = Math.min(a, b);
    n = m; anchor = [m, m]; intro = `${m + 1} is just 1 more than ${m}! Let's Jump One More.`;
  } else {
    const k = a === 3 || b === 3 ? 3 : 6;
    n = k === a ? b : a; anchor = [k - 1, n]; intro = `${k} is just 1 more than easy ${k - 1}! Let's Jump One More.`;
  }
  const av = anchor[0] * anchor[1];
  return {
    trick: "jump-one-more",
    full: [
      say(intro, { kind: "fleet" }),
      say(`Start with what you know: ${anchor[0]} squads of ${n} is ${av}.`, { kind: "block", tone: "cyan", value: av }),
      say(`Now jump 1 more squad of ${n}!`, { kind: "block", tone: "amber", value: n }),
    ],
    repeat: say(`Jump One More! Start at ${anchor[0]} × ${n} = ${av}, then add one more ${n}!`, { kind: "block", tone: "cyan", value: av }),
    parts: [av, n], prompt: `Add that last squad: what is ${av} plus ${n}?`,
  };
}

function splitAndAdd(a: number, b: number): Built {
  const big = Math.max(a, b), small = big === b ? a : b, rem = big - 5, p1 = small * 5, p2 = small * rem;
  if (big < 6) return fastAdding(a, b);
  return {
    trick: "split-and-add",
    full: [
      say(`${big} in a row feels big — let's use Split & Add!`, { kind: "fleet" }),
      say(`Why split ${big} into 5 and ${rem}? Because times 5 is super fast!`, { kind: "slice", left: 5, right: rem }),
      say(`Left side: ${small} squads of 5 makes ${p1}.`, { kind: "block", tone: "cyan", value: p1 }),
      say(`Right side: ${small} squads of ${rem} makes ${p2}.`, { kind: "block", tone: "amber", value: p2 }),
    ],
    repeat: say(`Split & Add! Slice ${big} into 5 and ${rem}: ${small}×5 = ${p1}, ${small}×${rem} = ${p2}!`, { kind: "slice", left: 5, right: rem }),
    parts: [p1, p2], prompt: `Put both halves back together! What is ${p1} plus ${p2}?`,
  };
}

/** Place-value parts, biggest first, zeros dropped: 345 → [300, 40, 5]. */
export const placeParts = (n: number) => String(n).split("").map((d, i, s) => Number(d) * 10 ** (s.length - 1 - i)).filter((p) => p > 0);
const UNIT: Record<number, string> = { 1: "Fighters", 10: "Ten-Squads", 100: "Carriers", 1000: "Dreadnoughts" };

function bigSmall(a: number, b: number): Built {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  if (lo <= 9) {
    const ps = placeParts(hi), prods = ps.map((p) => lo * p);
    const unitOf = (p: number) => 10 ** (String(p).length - 1), digit = (p: number) => p / unitOf(p);
    const full: Beat[] = [];
    if (ps.length === 1) {
      const u = unitOf(hi);
      full.push(say(`${fmt(hi)} is ${digit(hi)} ${UNIT[u] ?? `groups of ${fmt(u)}`} per lane: ${lo} times ${digit(hi)} is ${lo * digit(hi)} ${UNIT[u] ?? "groups"}.`, { kind: "pods", value: lo * digit(hi) }));
      return { trick: "big-small-split", full, repeat: full[0], parts: prods, prompt: `So what is ${lo} times ${fmt(hi)}?` };
    }
    const names = ps.map((p) => ({ 1: "Ones", 10: "Tens", 100: "Hundreds", 1000: "Thousands", 10000: "Ten-Thousands" } as Record<number, string>)[unitOf(p)]);
    full.push(say(`${fmt(hi)} looks huge — split it into ${names.join(" and ")}: ${ps.map(fmt).join(" and ")}!`, { kind: "slice", left: ps[0], right: hi - ps[0] }));
    ps.forEach((p, i) => {
      const u = unitOf(p), d = digit(p), v = lo * p;
      const line = u === 1 ? `Now the Fighters on the right: ${lo} times ${p} is ${v}.`
        : u === 10 && i === 0 ? `Count the Ten-Squads first: ${lo} times ${d} is ${lo * d} Ten-Squads — that's ${fmt(v)}!`
        : `${UNIT[u] ?? "Next"}: ${lo} times ${d} is ${lo * d} ${UNIT[u] ?? "groups"} — that's ${fmt(v)}!`;
      full.push(say(line, { kind: "block", tone: u === 1 ? "amber" : "cyan", value: v }));
    });
    const big = UNIT[unitOf(ps[0])] ?? "big part", small = UNIT[unitOf(ps[ps.length - 1])] ?? "small part";
    return {
      trick: "big-small-split", full, parts: prods,
      repeat: say(`Big & Small Split! Multiply the ${big} first, then the ${small}, then add!`, { kind: "slice", left: ps[0], right: hi - ps[0] }),
      prompt: `${ps.length === 2 ? "Combine both parts of the armada!" : "Combine all the parts of the armada!"} What is ${prods.map(fmt).join(" plus ")}?`,
    };
  }
  const pa = placeParts(lo), pb = placeParts(hi), sectors = pa.flatMap((x) => pb.map((y) => ({ x, y, v: x * y })));
  const full: Beat[] = [say(`Sector-Lock! Split ${fmt(lo)} into ${pa.map(fmt).join(" + ")} and ${fmt(hi)} into ${pb.map(fmt).join(" + ")}.`, { kind: "fleet" })];
  for (const s of sectors) full.push(say(`Sector ${fmt(s.x)} × ${fmt(s.y)} is ${fmt(s.v)}.`, { kind: "sector", x: s.x, y: s.y, value: s.v }));
  return {
    trick: "big-small-split", full, parts: sectors.map((s) => s.v),
    repeat: say("Big & Small Split! Crack each sector, then add them all up!", { kind: "fleet" }),
    prompt: `Lock all ${sectors.length} sectors together! What is ${sectors.map((s) => fmt(s.v)).join(" plus ")}?`,
  };
}

function halfDouble(a: number, b: number): Built {
  const [e, f] = a % 2 === 0 && b % 10 === 5 ? [a, b] : [b, a], h = e / 2, d = f * 2;
  const prompt = d % 10 === 0 ? `Way easier! ${h} times ${d / 10} is ${h * (d / 10)} — so what is ${h} times ${d}?` : `Way easier! What is ${h} times ${d}?`;
  return {
    trick: "half-double",
    full: [
      say("Secret pro move: cut one side in half, and double the other!", { kind: "fleet" }),
      say(`Half of ${e} is ${h}. Double ${f} is ${d}. Same exact ships!`, { kind: "reshape", a: h, b: d }),
    ],
    repeat: say(`Half & Double! Turn ${a} × ${b} into ${h} × ${d}!`, { kind: "reshape", a: h, b: d }),
    parts: [h * d], prompt,
  };
}

const BUILD: Record<Exclude<TrickId, "flip-it">, (a: number, b: number) => Built> = {
  "empty-mirror": emptyMirror, "fast-adding": fastAdding, "double-it": doubleIt, "easy-5-10": easy510,
  "jump-one-more": jumpOneMore, "split-and-add": splitAndAdd, "borrow-take-back": borrow, "big-small-split": bigSmall, "half-double": halfDouble,
};

/**
 * Compile the Show Me How lesson for a × b. First time a trick is seen: full paced beats.
 * Seen before: one repeat line with the key visual, then the We-Do tap.
 */
export function lesson(a: number, b: number, seen: Partial<Record<TrickId, number>> = {}, opts: { trick?: TrickId } = {}): Lesson {
  const flip = !opts.trick && shouldFlip(a, b) && selectTrick(a, b) !== "empty-mirror" && selectTrick(a, b) !== "big-small-split";
  const [ra, rb] = flip ? [b, a] : [a, b];
  const trick = opts.trick && opts.trick !== "flip-it" ? opts.trick : selectTrick(ra, rb);
  const built = BUILD[trick as Exclude<TrickId, "flip-it">](ra, rb);
  const fast = (seen[built.trick] ?? 0) >= 1;
  const beats: Beat[] = [];
  if (flip) {
    beats.push(...((seen["flip-it"] ?? 0) >= 1
      ? [say(`Flip It! Turn ${a} × ${b} sideways into ${b} × ${a} — exact same ships.`, { kind: "rotate" })]
      : [
        say(`${a} tiny squads feels long — let's use Flip It!`, { kind: "fleet" }),
        say("Turn the fleet sideways! Same ships, just easier to count.", { kind: "rotate" }),
        say(`Now it's just ${b} squads of ${a}!`, { kind: "fleet" }),
      ]));
  }
  const flipBeats = beats.length;
  beats.push(...(fast ? [built.repeat] : built.full), say(built.prompt, { kind: "wedo", answer: a * b }));
  const out: Lesson = {
    a, b, tricks: flip ? ["flip-it", built.trick] : [built.trick], trick: built.trick, card: CARD[built.trick],
    mode: fast ? "fast" : "full", beats, flipBeats, parts: built.parts, wedo: { prompt: built.prompt, answer: a * b },
  };
  const sum = out.parts.reduce((s, p) => s + p, 0);
  if (sum !== a * b) throw new Error(`${built.trick}: parts of ${a} × ${b} add to ${sum}`);
  return out;
}
