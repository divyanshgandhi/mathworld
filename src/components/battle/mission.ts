import type { PlayerState } from "@/director/fold";
import { isSolved } from "@/rig/adaptive";

/** The mission the cockpit last saw a wave of. */
export type MissionSeen = { n: number; tier: number };

/**
 * A mission that was played out without a win: the fold starts the next mission quietly (a fresh
 * mission number, no waves yet, same planet). Seen from the first wave of that next mission, this says
 * how many of the last mission's counted waves were won, for the "Mission over" card. Null otherwise:
 * a first look (a reload), a new planet, a Hyper-Jump, or a mission still in play.
 */
export function missionOver(prev: MissionSeen | null, s: Pick<PlayerState, "mission" | "tier" | "history">): { won: number; of: number } | null {
  if (!prev || prev.tier !== s.tier || s.mission.n <= prev.n || s.mission.waves !== 0) return null;
  const counted = s.history.filter((h) => h.mission === prev.n && h.tier === s.tier && h.role !== "anchor");
  if (!counted.length) return null;
  return { won: counted.filter((h) => isSolved(h.outcome)).length, of: counted.length };
}
