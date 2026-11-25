import * as THREE from "three";
import { COLOR } from "@/design/tokens";
import { add, type Materials } from "@/engine/materials";
import { seeded, type Rng } from "@/engine/util";
import { LOOKS, type LookId } from "@/worlds/looks";
import type { BodyId } from "./bodies";
import { paintBody, paintRing, type BodyMaps, type MapBodyId } from "./planetMaps";

/**
 * The one planet factory. Every body in Math World (the title, the battle backdrops, the film's Earth,
 * the 2D planet sprites) comes from `makeBody`, so the same Earth appears everywhere.
 *
 * - One texture set per body, painted procedurally (planetMaps.ts) in a worker and cached for the session.
 * - Two levels of detail: `low` (small on screen: the title, sprites up to about 120 px) and `high`
 *   (a body that fills the frame: the film's Earth, a battle's planet). `high` shows the low maps first and
 *   sharpens when its own maps land.
 * - Matte, lit by the look: the scene's gold key makes the day side; the material adds a faint shadow-blue
 *   floor so the night side never goes to pure black, and a thin cool rim. Only the Sun is above the bloom
 *   threshold.
 */
export type { BodyId } from "./bodies";
export { BODY_IDS, BODY_NAME } from "./bodies";
export type Lod = "low" | "high";

interface Spec {
  map: MapBodyId;
  /** Map width per LOD (height is half). */
  w: [number, number];
  /** Axial tilt, radians. */
  tilt: number;
  /** Rim strength (linear, kept well under the bloom threshold) and bump strength. */
  rim: number;
  bump?: number;
  /** Rings lie in the body's equator, so they share its tilt. */
  ring?: { kind: "saturn" | "uranus"; inner: number; outer: number };
}
const SPEC: Record<Exclude<BodyId, "asteroid-belt">, Spec> = {
  sun: { map: "sun", w: [512, 1024], tilt: 0.12, rim: 0 },
  mercury: { map: "mercury", w: [512, 1024], tilt: 0.02, rim: 0.16, bump: 0.6 },
  venus: { map: "venus", w: [512, 1024], tilt: 0.05, rim: 0.3 },
  earth: { map: "earth", w: [1024, 2048], tilt: 0.41, rim: 0.16 },
  moon: { map: "moon", w: [512, 2048], tilt: 0.03, rim: 0.14, bump: 0.6 },
  mars: { map: "mars", w: [512, 2048], tilt: 0.44, rim: 0.2, bump: 0.5 },
  jupiter: { map: "jupiter", w: [512, 1024], tilt: 0.05, rim: 0.24 },
  saturn: { map: "saturn", w: [512, 1024], tilt: 0.47, rim: 0.22, ring: { kind: "saturn", inner: 1.24, outer: 2.2 } },
  uranus: { map: "uranus", w: [512, 1024], tilt: 1.71, rim: 0.26, ring: { kind: "uranus", inner: 1.6, outer: 2.0 } },
  neptune: { map: "neptune", w: [512, 1024], tilt: 0.49, rim: 0.28 },
  "deep-space": { map: "deep-space", w: [512, 1024], tilt: 0.3, rim: 0.3 },
};

/* ---------- map painting: a small worker pool, with a main-thread fallback ---------- */

let pool: Worker[] | null = null, next = 0, ticket = 0;
const waiting = new Map<number, (m: BodyMaps) => void>();
function workers(): Worker[] {
  if (pool) return pool;
  pool = [];
  try {
    const n = typeof navigator !== "undefined" && navigator.hardwareConcurrency > 2 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL("./planetMaps.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e: MessageEvent<{ n: number; maps: BodyMaps }>) => { waiting.get(e.data.n)?.(e.data.maps); waiting.delete(e.data.n); };
      pool.push(w);
    }
  } catch { pool = []; }
  return pool;
}
const painted = new Map<string, Promise<BodyMaps>>();
function paintAsync(id: MapBodyId, w: number): Promise<BodyMaps> {
  const key = `${id}@${w}`;
  let p = painted.get(key);
  if (!p) {
    const ws = typeof Worker !== "undefined" ? workers() : [];
    p = ws.length
      ? new Promise<BodyMaps>((resolve) => { const n = ++ticket; waiting.set(n, resolve); ws[next++ % ws.length].postMessage({ n, id, w }); })
      : new Promise<BodyMaps>((resolve) => setTimeout(() => resolve(paintBody(id, w)), 0));
    painted.set(key, p);
  }
  return p;
}

interface Textures { map: THREE.DataTexture; bump?: THREE.DataTexture; clouds?: THREE.DataTexture }
const textures = new Map<string, Promise<Textures>>();
function dataTexture(data: Uint8ClampedArray, w: number, h: number, rgba: boolean) {
  const t = new THREE.DataTexture(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), w, h, rgba ? THREE.RGBAFormat : THREE.RedFormat, THREE.UnsignedByteType);
  t.colorSpace = rgba ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
/** The texture set of a body at a width, shared by every mesh that shows it. */
function texturesFor(id: MapBodyId, w: number): Promise<Textures> {
  const key = `${id}@${w}`;
  let p = textures.get(key);
  if (!p) {
    p = paintAsync(id, w).then((m) => ({
      map: dataTexture(m.albedo, m.w, m.h, true),
      bump: m.height ? dataTexture(m.height, m.w, m.h, false) : undefined,
      clouds: m.clouds ? dataTexture(m.clouds, m.w, m.h, true) : undefined,
    }));
    textures.set(key, p);
  }
  return p;
}
/** Start painting a body's maps before it is needed (a route about to open). */
export function preloadBody(id: BodyId, lod: Lod = "low") {
  if (id === "asteroid-belt") return void texturesFor("rock", 256);
  const s = SPEC[id];
  void texturesFor(s.map, s.w[0]);
  if (lod === "high") void texturesFor(s.map, s.w[1]);
}

const ringTextures = new Map<string, THREE.DataTexture>();
function ringTexture(kind: "saturn" | "uranus") {
  let t = ringTextures.get(kind);
  if (!t) { t = dataTexture(paintRing(kind), 512, 1, true); t.wrapS = THREE.ClampToEdgeWrapping; ringTextures.set(kind, t); }
  return t;
}

/* ---------- materials ---------- */

const linear = (c: string) => new THREE.Color(c);
/**
 * Matte body material: MeshStandardMaterial plus a faint shadow-blue floor on the night side and a thin
 * cool fresnel rim, both well under the bloom threshold. `emissive`/`emissiveMap` stay wired to the map at
 * intensity 0 so older scenes that tint a body (the star map's silhouettes) still work.
 */
function bodyMaterial(look: LookId, rim: number) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0 });
  const uniforms = {
    uRim: { value: new THREE.Color(LOOKS[look].rim.color).multiplyScalar(rim) },
    uNight: { value: linear(COLOR.shadow).multiplyScalar(0.55) },
  };
  m.userData.body = uniforms;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRim;\nuniform vec3 uNight;")
      .replace(
        "#include <opaque_fragment>",
        "{ float fr = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);\n" +
        "  outgoingLight += uRim * pow(fr, 3.2) + uNight * (0.35 + 0.65 * diffuseColor.rgb); }\n#include <opaque_fragment>",
      );
  };
  m.customProgramCacheKey = () => "mw-body";
  return m;
}

/** The Sun's surface: granulation from its map, darkened toward the limb, bright enough to be the one bloom. */
function sunMaterial() {
  const blank = new THREE.DataTexture(new Uint8Array([255, 200, 87, 255]), 1, 1);
  blank.colorSpace = THREE.SRGBColorSpace;
  blank.needsUpdate = true;
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: blank }, hot: { value: 1.3 }, limbTint: { value: new THREE.Color(COLOR.ember) } },
    vertexShader:
      "varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.0);" +
      "vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}",
    fragmentShader:
      "uniform sampler2D map;uniform float hot;uniform vec3 limbTint;varying vec3 vN;varying vec3 vV;varying vec2 vUv;" +
      "void main(){float mu=clamp(dot(normalize(vN),normalize(vV)),0.0,1.0);vec3 c=texture2D(map,vUv).rgb;" +
      "float limb=0.4+0.6*pow(mu,0.5);vec3 tint=mix(limbTint,vec3(1.0),pow(mu,0.45));gl_FragColor=vec4(c*hot*limb*tint,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
  });
}

/** A radial falloff texture (linear data) for the Sun's halo and Deep Space's haze. */
let falloff: THREE.DataTexture | null = null;
function falloffTexture() {
  if (falloff) return falloff;
  const n = 128, data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const d = Math.hypot(i + 0.5 - n / 2, j + 0.5 - n / 2) / (n / 2), k = (j * n + i) * 4;
    const a = d >= 1 ? 0 : Math.pow(1 - d, 2.4) * 0.85 + Math.exp(-d * d * 30) * 0.15;
    data[k] = data[k + 1] = data[k + 2] = 255; data[k + 3] = Math.round(a * 255);
  }
  falloff = new THREE.DataTexture(data, n, n);
  falloff.magFilter = falloff.minFilter = THREE.LinearFilter;
  falloff.needsUpdate = true;
  return falloff;
}

/* ---------- the factory ---------- */

export interface Body {
  group: THREE.Group;
  /** The part that spins about the body's axis (callers turn `spin.rotation.y`). */
  spin: THREE.Object3D;
  /** The body's lit materials (surface, then ring), for scenes that tint a body. */
  mats: THREE.MeshStandardMaterial[];
  radius: number;
  /** Earth's cloud layer: a separate sphere that turns with the body and drifts a little faster with `update`. */
  clouds?: THREE.Mesh;
  /** Resolves when the first maps are on the body; `sharp` when its own level of detail has landed. */
  ready: Promise<void>;
  sharp: Promise<void>;
  /** Optional per-frame drift (Earth's clouds); safe to skip. */
  update(dt: number): void;
}

export interface BodyOptions {
  /** Kept for older callers; ignored. Bodies are matte and lit by the look. */
  glow?: number;
  seed?: number;
  /** Level of detail (default `low`). */
  lod?: Lod;
  /** Which look's rim colour the material carries (default `space`). */
  look?: LookId;
  /** Earth's cloud layer (default on). */
  clouds?: boolean;
  /** The Sun's soft halo sprite and Deep Space's faint haze (default on; sprites of the Sun keep it). */
  halo?: boolean;
}

/** A body of radius `r` at the origin of its group. */
export function makeBody(M: Materials, id: BodyId, r: number, o: BodyOptions = {}): Body {
  void M;
  const lod = o.lod ?? "low", look = o.look ?? "space", rnd = seeded((o.seed ?? 3) + id.length * 7), group = new THREE.Group(), off = { cast: false, recv: false };
  const seg = lod === "high" ? [128, 64] : [48, 24];

  if (id === "asteroid-belt") {
    const mat = bodyMaterial(look, 0.12);
    const spin = new THREE.Group();
    group.add(spin);
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, d = r * (0.25 + rnd() * 0.85);
      const m = add(spin, rockGeometry(r * (0.08 + rnd() * 0.16), rnd), mat, Math.cos(a) * d, (rnd() - 0.5) * r * 0.5, Math.sin(a) * d * 0.6, off);
      m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    }
    const ready = texturesFor("rock", 256).then((t) => { mat.map = mat.emissiveMap = t.map; mat.bumpMap = t.bump ?? null; mat.bumpScale = 1; mat.needsUpdate = true; });
    return { group, spin, mats: [mat], radius: r, ready, sharp: ready, update() {} };
  }

  const s = SPEC[id], tilt = new THREE.Group();
  tilt.rotation.z = s.tilt;
  group.add(tilt);

  if (id === "sun") {
    const mat = sunMaterial();
    const core = add(tilt, new THREE.SphereGeometry(r, 64, 32), mat, 0, 0, 0, off);
    if (o.halo !== false) {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: falloffTexture(), color: new THREE.Color(COLOR.gold).multiplyScalar(0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(r * 5.2);
      group.add(halo);
    }
    const first = texturesFor(s.map, s.w[0]).then((t) => { mat.uniforms.map.value = t.map; });
    const sharp = lod === "high" ? texturesFor(s.map, s.w[1]).then((t) => { mat.uniforms.map.value = t.map; }) : first;
    return { group, spin: core, mats: [], radius: r, ready: first, sharp, update() {} };
  }

  const mat = bodyMaterial(look, s.rim);
  const body = add(tilt, new THREE.SphereGeometry(r, seg[0], seg[1]), mat, 0, 0, 0, off);
  body.visible = false;
  const mats = [mat];
  let clouds: THREE.Mesh | undefined, cloudMat: THREE.MeshStandardMaterial | undefined;
  if (id === "earth" && o.clouds !== false) {
    cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, depthWrite: false, roughness: 1, metalness: 0, opacity: 0.92 });
    clouds = add(body, new THREE.SphereGeometry(r * 1.012, seg[0], seg[1]), cloudMat, 0, 0, 0, off);
    clouds.visible = false;
    // a thin cool atmosphere just inside the limb, fading to nothing at the edge (additive, far under the bloom threshold)
    add(group, new THREE.SphereGeometry(r * 1.035, seg[0], seg[1]), atmosphereMaterial(look), 0, 0, 0, off);
  }
  if (s.ring) {
    const rm = new THREE.MeshStandardMaterial({ map: ringTexture(s.ring.kind), color: 0xffffff, emissive: 0xffffff, emissiveMap: ringTexture(s.ring.kind), emissiveIntensity: 0.08, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1, metalness: 0 });
    const ring = add(tilt, ringGeometry(r * s.ring.inner, r * s.ring.outer), rm, 0, 0, 0, off);
    ring.rotation.x = -Math.PI / 2;
    mats.push(rm);
  }
  if (id === "deep-space" && o.halo !== false) {
    // faint cool haze behind the far world (normal blending, never bright)
    for (const [c, x, y, sc, op] of [[COLOR.disk, -1.2, 0.6, 5, 0.22], [COLOR.sky, 1.1, -0.4, 4.4, 0.12], [COLOR.disk, 0.2, 1.1, 3.6, 0.16]] as const) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: falloffTexture(), color: new THREE.Color(c), transparent: true, opacity: op, depthWrite: false }));
      sp.position.set(x * r, y * r, -r * 1.5);
      sp.scale.setScalar(sc * r);
      group.add(sp);
    }
  }

  const apply = (t: Textures) => {
    mat.map = mat.emissiveMap = t.map;
    if (t.bump && s.bump) { mat.bumpMap = t.bump; mat.bumpScale = s.bump; }
    mat.needsUpdate = true;
    body.visible = true;
    if (cloudMat && clouds && t.clouds) { cloudMat.map = t.clouds; cloudMat.needsUpdate = true; clouds.visible = true; }
  };
  const ready = texturesFor(s.map, s.w[0]).then(apply);
  const sharp = lod === "high" ? Promise.all([ready, texturesFor(s.map, s.w[1])]).then(([, t]) => apply(t)) : ready;
  return {
    group, spin: body, mats, radius: r, clouds, ready, sharp,
    update(dt) { if (clouds) clouds.rotation.y += dt * 0.012; },
  };
}

function atmosphereMaterial(look: LookId) {
  return new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(LOOKS[look].rim.color).multiplyScalar(0.5) } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: "varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}",
    fragmentShader: "uniform vec3 c;varying vec3 vN;varying vec3 vV;void main(){float mu=max(dot(normalize(vN),normalize(vV)),0.0);float f=pow(1.0-mu,3.0)*smoothstep(0.0,0.3,mu);gl_FragColor=vec4(c*f,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
  });
}

/** A flat ring whose texture runs from the inner edge (u = 0) to the outer edge (u = 1). */
function ringGeometry(inner: number, outer: number) {
  const g = new THREE.RingGeometry(inner, outer, 160, 1), pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), 0.5);
  return g;
}

/** A lumpy rock: an icosphere with its vertices pushed in and out. */
function rockGeometry(r: number, rnd: Rng) {
  const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position, v = new THREE.Vector3();
  const k = [rnd() * 9, rnd() * 9, rnd() * 9];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + 0.22 * Math.sin(v.x / r * 3 + k[0]) * Math.cos(v.y / r * 2.6 + k[1]) + 0.12 * Math.sin(v.z / r * 4 + k[2]);
    v.multiplyScalar(n);
    p.setXYZ(i, v.x, v.y * 0.8, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** The shared rock material for loose rocks in a scene (the Asteroid Belt's battle field). */
export function rockMaterial(look: LookId = "space") {
  const mat = bodyMaterial(look, 0.1);
  void texturesFor("rock", 256).then((t) => { mat.map = mat.emissiveMap = t.map; mat.bumpMap = t.bump ?? null; mat.bumpScale = 1; mat.needsUpdate = true; });
  return mat;
}
export { rockGeometry };

/* ---------- the one starfield ---------- */

/**
 * The one starfield: a far shell of `n` pin-sharp points at about `radius` around `at`. Sizes are fixed in
 * screen pixels (no blur at any distance), brightness stays under the bloom threshold, and most stars are
 * the cool white of the ink with a few sky-blue and a few warm. One in seven sits in a slightly larger layer.
 */
export function starfield(n: number, radius: number, rnd: Rng, at = new THREE.Vector3()) {
  const make = (count: number, size: number, bright: [number, number]) => {
    const pos: number[] = [], col: number[] = [], c = new THREE.Color();
    const tints = [new THREE.Color(COLOR.approach), new THREE.Color(COLOR.sky), new THREE.Color(COLOR.gold)];
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
      if (v.lengthSq() < 1e-4) v.set(0, 1, 0);
      v.normalize().multiplyScalar(radius * (0.7 + rnd() * 0.3)).add(at);
      pos.push(v.x, v.y, v.z);
      const t = rnd(), b = bright[0] + (bright[1] - bright[0]) * Math.pow(rnd(), 2.2);
      c.copy(tints[t < 0.78 ? 0 : t < 0.93 ? 1 : 2]).multiplyScalar(b);
      col.push(c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
  };
  const big = Math.round(n / 7), field = make(n - big, 1.1, [0.18, 0.6]);
  field.add(make(big, 1.7, [0.4, 0.85]));
  field.renderOrder = -1;
  return field;
}
