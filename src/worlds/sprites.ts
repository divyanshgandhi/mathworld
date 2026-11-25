import * as THREE from "three";
import { Materials } from "@/engine/materials";
import { LOOKS, lookLights } from "@/worlds/looks";
import { BODY_NAME, makeBody, type BodyId } from "@/worlds/space/planets";

/**
 * Planet sprites for the 2D screens: each body rendered once by the same planet factory the 3D scenes use,
 * in the space look (gold key from the upper left, the cool rim on the right), into a cached transparent
 * PNG. So the Earth on a 2D card is the Earth in the battle.
 *
 *   const url = await planetSprite("earth", 96);   // a data URL, sized 96 CSS px (drawn at the device pixel ratio)
 *
 * The image is square. The body fills it, except Saturn and Uranus, which leave room for their rings.
 * One offscreen WebGL renderer serves every sprite, one at a time.
 */

/** How much of the square the body's radius takes: ringed bodies shrink to fit their rings. */
const EXTENT: Partial<Record<BodyId, number>> = { saturn: 2.25, uranus: 2.05, "asteroid-belt": 1.25, sun: 1.25 };
/** Which longitude faces the viewer (degrees east): Africa for Earth, the near side for the Moon. */
const FACE: Partial<Record<BodyId, number>> = { earth: 18, moon: 0, mars: -60, jupiter: 40 };

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
  // gold from the upper left and in front; the sky rim from behind on the right
  const lights = lookLights(look, { keyFrom: new THREE.Vector3(-5, 4.2, 4.6), rimFrom: new THREE.Vector3(6, 0.8, -3.5) });
  scene.add(lights.group);
  const camera = new THREE.PerspectiveCamera(16, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  kit = { renderer, scene, camera, mats: new Materials() };
  return kit;
}

const cache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

/** A rendered picture of a body, `sizePx` CSS pixels square, as a data URL (cached per body, size and pixel ratio). */
export function planetSprite(id: BodyId, sizePx: number): Promise<string> {
  const dpr = typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1);
  const px = Math.max(8, Math.round(sizePx * dpr)), key = `${id}:${px}`;
  let p = cache.get(key);
  if (!p) {
    p = queue.then(() => render(id, px));
    queue = p.catch(() => {});
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

/** The alt text for a body's sprite. */
export const planetSpriteAlt = (id: BodyId) => BODY_NAME[id];

async function render(id: BodyId, px: number): Promise<string> {
  const { renderer, scene, camera, mats } = setup();
  const body = makeBody(mats, id, 1, { lod: px > 240 ? "high" : "low", clouds: true, halo: true });
  await body.sharp;
  const face = FACE[id] ?? 30;
  // bring longitude `face` round to the camera (+z): see planetMaps' frame (lon -90 faces +z)
  body.spin.rotation.y = THREE.MathUtils.degToRad(-90 - face);
  if (id === "saturn" || id === "uranus") body.group.rotation.x = 0.32; // tip the rings toward the viewer
  scene.add(body.group);
  // frame: the body (with its rings) fills the square with a small margin
  const extent = (EXTENT[id] ?? 1) * 1.04, dist = extent / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.set(0, 0, dist);
  camera.near = dist * 0.3;
  camera.far = dist * 3;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(1);
  renderer.setSize(px, px, false);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");
  scene.remove(body.group);
  // geometry and materials are this sprite's own; the textures are the factory's, shared, and stay
  body.group.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
  return url;
}
