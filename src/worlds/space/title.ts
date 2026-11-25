import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { COLOR } from "@/design/tokens";
import type { Stage } from "@/engine/stage";
import { seeded } from "@/engine/util";
import { applyLook, lookLights } from "@/worlds/looks";
import { makeBody, starfield, type Body, type BodyId } from "./planets";

/**
 * The Title (design/title.html): the Solar System as an orrery in the space look. Only the Sun glows, as a
 * soft halo; the planets are matte, lit gold from the Sun, with dashed hairline orbits (Earth's a little
 * brighter) and a small rocket going round Earth. The camera flies in from deep space and settles into a
 * slow drift.
 *
 * Framing: the scene never moves under the words. `frameAround(box)` takes the text block's box (in the
 * stage's CSS pixels); the camera's view offset puts the Sun to the right of it on wide screens and above it
 * on narrow ones, and the zoom is fitted so the outermost orbit (so every planet, at every moment) stays
 * clear of the box. The drift turns the camera about the Sun at a fixed height and distance, so the fit
 * holds for the whole drift.
 */
const ORBITS: [BodyId, number, number, number][] = [
  // body, orbit radius, planet radius, angular speed (rad/s): sizes are for reading, not to scale
  ["mercury", 10, 0.7, 0.16], ["venus", 13.5, 1.1, 0.12], ["earth", 17.5, 1.3, 0.09], ["mars", 21.5, 0.95, 0.07],
  ["jupiter", 28.5, 2.7, 0.04], ["saturn", 35.5, 2.2, 0.03], ["uranus", 42, 1.5, 0.022],
];
const SUN_R = 6, BELT_R = 24.4;
/** The farthest any planet reaches from the Sun (Uranus and its radius, or Saturn's ring). */
const REACH = Math.max(...ORBITS.map(([id, R, r]) => R + r * (id === "saturn" ? 2.2 : id === "uranus" ? 2 : 1))) + 0.6;
const FLY = 5.5, DRIFT = 0.02, WIDE = 820;

export interface TitleScene {
  /** Fit the system around the words: their box in CSS pixels of the stage, or null for a default layout. */
  frameAround(box: { left: number; top: number; right: number; bottom: number } | null): void;
  /** Runs `fn` once the fly-in has settled (at once if it has). Returns an unsubscribe. */
  onSettled(fn: () => void): () => void;
  readonly settled: boolean;
  dispose(): void;
}

export function mountTitle(stage: Stage): TitleScene {
  const { scene, camera, mats: M } = stage, rnd = seeded(41), root = new THREE.Group();
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  scene.add(root);
  scene.fog = null;
  camera.near = 0.5;
  camera.far = 4000;
  camera.fov = 30;
  const look = applyLook(stage, "space");
  root.add(lookLights(look, { sun: new THREE.Vector3(), rim: false }).group);

  const sun = makeBody(M, "sun", SUN_R);
  root.add(sun.group);

  // orbits: dashed hairlines, a fixed width in pixels
  const lineMats: LineMaterial[] = [];
  const orbitLine = (R: number, opacity: number, center?: THREE.Object3D, tiltX = 0) => {
    const pts: number[] = [];
    for (let i = 0; i <= 256; i++) { const a = (i / 256) * Math.PI * 2; pts.push(Math.cos(a) * R, 0, Math.sin(a) * R); }
    const g = new LineGeometry();
    g.setPositions(pts);
    const m = new LineMaterial({ color: new THREE.Color(COLOR.approach), linewidth: 1, dashed: true, dashSize: Math.max(0.12, R * 0.021), gapSize: Math.max(0.24, R * 0.042), transparent: true, opacity, depthWrite: false, worldUnits: false });
    const line = new Line2(g, m);
    line.computeLineDistances();
    line.rotation.x = tiltX;
    (center ?? root).add(line);
    lineMats.push(m);
    return line;
  };

  const planets = ORBITS.map(([id, R, r, w]) => {
    const b = makeBody(M, id, r);
    root.add(b.group);
    orbitLine(R, id === "earth" ? 0.42 : 0.16);
    return { id, b, R, w, a: (id.length * 1.7 + R * 0.37) % (Math.PI * 2) };
  });
  const earth = planets.find((p) => p.id === "earth")!;

  // home: Earth carries the Moon, and the cadet's rocket on a small dashed orbit of its own
  const moon: Body = makeBody(M, "moon", 0.34);
  root.add(moon.group);
  const home = new THREE.Group();
  root.add(home);
  const ROCKET_R = 2.9, ROCKET_TILT = 0.38;
  orbitLine(ROCKET_R, 0.22, home, ROCKET_TILT);
  const rocket = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.26, 4, 12), M.clay(new THREE.Color(COLOR.approach).getHex(), { roughness: 0.5 }));
  hull.rotation.x = Math.PI / 2; // long axis along +z, which lookAt points along the path
  rocket.add(hull);
  const ember = new THREE.MeshBasicMaterial({ color: new THREE.Color(COLOR.ember).multiplyScalar(0.85) });
  const trail = [0.07, 0.055, 0.04, 0.028].map((s) => { const d = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), ember); home.add(d); return d; });
  home.add(rocket);

  // the Asteroid Belt, between Mars and Jupiter: a faint ring of dust
  const belt: number[] = [];
  for (let i = 0; i < 1100; i++) { const a = rnd() * Math.PI * 2, d = BELT_R + (rnd() - 0.5) * 1.8; belt.push(Math.cos(a) * d, (rnd() - 0.5) * 0.5, Math.sin(a) * d); }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute("position", new THREE.Float32BufferAttribute(belt, 3));
  const beltPts = new THREE.Points(bg, new THREE.PointsMaterial({ color: new THREE.Color(COLOR.approach).lerp(new THREE.Color(COLOR.gold), 0.35).multiplyScalar(0.32), size: 1, sizeAttenuation: false }));
  root.add(beltPts, starfield(2800, 1500, rnd));

  /* ---------- framing ---------- */
  let box: { left: number; top: number; right: number; bottom: number } | null = null, fitW = 0, fitH = 0;
  let elev = 0.37, dist = 110;
  const az0 = 0.55;
  const pose = (az: number, d = dist, e = elev, out = new THREE.Vector3()) => out.set(Math.cos(az) * Math.cos(e) * d, Math.sin(e) * d, Math.sin(az) * Math.cos(e) * d);
  const v = new THREE.Vector3();

  function fit() {
    const w = stage.container.clientWidth, h = stage.container.clientHeight;
    if (!w || !h) return;
    fitW = w; fitH = h;
    const wide = w > WIDE;
    elev = wide ? 0.42 : 0.52;
    dist = wide ? 120 : 130;
    camera.fov = wide ? 30 : 38;
    const margin = Math.min(56, Math.max(20, w * 0.03));
    const right = box?.right ?? w * 0.52, top = box?.top ?? h * 0.55;
    // where the Sun sits on screen: right of the words, or above them
    const px = wide ? right + (w - right) * 0.7 : w / 2, py = wide ? h * 0.5 : Math.max(h * 0.2, top * 0.47);
    camera.aspect = w / h;
    camera.zoom = 1;
    camera.setViewOffset(w, h, w / 2 - px, h / 2 - py, w, h);
    camera.position.copy(pose(az0));
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    // measure the outermost orbit (and Mars's, for phones) on screen at zoom 1, relative to the Sun
    let minDx = 0, maxDy = 0, marsDx = 0;
    const measure = (R: number, cb: (dx: number, dy: number) => void) => {
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        for (const y of [-1, 1]) {
          v.set(Math.cos(a) * R, y * 1.2, Math.sin(a) * R).project(camera);
          cb((v.x + 1) / 2 * w - px, (1 - v.y) / 2 * h - py);
        }
      }
    };
    measure(REACH, (dx, dy) => { minDx = Math.min(minDx, dx); maxDy = Math.max(maxDy, dy); });
    measure(21.5 + 1.4, (dx) => { marsDx = Math.max(marsDx, Math.abs(dx)); });
    let zoom: number;
    if (wide) {
      zoom = (px - right - margin) / -minDx;
      zoom = Math.min(zoom, (h * 0.46) / maxDy); // the near side stays on screen
    } else {
      zoom = (top - margin - py) / maxDy;
      zoom = Math.min(zoom, (w / 2 - 10) / marsDx); // the inner planets stay on screen
    }
    camera.zoom = Math.max(0.05, zoom);
    camera.updateProjectionMatrix();
    const dpr = stage.renderer.getPixelRatio();
    for (const m of lineMats) { m.resolution.set(w * dpr, h * dpr); m.linewidth = dpr; }
  }
  fit();

  /* ---------- motion ---------- */
  const from = new THREE.Vector3(), to = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let settled = reduced, T0 = -1;
  const waiting: (() => void)[] = [];
  const settle = () => { if (settled) return; settled = true; waiting.splice(0).forEach((f) => f()); };
  const prev = new THREE.Vector3(), nextP = new THREE.Vector3();
  const rocketAt = (t: number, out: THREE.Vector3) => out.set(Math.cos(t) * ROCKET_R, 0, -Math.sin(t) * ROCKET_R).applyAxisAngle(new THREE.Vector3(1, 0, 0), ROCKET_TILT);

  const stop = stage.onUpdate((dt, time) => {
    if (T0 < 0) T0 = time;
    const T = time - T0;
    if (stage.container.clientWidth !== fitW || stage.container.clientHeight !== fitH) fit();
    sun.spin.rotation.y += dt * 0.03;
    for (const p of planets) {
      if (!reduced) p.a += p.w * dt;
      p.b.group.position.set(Math.cos(p.a) * p.R, 0, -Math.sin(p.a) * p.R);
      p.b.spin.rotation.y += dt * (reduced ? 0.05 : 0.25);
      p.b.update(dt);
    }
    const e = earth.b.group.position;
    home.position.copy(e);
    const mt = reduced ? 1 : T * 0.5;
    moon.group.position.set(e.x + Math.cos(mt) * 2.1, 0.25, e.z - Math.sin(mt) * 2.1);
    moon.spin.rotation.y = -mt;
    const rt = reduced ? 2 : T * 0.9;
    rocketAt(rt, prev);
    rocketAt(rt + 0.05, nextP);
    rocket.position.copy(prev);
    rocket.up.copy(up);
    rocket.lookAt(nextP.clone().add(home.position));
    trail.forEach((d, i) => rocketAt(rt - 0.09 - i * 0.07, d.position));
    if (!reduced) beltPts.rotation.y += dt * 0.008;

    // camera: in from deep space (exponential ease-out), then a slow drift about the Sun
    const az = az0 + (reduced ? 0 : T * DRIFT);
    pose(az, dist, elev, to);
    let k = 1;
    if (!reduced) {
      const t = Math.min(1, T / FLY);
      k = 1 - Math.pow(1 - t, 4);
      pose(az - 1.1, 1150, 0.62, from);
      camera.position.lerpVectors(from, to, k);
    } else camera.position.copy(to);
    camera.lookAt(0, 0, 0);
    if (k > 0.86) settle();
  });

  return {
    frameAround(b) { box = b; fit(); },
    onSettled(fn) {
      if (settled) { fn(); return () => {}; }
      waiting.push(fn);
      return () => { const i = waiting.indexOf(fn); if (i >= 0) waiting.splice(i, 1); };
    },
    get settled() { return settled; },
    dispose() {
      stop();
      scene.remove(root);
      camera.clearViewOffset();
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      lineMats.forEach((m) => m.dispose());
    },
  };
}
