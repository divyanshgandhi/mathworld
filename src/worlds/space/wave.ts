import * as THREE from "three";
import { add, PALETTE } from "@/engine/materials";
import { sfx, unlockAudio } from "@/engine/sound";
import type { Stage } from "@/engine/stage";
import { seeded } from "@/engine/util";
import { makeInvader, makeRocket } from "./ships";

/** The Math World look in space: soft clay light, cool rim, bloom only on things that glow. */
export const SPACE_LOOK = {
  background: PALETTE.ink2,
  exposure: 1.0,
  bloom: { strength: 0.6, radius: 0.3, threshold: 1.0 },
  hemi: { sky: 0xc8d8ff, ground: 0x4a3a58, intensity: 0.8 },
  sun: { color: 0xfff1dc, intensity: 2.5, position: [-8, 12, 6] as const },
  rim: { color: 0x7dfcff, intensity: 1.0, position: [5, 5, -10] as const },
};

/**
 * A wave on the Moon: `rows` squadrons of `perRow` invaders fly in, the rocket fires one shot per
 * invader, they burst, and the next wave arrives. This is the look and the feel; the maths of
 * loading shots comes with the core loop.
 */
export function mountWave(stage: Stage, { rows = 3, perRow = 4 } = {}) {
  const { scene, camera, mats: M } = stage, L = SPACE_LOOK, rnd = seeded(7);
  scene.background = new THREE.Color(L.background);
  stage.renderer.toneMappingExposure = L.exposure;
  Object.assign(stage.bloom, L.bloom);
  scene.add(new THREE.HemisphereLight(L.hemi.sky, L.hemi.ground, L.hemi.intensity));
  const sun = new THREE.DirectionalLight(L.sun.color, L.sun.intensity);
  sun.position.set(...L.sun.position);
  sun.target.position.set(0, 1, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 90 });
  sun.shadow.bias = -0.0005;
  const rim = new THREE.DirectionalLight(L.rim.color, L.rim.intensity);
  rim.position.set(...L.rim.position);
  scene.add(sun, sun.target, rim);

  // the Moon's surface: the top of a big sphere, pocked with craters
  const craters = Array.from({ length: 46 }, () => {
    const th = 0.02 + rnd() * 0.5, ph = rnd() * Math.PI * 2;
    return { d: new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)), r: 0.015 + rnd() * 0.045, h: 0.4 + rnd() * 1.2 };
  });
  const ground = new THREE.SphereGeometry(80, 220, 70, 0, Math.PI * 2, 0, 0.6), pos = ground.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let h = 0.25 * Math.sin(v.x * 40) * Math.sin(v.z * 37) + 0.15 * Math.sin(v.x * 90 + v.z * 70);
    for (const c of craters) {
      const x = Math.acos(Math.min(1, v.dot(c.d))) / c.r;
      if (x < 1) h -= c.h * (1 - x * x);
      else if (x < 1.4) h += c.h * 0.35 * (1 - (x - 1) / 0.4);
    }
    v.multiplyScalar(80 + h);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  ground.computeVertexNormals();
  add(scene, ground, M.clay(0xd6cde0, { roughness: 0.95 }), 0, -80, 0, { cast: false });

  // sky: a ringed planet, a small blue one, stars
  const bands = document.createElement("canvas");
  bands.width = 8; bands.height = 256;
  const bx = bands.getContext("2d") as CanvasRenderingContext2D;
  for (let y = 0; y < 256; y++) { const c = Math.round(200 + 40 * Math.sin(y * 0.15) + 15 * Math.sin(y * 0.53)); bx.fillStyle = `rgb(${c},${c},${c})`; bx.fillRect(0, y, 8, 1); }
  const bandTex = new THREE.CanvasTexture(bands);
  bandTex.colorSpace = THREE.SRGBColorSpace;
  const planet = add(scene, new THREE.SphereGeometry(16, 64, 32), M.clay(0xffb995, { map: bandTex }), -64, 36, -140, { cast: false });
  const ring = add(planet, new THREE.RingGeometry(20, 30, 96), M.clay(0xf6dfc6, { side: THREE.DoubleSide, transparent: true, opacity: 0.8, emissive: 0xffd9a0, emissiveIntensity: 0.2 }), 0, 0, 0, { cast: false });
  ring.rotation.set(-1.2, 0.25, 0.3);
  add(scene, new THREE.SphereGeometry(6, 48, 24), M.clay(0x96d7ff, { map: bandTex }), 60, 24, -170, { cast: false });
  const sp: number[] = [];
  for (let i = 0; i < 1800; i++) { const s = new THREE.Vector3(rnd() * 2 - 1, rnd() * 1.2 - 0.1, rnd() * 2 - 1).normalize().multiplyScalar(400); sp.push(s.x, s.y, s.z); }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));

  const rocket = makeRocket(M);
  rocket.group.rotation.x = -1.0;
  rocket.group.scale.setScalar(0.72);
  scene.add(rocket.group);

  // squadrons: one row per squadron, so "3 × 4" reads as three rows of four
  const invaders = Array.from({ length: rows * perRow }, (_, i) => {
    const r = rows - 1 - Math.floor(i / perRow), c = i % perRow, g = makeInvader(M);
    const home = new THREE.Vector3((c - (perRow - 1) / 2) * 1.6, 2.9 + r * 1.9, 1);
    g.scale.setScalar(1.3);
    scene.add(g);
    return { g, home, ph: rnd() * 6, delay: 0, alive: true, dying: 0 };
  });

  const ballGeo = new THREE.SphereGeometry(0.14, 16, 12), partGeo = new THREE.IcosahedronGeometry(0.09, 0), flashGeo = new THREE.SphereGeometry(0.3, 16, 12);
  const ballMat = M.glow(PALETTE.shot, 2.2);
  type Ball = { m: THREE.Mesh; from: THREE.Vector3; i: number; t0: number };
  type Burst = { parts: { m: THREE.Mesh; v: THREE.Vector3 }[]; flash: THREE.Mesh; mat: THREE.MeshBasicMaterial; t0: number };
  const balls: Ball[] = [], bursts: Burst[] = [];
  let phase: "enter" | "aim" | "fire" = "enter", pt = 0, shot = 0, next = 0, shake = 0, recoil = 0;
  const camBase = new THREE.Vector3(0, 3.9, 12.5), look = new THREE.Vector3(0, 3.4, -3);
  const hud: { onAmmo: (left: number) => void } = { onAmmo: () => {} };

  const wave = () => {
    invaders.forEach((v, i) => { v.alive = true; v.dying = 0; v.g.visible = true; v.g.scale.setScalar(1.3); v.delay = i * 0.07; });
    phase = "enter"; pt = 0; shot = 0; next = 0;
    hud.onAmmo(rows * perRow);
  };
  const burst = (p: THREE.Vector3, T: number) => {
    const mat = M.additive(1.4, 2.6, 1.2);
    const parts = Array.from({ length: 18 }, () => {
      const m = new THREE.Mesh(partGeo, mat);
      m.position.copy(p);
      scene.add(m);
      return { m, v: new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(2 + rnd() * 3) };
    });
    const flash = new THREE.Mesh(flashGeo, mat);
    flash.position.copy(p);
    scene.add(flash);
    bursts.push({ parts, flash, mat, t0: T });
    sfx.pop();
  };

  stage.onUpdate((dt, T) => {
    pt += dt;
    if (phase === "enter" && pt > 2.4) { phase = "aim"; pt = 0; }
    else if (phase === "aim" && pt > 0.8) { phase = "fire"; pt = 0; next = 0; }
    else if (phase === "fire") {
      if (shot < invaders.length && pt >= next) {
        const from = rocket.muzzle(), m = new THREE.Mesh(ballGeo, ballMat);
        m.position.copy(from);
        scene.add(m);
        balls.push({ m, from, i: shot, t0: T });
        shake = 0.07; recoil = 0.14;
        sfx.thump();
        shot++;
        next = pt + 0.17;
        hud.onAmmo(invaders.length - shot);
      }
      if (shot >= invaders.length && !balls.length && pt > invaders.length * 0.17 + 1.8) wave();
    }
    for (const v of invaders) {
      let p = v.home;
      if (phase === "enter") {
        const k = Math.min(1, Math.max(0, (pt - v.delay) / 1.4)), e = 1 - Math.pow(1 - k, 3);
        p = new THREE.Vector3(v.home.x * (1 + (1 - e) * 2), v.home.y + (1 - e) * 8, v.home.z - (1 - e) * 50);
      }
      v.g.position.set(p.x, p.y + Math.sin(T * 2 + v.ph) * 0.12, p.z);
      v.g.rotation.y = Math.sin(T * 1.3 + v.ph) * 0.35;
      v.g.rotation.z = Math.sin(T * 1.7 + v.ph) * 0.08;
      if (!v.alive) {
        v.dying += dt * 7;
        const s = Math.max(0, 1 - v.dying);
        v.g.scale.setScalar(s * 1.3);
        if (s === 0) v.g.visible = false;
      }
    }
    for (let j = balls.length - 1; j >= 0; j--) {
      const b = balls[j], k = (T - b.t0) / 0.45, target = invaders[b.i].g.position;
      if (k >= 1) { scene.remove(b.m); burst(target.clone(), T); invaders[b.i].alive = false; balls.splice(j, 1); continue; }
      b.m.position.lerpVectors(b.from, target, k);
      b.m.position.y += Math.sin(Math.PI * k) * 0.8;
    }
    for (let j = bursts.length - 1; j >= 0; j--) {
      const f = bursts[j], a = (T - f.t0) / 0.8;
      if (a >= 1) { f.parts.forEach((p) => scene.remove(p.m)); scene.remove(f.flash); f.mat.dispose(); bursts.splice(j, 1); continue; }
      f.parts.forEach((p) => { p.m.position.addScaledVector(p.v, dt); p.v.multiplyScalar(0.96); });
      f.mat.opacity = 1 - a;
      f.flash.scale.setScalar(0.6 + a * 1.4);
      f.flash.visible = a < 0.45;
    }
    recoil *= 0.88;
    rocket.group.position.set(Math.sin(T * 0.9) * 0.15, 1.6 + Math.sin(T * 1.6) * 0.08, 7.4 + recoil);
    rocket.group.rotation.z = Math.sin(T * 0.9) * 0.06;
    rocket.flicker(T);
    shake *= 0.86;
    camera.position.set(camBase.x + Math.sin(T * 0.3) * 0.4 + (rnd() - 0.5) * shake, camBase.y + Math.sin(T * 0.4) * 0.15 + (rnd() - 0.5) * shake, camBase.z);
    camera.lookAt(look);
    planet.rotation.y += dt * 0.02;
  });

  wave();
  return {
    hud,
    enableSound: unlockAudio,
    total: rows * perRow,
  };
}
