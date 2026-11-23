import * as THREE from "three";

/**
 * The Math World material base: soft clay for everything solid, toon shading and outlines
 * where a thing must read at a glance, and a neon glow (emissive above 1, caught by bloom)
 * for lights, eyes, screens and shots.
 */
export const PALETTE = {
  ink: 0x0d0e1a,
  ink2: 0x10153a,
  clay: 0xf3eee6,
  cream: 0xf2e6cf,
  coral: 0xff8f70,
  lilac: 0xb79cff,
  sky: 0x9fe8ff,
  slate: 0x55597a,
  dark: 0x2b2d42,
  invader: 0x7ddc3e, // the green toon enemy
  lime: 0xb6f23a,    // brand accent
  cyan: 0x3dfcff,    // neon glow
  gold: 0xffc94d,
  shot: 0xfff04d,
} as const;

export type ClayOpts = THREE.MeshStandardMaterialParameters;

/** Caches materials by colour and options, so a scene with hundreds of parts shares a handful of materials. */
export class Materials {
  private cache = new Map<string, THREE.Material>();
  private gradient: THREE.DataTexture;
  readonly outline: THREE.ShaderMaterial;

  constructor() {
    this.gradient = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
    this.gradient.minFilter = this.gradient.magFilter = THREE.NearestFilter;
    this.gradient.needsUpdate = true;
    this.outline = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0.035 }, c: { value: new THREE.Color(0x140d30) } },
      vertexShader: "uniform float t;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*t,1.0);}",
      fragmentShader: "uniform vec3 c;void main(){gl_FragColor=vec4(c,1.0);}",
      side: THREE.BackSide,
    });
  }

  private key(kind: string, color: number, o: object) {
    return kind + color + JSON.stringify(o, (_k, v) => (v && (v as THREE.Texture).isTexture ? (v as THREE.Texture).uuid : v));
  }

  /** Soft clay: matte, slightly rough, no metal. The default for everything. */
  clay(color: number, o: ClayOpts = {}): THREE.MeshStandardMaterial {
    const k = this.key("clay", color, o);
    if (!this.cache.has(k)) this.cache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...o }));
    return this.cache.get(k) as THREE.MeshStandardMaterial;
  }

  /** Neon glow: emissive above 1 so the bloom pass picks it up. */
  glow(color: number, intensity = 2.2, o: ClayOpts = {}): THREE.MeshStandardMaterial {
    return this.clay(color, { emissive: color, emissiveIntensity: intensity, ...o });
  }

  /** Toon: three hard light bands, for enemies and anything that must read at a glance. */
  toon(color: number, o: THREE.MeshToonMaterialParameters = {}): THREE.MeshToonMaterial {
    const k = this.key("toon", color, o);
    if (!this.cache.has(k)) this.cache.set(k, new THREE.MeshToonMaterial({ color, gradientMap: this.gradient, ...o }));
    return this.cache.get(k) as THREE.MeshToonMaterial;
  }

  /** Additive light that ignores scene lighting: flames, sparks, explosions. */
  additive(r: number, g: number, b: number, opacity = 1): THREE.MeshBasicMaterial {
    const m = new THREE.MeshBasicMaterial({ transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    m.color.setRGB(r, g, b);
    return m;
  }

  dispose() {
    this.cache.forEach((m) => m.dispose());
    this.cache.clear();
    this.gradient.dispose();
    this.outline.dispose();
  }
}

/** Places a mesh and sets shadow flags in one line: the workhorse of every builder. */
export function add(
  parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[],
  x = 0, y = 0, z = 0, o: { cast?: boolean; recv?: boolean } = {},
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = o.cast !== false;
  m.receiveShadow = o.recv !== false;
  parent.add(m);
  return m;
}

/** Adds an inverted-hull outline to a mesh (the toon ink line). */
export function outline(mesh: THREE.Mesh, mats: Materials) {
  const o = new THREE.Mesh(mesh.geometry, mats.outline);
  mesh.add(o);
  return o;
}

/** A canvas you can draw on and use as a texture (chalkboards, signs, planet maps). */
export function canvasTexture(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, ctx: c.getContext("2d") as CanvasRenderingContext2D };
}

/** A triangular prism (roofs, gables), centred on its depth. */
export function prism(w: number, h: number, d: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}
