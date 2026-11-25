import * as THREE from "three";
import { COLOR, hex, LINE } from "@/design/tokens";
import { add, canvasTexture, type Materials } from "@/engine/materials";
import type { Rng } from "@/engine/util";
import { makeNova } from "./cast";
import { makeBody } from "./planets";
import { makeRocket } from "./ships";

/**
 * The Starfleet hangar of the intro film: a titanium deck with a launch pad ringed by a hairline and
 * a dashed gold orbit, ribbed arches with matte light strips, an Earthrise through the open bay, the
 * cadet's rocket standing on its fins on the pad in cryo-mist, and Nova. Nothing here glows except
 * the pad at the Launch moment. (The Hangar screen itself is a separate product shot: hangarBay.ts.)
 */

/** A soft round dot, so mist particles are never square. */
const softDot = () => {
  const n = 32, d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2), a = Math.round(255 * Math.max(0, 1 - r) ** 1.5);
    d.set([a, a, a, 255], (y * n + x) * 4);
  }
  const t = new THREE.DataTexture(d, n, n);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};
export function buildHangar(scene: THREE.Scene, M: Materials, rnd: Rng, at: THREE.Vector3) {
  const g = new THREE.Group();
  g.position.copy(at);
  scene.add(g);
  const nc = { cast: false };

  const deck = canvasTexture(512, 512);
  {
    const x = deck.ctx;
    x.fillStyle = "#2a3346"; x.fillRect(0, 0, 512, 512);
    x.strokeStyle = "rgba(160,180,210,0.25)"; x.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.02 + rnd() * 0.03})`; x.fillRect(rnd() * 512, rnd() * 512, 30 + rnd() * 60, 2); }
    deck.texture.wrapS = deck.texture.wrapT = THREE.RepeatWrapping;
    deck.texture.repeat.set(6, 6);
    deck.texture.needsUpdate = true;
  }
  add(g, new THREE.PlaneGeometry(40, 40), M.clay(0xffffff, { map: deck.texture, roughness: 0.5, metalness: 0.45 }), 0, 0, 0, nc).rotation.x = -Math.PI / 2;
  // the pad's ring: a matte sky band at rest; at the Launch moment it lights gold (the one allowed glow)
  const padMat = new THREE.MeshStandardMaterial({ color: hex(COLOR.sky), emissive: hex(COLOR.sky), emissiveIntensity: 0.25, roughness: 0.7 });
  add(g, new THREE.RingGeometry(2.55, 2.68, 96), padMat, 0, 0.02, -1.8, nc).rotation.x = -Math.PI / 2;
  {
    const pts = Array.from({ length: 193 }, (_, i) => { const a = (i / 192) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 3.7, 0.03, Math.sin(a) * 3.7 - 1.8); });
    const orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: hex(COLOR.gold), transparent: true, opacity: 0.7, dashSize: 0.16, gapSize: 0.26 }));
    orbit.computeLineDistances();
    g.add(orbit);
    const ring = add(g, new THREE.RingGeometry(4.6, 4.63, 128), new THREE.MeshBasicMaterial({ color: hex(COLOR.approach), transparent: true, opacity: Number(LINE[1].slice(LINE[1].lastIndexOf(",") + 1, -1)), depthWrite: false }), 0, 0.02, -1.8, nc);
    ring.rotation.x = -Math.PI / 2;
  }
  add(g, new THREE.CylinderGeometry(2.45, 2.6, 0.18, 64), M.clay(0x3b4660, { metalness: 0.5, roughness: 0.4 }), 0, 0.09, -1.8);
  // no clamps: the rocket stands on its own fins

  const rib = M.clay(0x1b263b, { roughness: 0.45, metalness: 0.55 }), strip = M.glow(hex(COLOR.sky), 0.45); // matte light strips: under the bloom threshold
  for (const z of [-9, -4, 1, 6]) {
    add(g, new THREE.TorusGeometry(12.2, 0.48, 16, 64, Math.PI), rib, 0, 0, z);
    add(g, new THREE.TorusGeometry(11.65, 0.07, 8, 64, Math.PI), strip, 0, 0, z, nc);
  }
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.18, 0.05, 0.85), strip, s * 5, 0.03, 4 - i * 2.6, nc);

  // Earthrise through the bay
  const space = new THREE.Group();
  space.position.set(0, 6, -36);
  g.add(space);
  // the one Earth from the planet factory (the same Earth as the title, the film's opening and the battles)
  const earth = makeBody(M, "earth", 12, { lod: "high", look: "hero" });
  earth.group.position.set(-10, 4, -8);
  space.add(earth.group);
  add(space, new THREE.SphereGeometry(3.2, 40, 28), M.clay(0xd8d2e2, { roughness: 0.9 }), 11, 8, -4, nc);
  const sp: number[] = [];
  for (let i = 0; i < 900; i++) sp.push((rnd() - 0.5) * 90, -5 + rnd() * 45, -24 - rnd() * 55);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xe2e8f0, size: 1.5, sizeAttenuation: false, fog: false })));

  // the rocket on the pad, and Nova
  const rocket = makeRocket(M);
  rocket.group.scale.setScalar(1.7);
  g.add(rocket.group);
  const nova = makeNova(M);
  nova.group.position.set(3.2, 2.8, 0.8);
  nova.group.scale.setScalar(1.3);
  g.add(nova.group);

  const key = new THREE.DirectionalLight(0xfff1d6, 0);
  key.position.set(at.x + 6, 9, at.z + 8);
  key.target.position.set(at.x, 1, at.z - 1.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
  scene.add(key, key.target);
  const cyan = new THREE.PointLight(hex(COLOR.sky), 0, 26), gold = new THREE.PointLight(hex(COLOR.gold), 0, 20);
  cyan.position.set(-6, 5, -4);
  gold.position.set(6, 3.5, 3);
  g.add(cyan, gold);

  const mistPos: number[] = [];
  for (let i = 0; i < 160; i++) { const a = rnd() * Math.PI * 2, r = 0.6 + rnd() * 2.8; mistPos.push(Math.cos(a) * r, rnd() * 2, -1.8 + Math.sin(a) * r); }
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute("position", new THREE.Float32BufferAttribute(mistPos, 3));
  g.add(new THREE.Points(mistGeo, new THREE.PointsMaterial({ color: hex(COLOR.sky), size: 0.22, alphaMap: softDot(), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })));

  let launch = 0;
  const BASE = 0.18 + 1.94 * 1.7; // pad top + rocket half-height (to the tips of its fins, which it stands on) at 1.7 scale
  const reset = () => { launch = 0; rocket.group.position.set(0, BASE, -1.8); rocket.group.rotation.set(0, 0, 0); padMat.emissive.setHex(hex(COLOR.sky)); padMat.emissiveIntensity = 0.25; };
  reset();
  return {
    group: g, nova, rocket,
    lights(on: boolean) { key.intensity = on ? 1.6 : 0; cyan.intensity = on ? 4 : 0; gold.intensity = on ? 2.4 : 0; },
    launch() { launch = 0.001; },
    reset,
    update(T: number, dt: number, voice: number, novaTalking: boolean) {
      earth.spin.rotation.y += dt * 0.05;
      earth.update(dt);
      nova.animate(T, dt, 2.8, novaTalking ? voice : 0);
      const base = BASE;
      if (launch > 0) {
        launch += dt;
        const k = Math.min(1, launch / 3.2), e = Math.pow(k, 2.6);
        rocket.flicker(T, 1.6 + e * 1.4);
        rocket.group.position.set(0, base + e * 16, -1.8 - e * 48);
        rocket.group.rotation.x = -e * 1.15;
        padMat.emissive.setHex(hex(COLOR.gold));
        padMat.emissiveIntensity = 1.6; // the Launch moment: the one glow in the hangar
      } else {
        rocket.flicker(T, 0.25 + Math.sin(T * 2) * 0.05);
        rocket.group.position.y = base + Math.sin(T * 1.8) * 0.03;
      }
      const mp = mistGeo.attributes.position;
      for (let i = 0; i < mp.count; i++) { let y = mp.getY(i) + dt * (launch > 0 ? 4.5 : 0.45); if (y > 2.6) y = 0.05; mp.setY(i, y); }
      mp.needsUpdate = true;
    },
  };
}
