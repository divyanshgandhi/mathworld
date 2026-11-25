import * as THREE from "three";
import { COLOR, TYPE, hex } from "@/design/tokens";
import { add, canvasTexture, type Materials } from "@/engine/materials";
import { clamp, type Rng } from "@/engine/util";
import { LOOKS, type Look } from "@/worlds/looks";
import { mix } from "./cast";

/** Desk positions: 3 rows of 3, the board at z = -5. The player sits in the middle (index 4). */
export const SEATS: [number, number][] = [-1.6, 0.6, 2.8].flatMap((z) => [-2.6, 0, 2.6].map((x) => [x, z] as [number, number]));
export const PLAYER_SEAT = 4;
/** Child-size furniture: the top of a chair seat and of a desk, and how far behind its desk a chair stands. */
export const SEAT_HEIGHT = 0.32, DESK_HEIGHT = 0.58, DESK_DEPTH = 0.55, CHAIR_BACK = 0.5;

const ROOM = { x: 6, z: 5, h: 3.5, t: 0.2 };
const DOOR = { z0: -4.15, z1: -2.95, top: 2.3, hingeZ: -4.13, leaf: 1.15 };
const WINDOWS = { z: [-2.4, 0.2, 2.8], w: 1.9, sill: 1.0, head: 3.0 };
/** The middle of the doorway at head height: where the class looks when someone knocks. */
export const DOOR_POINT = new THREE.Vector3(ROOM.x, 1.3, (DOOR.z0 + DOOR.z1) / 2);
/** Morning sun through the windows: low, raking across the desks toward the board. */
const SUN_DIR = new THREE.Vector3(1, -0.345, -0.38).normalize();

/**
 * The materials of the set. Wood, plaster and paper have no role in the UI tokens, so their
 * colours are declared once here; everything with a role (board, chairs, posters, the door) is
 * mixed from the tokens.
 */
const SET = {
  plaster: 0xcfc4b0, ceiling: 0xc9c5bc, floor: 0x8b6a4c, floorLine: "rgba(40,26,14,.4)", wood: 0x9c7752, desk: 0xc4a47e,
  paper: 0xe9e4d8, steel: 0x5d6270, hall: "#c9a57c", hallLow: "#8d6f52", skyHigh: "#9cc0e8", skyLow: "#ffe0ae",
};

/**
 * The classroom on an ordinary Tuesday: 12 × 10 m, the board on the front wall, three real window
 * openings on the left that the morning sun shines through, the door on the right (it opens outward
 * into a lit hallway), and nine child-size desks. Every light is steady.
 */
export function buildClassroom(scene: THREE.Scene, M: Materials, rnd: Rng, look: Look = LOOKS.interior) {
  const room = new THREE.Group();
  scene.add(room);
  const noCast = { cast: false }, off = { cast: false, recv: false };
  const { x: RX, z: RZ, h: RH, t: WT } = ROOM;
  /** A box given by its extents, so no two faces are ever placed on the same plane by accident. */
  const box = (parent: THREE.Object3D, x: [number, number], y: [number, number], z: [number, number], mat: THREE.Material, o: { cast?: boolean; recv?: boolean } = {}) =>
    add(parent, new THREE.BoxGeometry(x[1] - x[0], y[1] - y[0], z[1] - z[0]), mat, (x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2, o);

  const plaster = M.clay(SET.plaster, { roughness: 0.95 }), wood = M.clay(SET.wood, { roughness: 0.8 }), steel = M.clay(SET.steel, { roughness: 0.6, metalness: 0.2 });
  const trim = M.clay(mix(COLOR.approach, SET.plaster, 0.35), { roughness: 0.8 });

  // floor: planks
  const plank = canvasTexture(256, 256);
  for (let i = 0; i < 8; i++) {
    plank.ctx.fillStyle = `#${new THREE.Color(SET.floor).offsetHSL(0, 0, ((i * 37) % 5) * 0.012 - 0.024).getHexString()}`;
    plank.ctx.fillRect(0, i * 32, 256, 32);
    plank.ctx.fillStyle = SET.floorLine;
    plank.ctx.fillRect(0, i * 32, 256, 2);
    plank.ctx.fillRect(((i * 97) % 200) + 20, i * 32, 2, 32);
  }
  plank.texture.wrapS = plank.texture.wrapT = THREE.RepeatWrapping;
  plank.texture.repeat.set(3, 3);
  add(room, new THREE.PlaneGeometry(RX * 2, RZ * 2), M.clay(0xffffff, { map: plank.texture, roughness: 0.85 }), 0, 0, 0, noCast).rotation.x = -Math.PI / 2;

  // walls: the side walls are single meshes with real openings, and every wall runs a little into
  // its neighbours, so there is no seam for light to leak through
  const wallWithOpenings = (outline: [number, number][], holes: [number, number, number, number][]) => {
    const s = new THREE.Shape();
    outline.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
    s.closePath();
    for (const [z0, z1, y0, y1] of holes) {
      const h = new THREE.Path();
      h.moveTo(z0, y0); h.lineTo(z0, y1); h.lineTo(z1, y1); h.lineTo(z1, y0); h.closePath();
      s.holes.push(h);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: WT, bevelEnabled: false });
    g.rotateY(-Math.PI / 2); // shape x → world z, extrusion → world −x
    return g;
  };
  const lo = -0.05, hi = RH + 0.05, zEnd = RZ + 0.05;
  const half = WINDOWS.w / 2;
  add(room, wallWithOpenings([[-zEnd, lo], [zEnd, lo], [zEnd, hi], [-zEnd, hi]], WINDOWS.z.map((z) => [z - half, z + half, WINDOWS.sill, WINDOWS.head])), plaster, -RX, 0, 0);
  add(room, wallWithOpenings([[-zEnd, lo], [DOOR.z0, lo], [DOOR.z0, DOOR.top], [DOOR.z1, DOOR.top], [DOOR.z1, lo], [zEnd, lo], [zEnd, hi], [-zEnd, hi]], []), plaster, RX + WT, 0, 0);
  box(room, [-RX - WT, RX + WT], [lo, hi], [-RZ - WT, -RZ], plaster);
  box(room, [-RX - WT, RX + WT], [lo, hi], [RZ, RZ + WT], plaster);
  box(room, [-RX - 0.4, RX + 0.4], [RH, RH + 0.2], [-RZ - 0.4, RZ + 0.4], M.clay(SET.ceiling, { roughness: 0.95 }));
  // skirting on the front and back walls
  for (const s of [-1, 1]) box(room, [-RX, RX], [0, 0.12], s < 0 ? [-RZ, -RZ + 0.03] : [RZ - 0.03, RZ], wood);

  // windows: a frame, a sill and glazing bars in each opening; the bars draw their shadows on the room
  const sky = canvasTexture(8, 256);
  {
    const g = sky.ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, SET.skyHigh); g.addColorStop(0.75, SET.skyLow); g.addColorStop(1, SET.skyLow);
    sky.ctx.fillStyle = g; sky.ctx.fillRect(0, 0, 8, 256);
    sky.texture.needsUpdate = true;
  }
  const outside = add(room, new THREE.PlaneGeometry(RZ * 2 + 8, 7), new THREE.MeshBasicMaterial({ map: sky.texture, fog: false }), -RX - 3.2, 2.2, 0, off);
  outside.rotation.y = Math.PI / 2;
  for (const z of WINDOWS.z) {
    const z0 = z - half, z1 = z + half, y0 = WINDOWS.sill, y1 = WINDOWS.head, xi: [number, number] = [-RX - WT + 0.04, -RX - 0.04];
    box(room, xi, [y0, y1], [z0, z0 + 0.06], trim); box(room, xi, [y0, y1], [z1 - 0.06, z1], trim);
    box(room, xi, [y1 - 0.06, y1], [z0, z1], trim); box(room, xi, [y0, y0 + 0.06], [z0, z1], trim);
    box(room, xi, [y0, y1], [z - 0.025, z + 0.025], trim);
    box(room, xi, [y0 + 1.28, y0 + 1.33], [z0, z1], trim);
    box(room, [-RX, -RX + 0.14], [y0 - 0.05, y0], [z0 - 0.08, z1 + 0.08], wood);
  }

  // the door: a frame that stands proud of the wall, stops behind the leaf that it closes against (so
  // no gap ever shows the hallway), a threshold, and the leaf on its hinge
  const frame = M.clay(mix(COLOR.approach, SET.wood, 0.55), { roughness: 0.75 });
  const fx: [number, number] = [RX - 0.05, RX + WT + 0.05], hz = DOOR.hingeZ, lz = hz + DOOR.leaf + 0.01;
  box(room, fx, [0, DOOR.top + 0.1], [hz - 0.12, hz], frame);
  box(room, fx, [0, DOOR.top + 0.1], [lz, lz + 0.12], frame);
  box(room, fx, [DOOR.top - 0.02, DOOR.top + 0.1], [hz - 0.12, lz + 0.12], frame);
  const sx: [number, number] = [RX + 0.07, RX + 0.1];
  box(room, sx, [0, DOOR.top - 0.02], [hz - 0.01, hz + 0.04], frame);
  box(room, sx, [0, DOOR.top - 0.02], [lz - 0.05, lz + 0.01], frame);
  box(room, sx, [DOOR.top - 0.07, DOOR.top - 0.01], [hz - 0.01, lz + 0.01], frame);
  box(room, [RX - 0.02, RX + WT + 0.02], [-0.02, 0.012], [hz, lz], wood, noCast);
  box(room, sx, [0, 0.04], [hz, lz], wood);
  // the leaf hangs on the room side and swings into the room, so the class (and the camera) see it open
  const door = new THREE.Group();
  door.position.set(RX + 0.02, 0, hz);
  room.add(door);
  const leafMat = M.clay(mix(COLOR.disk, COLOR.horizon, 0.45), { roughness: 0.8 });
  box(door, [0, 0.05], [0.02, DOOR.top - 0.03], [0.01, DOOR.leaf], leafMat);
  // two raised panels and a small frosted pane: matte, lit only by the room
  for (const [y0, y1] of [[0.22, 0.95], [1.08, 1.5]] as const) box(door, [-0.009, 0.059], [y0, y1], [0.16, DOOR.leaf - 0.15], M.clay(mix(COLOR.disk, COLOR.horizon, 0.6), { roughness: 0.8 }));
  box(door, [-0.011, 0.061], [1.62, 2.08], [0.3, DOOR.leaf - 0.29], frame);
  box(door, [-0.015, 0.065], [1.66, 2.04], [0.34, DOOR.leaf - 0.33], M.clay(mix(COLOR.sky, COLOR.approach, 0.5), { roughness: 0.6 }));
  const brass = M.clay(mix(COLOR.gold, SET.wood, 0.45), { roughness: 0.5, metalness: 0.35 });
  for (const s of [-1, 1]) {
    const x = 0.025 + s * 0.05;
    add(door, new THREE.CylinderGeometry(0.018, 0.018, 0.05, 12), brass, x, 1.05, DOOR.leaf - 0.1).rotation.z = Math.PI / 2;
    box(door, [x + s * 0.02 - 0.012, x + s * 0.02 + 0.012], [1.038, 1.062], [DOOR.leaf - 0.22, DOOR.leaf - 0.08], brass);
  }

  // the hallway beyond: a short corridor painted as if lit from above. It is a backdrop, so no light
  // of its own can leak into the room; what reaches the room is the spill light through the doorway
  const hallTex = canvasTexture(256, 256);
  {
    const x = hallTex.ctx, g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, SET.hall); g.addColorStop(0.58, SET.hall); g.addColorStop(0.6, SET.hallLow); g.addColorStop(1, SET.hallLow);
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const v = x.createRadialGradient(128, 70, 30, 128, 128, 200);
    v.addColorStop(0, "rgba(255,240,215,.28)"); v.addColorStop(1, "rgba(20,12,6,.38)");
    x.fillStyle = v; x.fillRect(0, 0, 256, 256);
    hallTex.texture.needsUpdate = true;
  }
  const hallWall = new THREE.MeshBasicMaterial({ map: hallTex.texture }), hallFlat = new THREE.MeshBasicMaterial({ color: new THREE.Color(SET.hallLow).multiplyScalar(0.7) });
  const hallFloor = M.clay(new THREE.Color(SET.hallLow).getHex(), { roughness: 0.9 });
  const HX = RX + WT + 2.6, hallZ: [number, number] = [-RZ - 1.6, -1.2], hallH = 2.9;
  add(room, new THREE.PlaneGeometry(hallZ[1] - hallZ[0], hallH), hallWall, HX, hallH / 2, (hallZ[0] + hallZ[1]) / 2, off).rotation.y = -Math.PI / 2;
  for (const z of hallZ) add(room, new THREE.PlaneGeometry(HX - RX - WT, hallH), hallFlat, (HX + RX + WT) / 2, hallH / 2, z, off).rotation.y = z < -3 ? 0 : Math.PI;
  add(room, new THREE.PlaneGeometry(HX - RX - WT, hallZ[1] - hallZ[0]), hallFlat, (HX + RX + WT) / 2, hallH, (hallZ[0] + hallZ[1]) / 2, off).rotation.x = Math.PI / 2;
  add(room, new THREE.PlaneGeometry(HX - RX - WT, hallZ[1] - hallZ[0]), hallFloor, (HX + RX + WT) / 2, 0, (hallZ[0] + hallZ[1]) / 2, noCast).rotation.x = -Math.PI / 2;

  // chalkboard: the maths is written in the game's own display voice
  const board = canvasTexture(1024, 320);
  let written = "";
  const paint = () => {
    const x = board.ctx;
    x.fillStyle = COLOR.shadow;
    x.fillRect(0, 0, 1024, 320);
    for (let i = 0; i < 26; i++) {
      x.fillStyle = `rgba(230,241,255,${0.012 + ((i * 53) % 7) * 0.004})`;
      x.beginPath();
      x.ellipse((i * 211) % 1024, (i * 97) % 320, 60 + ((i * 31) % 110), 14 + ((i * 17) % 26), (i * 0.7) % 3, 0, 7);
      x.fill();
    }
    x.fillStyle = COLOR.approach;
    x.textAlign = "center"; x.textBaseline = "middle";
    let px = 128;
    do { x.font = `300 ${px}px "${TYPE.family}", sans-serif`; px -= 4; } while (x.measureText(written).width > 560 && px > 40);
    x.fillText(written, 512, 172);
    x.font = `500 30px "${TYPE.family}", sans-serif`;
    x.textAlign = "left";
    x.fillStyle = "rgba(230,241,255,.6)";
    x.fillText("Tuesday", 40, 46);
    board.texture.needsUpdate = true;
  };
  const write = (s: string) => { written = s; paint(); };
  if (typeof document !== "undefined") void document.fonts.load(`400 16px ${TYPE.family}`).then(() => { paint(); paintPosters(); });
  box(room, [-2.95, 2.95], [1.02, 2.88], [-RZ, -RZ + 0.06], wood);
  add(room, new THREE.PlaneGeometry(5.7, 1.68), M.clay(0xffffff, { map: board.texture, roughness: 0.95 }), 0, 1.95, -RZ + 0.066, noCast);
  box(room, [-2.7, 2.7], [0.96, 1.0], [-RZ, -RZ + 0.14], wood);
  box(room, [-0.9, -0.74], [1.0, 1.035], [-RZ + 0.05, -RZ + 0.11], M.clay(hex(COLOR.approach), { roughness: 0.9 }));

  // posters: the solar system foreshadows the adventure; the four signs name today's lesson
  const poster = canvasTexture(256, 320), ops = canvasTexture(256, 256);
  const paintPosters = () => {
    let x = poster.ctx;
    x.fillStyle = COLOR.void; x.fillRect(0, 0, 256, 320);
    x.strokeStyle = "rgba(230,241,255,.3)"; x.lineWidth = 1.2; x.setLineDash([3, 5]);
    for (const r of [52, 84, 118, 156, 196]) { x.beginPath(); x.arc(20, 190, r, -1.2, 1.2); x.stroke(); }
    x.setLineDash([]);
    x.fillStyle = COLOR.gold; x.beginPath(); x.arc(20, 190, 30, 0, 7); x.fill();
    for (const [c, r, a, s] of [[COLOR.approach, 52, -0.5, 5], [COLOR.sky, 84, 0.3, 8], [COLOR.disk, 118, -0.2, 9], [COLOR.ember, 156, 0.55, 7], [COLOR.gold, 196, -0.1, 15]] as const) {
      x.fillStyle = c; x.beginPath(); x.arc(20 + Math.cos(a) * r, 190 + Math.sin(a) * r, s, 0, 7); x.fill();
    }
    x.fillStyle = COLOR.approach; x.textAlign = "center"; x.textBaseline = "middle";
    x.font = `300 25px "${TYPE.family}", sans-serif`;
    x.fillText("OUR SOLAR SYSTEM", 128, 44);
    poster.texture.needsUpdate = true;
    x = ops.ctx;
    x.fillStyle = COLOR.panel; x.fillRect(0, 0, 256, 256);
    for (const [s, c, px, py] of [["+", COLOR.sky, 68, 70], ["−", COLOR.approach, 188, 70], ["×", COLOR.gold, 68, 186], ["÷", COLOR.ember, 188, 186]] as const) {
      x.fillStyle = c; x.font = `300 120px "${TYPE.family}", sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(s, px, py);
    }
    ops.texture.needsUpdate = true;
  };
  paintPosters();
  box(room, [3.72, 4.82], [1.58, 2.72], [-RZ, -RZ + 0.02], trim);
  add(room, new THREE.PlaneGeometry(1.04, 1.08), M.clay(0xffffff, { map: ops.texture, roughness: 0.9 }), 4.27, 2.15, -RZ + 0.026, noCast);
  box(room, [-5.02, -3.98], [1.5, 2.8], [-RZ, -RZ + 0.02], trim);
  add(room, new THREE.PlaneGeometry(0.98, 1.24), M.clay(0xffffff, { map: poster.texture, roughness: 0.9 }), -4.5, 2.15, -RZ + 0.026, noCast);

  // the back wall: a pin-board of the class's drawings over a low shelf of books
  box(room, [-2.3, 2.3], [1.25, 2.55], [RZ - 0.03, RZ], wood);
  box(room, [-2.2, 2.2], [1.33, 2.47], [RZ - 0.04, RZ - 0.01], M.clay(mix(SET.desk, SET.wood, 0.5), { roughness: 0.95 }), noCast);
  const sheets = [COLOR.approach, COLOR.sky, COLOR.gold, COLOR.approach, COLOR.ember, COLOR.disk, COLOR.approach, COLOR.gold].map((c) => M.clay(mix(c, SET.paper, 0.45), { roughness: 0.95 }));
  sheets.forEach((m, i) => {
    const sheet = add(room, new THREE.BoxGeometry(0.42, 0.52 + (i % 3) * 0.04, 0.006), m, -1.85 + i * 0.53, 1.9 + ((i * 7) % 3) * 0.04 - 0.04, RZ - 0.045, noCast);
    sheet.rotation.z = ((i * 5) % 4 - 1.5) * 0.035;
  });
  box(room, [-5.2, -2.9], [0, 0.82], [RZ - 0.34, RZ], wood);
  box(room, [-5.14, -2.96], [0.06, 0.4], [RZ - 0.36, RZ - 0.3], M.clay(mix(SET.wood, COLOR.void, 0.45), { roughness: 0.9 }), noCast);
  box(room, [-5.14, -2.96], [0.46, 0.78], [RZ - 0.36, RZ - 0.3], M.clay(mix(SET.wood, COLOR.void, 0.45), { roughness: 0.9 }), noCast);
  [COLOR.ember, COLOR.sky, COLOR.gold, COLOR.disk, COLOR.approach, COLOR.sky, COLOR.ember, COLOR.gold, COLOR.disk, COLOR.approach, COLOR.gold, COLOR.sky].forEach((c, i) => {
    for (const y of [0.07, 0.47]) box(room, [-5.08 + i * 0.172, -5.08 + i * 0.172 + 0.13], [y, y + 0.22 + ((i + (y > 0.2 ? 3 : 0)) % 4) * 0.02], [RZ - 0.39, RZ - 0.34], M.clay(mix(c, COLOR.horizon, 0.35), { roughness: 0.9 }), noCast);
  });
  // a painted dado along the side and back walls ties the room to the palette and breaks up the plaster
  const dado = M.clay(mix(COLOR.disk, SET.plaster, 0.62), { roughness: 0.95 });
  box(room, [RX - 0.012, RX], [0.12, 1.0], [DOOR.z1 + 0.14, RZ], dado, noCast);
  box(room, [-RX, RX], [0.12, 1.0], [RZ - 0.012, RZ], dado, noCast);
  box(room, [-RX, -RX + 0.012], [0.12, WINDOWS.sill - 0.05], [-RZ, RZ], dado, noCast);

  // the wall clock: 8:42, the same morning as the clock tower outside
  const clock = new THREE.Group();
  clock.position.set(0, 3.17, -RZ + 0.001);
  room.add(clock);
  const dial = canvasTexture(256, 256);
  const paintDial = () => {
    const x = dial.ctx;
    x.fillStyle = COLOR.approach; x.beginPath(); x.arc(128, 128, 126, 0, 7); x.fill();
    x.fillStyle = COLOR.shadow; x.textAlign = "center"; x.textBaseline = "middle"; x.font = `500 30px "${TYPE.family}", sans-serif`;
    for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; x.fillText(String(i), 128 + Math.sin(a) * 96, 130 - Math.cos(a) * 96); }
    dial.texture.needsUpdate = true;
  };
  paintDial();
  if (typeof document !== "undefined") void document.fonts.load(`400 16px ${TYPE.family}`).then(paintDial);
  add(clock, new THREE.CylinderGeometry(0.23, 0.23, 0.04, 48), M.clay(hex(COLOR.shadow), { roughness: 0.7 }), 0, 0, 0.02).rotation.x = Math.PI / 2;
  add(clock, new THREE.CircleGeometry(0.2, 48), M.clay(0xffffff, { map: dial.texture, roughness: 0.9 }), 0, 0, 0.046, noCast);
  for (const [len, w, angle, z] of [[0.11, 0.02, ((8 + 42 / 60) / 12) * Math.PI * 2, 0.052], [0.16, 0.013, (42 / 60) * Math.PI * 2, 0.058]] as const) {
    const pivot = new THREE.Group();
    pivot.position.z = z;
    pivot.rotation.z = -angle;
    clock.add(pivot);
    add(pivot, new THREE.BoxGeometry(w, len, 0.005), M.clay(hex(COLOR.shadow)), 0, len / 2 - 0.012, 0, noCast);
  }

  // ceiling lamps: plain fittings, switched off on a bright morning
  for (const z of [-1.4, 2.2]) box(room, [-1.2, 1.2], [RH - 0.07, RH], [z - 0.13, z + 0.13], trim, noCast);

  // the teacher's desk, with a globe that says where this is going
  const tdesk = new THREE.Group();
  tdesk.position.set(2.5, 0, -3.7);
  room.add(tdesk);
  box(tdesk, [-0.85, 0.85], [0.72, 0.77], [-0.42, 0.42], wood);
  box(tdesk, [-0.8, 0.8], [0.04, 0.72], [-0.38, -0.33], wood);
  for (const s of [-1, 1]) box(tdesk, [s * 0.8 - 0.03, s * 0.8 + 0.03], [0, 0.72], [-0.4, 0.4], wood);
  add(tdesk, new THREE.SphereGeometry(0.06, 16, 12), M.clay(hex(COLOR.ember), { roughness: 0.6 }), 0.55, 0.83, 0.12);
  for (const [c, y, r] of [[COLOR.disk, 0.795, 0.1], [COLOR.gold, 0.84, -0.12], [COLOR.approach, 0.88, 0.05]] as const) add(tdesk, new THREE.BoxGeometry(0.36, 0.04, 0.27), M.clay(mix(c, SET.paper, 0.25), { roughness: 0.9 }), -0.5, y, -0.02).rotation.y = r;
  add(tdesk, new THREE.CylinderGeometry(0.09, 0.11, 0.03, 20), wood, 0.05, 0.785, -0.12);
  add(tdesk, new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), steel, 0.05, 0.87, -0.12);
  const globe = add(tdesk, new THREE.SphereGeometry(0.15, 32, 20), M.clay(hex(COLOR.disk), { roughness: 0.85 }), 0.05, 1.02, -0.12);
  globe.rotation.z = 0.4;
  for (const [a, b, s] of [[0.5, 0.4, 0.07], [2.2, -0.3, 0.06], [3.6, 0.6, 0.05], [5.0, -0.1, 0.07]] as const)
    add(globe, new THREE.SphereGeometry(s, 12, 8), M.clay(mix(COLOR.gold, SET.floor, 0.5), { roughness: 0.9 }), Math.cos(a) * Math.cos(b) * 0.118, Math.sin(b) * 0.118, Math.sin(a) * Math.cos(b) * 0.118, noCast);

  // desks and chairs, child size. Each chair is its own group so a child who stands can push it back
  const deskTop = M.clay(SET.desk, { roughness: 0.8 }), chairMat = M.clay(mix(COLOR.disk, COLOR.horizon, 0.35), { roughness: 0.8 });
  const paper = M.clay(SET.paper, { roughness: 0.95 }), pencil = M.clay(hex(COLOR.gold), { roughness: 0.7 });
  const packs = [COLOR.ember, COLOR.sky, COLOR.gold, COLOR.disk, COLOR.approach, COLOR.ember, COLOR.sky, COLOR.disk, COLOR.gold].map((c) => M.clay(mix(c, COLOR.horizon, 0.3), { roughness: 0.9 }));
  const chairs: THREE.Group[] = [];
  for (const [i, [x, z]] of SEATS.entries()) {
    const d = new THREE.Group();
    d.position.set(x, 0, z);
    room.add(d);
    box(d, [-0.5, 0.5], [DESK_HEIGHT - 0.035, DESK_HEIGHT], [-DESK_DEPTH / 2, DESK_DEPTH / 2], deskTop);
    box(d, [-0.43, 0.43], [DESK_HEIGHT - 0.12, DESK_HEIGHT - 0.035], [-0.238, -0.218], deskTop); // the apron sits between the legs, on no face of theirs
    for (const a of [-1, 1]) for (const b of [-1, 1]) box(d, [a * 0.45 - 0.02, a * 0.45 + 0.02], [0, DESK_HEIGHT - 0.035], [b * 0.23 - 0.02, b * 0.23 + 0.02], steel);
    const nb = add(d, new THREE.BoxGeometry(0.3, 0.008, 0.21), paper, -0.14, DESK_HEIGHT + 0.004, -0.04, noCast);
    nb.rotation.y = 0.12 - (i % 3) * 0.1;
    const pc = add(d, new THREE.CylinderGeometry(0.007, 0.007, 0.16, 8), pencil, 0.2, DESK_HEIGHT + 0.007, -0.08, noCast);
    pc.rotation.set(Math.PI / 2, 0, 0.6 + i * 0.3);
    const pack = add(d, new THREE.BoxGeometry(0.26, 0.3, 0.14), packs[i], i % 2 ? 0.62 : -0.62, 0.15, 0.2);
    pack.rotation.y = 0.3 * (i % 2 ? 1 : -1);
    const c = new THREE.Group();
    c.position.set(x, 0, z + CHAIR_BACK);
    room.add(c);
    box(c, [-0.16, 0.16], [SEAT_HEIGHT - 0.03, SEAT_HEIGHT], [-0.17, 0.17], chairMat);
    box(c, [-0.16, 0.16], [SEAT_HEIGHT + 0.18, SEAT_HEIGHT + 0.4], [0.15, 0.18], chairMat);
    for (const a of [-1, 1]) {
      box(c, [a * 0.135 - 0.015, a * 0.135 + 0.015], [0, SEAT_HEIGHT - 0.03], [-0.15, -0.12], steel);
      box(c, [a * 0.135 - 0.015, a * 0.135 + 0.015], [0, SEAT_HEIGHT + 0.36], [0.18, 0.21], steel);
    }
    chairs.push(c);
  }

  // lights, all from the look and all steady: the sun through the windows is the key, the stage's
  // hemisphere is the cool fill, a rim from the door side separates heads from the wall, and the
  // hallway spills in through the doorway (the door leaf and the wall shape it by shadow)
  const sun = new THREE.DirectionalLight(look.key.color, 0);
  sun.position.copy(SUN_DIR).multiplyScalar(-22).add(new THREE.Vector3(0, 1.4, 0));
  sun.target.position.set(0, 1.4, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8.5, right: 8.5, top: 5.5, bottom: -5.5, near: 4, far: 40 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 2.5;
  // the soft half of the key: sky light through the same windows, which shapes faces the sun misses
  const soft = new THREE.DirectionalLight(look.key.color, 0);
  soft.position.set(-10, 3.5, -2.5);
  const rim = new THREE.DirectionalLight(look.rim.color, 0);
  rim.position.set(7, 5, 6);
  const spill = new THREE.SpotLight(look.key.color, 0, 13, 0.46, 0.6, 1.2);
  spill.position.set(HX - 0.5, 2.25, DOOR_POINT.z - 0.35); // its axis passes through the middle of the doorway
  spill.target.position.set(2.6, 0.3, -2.6);
  spill.castShadow = true;
  spill.shadow.mapSize.set(1024, 1024);
  spill.shadow.camera.near = 0.6;
  spill.shadow.camera.far = 13;
  spill.shadow.bias = -0.0012;
  spill.shadow.normalBias = 0.03;
  spill.shadow.radius = 3;
  const doorFill = new THREE.PointLight(look.key.color, 0, 8, 1.6);
  doorFill.position.set(3.4, 2.1, -1.6);
  scene.add(sun, sun.target, soft, rim, spill, spill.target, doorFill);

  // the door swings on a damped spring: it eases out of the latch, slows into its stop and settles
  const OPEN = -1.45;
  let hall = 0, swing = 0, swingV = 0;
  return {
    room, door, write, chairs,
    lights: { sun, soft, rim, spill, doorFill },
    /** Shut the door at once (a chapter jump). */
    reset() { swing = swingV = 0; door.rotation.y = 0; hall = 0; },
    /**
     * Per-frame ambience. `on` lights the set; `door` is where the door is going (0 shut, 1 open);
     * `hall` (0..1) is how much the hallway matters in the story right now. The spill follows the
     * door's angle smoothly, so it can never snap or flicker.
     */
    update(_T: number, dt: number, mood: { on: boolean; hall: number; door: number }) {
      const h = Math.min(dt, 1 / 30);
      swingV += ((mood.door - swing) * 30 - swingV * 9.5) * h;
      swing = clamp(swing + swingV * h, 0, 1.02);
      door.rotation.y = OPEN * swing;
      hall += ((mood.on ? mood.hall : 0) - hall) * clamp(dt * 2.2);
      const open = THREE.MathUtils.smoothstep(swing, 0.01, 0.85);
      sun.intensity = mood.on ? look.key.intensity : 0;
      soft.intensity = mood.on ? look.key.intensity * 0.22 : 0;
      rim.intensity = mood.on ? look.rim.intensity : 0;
      spill.intensity = mood.on ? look.key.intensity * 5 * open * (0.35 + 0.65 * hall) : 0;
      doorFill.intensity = mood.on ? look.key.intensity * 0.5 * hall * open : 0;
    },
  };
}
export type Classroom = ReturnType<typeof buildClassroom>;
