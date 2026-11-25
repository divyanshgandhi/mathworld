import * as THREE from "three";
import { COLOR, hex, TYPE, type ColorName } from "@/design/tokens";
import { add, canvasTexture, fitText, outline, type Materials } from "@/engine/materials";

/**
 * Every ship in Math World, in the Void and Gold language (see OVERHAUL.md and docs/overhaul/ships.md).
 *
 * The colour story: the player's side is cool, the invaders are warm.
 * - The cadet's rocket: an approach-white body, gold and sky trim, a dark porthole and an ember flame.
 * - Invaders: the ember family, matte, with a dark visor and light eyes. Silly, never scary.
 *   Squads alternate two warm tones row by row, and each squad has a leader with a gold pennant.
 *
 * Counting the ships IS the maths, so every invader is a solid, outlined blob with a clear gap
 * around it, and every big ship shows its worth as a grid you could count (10 sockets, 100 cells).
 * Everything is matte: emissive stays well under the bloom threshold of every look.
 */

// ---- colour, built only from tokens ----
const C = (name: ColorName) => hex(COLOR[name]);
/** A tone between two token colours (mixed in linear light, like the renderer does). */
const mix = (a: ColorName, b: ColorName, t: number) => new THREE.Color(COLOR[a]).lerp(new THREE.Color(COLOR[b]), t).getHex();
/** Three-way tone: mix two tokens, then mix the result towards a third (all in linear light). */
const mix3 = (a: ColorName, b: ColorName, t: number, c: ColorName, u: number) =>
  new THREE.Color(COLOR[a]).lerp(new THREE.Color(COLOR[b]), t).lerp(new THREE.Color(COLOR[c]), u).getHex();
/** A token colour as linear RGB scaled by `k`, for additive flames (kept under the bloom threshold). */
const lin = (name: ColorName, k: number) => { const c = new THREE.Color(COLOR[name]); return [c.r * k, c.g * k, c.b * k] as const; };

/** The invader family. `ember` and `amber` alternate squad by squad; `shade` is the underside; gold is only for leaders. */
export const INVADER = {
  ember: C("ember"),
  amber: mix3("ember", "gold", 0.5, "approach", 0.3),
  shade: mix("ember", "shadow", 0.4),
  /** The dark tray of pods and big ships. */
  hull: mix("recede", "shadow", 0.72),
  visor: C("shadow"),
  eye: C("approach"),
  crest: C("gold"),
} as const;
export type InvaderTone = "ember" | "amber";
export const INVADER_TONES: readonly InvaderTone[] = ["ember", "amber"];

/**
 * How one invader looks inside its squad. Additive options on every invader builder:
 * - `tone`: the squad's warm tone (alternate by squad: `squadStyle` does it for you).
 * - `leader`: the same drone with a gold pennant on a taller antenna, one per squad.
 */
export interface DroneOpts { tone?: InvaderTone; leader?: boolean }

/**
 * The battle's squad styling in one place: squad `squad` (0-based row in the formation, i.e. `gRow`)
 * gets the alternating tone, and ship `index` 0 in that squad (`gCol === 0`, where counting starts)
 * is the leader. For pods and bigger ships pass the squad and the ship's index within the squad.
 */
export function squadStyle(squad: number, index: number): Required<DroneOpts> {
  return { tone: INVADER_TONES[((squad % 2) + 2) % 2], leader: index === 0 };
}

// ---- Hangar upgrades: styling hooks (ids match `upgrade_purchased` item ids in director/hangar.ts) ----
type RGB = readonly [number, number, number];

/** Hull paints: `hull` is the body, `trim` the nose cap and porthole rim, `accent` the fins and band. */
export const HULLS = {
  "cadet-white": { hull: C("approach"), trim: C("gold"), accent: C("sky") },
  "solar-gold": { hull: C("gold"), trim: C("ember"), accent: C("approach") },
  "nebula-violet": { hull: mix("disk", "recede", 0.3), trim: C("gold"), accent: C("approach") },
  "obsidian-stealth": { hull: C("horizon"), trim: C("sky"), accent: C("sky") },
} as const;

/**
 * Thruster trails, all additive and dim enough to stay under the bloom threshold:
 * `outer`/`inner` are linear RGB, `length` and `width` shape the flame, `sparks` adds a comet tail.
 */
export const THRUSTERS: Record<"amber-flame" | "cyan-ion" | "starlight-comet", { outer: RGB; inner: RGB; length: number; width: number; sparks: boolean }> = {
  // the classic: a short, round ember burn with a gold heart
  "amber-flame": { outer: lin("ember", 0.62), inner: lin("gold", 0.55), length: 1, width: 1, sparks: false },
  // a cool blue jet: long and narrow
  "cyan-ion": { outer: lin("sky", 0.45), inner: lin("approach", 0.42), length: 1.45, width: 0.7, sparks: false },
  // a white comet with a gold heart and a trail of sparks
  "starlight-comet": { outer: lin("approach", 0.34), inner: lin("gold", 0.5), length: 1.25, width: 1.1, sparks: true },
};

/**
 * Blaster effects: the plasma balls the cadet fires. `color` is the ball, `glow` the emissive
 * intensity to use with it (under the bloom threshold), `size`, `twin` (two side by side) and
 * `stretch` (a long bolt along the flight). Use `makePlasmaBall` to build one.
 */
export const BLASTERS = {
  "plasma-ball": { color: C("approach"), size: 1, twin: false, stretch: 1, glow: 0.45 },
  "twin-plasma": { color: C("sky"), size: 0.8, twin: true, stretch: 1, glow: 0.5 },
  "ion-arc": { color: mix("sky", "disk", 0.35), size: 0.85, twin: false, stretch: 2.2, glow: 0.55 },
  "nova-beam": { color: C("gold"), size: 0.75, twin: false, stretch: 3.4, glow: 0.4 },
} as const;
export type HullId = keyof typeof HULLS;
export type ThrusterId = keyof typeof THRUSTERS;
export type BlasterId = keyof typeof BLASTERS;
export interface RocketStyle { hull?: string; thruster?: string }
const pickOf = <T extends object>(table: T, id: string | undefined, fallback: keyof T): T[keyof T] => table[(id && id in table ? id : fallback) as keyof T];

/** The blaster for an equipped id (unknown ids fall back to the starter). */
export const blasterOf = (id?: string) => pickOf(BLASTERS, id, "plasma-ball");

const ballGeo = new THREE.SphereGeometry(0.14, 16, 12);
/**
 * One plasma ball in a blaster's style: matte with a soft emissive, never a halo. `size` multiplies
 * the style's own size (the arena scales balls by ship class). The mesh points along +z: call
 * `lookAt(target)` and a stretched bolt flies nose first. Geometry is shared: do not dispose it.
 */
export function makePlasmaBall(M: Materials, blaster?: string, size = 1) {
  const b = blasterOf(blaster);
  const m = new THREE.Mesh(ballGeo, M.glow(b.color, b.glow, { roughness: 0.4 }));
  m.scale.set(1, 1, b.stretch).multiplyScalar(b.size * size);
  m.castShadow = false;
  return m;
}

// ---- the cadet's rocket ----
const V = (x: number, y: number) => new THREE.Vector2(x, y);
const BODY_Y = -1.5; // the body sits so the group's origin is at its middle: it tilts and recoils about its centre
const NOSE_Y = 3.02 + BODY_Y;

/** Alpha along a flame, tip (v = 0) to nozzle (v = 1): it fades out towards the tip instead of ending in a hard edge. */
const flameFade = (() => {
  const n = 64, d = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { const v = i / (n - 1), a = Math.round(255 * Math.min(1, Math.pow(v, 1.6) * 1.25)); d.set([a, a, a, 255], i * 4); }
  const t = new THREE.DataTexture(d, 1, n);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
})();

/** A flame profile hanging down from its top (the nozzle), so scaling it never detaches it. */
function flameGeo(r: number, len: number) {
  const g = new THREE.LatheGeometry([V(0, -len), V(r * 0.36, -len * 0.8), V(r * 0.78, -len * 0.45), V(r, -len * 0.16), V(r * 0.85, 0), V(0, 0.04)], 32);
  return g;
}

/**
 * The cadet's rocket: a chubby toy with a strong silhouette (gold nose, dark porthole, three big
 * splayed fins) that still reads at 40 px. Matte, no glow; only the flame is additive.
 *
 * Pivots: `group` is the rocket (origin at its middle: aim and bank it by rotating the group);
 * `body` holds the model (`recoil(k)` squashes it backwards for a shot). The flame hangs from the
 * nozzle, so `flicker` only ever lengthens it downwards.
 */
export function makeRocket(M: Materials, style: RocketStyle = {}) {
  const rocket = new THREE.Group(), body = new THREE.Group();
  rocket.add(body);
  body.position.y = BODY_Y;
  const paint = pickOf(HULLS, style.hull, "cadet-white"), flame = pickOf(THRUSTERS, style.thruster, "amber-flame");
  const hull = M.clay(paint.hull, { roughness: 0.72 }), trim = M.clay(paint.trim, { roughness: 0.66 }), accent = M.clay(paint.accent, { roughness: 0.66 });
  const dark = M.clay(C("shadow"), { roughness: 0.8 }), glass = M.clay(C("void"), { roughness: 0.35 });

  // body: a round-bellied ogive, then a gold nose cap
  outline(add(body, new THREE.LatheGeometry([V(0, 0), V(0.44, 0), V(0.56, 0.3), V(0.64, 0.95), V(0.64, 1.45), V(0.58, 1.95), V(0.46, 2.32)], 48), hull), M);
  outline(add(body, new THREE.LatheGeometry([V(0.46, 2.32), V(0.36, 2.6), V(0.22, 2.84), V(0.08, 2.99), V(0, 3.02)], 48), trim), M);
  const band = add(body, new THREE.TorusGeometry(0.645, 0.05, 10, 48), accent, 0, 0.62, 0);
  band.rotation.x = Math.PI / 2;
  // the porthole: dark glass in a gold rim, with one small highlight so it reads as a window
  const port = new THREE.Group();
  port.position.set(0, 1.62, 0.6);
  port.rotation.x = -0.08;
  body.add(port);
  const pane = add(port, new THREE.SphereGeometry(0.25, 24, 16), glass, 0, 0, 0.0, { cast: false });
  pane.scale.set(1, 1, 0.45);
  add(port, new THREE.TorusGeometry(0.27, 0.055, 10, 36), trim, 0, 0, 0.02);
  add(port, new THREE.SphereGeometry(0.055, 10, 8), M.clay(C("approach"), { roughness: 0.5 }), -0.09, 0.09, 0.1, { cast: false });
  // the nozzle
  outline(add(body, new THREE.CylinderGeometry(0.32, 0.42, 0.3, 32), dark, 0, -0.1, 0), M);
  // three big splayed fins (two read left and right from the front, one behind)
  const fin = new THREE.Shape();
  fin.moveTo(0, 1.0); fin.quadraticCurveTo(0.62, 0.62, 0.9, -0.1); fin.lineTo(0.92, -0.5); fin.quadraticCurveTo(0.6, -0.3, 0.3, -0.18); fin.lineTo(0, -0.04); fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 10 });
  finGeo.translate(0, 0, -0.045);
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3 - Math.PI / 2, f = add(body, finGeo, accent, Math.cos(a) * 0.5, 0.06, Math.sin(a) * 0.5);
    f.rotation.y = -a;
    outline(f, M);
  }

  // the flame: two additive layers hanging from the nozzle, plus comet sparks for that trail
  const [or, og, ob] = flame.outer, [ir, ig, ib] = flame.inner;
  const outer = M.additive(or, og, ob, 0.9), inner = M.additive(ir, ig, ib, 0.95);
  // front faces only: a double-sided flame stacks four layers and crosses the bloom threshold
  outer.side = inner.side = THREE.FrontSide;
  outer.alphaMap = inner.alphaMap = flameFade;
  const flameOut = add(body, flameGeo(0.3 * flame.width, 1.35 * flame.length), outer, 0, -0.24, 0, { cast: false, recv: false });
  const flameIn = add(body, flameGeo(0.15 * flame.width, 0.8 * flame.length), inner, 0, -0.22, 0, { cast: false, recv: false });
  flameOut.renderOrder = flameIn.renderOrder = 3;
  const sparks: THREE.Mesh[] = [];
  const sparkMat = M.additive(ir, ig, ib, 0.9);
  if (flame.sparks) for (let i = 0; i < 5; i++) {
    const s = add(body, new THREE.SphereGeometry(0.05 - i * 0.006, 8, 6), sparkMat, 0, -0.6, 0, { cast: false, recv: false });
    sparks.push(s);
  }

  /** The tip of the nose: anchor the cadet's typed number here (see `noseWorld`). Rides with recoil. */
  const nose = new THREE.Object3D();
  nose.position.set(0, NOSE_Y + 0.08, 0);
  rocket.add(nose);
  let power = 1;
  return {
    group: rocket,
    /** The model inside `group` (recoil moves this, never the group). */
    body,
    /** The two flame materials (additive): scenes may dim them further, never brighten them past the threshold. */
    flames: [outer, inner] as const,
    /** An empty at the nose tip, a child of `group`. */
    nose,
    /** The nose tip in world space (for the number readout above the cannon). */
    noseWorld: (out = new THREE.Vector3()) => nose.getWorldPosition(out),
    /** Where shots leave from, in world space. */
    muzzle: () => rocket.localToWorld(new THREE.Vector3(0, 1.6, 0)),
    /** Recoil, 0 (rest) to 1 (full kick): the body squashes and slides back along its axis. Drive it with an envelope. */
    recoil(k: number) {
      const q = Math.max(0, Math.min(1, k));
      body.position.y = BODY_Y - q * 0.22;
      body.scale.set(1 + q * 0.06, 1 - q * 0.09, 1 + q * 0.06);
    },
    flicker(T: number, p = 1) {
      power = p;
      const f = (1 + Math.sin(T * 38) * 0.07 + Math.sin(T * 23.3) * 0.05) * p, w = Math.min(1.5, 0.65 + p * 0.35);
      flameOut.scale.set(w, Math.max(0.01, f), w);
      flameIn.scale.set(w, Math.max(0.01, f * 1.04), w);
      flameOut.visible = flameIn.visible = p > 0.02;
      sparks.forEach((s, i) => {
        const k = ((T * 1.6 + i / sparks.length) % 1);
        s.position.set(Math.sin(i * 2.4 + T * 3) * 0.08 * k, -0.4 - k * 1.7 * flame.length * Math.max(0.4, power), Math.cos(i * 1.7 + T * 2) * 0.08 * k);
        s.scale.setScalar(Math.max(0.01, 1 - k));
        s.visible = power > 0.02;
      });
    },
  };
}

// ---- invaders ----
const bodyGeo = (() => { const g = new THREE.SphereGeometry(0.5, 32, 18); g.scale(1.08, 0.78, 0.9); return g; })();
// the visor: a goggle wrapped round the front of the body, a hair proud of it
const visorGeo = (() => { const g = new THREE.SphereGeometry(0.515, 32, 10, Math.PI / 2 - 0.88, 1.76, 0.72, 0.58); g.scale(1.08, 0.78, 0.9); return g; })();
const rimGeo = (() => { const g = new THREE.TorusGeometry(0.5, 0.062, 10, 40); g.rotateX(Math.PI / 2); g.scale(1.04, 1, 0.88); return g; })();
const eyeGeo = (() => { const g = new THREE.SphereGeometry(0.09, 14, 10); g.scale(0.9, 1.15, 0.5); return g; })();
const footGeo = new THREE.SphereGeometry(0.09, 12, 8);
const stalkGeo = new THREE.CylinderGeometry(0.022, 0.026, 1, 8);
const knobGeo = new THREE.SphereGeometry(0.065, 12, 8);
const pennantGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.3, -0.09); s.lineTo(0, -0.2); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: false });
  g.translate(0.02, 0, -0.0175);
  return g;
})();

/** The antenna: a short stalk and knob, or for a leader a taller stalk with a gold pennant and knob. */
function antenna(M: Materials, parent: THREE.Object3D, leader: boolean, top: number, scale = 1) {
  const h = (leader ? 0.36 : 0.16) * scale, nc = { cast: false };
  const stalk = add(parent, stalkGeo, M.clay(leader ? INVADER.crest : INVADER.shade), 0, top + h / 2, 0, nc);
  stalk.scale.set(scale, h, scale);
  const knob = add(parent, knobGeo, M.clay(leader ? INVADER.crest : INVADER.shade, { roughness: 0.6 }), 0, top + h, 0, nc);
  knob.scale.setScalar(scale);
  if (leader) {
    const flag = add(parent, pennantGeo, M.clay(INVADER.crest, { roughness: 0.6 }), 0, top + h - 0.02 * scale, 0, nc);
    flag.scale.setScalar(scale);
    outline(flag, M);
  }
}

/**
 * One invader drone: a chubby ember bun with a saucer rim, a dark goggle visor, two light eyes,
 * stubby feet and an antenna. Front is +z. About 1.1 wide and 0.8 tall (plus its antenna).
 * `opts.tone` picks the squad tone, `opts.leader` adds the gold pennant.
 */
export function makeInvader(M: Materials, opts: DroneOpts = {}) {
  const g = new THREE.Group(), nc = { cast: false };
  const tone = INVADER[opts.tone ?? "ember"];
  outline(add(g, bodyGeo, M.clay(tone, { roughness: 0.78 }), 0, 0, 0, nc), M);
  add(g, rimGeo, M.clay(INVADER.shade, { roughness: 0.8 }), 0, -0.06, 0, nc);
  add(g, visorGeo, M.clay(INVADER.visor, { roughness: 0.42 }), 0, 0, 0, nc);
  const eye = M.clay(INVADER.eye, { roughness: 0.6 });
  for (const s of [-1, 1]) add(g, eyeGeo, eye, s * 0.14, 0.2, 0.375, nc);
  for (const s of [-1, 1]) add(g, footGeo, M.clay(INVADER.shade, { roughness: 0.8 }), s * 0.22, -0.36, 0.02, nc);
  antenna(M, g, !!opts.leader, 0.37);
  g.userData.leader = !!opts.leader;
  return g;
}

/**
 * The cheap fighter for very large fleets (over ~140 ships): the same silhouette and colours in
 * three draws (body with its outline, visor), plus the pennant for a leader. Same options.
 */
export function makeFighterLite(M: Materials, opts: DroneOpts = {}) {
  const g = new THREE.Group(), nc = { cast: false };
  outline(add(g, bodyGeo, M.clay(INVADER[opts.tone ?? "ember"], { roughness: 0.78 }), 0, 0, 0, nc), M);
  add(g, visorGeo, M.clay(INVADER.visor, { roughness: 0.42 }), 0, 0, 0, nc);
  if (opts.leader) antenna(M, g, true, 0.37);
  g.userData.leader = !!opts.leader;
  return g;
}

// ---- hull numbers ----
const emblems = new Map<string, THREE.MeshBasicMaterial>();
/**
 * A crisp hull number ("10", "100", "1K"): a token-coloured plate with the number in Saira, drawn
 * once per label (and redrawn when the font arrives). `colors`: [plate, ink].
 */
export function emblem(text: string, w = 0.42, h = 0.24, colors: [string, string] = [COLOR.approach, COLOR.void]) {
  const key = text + colors.join() + w / h;
  if (!emblems.has(key)) {
    const W = 256, H = Math.round(Math.max(96, Math.min(256, (256 * h) / w)));
    const { texture, ctx } = canvasTexture(W, H);
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = colors[0];
      ctx.beginPath(); ctx.roundRect(4, 4, W - 8, H - 8, (H - 8) / 2); ctx.fill();
      ctx.fillStyle = colors[1];
      if ("fontStretch" in ctx) (ctx as CanvasRenderingContext2D & { fontStretch: string }).fontStretch = "semi-expanded";
      fitText(ctx, text, W / 2, H / 2 + H * 0.03, W * 0.8, H * 0.74, "600", `${TYPE.family}, sans-serif`);
      texture.needsUpdate = true;
    };
    draw();
    if (typeof document !== "undefined" && document.fonts) void document.fonts.load("600 64px Saira").then(draw, () => {});
    emblems.set(key, new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), emblems.get(key)!);
  m.renderOrder = 2;
  return m;
}

// ---- pods and big ships ----
/** A rounded slab (the trays of pods and carriers), centred, front face at +depth/2. */
function slab(w: number, h: number, depth: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}
/** Where an "h" layout point lands when the frame is stood up ("v": turned a quarter clockwise, so reading order runs top-down). */
const stand = (orient: "h" | "v", x: number, y: number) => (orient === "v" ? new THREE.Vector3(y, -x, 0) : new THREE.Vector3(x, y, 0));
const TRAY = { w: 2.28, h: 0.84, d: 0.16 };
const microBody = (() => { const g = new THREE.SphereGeometry(0.135, 16, 10); g.scale(1.08, 0.8, 0.85); return g; })();
const microVisor = (() => { const g = new THREE.SphereGeometry(0.14, 16, 6, Math.PI / 2 - 0.9, 1.8, 0.7, 0.6); g.scale(1.08, 0.8, 0.85); return g; })();
const socketGeo = new THREE.CircleGeometry(0.15, 24);

/**
 * A gold pennant on a stalk at (x, y) of a big ship (pods, carriers, flagships). Only for "h" ships:
 * a stood-up ship spans ten squads, so it has no single squad to lead.
 */
function leaderCrest(M: Materials, g: THREE.Object3D, x: number, y: number) {
  const crest = new THREE.Group();
  crest.position.set(x, y, 0);
  antenna(M, crest, true, 0, 0.9);
  g.add(crest);
}

function microFighter(M: Materials, tone: InvaderTone) {
  const g = new THREE.Group(), nc = { cast: false };
  add(g, microBody, M.clay(INVADER[tone], { roughness: 0.78 }), 0, 0, 0, nc);
  add(g, microVisor, M.clay(INVADER.visor, { roughness: 0.42 }), 0, 0, 0, nc);
  return g;
}

/**
 * The 10 Squadron Pod: a dark tray holding ten mini fighters in two rows of five (a ten-frame),
 * with a "10" plate at its head. Each mini fighter pops on its own and leaves an empty dark
 * socket, so a partial hit shows exactly how many fell and how many are left.
 * "v" stands the pod up (the tens come from the squads, as in 10 × 4): the "10" goes on top.
 * `micro` is in reading order (row by row, left to right; top to bottom when stood up).
 * Options: `tone` for the mini fighters, `leader` adds a gold pennant at the pod's head ("h" only).
 */
export function makeTenSquadPod(M: Materials, orient: "h" | "v" = "h", opts: DroneOpts = {}) {
  const g = new THREE.Group(), frame = new THREE.Group(), nc = { cast: false };
  g.add(frame);
  if (orient === "v") frame.rotation.z = -Math.PI / 2;
  outline(add(frame, slab(TRAY.w, TRAY.h, TRAY.d, 0.3), M.clay(INVADER.hull, { roughness: 0.85 }), 0, 0, -0.06, nc), M);
  const socket = M.clay(C("void"), { roughness: 0.9 });
  const micro: THREE.Group[] = [];
  for (let row = 0; row < 2; row++) for (let c = 0; c < 5; c++) {
    const x = -0.44 + c * 0.335, y = row === 0 ? 0.19 : -0.19;
    add(frame, socketGeo, socket, x, y, 0.05, nc);
    const m = microFighter(M, opts.tone ?? "ember");
    m.position.set(x, y, 0.13);
    if (orient === "v") m.rotation.z = Math.PI / 2; // stood up, the mini fighters still stand upright
    frame.add(m);
    micro.push(m);
  }
  const tag = emblem("10", 0.42, 0.26);
  tag.position.copy(stand(orient, -0.86, 0)).setZ(0.12);
  g.add(tag);
  if (opts.leader && orient === "h") leaderCrest(M, g, -0.86, TRAY.h / 2 - 0.02);
  return { group: g, micro, tag };
}

/**
 * The 100 Carrier: a dark tray with a "100" plate at its head and a hundred-square of matte cells,
 * ten strips of ten with a gap between strips, so it reads as ten tens.
 * `popped(n)` hides the first `n` cells: whole strips first, then cells of the next strip.
 */
export function makeCarrier(M: Materials, orient: "h" | "v" = "h", opts: DroneOpts = {}) {
  const g = new THREE.Group(), frame = new THREE.Group(), nc = { cast: false };
  g.add(frame);
  if (orient === "v") frame.rotation.z = -Math.PI / 2;
  outline(add(frame, slab(TRAY.w, TRAY.h, TRAY.d, 0.18), M.clay(INVADER.hull, { roughness: 0.85 }), 0, 0, -0.06, nc), M);
  // ten dark strip wells, then the cells
  const well = M.clay(C("void"), { roughness: 0.9 });
  for (let s = 0; s < 10; s++) add(frame, new THREE.PlaneGeometry(0.13, 0.72), well, -0.43 + s * 0.152, 0, 0.05, nc);
  const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.055, 0.05), M.clay(INVADER[opts.tone ?? "ember"], { roughness: 0.75 }), 100);
  cells.castShadow = false;
  const o = new THREE.Object3D();
  for (let s = 0; s < 10; s++) for (let c = 0; c < 10; c++) {
    o.position.set(-0.43 + s * 0.152, 0.3015 - c * 0.067, 0.08);
    o.updateMatrix();
    cells.setMatrixAt(s * 10 + c, o.matrix);
  }
  frame.add(cells);
  const tag = emblem("100", 0.46, 0.26);
  tag.position.copy(stand(orient, -0.84, 0)).setZ(0.12);
  g.add(tag);
  if (opts.leader && orient === "h") leaderCrest(M, g, -0.84, TRAY.h / 2 - 0.02);
  const base = Array.from({ length: 100 }, (_, i) => { const m = new THREE.Matrix4(); cells.getMatrixAt(i, m); return m; });
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  /** Hide the first `n` cells (a partial hit). */
  const popped = (n: number) => { for (let i = 0; i < 100; i++) cells.setMatrixAt(i, i < n ? zero : base[i]); cells.instanceMatrix.needsUpdate = true; };
  return { group: g, cells, popped, tag };
}

/**
 * The 1,000+ Flagship: a big drone of the same family (ember body, dark visor, light eyes) with
 * gold fins, its worth on a plate (1K, 10K, 1M…) and a damage meter of ten light segments on its
 * belly. `damaged(f)` switches off the first `round(f × 10)` segments (tenths of the ship).
 */
export function makeDreadnought(M: Materials, label: string, orient: "h" | "v" = "h", opts: DroneOpts = {}) {
  const g = new THREE.Group(), frame = new THREE.Group(), nc = { cast: false };
  g.add(frame);
  if (orient === "v") frame.rotation.z = -Math.PI / 2;
  const hullGeo = new THREE.CapsuleGeometry(0.38, 1.46, 8, 28);
  hullGeo.rotateZ(Math.PI / 2);
  hullGeo.scale(1, 1, 0.62);
  outline(add(frame, hullGeo, M.clay(INVADER[opts.tone ?? "ember"], { roughness: 0.78 }), 0, 0, -0.04, nc), M);
  // fins: two gold swept fins on the back
  const fin = new THREE.Shape();
  fin.moveTo(0, 0); fin.lineTo(0.34, 0); fin.lineTo(0.5, 0.2); fin.lineTo(0.16, 0.12); fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.05, bevelEnabled: false });
  for (const x of [0.2, 0.62]) outline(add(frame, finGeo, M.clay(INVADER.crest, { roughness: 0.7 }), x, 0.3, -0.05, nc), M);
  // the face: a long visor with two big eyes, at the head (left)
  const visor = new THREE.CapsuleGeometry(0.13, 0.62, 6, 16);
  visor.rotateZ(Math.PI / 2);
  visor.scale(1, 1, 0.5);
  add(frame, visor, M.clay(INVADER.visor, { roughness: 0.42 }), -0.48, 0.08, 0.2, nc);
  for (const x of [-0.68, -0.3]) add(frame, eyeGeo, M.clay(INVADER.eye, { roughness: 0.6 }), x, 0.09, 0.27, nc).scale.setScalar(1.25);
  // the damage meter: ten segments on a dark strip
  add(frame, new THREE.BoxGeometry(1.62, 0.12, 0.04), M.clay(INVADER.visor, { roughness: 0.8 }), 0, -0.2, 0.2, nc);
  const seg = M.clay(INVADER.eye, { roughness: 0.6 }), segGeo = new THREE.BoxGeometry(0.12, 0.07, 0.04);
  const segs: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) segs.push(add(frame, segGeo, seg, -0.72 + i * 0.16, -0.2, 0.225, nc));
  const tag = emblem(label, 0.5, 0.28, [COLOR.gold, COLOR.void]);
  tag.position.copy(stand(orient, 0.62, 0.08)).setZ(0.26);
  g.add(tag);
  if (opts.leader && orient === "h") leaderCrest(M, g, -0.95, 0.3);
  /** Show a partial hit as tenths of the hull's meter. */
  const damaged = (fraction: number) => segs.forEach((s, i) => { s.visible = i >= Math.round(fraction * 10); });
  return { group: g, damaged, tag };
}

/** The look of every ghost (borrowed, pretend) ship: a dashed approach-white hairline over a faint fill. */
export const GHOST = { color: C("approach"), line: 0.9, fill: 0.035, dash: 0.08, gap: 0.06 } as const;

/**
 * A dashed ghost fighter (Borrow & Take Back): the drone's front silhouette as a dashed hairline,
 * clearly a pretend ship, never a real one. Flat, facing +z (keep it upright like the fighters).
 */
export function makeGhost() {
  const s = new THREE.Shape();
  s.absellipse(0, 0, 0.56, 0.4, 0, Math.PI * 2, false, 0);
  const pts = s.getPoints(48).map((p) => new THREE.Vector3(p.x, p.y, 0));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: GHOST.color, dashSize: GHOST.dash, gapSize: GHOST.gap, transparent: true, opacity: GHOST.line }));
  line.computeLineDistances();
  const stalk = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.4, 0), new THREE.Vector3(0, 0.56, 0)]), line.material);
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(s, 24), new THREE.MeshBasicMaterial({ color: GHOST.color, transparent: true, opacity: GHOST.fill, depthWrite: false }));
  const visor = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 17 }, (_, i) => { const a = Math.PI * (0.22 + (i / 16) * 0.56); return new THREE.Vector3(Math.cos(a) * 0.46, 0.02 + Math.sin(a) * 0.3 - 0.06, 0); })), line.material);
  const g = new THREE.Group();
  g.add(fill, line, stalk, visor);
  return g;
}
