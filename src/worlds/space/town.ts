import * as THREE from "three";
import { COLOR, TYPE, hex } from "@/design/tokens";
import { add, canvasTexture, prism, type Materials } from "@/engine/materials";
import type { Rng } from "@/engine/util";
import { LOOKS, type Look } from "@/worlds/looks";
import { mix } from "./cast";

/**
 * The materials of the town. Grass, brick and bark have no role in the UI tokens, so their colours
 * are declared once here, muted to sit under the gold morning light; everything with a role (the
 * sign, the bus, the flag, the sky) is mixed from the tokens.
 */
const SET = { grass: 0x76956a, hill: 0x6d8c66, leaf: [0x5f8a58, 0x6e9a62, 0x537c50], bark: 0x7a6048, brick: 0xa86a52, stone: 0xd8cdb8, path: 0xc4b9a6, road: 0x5b5e68 };

/** Text centred in a box in the game's typeface, shrunk until it fits. */
function fit(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxW: number, maxPx: number, weight = 400) {
  let px = maxPx;
  do { ctx.font = `${weight} ${px}px "${TYPE.family}", sans-serif`; px -= 2; } while (ctx.measureText(text).width > maxW && px > 8);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy);
}

/** The town around Maple Hill School on a gold morning: the school faces +z, the road runs along z = 16. */
export function buildTown(scene: THREE.Scene, M: Materials, rnd: Rng, at: THREE.Vector3, look: Look = LOOKS.interior) {
  const town = new THREE.Group();
  town.position.copy(at);
  scene.add(town);
  const noCast = { cast: false }, off = { cast: false, recv: false };
  const matte = (c: number, roughness = 0.92) => M.clay(c, { roughness });

  const flat = (w: number, h: number, mat: THREE.Material, x: number, y: number, z: number) =>
    (add(town, new THREE.PlaneGeometry(w, h), mat, x, y, z, noCast).rotation.x = -Math.PI / 2);
  flat(700, 700, matte(SET.grass, 0.95), 0, 0, 0);
  // each layer sits clear of the one under it, so none of them fight at a distance
  flat(700, 8, matte(SET.road), 0, 0.05, 16);
  for (let x = -120; x <= 120; x += 7) flat(3, 0.3, matte(hex(COLOR.approach)), x, 0.1, 16);
  flat(4, 7, matte(SET.path), 0, 0.06, 8.6);

  const brick = matte(SET.brick, 0.9), cream = matte(SET.stone, 0.85), roof = matte(mix(COLOR.horizon, COLOR.disk, 0.4), 0.8);
  const frame = matte(mix(COLOR.approach, SET.stone, 0.4)), glass = matte(mix(COLOR.sky, COLOR.shadow, 0.35), 0.5);

  // the school
  add(town, new THREE.BoxGeometry(16, 6, 8), brick, 0, 3, 0);
  add(town, prism(17, 3, 9), roof, 0, 6, 0);
  add(town, new THREE.BoxGeometry(5, 4.5, 2), cream, 0, 2.25, 4.9);
  add(town, prism(5.6, 1.4, 2.3), roof, 0, 4.5, 4.9);
  add(town, new THREE.BoxGeometry(1.8, 2.6, 0.1), matte(mix(COLOR.disk, COLOR.horizon, 0.45)), 0, 1.3, 5.92);
  for (const s of [-1, 1]) add(town, new THREE.CylinderGeometry(0.22, 0.22, 4.4, 16), frame, s * 2.1, 2.2, 6.0);
  for (let i = 0; i < 3; i++) add(town, new THREE.BoxGeometry(4.2 - i * 0.4, 0.18, 0.6), cream, 0, 0.09 + i * 0.18, 6.4 - i * 0.3);
  for (const y of [1.8, 4.3]) for (const x of [-7, -5.2, -3.4, 3.4, 5.2, 7]) {
    add(town, new THREE.BoxGeometry(1.3, 1.5, 0.1), frame, x, y, 4.03);
    add(town, new THREE.BoxGeometry(1.1, 1.3, 0.1), glass, x, y, 4.07, noCast);
  }
  // the name plaque sits between the porch columns (inner edges at ±1.88 m) so nothing covers it
  const sign = canvasTexture(1024, 176), dial = canvasTexture(256, 256);
  const paint = () => {
    let x = sign.ctx;
    x.fillStyle = COLOR.shadow; x.fillRect(0, 0, 1024, 176);
    x.strokeStyle = COLOR.gold; x.lineWidth = 4; x.strokeRect(14, 14, 996, 148);
    x.fillStyle = COLOR.approach;
    if ("letterSpacing" in x) (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "10px";
    fit(x, "MAPLE HILL SCHOOL", 517, 92, 880, 92, 300);
    sign.texture.needsUpdate = true;
    // the clock tower reads 8:42, an ordinary school morning
    x = dial.ctx;
    x.fillStyle = COLOR.approach; x.beginPath(); x.arc(128, 128, 124, 0, 7); x.fill();
    x.strokeStyle = COLOR.shadow; x.lineWidth = 6; x.stroke();
    x.fillStyle = COLOR.shadow;
    for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; fit(x, String(i), 128 + Math.sin(a) * 96, 130 - Math.cos(a) * 96, 40, 30, 500); }
    const hand = (a: number, len: number, w: number) => { x.lineWidth = w; x.lineCap = "round"; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len); x.stroke(); };
    hand(((8 + 42 / 60) / 12) * Math.PI * 2, 58, 10);
    hand((42 / 60) * Math.PI * 2, 86, 6);
    dial.texture.needsUpdate = true;
  };
  paint();
  if (typeof document !== "undefined") void document.fonts.load(`400 16px ${TYPE.family}`).then(paint);
  add(town, new THREE.BoxGeometry(3.5, 0.62, 0.06), matte(mix(COLOR.shadow, COLOR.void, 0.4)), 0, 3.78, 5.92);
  add(town, new THREE.PlaneGeometry(3.4, 0.584), M.clay(0xffffff, { map: sign.texture, roughness: 0.6 }), 0, 3.78, 5.955, noCast);
  add(town, new THREE.BoxGeometry(2.6, 4, 2.6), cream, 0, 8, 0);
  add(town, new THREE.ConeGeometry(2.25, 2.4, 4), roof, 0, 11.2, 0).rotation.y = Math.PI / 4;
  add(town, new THREE.CylinderGeometry(0.85, 0.85, 0.08, 48), matte(mix(COLOR.gold, SET.bark, 0.3), 0.6), 0, 8.8, 1.31, noCast).rotation.x = Math.PI / 2;
  add(town, new THREE.CircleGeometry(0.78, 48), M.clay(0xffffff, { map: dial.texture }), 0, 8.8, 1.36, noCast);
  // the flagpole stands off to the left of the path so it never splits the wide shot
  add(town, new THREE.CylinderGeometry(0.08, 0.1, 9, 10), frame, -10.5, 4.5, 10);
  const flag = add(town, new THREE.PlaneGeometry(2.2, 1.3, 10, 1), M.clay(hex(COLOR.sky), { side: THREE.DoubleSide, roughness: 0.9 }), -9.4, 8.3, 10, off);

  // the school bus
  const bus = new THREE.Group();
  bus.position.set(-11, 0, 12.5);
  town.add(bus);
  const tyre = matte(mix(COLOR.void, COLOR.horizon, 0.6));
  add(bus, new THREE.BoxGeometry(6.4, 2.2, 2.4), matte(mix(COLOR.gold, SET.bark, 0.12), 0.8), 0, 1.6, 0);
  add(bus, new THREE.BoxGeometry(6.0, 0.7, 2.42), glass, 0.1, 2.1, 0, noCast);
  add(bus, new THREE.BoxGeometry(6.42, 0.15, 2.44), tyre, 0, 1.2, 0, noCast);
  for (const a of [-2.1, 2.1]) for (const b of [-1.2, 1.2]) add(bus, new THREE.CylinderGeometry(0.45, 0.45, 0.3, 18), tyre, a, 0.45, b).rotation.x = Math.PI / 2;

  // trees, houses, clouds and hills
  const leaves = SET.leaf;
  const tree = (x: number, z: number, s: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    town.add(g);
    add(g, new THREE.CylinderGeometry(0.25, 0.35, 2.2, 10), matte(SET.bark), 0, 1.1, 0);
    for (let k = 0; k < 3; k++) add(g, new THREE.SphereGeometry(1.2 + rnd() * 0.7, 18, 14), matte(leaves[k], 0.95), (rnd() - 0.5) * 1.2, 2.6 + k * 0.55, (rnd() - 0.5) * 1.2);
  };
  for (let i = 0; i < 46; i++) {
    const a = rnd() * 6.28, r = 13 + rnd() * 70, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8;
    if (Math.abs(z - 16) < 6 || (Math.abs(x) < 10 && z > -6 && z < 11)) continue;
    tree(x, z, 0.8 + rnd() * 0.6);
  }
  const houseColours = [mix(COLOR.gold, SET.stone, 0.7), mix(COLOR.sky, SET.stone, 0.55), mix(COLOR.ember, SET.stone, 0.72), mix(SET.grass, SET.stone, 0.6), SET.stone];
  const tile = [matte(mix(COLOR.ember, COLOR.horizon, 0.55)), matte(mix(SET.bark, COLOR.horizon, 0.3))];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    g.position.set(-66 + i * 12, 0, 38 + (i % 2) * 3);
    town.add(g);
    add(g, new THREE.BoxGeometry(5, 3.4, 5), matte(houseColours[i % 5]), 0, 1.7, 0);
    add(g, prism(5.6, 2, 5.4), tile[i % 2], 0, 3.4, 0).rotation.y = Math.PI;
    add(g, new THREE.BoxGeometry(0.9, 1.6, 0.1), matte(SET.bark), 0, 0.8, -2.52);
    add(g, new THREE.BoxGeometry(0.9, 0.9, 0.1), glass, 1.4, 2, -2.52, noCast);
  }
  // clouds: a phone's taller lens sees them from below, where a plain matte sphere goes storm grey.
  // Their shadow side is lifted toward the pale sky, so from any angle they stay fair-weather white.
  const cloud = M.clay(hex(COLOR.approach), { roughness: 1, emissive: mix(COLOR.approach, COLOR.sky, 0.35), emissiveIntensity: 0.62 });
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    g.position.set(-90 + i * 32, 32 + rnd() * 14, -40 - rnd() * 60);
    town.add(g);
    for (let k = 0; k < 5; k++) add(g, new THREE.SphereGeometry(3 + rnd() * 3, 16, 12), cloud, k * 3.2 - 6, rnd() * 2, rnd() * 3, off);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.28;
    add(town, new THREE.SphereGeometry(60 + rnd() * 30, 24, 16), matte(SET.hill, 1), Math.cos(a) * 260, -30, Math.sin(a) * 260 - 60, off);
  }

  // the morning sky: a gradient dome (gold haze at the horizon, blue overhead) that fog never touches
  const haze = mix(COLOR.gold, COLOR.approach, 0.55);
  const skyGeo = new THREE.SphereGeometry(480, 48, 24), sc = skyGeo.attributes.position, cols: number[] = [], lo = new THREE.Color(haze), hi = new THREE.Color(mix(COLOR.disk, COLOR.sky, 0.45));
  for (let i = 0; i < sc.count; i++) { const c = lo.clone().lerp(hi, Math.min(1, Math.max(0, sc.getY(i) / 260))); cols.push(c.r, c.g, c.b); }
  skyGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  town.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));

  const sun = new THREE.DirectionalLight(look.key.color, 0);
  sun.position.set(at.x - 50, 32, at.z + 38);
  sun.target.position.copy(at);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 150 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 2;
  scene.add(sun, sun.target);

  return {
    sun,
    /** The warm haze the camera flies through on the way down. */
    fog: new THREE.FogExp2(haze, 0.0026),
    update(T: number) {
      flag.rotation.y = Math.sin(T * 3) * 0.15;
    },
  };
}
