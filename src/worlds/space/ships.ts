import * as THREE from "three";
import { add, outline, PALETTE, type Materials } from "@/engine/materials";

/** The cadet's rocket: a clay body with coral trim, a glowing porthole and a flickering flame. */
export function makeRocket(M: Materials) {
  const rocket = new THREE.Group(), body = new THREE.Group();
  rocket.add(body);
  body.position.y = -1.5; // pivot near the middle, so it can tilt and recoil naturally
  const V = (x: number, y: number) => new THREE.Vector2(x, y);
  const hull = M.clay(PALETTE.clay, { roughness: 0.55, metalness: 0.05 }), trim = M.clay(PALETTE.coral, { roughness: 0.55 }), dark = M.clay(PALETTE.slate);
  outline(add(body, new THREE.LatheGeometry([V(0, 0), V(0.42, 0), V(0.5, 0.25), V(0.58, 0.9), V(0.6, 1.5), V(0.56, 2.0), V(0.47, 2.35)], 48), hull), M);
  outline(add(body, new THREE.LatheGeometry([V(0.47, 2.35), V(0.36, 2.65), V(0.2, 2.9), V(0.05, 3.02), V(0, 3.04)], 48), trim), M);
  const band = add(body, new THREE.TorusGeometry(0.6, 0.06, 12, 48), trim, 0, 1.15, 0);
  band.rotation.x = Math.PI / 2;
  add(body, new THREE.SphereGeometry(0.2, 24, 16), M.glow(PALETTE.sky, 1.4), 0, 1.65, 0.52, { cast: false });
  add(body, new THREE.TorusGeometry(0.22, 0.045, 10, 32), dark, 0, 1.65, 0.53);
  outline(add(body, new THREE.CylinderGeometry(0.3, 0.42, 0.32, 32), dark, 0, -0.12, 0), M);
  const fin = new THREE.Shape();
  fin.moveTo(0, 0.95); fin.lineTo(0.7, 0.2); fin.lineTo(0.78, -0.35); fin.lineTo(0.36, -0.12); fin.lineTo(0, 0); fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2 });
  finGeo.translate(0, 0, -0.04);
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3 - Math.PI / 2, f = add(body, finGeo, trim, Math.cos(a) * 0.5, 0.05, Math.sin(a) * 0.5);
    f.rotation.y = -a;
    outline(f, M);
  }
  const outer = M.additive(2.6, 2.8, 1.4, 0.85), inner = M.additive(4, 3.6, 2.4, 0.95);
  const flameOut = add(body, new THREE.ConeGeometry(0.3, 1.5, 24, 1, true), outer, 0, -1.0, 0, { cast: false });
  const flameIn = add(body, new THREE.ConeGeometry(0.16, 0.9, 24, 1, true), inner, 0, -0.72, 0, { cast: false });
  flameOut.rotation.x = flameIn.rotation.x = Math.PI;
  return {
    group: rocket,
    /** Where shots leave from, in world space. */
    muzzle: () => rocket.localToWorld(new THREE.Vector3(0, 1.6, 0)),
    flicker(T: number) {
      const f = 1 + Math.sin(T * 40) * 0.08 + Math.sin(T * 23) * 0.06;
      flameOut.scale.set(1, f, 1);
      flameIn.scale.set(1, f * 1.05, 1);
    },
  };
}

/** One invader: a green clay saucer with a toon ink outline, glass dome, neon eyes and a ring of running lights. */
export function makeInvader(M: Materials) {
  const g = new THREE.Group(), noCast = { cast: false };
  const body = new THREE.SphereGeometry(0.55, 32, 16);
  body.scale(1, 0.5, 1);
  outline(add(g, body, M.clay(PALETTE.invader, { roughness: 0.5 })), M);
  add(g, new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.clay(0xb8f5ff, { transparent: true, opacity: 0.65, roughness: 0.2, emissive: PALETTE.cyan, emissiveIntensity: 0.15 }), 0, 0.12, 0);
  const eye = M.glow(PALETTE.cyan, 2.2), running = M.glow(PALETTE.cyan, 0.9); // running lights stay under the bloom threshold
  for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.075, 12, 8), eye, s * 0.12, 0.26, 0.2, noCast);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    add(g, new THREE.SphereGeometry(0.05, 8, 6), running, Math.cos(a) * 0.52, 0, Math.sin(a) * 0.52, noCast);
  }
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5, leg = add(g, new THREE.ConeGeometry(0.07, 0.3, 8), M.clay(PALETTE.slate), Math.cos(a) * 0.28, -0.3, Math.sin(a) * 0.28);
    leg.rotation.x = Math.PI;
  }
  return g;
}
