import * as THREE from "three";
import { COLOR, hex } from "@/design/tokens";

/** Two token colours mixed (`t` = 0 is `a`), as a three.js hex number. */
function mixHex(a: string, b: string, t: number): number {
  const x = hex(a), y = hex(b), ch = (n: number, s: number) => (n >> s) & 255;
  const m = (s: number) => Math.round(ch(x, s) + (ch(y, s) - ch(x, s)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

/**
 * The Math World material base, in the Void and Gold language (OVERHAUL.md): matte clay for everything
 * solid, toon bands where a thing must read at a glance, and a light ink hairline on small heroes.
 *
 * PALETTE derives from src/design/tokens.ts. The keys are the old ones (so every scene still compiles);
 * the values are remapped into the new language:
 *   ink → void, ink2 → panel, clay → approach, cream → approach warmed by gold, coral → ember,
 *   lilac → sky, sky → sky, slate → horizon lifted toward sky, dark → shadow,
 *   invader → disk (the enemy is a cool, deep blue; the ships track owns its final colour),
 *   lime (the old brand accent) → gold, cyan (the old neon) → sky, gold → gold, shot → gold lifted toward white.
 */
export const PALETTE = {
  ink: hex(COLOR.void),
  ink2: hex(COLOR.panel),
  clay: hex(COLOR.approach),
  cream: mixHex(COLOR.approach, COLOR.gold, 0.22),
  coral: hex(COLOR.ember),
  lilac: hex(COLOR.sky),
  sky: hex(COLOR.sky),
  slate: mixHex(COLOR.horizon, COLOR.sky, 0.3),
  dark: hex(COLOR.shadow),
  invader: hex(COLOR.disk),
  lime: hex(COLOR.gold),
  cyan: hex(COLOR.sky),
  gold: hex(COLOR.gold),
  shot: mixHex(COLOR.gold, COLOR.approach, 0.45),
} as const;

/**
 * The ink outline: an inverted hull pushed out along its normals in screen space, so the line is the same
 * width on screen (OUTLINE.width CSS px) whatever the object's size or distance. The background is the void,
 * so the line is light: approach at reduced strength, never above the bloom threshold.
 *
 * How a mesh opts in: call `outline(mesh, stage.mats)` once after building it. Use it only on small heroes
 * (the rocket, drones, Nova), never on planets or sets. It reads best on smooth, closed meshes (lathes,
 * spheres, capsules); a hard-edged box shows gaps at its corners, so give boxes a small bevel or skip them.
 * Change the width for a whole scene with `mats.outline.uniforms.width.value` (CSS px).
 */
export const OUTLINE = { width: 1.25, color: COLOR.approach, strength: 0.42 } as const;

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
      uniforms: {
        width: { value: OUTLINE.width },
        px: { value: OUTLINE.width },
        res: { value: new THREE.Vector2(1280, 720) },
        c: { value: new THREE.Color(OUTLINE.color).multiplyScalar(OUTLINE.strength) },
      },
      // clip-space offset: the normal's screen direction, scaled to `px` device pixels at any depth
      vertexShader:
        "uniform float px;uniform vec2 res;void main(){vec4 c=projectionMatrix*modelViewMatrix*vec4(position,1.0);" +
        "vec3 n=normalize(normalMatrix*normal);vec2 d=(projectionMatrix*vec4(n,0.0)).xy*res;float l=length(d);" +
        "if(l>1e-5){c.xy+=d/l*px*2.0/res*c.w;}gl_Position=c;}",
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

  /** Skin: soft clay with a warm sheen at grazing angles, so faces read as skin, not plastic. */
  skin(color: number): THREE.MeshPhysicalMaterial {
    const k = this.key("skin", color, {});
    if (!this.cache.has(k)) this.cache.set(k, new THREE.MeshPhysicalMaterial({ color, roughness: 0.52, metalness: 0, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffd6c4) }));
    return this.cache.get(k) as THREE.MeshPhysicalMaterial;
  }

  /** Fabric: matte with a soft fuzz sheen (shirts, trousers, capes). */
  fabric(color: number, o: THREE.MeshPhysicalMaterialParameters = {}): THREE.MeshPhysicalMaterial {
    const k = this.key("fabric", color, o);
    if (!this.cache.has(k)) this.cache.set(k, new THREE.MeshPhysicalMaterial({ color, roughness: 0.82, metalness: 0, sheen: 0.6, sheenRoughness: 0.8, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35), ...o }));
    return this.cache.get(k) as THREE.MeshPhysicalMaterial;
  }

  /**
   * Self-light. Keep `intensity` under 1 so nothing but the Sun and the Launch moment blooms (OVERHAUL.md);
   * above 1 the bloom pass picks it up.
   */
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

const drawSize = new THREE.Vector2();
/** Adds the ink hairline to a mesh (see OUTLINE for when to use it). Returns the outline mesh. */
export function outline(mesh: THREE.Mesh, mats: Materials) {
  const o = new THREE.Mesh(mesh.geometry, mats.outline);
  o.castShadow = o.receiveShadow = false;
  // keep the line's width in screen pixels: read the drawing-buffer size and pixel ratio just before drawing
  o.onBeforeRender = (renderer) => {
    const u = mats.outline.uniforms;
    renderer.getDrawingBufferSize(drawSize);
    (u.res.value as THREE.Vector2).copy(drawSize);
    u.px.value = u.width.value * renderer.getPixelRatio();
  };
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

/** Draws text centred in a box, shrinking the font until it fits with a margin. Signs never clip. */
export function fitText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxW: number, maxPx: number, weight = "bold", family = "Georgia, 'Times New Roman', serif") {
  let px = maxPx;
  do { ctx.font = `${weight} ${px}px ${family}`; px -= 2; } while (ctx.measureText(text).width > maxW && px > 8);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy);
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
