import * as THREE from "three";
import type { EventInput } from "@/db/events";
import type { Stage } from "@/engine/stage";
import type { LoggedEvent } from "@/director/fold";
import { themeOf } from "@/battle/planets";
import { mountArena, type ArenaUi } from "./arena";
import { SPACE_AT } from "./intro";

/**
 * Level 0, Earth · Cadet Bay: the tutorial right after the intro film, on the same battle engine as
 * every planet. It fights above the intro's Earth, opens with Nova's Cadet Bay welcome, teaches
 * Empty & Mirror through Show Me How, and closes with her "The Moon is open" line.
 */
export type BayUi = ArenaUi;
const BAY = SPACE_AT.clone().add(new THREE.Vector3(0, 34, 46));

export function mountCadetBay(stage: Stage, opts: { onUi?: (ui: BayUi) => void; onEvent?: (e: EventInput) => void; history?: LoggedEvent[]; seed?: number; dev?: boolean } = {}) {
  const arena = mountArena(stage, { ...opts, planet: "earth", origin: BAY, sky: false, lines: { intro: themeOf("earth").intro, clear: themeOf("earth").introClear } });
  arena.start();
  return arena;
}
export type Bay = ReturnType<typeof mountCadetBay>;
