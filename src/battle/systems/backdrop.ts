import { applyLook } from "@/worlds/looks";
import * as THREE from "three";
import type { Stage } from "@/engine/stage";
import type { PlanetId } from "@/rig/pools";
import { mountSky } from "@/worlds/space/skies";
import { LOOK } from "../look";

/**
 * The backdrop: the planet's sky behind the fleet (unless the scene brings its own, like Cadet Bay),
 * the battle's three lights, and the battle look on the stage (background, bloom, exposure, grade).
 */
export function createBackdrop(stage: Stage, planet: PlanetId, origin: THREE.Vector3, withSky: boolean) {
  const { scene, camera } = stage;
  const sky = withSky ? mountSky(stage, planet, origin) : null;
  let lights: THREE.Object3D[] = [];
  return {
    sky,
    /** Warm key, cool rim, soft sky fill; no shadows needed for a fleet in space. */
    light() {
      const L = LOOK.light;
      const key = new THREE.DirectionalLight(L.key.color, L.key.intensity);
      key.position.set(origin.x - 8, origin.y + 14, origin.z + 10);
      key.target.position.copy(origin);
      const rim = new THREE.DirectionalLight(L.rim.color, L.rim.intensity);
      rim.position.set(origin.x + 6, origin.y + 6, origin.z - 10);
      const fill = new THREE.HemisphereLight(L.fill.sky, L.fill.ground, L.fill.intensity);
      lights = [key, key.target, rim, fill];
      scene.add(...lights);
    },
    /** The battle look: clean and readable, no halos on ships or drones. */
    applyLook() {
      const S = LOOK.scene;
      camera.far = S.far;
      camera.updateProjectionMatrix();
      applyLook(stage, "space");
      scene.fog = null;
    },
    update(dt: number) { sky?.update(dt); },
    dispose() { scene.remove(...lights); sky?.dispose(); },
  };
}
