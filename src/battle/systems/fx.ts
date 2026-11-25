import * as THREE from "three";
import type { Stage } from "@/engine/stage";
import type { Rng } from "@/engine/util";
import { LOOK } from "../look";
import { FLEET_Y } from "./fleetView";

/**
 * Effects that belong to no ship: the spark burst where a ball lands, and the dimmed background
 * behind the fleet while Show Me How is on.
 */
export function createFx(stage: Stage, root: THREE.Group, rnd: Rng) {
  const { scene } = stage;
  const sparks: { m: THREE.Mesh; v: THREE.Vector3; t0: number }[] = [], sparkGeo = new THREE.IcosahedronGeometry(0.07, 0), sparkMat = stage.mats.additive(...LOOK.spark);
  // Show Me How: the background dims behind the fleet
  const dimPlane = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: LOOK.dim.color, transparent: true, opacity: 0, depthWrite: false }));
  dimPlane.position.set(0, FLEET_Y, -6);
  root.add(dimPlane);
  return {
    /** Five sparks fly out from a hit (capped, so a huge volley stays cheap). */
    burst(at: THREE.Vector3) {
      if (sparks.length >= 160) return;
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(sparkGeo, sparkMat);
        m.position.copy(at);
        scene.add(m);
        sparks.push({ m, v: new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() - 0.2).normalize().multiplyScalar(2 + rnd() * 2.5), t0: stage.time });
      }
    },
    update(dt: number, dim: boolean) {
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i], a = (stage.time - s.t0) / 0.5;
        if (a >= 1) { scene.remove(s.m); sparks.splice(i, 1); continue; }
        s.m.position.addScaledVector(s.v, dt);
        s.m.scale.setScalar(1 - a);
      }
      const dm = dimPlane.material as THREE.MeshBasicMaterial;
      dm.opacity += ((dim ? LOOK.dim.opacity : 0) - dm.opacity) * Math.min(1, dt * 4);
    },
    dispose() { for (const s of sparks) scene.remove(s.m); },
  };
}
export type Fx = ReturnType<typeof createFx>;
