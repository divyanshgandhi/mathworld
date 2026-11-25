import * as THREE from "three";
import type { Stage } from "@/engine/stage";
import { seeded } from "@/engine/util";
import type { PlanetId } from "@/rig/pools";
import { COLOR, hex, MOTION } from "@/design/tokens";
import { buildEarth, EARTH_RADIUS } from "./earth";
import { makeBody, rockGeometry, rockMaterial, starfield, type Body } from "./planets";

/**
 * Where each battle happens. No planet ever sits behind the fleet: a world is either the ground (its
 * horizon just under the rocket, at the bottom of the free area) or a body tucked into a corner of the
 * screen outside the fleet's box. Both are placed every frame from the camera (`SkyView`), so they keep
 * their place at every aspect ratio and fleet size. Every planet comes from the one planet factory
 * (makeBody); the light is the arena's. Add-ons: the Asteroid Belt's loose rocks, Earth seen from the Moon.
 */
type Spot =
  /** The ground: the body's top sits `up` px above the bottom of the free area, right under the rocket. */
  | { kind: "ground"; radius: number; depth: number; up: number }
  /** A body in a corner: `side` of the screen, `r` its radius as a share of the free area's smaller side. */
  | { kind: "corner"; radius: number; depth: number; side: "left" | "right"; r: number; out: number };
interface Place { main: Spot; rocks?: boolean; earth?: Spot }
const PLACES: Record<PlanetId, Place> = {
  earth: { main: { kind: "ground", radius: EARTH_RADIUS, depth: -70, up: 6 } },
  moon: { main: { kind: "ground", radius: 70, depth: -40, up: 6 }, earth: { kind: "corner", radius: 5, depth: -160, side: "right", r: 0.075, out: -0.7 } },
  mars: { main: { kind: "ground", radius: 70, depth: -50, up: 6 } },
  "asteroid-belt": { main: { kind: "corner", radius: 9, depth: -200, side: "left", r: 0.09, out: -0.6 }, rocks: true },
  jupiter: { main: { kind: "corner", radius: 64, depth: -380, side: "left", r: 0.3, out: 0.25 } },
  saturn: { main: { kind: "corner", radius: 34, depth: -320, side: "left", r: 0.16, out: -0.2 } },
  uranus: { main: { kind: "corner", radius: 30, depth: -320, side: "left", r: 0.15, out: -0.2 } },
  "deep-space": { main: { kind: "corner", radius: 12, depth: -220, side: "right", r: 0.08, out: -0.8 } },
};

/** What the sky needs from the camera to keep its bodies out of the fleet's way. */
export interface SkyView {
  /** The world point on the plane `z` (battle-local depth) shown `dx`, `dy` px from the free area's centre (y up). */
  at(dx: number, dy: number, z: number): THREE.Vector3;
  /** CSS px per world unit on the plane `z` (battle-local depth). */
  ppu(z: number): number;
  /** The free area, in CSS px. */
  fw: number; fh: number;
}

export function mountSky(stage: Stage, planet: PlanetId, origin: THREE.Vector3) {
  const { scene, mats: M } = stage, rnd = seeded(23), root = new THREE.Group();
  scene.add(root);
  const place = PLACES[planet];
  let earth: ReturnType<typeof buildEarth> | null = null, body: Body | null = null, home: Body | null = null;
  const rocks: { m: THREE.Mesh; v: THREE.Vector3 }[] = [];

  if (planet === "earth") {
    earth = buildEarth(scene, M, rnd, origin.clone().add(new THREE.Vector3(6, -42, -46)));
    earth.sun.intensity = 1.2;
    body = earth.earth;
    earth.moon.group.visible = false; // the Moon would hang behind the fleet; the battle is above Earth
  } else {
    body = makeBody(M, planet, place.main.radius, { lod: "high" });
    root.add(body.group);
    if (place.earth) {
      // Earth, seen from the Moon: the same Earth as everywhere else, small, in a corner
      home = makeBody(M, "earth", place.earth.radius, { lod: "low" });
      home.spin.rotation.y = -0.6;
      root.add(home.group);
    }
    if (place.rocks) {
      // loose rocks far back and low, so none sits behind a squad
      const rock = rockMaterial();
      for (let i = 0; i < 60; i++) {
        const m = new THREE.Mesh(rockGeometry(0.6 + rnd() * 3, rnd), rock);
        m.position.set(origin.x + (rnd() - 0.5) * 240, origin.y - 70 - rnd() * 40, origin.z - 120 - rnd() * 140);
        m.scale.set(1, 0.6 + rnd() * 0.6, 0.8 + rnd() * 0.5);
        root.add(m);
        rocks.push({ m, v: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.4) });
      }
    }
    root.add(starfield(2000, 900, rnd, origin));
  }

  /** Put `b` (made at `radius`) where `spot` says, for this frame's camera. */
  const placeBody = (g: THREE.Object3D, radius: number, spot: Spot, view: SkyView) => {
    const z = spot.depth, ppu = view.ppu(z);
    if (!ppu) return;
    if (spot.kind === "ground") {
      // the top of the sphere at `up` px over the free area's bottom edge, centred under the rocket
      const top = view.at(0, -view.fh / 2 + spot.up, z);
      g.position.set(top.x, top.y - radius, top.z);
      g.scale.setScalar(1);
    } else {
      const rPx = spot.r * Math.min(view.fw, view.fh), s = rPx / ppu / radius;
      const sx = spot.side === "left" ? -1 : 1, c = view.at(sx * (view.fw / 2 - rPx * spot.out), -view.fh / 2 + rPx * spot.out, z);
      g.position.copy(c);
      g.scale.setScalar(s);
    }
  };

  // a planet cleared: a gold hairline ring draws itself round the planet
  const ringPts = Array.from({ length: 129 }, (_, i) => { const a = (i / 128) * Math.PI * 2; return new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); });
  const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), new THREE.LineBasicMaterial({ color: hex(COLOR.gold), transparent: true, opacity: 0.9, toneMapped: false }));
  ring.geometry.setDrawRange(0, 0);
  ring.rotation.set(0.32, 0, 0.18);
  ring.visible = false;
  root.add(ring);
  let ringT = -1, clock = 0;

  return {
    /** Keep the bodies in their places for this frame's camera (`view`); spin them a little. */
    update(dt: number, view?: SkyView) {
      clock += dt;
      if (view && body) placeBody(body.group, place.main.radius, place.main, view);
      if (view && home && place.earth) placeBody(home.group, place.earth.radius, place.earth, view);
      earth?.update(dt);
      if (body && !earth) { body.spin.rotation.y += dt * 0.02; body.update(dt); }
      if (home) home.update(dt);
      for (const r of rocks) { r.m.rotation.x += r.v.x * dt; r.m.rotation.y += r.v.y * dt; }
      if (ringT >= 0 && body) {
        const k = Math.min(1, (clock - ringT) / (MOTION.moment / 1000));
        ring.position.copy(body.group.position);
        ring.scale.setScalar(body.group.scale.x * place.main.radius * 1.32);
        ring.geometry.setDrawRange(0, Math.max(2, Math.round(129 * (1 - Math.pow(1 - k, 3)))));
      }
    },
    /** The planet is cleared: its gold ring draws in (it sits behind the HUD's clear card). */
    clearRing() { if (!body) return; ringT = clock; ring.visible = true; },
    dispose() {
      scene.remove(root);
      if (earth) { scene.remove(earth.group, earth.sun, earth.sun.target); }
    },
  };
}
export type Sky = ReturnType<typeof mountSky>;
