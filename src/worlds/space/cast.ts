import * as THREE from "three";
import { add, PALETTE, type Materials } from "@/engine/materials";
import { clamp, type Rng } from "@/engine/util";

/** Proportions of one character style. L legs, Ht torso, R torso radius, H head radius, A arm length. */
interface Build { L: number; Ht: number; R: number; H: number; A: number }
export interface CharStyle { label: string; eye: "bean" | "dot" | "big"; torso: "capsule" | "taper"; kid: Build; adult: Build }

export const STYLES = {
  story: { label: "Storybook", eye: "dot", torso: "taper", kid: { L: 0.36, Ht: 0.42, R: 0.16, H: 0.21, A: 0.38 }, adult: { L: 0.72, Ht: 0.72, R: 0.2, H: 0.19, A: 0.62 } },
  bean: { label: "Clay bean", eye: "bean", torso: "capsule", kid: { L: 0.2, Ht: 0.34, R: 0.2, H: 0.3, A: 0.24 }, adult: { L: 0.42, Ht: 0.58, R: 0.24, H: 0.27, A: 0.4 } },
  toy: { label: "Big-eye toy", eye: "big", torso: "capsule", kid: { L: 0.16, Ht: 0.42, R: 0.22, H: 0.25, A: 0.26 }, adult: { L: 0.36, Ht: 0.78, R: 0.25, H: 0.23, A: 0.46 } },
} satisfies Record<string, CharStyle>;
export type StyleKey = keyof typeof STYLES;

type Hair = "short" | "bun" | "pigtails" | "curly" | "long" | "bald";
type Extra = "glasses" | "tie" | "mustache" | "cap" | "epaulettes" | "badge";
export interface Spec { adult?: boolean; skin: number; hair: number; hs: Hair; top: number; bot: number; ex?: Extra[] }

export const SKIN = [0xf1c7a5, 0xd9a27e, 0xa86b4a, 0x7a4a32, 0xf5d6c0, 0xc68f6a];
export const CLASSMATES: Spec[] = [
  { skin: 0, hair: 0x2b1b12, hs: "pigtails", top: 0xff8f70, bot: 0x4a5a8a },
  { skin: 2, hair: 0x1a1212, hs: "curly", top: 0x6cc3a0, bot: 0x3d405b },
  { skin: 4, hair: 0xc98a3c, hs: "short", top: 0x7fa7ff, bot: 0x55597a },
  { skin: 3, hair: 0x120c0a, hs: "bun", top: 0xf2c14e, bot: 0x3d405b },
  { skin: 1, hair: 0x3a2416, hs: "long", top: 0xb79cff, bot: 0x4a5a8a },
  { skin: 5, hair: 0x6b3a1f, hs: "short", top: 0xef6f8a, bot: 0x55597a },
  { skin: 0, hair: 0xe2c27a, hs: "long", top: 0x8fd3ff, bot: 0x3d405b },
  { skin: 2, hair: 0x1a1212, hs: "short", top: 0xffb36b, bot: 0x4a5a8a },
];
export const PLAYER: Spec = { skin: 1, hair: 0x2b1b12, hs: "short", top: PALETTE.invader, bot: 0x3d405b };
export const TEACHER: Spec = { adult: true, skin: 4, hair: 0x8a7a6a, hs: "bun", top: 0xd9a441, bot: 0x6b4f7a, ex: ["glasses"] };
export const PRINCIPAL: Spec = { adult: true, skin: 2, hair: 0x3a3a3a, hs: "bald", top: 0x2f3e63, bot: 0x2f3e63, ex: ["tie", "mustache"] };
export const CAPTAIN: Spec = { adult: true, skin: 0, hair: 0x2b1b12, hs: "short", top: PALETTE.clay, bot: 0x23305a, ex: ["cap", "epaulettes", "badge"] };

/** The animatable parts of a character and its live state. */
export interface Rig {
  arms: THREE.Group[]; legs: THREE.Group[]; head: THREE.Group; mouth: THREE.Mesh; eyes: THREE.Group[]; torso: THREE.Mesh;
  H: number; blink: number; ph: number;
  /** current raise amount and target */ r: number; raise: boolean;
  talking: boolean; look: THREE.Vector3 | null; baseArmX: number;
  /** seated characters: seat height and depth, current stand amount and target */
  seat: { y: number; z: number } | null; s: number; stand: number;
  walk: { pts: THREE.Vector3[]; t0: number; d: number } | null;
}
export interface Character { group: THREE.Group; rig: Rig }

/** Builds a character from a spec in a given style. Facing +z, feet at y = 0. */
export function makeCharacter(spec: Spec, style: CharStyle, M: Materials, rnd: Rng): Character {
  const g = new THREE.Group();
  const { L, Ht, R, H, A } = style[spec.adult ? "adult" : "kid"];
  const taper = style.torso === "taper";
  const skin = M.clay(SKIN[spec.skin], { roughness: 0.55 }), top = M.clay(spec.top), bot = M.clay(spec.bot), hair = M.clay(spec.hair, { roughness: 0.75 });
  const dark = M.clay(PALETTE.dark, { roughness: 0.35 }), glint = M.glow(0xffffff, 0.6), noCast = { cast: false };

  const legs: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const lp = new THREE.Group();
    lp.position.set(s * R * 0.45, L, 0);
    g.add(lp);
    if (taper) add(lp, new THREE.CylinderGeometry(R * 0.32, R * 0.28, L, 12), bot, 0, -L / 2, 0);
    else add(lp, new THREE.CapsuleGeometry(R * 0.36, Math.max(0.01, L - R * 0.5), 6, 12), bot, 0, -L / 2, 0);
    add(lp, new THREE.SphereGeometry(R * 0.4, 16, 10), M.clay(0x3a3340), 0, -L + R * 0.1, R * 0.15).scale.set(1, 0.6, 1.4);
    legs.push(lp);
  }
  const torso = taper
    ? add(g, new THREE.CylinderGeometry(R * 0.85, R * 1.1, Ht, 24), top, 0, L + Ht / 2, 0)
    : add(g, new THREE.CapsuleGeometry(R, Math.max(0.02, Ht - R * 1.2), 8, 20), top, 0, L + Ht / 2, 0);
  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const ap = new THREE.Group();
    ap.position.set(s * (R * (taper ? 0.92 : 1.0) + R * 0.22), L + Ht - R * 0.35, 0);
    g.add(ap);
    add(ap, new THREE.CapsuleGeometry(R * 0.27, Math.max(0.01, A - R * 0.5), 6, 12), top, 0, -A / 2, 0);
    add(ap, new THREE.SphereGeometry(R * 0.3, 14, 10), skin, 0, -A + R * 0.05, 0);
    ap.rotation.z = s * 0.12;
    arms.push(ap);
  }
  if (taper) add(g, new THREE.CylinderGeometry(H * 0.32, H * 0.36, H * 0.4, 12), skin, 0, L + Ht + H * 0.1, 0);

  const head = new THREE.Group();
  head.position.set(0, L + Ht + (taper ? H * 0.25 : -R * 0.15), 0);
  g.add(head);
  const hy = H * 0.95;
  add(head, new THREE.SphereGeometry(H, 32, 20), skin, 0, hy, 0);
  const surf = (x: number, y: number) => Math.sqrt(Math.max(0, H * H - x * x - y * y));
  const ex = H * 0.36, ey = H * 0.08, eyes: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const x = s * ex, eg = new THREE.Group();
    eg.position.set(x, hy + ey, surf(x, ey));
    head.add(eg);
    eyes.push(eg);
    if (style.eye === "bean") {
      add(eg, new THREE.SphereGeometry(H * 0.1, 14, 10), dark, 0, 0, -H * 0.03, noCast).scale.set(0.8, 1.25, 0.6);
      add(eg, new THREE.SphereGeometry(H * 0.028, 8, 6), glint, H * 0.03, H * 0.05, H * 0.03, noCast);
    } else if (style.eye === "dot") {
      add(eg, new THREE.SphereGeometry(H * 0.08, 12, 8), dark, 0, 0, -H * 0.02, noCast);
      add(head, new THREE.BoxGeometry(H * 0.24, H * 0.05, H * 0.06), hair, x, hy + ey + H * 0.24, surf(x, ey + H * 0.24) * 0.96, noCast).rotation.z = -s * 0.15;
    } else {
      add(eg, new THREE.SphereGeometry(H * 0.24, 18, 12), M.clay(0xffffff, { roughness: 0.3 }), 0, 0, -H * 0.08, noCast).scale.z = 0.6;
      add(eg, new THREE.SphereGeometry(H * 0.12, 12, 10), dark, 0, -H * 0.02, H * 0.06, noCast);
      add(eg, new THREE.SphereGeometry(H * 0.035, 8, 6), glint, H * 0.04, H * 0.03, H * 0.13, noCast);
    }
  }
  if (style.eye === "dot") add(head, new THREE.SphereGeometry(H * 0.12, 12, 8), skin, 0, hy - H * 0.08, H * 0.98, noCast);
  else for (const s of [-1, 1]) add(head, new THREE.SphereGeometry(H * 0.13, 12, 8), M.clay(0xff9aa2, { roughness: 0.8 }), s * H * 0.56, hy - H * 0.2, surf(H * 0.56, -H * 0.2) * 0.9, noCast).scale.z = 0.4;
  const mouth = add(head, new THREE.TorusGeometry(H * 0.17, H * 0.035, 6, 16, Math.PI), M.clay(0x6a2a2a), 0, hy - H * 0.34, surf(0, -H * 0.34) * 0.97, noCast);
  mouth.rotation.z = Math.PI;

  const hs = spec.hs;
  if (hs !== "bald") add(head, new THREE.SphereGeometry(H * 1.06, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.45), hair, 0, hy, 0).rotation.x = -0.35;
  if (hs === "bun") add(head, new THREE.SphereGeometry(H * 0.38, 16, 12), hair, 0, hy + H * 0.7, -H * 0.6);
  if (hs === "pigtails") for (const s of [-1, 1]) add(head, new THREE.SphereGeometry(H * 0.32, 16, 12), hair, s * H, hy + H * 0.05, -H * 0.25);
  if (hs === "curly") for (let k = 0; k < 12; k++) {
    const th = ((k % 6) / 6) * Math.PI * 2 + (k < 6 ? 0 : 0.5), ph = k < 6 ? 0.55 : 1.05, x = Math.sin(ph) * Math.cos(th), z = Math.sin(ph) * Math.sin(th);
    if (k >= 6 && z > 0.5) continue;
    add(head, new THREE.SphereGeometry(H * 0.36, 12, 10), hair, x * H, hy + Math.cos(ph) * H, z * H);
  }
  if (hs === "long") add(head, new THREE.CapsuleGeometry(H * 0.78, H * 0.9, 8, 16), hair, 0, hy - H * 0.45, -H * 0.32);
  if (hs === "bald") for (const s of [-1, 1]) add(head, new THREE.SphereGeometry(H * 0.3, 12, 10), hair, s * H * 0.88, hy - H * 0.05, -H * 0.25);

  const ext = spec.ex ?? [], gold = M.clay(PALETTE.gold, { metalness: 0.6, roughness: 0.3, emissive: 0xffb020, emissiveIntensity: 0.25 });
  if (ext.includes("glasses")) {
    for (const s of [-1, 1]) add(head, new THREE.TorusGeometry(H * 0.2, H * 0.03, 8, 20), dark, s * ex, hy + ey, surf(ex, ey) + H * (style.eye === "big" ? 0.12 : 0.03), noCast);
    add(head, new THREE.BoxGeometry(H * 0.32, H * 0.04, H * 0.04), dark, 0, hy + ey, surf(0, ey) + H * 0.04, noCast);
  }
  if (ext.includes("mustache")) add(head, new THREE.TorusGeometry(H * 0.16, H * 0.06, 8, 16, Math.PI), hair, 0, hy - H * 0.2, surf(0, -H * 0.2), noCast);
  if (ext.includes("tie")) add(g, new THREE.BoxGeometry(R * 0.25, Ht * 0.55, 0.03), M.clay(0xd94a4a), 0, L + Ht * 0.55, R * (taper ? 1.0 : 1.02));
  if (ext.includes("cap")) {
    add(head, new THREE.CylinderGeometry(H, H * 1.05, H * 0.42, 24), M.clay(0x23305a), 0, hy + H * 0.78, -H * 0.02);
    add(head, new THREE.CylinderGeometry(H * 0.75, H * 0.75, H * 0.05, 24, 1, false, -Math.PI / 2, Math.PI), dark, 0, hy + H * 0.58, H * 0.35);
    add(head, new THREE.SphereGeometry(H * 0.12, 12, 8), gold, 0, hy + H * 0.82, H * 1.03);
  }
  if (ext.includes("epaulettes")) for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(R * 0.6, 0.04, R * 0.6), gold, s * R * 0.95, L + Ht - R * 0.05, 0);
  if (ext.includes("badge")) add(g, new THREE.BoxGeometry(R * 0.3, R * 0.3, 0.03), gold, -R * 0.45, L + Ht * 0.7, R * 0.97);

  return {
    group: g,
    rig: { arms, legs, head, mouth, eyes, torso, H, blink: rnd() * 3, ph: rnd() * 6, r: 0, raise: false, talking: false, look: null, baseArmX: 0, seat: null, s: 0, stand: 0, walk: null },
  };
}

/** Sits a character down: hips on the seat, legs forward, forearms on the desk. */
export function seat(c: Character, x: number, y: number, z: number) {
  c.rig.seat = { y, z };
  c.group.position.set(x, y, z);
  c.rig.legs.forEach((l) => (l.rotation.x = -Math.PI / 2));
  c.rig.baseArmX = -0.8;
}

export const headPosition = (c: Character) => c.rig.head.getWorldPosition(new THREE.Vector3());
export const face = (g: THREE.Object3D, t: THREE.Vector3) => (g.rotation.y = Math.atan2(t.x - g.position.x, t.z - g.position.z));

/** Per-frame life: breathing, blinking, talking, looking, raising a hand, standing up and walking. */
export function animateCharacter(c: Character, T: number, dt: number, rnd: Rng, faceWhenArrived?: THREE.Vector3) {
  const u = c.rig, g = c.group;
  u.torso.scale.y = 1 + Math.sin(T * 2.2 + u.ph) * 0.015;
  u.blink -= dt;
  let ey = 1;
  if (u.blink < 0) { ey = 0.12; if (u.blink < -0.12) u.blink = 2 + rnd() * 3; }
  u.eyes.forEach((e) => (e.scale.y = ey));
  u.mouth.scale.y = u.talking ? 0.5 + Math.abs(Math.sin(T * 13 + u.ph)) * 1.6 : 1;

  let yaw = 0;
  if (u.look) {
    const w = headPosition(c), d = Math.atan2(u.look.x - w.x, u.look.z - w.z) - g.rotation.y;
    yaw = clamp(Math.atan2(Math.sin(d), Math.cos(d)), -1.1, 1.1);
  }
  u.head.rotation.y += (yaw - u.head.rotation.y) * Math.min(1, dt * 5);
  u.head.rotation.z = Math.sin(T * 1.3 + u.ph) * 0.04 + (u.talking ? Math.sin(T * 6) * 0.035 : 0);

  if (u.seat) {
    u.s += (u.stand - u.s) * Math.min(1, dt * 4);
    g.position.y = u.seat.y * (1 - u.s);
    g.position.z = u.seat.z + 0.2 * u.s;
    u.legs.forEach((l) => (l.rotation.x = (-Math.PI / 2) * (1 - u.s)));
  }
  const bx = u.seat ? u.baseArmX * (1 - u.s) : 0;
  u.r += ((u.raise ? 1 : 0) - u.r) * Math.min(1, dt * 8);
  const a = u.arms[1];
  a.rotation.z = 0.12 + (Math.PI * 0.9 - 0.12) * u.r + (u.raise ? Math.sin(T * 9) * 0.06 : 0);
  a.rotation.x = bx * (1 - u.r);
  u.arms[0].rotation.x = bx;

  if (u.walk) {
    const w = u.walk, k = clamp((T - w.t0) / w.d), seg = k * (w.pts.length - 1), i = Math.min(w.pts.length - 2, Math.floor(seg));
    g.position.lerpVectors(w.pts[i], w.pts[i + 1], seg - i);
    if (k < 1) {
      g.position.y = Math.abs(Math.sin(T * 8)) * 0.05;
      face(g, w.pts[i + 1]);
      u.legs[0].rotation.x = Math.sin(T * 8) * 0.4;
      u.legs[1].rotation.x = -Math.sin(T * 8) * 0.4;
    } else {
      if (faceWhenArrived) face(g, faceWhenArrived);
      u.legs.forEach((l) => (l.rotation.x = 0));
      u.walk = null;
    }
  }
}

/** Nova, the co-pilot: a hovering clay drone with a glowing face screen and halo. */
export function makeNova(M: Materials) {
  const g = new THREE.Group(), noCast = { cast: false };
  add(g, new THREE.SphereGeometry(0.32, 32, 20), M.clay(PALETTE.clay, { roughness: 0.45 }));
  add(g, new THREE.SphereGeometry(0.24, 24, 16), M.clay(PALETTE.ink2, { roughness: 0.25 }), 0, 0.02, 0.16, noCast).scale.set(1, 0.75, 0.55);
  for (const s of [-1, 1]) add(g, new THREE.CapsuleGeometry(0.028, 0.04, 4, 8), M.glow(PALETTE.cyan, 3), s * 0.08, 0.06, 0.29, noCast);
  add(g, new THREE.TorusGeometry(0.06, 0.014, 6, 16, Math.PI), M.glow(PALETTE.cyan, 3), 0, -0.04, 0.29, noCast).rotation.z = Math.PI;
  const ring = add(g, new THREE.TorusGeometry(0.46, 0.018, 8, 64), M.glow(PALETTE.invader, 3), 0, 0, 0, noCast);
  ring.rotation.x = Math.PI / 2.3;
  add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), M.clay(PALETTE.dark), 0, 0.38, 0);
  add(g, new THREE.SphereGeometry(0.04, 10, 8), M.glow(PALETTE.invader, 3), 0, 0.5, 0, noCast);
  for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.07, 12, 8), M.clay(PALETTE.invader), s * 0.31, 0.02, 0);
  return {
    group: g,
    animate(T: number, dt: number, baseY: number) {
      g.position.y = baseY + Math.sin(T * 2) * 0.08;
      ring.rotation.z += dt * 1.5;
      g.rotation.y = Math.sin(T * 0.7) * 0.4;
    },
  };
}
