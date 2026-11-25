import * as THREE from "three";
import type { Stage } from "@/engine/stage";
import { COLOR, hex } from "@/design/tokens";

/**
 * The three lighting looks of Math World (see OVERHAUL.md). A scene picks one and builds its lights
 * from the returned values; no scene sets its own background, bloom, exposure or grade.
 * The rule they all keep: one gold key, a cool blue fill, matte bodies, and bloom only for the Sun
 * and the Launch moment (nothing else may sit above the bloom threshold).
 */
export type LookId = "space" | "interior" | "hero";

export interface Look {
  background: number;
  exposure: number;
  bloom: { strength: number; radius: number; threshold: number };
  /** Grade: saturation and vignette. */
  sat: number;
  vignette: number;
  key: { color: number; intensity: number };
  fill: { sky: number; ground: number; intensity: number };
  rim: { color: number; intensity: number };
}

export const LOOKS: Record<LookId, Look> = {
  // open space: the title, every battle, the star-map backdrop
  space: {
    background: hex(COLOR.void), exposure: 1.1, bloom: { strength: 0.5, radius: 0.5, threshold: 1.0 }, sat: 1, vignette: 0.32,
    key: { color: 0xffd79a, intensity: 2.6 }, fill: { sky: 0x2a3d66, ground: hex(COLOR.void), intensity: 0.55 }, rim: { color: hex(COLOR.sky), intensity: 0.9 },
  },
  // the film's classroom and town: warm daylight through windows, cool shade
  interior: {
    background: hex(COLOR.void), exposure: 1.0, bloom: { strength: 0.15, radius: 0.3, threshold: 1.2 }, sat: 1, vignette: 0.26,
    key: { color: 0xffe2b0, intensity: 2.2 }, fill: { sky: 0x9fb6dc, ground: 0x2b2f3d, intensity: 0.7 }, rim: { color: hex(COLOR.sky), intensity: 0.5 },
  },
  // a single hero object on show: the hangar's rocket preview
  hero: {
    background: hex(COLOR.void), exposure: 1.05, bloom: { strength: 0.2, radius: 0.3, threshold: 1.15 }, sat: 1, vignette: 0.4,
    key: { color: 0xffd79a, intensity: 2.8 }, fill: { sky: 0x2a3d66, ground: hex(COLOR.void), intensity: 0.5 }, rim: { color: hex(COLOR.sky), intensity: 1.2 },
  },
};

/** Apply the stage-wide part of a look (background, exposure, bloom, grade) and return it for the scene's light rig. */
export function applyLook(stage: Stage, id: LookId): Look {
  const look = LOOKS[id];
  stage.scene.background = new THREE.Color(look.background);
  stage.renderer.toneMappingExposure = look.exposure;
  Object.assign(stage.bloom, look.bloom);
  stage.grade.sat.value = look.sat;
  stage.grade.vig.value = look.vignette;
  return look;
}
