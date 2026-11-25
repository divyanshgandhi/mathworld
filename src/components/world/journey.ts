import type { MasteryKey } from "@/design/tokens";
import type { PlayerState } from "@/director/fold";
import { hyperJumpStatus, mapStops } from "@/director/hub";
import { band, type Band } from "@/rig/adaptive";
import { factKey, MAX_TIER, PLANETS_BY_TIER, tierOf } from "@/rig/pools";
import { ACTION_WORDS, clearFirstLine, jumpLine, lockedLine, STATE_WORDS, STOP_WORDS, type StopId } from "./words";

/**
 * The Star map's journey, read from the folded state: the ten stops in order from the Sun, each with the
 * one state it shows and the one action it offers. Pure, so it is tested like the rig. The director
 * (`mapStops`, `canLaunch`) stays the source of truth for what is locked.
 */
export type StopAction = "launch" | "practise" | "warmup";
export interface JourneyStop {
  id: StopId;
  /** Multiplication tier (Earth 0 … Deep Space 7); null for the two warm-ups. */
  tier: number | null;
  warmup: boolean;
  /** The cadet's current planet: the rocket sits here. */
  here: boolean;
  cleared: boolean;
  locked: boolean;
  /** What opens a locked stop, in words. */
  lockedBy: string | null;
  /** For a locked stop: the next planet on the route the cadet has to clear (never one two steps away). */
  clearFirst: StopId | null;
  /** The one primary action, or null for a locked stop. */
  action: StopAction | null;
}

export function journey(s: PlayerState): JourneyStop[] {
  const stops = mapStops(s), here = Math.min(s.tier, MAX_TIER);
  const base = stops.map((st): JourneyStop => {
    const warmup = st.tier === null, locked = st.status === "locked", cleared = st.status === "cleared" || st.status === "ace";
    const isHere = st.tier === here;
    const prev = st.tier !== null && st.tier > 0 ? PLANETS_BY_TIER[st.tier - 1] : null;
    return {
      id: st.id, tier: st.tier, warmup, here: isHere, cleared, locked,
      lockedBy: locked && prev ? lockedLine(prev, st.id) : null,
      clearFirst: null,
      action: locked ? null : warmup ? "warmup" : cleared && !isHere ? "practise" : "launch",
    };
  });
  return base.map((st) => (st.locked ? { ...st, clearFirst: nextToClear(base, st) } : st));
}

/**
 * The planet to clear next on the way to a locked stop: the cadet's own planet when it is before it on the
 * route, else the nearest open planet before it that is not cleared yet, else the one just before it.
 */
function nextToClear(stops: JourneyStop[], st: JourneyStop): StopId | null {
  if (st.tier === null) return null;
  const t = st.tier, before = stops.filter((x) => x.tier !== null && x.tier < t);
  const here = before.find((x) => x.here && !x.cleared);
  if (here) return here.id;
  const open = before.filter((x) => !x.locked && !x.cleared).pop();
  return open?.id ?? before.pop()?.id ?? null;
}

/** The page the Star map opens on: `?at=<planet>` (a reload), else `?locked=<planet>`, else the cadet's planet. */
export function openingPage(stops: JourneyStop[], params: { at?: string | null; locked?: string | null } = {}) {
  for (const id of [params.at, params.locked]) {
    const i = id ? stops.findIndex((x) => x.id === id) : -1;
    if (i >= 0) return i;
  }
  return hereIndex(stops);
}

/** The chip above a stop's name on its card: what state it is in, in words, with the mark that goes with it. */
export type ChipIcon = "rocket" | "check" | "lock" | null;
export function chipOf(st: JourneyStop): { text: string; icon: ChipIcon } {
  if (st.here) return { text: STATE_WORDS.here, icon: "rocket" };
  if (st.locked) return { text: STATE_WORDS.locked, icon: "lock" };
  if (st.cleared) return { text: STATE_WORDS.cleared, icon: "check" };
  if (st.warmup) return { text: STATE_WORDS.warmup, icon: null };
  return { text: STATE_WORDS.open, icon: null };
}

/** The card's one line: what the stop teaches, or for a locked stop which planet to clear first. */
export const cardLine = (st: JourneyStop) => (st.locked ? (st.clearFirst ? clearFirstLine(st.clearFirst) : st.lockedBy ?? "") : STOP_WORDS[st.id].teaches);

/** The card's one button: Launch (primary) on the cadet's planet, a quieter Practise or Warm up elsewhere, none when locked. */
export function buttonOf(st: JourneyStop): { text: string; primary: boolean } | null {
  if (!st.action) return null;
  return { text: ACTION_WORDS[st.action], primary: st.action === "launch" };
}

/** The index of the stop the cadet is on (where the map opens). */
export const hereIndex = (stops: JourneyStop[]) => Math.max(0, stops.findIndex((x) => x.here));

/** The Hyper-Jump line, only when it is close (one perfect shot in) or earned; null otherwise. */
export function hyperJump(s: PlayerState): { ready: boolean; text: string } | null {
  const j = hyperJumpStatus(s);
  if (!j.to) return null;
  const here = PLANETS_BY_TIER[Math.min(s.tier, MAX_TIER)];
  if (j.available) return { ready: true, text: jumpLine(0, here, j.to) };
  if (j.streak < 1) return null;
  return { ready: false, text: jumpLine(j.need - j.streak, here, j.to) };
}

/** The internal mastery bands, in the marks the player sees. */
export const LEVEL: Record<Band, MasteryKey> = { gold: "gold", understood: "got", practicing: "learn", unseen: "new" };
const RANK: Record<MasteryKey, number> = { gold: 0, got: 1, learn: 2, new: 3 };

export interface MarkRow { label: string; marks: MasteryKey[]; name: string }

/**
 * The cadet's mastery marks for a stop: one row of ten per times table (×3: 3 × 1 to 3 × 10), or, past the
 * times tables, the facts met on that planet so far (best first, at most 20). Warm-ups have none.
 */
export function stopMarks(s: PlayerState, id: StopId): MarkRow[] {
  const w = STOP_WORDS[id];
  if (w.tables) {
    return w.tables.map((t) => ({
      label: `×${t}`,
      name: `The ${t}s`,
      marks: Array.from({ length: 10 }, (_, i) => LEVEL[band(s.facts[factKey(t, i + 1)])]),
    }));
  }
  const tier = PLANETS_BY_TIER.indexOf(id as (typeof PLANETS_BY_TIER)[number]);
  if (tier < 0) return [];
  const met = Object.entries(s.facts)
    .filter(([k, f]) => { const [a, b] = k.split("x").map(Number); return f.seen > 0 && tierOf(a, b) === tier; })
    .map(([, f]) => LEVEL[band(f)])
    .sort((x, y) => RANK[x] - RANK[y])
    .slice(0, 20);
  return met.length ? [{ label: "Met", name: "Facts you have met here", marks: met }] : [];
}
