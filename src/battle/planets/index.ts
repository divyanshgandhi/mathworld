import type { PlanetId } from "@/rig/pools";
import { asteroidBelt } from "./asteroid-belt";
import { deepSpace } from "./deep-space";
import { earth } from "./earth";
import { jupiter } from "./jupiter";
import { mars } from "./mars";
import { moon } from "./moon";
import { saturn } from "./saturn";
import { uranus } from "./uranus";
import type { PlanetTheme } from "./types";

export type { PlanetTheme } from "./types";

/** Every planet's battle theme. Adding a planet is adding a file here. */
export const PLANET_THEMES: Record<PlanetId, PlanetTheme> = {
  earth, moon, mars, "asteroid-belt": asteroidBelt, jupiter, saturn, uranus, "deep-space": deepSpace,
};
export const themeOf = (p: PlanetId) => PLANET_THEMES[p];
