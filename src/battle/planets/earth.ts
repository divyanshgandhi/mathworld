import type { PlanetTheme } from "./types";

/** Earth · Cadet Bay: the tutorial above the intro film's Earth (its sky is the film's, not a battle sky). */
export const earth: PlanetTheme = {
  id: "earth", backdrop: { body: "earth" }, ground: "none", mood: "battle",
  briefing: "nova_ships_incoming", clear: "nova_planet_clear", intro: "nova_greet_battle", introClear: "nova_earth_clear",
};
