import * as THREE from "three";
import { COLOR, hex, LINE } from "@/design/tokens";
import { add } from "@/engine/materials";
import type { Stage } from "@/engine/stage";
import { seeded } from "@/engine/util";
import { applyLook } from "@/worlds/looks";
import { blasterOf, makePlasmaBall, makeRocket, type RocketStyle } from "./ships";

/**
 * The Hangar (SPEC §2.6) as a product shot on the void: the cadet's own rocket hovering over a
 * simple pad ringed by dashed orbits (the house motif), turning slowly under the hero look's gold
 * key and blue rim. Every upgrade shows the moment it is chosen: a hull paint rebuilds the rocket
 * with a small pop, a thruster trail flares, and a blaster fires a short volley up out of frame.
 * No set, no props, no glow (the hero look's bloom threshold is above everything here).
 *
 * Framing: on a wide screen the rocket sits in the left part of the frame (the shop panel is on the
 * right); on a tall screen it sits in the top half (the panel covers the bottom half).
 */
export type ShipStyle = RocketStyle & { blaster?: string };

/** The rocket's centre above the pad: high enough that the thruster trail clears it. */
const HOVER = 2.75;
const ALPHA = (rgba: string) => Number(rgba.slice(rgba.lastIndexOf(",") + 1, -1));

/** A dashed circle on the floor plane (y = 0), in token approach-white or gold. */
function orbit(r: number, color: string, opacity: number, dash = 0.14, gap = 0.22) {
  const pts = Array.from({ length: 161 }, (_, i) => { const a = (i / 160) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r); });
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: hex(color), transparent: true, opacity, dashSize: dash, gapSize: gap, depthWrite: false }));
  line.computeLineDistances();
  return line;
}

export function mountHangarBay(stage: Stage, initial: ShipStyle) {
  const { scene, camera, mats: M } = stage, rnd = seeded(31);
  const look = applyLook(stage, "hero");
  scene.fog = null;
  camera.fov = 30;
  camera.far = 400;
  camera.updateProjectionMatrix();
  const root = new THREE.Group();
  scene.add(root);

  // light: the hero look's gold key (with a soft contact shadow), its cool fill and a blue rim
  const key = new THREE.DirectionalLight(look.key.color, look.key.intensity);
  key.position.set(5, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 6;
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 });
  const rim = new THREE.DirectionalLight(look.rim.color, look.rim.intensity);
  rim.position.set(-6, 5, -7);
  root.add(key, key.target, rim, new THREE.HemisphereLight(look.fill.sky, look.fill.ground, look.fill.intensity));

  // the pad: a low matte disc with a hairline edge, dashed orbits around it, one gold orbit with its moon
  const pad = add(root, new THREE.CylinderGeometry(1.7, 1.78, 0.16, 72), M.clay(hex(COLOR.shadow), { roughness: 0.9 }), 0, 0.08, 0, { cast: false });
  pad.receiveShadow = true;
  const edge = new THREE.Mesh(new THREE.RingGeometry(1.66, 1.7, 96), new THREE.MeshBasicMaterial({ color: hex(COLOR.approach), transparent: true, opacity: ALPHA(LINE[2]), depthWrite: false }));
  edge.rotation.x = -Math.PI / 2;
  edge.position.y = 0.165;
  root.add(edge);
  const orbits = new THREE.Group();
  orbits.position.y = 0.01;
  root.add(orbits);
  orbits.add(orbit(2.5, COLOR.approach, ALPHA(LINE[2])), orbit(3.6, COLOR.approach, ALPHA(LINE[1]), 0.18, 0.34));
  const gold = new THREE.Group();
  gold.add(orbit(3.05, COLOR.gold, 0.55, 0.1, 0.2));
  const moon = add(gold, new THREE.SphereGeometry(0.09, 16, 10), M.clay(hex(COLOR.gold), { roughness: 0.7 }), 3.05, 0, 0, { cast: false });
  orbits.add(gold);

  // far stars, pin-sharp and dim
  const sp: number[] = [];
  for (let i = 0; i < 700; i++) { const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, r = 150 + rnd() * 80; sp.push(Math.sqrt(1 - u * u) * Math.cos(t) * r, u * r, Math.sqrt(1 - u * u) * Math.sin(t) * r); }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  root.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: hex(COLOR.approach), size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false })));

  // the rocket on a turntable, hovering so the thruster trail shows
  const turn = new THREE.Group();
  turn.position.set(0, HOVER, 0);
  root.add(turn);
  let rocket = makeRocket(M, initial), style: ShipStyle = { ...initial }, popT = -10, flareT = -10;
  const setRocket = () => {
    turn.remove(rocket.group);
    rocket = makeRocket(M, style);
    turn.add(rocket.group);
  };
  setRocket();

  // the blaster demo: a short volley up and out of frame
  const balls: { m: THREE.Mesh; v: THREE.Vector3; t0: number }[] = [];
  let volley: number[] = [], recoilT = -10;
  const fire = () => { const t = stage.time; volley = [t + 0.05, t + 0.3, t + 0.55]; };
  function shot() {
    const b = blasterOf(style.blaster), from = rocket.muzzle();
    recoilT = stage.time;
    for (const side of b.twin ? [-0.14, 0.14] : [0]) {
      const m = makePlasmaBall(M, style.blaster, 1.5);
      m.position.copy(from).add(new THREE.Vector3(side, 0, 0));
      m.lookAt(m.position.clone().add(new THREE.Vector3(0, 1, 0)));
      scene.add(m);
      balls.push({ m, v: new THREE.Vector3(0, 16, 0), t0: stage.time });
    }
  }
  let demo = stage.time + 1.4; // one volley shortly after arriving

  const look3 = new THREE.Vector3();
  const stop = stage.onUpdate((dt, T) => {
    // turntable, hover, and the small pop when the paint changes
    turn.rotation.y += dt * 0.35;
    gold.rotation.y -= dt * 0.25;
    moon.rotation.y += dt;
    const pk = Math.min(1, (T - popT) / 0.35);
    rocket.group.scale.setScalar(1 - (1 - pk) * 0.08 + Math.sin(pk * Math.PI) * 0.05);
    turn.position.y = HOVER + Math.sin(T * 1.3) * 0.05;
    const flare = Math.max(0, 1 - (T - flareT) / 0.9);
    rocket.flicker(T, 0.75 + Math.sin(T * 2) * 0.05 + flare * 0.7);
    const rk = T - recoilT;
    rocket.recoil(rk < 0.22 ? Math.sin((rk / 0.22) * Math.PI) * 0.6 : 0);
    if (demo && T > demo) { demo = 0; fire(); }
    while (volley.length && T >= volley[0]) { volley.shift(); shot(); }
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i], k = T - b.t0;
      b.m.position.addScaledVector(b.v, dt * Math.min(1, 0.35 + k * 3));
      if (k > 1.2) { scene.remove(b.m); balls.splice(i, 1); }
    }

    // frame the rocket and pad in the part of the screen the shop panel leaves free
    const W = stage.renderer.domElement.clientWidth || 1, H = stage.renderer.domElement.clientHeight || 1, tall = W / H < 1;
    const free = tall ? { x: 0, y: 0, w: W, h: H * 0.5 } : { x: 0, y: 0, w: Math.max(W * 0.5, W - 420), h: H };
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), needH = 7.6, needW = 7.4;
    const d = Math.max((needH * H) / (2 * tan * free.h * 0.9), (needW * H) / (2 * tan * free.w * 0.9));
    look3.set(0, 2.3, 0);
    camera.position.set(0, 2.3 + d * 0.2, d);
    camera.lookAt(look3);
    camera.setViewOffset(W, H, W / 2 - (free.x + free.w / 2), H / 2 - (free.y + free.h / 2), W, H);
  });

  return {
    /** Show a style now (a preview, or what was just bought): each slot answers the moment it changes. */
    setStyle(s: ShipStyle) {
      const paint = s.hull !== style.hull, trail = s.thruster !== style.thruster, blast = s.blaster !== style.blaster;
      style = { ...s };
      if (paint || trail) setRocket();
      if (paint) popT = stage.time;
      if (trail) flareT = stage.time;
      if (blast) fire();
    },
    /** Fire the current blaster once more (a tap on the equipped one). */
    demo: fire,
    /** Screen anchors for the HUD: "rocket" (its middle) and "nose" (its tip). */
    anchor(id: string) {
      if (id === "rocket") return rocket.group.getWorldPosition(new THREE.Vector3());
      if (id === "nose") return rocket.noseWorld();
      return null;
    },
    dispose() { stop(); for (const b of balls) scene.remove(b.m); camera.clearViewOffset(); scene.remove(root); },
  };
}
export type HangarBay = ReturnType<typeof mountHangarBay>;
