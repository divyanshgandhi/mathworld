import * as THREE from "three";
import { add, canvasTexture, fitText, prism, PALETTE, type Materials } from "@/engine/materials";
import type { Rng } from "@/engine/util";

/** The town around Maple Hill School: the school faces +z, the road runs along z = 16. */
export function buildTown(scene: THREE.Scene, M: Materials, rnd: Rng, at: THREE.Vector3) {
  const town = new THREE.Group();
  town.position.copy(at);
  scene.add(town);
  const noCast = { cast: false }, off = { cast: false, recv: false };

  const flat = (w: number, h: number, mat: THREE.Material, x: number, y: number, z: number) =>
    (add(town, new THREE.PlaneGeometry(w, h), mat, x, y, z, noCast).rotation.x = -Math.PI / 2);
  flat(700, 700, M.clay(0x8cc084, { roughness: 0.95 }), 0, 0, 0);
  flat(700, 8, M.clay(0x6b6e78, { roughness: 0.9 }), 0, 0.02, 16);
  for (let x = -120; x <= 120; x += 7) flat(3, 0.3, M.clay(PALETTE.clay), x, 0.03, 16);
  flat(4, 7, M.clay(0xd9cfc0, { roughness: 0.9 }), 0, 0.025, 8.6);

  const brick = M.clay(0xc8745a, { roughness: 0.85 }), cream = M.clay(PALETTE.cream, { roughness: 0.8 }), roof = M.clay(0x5b6b8a, { roughness: 0.7 });
  const frame = M.clay(0xf7f3ea), glass = M.clay(0x9fd0f0, { roughness: 0.15, metalness: 0.1 });

  // the school
  add(town, new THREE.BoxGeometry(16, 6, 8), brick, 0, 3, 0);
  add(town, prism(17, 3, 9), roof, 0, 6, 0);
  add(town, new THREE.BoxGeometry(5, 4.5, 2), cream, 0, 2.25, 4.9);
  add(town, prism(5.6, 1.4, 2.3), roof, 0, 4.5, 4.9);
  add(town, new THREE.BoxGeometry(1.8, 2.6, 0.1), M.clay(0x4f7a8f), 0, 1.3, 5.92);
  for (const s of [-1, 1]) add(town, new THREE.CylinderGeometry(0.22, 0.22, 4.4, 16), frame, s * 2.1, 2.2, 6.0);
  for (let i = 0; i < 3; i++) add(town, new THREE.BoxGeometry(4.2 - i * 0.4, 0.18, 0.6), cream, 0, 0.09 + i * 0.18, 6.4 - i * 0.3);
  for (const y of [1.8, 4.3]) for (const x of [-7, -5.2, -3.4, 3.4, 5.2, 7]) {
    add(town, new THREE.BoxGeometry(1.3, 1.5, 0.1), frame, x, y, 4.03);
    add(town, new THREE.BoxGeometry(1.1, 1.3, 0.1), glass, x, y, 4.07, noCast);
  }
  // the name plaque sits between the porch columns (inner edges at ±1.88 m) so nothing covers it
  const sign = canvasTexture(1024, 176);
  sign.ctx.fillStyle = "#2f4a3c"; sign.ctx.fillRect(0, 0, 1024, 176);
  sign.ctx.strokeStyle = "#d9b45a"; sign.ctx.lineWidth = 10; sign.ctx.strokeRect(12, 12, 1000, 152);
  sign.ctx.fillStyle = "#f3eee6";
  fitText(sign.ctx, "MAPLE HILL SCHOOL", 512, 92, 900, 96);
  sign.texture.needsUpdate = true;
  add(town, new THREE.BoxGeometry(3.5, 0.62, 0.06), M.clay(0x3a2a1e), 0, 3.78, 5.92);
  add(town, new THREE.PlaneGeometry(3.4, 0.584), M.clay(0xffffff, { map: sign.texture, roughness: 0.6 }), 0, 3.78, 5.955, noCast);
  add(town, new THREE.BoxGeometry(2.6, 4, 2.6), cream, 0, 8, 0);
  add(town, new THREE.ConeGeometry(2.25, 2.4, 4), roof, 0, 11.2, 0).rotation.y = Math.PI / 4;
  // the clock tower reads 8:42, an ordinary school morning
  const dial = canvasTexture(256, 256);
  {
    const x = dial.ctx;
    x.fillStyle = "#fbf7ee"; x.beginPath(); x.arc(128, 128, 124, 0, 7); x.fill();
    x.strokeStyle = "#2b2d42"; x.lineWidth = 8; x.stroke();
    x.fillStyle = "#2b2d42";
    for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; fitText(x, String(i), 128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96, 40, 30, "bold", "Georgia, serif"); }
    const hand = (a: number, len: number, w: number) => { x.lineWidth = w; x.lineCap = "round"; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len); x.stroke(); };
    hand(((8 + 42 / 60) / 12) * Math.PI * 2, 58, 10);
    hand((42 / 60) * Math.PI * 2, 86, 6);
    dial.texture.needsUpdate = true;
  }
  add(town, new THREE.CylinderGeometry(0.85, 0.85, 0.08, 48), M.clay(0xd9b45a, { metalness: 0.5, roughness: 0.35 }), 0, 8.8, 1.31, noCast).rotation.x = Math.PI / 2;
  add(town, new THREE.CircleGeometry(0.78, 48), M.clay(0xffffff, { map: dial.texture }), 0, 8.8, 1.36, noCast);
  // the flagpole stands off to the left of the path so it never splits the wide shot
  add(town, new THREE.CylinderGeometry(0.08, 0.1, 9, 10), frame, -10.5, 4.5, 10);
  const flag = add(town, new THREE.PlaneGeometry(2.2, 1.3, 10, 1), M.clay(PALETTE.invader, { side: THREE.DoubleSide }), -9.4, 8.3, 10);

  // the school bus
  const bus = new THREE.Group();
  bus.position.set(-11, 0, 12.5);
  town.add(bus);
  add(bus, new THREE.BoxGeometry(6.4, 2.2, 2.4), M.clay(0xf2c14e, { roughness: 0.5 }), 0, 1.6, 0);
  add(bus, new THREE.BoxGeometry(6.0, 0.7, 2.42), glass, 0.1, 2.1, 0, noCast);
  add(bus, new THREE.BoxGeometry(6.42, 0.15, 2.44), M.clay(PALETTE.dark), 0, 1.2, 0, noCast);
  for (const a of [-2.1, 2.1]) for (const b of [-1.2, 1.2]) add(bus, new THREE.CylinderGeometry(0.45, 0.45, 0.3, 18), M.clay(PALETTE.dark), a, 0.45, b).rotation.x = Math.PI / 2;

  // trees, houses, clouds and hills
  const leaves = [0x6fae5a, 0x7fbf63, 0x5e9e52];
  const tree = (x: number, z: number, s: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    town.add(g);
    add(g, new THREE.CylinderGeometry(0.25, 0.35, 2.2, 10), M.clay(0x8a6a4a), 0, 1.1, 0);
    for (let k = 0; k < 3; k++) add(g, new THREE.SphereGeometry(1.2 + rnd() * 0.7, 18, 14), M.clay(leaves[k]), (rnd() - 0.5) * 1.2, 2.6 + k * 0.55, (rnd() - 0.5) * 1.2);
  };
  for (let i = 0; i < 46; i++) {
    const a = rnd() * 6.28, r = 13 + rnd() * 70, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8;
    if (Math.abs(z - 16) < 6 || (Math.abs(x) < 10 && z > -6 && z < 11)) continue;
    tree(x, z, 0.8 + rnd() * 0.6);
  }
  const houseColours = [0xf7d6a8, 0xbfd8ef, 0xf2c1c8, 0xd5e8c4, 0xf3eee6];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    g.position.set(-66 + i * 12, 0, 38 + (i % 2) * 3);
    town.add(g);
    add(g, new THREE.BoxGeometry(5, 3.4, 5), M.clay(houseColours[i % 5]), 0, 1.7, 0);
    add(g, prism(5.6, 2, 5.4), M.clay(i % 2 ? 0xb5584a : 0x8a5a4a), 0, 3.4, 0).rotation.y = Math.PI;
    add(g, new THREE.BoxGeometry(0.9, 1.6, 0.1), M.clay(0x6a4a3a), 0, 0.8, -2.52);
    add(g, new THREE.BoxGeometry(0.9, 0.9, 0.1), glass, 1.4, 2, -2.52, noCast);
  }
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    g.position.set(-90 + i * 32, 32 + rnd() * 14, -40 - rnd() * 60);
    town.add(g);
    for (let k = 0; k < 5; k++) add(g, new THREE.SphereGeometry(3 + rnd() * 3, 16, 12), M.clay(0xffffff, { roughness: 1 }), k * 3.2 - 6, rnd() * 2, rnd() * 3, off);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.28;
    add(town, new THREE.SphereGeometry(60 + rnd() * 30, 24, 16), M.clay(0x7fb36f, { roughness: 1 }), Math.cos(a) * 260, -30, Math.sin(a) * 260 - 60, off);
  }

  // golden-hour sky: a gradient dome (warm at the horizon, blue overhead) that fog never touches
  const skyGeo = new THREE.SphereGeometry(480, 48, 24), sc = skyGeo.attributes.position, cols: number[] = [], lo = new THREE.Color(0xffd7a0), hi = new THREE.Color(0x6fa8e8);
  for (let i = 0; i < sc.count; i++) { const c = lo.clone().lerp(hi, Math.min(1, Math.max(0, sc.getY(i) / 260))); cols.push(c.r, c.g, c.b); }
  skyGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  town.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));

  const sun = new THREE.DirectionalLight(0xffd29a, 0);
  sun.position.set(at.x - 50, 32, at.z + 38);
  sun.target.position.copy(at);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 150 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  return {
    sun,
    update(T: number) {
      flag.rotation.y = Math.sin(T * 3) * 0.15;
    },
  };
}
