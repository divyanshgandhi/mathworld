import { GREETINGS } from "@/teach/greetings";
import type { ErrorType } from "@/rig/errors";
import { ERROR_LINE, type LineId } from "@/worlds/space/lines";

/**
 * New battle lines from the combat track (wave 2). Captions first: none is baked yet (OVERHAUL.md,
 * decision 10), so each shows as a caption paced on reading time until the film track bakes it under
 * the same id. They replace lines that pointed at the Targeting Radar, which is gone.
 */
export const COMBAT_LINES = {
  /** The first battle's greeting (docs/teaching.md, step 7): replaces nova_l0_intro, which taught three ideas at once. */
  nova_greet_battle: GREETINGS.battle.text,
  /** A wild guess: replaces "Way off! Radar is up." */
  nova_err_way_off: "Way off! Count the squads with me.",
  /** The second miss, with a Power-Up on the belt that fits (it pulses): replaces "Sneaky squad! …" (nova_invite_v2). */
  nova_invite_power: "Tricky one! Try a Power-Up, or tap Show me how.",
  /** The second miss with no Power-Up to try yet: Show me how pulses. */
  nova_invite_help: "Stuck? Tap Show me how.",
  /** The first wave of a mission: no structure words (decision 2). Replaces "Squads incoming!" (nova_incoming_short). */
  nova_ships_incoming: "Ships incoming!",
  /** A near miss, too few: replaces "Too few! Load a few more." (nova_err_under; "load" is retired). */
  nova_too_few: "Too few! Some got away.",
  /** A near miss, too many: replaces "Too many! Load a few less." (nova_err_over). */
  nova_too_many: "Too many! Some flew past.",
  /** Earth is cleared: the planet's name on every label (decision 7). Replaces nova_l0_clear ("Cadet Bay is clear!"). */
  nova_earth_clear: "Earth is clear! The Moon is open.",
  /** The Hyper-Jump offer, in Nova's voice and plain words: replaces the Captain's "Ace telemetry! Hyper-Jump straight to …?" */
  nova_jump_mars: "You know these. Jump ahead to Mars?",
  "nova_jump_asteroid-belt": "You know these. Jump ahead to the Asteroid Belt?",
  nova_jump_jupiter: "You know these. Jump ahead to Jupiter?",
  nova_jump_saturn: "You know these. Jump ahead to Saturn?",
  nova_jump_uranus: "You know these. Jump ahead to Uranus?",
  "nova_jump_deep-space": "You know these. Jump ahead to Deep Space?",
} as const;
export type CombatLineId = keyof typeof COMBAT_LINES;

/**
 * The line for a miss Nova has no hint for yet. It must be true of the picture (a squad is `b` ships,
 * there are `a` squads): "One squad off" only when exactly one whole squad is missing or extra, "a hair
 * off" only when the gap is small next to the fleet. "That added them" is jargon before squads are
 * explained, so a sum gets the plain too few / too many. A 0 on a full fleet is not close.
 */
export function pickMissLine(errorType: ErrorType | null, over: boolean, n: number, a: number, b: number): LineId | CombatLineId {
  const p = a * b, gap = Math.abs(n - p);
  if (errorType === "wild_guess") return "nova_err_way_off";
  if (errorType === "off_by_one_group" && a > 1 && b > 1 && n > 0 && gap === b) return ERROR_LINE.off_by_one_group;
  if (errorType === "off_by_one_unit" && n > 0 && gap <= Math.max(1, p * 0.25)) return ERROR_LINE.off_by_one_unit;
  if (errorType === "place_value") return ERROR_LINE.place_value;
  return over ? "nova_too_many" : "nova_too_few";
}
