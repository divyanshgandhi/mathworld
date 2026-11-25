import * as THREE from "three";
import { Materials } from "@/engine/materials";
import { LOOKS, lookLights } from "@/worlds/looks";
import { BODY_NAME, makeBody, type BodyId } from "@/worlds/space/planets";
import { SPRITE_EXTENT, SPRITE_MARGIN } from "@/worlds/space/bodies";
import { clearSpriteCache, fingerprint, getSprite, HIGH_LOD_PX, preloadSprites } from "@/components/world/spriteStore";

/**
 * Planet sprites for the 2D screens: each body rendered once by the same planet factory the 3D scenes use,
 * in the space look (gold key from the upper left, the cool rim on the right), into a transparent PNG.
 * So the Earth on a 2D card is the Earth in the battle.
 *
 *   const url = await planetSprite("earth", 96);   // an image URL, sized 96 CSS px (drawn at the device pixel ratio)
 *
 * The image is square. The body fills it, except Saturn and Uranus, which leave room for their rings
 * (see `spriteDisc` in bodies.ts). Sprites are kept in memory for the session and in Cache Storage across
 * visits (see src/components/world/spriteStore.ts, which needs no three.js). One offscreen WebGL renderer
 * serves every sprite, one at a time; a body's maps are painted before it joins that queue, so a large
 * sprite waiting for its sharp maps never holds up the small ones behind it.
 */

/** Which longitude faces the viewer (degrees east): Africa for Earth, the near side for the Moon. */
const FACE: Partial<Record<BodyId, number>> = { earth: 18, moon: 0, mars: -60, jupiter: 40 };

/** Everything about the sprite camera and light that changes the picture: a change purges stored sprites. */
const LOOK_PRINT = fingerprint(JSON.stringify({ look: LOOKS.space, face: FACE, extent: SPRITE_EXTENT, margin: SPRITE_MARGIN }));
const PRINT_KEY = "mw:sprites:look";
function checkLook() {
  try {
    if (localStorage.getItem(PRINT_KEY) === LOOK_PRINT) return;
    void clearSpriteCache();
    localStorage.setItem(PRINT_KEY, LOOK_PRINT);
  } catch { /* storage blocked: the cache is blocked too */ }
}

let kit: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; mats: Materials } | null = null;
function setup() {
  if (kit) return kit;
  checkLook();
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

let queue: Promise<unknown> = Promise.resolve();
/** Run `job` after every render queued before it (one WebGL renderer, one picture at a time). */
function inTurn<T>(job: () => Promise<T>): Promise<T> {
  const p = queue.then(job);
  queue = p.catch(() => {});
  return p;
}

/** A rendered picture of a body, `sizePx` CSS pixels square (memory, then Cache Storage, then a fresh render). */
export function planetSprite(id: BodyId, sizePx: number): Promise<string> {
  return getSprite(id, sizePx);
}
export { preloadSprites };

/** A PNG data URL as a Blob (synchronously), or the URL itself where Blob is missing. */
function pngBlob(url: string): Blob | string {
  if (typeof Blob === "undefined" || typeof atob === "undefined") return url;
  const bin = atob(url.slice(url.indexOf(",") + 1)), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}

/** The alt text for a body's sprite. */
export const planetSpriteAlt = (id: BodyId) => BODY_NAME[id];

/**
 * Render one sprite at `px` device pixels: a PNG blob (or a data URL where canvas blobs are missing).
 * Called by the sprite store on a miss; screens should call `planetSprite` or `getSprite` instead.
 */
export async function renderSprite(id: BodyId, px: number): Promise<Blob | string> {
  const { mats } = setup();
  const body = makeBody(mats, id, 1, { lod: px > HIGH_LOD_PX ? "high" : "low", clouds: true, halo: true });
  await body.sharp; // painted outside the queue
  return inTurn(async () => {
    const { renderer, scene, camera } = setup();
    const face = FACE[id] ?? 30;
    // bring longitude `face` round to the camera (+z): see planetMaps' frame (lon -90 faces +z)
    body.spin.rotation.y = THREE.MathUtils.degToRad(-90 - face);
    if (id === "saturn" || id === "uranus") body.group.rotation.x = 0.32; // tip the rings toward the viewer
    scene.add(body.group);
    // frame: the body (with its rings) fills the square with a small margin
    const extent = (SPRITE_EXTENT[id] ?? 1) * SPRITE_MARGIN, dist = extent / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, 0, dist);
    camera.near = dist * 0.3;
    camera.far = dist * 3;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(1);
    renderer.setSize(px, px, false);
    renderer.render(scene, camera);
    // toDataURL is synchronous: canvas.toBlob's callback is a task the browser may hold back in a background tab
    const out = pngBlob(renderer.domElement.toDataURL("image/png"));
    scene.remove(body.group);
    // geometry and materials are this sprite's own; the textures are the factory's, shared, and stay
    body.group.traverse((o) => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
      else if (o instanceof THREE.Sprite) o.material.dispose(); // sprites share one geometry: leave it
    });
    return out;
  });
}
