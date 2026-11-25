import * as THREE from "three";
import { COLOR, TYPE, hex } from "@/design/tokens";
import { add, canvasTexture, prism, type Materials } from "@/engine/materials";
import type { Rng } from "@/engine/util";
import { LOOKS, type Look } from "@/worlds/looks";
import { contactShadow, mix, PLAIN, WARM } from "./cast";

/**
 * The colours of the town. The tokens have no green, so `LEAF` is found between two of them: the
 * hue half-way round from the sky blue to the gold. Grass, hedges and trees are that green taken
 * toward the shadow or the gold; brick, stone and bark come from `WARM` (ember and gold), the root
 * of every warm material in the film. All of it is muted to sit under the gold morning light.
 */
const LEAF = new THREE.Color(COLOR.sky).lerpHSL(new THREE.Color(COLOR.gold), 0.56).getHex();
const SET = {
  grass: mix(mix(LEAF, COLOR.gold, 0.2), COLOR.horizon, 0.36), grassDeep: mix(LEAF, COLOR.shadow, 0.5), grassSun: mix(mix(LEAF, COLOR.gold, 0.45), COLOR.horizon, 0.2),
  leaf: [mix(LEAF, COLOR.shadow, 0.42), mix(mix(LEAF, COLOR.gold, 0.25), COLOR.shadow, 0.3), mix(LEAF, COLOR.shadow, 0.55), mix(mix(LEAF, COLOR.gold, 0.4), COLOR.horizon, 0.3)],
  bark: mix(WARM, COLOR.shadow, 0.6), brick: mix(mix(COLOR.ember, WARM, 0.4), COLOR.horizon, 0.38), stone: mix(mix(COLOR.approach, COLOR.gold, 0.25), COLOR.horizon, 0.1),
  path: mix(mix(COLOR.approach, WARM, 0.25), COLOR.horizon, 0.18), road: mix(COLOR.horizon, COLOR.sky, 0.18), kerb: mix(COLOR.approach, COLOR.horizon, 0.3),
  hill: mix(mix(LEAF, COLOR.sky, 0.35), COLOR.horizon, 0.4),
};

/** Text centred in a box in the game's typeface, shrunk until it fits. */
function fit(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxW: number, maxPx: number, weight = 400) {
  let px = maxPx;
  do { ctx.font = `${weight} ${px}px "${TYPE.family}", sans-serif`; px -= 2; } while (ctx.measureText(text).width > maxW && px > 8);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy);
}

/**
 * The town around Maple Hill School on a gold morning. The school faces +z across a lawn with a
 * path, hedges and a fence; the road runs along z = 16; the land rolls up into hills behind. The
 * sun is low on the left, so every tree lays a long shadow toward the school.
 */
export function buildTown(scene: THREE.Scene, M: Materials, rnd: Rng, at: THREE.Vector3, look: Look = LOOKS.interior) {
  const town = new THREE.Group();
  town.position.copy(at);
  scene.add(town);
  const noCast = { cast: false }, off = { cast: false, recv: false };
  const matte = (c: number, roughness = 0.92) => M.clay(c, { roughness });
  const flat = (w: number, h: number, mat: THREE.Material, x: number, y: number, z: number) => { const m = add(town, new THREE.PlaneGeometry(w, h), mat, x, y, z, noCast); m.rotation.x = -Math.PI / 2; return m; };

  // the land: level round the school and the road, rolling up behind and to the sides, in three greens
  /** Height of the ground at (x, z): flat where things are built, hills beyond. */
  const ground = (x: number, z: number) => {
    const r = Math.hypot(x, z * 1.25), rise = THREE.MathUtils.smoothstep(r, 46, 170), behind = THREE.MathUtils.smoothstep(-z, 20, 150);
    return rise * (5 + 7 * Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017 + 0.4) + 4 * Math.sin(x * 0.047 + z * 0.031)) * (0.35 + 0.65 * behind) + behind * 9;
  };
  {
    const geo = new THREE.PlaneGeometry(760, 760, 110, 110);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, cols: number[] = [], a = new THREE.Color(SET.grass), b = new THREE.Color(SET.grassDeep), c = new THREE.Color(SET.grassSun), t = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, ground(x, z));
      const n = 0.5 + 0.5 * Math.sin(x * 0.09 + Math.sin(z * 0.07) * 2) * Math.cos(z * 0.11 + 1.7), m = 0.5 + 0.5 * Math.sin(x * 0.023 - z * 0.031);
      t.copy(a).lerp(b, n * 0.55).lerp(c, m * 0.4);
      cols.push(t.r, t.g, t.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    add(town, geo, M.clay(PLAIN, { roughness: 0.96, vertexColors: true }), 0, 0, 0, noCast);
  }
  // the lawn in front of the school is mown: a lighter, even green, so the building stands on a clean ground
  flat(44, 15, matte(SET.grassSun, 0.96), 0, 0.03, 6.5);
  // road, kerbs and the pavement: each layer sits clear of the one under it, so none of them fight at a distance
  flat(760, 8, matte(SET.road, 0.9), 0, 0.06, 18);
  for (const z of [13.7, 22.3]) flat(760, 0.6, matte(SET.kerb, 0.9), 0, 0.1, z);
  flat(760, 1.8, matte(SET.path, 0.9), 0, 0.08, 12.6);
  for (let x = -150; x <= 150; x += 7) flat(3, 0.26, matte(hex(COLOR.approach)), x, 0.11, 18);
  for (let i = 0; i < 6; i++) flat(0.7, 3.2, matte(hex(COLOR.approach)), -2.2 + i * 0.88, 0.115, 18); // the crossing at the school gate
  flat(4.2, 7.4, matte(SET.path, 0.9), 0, 0.07, 9.4);

  const brick = matte(SET.brick, 0.9), cream = matte(SET.stone, 0.85), roof = matte(mix(COLOR.horizon, COLOR.disk, 0.4), 0.8);
  const frame = matte(mix(COLOR.approach, SET.stone, 0.4)), glass = matte(mix(COLOR.sky, COLOR.shadow, 0.42), 0.45), doorBlue = matte(mix(COLOR.disk, COLOR.horizon, 0.4), 0.8);

  // the school: two wings, a porch with the name over the door, a clock tower
  add(town, new THREE.BoxGeometry(16, 6, 8), brick, 0, 3, 0);
  add(town, new THREE.BoxGeometry(16.3, 0.5, 8.3), cream, 0, 0.25, 0); // a stone footing
  add(town, new THREE.BoxGeometry(16.3, 0.22, 8.3), cream, 0, 5.95, 0); // and a cornice under the roof
  add(town, prism(17.2, 3, 9.2), roof, 0, 6.05, 0);
  add(town, new THREE.BoxGeometry(5, 4.5, 2), cream, 0, 2.25, 4.9);
  add(town, prism(5.7, 1.5, 2.5), roof, 0, 4.5, 4.9);
  // the door: two leaves with a pane each, under a fanlight
  for (const s of [-1, 1]) {
    add(town, new THREE.BoxGeometry(0.86, 2.5, 0.1), doorBlue, s * 0.45, 1.6, 5.92);
    add(town, new THREE.BoxGeometry(0.5, 0.8, 0.04), glass, s * 0.45, 2.15, 5.975, noCast);
    add(town, new THREE.SphereGeometry(0.05, 10, 8), matte(mix(COLOR.gold, SET.bark, 0.3), 0.5), s * 0.1, 1.5, 6.0, noCast);
  }
  add(town, new THREE.BoxGeometry(2.0, 0.12, 0.14), frame, 0, 2.9, 5.93);
  for (const s of [-1, 1]) add(town, new THREE.CylinderGeometry(0.2, 0.22, 4.1, 20), frame, s * 2.1, 2.4, 6.0);
  for (const s of [-1, 1]) add(town, new THREE.BoxGeometry(0.6, 0.35, 0.6), cream, s * 2.1, 0.5, 6.0);
  for (let i = 0; i < 3; i++) add(town, new THREE.BoxGeometry(4.6 - i * 0.4, 0.17, 0.62), cream, 0, 0.085 + i * 0.17, 6.75 - i * 0.3);
  for (const y of [1.9, 4.3]) for (const x of [-7, -5.2, -3.4, 3.4, 5.2, 7]) {
    add(town, new THREE.BoxGeometry(1.3, 1.5, 0.1), frame, x, y, 4.03);
    add(town, new THREE.BoxGeometry(1.1, 1.3, 0.1), glass, x, y, 4.07, noCast);
    add(town, new THREE.BoxGeometry(0.05, 1.3, 0.12), frame, x, y, 4.08, noCast);
    add(town, new THREE.BoxGeometry(1.46, 0.09, 0.2), cream, x, y - 0.78, 4.08);
  }
  // the name plaque sits between the porch columns (inner edges at ±1.9 m) so nothing covers it
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
  add(town, new THREE.PlaneGeometry(3.4, 0.584), M.clay(PLAIN, { map: sign.texture, roughness: 0.6 }), 0, 3.78, 5.955, noCast);
  add(town, new THREE.BoxGeometry(2.6, 4, 2.6), cream, 0, 8, 0);
  add(town, new THREE.BoxGeometry(2.9, 0.2, 2.9), cream, 0, 10.0, 0);
  add(town, new THREE.ConeGeometry(2.25, 2.6, 4), roof, 0, 11.4, 0).rotation.y = Math.PI / 4;
  add(town, new THREE.CylinderGeometry(0.85, 0.85, 0.08, 48), matte(mix(COLOR.gold, SET.bark, 0.3), 0.6), 0, 8.8, 1.31, noCast).rotation.x = Math.PI / 2;
  add(town, new THREE.CircleGeometry(0.78, 48), M.clay(PLAIN, { map: dial.texture }), 0, 8.8, 1.36, noCast);
  // the flagpole stands off to the left of the path so it never splits the wide shot
  add(town, new THREE.CylinderGeometry(0.07, 0.1, 9, 10), frame, -10.5, 4.5, 9.4);
  const flag = add(town, new THREE.PlaneGeometry(2.2, 1.3, 10, 1), M.clay(hex(COLOR.sky), { side: THREE.DoubleSide, roughness: 0.9 }), -9.4, 8.3, 9.4, off);

  // hedges hug the foot of the building and two planters stand at the steps, so nothing meets the lawn on a bare line
  const hedge = matte(SET.leaf[0], 0.97), hedgeGeo = new THREE.SphereGeometry(1, 14, 10);
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) add(town, hedgeGeo, i % 2 ? matte(SET.leaf[1], 0.97) : hedge, s * (3.3 + i * 0.95), 0.45, 4.55).scale.set(0.62, 0.55 + (i % 3) * 0.07, 0.5);
  for (const s of [-1, 1]) {
    add(town, new THREE.CylinderGeometry(0.42, 0.34, 0.6, 16), matte(mix(SET.brick, COLOR.horizon, 0.3)), s * 2.9, 0.3, 7.2);
    add(town, hedgeGeo, matte(SET.leaf[3], 0.97), s * 2.9, 0.86, 7.2).scale.setScalar(0.48);
  }
  // a low fence along the pavement, open at the gate
  const rail = matte(mix(COLOR.approach, SET.stone, 0.5), 0.85);
  for (const s of [-1, 1]) {
    add(town, new THREE.BoxGeometry(19.4, 0.07, 0.07), rail, s * 12.3, 0.78, 11.5);
    add(town, new THREE.BoxGeometry(19.4, 0.07, 0.07), rail, s * 12.3, 0.42, 11.5);
    for (let i = 0; i <= 12; i++) add(town, new THREE.BoxGeometry(0.1, 0.95, 0.1), rail, s * (2.6 + i * 1.616), 0.475, 11.5);
    add(town, new THREE.BoxGeometry(0.36, 1.3, 0.36), cream, s * 2.45, 0.65, 11.5);
    add(town, new THREE.SphereGeometry(0.2, 12, 8), cream, s * 2.45, 1.42, 11.5);
  }

  // the school bus, parked at the kerb
  const bus = new THREE.Group();
  bus.position.set(-10.5, 0.06, 15.6);
  town.add(bus);
  const tyre = matte(mix(COLOR.void, COLOR.horizon, 0.6)), busBody = matte(mix(COLOR.gold, SET.bark, 0.12), 0.8);
  add(bus, new THREE.BoxGeometry(6.4, 2.0, 2.4), busBody, 0, 1.55, 0);
  add(bus, new THREE.BoxGeometry(1.2, 1.1, 2.3), busBody, 3.7, 1.1, 0); // the bonnet
  add(bus, new THREE.BoxGeometry(6.0, 0.7, 2.42), glass, 0.05, 2.05, 0, noCast);
  add(bus, new THREE.BoxGeometry(6.42, 0.14, 2.44), tyre, 0, 1.2, 0, noCast);
  for (const a of [-2.1, 2.6]) for (const b of [-1.15, 1.15]) add(bus, new THREE.CylinderGeometry(0.45, 0.45, 0.3, 18), tyre, a, 0.45, b).rotation.x = Math.PI / 2;
  const busShadow = contactShadow(9.5, 4.2, 0.45);
  busShadow.position.set(0.4, 0.02, 0);
  bus.add(busShadow);

  // trees: two kinds, drawn as instances. A broadleaf is a trunk under a crown of five rounded masses; a
  // poplar is one tall mass. They stand where a planner would put them: an avenue along the far side of
  // the road, a windbreak of poplars behind the school, two old trees on the lawn, and woods on the hills.
  const crowns: { p: THREE.Vector3; s: THREE.Vector3; c: number }[] = [], trunks: { p: THREE.Vector3; s: THREE.Vector3 }[] = [];
  const broadleaf = (x: number, z: number, s: number) => {
    const y = ground(x, z), tone = Math.floor(rnd() * 3);
    trunks.push({ p: new THREE.Vector3(x, y + 1.3 * s, z), s: new THREE.Vector3(0.28 * s, 2.6 * s, 0.28 * s) });
    const parts: [number, number, number, number][] = [[0, 3.9, 0, 1.75], [-1.15, 3.2, 0.25, 1.2], [1.1, 3.3, -0.2, 1.25], [0.15, 3.1, 1.05, 1.1], [-0.2, 4.9, -0.1, 1.15]];
    parts.forEach(([px, py, pz, r], i) => crowns.push({ p: new THREE.Vector3(x + px * s, y + py * s, z + pz * s), s: new THREE.Vector3(r * s, r * s * 0.86, r * s), c: SET.leaf[(tone + (i === 4 ? 3 : i % 2)) % 4] }));
  };
  const poplar = (x: number, z: number, s: number) => {
    const y = ground(x, z);
    trunks.push({ p: new THREE.Vector3(x, y + 0.8 * s, z), s: new THREE.Vector3(0.2 * s, 1.6 * s, 0.2 * s) });
    // three masses, each narrower than the one under it and a little off its axis: a flame shape, never a ball on a stick
    const tone = rnd() < 0.5 ? 0 : 2, lean = (rnd() - 0.5) * 0.5;
    for (const [py, w, h, k] of [[3.0, 1.35, 2.5, 0], [5.6, 1.12, 2.7, 1], [8.1, 0.74, 2.3, 3]] as const) crowns.push({ p: new THREE.Vector3(x + lean * (py / 8) * s, y + py * s, z + lean * 0.4 * s), s: new THREE.Vector3(w * s, h * s, w * s * 0.92), c: SET.leaf[(tone + k) % 4] });
  };
  broadleaf(-15.5, 5.5, 1.7); broadleaf(14.5, 7.2, 1.45); // the two old trees on the lawn
  for (let x = -120; x <= 120; x += 12) if (Math.abs(x) > 44) broadleaf(x + (rnd() - 0.5) * 2, 26 + rnd() * 1.5, 1.05 + rnd() * 0.3); // the avenue, open in front of the school so the crane has a clear run down
  for (let i = 0; i < 11; i++) poplar(-25 + i * 5 + (rnd() - 0.5), -9 - (i % 2) * 1.6, 1.05 + rnd() * 0.35); // the windbreak
  for (let i = 0; i < 70; i++) {
    const a = rnd() * 6.28, r = 42 + rnd() * 110, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.85 - 18;
    if (z > 8 && z < 30) continue; // keep the road and the avenue clear
    if (rnd() < 0.3) poplar(x, z, 0.9 + rnd() * 0.5); else broadleaf(x, z, 0.85 + rnd() * 0.7);
  }
  {
    const o = new THREE.Object3D(), col = new THREE.Color();
    const crownGeo = new THREE.IcosahedronGeometry(1, 2), crownMesh = new THREE.InstancedMesh(crownGeo, M.clay(PLAIN, { roughness: 0.97 }), crowns.length);
    crowns.forEach((k, i) => { o.position.copy(k.p); o.scale.copy(k.s); o.rotation.set(0, i * 1.7, 0); o.updateMatrix(); crownMesh.setMatrixAt(i, o.matrix); crownMesh.setColorAt(i, col.setHex(k.c)); });
    const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 1, 1, 10), matte(SET.bark), trunks.length);
    o.rotation.set(0, 0, 0);
    trunks.forEach((k, i) => { o.position.copy(k.p); o.scale.copy(k.s); o.updateMatrix(); trunkMesh.setMatrixAt(i, o.matrix); });
    for (const m of [crownMesh, trunkMesh]) { m.castShadow = m.receiveShadow = true; m.frustumCulled = false; town.add(m); }
  }

  // houses across the road and a second street far behind the school, so the town goes on past the frame
  const houseColours = [mix(COLOR.gold, SET.stone, 0.7), mix(COLOR.sky, SET.stone, 0.6), mix(COLOR.ember, SET.stone, 0.72), SET.stone, mix(SET.brick, SET.stone, 0.5)];
  const tile = [matte(mix(COLOR.ember, COLOR.horizon, 0.55)), matte(mix(SET.bark, COLOR.horizon, 0.3))];
  const house = (x: number, z: number, i: number, turn: number) => {
    const h = new THREE.Group();
    h.position.set(x, ground(x, z), z);
    h.rotation.y = turn;
    town.add(h);
    add(h, new THREE.BoxGeometry(5, 3.4, 5), matte(houseColours[i % 5]), 0, 1.7, 0);
    add(h, prism(5.7, 2.1, 5.5), tile[i % 2], 0, 3.4, 0);
    add(h, new THREE.BoxGeometry(0.9, 1.7, 0.1), matte(SET.bark), -0.9, 0.85, 2.52);
    for (const wx of [0.9, 1.9]) add(h, new THREE.BoxGeometry(0.75, 0.9, 0.1), glass, wx, 1.9, 2.52, noCast);
    add(h, new THREE.BoxGeometry(0.6, 1.1, 0.6), tile[(i + 1) % 2], 1.5, 4.7, -0.6);
    add(h, hedgeGeo, hedge, 2.0, 0.4, 3.2, noCast).scale.set(1.3, 0.5, 0.5);
  };
  for (let i = 0; i < 14; i++) house(-78 + i * 12, 34 + (i % 2) * 2.5, i, Math.PI);
  for (let i = 0; i < 10; i++) house(-54 + i * 12, -34 - (i % 3) * 3, i + 2, 0);

  // clouds: a phone's taller lens sees them from below, where a plain matte sphere goes storm grey.
  // Their shadow side is lifted toward the pale sky, so from any angle they stay fair-weather white.
  const cloud = M.clay(hex(COLOR.approach), { roughness: 1, emissive: mix(COLOR.approach, COLOR.gold, 0.18), emissiveIntensity: 0.6 });
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    c.position.set(-110 + i * 38, 46 + rnd() * 18, -70 - rnd() * 80);
    town.add(c);
    for (let k = 0; k < 5; k++) add(c, new THREE.SphereGeometry(3.5 + rnd() * 3, 16, 12), cloud, k * 3.6 - 7, rnd() * 1.6, rnd() * 3, off).scale.y = 0.62;
  }
  // far hills, paler with distance: the last layer before the sky
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.28 + 0.3;
    add(town, new THREE.SphereGeometry(70 + rnd() * 40, 24, 16), matte(SET.hill, 1), Math.cos(a) * 300, -38, Math.sin(a) * 300 - 40, off).scale.y = 0.75;
  }

  // the morning sky: a gradient dome (gold haze at the horizon, blue overhead) that fog never touches
  const haze = mix(COLOR.gold, COLOR.approach, 0.5);
  const skyGeo = new THREE.SphereGeometry(480, 48, 24), sc = skyGeo.attributes.position, cols: number[] = [], lo = new THREE.Color(haze), hi = new THREE.Color(mix(COLOR.disk, COLOR.sky, 0.5));
  for (let i = 0; i < sc.count; i++) { const c = lo.clone().lerp(hi, Math.min(1, Math.max(0, sc.getY(i) / 230)) ** 0.8); cols.push(c.r, c.g, c.b); }
  skyGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  town.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));

  // the sun: low on the left and a little in front, so the school's face is lit and every shadow is long
  const sun = new THREE.DirectionalLight(look.key.color, 0);
  sun.position.set(at.x - 52, 23, at.z + 40);
  sun.target.position.set(at.x, 0, at.z + 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 26, bottom: -22, near: 1, far: 160 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.06;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  return {
    group: town,
    sun,
    /** The lights that cast shadows here, for whoever schedules shadow passes. */
    shadows: [sun],
    /** The warm haze the camera flies through on the way down. */
    fog: new THREE.FogExp2(haze, 0.0034),
    update(T: number) {
      flag.rotation.y = Math.sin(T * 3) * 0.15;
    },
  };
}
