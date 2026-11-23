import * as THREE from "three";
import { add, canvasTexture, type Materials } from "@/engine/materials";
import { seeded, type Rng } from "@/engine/util";

/**
 * Small planets for the Title fly-through and the Solar System map: one clay sphere with a painted
 * band map each, plus Saturn's and Uranus's rings, the Asteroid Belt's rocks and Deep Space's nebula.
 */
export type BodyId = "sun" | "mercury" | "venus" | "earth" | "moon" | "mars" | "asteroid-belt" | "jupiter" | "saturn" | "uranus" | "deep-space";
interface Look { bands: string[]; blotch?: string; land?: string; ring?: [string, number, number]; tilt?: number }
const LOOKS: Record<Exclude<BodyId, "sun" | "asteroid-belt">, Look> = {
  mercury: { bands: ["#b8aea4", "#a49a90", "#c4bab0"], blotch: "#857b72" },
  venus: { bands: ["#f1d39a", "#e8c07c", "#f6dfb0", "#deb06a"] },
  earth: { bands: ["#3f7fc4", "#2c69b0", "#3f7fc4"], land: "#6fb86c" },
  moon: { bands: ["#cfc9d6", "#bdb6c6", "#d8d2de"], blotch: "#a49dae" },
  mars: { bands: ["#d0714a", "#c4643e", "#d98a5e"], blotch: "#9c4a2e" },
  jupiter: { bands: ["#e8c9a0", "#c98d5a", "#f1dcc0", "#b9774a", "#e6c29a", "#d4a070"], tilt: 0.12 },
  saturn: { bands: ["#efdcb2", "#e2c58e", "#f4e6c4", "#d8b77c"], ring: ["#f3e2bf", 1.3, 2.1], tilt: 0.35 },
  uranus: { bands: ["#a8ecef", "#9be2e8", "#b6f1f2"], ring: ["#d6f6f8", 1.35, 1.5], tilt: 1.2 },
  "deep-space": { bands: ["#3b4fd6", "#2f3fb8", "#4a62e8", "#2a3596"], tilt: 0.3 },
};

function paint(rnd: Rng, look: Look) {
  const { texture, ctx } = canvasTexture(256, 128);
  const h = 128 / look.bands.length;
  look.bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * h, 256, h + 1); });
  for (let y = 0; y < 128; y += 2) { ctx.fillStyle = `rgba(255,255,255,${(Math.sin(y * 0.33) * 0.5 + 0.5) * 0.06})`; ctx.fillRect(0, y, 256, 1); }
  for (const [col, n, r] of [[look.blotch, 50, 7], [look.land, 26, 16]] as const) {
    if (!col) continue;
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) { ctx.globalAlpha = 0.35 + rnd() * 0.45; ctx.beginPath(); ctx.ellipse(rnd() * 256, 16 + rnd() * 96, 2 + rnd() * r, 2 + rnd() * r * 0.6, rnd() * 3, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  if (look.land) { ctx.fillStyle = "#f4f8fb"; ctx.fillRect(0, 0, 256, 6); ctx.fillRect(0, 122, 256, 6); }
  texture.needsUpdate = true;
  return texture;
}

export interface Body {
  group: THREE.Group;
  /** The sphere(s) that spin, and the materials a map can darken into a silhouette. */
  spin: THREE.Object3D;
  mats: THREE.MeshStandardMaterial[];
  radius: number;
}

/** A planet of radius `r` at the origin of its group. `glow`: self-light from its map (under the bloom threshold). */
export function makeBody(M: Materials, id: BodyId, r: number, { glow = 0.3, seed = 3 } = {}): Body {
  const rnd = seeded(seed + id.length * 7), group = new THREE.Group(), off = { cast: false, recv: false };
  if (id === "sun") {
    const core = add(group, new THREE.SphereGeometry(r, 64, 32), new THREE.MeshStandardMaterial({ color: 0xffc46b, emissive: 0xffa53a, emissiveIntensity: 2.4 }), 0, 0, 0, off);
    const { texture, ctx } = canvasTexture(256, 256), g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
    g.addColorStop(0, "rgba(255,200,110,0.9)"); g.addColorStop(0.35, "rgba(255,150,60,0.35)"); g.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256); texture.needsUpdate = true;
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    corona.scale.setScalar(r * 4.2);
    group.add(corona);
    return { group, spin: core, mats: [], radius: r };
  }
  if (id === "asteroid-belt") {
    const mat = M.clay(0x9a8674, { roughness: 0.95, emissive: 0x9a8674, emissiveIntensity: glow * 0.6 }).clone();
    const spin = new THREE.Group();
    group.add(spin);
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, d = r * (0.25 + rnd() * 0.85);
      const m = add(spin, new THREE.DodecahedronGeometry(r * (0.08 + rnd() * 0.16), 0), mat, Math.cos(a) * d, (rnd() - 0.5) * r * 0.5, Math.sin(a) * d * 0.6, off);
      m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    }
    return { group, spin, mats: [mat], radius: r };
  }
  const look = LOOKS[id], map = paint(rnd, look);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: glow, roughness: 0.9 });
  const body = add(group, new THREE.SphereGeometry(r, 48, 24), mat, 0, 0, 0, off);
  body.rotation.z = look.tilt ?? 0.2;
  const mats = [mat];
  if (look.ring) {
    const [c, r0, r1] = look.ring;
    const rm = new THREE.MeshStandardMaterial({ color: new THREE.Color(c), emissive: new THREE.Color(c), emissiveIntensity: glow * 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    const ring = add(group, new THREE.RingGeometry(r * r0, r * r1, 96), rm, 0, 0, 0, off);
    ring.rotation.set(Math.PI / 2 - 0.35, 0, look.tilt ?? 0);
    mats.push(rm);
  }
  if (id === "deep-space") {
    for (const [c, x, y, s] of [["#6d3bd6", -1.2, 0.6, 5], ["#1f8fb0", 1.1, -0.4, 4.4], ["#c0397a", 0.2, 1.1, 3.6]] as const) {
      const { texture, ctx } = canvasTexture(64, 64), g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
      g.addColorStop(0, c); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); texture.needsUpdate = true;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.45, depthWrite: false }));
      sp.position.set(x * r, y * r, -r * 1.5);
      sp.scale.setScalar(s * r);
      group.add(sp);
    }
  }
  return { group, spin: body, mats, radius: r };
}

/** A starfield shell of `n` points at `radius` around `at`. */
export function starfield(n: number, radius: number, rnd: Rng, at = new THREE.Vector3()) {
  const sp: number[] = [];
  for (let i = 0; i < n; i++) { const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(radius * (0.7 + rnd() * 0.3)).add(at); sp.push(v.x, v.y, v.z); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, fog: false }));
}
