import * as THREE from "three";
import type { Stage } from "@/engine/stage";
import { ease, seeded } from "@/engine/util";
import { makeBody, starfield, type BodyId } from "./planets";

/**
 * The Title Screen (SPEC §2.1): a live fly-through of the Solar System. The camera swoops in past
 * the outer planets toward a bloom-lit Sun, then drifts in a slow orbit while the planets go round.
 * The Sun is the one thing allowed to glow here; planets self-light just under the bloom threshold.
 */
const ORBITS: [BodyId, number, number, number][] = [
  // body, orbit radius, planet radius, angular speed
  ["mercury", 11, 0.7, 0.42], ["venus", 15, 1.1, 0.31], ["earth", 20, 1.25, 0.25], ["mars", 25, 0.9, 0.2],
  ["jupiter", 35, 3.1, 0.11], ["saturn", 45, 2.5, 0.085], ["uranus", 54, 1.7, 0.065], ["deep-space", 62, 1.6, 0.05],
];

export function mountTitle(stage: Stage) {
  const { scene, camera, mats: M } = stage, rnd = seeded(41), root = new THREE.Group();
  scene.add(root);
  scene.background = new THREE.Color(0x02030a);
  scene.fog = null;
  camera.far = 3000;
  camera.updateProjectionMatrix();
  Object.assign(stage.bloom, { strength: 0.85, radius: 0.55, threshold: 0.95 });
  stage.renderer.toneMappingExposure = 1.05;
  stage.grade.vig.value = 0.42;

  const sun = makeBody(M, "sun", 5);
  root.add(sun.group);
  const light = new THREE.PointLight(0xfff0d8, 3.2, 0, 0);
  root.add(light, new THREE.AmbientLight(0x6070a0, 0.5));

  const planets = ORBITS.map(([id, R, r, w]) => {
    const b = makeBody(M, id, r, { glow: 0.22 });
    root.add(b.group);
    const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.04, R + 0.04, 192), new THREE.MeshBasicMaterial({ color: 0x8090c0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    root.add(ring);
    let moon: THREE.Mesh | null = null;
    if (id === "earth") { moon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 12), M.clay(0xd8d2de, { emissive: 0xd8d2de, emissiveIntensity: 0.2 })); root.add(moon); }
    return { b, R, w, a: rnd() * Math.PI * 2, moon };
  });
  // the Asteroid Belt, between Mars and Jupiter
  const belt: number[] = [];
  for (let i = 0; i < 1400; i++) { const a = rnd() * Math.PI * 2, d = 29 + (rnd() - 0.5) * 3.4; belt.push(Math.cos(a) * d, (rnd() - 0.5) * 0.8, Math.sin(a) * d); }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute("position", new THREE.Float32BufferAttribute(belt, 3));
  const beltPts = new THREE.Points(bg, new THREE.PointsMaterial({ color: 0xb8a48e, size: 0.18, transparent: true, opacity: 0.8 }));
  root.add(beltPts, starfield(2600, 900, rnd));

  // the fly-through: in from beyond Deep Space for ~6 s, then a slow, high orbit
  const from = new THREE.Vector3(30, 16, 150), look = new THREE.Vector3(), cam = new THREE.Vector3();
  const stop = stage.onUpdate((dt, T) => {
    sun.spin.rotation.y += dt * 0.05;
    for (const p of planets) {
      p.a += p.w * dt * 0.6;
      p.b.group.position.set(Math.cos(p.a) * p.R, 0, Math.sin(p.a) * p.R);
      p.b.spin.rotation.y += dt * 0.4;
      if (p.moon) p.moon.position.copy(p.b.group.position).add(new THREE.Vector3(Math.cos(T * 1.3) * 2.3, 0.3, Math.sin(T * 1.3) * 2.3));
    }
    beltPts.rotation.y += dt * 0.02;
    const k = ease(Math.min(1, T / 6.5)), orbit = T * 0.045 + 0.9;
    const drift = new THREE.Vector3(Math.cos(orbit) * 64, 19 + Math.sin(T * 0.13) * 3, Math.sin(orbit) * 64);
    cam.lerpVectors(from, drift, k);
    camera.position.copy(cam);
    // look a little below the Sun, so the title sits over open space and the Sun glows under it
    look.set(0, -6 + 6 * (1 - k), 0);
    camera.lookAt(look);
  });

  return {
    dispose() { stop(); scene.remove(root); },
  };
}
