import * as THREE from "three";
import { Materials } from "@/engine/materials";
import { LOOKS, lookLights } from "@/worlds/looks";
import { shipSpriteBox, type ShipKind } from "@/teach/shipKinds";
import { makeInvader, makePlasmaBall, makeRocket, makeTenSquadPod, type InvaderTone, type RocketStyle } from "@/worlds/space/ships";

/**
 * Ship sprites for 2D screens (the Field Manual's pictures, cards, the review routes): each ship is
 * built by the same builders the battle uses (src/worlds/space/ships.ts), rendered once in the space
 * look, front on, into a cached transparent PNG. So the drone in the manual is the drone in the battle.
 *
 *   const url = await shipSprite("invader", 32, { tone: "apricot" });   // a data URL, 32 CSS px square
 *
 * Unlike the planet sprites, the WebGL renderer is not kept: it is made for a batch of bakes and
 * disposed (and its context released) as soon as the queue is empty, so no context stays open.
 */
export { SHIP_KINDS, SHIP_ALT, shipSpriteBox, type ShipKind } from "@/teach/shipKinds";

export interface ShipSpriteOpts {
  /** The squad tone of a drone, a leader or a pod's mini fighters. */
  tone?: InvaderTone;
  /** The rocket's paint and trail (Hangar ids). */
  style?: RocketStyle;
  /** The blaster id for a plasma ball. */
  blaster?: string;
}

const cache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();
let pending = 0;
let kit: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; mats: Materials } | null = null;

function setup() {
  if (kit) return kit;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
  const look = LOOKS.space;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = look.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  // the battle's light: gold key from the upper left and in front, the sky rim from behind on the right
  scene.add(lookLights(look, { keyFrom: new THREE.Vector3(-4, 5, 6), rimFrom: new THREE.Vector3(6, 1.2, -4) }).group);
  const camera = new THREE.PerspectiveCamera(18, 1, 0.1, 200);
  kit = { renderer, scene, camera, mats: new Materials() };
  return kit;
}

/** Drop the renderer and release its WebGL context (the shared ship geometry is the builders' and stays). */
function teardown() {
  if (!kit) return;
  kit.mats.dispose();
  kit.renderer.dispose();
  kit.renderer.forceContextLoss();
  kit = null;
}

/** A picture of a ship, `sizePx` CSS pixels wide, as a data URL (cached per kind, options, size and pixel ratio). */
export function shipSprite(kind: ShipKind, sizePx: number, opts: ShipSpriteOpts = {}): Promise<string> {
  const dpr = typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1);
  const px = Math.max(8, Math.round(sizePx * dpr));
  const key = `${kind}:${opts.tone ?? ""}:${opts.style?.hull ?? ""}:${opts.blaster ?? ""}:${px}`;
  let p = cache.get(key);
  if (!p) {
    pending++;
    p = queue.then(() => render(kind, px, opts));
    const settle = () => { if (--pending === 0) teardown(); };
    queue = p.then(settle, settle);
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

function build(kind: ShipKind, M: Materials, opts: ShipSpriteOpts): THREE.Object3D {
  switch (kind) {
    case "rocket": {
      const r = makeRocket(M, opts.style);
      r.flicker(0, 0); // no flame on a still picture: it is an additive layer that would print as a smear
      return r.group;
    }
    case "invader": return makeInvader(M, { tone: opts.tone });
    case "leader": return makeInvader(M, { tone: opts.tone, leader: true });
    case "pod": return makeTenSquadPod(M, "h", { tone: opts.tone }).group;
    case "ball": return makePlasmaBall(M, opts.blaster, 1);
  }
}

async function render(kind: ShipKind, px: number, opts: ShipSpriteOpts): Promise<string> {
  // the pod's "10" plate is drawn in Saira
  if (kind === "pod" && typeof document !== "undefined") await document.fonts?.load("400 16px Saira").catch(() => {});
  const { renderer, scene, camera, mats } = setup();
  const obj = build(kind, mats, opts);
  const holder = new THREE.Group();
  holder.add(obj);
  scene.add(holder);
  // front on, a little from above, as the battle camera sees a fleet
  const { w, h } = shipSpriteBox(kind, px);
  const box = new THREE.Box3().setFromObject(holder), size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
  obj.position.sub(centre);
  const aspect = w / h, margin = 1.1;
  const halfH = Math.max(size.y / 2, size.x / 2 / aspect) * margin;
  const dist = halfH / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) + size.z / 2;
  camera.aspect = aspect;
  camera.position.set(0, dist * 0.1, dist);
  camera.lookAt(0, 0, 0);
  camera.near = dist * 0.2;
  camera.far = dist * 4;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");
  scene.remove(holder);
  return url;
}
