/**
 * Orbs, as data (OVERHAUL.md, "Rewards follow learning"; wave 2 decision 4: orbs are derived, not
 * trusted). This table is the only place an orb amount is written. The fold (src/director/fold.ts)
 * reads the learning events and pays from here; whatever amount a client sends is ignored.
 *
 * The maths behind the numbers is in docs/overhaul/w2-economy.md ("Prices from the earning rate").
 * In short: a typical 10-minute session (about 15 waves) pays 80 to 130 orbs, so the first look
 * (30) is bought in session one, something new opens about every second session, and the top
 * looks need about ten sessions of play and the planets that unlock them.
 */
export const ORB_RULES = {
  /**
   * An exact answer: more for the first try. After Show Me How the cadet types what Nova showed, so
   * it pays nothing (otherwise mashing until the worked example pays 3 a wave). The Academy is for
   * learning, not farming: it pays nothing.
   */
  wave_clear: { firstTry: 5, later: 3, afterShowMeHow: 0, academy: 0 },
  /**
   * Practice on a fact that is already Gold: 1, and only for the first such replay of that fact in a
   * day (by the event's time). Replaying one Gold fact 100 times in a day pays 1.
   */
  gold_replay: { amount: 1 },
  /** A fact reaching Gold for the first time (in battle, on a flashcard or on patrol). Once per fact, ever. */
  new_gold: { amount: 10 },
  /** Every fifth first-try answer in a row. Gold replays and the Academy neither count nor break the run. */
  streak: { every: 5, amount: 5 },
  /** Clearing a planet's mission (only when the mission really passed). */
  planet_cleared: { amount: 20 },
  /** The daily patrol finished: once per calendar day. */
  patrol: { amount: 15 },
  /** Quick Flashcards pay nothing (decision 5): the daily patrol pays once a day instead. */
  flashcard: { amount: 0 },
  /** Mercury and Venus warm-ups pay nothing: they are always open and never reach Gold, so they could be farmed. */
  warmup: { amount: 0 },
} as const;
export type OrbReason = keyof typeof ORB_RULES;

/** One line of the orb ledger, by what earned (or spent) it. */
export type OrbRule = "first_try" | "later_try" | "gold_replay" | "new_gold" | "streak" | "planet_cleared" | "patrol" | "spent";

/** The plain words a cadet sees next to each line. */
export const ORB_WORDS: Record<Exclude<OrbRule, "spent">, string> = {
  first_try: "First try",
  later_try: "Cleared the wave",
  gold_replay: "Gold fact practice",
  new_gold: "New Gold fact",
  streak: "Five first tries in a row",
  planet_cleared: "Planet cleared",
  patrol: "Daily patrol",
};

/** Orbs for clearing a wave on shot number `attempts` (the battle's own reward card reads this). */
export function waveClearOrbs(mode: "campaign" | "practice" | "academy", attempts: number) {
  const r = ORB_RULES.wave_clear;
  return mode === "academy" ? r.academy : attempts === 1 ? r.firstTry : r.later;
}
export const planetClearOrbs = () => ORB_RULES.planet_cleared.amount;

/** What the fold knows about one cleared wave when it pays it. */
export interface ClearedWave {
  mode: "campaign" | "practice" | "academy";
  /** Cleared with the first shot, with no Show Me How before it. */
  firstTry: boolean;
  /** Show Me How ran on this wave. */
  shown: boolean;
  /** The fact was Gold before this wave. */
  wasGold: boolean;
  /** A Gold replay of this fact has already been paid today. */
  replayPaidToday: boolean;
  /** The first-try run before this wave. */
  streak: number;
}

/**
 * The orbs one cleared wave pays, and the first-try run after it. Pure, so the rules are tested on
 * their own. (A fact turning Gold for the first time is paid by the fold, which sees the mastery.)
 */
export function payWave(w: ClearedWave): { lines: { rule: OrbRule; amount: number }[]; streak: number; goldReplay: boolean } {
  const R = ORB_RULES;
  if (w.mode === "academy") return { lines: [], streak: w.streak, goldReplay: false };
  if (w.mode === "practice" && w.wasGold) {
    // keeping a Gold fact warm: almost nothing, and nothing at all after the first one of the day
    const pay = w.firstTry && !w.replayPaidToday;
    return { lines: pay ? [{ rule: "gold_replay", amount: R.gold_replay.amount }] : [], streak: w.streak, goldReplay: pay };
  }
  if (!w.firstTry) return { lines: w.shown ? [] : [{ rule: "later_try", amount: R.wave_clear.later }], streak: 0, goldReplay: false };
  const streak = w.streak + 1, lines: { rule: OrbRule; amount: number }[] = [{ rule: "first_try", amount: R.wave_clear.firstTry }];
  if (streak % R.streak.every === 0) lines.push({ rule: "streak", amount: R.streak.amount });
  return { lines, streak, goldReplay: false };
}

/** A calendar day number from a time in ms (UTC). The fold uses it for "once per day" rules. */
export const dayNumber = (ms: number) => Math.floor(ms / 86_400_000);
