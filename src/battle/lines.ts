/**
 * New battle lines from the combat track (wave 2). Captions first: none is baked yet (OVERHAUL.md,
 * decision 10), so each shows as a caption paced on reading time until the film track bakes it under
 * the same id. They replace lines that pointed at the Targeting Radar, which is gone.
 */
export const COMBAT_LINES = {
  /** A wild guess: replaces "Way off! Radar is up." */
  nova_err_way_off: "Way off! Count the squads with me.",
  /** The second miss: replaces "Sneaky squad! Try a Power-Up, the Radar, or Show Me How." */
  nova_invite_v2: "Sneaky squad! Try a Power-Up, or ask me to show you how.",
} as const;
export type CombatLineId = keyof typeof COMBAT_LINES;
