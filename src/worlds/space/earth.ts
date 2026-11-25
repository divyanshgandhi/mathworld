import * as THREE from "three";
import type { Materials } from "@/engine/materials";
import type { Rng } from "@/engine/util";
import { LOOKS } from "@/worlds/looks";
import { makeBody, starfield, type Body } from "./planets";

export const EARTH_RADIUS = 30;

/**
 * Earth from orbit, for the film's opening and the Earth battle: the one Earth from the planet factory
 * (high detail, with its cloud layer and thin atmosphere), the Moon, a starfield, and a sunlight the
 * caller switches on (`sun.intensity`, off by default, as before).
 */
export function buildEarth(scene: THREE.Scene, M: Materials, rnd: Rng, at: THREE.Vector3): {
  sun: THREE.DirectionalLight;
  update(dt: number): void;
  /** The factory bodies, for callers that want them. */
  earth: Body;
  moon: Body;
  group: THREE.Group;
} {
  const group = new THREE.Group();
  scene.add(group);
  const earth = makeBody(M, "earth", EARTH_RADIUS, { lod: "high" });
  earth.group.position.copy(at);
  // turn Africa and Europe toward the opening shot's camera
  earth.spin.rotation.y = -0.6;
  group.add(earth.group);

  const moon = makeBody(M, "moon", 7, { lod: "low" });
  moon.group.position.set(at.x + 70, at.y + 24, at.z - 60);
  group.add(moon.group);

  group.add(starfield(2200, 900, rnd, at));

  const sun = new THREE.DirectionalLight(LOOKS.space.key.color, 0);
  sun.position.set(at.x - 120, at.y + 50, at.z + 120);
  sun.target.position.copy(at);
  scene.add(sun, sun.target);

  return {
    sun, earth, moon, group,
    update(dt: number) {
      earth.spin.rotation.y += dt * 0.05;
      earth.update(dt);
    },
  };
}
