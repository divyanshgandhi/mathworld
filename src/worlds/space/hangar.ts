import * as THREE from "three";
import { COLOR, hex, TYPE } from "@/design/tokens";
import { add, canvasTexture, type Materials } from "@/engine/materials";
import type { Rng } from "@/engine/util";
import { LOOKS, type Look } from "@/worlds/looks";
import { contactShadow, makeNova, mix, PLAIN } from "./cast";
import { makeRocket } from "./ships";

/**
 * The Star Fleet hangar of the intro film: a cathedral for one rocket. A dark vault on pointed ribs
 * runs down to a round window that draws the solar system in hairline orbits; the rocket stands on
 * its fins on a pad ringed by a hairline and a dashed gold orbit; the gold key comes from one side
 * and the sky rim from behind. Everything is matte. The one glow is the pad at the Launch moment.
 * (The Hangar screen itself is a separate product shot: hangarBay.ts.)
 */

/** Where the rocket stands, in the set's own space. */
export const PAD = new THREE.Vector3(0, 0, -1.8);
/** The vault: half its width at the floor, the height of its ridge, where its ribs stand, and its end wall. */
const NAVE = { half: 9.6, apex: 17.5, ribs: [10.2, 5.4, 1.0, -4.6, -9.2, -13.8], front: 16, end: -18 };
/** The round window on the end wall: its centre height and radius. */
const ROSE = { y: 8.6, r: 6.1 };
/** The pad's twelve studs: the countdown lights them in turn. */
const STUDS = 12;
/** The set's own colours, each mixed from the tokens: the void lifted a little toward the shadow blue. */
const SET = {
  deck: mix(COLOR.void, COLOR.shadow, 0.5), vault: mix(COLOR.void, COLOR.shadow, 0.38), rib: mix(COLOR.shadow, COLOR.horizon, 0.3),
  plinth: mix(COLOR.shadow, COLOR.horizon, 0.55), line: mix(COLOR.void, COLOR.approach, 0.34), faint: mix(COLOR.void, COLOR.approach, 0.16), heat: mix(COLOR.gold, COLOR.ember, 0.35),
};
const ink = (c: string, a: number) => `rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},${a})`;

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

/** One side of a pointed arch, from the floor to the ridge, `inset` metres inside the vault. */
const archSide = (s: number, inset = 0) => new THREE.QuadraticBezierCurve3(
  new THREE.Vector3(s * (NAVE.half - inset), 0, 0), new THREE.Vector3(s * (NAVE.half - inset) * 1.04, (NAVE.apex - inset) * 0.74, 0), new THREE.Vector3(0, NAVE.apex - inset, 0));

export function buildHangar(scene: THREE.Scene, M: Materials, rnd: Rng, at: THREE.Vector3, look: Look = LOOKS.hero) {
  const g = new THREE.Group();
  g.position.copy(at);
  scene.add(g);
  const nc = { cast: false }, off = { cast: false, recv: false };
  const hair = (c: number) => new THREE.MeshBasicMaterial({ color: c, fog: false });
  const flat = (m: THREE.Mesh) => { m.rotation.x = -Math.PI / 2; return m; };

  // the deck: one dark matte floor. No grid: the lines on it are orbits round the pad and an aisle that leads to it
  flat(add(g, new THREE.PlaneGeometry(70, 70), M.clay(SET.deck, { roughness: 0.9 }), 0, 0, -2, nc));
  for (const [r, c] of [[3.42, SET.line], [5.2, SET.faint], [7.4, SET.faint]] as const) flat(add(g, new THREE.RingGeometry(r, r + 0.028, 160), hair(c), PAD.x, 0.012, PAD.z, off));
  for (const s of [-1, 1]) flat(add(g, new THREE.PlaneGeometry(0.028, NAVE.front - 5.7), hair(SET.faint), s * 1.35, 0.012, (NAVE.front + 5.7) / 2, off));
  // the dashed gold orbit, with one bead going round it: the house motif, at the rocket's feet
  const orbit = new THREE.Group();
  orbit.position.set(PAD.x, 0.02, PAD.z);
  g.add(orbit);
  {
    const R = 4.3, pts = Array.from({ length: 241 }, (_, i) => { const a = (i / 240) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R); });
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: mix(COLOR.gold, COLOR.void, 0.25), dashSize: 0.16, gapSize: 0.27 }));
    ring.computeLineDistances();
    orbit.add(ring);
    add(orbit, new THREE.SphereGeometry(0.11, 16, 12), M.clay(hex(COLOR.gold), { roughness: 0.6 }), R, 0.09, 0, nc);
  }

  // the pad: a low plinth, a ring that lights at Launch, and twelve studs for the countdown
  add(g, new THREE.CylinderGeometry(2.5, 2.66, 0.18, 72), M.clay(SET.plinth, { roughness: 0.7, metalness: 0.15 }), PAD.x, 0.09, PAD.z);
  const padMat = new THREE.MeshStandardMaterial({ color: SET.rib, emissive: hex(COLOR.gold), emissiveIntensity: 0, roughness: 0.7 });
  flat(add(g, new THREE.RingGeometry(2.18, 2.3, 96), padMat, PAD.x, 0.184, PAD.z, off));
  const studs = Array.from({ length: STUDS }, (_, i) => {
    const a = -Math.PI / 2 - (i / STUDS) * Math.PI * 2, m = new THREE.MeshStandardMaterial({ color: SET.rib, emissive: hex(COLOR.gold), emissiveIntensity: 0, roughness: 0.6 });
    add(g, new THREE.CylinderGeometry(0.13, 0.15, 0.07, 20), m, PAD.x + Math.cos(a) * 3.0, 0.035, PAD.z - Math.sin(a) * 3.0, nc);
    return m;
  });

  // the vault: a dark shell on pointed ribs, each rib carrying a hairline on its inner edge
  {
    const N = 28, prof: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) prof.push(archSide(-1).getPoint(i / N));
    for (let i = N - 1; i >= 0; i--) prof.push(archSide(1).getPoint(i / N));
    const P: number[] = [], I: number[] = [];
    prof.forEach((p) => { P.push(p.x * 1.03, p.y * 1.03, NAVE.front + 4, p.x * 1.03, p.y * 1.03, NAVE.end); });
    for (let i = 0; i < prof.length - 1; i++) I.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const shell = new THREE.BufferGeometry();
    shell.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    shell.setIndex(I);
    shell.computeVertexNormals();
    add(g, shell, M.clay(SET.vault, { roughness: 0.95, side: THREE.DoubleSide }), 0, 0, 0, nc);
  }
  const ribMat = M.clay(SET.rib, { roughness: 0.75, metalness: 0.1 });
  for (const z of NAVE.ribs) for (const s of [-1, 1]) {
    add(g, new THREE.TubeGeometry(archSide(s, 0.25), 36, 0.3, 10), ribMat, 0, 0, z, nc);
    add(g, new THREE.TubeGeometry(archSide(s, 0.62), 36, 0.022, 6), hair(SET.line), 0, 0, z, off);
  }
  // the ridge, broken over the pad: that is the way out
  for (const [z0, z1] of [[NAVE.front, NAVE.ribs[2]], [NAVE.ribs[3], NAVE.end]] as const) add(g, new THREE.BoxGeometry(0.34, 0.34, z0 - z1), ribMat, 0, NAVE.apex - 0.3, (z0 + z1) / 2, nc);
  // the oculus over the pad: a hairline ring of gold round a patch of night sky
  const eye = new THREE.Group();
  eye.position.set(PAD.x, NAVE.apex - 1.0, PAD.z);
  g.add(eye);
  const night = canvasTexture(256, 256);
  {
    const x = night.ctx;
    x.fillStyle = COLOR.void; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) { x.fillStyle = ink(COLOR.approach, 0.25 + rnd() * 0.6); x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 0.5 + rnd() * 1.1, 0, 7); x.fill(); }
    night.texture.needsUpdate = true;
  }
  add(eye, new THREE.CircleGeometry(2.9, 64), new THREE.MeshBasicMaterial({ map: night.texture, fog: false }), 0, 0, 0, off).rotation.x = Math.PI / 2;
  add(eye, new THREE.TorusGeometry(2.9, 0.035, 8, 96), hair(mix(COLOR.gold, COLOR.void, 0.2)), 0, -0.01, 0, off).rotation.x = Math.PI / 2;

  // the end wall and its round window: the solar system in hairline orbits, the journey ahead
  add(g, new THREE.PlaneGeometry(NAVE.half * 2.2, NAVE.apex * 1.1), M.clay(SET.vault, { roughness: 0.95 }), 0, NAVE.apex * 0.55, NAVE.end + 0.02, nc);
  const rose = canvasTexture(1024, 1024);
  const paintRose = () => {
    const x = rose.ctx, c = 512;
    x.clearRect(0, 0, 1024, 1024);
    x.fillStyle = COLOR.void; x.beginPath(); x.arc(c, c, 506, 0, 7); x.fill();
    x.strokeStyle = ink(COLOR.approach, 0.5); x.lineWidth = 3; x.beginPath(); x.arc(c, c, 504, 0, 7); x.stroke();
    x.strokeStyle = ink(COLOR.approach, 0.22); x.lineWidth = 2; x.beginPath(); x.arc(c, c, 478, 0, 7); x.stroke();
    const orbits = [84, 126, 172, 222, 292, 356, 412, 456];
    x.lineWidth = 2.5; x.setLineDash([5, 12]);
    orbits.forEach((r, i) => { x.strokeStyle = i === 2 ? ink(COLOR.gold, 0.75) : ink(COLOR.approach, 0.32); x.beginPath(); x.arc(c, c, r, 0, 7); x.stroke(); });
    x.setLineDash([]);
    x.fillStyle = COLOR.gold; x.beginPath(); x.arc(c, c, 44, 0, 7); x.fill();
    const worlds: [string, number, number][] = [[COLOR.approach, 2.2, 6], [COLOR.gold, 5.4, 9], [COLOR.sky, 3.6, 11], [COLOR.ember, 0.7, 8], [COLOR.gold, 4.5, 22], [COLOR.approach, 1.5, 18], [COLOR.sky, 5.9, 13], [COLOR.disk, 2.9, 12]];
    worlds.forEach(([col, a, r], i) => {
      const px = c + Math.cos(a) * orbits[i], py = c + Math.sin(a) * orbits[i];
      x.fillStyle = col; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
      if (i === 5) { x.strokeStyle = ink(COLOR.approach, 0.7); x.lineWidth = 2.5; x.beginPath(); x.ellipse(px, py, r * 1.9, r * 0.5, -0.3, 0, 7); x.stroke(); }
    });
    rose.texture.needsUpdate = true;
  };
  paintRose();
  if (typeof document !== "undefined") void document.fonts.load(`400 16px ${TYPE.family}`).then(paintRose);
  add(g, new THREE.CircleGeometry(ROSE.r, 96), new THREE.MeshBasicMaterial({ map: rose.texture, transparent: true, color: mix(PLAIN, COLOR.void, 0.25), fog: false }), 0, ROSE.y, NAVE.end + 0.06, off);
  add(g, new THREE.TorusGeometry(ROSE.r + 0.22, 0.2, 10, 96), ribMat, 0, ROSE.y, NAVE.end + 0.1, nc);

  // the rocket on the pad, and Nova
  const rocket = makeRocket(M);
  rocket.group.scale.setScalar(1.7);
  g.add(rocket.group);
  const padShadow = contactShadow(4.6, 4.6, 0.5);
  padShadow.position.set(PAD.x, 0.19, PAD.z);
  g.add(padShadow);
  const nova = makeNova(M);
  nova.group.position.set(3.2, 2.8, 0.8);
  nova.group.scale.setScalar(1.3);
  g.add(nova.group);

  // light, all from the look: the gold key from the front left (it draws the rocket and the people), the sky
  // rim from behind right (it cuts them out of the dark), and one warm lamp under the engine for Launch.
  // The lights live in the scene, not in the set's group, so hiding a set never changes the light count.
  const key = new THREE.DirectionalLight(look.key.color, 0);
  key.position.copy(at).add(new THREE.Vector3(-10, 7.5, 13)); // low enough to reach a face under the peak of a cap
  key.target.position.copy(at).add(new THREE.Vector3(0, 2.2, -1.5));
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -12, right: 12, top: 14, bottom: -8, near: 1, far: 46 });
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.04;
  key.shadow.radius = 3;
  const rim = new THREE.DirectionalLight(look.rim.color, 0);
  rim.position.copy(at).add(new THREE.Vector3(8, 6.5, -12));
  rim.target.position.copy(at).add(new THREE.Vector3(0, 3, -1.5));
  const burnLight = new THREE.PointLight(SET.heat, 0, 34, 1.7);
  burnLight.position.copy(at).add(new THREE.Vector3(PAD.x, 1.0, PAD.z));
  scene.add(key, key.target, rim, rim.target, burnLight);

  const mistPos: number[] = [], mistHome: number[] = [];
  for (let i = 0; i < 150; i++) { const a = rnd() * Math.PI * 2, r = 0.7 + rnd() * 2.6; mistPos.push(PAD.x + Math.cos(a) * r, rnd() * 1.4, PAD.z + Math.sin(a) * r); mistHome.push(a, r); }
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute("position", new THREE.Float32BufferAttribute(mistPos, 3));
  const mistMat = new THREE.PointsMaterial({ color: mix(COLOR.sky, COLOR.void, 0.45), size: 0.3, alphaMap: softDot(), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
  g.add(new THREE.Points(mistGeo, mistMat));

  const BASE = 0.18 + 1.94 * 1.7; // pad top + rocket half-height (to the tips of its fins, which it stands on) at 1.7 scale
  /** The launch as the film drives it. */
  const state = { lamps: 0, burn: 0, rise: 0 };
  let auto = 0, on = false, billow = 0;
  const reset = () => { auto = 0; billow = 0; state.lamps = state.burn = state.rise = 0; rocket.group.position.set(PAD.x, BASE, PAD.z); rocket.group.rotation.set(0, 0, 0); rocket.group.visible = true; };
  reset();
  return {
    group: g, nova, rocket, key, rim,
    /** The lights that cast shadows here, for whoever schedules shadow passes. */
    shadows: [key],
    lights(v: boolean) { on = v; key.intensity = v ? look.key.intensity : 0; rim.intensity = v ? look.rim.intensity * 1.7 : 0; if (!v) burnLight.intensity = 0; },
    /**
     * Set the launch by hand, each part from 0: `lamps` (0..1) lights the pad's twelve studs in turn,
     * `burn` (0..1) is the engine and the gold of the pad, `rise` is how far the rocket has climbed, in metres.
     */
    set(s: Partial<typeof state>) { Object.assign(state, s); },
    /** The whole launch on the set's own clock (the film drives `set` instead, beat by beat). */
    launch() { auto = 0.001; },
    reset,
    update(T: number, dt: number, voice: number, novaTalking: boolean) {
      nova.animate(T, dt, 2.8, novaTalking ? voice : 0);
      orbit.rotation.y += dt * 0.12;
      if (auto > 0) {
        auto += dt;
        state.lamps = Math.min(1, auto / 1.2); state.burn = THREE.MathUtils.smoothstep(auto, 1.2, 1.9); state.rise = 4.2 * Math.max(0, auto - 1.9) ** 2;
      }
      const { lamps, burn, rise } = state;
      studs.forEach((m, i) => { const lit = lamps * STUDS > i + 0.5; m.emissiveIntensity += ((lit ? 0.85 + burn * 0.9 : 0) - m.emissiveIntensity) * Math.min(1, dt * 14); });
      // the Launch moment: the pad's ring is the one thing in the film bright enough to bloom
      padMat.emissiveIntensity = burn * 1.9;
      burnLight.intensity = on ? burn * 90 * (1 + Math.sin(T * 31) * 0.04) : 0;
      burnLight.position.y = at.y + 1.0 + rise * 0.6;
      rocket.flicker(T, burn * (1.5 + Math.min(1.2, rise * 0.12)));
      rocket.group.position.y = BASE + rise;
      padShadow.material.opacity = 0.5 * Math.max(0, 1 - rise / 6);
      // mist: it hangs low and drifts; ignition pushes it out across the deck
      billow += (burn - billow) * Math.min(1, dt * 1.6);
      const mp = mistGeo.attributes.position;
      for (let i = 0; i < mp.count; i++) {
        const a = mistHome[i * 2], r = mistHome[i * 2 + 1] * (1 + billow * 1.9);
        let y = mp.getY(i) + dt * (0.22 + billow * 0.5);
        if (y > 1.5 + billow) y = 0.05;
        mp.setXYZ(i, PAD.x + Math.cos(a + T * 0.05) * r, y, PAD.z + Math.sin(a + T * 0.05) * r);
      }
      mp.needsUpdate = true;
      mistMat.opacity = 0.2 + billow * 0.18;
    },
  };
}
export type Hangar = ReturnType<typeof buildHangar>;
