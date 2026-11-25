import * as THREE from "three";
import type { Stage } from "@/engine/stage";
import { seeded } from "@/engine/util";
import type { PlanetId } from "@/rig/pools";
import { buildEarth } from "./earth";
import { makeBody, rockGeometry, rockMaterial, starfield, type Body } from "./planets";

/**
 * Where each battle happens: the planet hangs behind and below the fleet so the formation reads against
 * dark space. Every planet comes from the one planet factory (makeBody), at high detail; the light is the
 * arena's. Add-ons per world: the Asteroid Belt's loose rocks and Deep Space's far haze.
 */
interface Place { radius: number; at: [number, number, number]; rocks?: boolean; earthBehind?: boolean }
const PLACES: Record<Exclude<PlanetId, "earth">, Place> = {
  moon: { radius: 70, at: [0, -86, -40], earthBehind: true },
  mars: { radius: 70, at: [-10, -84, -50] },
  "asteroid-belt": { radius: 9, at: [-70, 40, -200], rocks: true },
  jupiter: { radius: 64, at: [-240, 120, -380] },
  saturn: { radius: 34, at: [-190, 95, -320] },
  uranus: { radius: 30, at: [-185, 92, -320] },
  "deep-space": { radius: 12, at: [56, 22, -220] },
};

export function mountSky(stage: Stage, planet: PlanetId, origin: THREE.Vector3) {
  const { scene, mats: M } = stage, rnd = seeded(23), root = new THREE.Group();
  scene.add(root);
  let earth: ReturnType<typeof buildEarth> | null = null, body: Body | null = null;
  const rocks: { m: THREE.Mesh; v: THREE.Vector3 }[] = [];

  if (planet === "earth") {
    earth = buildEarth(scene, M, rnd, origin.clone().add(new THREE.Vector3(6, -42, -46)));
    earth.sun.intensity = 1.2;
  } else {
    const place = PLACES[planet], at = origin.clone().add(new THREE.Vector3(...place.at));
    body = makeBody(M, planet, place.radius, { lod: "high" });
    body.group.position.copy(at);
    root.add(body.group);
    if (place.earthBehind) {
      // Earth, far behind: the same Earth as everywhere else, small
      const home = makeBody(M, "earth", 5, { lod: "low" });
      home.group.position.set(origin.x + 48, origin.y + 26, origin.z - 160);
      home.spin.rotation.y = -0.6;
      root.add(home.group);
    }
    if (place.rocks) {
      const rock = rockMaterial();
      for (let i = 0; i < 70; i++) {
        const m = new THREE.Mesh(rockGeometry(0.6 + rnd() * 3, rnd), rock);
        m.position.set(origin.x + (rnd() - 0.5) * 220, origin.y - 10 + (rnd() - 0.5) * 60, origin.z - 90 - rnd() * 160);
        m.scale.set(1, 0.6 + rnd() * 0.6, 0.8 + rnd() * 0.5);
        root.add(m);
        rocks.push({ m, v: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.4) });
      }
    }
    root.add(starfield(2000, 900, rnd, origin));
  }

  return {
    update(dt: number) {
      earth?.update(dt);
      if (body) { body.spin.rotation.y += dt * 0.02; body.update(dt); }
      for (const r of rocks) { r.m.rotation.x += r.v.x * dt; r.m.rotation.y += r.v.y * dt; }
    },
    dispose() {
      scene.remove(root);
      if (earth) { scene.remove(earth.group, earth.sun, earth.sun.target); }
    },
  };
}
