import * as THREE from "three";
import { add, canvasTexture, fitText, outline, PALETTE, type Materials } from "@/engine/materials";

/**
 * Hangar upgrades (SPEC §2.6), as styling hooks: the hull paint and thruster trail change the rocket,
 * the blaster changes the plasma balls the arena fires. Ids match `upgrade_purchased` item ids.
 */
export const HULLS = {
  "cadet-white": { hull: PALETTE.clay, trim: PALETTE.coral },
  "solar-gold": { hull: 0xf6d57a, trim: 0xd9822b },
  "nebula-violet": { hull: 0xc4b0ff, trim: 0x6a4fd0 },
  "obsidian-stealth": { hull: 0x3b3e55, trim: 0x5fd4e6 },
} as const;
export const THRUSTERS = {
  "amber-flame": { outer: [2.6, 2.8, 1.4], inner: [4, 3.6, 2.4] },
  "cyan-ion": { outer: [0.9, 2.4, 3.2], inner: [2.6, 3.6, 4] },
  "starlight-comet": { outer: [2.4, 1.6, 3.4], inner: [4, 3.8, 4] },
} as const;
export const BLASTERS = {
  "plasma-ball": { color: PALETTE.shot, size: 1, twin: false, stretch: 1 },
  "twin-plasma": { color: PALETTE.shot, size: 0.8, twin: true, stretch: 1 },
  "ion-arc": { color: 0x7dfcff, size: 0.9, twin: false, stretch: 1.8 },
  "nova-beam": { color: 0xd9f99d, size: 0.85, twin: false, stretch: 3 },
} as const;
export type HullId = keyof typeof HULLS;
export type ThrusterId = keyof typeof THRUSTERS;
export type BlasterId = keyof typeof BLASTERS;
export interface RocketStyle { hull?: string; thruster?: string }
const pickOf = <T extends object>(table: T, id: string | undefined, fallback: keyof T): T[keyof T] => table[(id && id in table ? id : fallback) as keyof T];

/** The cadet's rocket: a clay body with coral trim, a glowing porthole and a flickering flame. */
export function makeRocket(M: Materials, style: RocketStyle = {}) {
  const rocket = new THREE.Group(), body = new THREE.Group();
  rocket.add(body);
  body.position.y = -1.5; // pivot near the middle, so it can tilt and recoil naturally
  const V = (x: number, y: number) => new THREE.Vector2(x, y);
  const paint = pickOf(HULLS, style.hull, "cadet-white"), flame = pickOf(THRUSTERS, style.thruster, "amber-flame");
  const hull = M.clay(paint.hull, { roughness: 0.55, metalness: 0.05 }), trim = M.clay(paint.trim, { roughness: 0.55 }), dark = M.clay(PALETTE.slate);
  outline(add(body, new THREE.LatheGeometry([V(0, 0), V(0.42, 0), V(0.5, 0.25), V(0.58, 0.9), V(0.6, 1.5), V(0.56, 2.0), V(0.47, 2.35)], 48), hull), M);
  outline(add(body, new THREE.LatheGeometry([V(0.47, 2.35), V(0.36, 2.65), V(0.2, 2.9), V(0.05, 3.02), V(0, 3.04)], 48), trim), M);
  const band = add(body, new THREE.TorusGeometry(0.6, 0.06, 12, 48), trim, 0, 1.15, 0);
  band.rotation.x = Math.PI / 2;
  add(body, new THREE.SphereGeometry(0.2, 24, 16), M.glow(PALETTE.sky, 0.55), 0, 1.65, 0.52, { cast: false });
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
  const [or, og, ob] = flame.outer, [ir, ig, ib] = flame.inner;
  const outer = M.additive(or, og, ob, 0.85), inner = M.additive(ir, ig, ib, 0.95);
  const flameOut = add(body, new THREE.ConeGeometry(0.3, 1.5, 24, 1, true), outer, 0, -1.0, 0, { cast: false });
  const flameIn = add(body, new THREE.ConeGeometry(0.16, 0.9, 24, 1, true), inner, 0, -0.72, 0, { cast: false });
  flameOut.rotation.x = flameIn.rotation.x = Math.PI;
  return {
    group: rocket,
    /** Where shots leave from, in world space. */
    muzzle: () => rocket.localToWorld(new THREE.Vector3(0, 1.6, 0)),
    flicker(T: number, power = 1) {
      const f = (1 + Math.sin(T * 40) * 0.08 + Math.sin(T * 23) * 0.06) * power;
      flameOut.scale.set(Math.min(1.6, 0.6 + power * 0.4), f, Math.min(1.6, 0.6 + power * 0.4));
      flameIn.scale.set(1, f * 1.05, 1);
      flameOut.visible = flameIn.visible = power > 0.02;
    },
  };
}

/** One invader: a green clay saucer with a toon ink outline, glass dome, neon eyes and a ring of running lights. */
export function makeInvader(M: Materials) {
  const g = new THREE.Group(), noCast = { cast: false };
  const body = new THREE.SphereGeometry(0.55, 32, 16);
  body.scale(1, 0.5, 1);
  outline(add(g, body, M.clay(PALETTE.invader, { roughness: 0.5 })), M);
  add(g, new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.clay(0xb8f5ff, { transparent: true, opacity: 0.7, roughness: 0.2 }), 0, 0.12, 0);
  const eye = M.glow(PALETTE.cyan, 0.6), running = M.glow(PALETTE.cyan, 0.35); // all under the bloom threshold: no halo in battle
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

/** A cheaper fighter for very large armadas (Saturn and up): same silhouette, a handful of meshes. */
export function makeFighterLite(M: Materials) {
  const g = new THREE.Group(), body = new THREE.SphereGeometry(0.55, 20, 10);
  body.scale(1, 0.5, 1);
  outline(add(g, body, M.clay(PALETTE.invader, { roughness: 0.5 }), 0, 0, 0, { cast: false }), M);
  add(g, new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.clay(0xb8f5ff, { roughness: 0.25 }), 0, 0.12, 0, { cast: false });
  return g;
}

const emblems = new Map<string, THREE.MeshBasicMaterial>();
/** A crisp hull number ("10", "100", "1K"): ink on a cream plate, drawn once per label. */
export function emblem(text: string, w = 0.42, h = 0.24, colors: [string, string] = ["#f6f1e4", "#141a33"]) {
  const key = text + colors.join();
  if (!emblems.has(key)) {
    const { texture, ctx } = canvasTexture(256, 144);
    ctx.fillStyle = colors[0];
    ctx.beginPath(); ctx.roundRect(6, 6, 244, 132, 36); ctx.fill();
    ctx.fillStyle = colors[1];
    fitText(ctx, text, 128, 76, 210, 108, "800", "ui-sans-serif, system-ui, sans-serif");
    emblems.set(key, new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }));
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), emblems.get(key)!);
  m.renderOrder = 2;
  return m;
}

function microFighter(M: Materials) {
  const g = new THREE.Group(), body = new THREE.SphereGeometry(0.13, 14, 8);
  body.scale(1, 0.55, 0.8);
  add(g, body, M.clay(PALETTE.invader, { roughness: 0.5 }), 0, 0, 0, { cast: false });
  add(g, new THREE.SphereGeometry(0.065, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.clay(0xb8f5ff, { roughness: 0.25 }), 0, 0.03, 0, { cast: false });
  return g;
}

/**
 * The 10 Squadron Pod: an elongated cyan twin-rail pod visibly holding 2 × 5 micro-fighters, with a
 * crisp "10" on its hull. Each micro-fighter pops on its own, so a partial hit shows exactly how many fell.
 * "v" stands the pod up (the tens come from the squads, as in 10 × 4).
 */
export function makeTenSquadPod(M: Materials, orient: "h" | "v" = "h") {
  const g = new THREE.Group(), frame = new THREE.Group(), noCast = { cast: false };
  g.add(frame);
  const shell = new THREE.CapsuleGeometry(0.4, 1.45, 6, 20);
  shell.rotateZ(Math.PI / 2);
  shell.scale(1, 1, 0.45);
  outline(add(frame, shell, M.clay(0x6cc9dc, { roughness: 0.5 }), 0, 0, -0.05, noCast), M);
  const rail = M.clay(0x2f5f78, { roughness: 0.45 });
  for (const y of [-0.37, 0.37]) {
    const r = add(frame, new THREE.CylinderGeometry(0.045, 0.045, 2.05, 10), rail, 0, y, 0.12, noCast);
    r.rotation.z = Math.PI / 2;
  }
  const micro: THREE.Group[] = [];
  for (let row = 0; row < 2; row++) for (let c = 0; c < 5; c++) {
    const m = microFighter(M);
    m.position.set((c - 2) * 0.34, row === 0 ? 0.15 : -0.15, 0.2);
    frame.add(m);
    micro.push(m);
  }
  const tag = emblem("10", 0.4, 0.24);
  if (orient === "v") { frame.rotation.z = Math.PI / 2; tag.position.set(0.48, 0.92, 0.25); }
  else tag.position.set(-1.18, 0.32, 0.25);
  g.add(tag);
  return { group: g, micro, tag };
}

/** The 100 Carrier: a violet twin-deck cruiser holding 10 cyan 10-strips (100 cells) and a "100" emblem. */
export function makeCarrier(M: Materials, orient: "h" | "v" = "h") {
  const g = new THREE.Group(), frame = new THREE.Group(), noCast = { cast: false };
  g.add(frame);
  const deck = new THREE.BoxGeometry(2.15, 0.42, 0.5, 1, 1, 1);
  const violet = M.clay(0x8d6fe0, { roughness: 0.5 }), dark = M.clay(0x3a2c6e, { roughness: 0.55 });
  outline(add(frame, deck, violet, 0, 0.23, -0.05, noCast), M);
  outline(add(frame, deck, violet, 0, -0.23, -0.05, noCast), M);
  add(frame, new THREE.BoxGeometry(2.25, 0.06, 0.56), dark, 0, 0, -0.05, noCast);
  const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.056, 0.05), M.glow(0x3dd6e6, 0.55), 100);
  const o = new THREE.Object3D();
  for (let s = 0; s < 10; s++) for (let c = 0; c < 10; c++) {
    o.position.set((s - 4.5) * 0.205, (c - 4.5) * 0.074, 0.22);
    o.updateMatrix();
    cells.setMatrixAt(s * 10 + c, o.matrix);
  }
  frame.add(cells);
  const tag = emblem("100", 0.5, 0.26);
  if (orient === "v") { frame.rotation.z = Math.PI / 2; tag.position.set(0.62, 1.0, 0.3); }
  else tag.position.set(0, 0.6, 0.3);
  g.add(tag);
  /** Hide the first `n` cells (a partial hit: whole strips first, then cells of the next strip). */
  const base = Array.from({ length: 100 }, (_, i) => { const m = new THREE.Matrix4(); cells.getMatrixAt(i, m); return m; });
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const popped = (n: number) => { for (let i = 0; i < 100; i++) cells.setMatrixAt(i, i < n ? zero : base[i]); cells.instanceMatrix.needsUpdate = true; };
  return { group: g, cells, popped, tag };
}

/** The 1,000+ Dreadnought: a gold and crimson flagship with reactor rings and a core badge (1K, 10K, 1M…). */
export function makeDreadnought(M: Materials, label: string, orient: "h" | "v" = "h") {
  const g = new THREE.Group(), frame = new THREE.Group(), noCast = { cast: false };
  g.add(frame);
  const hullGeo = new THREE.SphereGeometry(1, 32, 16);
  hullGeo.scale(1.08, 0.4, 0.3);
  outline(add(frame, hullGeo, M.clay(0xf0c058, { roughness: 0.45, metalness: 0.1 }), 0, 0, -0.05, noCast), M);
  const crimson = M.clay(0xc2414b, { roughness: 0.5 });
  const keel = add(frame, new THREE.BoxGeometry(1.7, 0.12, 0.34), crimson, 0, -0.28, 0, noCast);
  outline(keel, M);
  for (const x of [-0.62, 0.62]) add(frame, new THREE.TorusGeometry(0.19, 0.05, 10, 28), crimson, x, 0.02, 0.3, noCast);
  const segs: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) segs.push(add(frame, new THREE.BoxGeometry(0.1, 0.07, 0.04), M.glow(0xff7a59, 0.5), (i - 4.5) * 0.13, -0.15, 0.31, noCast));
  const tag = emblem(label, 0.52, 0.28, ["#2a0f1a", "#ffd88a"]);
  if (orient === "v") { frame.rotation.z = Math.PI / 2; tag.position.set(0, 0, 0.42); }
  else tag.position.set(0, 0.1, 0.38);
  g.add(tag);
  /** Show a partial hit as tenths of the hull's meter. */
  const damaged = (fraction: number) => segs.forEach((s, i) => { s.visible = i >= Math.round(fraction * 10); });
  return { group: g, damaged, tag };
}

/** A dashed ghost fighter (Borrow & Take Back): shows the borrowed ship, clearly not a real one. */
export function makeGhost() {
  const body = new THREE.SphereGeometry(0.55, 16, 8);
  body.scale(1, 0.5, 1);
  const edges = new THREE.EdgesGeometry(body, 20);
  const line = new THREE.LineSegments(edges, new THREE.LineDashedMaterial({ color: 0x9fe8ff, dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0.9 }));
  line.computeLineDistances();
  const fill = new THREE.Mesh(body, new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.12, depthWrite: false }));
  const g = new THREE.Group();
  g.add(fill, line);
  return g;
}
