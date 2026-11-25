import * as THREE from "three";
import { COLOR, hex } from "@/design/tokens";
import { add, outline, type Materials } from "@/engine/materials";
import { clamp, keyframes, type Rng } from "@/engine/util";

/** Mix two colours (token strings or hex numbers): how the film derives its palette from the tokens. */
export const mix = (a: string | number, b: string | number, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
/** No tint: the colour of a material that shows its texture as painted, and the far end of a highlight. */
export const PLAIN = new THREE.Color(1, 1, 1).getHex();
/** No light of its own: the base colour of a part that is only ever self-lit (Nova's eyes). */
const UNLIT = new THREE.Color(0, 0, 0).getHex();

let blob: THREE.DataTexture | null = null;
/**
 * A soft shadow to lay on the floor under anything that stands on it, so nothing floats where the
 * sun does not reach. `w` by `d` metres, lying flat; put it a few millimetres above the floor.
 */
export function contactShadow(w: number, d: number, strength = 0.4): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  if (!blob) {
    const n = 64, px = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2), a = Math.max(0, 1 - r);
      px.set([255, 255, 255, Math.round(255 * a * a * (3 - 2 * a))], (y * n + x) * 4);
    }
    blob = new THREE.DataTexture(px, n, n);
    blob.magFilter = blob.minFilter = THREE.LinearFilter;
    blob.needsUpdate = true;
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: hex(COLOR.void), map: blob, transparent: true, opacity: strength, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

/**
 * The cast of the film: one build system, matte bodies, and faces that act (eyes, brows, mouth).
 * Characters face +z with their feet at y = 0. Nothing here glows: eye highlights and Nova's eyes
 * stay well under every look's bloom threshold.
 */
export type Role = "kid" | "teacher" | "principal" | "captain";
export type Hair = "short" | "swept" | "bun" | "puffs" | "pigtails" | "curly" | "long" | "bob" | "bald";
type Extra = "glasses" | "tie" | "mustache" | "hood";
export interface Spec { role?: Role; skin: number; hair: number; hs: Hair; top: number; bot: number; shoe?: number; eyes?: number; ex?: Extra[] }
export type Expression = "neutral" | "happy" | "thinking" | "oops" | "cheer";
export const EXPRESSIONS: Expression[] = ["neutral", "happy", "thinking", "oops", "cheer"];

/**
 * One proportion system, in metres: L hip height (thigh and shin are half each), Ht torso, R torso
 * radius, H head radius, A arm length. A child is about 3.3 heads tall (1.29 m) and an adult about
 * 4.5 (1.70 to 1.88 m): big heads read as faces from across a classroom, a child who stands is
 * clearly taller than the same child sitting on a 0.32 m chair, and every adult reads as an adult.
 */
interface Build { L: number; Ht: number; R: number; H: number; A: number }
export const BUILD: Record<Role, Build> = {
  kid: { L: 0.54, Ht: 0.36, R: 0.14, H: 0.205, A: 0.4 },
  teacher: { L: 0.84, Ht: 0.5, R: 0.165, H: 0.19, A: 0.58 },
  principal: { L: 0.78, Ht: 0.52, R: 0.205, H: 0.19, A: 0.58 },
  captain: { L: 0.9, Ht: 0.58, R: 0.2, H: 0.19, A: 0.64 },
};
/** Limb thickness as a share of the torso radius: thigh, shin, upper arm, forearm, hand. Chunky for children. */
const LIMB = { kid: [0.44, 0.38, 0.31, 0.28, 0.37], adult: [0.42, 0.35, 0.29, 0.26, 0.32] } as const;

/**
 * Skin and hair are the colours of people, which the UI tokens have no roles for. They are still
 * mixed from the tokens, so the cast sits in the same light as everything else: `WARM` (ember and
 * gold, half each) is the root of every skin tone and of wood; a tone is that root taken toward the
 * pale ink or toward the shadow blue. Clothes take their colours from the tokens directly: gold for
 * the Star Fleet, sky and blue and ember and cream for the class, ink for the grown-ups.
 */
export const WARM = mix(COLOR.ember, COLOR.gold, 0.5);
const LIGHT = mix(WARM, COLOR.approach, 0.5), DEEP = mix(mix(WARM, COLOR.ember, 0.3), COLOR.shadow, 0.66);
const pale = (t: number) => mix(WARM, COLOR.approach, t), tan = (t: number) => mix(LIGHT, DEEP, t);
export const SKIN = [pale(0.62), tan(0.18), tan(0.5), tan(0.78), pale(0.72), tan(0.33)];
const HAIR = {
  black: mix(COLOR.void, COLOR.shadow, 0.75), espresso: mix(WARM, COLOR.void, 0.78), brown: mix(WARM, COLOR.shadow, 0.62), auburn: mix(COLOR.ember, COLOR.shadow, 0.5),
  blond: mix(COLOR.gold, COLOR.horizon, 0.28), grey: mix(COLOR.approach, COLOR.horizon, 0.5),
};
const CLOTH = {
  gold: mix(COLOR.gold, COLOR.horizon, 0.14), ember: mix(COLOR.ember, COLOR.approach, 0.22), sky: hex(COLOR.sky), blue: hex(COLOR.disk),
  cream: mix(COLOR.approach, COLOR.gold, 0.12), slate: mix(COLOR.horizon, COLOR.sky, 0.32), sage: mix(COLOR.sky, COLOR.gold, 0.5), brick: mix(COLOR.ember, COLOR.shadow, 0.42),
  navy: mix(COLOR.shadow, COLOR.disk, 0.3), ink: mix(COLOR.shadow, COLOR.horizon, 0.5), white: hex(COLOR.approach),
};
/** A cadet colour from sign-up as cloth: the token colour, taken a little toward the horizon so it sits matte in the room. */
export const cadetCloth = (c: string | number) => mix(c, COLOR.horizon, 0.14);
const DARK = mix(COLOR.void, COLOR.shadow, 0.6);

/**
 * The classmates, in seat order (the cadet's own seat and the empty desk in front of it are
 * skipped): the four the teacher names, the two who answer her questions, and one more.
 */
export const CLASSMATES: Spec[] = [
  { skin: 2, hair: HAIR.black, hs: "puffs", top: CLOTH.ember, bot: CLOTH.navy },
  { skin: 4, hair: HAIR.blond, hs: "short", top: CLOTH.sky, bot: CLOTH.navy },
  { skin: 3, hair: HAIR.black, hs: "curly", top: CLOTH.sage, bot: CLOTH.ink },
  { skin: 0, hair: HAIR.auburn, hs: "pigtails", top: CLOTH.slate, bot: CLOTH.ink },
  { skin: 5, hair: HAIR.black, hs: "swept", top: CLOTH.blue, bot: CLOTH.ink },
  { skin: 0, hair: HAIR.brown, hs: "bob", top: CLOTH.cream, bot: CLOTH.brick, ex: ["hood"] },
  { skin: 2, hair: HAIR.espresso, hs: "bun", top: CLOTH.brick, bot: CLOTH.navy },
];
/** The four classmates the teacher names, in the order she calls them, and the two who answer when the cadet does not. */
export const NAMED = [0, 1, 4, 5], ANSWERERS = [2, 3];
export const PLAYER: Spec = { skin: 1, hair: HAIR.espresso, hs: "swept", top: CLOTH.gold, bot: CLOTH.navy, ex: ["hood"] };
export const TEACHER: Spec = { role: "teacher", skin: 4, hair: HAIR.auburn, hs: "bun", top: mix(COLOR.gold, COLOR.ember, 0.3), bot: CLOTH.ink, ex: ["glasses"] };
export const PRINCIPAL: Spec = { role: "principal", skin: 2, hair: HAIR.grey, hs: "bald", top: CLOTH.slate, bot: CLOTH.ink, ex: ["glasses", "tie", "mustache"] };
export const CAPTAIN: Spec = { role: "captain", skin: 5, hair: HAIR.black, hs: "short", top: CLOTH.navy, bot: mix(COLOR.void, COLOR.shadow, 0.8) };

interface Face {
  eyes: THREE.Group[]; pupils: THREE.Mesh[]; arcs: THREE.Mesh[]; brows: THREE.Mesh[]; browY: number; set: number; er: number;
  line: THREE.Mesh; open: THREE.Mesh; grin: THREE.Mesh; mouthY: number; r: number;
  /** The pose the face is in now: it eases toward the expression's pose every frame. */
  now: Pose;
}
interface Pose { browL: number; browR: number; tilt: number; eye: number; arc: number; smile: number; open: number; wide: number; gx: number; gy: number }
const POSES: Record<Expression, Pose> = {
  neutral: { browL: 0, browR: 0, tilt: 0, eye: 1, arc: 0, smile: 0.35, open: 0, wide: 1, gx: 0, gy: 0 },
  // pushed about 40% past a natural read, so each face registers at the size a child is on screen
  happy: { browL: 0.5, browR: 0.5, tilt: 0.14, eye: 0.86, arc: 0, smile: 1, open: 0.12, wide: 1.5, gx: 0, gy: 0 },
  thinking: { browL: 1.05, browR: -0.4, tilt: -0.22, eye: 0.78, arc: 0, smile: -0.28, open: 0, wide: 0.5, gx: 0.8, gy: 0.7 },
  oops: { browL: 1, browR: 1, tilt: 1, eye: 1.28, arc: 0, smile: -0.85, open: 0.55, wide: 0.45, gx: 0, gy: -0.1 },
  cheer: { browL: 0.9, browR: 0.9, tilt: 0.15, eye: 1, arc: 1, smile: 1, open: 1, wide: 1.2, gx: 0, gy: 0 },
};

export interface Rig {
  body: THREE.Group; hips: THREE.Group[]; knees: THREE.Group[]; shoulders: THREE.Group[]; elbows: THREE.Group[];
  head: THREE.Group; torso: THREE.Group; prop: THREE.Object3D | null; face: Face;
  H: number; L: number; Ht: number; A: number; R: number; blink: number; ph: number;
  /** raise amount and target */ r: number; raise: boolean;
  /** Both arms up (0..1, follows the `cheer` expression). */
  cheer: number;
  /** The voice as the body hears it: a quick envelope for the mouth, a slow one for the hands. */
  v: number; va: number;
  /** How much the hands are in the conversation (0..1): eased, so a line never starts or ends with a snap. */
  ge: number;
  talking: boolean; look: THREE.Vector3 | null;
  /** Speak with no voice to follow (the cadet's own answer has no recording): the mouth keeps its own time. */
  mime: boolean;
  /** The face the character is making. */
  mood: Expression;
  /** Where this character sits: the seated hip height, the spot, and the chair and desk it belongs to. */
  seat: { x: number; hip: number; z: number; chair: THREE.Object3D | null; chairZ: number; desk: number; edge: number } | null;
  /** Progress of the sit-to-stand move (0 seated, 1 standing) and its target. */
  s: number; stand: number;
  walk: { pts: THREE.Vector3[]; t0: number; d: number; face?: THREE.Vector3 } | null;
  /** The soft shadow under the feet: it stays on the floor while the body sits, stands and walks. */
  shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** The raised arm's speed (it swings up on a spring, a touch past its mark, and settles). */
  rv: number;
  /** A small glance the eyes make on their own, and the seconds until the next one. */
  dart: { x: number; y: number; next: number; hold: number };
  /** The yaw the head was last asked for: a big change of look starts with a blink. */
  aim: number;
}
export interface Character { group: THREE.Group; rig: Rig; spec: Spec }

const V = (x: number, y: number) => new THREE.Vector2(x, y);
const cap = (r: number, len: number) => new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 16);
const ball = (r: number, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);

export function makeCharacter(spec: Spec, M: Materials, rnd: Rng): Character {
  const role = spec.role ?? "kid", kid = role === "kid";
  const { L, Ht, R, H, A } = BUILD[role], [kt, ks, ku, kf, kh] = LIMB[kid ? "kid" : "adult"];
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const matte = (c: number, roughness = 0.9) => M.clay(c, { roughness });
  const skinC = SKIN[spec.skin], skin = matte(skinC, 0.78), top = matte(spec.top), bot = matte(spec.bot), hair = matte(spec.hair, 0.95);
  const shoe = matte(spec.shoe ?? (kid ? CLOTH.white : DARK), 0.8), sole = matte(kid ? mix(COLOR.horizon, COLOR.sky, 0.25) : mix(COLOR.void, COLOR.horizon, 0.5), 0.9);
  const dark = matte(DARK, 0.7), gold = matte(hex(COLOR.gold), 0.6), nc = { cast: false };
  const skirt = role === "teacher";

  // legs: hip → thigh → knee → shin → shoe. The sole meets the floor at y = 0.
  const hips: THREE.Group[] = [], knees: THREE.Group[] = [], a = L / 2, rt = R * kt, rs = R * ks, legMat = skirt ? dark : bot;
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * R * 0.5, L, 0);
    body.add(hip);
    add(hip, cap(rt, a - rt), legMat, 0, -a / 2, 0);
    const knee = new THREE.Group();
    knee.position.y = -a;
    hip.add(knee);
    const sr = R * (kid ? 0.46 : 0.38);
    add(knee, cap(rs, a - rs - sr * 0.5), kid ? skin : legMat, 0, -a / 2 + sr * 0.2, 0);
    if (kid) add(knee, new THREE.CylinderGeometry(rt * 1.03, rt * 1.0, a * 0.2, 18), bot, 0, -a * 0.02, 0); // the hem of the shorts
    add(knee, ball(sr, 20, 12), shoe, 0, -a + sr * 0.6, sr * 0.36).scale.set(0.92, 0.6, 1.5);
    add(knee, ball(sr, 20, 8), sole, 0, -a + sr * 0.17, sr * 0.36).scale.set(0.96, 0.17, 1.56);
    hips.push(hip); knees.push(knee);
  }
  add(body, ball(R * 1.0, 28, 16), bot, 0, L + R * 0.02, 0).scale.set(1, 0.6, 0.8);
  if (skirt) add(body, new THREE.CylinderGeometry(R * 1.0, R * 1.22, L * 0.52, 32, 1), bot, 0, L * 0.76, 0).scale.set(1, 1, 0.82);

  // torso: a lathed shape with square shoulders, flattened front to back
  const torso = new THREE.Group();
  torso.position.y = L;
  body.add(torso);
  const belly = role === "principal" ? 1.16 : kid ? 1.04 : 1, chest = role === "captain" ? 1.18 : role === "principal" ? 1.06 : 1;
  const profile = (k: number) => [V(0, 0), V(R * 0.98 * k, 0), V(R * 1.02 * belly * k, Ht * 0.2), V(R * belly * k, Ht * 0.5), V(R * chest * k, Ht * 0.78), V(R * 0.96 * chest * k, Ht * 0.9), V(R * 0.7 * chest * k, Ht * 0.985), V(H * 0.3 * k, Ht * 1.03), V(0, Ht * 1.03)];
  const shirt = role === "teacher" ? matte(CLOTH.cream) : role === "principal" ? matte(CLOTH.white) : top;
  add(torso, new THREE.LatheGeometry(profile(1), 40), shirt).scale.set(1, 1, 0.8);
  const SH = R * chest * 0.98;
  if (role === "teacher" || role === "principal") {
    // an open cardigan or jacket over the shirt: the same shape, a little bigger, open down the front
    add(torso, new THREE.LatheGeometry(profile(1.07).map((p) => V(p.x, p.y * 0.985)), 40, Math.PI * 0.13, Math.PI * 1.74), top).scale.set(1, 1, 0.82);
  } else if (role === "captain") {
    // the Star Fleet uniform: a high collar, a gold belt and closure, epaulettes and a short cape
    add(torso, new THREE.CylinderGeometry(H * 0.4, H * 0.44, H * 0.3, 24), top, 0, Ht * 1.03, 0);
    add(torso, new THREE.CylinderGeometry(R * 1.04, R * 1.04, R * 0.2, 32), gold, 0, Ht * 0.17, 0).scale.set(1, 1, 0.81);
    add(torso, new THREE.BoxGeometry(R * 0.1, Ht * 0.6, 0.012), gold, R * 0.3, Ht * 0.56, R * chest * 0.74, nc).rotation.x = -0.04;
    for (const s of [-1, 1]) add(torso, new THREE.BoxGeometry(R * 0.72, R * 0.13, R * 0.66), gold, s * (SH - R * 0.1), Ht * 0.95, 0).rotation.z = s * -0.1;
    add(torso, new THREE.BoxGeometry(SH * 1.9, Ht * 1.1, R * 0.1), matte(hex(COLOR.disk)), 0, Ht * 0.42, -R * 0.9).rotation.x = 0.09;
  } else {
    // a tee with a darker neckband; the hoodie adds a thick collar, a pocket and two cord ends
    const band = matte(mix(spec.top, COLOR.void, 0.22));
    const hood = spec.ex?.includes("hood");
    add(torso, new THREE.TorusGeometry(H * 0.4, R * (hood ? 0.17 : 0.07), 10, 28), hood ? top : band, 0, Ht * (hood ? 0.99 : 1.0), 0).rotation.x = Math.PI / 2;
    if (hood) {
      add(torso, ball(R * 0.6, 20, 12), band, 0, Ht * 0.26, R * 0.64).scale.set(1.25, 0.62, 0.36);
      for (const s of [-1, 1]) add(torso, cap(R * 0.035, R * 0.3), matte(CLOTH.white), s * R * 0.2, Ht * 0.8, R * 0.83, nc);
    }
  }
  if (spec.ex?.includes("tie")) {
    const tie = matte(hex(COLOR.ember));
    add(torso, new THREE.BoxGeometry(R * 0.2, Ht * 0.5, 0.02), tie, 0, Ht * 0.62, R * 0.86 * belly).rotation.x = -0.1;
    add(torso, ball(R * 0.13, 12, 8), tie, 0, Ht * 0.9, R * 0.74).scale.set(1, 0.8, 0.7);
  }

  // arms: shoulder → upper arm → elbow → forearm → mitten hand, set into the corner of the shoulders
  const shoulders: THREE.Group[] = [], elbows: THREE.Group[] = [];
  let prop: THREE.Object3D | null = null;
  const up = A * 0.48, fore = A * 0.5, ru = R * ku, rf = R * kf;
  for (const s of [-1, 1]) {
    const shd = new THREE.Group();
    shd.position.set(s * SH, Ht * 0.88, 0);
    torso.add(shd);
    add(shd, ball(ru * 1.06, 16, 12), top);
    add(shd, cap(ru, up - ru), top, 0, -up / 2, 0);
    const el = new THREE.Group();
    el.position.y = -up;
    shd.add(el);
    const longSleeve = !kid || !!spec.ex?.includes("hood");
    add(el, cap(rf, fore - rf), longSleeve ? top : skin, 0, -fore / 2, 0);
    if (!longSleeve) add(shd, new THREE.CylinderGeometry(ru * 1.05, ru * 1.02, up * 0.3, 16), top, 0, -up * 0.82, 0); // the sleeve's hem
    else if (kid) add(el, new THREE.CylinderGeometry(rf * 1.1, rf * 1.1, fore * 0.14, 16), matte(mix(spec.top, COLOR.void, 0.22)), 0, -fore * 0.86, 0); // a ribbed cuff
    if (role === "captain") add(el, new THREE.CylinderGeometry(rf * 1.12, rf * 1.12, fore * 0.16, 16), gold, 0, -fore * 0.8, 0);
    const hr = R * kh, hd = new THREE.Group();
    hd.position.y = -fore;
    el.add(hd);
    add(hd, ball(hr, 18, 14), skin, 0, -hr * 0.5, 0).scale.set(0.92, 1.1, 0.74);
    add(hd, ball(hr * 0.42, 12, 8), skin, s * -hr * 0.6, -hr * 0.3, hr * 0.34);
    if (role === "teacher" && s === 1) {
      prop = add(hd, new THREE.CylinderGeometry(0.008, 0.005, 0.5, 8), matte(mix(COLOR.gold, HAIR.brown, 0.6)), 0, -0.1, 0.2);
      prop.rotation.x = Math.PI / 2.4;
    }
    shoulders.push(shd); elbows.push(el);
  }

  // neck and head (the head hangs off the torso, so a lean carries it)
  add(torso, new THREE.CylinderGeometry(H * 0.27, H * 0.31, H * 0.5, 20), skin, 0, Ht * 1.03, 0);
  const head = new THREE.Group();
  head.position.y = Ht + H * (kid ? 0.04 : 0.14);
  torso.add(head);
  const hy = H * 0.92, sx = kid ? 1.02 : 0.95, sy = kid ? 0.95 : 1.04, sz = kid ? 0.97 : 0.95;
  add(head, ball(H, 40, 28), skin, 0, hy, 0).scale.set(sx, sy, sz);
  if (role === "captain" || role === "principal") add(head, ball(H * 0.64, 24, 16), skin, 0, hy - H * 0.5, H * 0.14).scale.set(role === "captain" ? 1.14 : 1.05, 0.72, 0.92); // a jaw
  /** The front of the head at (x, y) from its centre, in head units. */
  const surf = (x: number, y: number) => sz * H * Math.sqrt(Math.max(0, 1 - (x / sx) ** 2 - (y / sy) ** 2));
  for (const s of [-1, 1]) add(head, ball(H * 0.2, 14, 10), skin, s * H * sx * 0.98, hy - H * 0.08, -H * 0.02).scale.set(0.4, 1, 0.7);

  // the face: big soft eyes, brows that move, a mouth that smiles, frowns and opens
  const er = H * (kid ? 0.2 : role === "captain" ? 0.135 : 0.15), ex = kid ? 0.4 : 0.36, ey = kid ? -0.08 : 0.04;
  /** The brows' resting slant: the Captain's are set, everyone else's are level. */
  const set = role === "captain" ? -0.3 : 0;
  const white = matte(mix(COLOR.approach, PLAIN, 0.5), 0.6), irisMat = matte(spec.eyes ?? mix(HAIR.espresso, COLOR.void, 0.45), 0.5), glint = new THREE.MeshBasicMaterial({ color: mix(COLOR.approach, COLOR.horizon, 0.08) });
  const eyes: THREE.Group[] = [], pupils: THREE.Mesh[] = [], arcs: THREE.Mesh[] = [], brows: THREE.Mesh[] = [];
  const lineMat = matte(mix(skinC, COLOR.void, 0.7), 0.9), browMat = matte(mix(spec.hair, COLOR.void, role === "principal" ? 0.5 : 0.2), 0.95);
  const browUp = kid ? 1.42 : role === "captain" ? 1.5 : 1.6, browY = hy + H * ey + er * browUp;
  for (const s of [-1, 1]) {
    const x = s * ex, z = surf(x, ey), eg = new THREE.Group();
    eg.position.set(x * H, hy + ey * H, z - er * 0.12);
    eg.rotation.y = s * 0.26;
    head.add(eg);
    add(eg, ball(er, 24, 16), white, 0, 0, 0, nc).scale.set(0.9, 1.1, 0.26);
    const pupil = add(eg, ball(er * 0.8, 22, 14), irisMat, 0, 0, er * 0.13, nc);
    pupil.scale.set(0.95, 1.1, 0.22);
    add(pupil, ball(er * 0.2, 10, 8), glint, er * 0.26, er * 0.3, er * 0.72, nc);
    // the closed, smiling eye: an arch that replaces the eyeball
    const arc = add(head, new THREE.TorusGeometry(er * 0.7, er * 0.14, 8, 18, Math.PI * 0.8), lineMat, x * H, hy + ey * H - er * 0.3, z + er * 0.1, nc);
    arc.rotation.set(0, s * 0.26, Math.PI * 0.1);
    arc.visible = false;
    const brow = add(head, cap(er * (kid ? 0.13 : role === "captain" ? 0.24 : 0.17), er * (kid ? 0.7 : role === "captain" ? 1.25 : 1.0)), browMat, x * H, browY, surf(x, ey + (er / H) * browUp) + er * 0.04, nc);
    brow.rotation.z = Math.PI / 2;
    eyes.push(eg); pupils.push(pupil); arcs.push(arc); brows.push(brow);
  }
  const noseY = kid ? -0.3 : -0.22;
  add(head, ball(H * (kid ? 0.07 : 0.1), 14, 10), matte(mix(skinC, COLOR.ember, 0.12), 0.78), 0, hy + H * noseY, surf(0, noseY) + H * 0.02, nc).scale.set(1, 0.85, 0.9);
  const my = kid ? -0.54 : -0.5, mouthY = hy + H * my, mr = H * 0.17, mz = surf(0, my);
  const line = add(head, new THREE.TorusGeometry(mr, H * 0.028, 8, 20, Math.PI * 0.62), lineMat, 0, mouthY, mz + H * 0.012, nc);
  line.rotation.z = -Math.PI / 2 - Math.PI * 0.31;
  // the open mouth: a round one for talking and surprise, and the lower half of one for an open smile
  const cavity = matte(mix(COLOR.ember, COLOR.void, 0.84), 0.9), tongue = matte(mix(COLOR.ember, COLOR.shadow, 0.5), 0.9);
  const openM = add(head, ball(H * 0.15, 20, 12), cavity, 0, mouthY, mz - H * 0.025, nc);
  const grin = add(head, new THREE.SphereGeometry(H * 0.2, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), cavity, 0, mouthY, mz - H * 0.03, nc);
  add(grin, ball(H * 0.11, 14, 8), tongue, 0, -H * 0.14, H * 0.03, nc).scale.set(1.1, 0.5, 0.6);
  openM.visible = grin.visible = false;
  const face: Face = { eyes, pupils, arcs, brows, browY, set, er, line, open: openM, grin, mouthY, r: mr, now: { ...POSES.neutral } };

  // hair: a cap over the crown and a few chunky locks with a clear outline. Never beads.
  const hs = spec.hs, hr = H * 1.045;
  /** A cap over the crown: its front edge is the hairline. */
  const crown = (tilt: number, reach = 0.5) => { const m = add(head, new THREE.SphereGeometry(hr, 36, 18, 0, Math.PI * 2, 0, Math.PI * reach), hair, 0, hy, 0); m.rotation.x = tilt; m.scale.set(sx, sy, sz); return m; };
  /** A rounded lock, in head units: where, how big on each axis, and its lean. */
  const lock = (x: number, y: number, z: number, s: [number, number, number], rz = 0, rx = 0) => { const m = add(head, ball(H, 18, 12), hair, x * H, hy + y * H, z * H); m.scale.set(...s); m.rotation.set(rx, 0, rz); return m; };
  if (role === "captain") {
    // short hair at the sides and back, under a peaked cap with a gold band and a plain gold badge
    for (const s of [-1, 1]) lock(s * 0.88, 0.06, -0.3, [0.14, 0.44, 0.5]);
    lock(0, 0.0, -0.76, [0.8, 0.5, 0.26]);
    add(head, new THREE.CylinderGeometry(H * 1.16, H * 1.02, H * 0.4, 36), top, 0, hy + H * 0.84, -H * 0.04);
    add(head, new THREE.CylinderGeometry(H * 1.035, H * 1.03, H * 0.15, 36), gold, 0, hy + H * 0.6, -H * 0.04);
    const peak = add(head, new THREE.CylinderGeometry(H * 0.9, H * 0.9, H * 0.045, 28, 1, false, -Math.PI / 2, Math.PI), dark, 0, hy + H * 0.56, H * 0.3);
    peak.rotation.x = 0.2;
    add(head, new THREE.CylinderGeometry(H * 0.13, H * 0.13, H * 0.04, 5), gold, 0, hy + H * 0.86, H * 1.07, nc).rotation.x = Math.PI / 2;
  } else if (hs === "short") {
    crown(-0.6, 0.56);
    for (const [x, len] of [[-0.4, 0.24], [0, 0.3], [0.4, 0.24]] as const) lock(x, 0.72 - len * 0.2, surf(x, 0.62) / H + 0.02, [0.3, len, 0.17], x * 0.35, -0.3); // short straight bangs
  } else if (hs === "swept") {
    crown(-0.6, 0.56);
    // a fringe combed across the forehead in four locks, and a tuft that will not lie flat
    for (const [x, y, rz] of [[0.52, 0.62, 0.9], [0.24, 0.72, 0.7], [-0.08, 0.76, 0.55], [-0.4, 0.7, 0.35]] as const) lock(x, y, surf(x, y - 0.08) / H + 0.04, [0.36, 0.18, 0.2], rz, -0.2);
    lock(-0.2, 1.02, -0.2, [0.16, 0.26, 0.16], 0.5, -0.4);
  } else if (hs === "bun") {
    crown(-0.56, 0.56);
    lock(0, 1.04, -0.38, [0.4, 0.38, 0.4]);
    for (const [x, rz] of [[-0.42, 0.75], [0.36, -0.6]] as const) lock(x, 0.7, surf(x, 0.6) / H + 0.03, [0.48, 0.2, 0.22], rz, -0.25); // parted to one side
  } else if (hs === "puffs") {
    crown(-0.56, 0.56);
    for (const s of [-1, 1]) lock(s * 0.8, 0.82, -0.14, [0.5, 0.5, 0.5]);
    for (const x of [-0.4, 0, 0.4]) lock(x, 0.76, surf(x, 0.66) / H + 0.02, [0.24, 0.17, 0.16]);
  } else if (hs === "pigtails") {
    crown(-0.56, 0.56);
    for (const s of [-1, 1]) {
      lock(s * 1.1, -0.42, -0.2, [0.22, 0.46, 0.22], s * 0.22);
      add(head, new THREE.TorusGeometry(H * 0.2, H * 0.05, 8, 16), gold, s * H * 1.0, hy - H * 0.02, -H * 0.2).rotation.set(Math.PI / 2, 0, s * 0.25);
    }
    lock(0, 0.72, 0.56, [0.78, 0.2, 0.34]); // a straight fringe
  } else if (hs === "curly") {
    // one big soft shape with a scalloped edge: an afro by its outline
    lock(0, 0.3, -0.26, [1.24, 1.16, 1.2]);
    for (const [x, y, z] of [[-0.62, 0.74, 0.5], [-0.2, 0.9, 0.62], [0.24, 0.9, 0.6], [0.64, 0.72, 0.5], [-1.0, 0.3, 0.2], [1.0, 0.3, 0.2]] as const) lock(x, y, z, [0.36, 0.36, 0.36]);
  } else if (hs === "long") {
    crown(-0.54, 0.56);
    lock(0, -0.5, -0.4, [0.9, 1.0, 0.5]);
    for (const s of [-1, 1]) lock(s * 0.93, -0.42, 0.1, [0.2, 0.72, 0.24], s * -0.06);
    lock(0.1, 0.72, 0.54, [0.76, 0.2, 0.34], 0.12);
  } else if (hs === "bob") {
    lock(0, 0.04, -0.24, [1.17, 1.19, 1.12]);
    lock(-0.06, 0.72, 0.52, [0.8, 0.22, 0.38], -0.08);
  } else if (hs === "bald") {
    // grey at the sides and the back only
    for (const s of [-1, 1]) lock(s * 0.88, 0.0, -0.3, [0.15, 0.36, 0.5]);
    lock(0, -0.06, -0.76, [0.8, 0.38, 0.26]);
  }
  if (spec.ex?.includes("glasses")) {
    const rim = matte(DARK, 0.6);
    for (const s of [-1, 1]) {
      const x = s * ex;
      add(head, new THREE.TorusGeometry(er * 1.22, H * 0.022, 8, 28), rim, x * H, hy + ey * H, surf(x, ey) + er * 0.36, nc).rotation.y = s * 0.26;
      add(head, new THREE.BoxGeometry(H * 0.02, H * 0.02, H * 0.72), rim, s * H * 0.74, hy + ey * H + er * 0.3, H * 0.36, nc).rotation.y = s * 0.34;
    }
    add(head, new THREE.BoxGeometry(H * (ex * 2) - er * 2.2, H * 0.024, H * 0.024), rim, 0, hy + ey * H + er * 0.2, surf(0, ey) + er * 0.36, nc);
  }
  if (spec.ex?.includes("mustache")) for (const s of [-1, 1]) lock(s * 0.13, -0.37, surf(0.13, -0.37) / H + 0.03, [0.2, 0.085, 0.09], s * -0.32);

  const rig: Rig = {
    body, hips, knees, shoulders, elbows, head, torso, prop, face, H, L, Ht, A, R, blink: 1 + rnd() * 3, ph: rnd() * 6,
    r: 0, raise: false, cheer: 0, v: 0, va: 0, ge: 0, talking: false, mime: false, look: null, mood: "neutral", seat: null, s: 0, stand: 0, walk: null,
    shadow: contactShadow(R * 5.2, R * 4.4, 0.36), rv: 0, dart: { x: 0, y: 0, next: 0.6 + rnd() * 2.5, hold: 0 }, aim: 0,
  };
  rig.shadow.position.y = 0.006;
  g.add(rig.shadow);
  return { group: g, rig, spec };
}

/**
 * Sits a character down on a seat whose top is `seatHeight`, at (x, z). Pass the chair (so it can be
 * pushed back when the character stands), the height of the desk in front and how far ahead its near
 * edge is (the hands rest on that edge).
 */
export function seat(c: Character, x: number, seatHeight: number, z: number, o: { chair?: THREE.Object3D; desk?: number; edge?: number } = {}) {
  const u = c.rig, hip = seatHeight + u.R * (c.spec.role && c.spec.role !== "kid" ? LIMB.adult[0] : LIMB.kid[0]) + 0.004; // the thigh rests on the seat, not in it
  u.seat = { x, hip, z, chair: o.chair ?? null, chairZ: o.chair?.position.z ?? 0, desk: o.desk ?? seatHeight + 0.26, edge: o.edge ?? 0.225 };
  u.s = u.stand = 0;
  c.group.position.set(x, hip - u.L, z);
}

/**
 * Give one character their own top colour (the cadet's hoodie takes the colour picked at sign-up).
 * The first call gives the character private copies of the materials that carry it, so nobody else
 * in the room changes with them; the darker neckband and cuffs follow.
 */
export function recolour(c: Character, top: number) {
  const from = c.spec.top, band = mix(from, COLOR.void, 0.22), own = (c.group.userData.own ??= new Map<THREE.Material, { m: THREE.MeshStandardMaterial; band: boolean }>()) as Map<THREE.Material, { m: THREE.MeshStandardMaterial; band: boolean }>;
  if (!own.size) c.group.traverse((o) => {
    const mesh = o as THREE.Mesh, mat = mesh.material as THREE.MeshStandardMaterial;
    if (!mesh.isMesh || !mat?.color || mat.map) return;
    const hexNow = mat.color.getHex(), isTop = hexNow === from, isBand = hexNow === band;
    if (!isTop && !isBand) return;
    if (!own.has(mat)) own.set(mat, { m: mat.clone(), band: isBand });
    mesh.material = own.get(mat)!.m;
  });
  for (const { m, band: b } of own.values()) m.color.setHex(b ? mix(top, COLOR.void, 0.22) : top);
}

export const headPosition = (c: Character) => c.rig.head.localToWorld(new THREE.Vector3(0, c.rig.H * 0.95, 0));
/** The eye point, for first-person shots. */
export const eyePosition = (c: Character) => c.rig.head.localToWorld(new THREE.Vector3(0, c.rig.H * 0.9, c.rig.H * 0.9));
export const face = (g: THREE.Object3D, t: THREE.Vector3) => (g.rotation.y = Math.atan2(t.x - g.position.x, t.z - g.position.z));
/** Put a face on. With `snap` it is there at once; otherwise the next frames ease into it. */
export function setExpression(c: Character, e: Expression, snap = false) {
  c.rig.mood = e;
  if (snap) { c.rig.face.now = { ...POSES[e] }; c.rig.cheer = e === "cheer" ? 1 : 0; }
}

/** How long the sit-to-stand move takes, in seconds. */
export const STAND_TIME = 1.5; // the push itself takes about 0.8 s of this: a child rising, not springing
const smooth = (k: number) => { k = clamp(k); return k * k * (3 - 2 * k); };

/**
 * The sit-to-stand move as an animator would block it, in the character's own side view (z forward
 * toward the desk, y up; the hand is measured from the hip), as a function of its progress s:
 * anticipation (the hands leave the desk edge, the body leans in, the chair starts back), the push
 * up through planted feet with a small overshoot, and the settle. Legs and arms are placed by IK
 * from these curves, so feet come down, plant and stay planted, and nothing passes through the
 * chair or the desk.
 */
export function standPose(s: number, d: { L: number; Ht: number; A: number }, st: { hip: number; desk: number; edge: number }) {
  const a = d.L / 2, shY = d.Ht * 0.88, arm = d.A * 0.98;
  const K = (keys: [number, number][]) => keyframes(keys)(s);
  const lean = K([[0, 0], [0.08, 0], [0.32, 0.34], [0.46, 0.3], [0.82, -0.03], [1, 0]]);
  const hip = K([[0, st.hip], [0.2, st.hip], [0.74, d.L + 0.008], [1, d.L]]);
  const fwd = K([[0, 0], [0.3, 0.01], [0.62, 0.035], [1, 0.02]]); // a small shift over the feet; never into the desk
  // the hand: off the desk edge and back first, then down to hang under the shoulder
  const kk = K([[0, 0], [0.02, 0], [0.36, 1], [1, 1]]);
  const restZ = st.edge + 0.03 - fwd, restY = st.desk + 0.076 - hip;
  const hangZ = Math.sin(lean) * shY + 0.02, hangY = Math.cos(lean) * shY - arm * 0.985;
  return {
    /** Torso pitch, radians forward. */
    lean,
    /** Hip height above the floor, and how far the hips have moved toward the desk. */
    hip, fwd,
    /** How far the chair has been pushed back. */
    chair: K([[0, 0], [0.14, 0], [0.56, 0.3], [1, 0.3]]),
    /** The sole of the foot: forward of the seated hip, and above the floor. */
    footZ: K([[0, a], [0.22, a], [0.56, 0.05], [1, 0.05]]),
    footY: K([[0, st.hip - a], [0.22, st.hip - a], [0.52, 0], [1, 0]]),
    /** The wrist, forward of and above the hip. */
    handZ: restZ + (hangZ - restZ) * smooth(kk),
    handY: restY + (hangY - restY) * smooth((kk - 0.1) / 0.9) + 0.04 * Math.sin(Math.PI * clamp(kk / 0.5)),
    /** The arms swing out a little as the body comes up, which also carries the hands wide of the seat. */
    splay: 0.22 * Math.sin(Math.PI * clamp(s / 0.75)),
    /** 1 while the hands are on the desk, 0 once the arms hang. */
    sit: 1 - kk,
  };
}

/** Two-bone IK in the side view: the angle of the first bone from straight down (forward positive) and the bend of the joint. */
export function ik(a: number, b: number, dz: number, dy: number, bendForward: boolean) {
  const d = clamp(Math.hypot(dz, dy), Math.abs(a - b) + 1e-4, a + b - 1e-4);
  const toEnd = Math.atan2(dz, -dy), off = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  return { first: toEnd + (bendForward ? off : -off), bend: Math.PI - Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1)) };
}

/** Per-frame life: breathing, blinking, a face that acts, a voice-driven mouth, looking, raising a hand, sitting, standing, walking. */
export function animateCharacter(c: Character, T: number, dt: number, rnd: Rng, level = 0) {
  const u = c.rig, g = c.group, f = u.face, k = (rate: number) => Math.min(1, dt * rate);
  // the raw loudness of a voice jumps from frame to frame: the mouth follows a quick envelope of it
  // and the hands a slow one, so neither ever jitters
  u.v += (level - u.v) * k(level > u.v ? 22 : 10);
  u.va += (level - u.va) * k(3.5);
  const voice = u.v;
  // breath: the chest rises and the shoulders ride up with it, slower when sitting still, quicker after a cheer
  const breath = Math.sin(T * (2.0 + u.cheer * 1.6) + u.ph);
  u.torso.scale.set(1 + breath * 0.006, 1 + breath * 0.014, 1 + breath * 0.012);

  // sitting ↔ standing: a timed move, not a blend, so it has anticipation and a settle
  const st = u.seat, up = u.A * 0.48, fore = u.A * 0.5, shY = u.Ht * 0.88;
  let lean = 0, sit = 0, splay = 0, hz = 0.02, hy = shY - (up + fore) * 0.985;
  if (st) {
    u.s = clamp(u.s + Math.sign(u.stand - u.s) * Math.min(Math.abs(u.stand - u.s), dt / STAND_TIME));
    const p = standPose(u.s, u, st), fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y);
    lean = p.lean; sit = p.sit; splay = p.splay; hz = p.handZ; hy = p.handY;
    g.position.set(st.x + fx * p.fwd, p.hip - u.L, st.z + fz * p.fwd);
    if (st.chair) st.chair.position.z = st.chairZ - fz * p.chair;
    if (!u.walk) {
      const leg = ik(u.L / 2, u.L / 2, p.footZ - p.fwd, p.footY - p.hip, true);
      u.hips.forEach((h) => (h.rotation.x = -leg.first));
      u.knees.forEach((n) => (n.rotation.x = leg.bend));
    }
  } else if (!u.walk) {
    u.hips.forEach((h) => (h.rotation.x = 0));
    u.knees.forEach((n) => (n.rotation.x = 0));
  }
  u.torso.rotation.x = lean;

  // the head turns to its target as far as a neck goes; the eyes finish the look
  let yaw = 0, pitch = 0, gx = 0, gy = 0;
  if (u.look) {
    const w = headPosition(c), d = Math.atan2(u.look.x - w.x, u.look.z - w.z) - g.rotation.y, want = Math.atan2(Math.sin(d), Math.cos(d));
    yaw = clamp(want, -1.15, 1.15);
    pitch = clamp(Math.atan2(w.y - u.look.y, Math.hypot(u.look.x - w.x, u.look.z - w.z)), -0.45, 0.45);
    gx = clamp((want - yaw) * 1.4 + (yaw - u.head.rotation.y) * 0.8, -1, 1);
    gy = clamp(-pitch * 0.8, -0.6, 0.6);
  }
  // a big change of look starts with a blink, the way a real turn of the head does
  if (Math.abs(yaw - u.aim) > 0.5 && u.blink > 0.12) u.blink = -0.001;
  u.aim = yaw;
  // and now and then the eyes make a small glance of their own, then come back
  const dr = u.dart;
  dr.next -= dt;
  if (dr.next < 0) { dr.x = (rnd() - 0.5) * 0.9; dr.y = (rnd() - 0.5) * 0.5; dr.hold = 0.22 + rnd() * 0.3; dr.next = 1.6 + rnd() * 3.6; }
  if ((dr.hold -= dt) < 0) dr.x = dr.y = 0;
  if (!u.talking) { gx = clamp(gx + dr.x, -1, 1); gy = clamp(gy + dr.y, -1, 1); }
  u.head.rotation.y += (yaw - u.head.rotation.y) * k(5);
  u.head.rotation.x += (pitch * 0.6 - lean * 0.85 + (u.talking ? Math.sin(T * 5.5) * 0.035 : 0) - u.head.rotation.x) * k(8);
  u.head.rotation.z = Math.sin(T * 1.3 + u.ph) * 0.03 + (u.mood === "thinking" ? 0.12 : 0);

  // the face eases toward its expression; talking opens the mouth on top of it
  const to = POSES[u.mood], n = f.now, e = k(9);
  for (const key of Object.keys(n) as (keyof Pose)[]) n[key] += (to[key] - n[key]) * e;
  u.blink -= dt;
  const blinking = u.blink < 0;
  if (u.blink < -0.11) u.blink = 2.2 + rnd() * 3.4;
  const closed = n.arc > 0.5;
  f.eyes.forEach((eg, i) => {
    eg.visible = !closed;
    eg.scale.y = blinking ? 0.08 : n.eye;
    const wide = Math.max(0, n.eye - 1) * 2.2; // surprise: the white shows all round a smaller iris
    f.pupils[i].scale.set(0.95 * (1 - wide * 0.5), 1.1 * (1 - wide * 0.5), 0.22);
    f.arcs[i].visible = closed;
    f.pupils[i].position.x = clamp(gx + n.gx, -1, 1) * f.er * 0.26;
    f.pupils[i].position.y = clamp(gy + n.gy, -1, 1) * f.er * 0.24;
  });
  f.brows.forEach((b, i) => {
    const side = i === 0 ? -1 : 1, lift = i === 0 ? n.browL : n.browR;
    b.position.y = f.browY + lift * f.er * 0.42 - (blinking ? f.er * 0.06 : 0);
    b.rotation.z = Math.PI / 2 - side * ((n.tilt + f.set) * 0.42 + 0.06);
  });
  // a voice opens the mouth as loud as it is, and lets it close in the pauses
  const speak = u.talking ? (u.mime ? 0.16 + Math.abs(Math.sin(T * 11 + u.ph)) * 0.45 : 0.09 + voice * 0.95) : 0;
  const open = Math.max(n.open, speak), showOpen = open > 0.07, grinning = showOpen && n.smile > 0.5 && n.open > 0.07;
  f.open.visible = showOpen && !grinning;
  f.grin.visible = grinning;
  f.line.visible = !showOpen;
  f.open.scale.set(n.wide * 0.9, 0.2 + open * 0.95, 0.4);
  f.open.position.y = f.mouthY - open * u.H * 0.07;
  f.grin.scale.set(n.wide * 0.9, 0.35 + open * 0.75, 0.45);
  f.grin.position.y = f.mouthY + u.H * 0.06;
  f.line.scale.set(n.wide, Math.abs(n.smile) < 0.06 ? 0.06 : n.smile, 1);
  f.line.position.y = f.mouthY + f.r * n.smile;

  // arms: hands on the desk edge when seated, hanging when standing, the right arm up when raising a hand
  // the hand goes up on a spring: quick away, a touch past its mark, then it settles
  const hs = Math.min(dt, 1 / 30);
  u.rv += (((u.raise ? 1 : 0) - u.r) * 110 - u.rv * 13.5) * hs;
  u.r = clamp(u.r + u.rv * hs, 0, 1.08);
  u.cheer += ((u.mood === "cheer" ? 1 : 0) - u.cheer) * k(6);
  // standing speakers talk with their hands: forearms lift and sway with the voice
  u.ge += ((u.talking && sit < 0.5 && !u.walk ? 1 : 0) - u.ge) * k(4);
  const gest = u.ge;
  // into the torso's own frame (it leans), then solve the arm
  const ty = hy * Math.cos(lean) + hz * Math.sin(lean), tz = -hy * Math.sin(lean) + hz * Math.cos(lean);
  const arm = ik(up, fore, tz, ty - shY, false);
  u.shoulders.forEach((sh, i) => {
    const side = i === 0 ? -1 : 1, lift = Math.max(side === 1 ? u.r : 0, u.cheer), dip = side === 1 && u.raise ? Math.max(0, 0.18 - u.r) : 0; // the shoulder drops a hair before the arm goes up
    const g1 = gest * (0.3 + 0.16 * Math.sin(T * 2.6 + i * 1.7 + u.ph) + u.va * 0.4);
    const top = u.cheer > 0.02 ? Math.PI * 0.88 : Math.PI * 0.9; // a cheer is a tall V: hands above the head, not across the faces behind
    sh.rotation.x = (-arm.first - g1 * 0.35) * (1 - lift);
    sh.rotation.z = side * (0.14 + splay - dip * 0.5 + (top - 0.14 - splay) * lift) + (lift ? Math.sin(T * 9 + i) * 0.05 * Math.min(1, lift) : 0);
    u.elbows[i].rotation.x = (-arm.bend - g1) * (1 - lift) - 0.22 * lift;
  });

  if (u.walk) {
    const w = u.walk, kk = clamp((T - w.t0) / w.d), seg = smooth(kk) * (w.pts.length - 1), i = Math.min(w.pts.length - 2, Math.floor(seg));
    g.position.lerpVectors(w.pts[i], w.pts[i + 1], seg - i);
    // strides match the ground covered: the gait slows as the walk eases in and out, and stops with the body
    const pace = Math.sin(Math.PI * clamp(kk)), sw = Math.sin(T * 7.2 + u.ph) * pace;
    g.position.y = Math.abs(sw) * 0.025;
    // the body turns along the path, and over the last steps turns to face where it will stand
    const along = Math.atan2(w.pts[i + 1].x - g.position.x, w.pts[i + 1].z - g.position.z);
    const end = w.face ? Math.atan2(w.face.x - w.pts[w.pts.length - 1].x, w.face.z - w.pts[w.pts.length - 1].z) : along;
    const want = kk > 0.999 ? end : along + Math.atan2(Math.sin(end - along), Math.cos(end - along)) * smooth((kk - 0.6) / 0.4);
    g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * k(9);
    u.hips[0].rotation.x = sw * 0.42; u.hips[1].rotation.x = -sw * 0.42;
    u.knees[0].rotation.x = Math.max(0, -sw) * 0.6; u.knees[1].rotation.x = Math.max(0, sw) * 0.6;
    u.shoulders[0].rotation.x -= sw * 0.32; u.shoulders[1].rotation.x += sw * 0.32; // the swing rides on the hanging pose
    if (kk >= 1 && Math.abs(Math.atan2(Math.sin(end - g.rotation.y), Math.cos(end - g.rotation.y))) < 0.01) { g.rotation.y = end; u.walk = null; }
  }
  // the shadow lies on the floor whatever the body is doing, a little ahead of a seated child (under the knees)
  u.shadow.position.set(0, 0.006 - g.position.y, st ? 0.12 * (1 - u.s) : 0);
}

/**
 * Nova, the co-pilot: a small matte drone with a dark visor and two soft eyes, circled by a hairline
 * ring that carries one gold bead. She does not glow: her eyes are lit just enough to read in the
 * dark, and they pulse a little as she speaks, far under the bloom threshold. The `glow` option is
 * kept so earlier callers compile; it does nothing.
 */
export function makeNova(M: Materials, opts: { glow?: boolean } = {}) {
  void opts;
  const g = new THREE.Group(), nc = { cast: false };
  const shell = M.clay(hex(COLOR.approach), { roughness: 0.85 }), sky = M.clay(hex(COLOR.sky), { roughness: 0.8 }), visorMat = M.clay(mix(COLOR.void, COLOR.shadow, 0.5), { roughness: 0.55 });
  const body = add(g, new THREE.SphereGeometry(0.32, 40, 28), shell);
  body.scale.set(1, 0.94, 1);
  outline(body, M); // the ink line every small hero carries
  // a seam and a soft blue underside, so she reads as built, not as a ball
  add(g, new THREE.TorusGeometry(0.317, 0.006, 6, 64), M.clay(mix(COLOR.approach, COLOR.horizon, 0.45), { roughness: 0.8 }), 0, -0.07, 0, nc).rotation.x = Math.PI / 2;
  add(g, new THREE.SphereGeometry(0.3, 32, 12, 0, Math.PI * 2, Math.PI * 0.72, Math.PI * 0.28), sky, 0, -0.012, 0, nc);
  // the visor: a dark window set into the front
  const visor = add(g, new THREE.SphereGeometry(0.25, 36, 22), visorMat, 0, 0.03, 0.13, nc);
  visor.scale.set(1.08, 0.68, 0.86);
  // eyes: soft upright lozenges, self-lit below any bloom threshold
  const eyeMat = new THREE.MeshStandardMaterial({ color: UNLIT, emissive: hex(COLOR.sky), emissiveIntensity: 0.85, roughness: 1 });
  const eyes: THREE.Mesh[] = [], arcs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const e = add(g, new THREE.CapsuleGeometry(0.03, 0.05, 6, 14), eyeMat, s * 0.09, 0.045, 0.332, nc);
    e.rotation.y = s * 0.3;
    const arc = add(g, new THREE.TorusGeometry(0.036, 0.011, 8, 16, Math.PI * 0.86), eyeMat, s * 0.09, 0.022, 0.334, nc);
    arc.rotation.set(0, s * 0.3, Math.PI * 0.07);
    arc.visible = false;
    eyes.push(e); arcs.push(arc);
  }
  // ear pods and the ring with its bead: the game's own mark, in orbit around her
  for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.07, 18, 12), sky, s * 0.31, 0.0, 0).scale.set(0.55, 1, 1);
  const orbit = new THREE.Group();
  orbit.rotation.set(Math.PI / 2.35, 0, 0.18);
  g.add(orbit);
  add(orbit, new THREE.TorusGeometry(0.47, 0.007, 6, 96), sky, 0, 0, 0, nc);
  add(orbit, new THREE.SphereGeometry(0.034, 14, 10), M.clay(hex(COLOR.gold), { roughness: 0.6 }), 0.47, 0, 0, nc);

  let mood: Expression = "neutral", blink = 2, lid = 1, happy = 0, tilt = 0, look = 0;
  return {
    group: g,
    /** The face she is making; the film and the review page set it. */
    express(e: Expression) { mood = e; },
    animate(T: number, dt: number, baseY: number, voice = 0) {
      const k = Math.min(1, dt * 9);
      g.position.y = baseY + Math.sin(T * 2) * 0.08 + (mood === "cheer" ? Math.abs(Math.sin(T * 6)) * 0.07 : 0);
      orbit.rotation.z += dt * (0.9 + voice * 2.2);
      g.rotation.y = Math.sin(T * 0.7) * 0.35;
      tilt += ((mood === "thinking" ? 0.22 : mood === "oops" ? -0.14 : 0) - tilt) * k;
      g.rotation.z = tilt + Math.sin(T * 1.1) * 0.03;
      blink -= dt;
      const blinking = blink < 0;
      if (blink < -0.1) blink = 2.4 + ((T * 7.3) % 3);
      happy += ((mood === "happy" || mood === "cheer" ? 1 : 0) - happy) * k;
      lid += ((blinking ? 0.1 : mood === "oops" ? 0.55 : mood === "thinking" ? 0.8 : 1) - lid) * Math.min(1, dt * 24);
      look += ((mood === "thinking" ? 1 : 0) - look) * k;
      const arcsOn = happy > 0.5;
      eyes.forEach((e, i) => {
        const s = i === 0 ? -1 : 1;
        e.visible = !arcsOn; arcs[i].visible = arcsOn;
        e.scale.set(mood === "oops" ? 1.25 : 1, lid * (mood === "thinking" && s === 1 ? 0.7 : 1), 1);
        e.position.set(s * 0.09 + look * 0.03, 0.045 + look * 0.03, 0.332);
      });
      // the only light she makes: a small pulse in her eyes as she speaks
      eyeMat.emissiveIntensity = 0.85 + Math.min(1, voice) * 0.25;
    },
  };
}
export type Nova = ReturnType<typeof makeNova>;
