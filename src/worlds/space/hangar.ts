import * as THREE from "three";
import { add, canvasTexture, type Materials } from "@/engine/materials";
import type { Rng } from "@/engine/util";
import { makeNova } from "./cast";
import { makeRocket } from "./ships";

/**
 * The Starfleet hangar: a titanium deck with launch-pad rings, ribbed arches with light strips,
 * an Earthrise through the open bay, the cadet's rocket on the pad in cryo-mist, and Nova.
 */
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
  const padMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 1.6 });
  add(g, new THREE.RingGeometry(2.5, 2.9, 96), padMat, 0, 0.02, -1.8, nc).rotation.x = -Math.PI / 2;
  add(g, new THREE.RingGeometry(3.6, 3.74, 96), M.glow(0xfbbf24, 1.4), 0, 0.02, -1.8, nc).rotation.x = -Math.PI / 2;
  add(g, new THREE.CylinderGeometry(2.45, 2.6, 0.18, 64), M.clay(0x3b4660, { metalness: 0.5, roughness: 0.4 }), 0, 0.09, -1.8);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4, clamp = add(g, new THREE.BoxGeometry(0.3, 1.2, 0.3), M.clay(0x4b5670, { metalness: 0.6, roughness: 0.35 }), Math.cos(a) * 1.4, 0.6, -1.8 + Math.sin(a) * 1.4);
    clamp.rotation.y = -a;
  }

  const rib = M.clay(0x1b263b, { roughness: 0.45, metalness: 0.55 }), strip = M.glow(0x38bdf8, 1.4);
  for (const z of [-9, -4, 1, 6]) {
    add(g, new THREE.TorusGeometry(12.2, 0.48, 16, 64, Math.PI), rib, 0, 0, z);
    add(g, new THREE.TorusGeometry(11.65, 0.07, 8, 64, Math.PI), strip, 0, 0, z, nc);
  }
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.18, 0.05, 0.85), strip, s * 5, 0.03, 4 - i * 2.6, nc);
  // crates and a fuel cart give the deck scale
  for (const [x, z, c] of [[-7, -2, 0xb98a4a], [-6.2, -3.1, 0x8a6a4a], [7.2, -2.4, 0x5a6b8a]] as [number, number, number][]) add(g, new THREE.BoxGeometry(1.1, 1.1, 1.1), M.clay(c, { roughness: 0.7 }), x, 0.55, z).rotation.y = rnd();

  // Earthrise through the bay
  const space = new THREE.Group();
  space.position.set(0, 6, -36);
  g.add(space);
  const em = canvasTexture(512, 256);
  {
    const x = em.ctx, grd = x.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, "#3f7fc4"); grd.addColorStop(1, "#2c62a8");
    x.fillStyle = grd; x.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 90; i++) { x.fillStyle = ["#6fb86c", "#93c76e", "#d9c58f"][i % 3]; x.beginPath(); x.ellipse(rnd() * 512, 40 + rnd() * 180, 10 + rnd() * 40, 6 + rnd() * 20, rnd() * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 80; i++) { x.fillStyle = "rgba(255,255,255,0.55)"; x.beginPath(); x.ellipse(rnd() * 512, rnd() * 256, 8 + rnd() * 30, 3 + rnd() * 8, 0, 0, 7); x.fill(); }
    em.texture.needsUpdate = true;
  }
  const earth = add(space, new THREE.SphereGeometry(12, 64, 48), M.clay(0xffffff, { map: em.texture, roughness: 0.7, emissive: 0x1d4ed8, emissiveIntensity: 0.18 }), -10, 4, -8, nc);
  const atm = new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(0x7fc4ff) } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: "varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}",
    fragmentShader: "uniform vec3 c;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.0-max(dot(vN,vV),0.0),2.4);gl_FragColor=vec4(c*f*2.0,f);}",
  });
  add(space, new THREE.SphereGeometry(12.8, 64, 48), atm, -10, 4, -8, nc);
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
  const cyan = new THREE.PointLight(0x38bdf8, 0, 26), gold = new THREE.PointLight(0xfbbf24, 0, 20);
  cyan.position.set(-6, 5, -4);
  gold.position.set(6, 3.5, 3);
  g.add(cyan, gold);

  const mistPos: number[] = [];
  for (let i = 0; i < 160; i++) { const a = rnd() * Math.PI * 2, r = 0.6 + rnd() * 2.8; mistPos.push(Math.cos(a) * r, rnd() * 2, -1.8 + Math.sin(a) * r); }
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute("position", new THREE.Float32BufferAttribute(mistPos, 3));
  g.add(new THREE.Points(mistGeo, new THREE.PointsMaterial({ color: 0xbae6fd, size: 0.16, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })));

  let launch = 0;
  const BASE = 0.18 + 1.78 * 1.7; // pad top + rocket half-height (to the nozzle) at 1.7 scale
  const reset = () => { launch = 0; rocket.group.position.set(0, BASE, -1.8); rocket.group.rotation.set(0, 0, 0); padMat.emissive.setHex(0x38bdf8); };
  reset();
  return {
    group: g, nova, rocket,
    lights(on: boolean) { key.intensity = on ? 1.6 : 0; cyan.intensity = on ? 4 : 0; gold.intensity = on ? 2.4 : 0; },
    launch() { launch = 0.001; },
    reset,
    update(T: number, dt: number, voice: number, novaTalking: boolean) {
      earth.rotation.y += dt * 0.05;
      nova.animate(T, dt, 2.8, novaTalking ? voice : 0);
      const base = BASE;
      if (launch > 0) {
        launch += dt;
        const k = Math.min(1, launch / 3.2), e = Math.pow(k, 2.6);
        rocket.flicker(T, 1.6 + e * 1.4);
        rocket.group.position.set(0, base + e * 16, -1.8 - e * 48);
        rocket.group.rotation.x = -e * 1.15;
        padMat.emissive.setHex(0xfbbf24);
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
