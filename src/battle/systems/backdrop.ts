import { applyLook, LOOKS, lookLights } from "@/worlds/looks";
import * as THREE from "three";
import type { Stage } from "@/engine/stage";
import type { PlanetId } from "@/rig/pools";
import { mountSky, type SkyView } from "@/worlds/space/skies";
import { LOOK } from "../look";

/**
 * The backdrop: the planet's sky (unless the scene brings its own, like Cadet Bay), the battle's lights
 * (the `space` look's gold key, cool rim and fill, from `lookLights`), and the `space` look on the stage.
 * The sky's bodies are placed from the camera every frame, so none ever sits behind the fleet.
 */
export function createBackdrop(stage: Stage, planet: PlanetId, origin: THREE.Vector3, withSky: boolean) {
  const { scene, camera } = stage;
  const sky = withSky ? mountSky(stage, planet, origin) : null;
  let rig: ReturnType<typeof lookLights> | null = null;
  return {
    sky,
    /** Gold key from the upper left, a cool rim from behind, the soft fill; no shadows for a fleet in space. */
    light() {
      rig = lookLights(LOOKS.space, { target: origin, keyFrom: new THREE.Vector3(-8, 14, 10), rimFrom: new THREE.Vector3(6, 6, -10) });
      scene.add(rig.group);
    },
    /** The battle look: clean and readable, no halos on ships or drones. */
    applyLook() {
      camera.far = LOOK.scene.far;
      camera.updateProjectionMatrix();
      applyLook(stage, "space");
      scene.fog = null;
    },
    update(dt: number, view?: SkyView) { sky?.update(dt, view); },
    /** A planet cleared: its gold ring. */
    clearRing() { sky?.clearRing(); },
    dispose() { if (rig) scene.remove(rig.group); sky?.dispose(); },
  };
}
