import * as THREE from "three";
import type { Stage } from "@/engine/stage";
import { seeded } from "@/engine/util";
import { buildHangar } from "./hangar";
import { BLASTERS, makeInvader, makeRocket, type RocketStyle } from "./ships";

/**
 * The Hangar (SPEC §2.6): the intro's Starfleet hangar, with the cadet's own rocket on the pad,
 * built live from the chosen hull paint and thruster trail. Every couple of seconds it test-fires
 * the chosen blaster at a practice drone, so all three upgrade slots show before they are bought.
 */
export type ShipStyle = RocketStyle & { blaster?: string };

export function mountHangarBay(stage: Stage, initial: ShipStyle) {
  const { scene, camera, mats: M } = stage, rnd = seeded(31);
  const at = new THREE.Vector3(0, 0, 0);
  const h = buildHangar(scene, M, rnd, at);
  h.lights(true);
  h.rocket.group.visible = false; // the set's own rocket; ours is rebuilt per style
  scene.background = new THREE.Color(0x060a16);
  scene.fog = null;
  camera.fov = 44;
  camera.far = 3000;
  camera.updateProjectionMatrix();
  Object.assign(stage.bloom, { strength: 0.45, radius: 0.4, threshold: 1.1 });
  stage.renderer.toneMappingExposure = 1.05;
  scene.add(new THREE.HemisphereLight(0xc8d8ff, 0x1a2244, 0.7));

  const pad = new THREE.Group();
  pad.position.set(0, 0.18 + 1.78 * 1.5 + 1.1, -1.8); // hovering, so the thruster trail shows
  h.group.add(pad);
  let rocket = makeRocket(M, initial), style: ShipStyle = { ...initial };
  const setRocket = () => {
    pad.remove(rocket.group);
    rocket = makeRocket(M, style);
    rocket.group.scale.setScalar(1.5);
    // the trail keeps its colour but stays near the bloom threshold: a flame, not a white blob
    rocket.flames.forEach((m, i) => m.color.multiplyScalar((i ? 1.1 : 0.85) / Math.max(m.color.r, m.color.g, m.color.b)));
    pad.add(rocket.group);
  };
  setRocket();

  const drone = new THREE.Group();
  drone.add(makeInvader(M));
  drone.scale.setScalar(1.1);
  drone.position.set(-3.8, 6.6, -3.6);
  h.group.add(drone);
  let pop = -10;

  const balls: { m: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t0: number }[] = [];
  const geo = new THREE.SphereGeometry(0.16, 14, 10);
  function shoot(T: number) {
    const b = BLASTERS[(style.blaster ?? "plasma-ball") as keyof typeof BLASTERS] ?? BLASTERS["plasma-ball"];
    const mat = M.glow(b.color, 1.6);
    const from = rocket.group.localToWorld(new THREE.Vector3(0, 1.6, 0)), to = drone.getWorldPosition(new THREE.Vector3());
    for (const side of b.twin ? [-0.16, 0.16] : [0]) {
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(1, 1, b.stretch).multiplyScalar(b.size * 1.4);
      const f = from.clone().add(new THREE.Vector3(side, 0, 0));
      m.position.copy(f);
      scene.add(m);
      balls.push({ m, from: f, to: to.clone(), t0: T });
    }
  }

  let next = 1.2;
  const stop = stage.onUpdate((dt, T) => {
    h.update(T, dt, 0, false);
    pad.rotation.y += dt * 0.45;
    rocket.flicker(T, 1.15 + Math.sin(T * 2) * 0.1);
    rocket.group.position.y = Math.sin(T * 1.8) * 0.04;
    drone.position.y = 6.6 + Math.sin(T * 1.4) * 0.25;
    drone.rotation.y = Math.sin(T) * 0.5;
    const k = Math.max(0, 1 - (T - pop) * 2.5);
    drone.scale.setScalar(1.1 * (k > 0 ? Math.max(0.001, 1 - k) : 1));
    if (T > next) { shoot(T); next = T + 2.4; }
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i], q = Math.min(1, (T - b.t0) / 0.5);
      b.m.position.lerpVectors(b.from, b.to, q);
      b.m.lookAt(b.to);
      if (q >= 1) { scene.remove(b.m); balls.splice(i, 1); pop = T; }
    }
    // frame the rocket on its pad; on a phone, from further back
    // phones: the dock covers the bottom half, so the rocket sits in the top half
    const phone = camera.aspect < 1, dist = phone ? 24 : 15.5;
    camera.position.set(phone ? -0.6 : 1.4, phone ? 4.2 : 5.2, dist);
    camera.lookAt(phone ? -0.6 : 2.6, phone ? -1.2 : 4.0, -2);
  });

  return {
    /** Show a style now (a preview, or what was just bought). */
    setStyle(s: ShipStyle) {
      const rebuild = s.hull !== style.hull || s.thruster !== style.thruster;
      style = { ...s };
      if (rebuild) setRocket();
      next = Math.min(next, stage.time + 0.3);
    },
    dispose() { stop(); for (const b of balls) scene.remove(b.m); scene.remove(h.group); },
  };
}
export type HangarBay = ReturnType<typeof mountHangarBay>;
