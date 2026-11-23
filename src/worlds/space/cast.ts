import * as THREE from "three";
import { add, PALETTE, type Materials } from "@/engine/materials";
import { clamp, type Rng } from "@/engine/util";

/**
 * The Storybook cast: hand-built characters with jointed limbs (hips, knees, shoulders, elbows),
 * mitten hands, ears, iris eyes, voice-driven mouths, layered hair and role costumes.
 * Facing +z, feet at y = 0.
 */
export type Role = "kid" | "teacher" | "principal" | "captain";
type Hair = "short" | "bun" | "pigtails" | "curly" | "long" | "bald" | "swept";
type Extra = "glasses" | "tie" | "mustache";
export interface Spec { role?: Role; skin: number; hair: number; hs: Hair; top: number; bot: number; shoe?: number; eyes?: number; ex?: Extra[] }

interface Build { L: number; Ht: number; R: number; H: number; A: number }
const KID: Build = { L: 0.4, Ht: 0.42, R: 0.16, H: 0.21, A: 0.36 };
const ADULT: Build = { L: 0.78, Ht: 0.7, R: 0.2, H: 0.19, A: 0.6 };

export const SKIN = [0xf1c7a5, 0xd9a27e, 0xa86b4a, 0x7a4a32, 0xf5d6c0, 0xc68f6a];
export const CLASSMATES: Spec[] = [
  { skin: 0, hair: 0x2b1b12, hs: "pigtails", top: 0xff8f70, bot: 0x4a5a8a, eyes: 0x5b3a1f },
  { skin: 2, hair: 0x2e1f18, hs: "curly", top: 0x6cc3a0, bot: 0x3d405b, eyes: 0x2b1b12 },
  { skin: 4, hair: 0xc98a3c, hs: "short", top: 0x7fa7ff, bot: 0x55597a, eyes: 0x3f7fbf },
  { skin: 3, hair: 0x120c0a, hs: "bun", top: 0xf2c14e, bot: 0x3d405b, eyes: 0x2b1b12 },
  { skin: 1, hair: 0x3a2416, hs: "long", top: 0xb79cff, bot: 0x4a5a8a, eyes: 0x5b3a1f },
  { skin: 5, hair: 0x6b3a1f, hs: "swept", top: 0xef6f8a, bot: 0x55597a, eyes: 0x4a7a3a },
  { skin: 0, hair: 0xe2c27a, hs: "long", top: 0x8fd3ff, bot: 0x3d405b, eyes: 0x3f7fbf },
  { skin: 2, hair: 0x1a1212, hs: "short", top: 0xffb36b, bot: 0x4a5a8a, eyes: 0x2b1b12 },
];
export const PLAYER: Spec = { skin: 1, hair: 0x2b1b12, hs: "swept", top: PALETTE.invader, bot: 0x3d405b, eyes: 0x3a2416 };
export const TEACHER: Spec = { role: "teacher", skin: 4, hair: 0x5a3a24, hs: "bun", top: 0x0d9488, bot: 0x3b3a52, eyes: 0x4a7a3a, ex: ["glasses"] };
export const PRINCIPAL: Spec = { role: "principal", skin: 2, hair: 0x94a3b8, hs: "bald", top: 0x57534e, bot: 0x292524, eyes: 0x2b1b12, ex: ["glasses", "tie", "mustache"] };
export const CAPTAIN: Spec = { role: "captain", skin: 0, hair: 0x2b1b12, hs: "short", top: 0x1e3a8a, bot: 0x0f172a, eyes: 0x2b4a7a };

export interface Rig {
  body: THREE.Group; hips: THREE.Group[]; knees: THREE.Group[]; shoulders: THREE.Group[]; elbows: THREE.Group[];
  head: THREE.Group; mouth: THREE.Mesh; eyes: THREE.Group[]; torso: THREE.Group; prop: THREE.Object3D | null;
  H: number; L: number; blink: number; ph: number;
  /** raise amount and target */ r: number; raise: boolean;
  talking: boolean; look: THREE.Vector3 | null;
  seat: { y: number; z: number } | null; s: number; stand: number;
  walk: { pts: THREE.Vector3[]; t0: number; d: number; face?: THREE.Vector3 } | null;
}
export interface Character { group: THREE.Group; rig: Rig; spec: Spec }

const V = (x: number, y: number) => new THREE.Vector2(x, y);
const cap = (r: number, len: number) => new THREE.CapsuleGeometry(r, Math.max(0.001, len), 8, 18);

/** A mitten hand: palm, four finger pads in one rounded block, and an opposable thumb. */
function hand(parent: THREE.Object3D, skin: THREE.Material, r: number, side: number) {
  const h = new THREE.Group();
  parent.add(h);
  add(h, new THREE.SphereGeometry(r, 24, 18), skin, 0, -r * 0.2, 0).scale.set(1, 1.25, 0.66);
  add(h, new THREE.SphereGeometry(r * 0.86, 20, 14), skin, 0, -r * 1.05, r * 0.05).scale.set(1.04, 0.9, 0.62);
  const th = add(h, cap(r * 0.3, r * 0.55), skin, side * -r * 0.78, -r * 0.35, r * 0.25);
  th.rotation.set(0.4, 0, side * 0.75);
  return h;
}

export function makeCharacter(spec: Spec, M: Materials, rnd: Rng): Character {
  const role = spec.role ?? "kid", adult = role !== "kid";
  const { L, Ht, R, H, A } = adult ? ADULT : KID;
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const skin = M.skin(SKIN[spec.skin]), top = M.fabric(spec.top), bot = M.fabric(spec.bot), hair = M.clay(spec.hair, { roughness: spec.hs === "curly" ? 0.85 : 0.55 });
  const shoe = M.clay(spec.shoe ?? 0x2b2d42, { roughness: 0.45 }), sole = M.clay(0xf3eee6, { roughness: 0.7 });
  const dark = M.clay(PALETTE.dark, { roughness: 0.3 }), nc = { cast: false };
  const longSleeves = adult;

  // legs: hip → thigh → knee → shin → sneaker
  const hips: THREE.Group[] = [], knees: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * R * 0.45, L, 0);
    body.add(hip);
    add(hip, cap(R * 0.37, L * 0.5 - R * 0.37), bot, 0, -L * 0.25, 0);
    const knee = new THREE.Group();
    knee.position.y = -L * 0.5;
    hip.add(knee);
    add(knee, cap(R * 0.33, L * 0.5 - R * 0.3), adult ? bot : skin, 0, -L * 0.25, 0);
    if (!adult) add(knee, new THREE.CylinderGeometry(R * 0.36, R * 0.36, L * 0.06, 20), bot, 0, -L * 0.02, 0); // shorts hem
    add(knee, new THREE.SphereGeometry(R * 0.42, 24, 16), shoe, 0, -L * 0.5 + R * 0.1, R * 0.18).scale.set(0.95, 0.6, 1.55);
    add(knee, new THREE.SphereGeometry(R * 0.43, 24, 12), sole, 0, -L * 0.5 - R * 0.06, R * 0.18).scale.set(1.0, 0.22, 1.62);
    hips.push(hip); knees.push(knee);
  }
  add(body, new THREE.CylinderGeometry(R * 0.98, R * 1.02, R * 0.55, 32), bot, 0, L + R * 0.12, 0);

  // torso: a lathed body with soft shoulders, flattened front to back
  const torso = new THREE.Group();
  torso.position.y = L;
  body.add(torso);
  const shape = [V(0, 0), V(R * 0.97, 0), V(R * 1.0, Ht * 0.2), V(R * 1.03, Ht * 0.55), V(R * 1.1, Ht * 0.8), V(R * 0.98, Ht * 0.94), V(R * 0.6, Ht * 1.0), V(H * 0.34, Ht * 1.03), V(0, Ht * 1.03)];
  add(torso, new THREE.LatheGeometry(shape, 48), top).scale.set(1, 1, 0.8);
  if (role === "teacher" || role === "principal") {
    // an open cardigan or suit jacket over the shirt: the same body, slightly bigger, open at the front
    const coat = role === "teacher" ? M.fabric(0xd9a441) : M.fabric(spec.top);
    const shirt = role === "teacher" ? M.fabric(0xf6f1e7) : M.fabric(0xf3f4f6);
    (torso.children[0] as THREE.Mesh).material = shirt;
    add(torso, new THREE.LatheGeometry(shape.map((p) => V(p.x * 1.06, p.y * 0.99)), 48, Math.PI * 0.12, Math.PI * 1.76), coat).scale.set(1, 1, 0.82);
    if (role === "teacher") { const sc = add(torso, new THREE.TorusGeometry(H * 0.46, R * 0.12, 14, 36), M.fabric(0xfef3c7), 0, Ht * 0.98, 0); sc.rotation.x = Math.PI / 2; sc.scale.set(1, 0.86, 1); }
  } else if (role === "captain") {
    const gold = M.clay(0xfbbf24, { roughness: 0.28, metalness: 0.75 }), trim = M.clay(0x0f1f3d, { roughness: 0.4, metalness: 0.25 });
    for (const s of [-1, 1]) add(torso, new THREE.SphereGeometry(R * 0.62, 24, 16), gold, s * R * 1.02, Ht * 0.92, 0).scale.set(1.15, 0.5, 1.0);
    add(torso, new THREE.OctahedronGeometry(R * 0.26, 0), M.glow(0x38bdf8, 2.2), R * 0.4, Ht * 0.72, R * 0.83, nc);
    add(torso, new THREE.CylinderGeometry(R * 1.0, R * 1.0, R * 0.32, 32), trim, 0, Ht * 0.12, 0).scale.set(1, 1, 0.82);
    add(torso, new THREE.BoxGeometry(R * 0.5, R * 0.34, R * 0.12), gold, 0, Ht * 0.12, R * 0.82);
    for (let i = 0; i < 3; i++) add(torso, new THREE.SphereGeometry(R * 0.07, 12, 8), gold, 0, Ht * (0.32 + i * 0.17), R * 0.84, nc);
    const cape = add(torso, new THREE.BoxGeometry(R * 2.1, Ht * 1.25, R * 0.12), M.fabric(0x1d4ed8), 0, Ht * 0.42, -R * 0.92);
    cape.rotation.x = 0.12;
  } else {
    const ring = add(torso, new THREE.TorusGeometry(H * 0.4, R * 0.07, 12, 32), M.fabric(new THREE.Color(spec.top).multiplyScalar(0.8).getHex()), 0, Ht * 1.0, 0);
    ring.rotation.x = Math.PI / 2;
  }
  if (spec.ex?.includes("tie")) {
    add(torso, new THREE.BoxGeometry(R * 0.26, Ht * 0.52, 0.025), M.fabric(0xb91c1c), 0, Ht * 0.62, R * 0.83).rotation.x = -0.08;
    add(torso, new THREE.SphereGeometry(R * 0.15, 14, 10), M.fabric(0xb91c1c), 0, Ht * 0.9, R * 0.78).scale.set(1, 0.8, 0.7);
  }

  // arms: shoulder → upper arm → elbow → forearm → hand
  const shoulders: THREE.Group[] = [], elbows: THREE.Group[] = [];
  let prop: THREE.Object3D | null = null;
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * (R * 1.08 + R * 0.2), Ht * 0.88, 0);
    torso.add(sh);
    add(sh, new THREE.SphereGeometry(R * 0.32, 20, 14), role === "captain" ? top : top, 0, 0, 0);
    add(sh, cap(R * 0.28, A * 0.45 - R * 0.28), top, 0, -A * 0.24, 0);
    const el = new THREE.Group();
    el.position.y = -A * 0.48;
    sh.add(el);
    add(el, cap(R * 0.25, A * 0.42 - R * 0.25), longSleeves ? top : skin, 0, -A * 0.22, 0);
    if (longSleeves) add(el, new THREE.TorusGeometry(R * 0.26, R * 0.06, 10, 24), role === "captain" ? M.clay(0xfbbf24, { metalness: 0.7, roughness: 0.3 }) : top, 0, -A * 0.42, 0).rotation.x = Math.PI / 2;
    else add(sh, new THREE.CylinderGeometry(R * 0.33, R * 0.31, A * 0.06, 20), top, 0, -A * 0.36, 0); // sleeve hem
    const hd = hand(el, skin, R * 0.27, s);
    hd.position.y = -A * 0.5;
    if (role === "teacher" && s === 1) {
      prop = add(hd, new THREE.CylinderGeometry(0.009, 0.006, 0.55, 10), M.clay(0xb7792b, { roughness: 0.5 }), 0, -0.12, 0.2);
      prop.rotation.x = Math.PI / 2.4;
    }
    shoulders.push(sh); elbows.push(el);
  }

  // neck and head
  add(torso, new THREE.CylinderGeometry(H * 0.29, H * 0.33, H * 0.42, 24), skin, 0, Ht * 1.05, 0);
  const head = new THREE.Group();
  head.position.y = L + Ht + H * 0.22;
  body.add(head);
  const hy = H * 0.95;
  add(head, new THREE.SphereGeometry(H, 48, 32), skin, 0, hy, 0).scale.set(1, 1.04, 0.97);
  add(head, new THREE.SphereGeometry(H * 0.7, 32, 20), skin, 0, hy - H * 0.36, H * 0.2).scale.set(1, 0.72, 0.88); // jaw and chin
  const surf = (x: number, y: number) => Math.sqrt(Math.max(0, H * H - x * x - y * y));
  for (const s of [-1, 1]) {
    add(head, new THREE.SphereGeometry(H * 0.21, 20, 14), skin, s * H * 0.97, hy - H * 0.02, -H * 0.04).scale.set(0.42, 1, 0.72);
    add(head, new THREE.SphereGeometry(H * 0.11, 14, 10), M.skin(new THREE.Color(SKIN[spec.skin]).multiplyScalar(0.82).getHex()), s * H * 1.02, hy - H * 0.02, -H * 0.02, nc).scale.set(0.3, 0.8, 0.5);
  }
  const eyes: THREE.Group[] = [];
  const iris = M.clay(spec.eyes ?? 0x3a2416, { roughness: 0.25 }), white = M.clay(0xfbfaf7, { roughness: 0.25 }), glint = M.glow(0xffffff, 0.9);
  for (const s of [-1, 1]) {
    const x = s * H * 0.34, y = H * 0.06, eg = new THREE.Group();
    eg.position.set(x, hy + y, surf(x, y) * 0.94);
    head.add(eg);
    eyes.push(eg);
    add(eg, new THREE.SphereGeometry(H * 0.165, 32, 22), white, 0, 0, 0, nc).scale.set(1, 1.1, 0.55);
    add(eg, new THREE.SphereGeometry(H * 0.105, 28, 18), iris, 0, -H * 0.005, H * 0.058, nc).scale.set(1, 1.04, 0.45);
    add(eg, new THREE.SphereGeometry(H * 0.052, 20, 14), dark, 0, -H * 0.005, H * 0.083, nc).scale.set(1, 1, 0.4);
    add(eg, new THREE.SphereGeometry(H * 0.026, 12, 8), glint, H * 0.04, H * 0.045, H * 0.1, nc);
    const brow = add(head, new THREE.TorusGeometry(H * 0.15, H * 0.024, 8, 20, Math.PI * 0.62), hair, x, hy + H * 0.3, surf(x, H * 0.3) * 0.96, nc);
    brow.rotation.z = Math.PI * 0.19 + (role === "captain" ? s * -0.12 : s * 0.05);
  }
  add(head, new THREE.SphereGeometry(H * 0.11, 20, 14), skin, 0, hy - H * 0.1, H * 0.98, nc).scale.set(0.9, 0.85, 1);
  for (const s of [-1, 1]) add(head, new THREE.SphereGeometry(H * 0.13, 14, 10), M.clay(0xff8fa0, { roughness: 0.8, transparent: true, opacity: 0.35 }), s * H * 0.56, hy - H * 0.22, surf(H * 0.56, -H * 0.22) * 0.92, nc).scale.z = 0.35;
  const my = -H * 0.42, mz = surf(0, my) * 0.9;
  const mouth = add(head, new THREE.SphereGeometry(H * 0.13, 24, 14), M.clay(0x5a1f2a, { roughness: 0.6 }), 0, hy + my, mz, nc);
  mouth.scale.set(1, 0.18, 0.45);
  const lip = add(head, new THREE.TorusGeometry(H * 0.13, H * 0.024, 8, 24, Math.PI * 0.85), M.clay(0xc4706a, { roughness: 0.5 }), 0, hy + my + H * 0.02, mz + H * 0.02, nc);
  lip.rotation.z = Math.PI + Math.PI * 0.075;

  // hair
  const hs = spec.hs;
  if (hs !== "bald") add(head, new THREE.SphereGeometry(H * 1.07, 48, 24, 0, Math.PI * 2, 0, Math.PI * (hs === "curly" ? 0.42 : 0.47)), hair, 0, hy, 0).rotation.x = -0.32;
  if (hs === "short" || hs === "swept") for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * H * 0.16, f = add(head, cap(H * 0.075, H * 0.16), hair, x, hy + H * 0.68, surf(x, H * 0.68) * 0.98 + H * 0.02);
    f.rotation.set(-0.9, 0, hs === "swept" ? -0.5 : (i - 2.5) * 0.1);
  }
  if (hs === "bun") {
    // a top knot that shows from the front, a side-parted fringe and soft volume over the ears
    add(head, new THREE.SphereGeometry(H * 0.42, 32, 24), hair, 0, hy + H * 0.92, -H * 0.42).scale.set(1, 0.9, 1);
    add(head, new THREE.TorusGeometry(H * 0.3, H * 0.06, 12, 32), M.clay(0xd94a4a, { roughness: 0.5 }), 0, hy + H * 0.78, -H * 0.36).rotation.x = Math.PI / 2 - 0.5;
    for (const [x, rz, len] of [[-0.28, 1.15, 0.46], [0.18, -1.05, 0.34], [0.46, -0.85, 0.22]] as const) {
      const f = add(head, cap(H * 0.13, H * len), hair, x * H, hy + H * 0.66, surf(x * H, H * 0.66) * 0.96);
      f.rotation.set(-0.55, 0, rz);
    }
    for (const sd of [-1, 1]) add(head, new THREE.SphereGeometry(H * 0.36, 24, 18), hair, sd * H * 0.82, hy + H * 0.2, -H * 0.12).scale.set(0.55, 1.1, 1.05);
  }
  if (hs === "pigtails") for (const s of [-1, 1]) {
    add(head, new THREE.SphereGeometry(H * 0.32, 24, 16), hair, s * H * 1.02, hy - H * 0.05, -H * 0.25).scale.set(0.9, 1.15, 0.9);
    add(head, new THREE.TorusGeometry(H * 0.14, H * 0.045, 10, 20), M.clay(0xf2c14e), s * H * 0.92, hy + H * 0.18, -H * 0.2).rotation.y = Math.PI / 2;
  }
  if (hs === "curly") {
    // many small coils on a Fibonacci sphere, so it reads as soft curls rather than a few big balls
    const n = 84;
    for (let i = 0; i < n; i++) {
      const yv = 1 - (i / (n - 1)) * 1.05, rr = Math.sqrt(Math.max(0, 1 - yv * yv)), th = i * 2.399963, x = Math.cos(th) * rr, z = Math.sin(th) * rr;
      if (yv < 0.3 && z > 0.1) continue; // keep the face and forehead clear
      if (yv < -0.05 && z > -0.5) continue;
      const k = 1.04 + rnd() * 0.05;
      add(head, new THREE.SphereGeometry(H * (0.13 + rnd() * 0.04), 14, 10), hair, x * H * k, hy + yv * H * k, z * H * k);
    }
  }
  if (hs === "long") {
    add(head, cap(H * 0.82, H * 1.05), hair, 0, hy - H * 0.45, -H * 0.34).scale.set(1, 1, 0.7);
    for (const s of [-1, 1]) add(head, cap(H * 0.2, H * 0.9), hair, s * H * 0.86, hy - H * 0.45, H * 0.06);
  }
  if (hs === "bald") {
    for (const s of [-1, 1]) add(head, new THREE.SphereGeometry(H * 0.32, 18, 14), hair, s * H * 0.86, hy - H * 0.02, -H * 0.3).scale.set(0.7, 1, 1.1);
  }
  if (spec.ex?.includes("glasses")) {
    const frame = M.clay(0x1f2937, { roughness: 0.3, metalness: 0.4 });
    for (const s of [-1, 1]) {
      const x = s * H * 0.34;
      add(head, new THREE.TorusGeometry(H * 0.18, H * 0.022, 10, 32), frame, x, hy + H * 0.06, surf(x, H * 0.06) + H * 0.06, nc);
      add(head, new THREE.BoxGeometry(H * 0.02, H * 0.02, H * 0.85), frame, s * H * 0.52, hy + H * 0.1, H * 0.38, nc);
    }
    add(head, new THREE.BoxGeometry(H * 0.32, H * 0.03, H * 0.03), frame, 0, hy + H * 0.1, surf(0, H * 0.1) + H * 0.07, nc);
  }
  if (spec.ex?.includes("mustache")) add(head, new THREE.TorusGeometry(H * 0.15, H * 0.055, 10, 20, Math.PI), hair, 0, hy - H * 0.24, surf(0, -H * 0.24) * 1.0, nc);
  if (role === "captain") {
    const navy = M.fabric(0x13254f), gold = M.clay(0xfbbf24, { roughness: 0.28, metalness: 0.75 });
    add(head, new THREE.CylinderGeometry(H * 1.06, H * 1.0, H * 0.48, 40), navy, 0, hy + H * 0.8, -H * 0.04);
    add(head, new THREE.TorusGeometry(H * 1.02, H * 0.05, 10, 40), gold, 0, hy + H * 0.6, -H * 0.03).rotation.x = Math.PI / 2;
    add(head, new THREE.CylinderGeometry(H * 0.8, H * 0.8, H * 0.05, 32, 1, false, -Math.PI / 2, Math.PI), dark, 0, hy + H * 0.56, H * 0.38).rotation.x = 0.12;
    add(head, new THREE.OctahedronGeometry(H * 0.13, 0), M.glow(0xfbbf24, 1.6), 0, hy + H * 0.84, H * 1.06, nc);
  }

  const rig: Rig = { body, hips, knees, shoulders, elbows, head, mouth, eyes, torso, prop, H, L, blink: rnd() * 3, ph: rnd() * 6, r: 0, raise: false, talking: false, look: null, seat: null, s: 0, stand: 0, walk: null };
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  if (role === "captain") g.scale.setScalar(1.06);
  return { group: g, rig, spec };
}

/** Sits a character down: hips on the seat, thighs forward, shins down, forearms on the desk. */
export function seat(c: Character, x: number, seatHeight: number, z: number) {
  c.rig.seat = { y: seatHeight - c.rig.L, z };
  c.group.position.set(x, c.rig.seat.y, z);
}

export const headPosition = (c: Character) => c.rig.head.localToWorld(new THREE.Vector3(0, c.rig.H * 0.95, 0));
/** The eye point, for first-person shots. */
export const eyePosition = (c: Character) => c.rig.head.localToWorld(new THREE.Vector3(0, c.rig.H * 1.02, c.rig.H * 0.92));
export const face = (g: THREE.Object3D, t: THREE.Vector3) => (g.rotation.y = Math.atan2(t.x - g.position.x, t.z - g.position.z));

/** Per-frame life: breathing, blinking, a voice-driven mouth, looking, raising a hand, sitting, standing, walking. */
export function animateCharacter(c: Character, T: number, dt: number, rnd: Rng, voice = 0) {
  const u = c.rig, g = c.group, k = (rate: number) => Math.min(1, dt * rate);
  u.torso.scale.set(1, 1 + Math.sin(T * 2.2 + u.ph) * 0.012, 1);
  u.blink -= dt;
  let ey = 1;
  if (u.blink < 0) { ey = 0.1; if (u.blink < -0.12) u.blink = 2 + rnd() * 3; }
  u.eyes.forEach((e) => (e.scale.y = ey));
  const open = u.talking ? (voice > 0.02 ? 0.18 + voice * 1.05 : 0.25 + Math.abs(Math.sin(T * 11 + u.ph)) * 0.6) : 0.18;
  u.mouth.scale.y += (open - u.mouth.scale.y) * k(18);

  let yaw = 0, pitch = 0;
  if (u.look) {
    const w = headPosition(c), d = Math.atan2(u.look.x - w.x, u.look.z - w.z) - g.rotation.y;
    yaw = clamp(Math.atan2(Math.sin(d), Math.cos(d)), -1.1, 1.1);
    pitch = clamp(Math.atan2(w.y - u.look.y, Math.hypot(u.look.x - w.x, u.look.z - w.z)), -0.4, 0.4);
  }
  u.head.rotation.y += (yaw - u.head.rotation.y) * k(5);
  u.head.rotation.x += (pitch * 0.6 + (u.talking ? Math.sin(T * 5.5) * 0.04 : 0) - u.head.rotation.x) * k(5);
  u.head.rotation.z = Math.sin(T * 1.3 + u.ph) * 0.035;

  // sitting ↔ standing
  if (u.seat) {
    u.s += (u.stand - u.s) * k(4);
    g.position.y = u.seat.y * (1 - u.s);
    g.position.z = u.seat.z + 0.22 * u.s;
  }
  const sit = u.seat ? 1 - u.s : 0;
  if (!u.walk) {
    u.hips.forEach((h) => (h.rotation.x = -Math.PI / 2 * sit));
    u.knees.forEach((n) => (n.rotation.x = Math.PI / 2 * sit));
  }
  // arms: rest, forearms on the desk when seated, the right arm up when raising a hand
  u.r += ((u.raise ? 1 : 0) - u.r) * k(7);
  // standing speakers talk with their hands: forearms lift and sway with the voice
  const gest = u.talking && sit < 0.5 && !u.walk ? 1 : 0;
  u.shoulders.forEach((sh, i) => {
    const side = i === 0 ? -1 : 1, up = side === 1 ? u.r : 0;
    const g1 = gest * (0.35 + 0.18 * Math.sin(T * 2.6 + i * 1.7 + u.ph) + voice * 0.4);
    sh.rotation.x = -0.55 * sit * (1 - up) - g1 * 0.35 * (1 - up);
    sh.rotation.z = side * (0.14 + (Math.PI * 0.86 - 0.14) * up) + (up ? Math.sin(T * 9) * 0.05 : 0);
    u.elbows[i].rotation.x = (-1.05 * sit - 0.28 * (1 - sit) - g1) * (1 - up) - 0.25 * up;
  });

  if (u.walk) {
    const w = u.walk, kk = clamp((T - w.t0) / w.d), seg = kk * (w.pts.length - 1), i = Math.min(w.pts.length - 2, Math.floor(seg));
    g.position.lerpVectors(w.pts[i], w.pts[i + 1], seg - i);
    if (kk < 1) {
      const sw = Math.sin(T * 8);
      g.position.y = Math.abs(sw) * 0.04;
      face(g, w.pts[i + 1]);
      u.hips[0].rotation.x = sw * 0.45; u.hips[1].rotation.x = -sw * 0.45;
      u.knees[0].rotation.x = Math.max(0, -sw) * 0.6; u.knees[1].rotation.x = Math.max(0, sw) * 0.6;
      u.shoulders[0].rotation.x = -sw * 0.35; u.shoulders[1].rotation.x = sw * 0.35;
    } else {
      if (w.face) face(g, w.face);
      u.hips.forEach((h) => (h.rotation.x = 0)); u.knees.forEach((n) => (n.rotation.x = 0));
      u.walk = null;
    }
  }
}

/**
 * Nova, the co-pilot: a hovering clay drone with a face screen that brightens as she speaks.
 * `glow: false` (battle): her screen and ring stay under the bloom threshold, so no halo.
 */
export function makeNova(M: Materials, { glow = true } = {}) {
  const k = glow ? 1 : 0.32;
  const g = new THREE.Group(), nc = { cast: false };
  add(g, new THREE.SphereGeometry(0.32, 48, 32), M.clay(PALETTE.clay, { roughness: 0.4 }));
  add(g, new THREE.SphereGeometry(0.245, 40, 24), M.clay(PALETTE.ink2, { roughness: 0.2 }), 0, 0.02, 0.16, nc).scale.set(1, 0.76, 0.56);
  const screen = new THREE.MeshStandardMaterial({ color: PALETTE.cyan, emissive: PALETTE.cyan, emissiveIntensity: 2.6 * k });
  for (const s of [-1, 1]) add(g, new THREE.CapsuleGeometry(0.028, 0.045, 6, 12), screen, s * 0.085, 0.06, 0.3, nc);
  const smile = add(g, new THREE.TorusGeometry(0.06, 0.014, 8, 20, Math.PI), screen, 0, -0.04, 0.3, nc);
  smile.rotation.z = Math.PI;
  const ringMat = new THREE.MeshStandardMaterial({ color: PALETTE.invader, emissive: PALETTE.invader, emissiveIntensity: 2.4 * k });
  const ring = add(g, new THREE.TorusGeometry(0.46, 0.018, 10, 96), ringMat, 0, 0, 0, nc);
  ring.rotation.x = Math.PI / 2.3;
  add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), M.clay(PALETTE.dark), 0, 0.38, 0);
  add(g, new THREE.SphereGeometry(0.045, 16, 12), ringMat, 0, 0.5, 0, nc);
  for (const s of [-1, 1]) {
    add(g, new THREE.SphereGeometry(0.075, 20, 14), M.clay(PALETTE.invader, { roughness: 0.4 }), s * 0.31, 0.02, 0);
    add(g, new THREE.TorusGeometry(0.075, 0.012, 8, 24), M.clay(0xf3eee6), s * 0.3, 0.02, 0).rotation.y = Math.PI / 2;
  }
  return {
    group: g,
    animate(T: number, dt: number, baseY: number, voice = 0) {
      g.position.y = baseY + Math.sin(T * 2) * 0.08;
      ring.rotation.z += dt * (1.5 + voice * 4);
      g.rotation.y = Math.sin(T * 0.7) * 0.4;
      screen.emissiveIntensity = (2.2 + voice * 3.5) * k;
      smile.scale.y = 1 + voice * 1.6;
    },
  };
}
