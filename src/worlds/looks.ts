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

/** Two token colours mixed (`t` = 0 is `a`), as a three.js hex number: looks derive every light from the tokens. */
export function tone(a: string, b: string, t: number): number {
  const x = hex(a), y = hex(b), ch = (n: number, s: number) => (n >> s) & 255;
  const m = (s: number) => Math.round(ch(x, s) + (ch(y, s) - ch(x, s)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

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
  // open space: the title, every battle, the star-map backdrop, the 2D planet sprites.
  // Gold key from the Sun, a dim cool fill so night sides fall to shadow blue, a thin sky rim.
  // Bloom only catches the Sun's core (the one body above the threshold).
  space: {
    background: hex(COLOR.void), exposure: 1.1, bloom: { strength: 0.55, radius: 0.5, threshold: 1.0 }, sat: 1, vignette: 0.32,
    key: { color: tone(COLOR.gold, COLOR.approach, 0.6), intensity: 2.7 }, fill: { sky: tone(COLOR.disk, COLOR.void, 0.5), ground: hex(COLOR.void), intensity: 0.55 }, rim: { color: hex(COLOR.sky), intensity: 0.9 },
  },
  // the film's classroom and town: warm daylight through windows, cool shade
  interior: {
    background: hex(COLOR.void), exposure: 1.0, bloom: { strength: 0.15, radius: 0.3, threshold: 1.2 }, sat: 1, vignette: 0.26,
    key: { color: 0xffe2b0, intensity: 2.2 }, fill: { sky: 0x9fb6dc, ground: 0x2b2f3d, intensity: 0.7 }, rim: { color: hex(COLOR.sky), intensity: 0.5 },
  },
  // a single hero object on show: the hangar's rocket preview. A brighter key and a stronger rim than
  // open space, so a small object reads as sculpted; no bloom on anything (threshold above every surface).
  hero: {
    background: hex(COLOR.void), exposure: 1.05, bloom: { strength: 0.2, radius: 0.3, threshold: 1.15 }, sat: 1, vignette: 0.4,
    key: { color: tone(COLOR.gold, COLOR.approach, 0.6), intensity: 2.8 }, fill: { sky: tone(COLOR.disk, COLOR.void, 0.5), ground: hex(COLOR.void), intensity: 0.5 }, rim: { color: hex(COLOR.sky), intensity: 1.2 },
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
  stage.grade.tint.value.set(1, 1, 1);
  return look;
}

export interface LookLights {
  group: THREE.Group;
  key: THREE.DirectionalLight | THREE.PointLight;
  fill: THREE.HemisphereLight;
  rim: THREE.DirectionalLight | null;
}

/**
 * Build a look's light rig: the gold key, the cool hemisphere fill and the sky rim.
 * - `sun`: the key is a point light at this position (no falloff), for scenes with the Sun in frame (the title).
 * - otherwise the key is directional, shining from `keyFrom` towards `target` (default: upper left, in front).
 * - `rimFrom`: where the rim light comes from (default: behind and to the right). `rim: false` leaves it out
 *   (planet materials carry their own thin rim, see makeBody).
 * Add `group` to the scene; for directional lights the targets are inside it.
 */
export function lookLights(look: Look, o: { sun?: THREE.Vector3; keyFrom?: THREE.Vector3; rimFrom?: THREE.Vector3; target?: THREE.Vector3; rim?: boolean } = {}): LookLights {
  const group = new THREE.Group(), target = o.target ?? new THREE.Vector3();
  let key: THREE.DirectionalLight | THREE.PointLight;
  if (o.sun) {
    key = new THREE.PointLight(look.key.color, look.key.intensity, 0, 0);
    key.position.copy(o.sun);
  } else {
    const d = new THREE.DirectionalLight(look.key.color, look.key.intensity);
    d.position.copy(target).add(o.keyFrom ?? new THREE.Vector3(-6, 5, 7));
    d.target.position.copy(target);
    group.add(d.target);
    key = d;
  }
  const fill = new THREE.HemisphereLight(look.fill.sky, look.fill.ground, look.fill.intensity);
  group.add(key, fill);
  let rim: THREE.DirectionalLight | null = null;
  if (o.rim !== false) {
    rim = new THREE.DirectionalLight(look.rim.color, look.rim.intensity);
    rim.position.copy(target).add(o.rimFrom ?? new THREE.Vector3(7, 1.5, -5));
    rim.target.position.copy(target);
    group.add(rim, rim.target);
  }
  return { group, key, fill, rim };
}
