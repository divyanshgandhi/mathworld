import * as THREE from "three";
import { add, canvasTexture, PALETTE, type Materials } from "@/engine/materials";
import type { Rng } from "@/engine/util";

/** Desk positions: 3 rows of 3, the board at z = -5. The player sits in the middle (index 4). */
export const SEATS: [number, number][] = [-1.6, 0.6, 2.8].flatMap((z) => [-2.6, 0, 2.6].map((x) => [x, z] as [number, number]));
export const PLAYER_SEAT = 4;
export const DOOR_POINT = new THREE.Vector3(6, 1.3, -3.5);

/**
 * The classroom on an ordinary Tuesday: 12 × 10 m, board on the front wall, windows on the left,
 * the door on the right (it opens outward into a softly lit hallway), nine desks.
 */
export function buildClassroom(scene: THREE.Scene, M: Materials, rnd: Rng) {
  const room = new THREE.Group();
  scene.add(room);
  const noCast = { cast: false };

  const plank = canvasTexture(256, 256);
  for (let i = 0; i < 8; i++) {
    const v = 150 + ((i * 37) % 5) * 9;
    plank.ctx.fillStyle = `rgb(${v + 34},${v + 4},${v - 36})`;
    plank.ctx.fillRect(0, i * 32, 256, 32);
    plank.ctx.fillStyle = "rgba(60,40,20,.35)";
    plank.ctx.fillRect(0, i * 32, 256, 2);
    plank.ctx.fillRect(((i * 97) % 200) + 20, i * 32, 2, 32);
  }
  plank.texture.wrapS = plank.texture.wrapT = THREE.RepeatWrapping;
  plank.texture.repeat.set(3, 3);
  add(room, new THREE.PlaneGeometry(12, 10), M.clay(0xffffff, { map: plank.texture, roughness: 0.8 }), 0, 0, 0, noCast).rotation.x = -Math.PI / 2;

  const wall = M.clay(0xdcd3c2, { roughness: 0.9 }), side = M.clay(0xd2cbbd, { roughness: 0.9 }), trim = M.clay(0xf2efe8), wood = M.clay(0x9a7350, { roughness: 0.7 }), metal = M.clay(0x5a5f6e, { roughness: 0.5, metalness: 0.3 });
  add(room, new THREE.BoxGeometry(12, 4, 0.2), wall, 0, 2, -5.1);
  add(room, new THREE.BoxGeometry(12, 4, 0.2), wall, 0, 2, 5.1);
  add(room, new THREE.BoxGeometry(0.2, 4, 10.4), side, -6.1, 2, 0);
  add(room, new THREE.BoxGeometry(0.2, 4, 0.9), side, 6.1, 2, -4.65);
  add(room, new THREE.BoxGeometry(0.2, 4, 7.9), side, 6.1, 2, 1.05);
  add(room, new THREE.BoxGeometry(0.2, 1.6, 1.2), side, 6.1, 3.2, -3.5);
  add(room, new THREE.PlaneGeometry(12, 10), M.clay(0xe8e4dc, { roughness: 0.95 }), 0, 4, 0, noCast).rotation.x = Math.PI / 2;
  add(room, new THREE.BoxGeometry(12, 0.18, 0.06), wood, 0, 0.09, -4.97);

  // windows: overcast daylight panes
  const pane = new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0xdbe9ff, emissiveIntensity: 1.2 });
  for (const z of [-2.4, 0.2, 2.8]) {
    add(room, new THREE.BoxGeometry(0.08, 1.8, 1.8), trim, -5.99, 2.2, z);
    add(room, new THREE.PlaneGeometry(1.6, 1.6), pane, -5.94, 2.2, z, noCast).rotation.y = Math.PI / 2;
    add(room, new THREE.BoxGeometry(0.04, 1.6, 0.05), trim, -5.92, 2.2, z);
    add(room, new THREE.BoxGeometry(0.04, 0.05, 1.6), trim, -5.92, 2.2, z);
  }

  // hallway beyond the door: a soft warm glow, never a blaze
  const hall = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd9b0, emissiveIntensity: 0.2 });
  add(room, new THREE.PlaneGeometry(3, 3), hall, 7.3, 1.5, -3.5, noCast).rotation.y = -Math.PI / 2;
  add(room, new THREE.BoxGeometry(2.4, 0.2, 3), M.clay(0x8a8170), 7.2, 0, -3.5);
  const door = new THREE.Group();
  door.position.set(6.02, 0, -4.1);
  room.add(door);
  add(door, new THREE.BoxGeometry(0.07, 2.35, 1.18), M.clay(0x5b7f95, { roughness: 0.55 }), 0, 1.175, 0.59);
  add(door, new THREE.SphereGeometry(0.05, 12, 8), M.clay(PALETTE.gold, { metalness: 0.7, roughness: 0.3 }), -0.07, 1.1, 1.05);
  add(door, new THREE.BoxGeometry(0.02, 0.5, 0.5), M.glow(0xcfe4ff, 0.3), -0.04, 1.75, 0.59);

  // chalkboard
  const board = canvasTexture(1024, 340);
  const write = (s: string) => {
    const x = board.ctx;
    x.fillStyle = "#2f4a3c";
    x.fillRect(0, 0, 1024, 340);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(255,255,255,${0.02 + rnd() * 0.04})`;
      x.beginPath();
      x.ellipse(rnd() * 1024, rnd() * 340, 40 + rnd() * 120, 10 + rnd() * 30, rnd() * 3, 0, 7);
      x.fill();
    }
    x.fillStyle = "rgba(240,238,228,.92)";
    x.font = 'bold 112px "Chalkboard SE","Comic Sans MS","Marker Felt",cursive';
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(s, 512, 180);
    x.font = '34px "Chalkboard SE","Comic Sans MS",cursive';
    x.textAlign = "left";
    x.fillStyle = "rgba(240,238,228,.6)";
    x.fillText("Tuesday", 40, 48);
    board.texture.needsUpdate = true;
  };
  add(room, new THREE.BoxGeometry(6.3, 2.3, 0.1), wood, 0, 2.05, -4.98);
  add(room, new THREE.PlaneGeometry(6, 2), M.clay(0xffffff, { map: board.texture, roughness: 0.95 }), 0, 2.05, -4.92, noCast);
  add(room, new THREE.BoxGeometry(5.6, 0.06, 0.14), wood, 0, 0.92, -4.86);

  // posters: the solar system foreshadows the adventure
  const poster = canvasTexture(256, 320);
  {
    const x = poster.ctx;
    x.fillStyle = "#1d2350"; x.fillRect(0, 0, 256, 320);
    x.fillStyle = "#ffd76b"; x.beginPath(); x.arc(30, 160, 70, 0, 7); x.fill();
    for (const [c, px, r] of [["#c9b8a6", 100, 6], ["#e8b36b", 125, 9], ["#5aa7e8", 152, 10], ["#e0704f", 178, 8], ["#e8c39a", 210, 18], ["#f0d9a8", 245, 15]] as [string, number, number][]) {
      x.fillStyle = c; x.beginPath(); x.arc(px, 160, r, 0, 7); x.fill();
    }
    x.fillStyle = "#f3f1ea"; x.font = "bold 24px sans-serif"; x.textAlign = "center";
    x.fillText("OUR SOLAR", 128, 48); x.fillText("SYSTEM", 128, 78);
    poster.texture.needsUpdate = true;
  }
  add(room, new THREE.PlaneGeometry(1, 1.25), M.clay(0xffffff, { map: poster.texture }), -5.95, 2.3, -4.25, noCast).rotation.y = Math.PI / 2;
  const ops = canvasTexture(256, 256);
  {
    const x = ops.ctx;
    x.fillStyle = "#fff4e0"; x.fillRect(0, 0, 256, 256);
    for (const [s, c, px, py] of [["+", "#ff8f70", 64, 70], ["−", "#3fa7d6", 192, 70], ["×", "#7ddc3e", 64, 190], ["÷", "#b79cff", 192, 190]] as [string, string, number, number][]) {
      x.fillStyle = c; x.font = "bold 110px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(s, px, py);
    }
    ops.texture.needsUpdate = true;
  }
  add(room, new THREE.PlaneGeometry(1.1, 1.1), M.clay(0xffffff, { map: ops.texture }), 4.4, 2.3, -4.95, noCast);

  // clock, lights, teacher's desk
  const clock = new THREE.Group();
  clock.position.set(0, 3.55, -4.97);
  room.add(clock);
  add(clock, new THREE.CylinderGeometry(0.24, 0.24, 0.05, 32), M.clay(0xffffff), 0, 0, 0.02).rotation.x = Math.PI / 2;
  add(clock, new THREE.TorusGeometry(0.24, 0.025, 8, 32), metal, 0, 0, 0.04);
  const hourHand = add(clock, new THREE.BoxGeometry(0.025, 0.12, 0.01), M.clay(PALETTE.dark), 0, 0.05, 0.06);
  const minuteHand = add(clock, new THREE.BoxGeometry(0.018, 0.18, 0.01), M.clay(PALETTE.dark), 0, 0.08, 0.065);
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3dc, emissiveIntensity: 2.2 });
  for (const z of [-1.2, 2.2]) {
    add(room, new THREE.BoxGeometry(2.4, 0.07, 0.16), tubeMat, 0, 3.86, z, noCast);
    add(room, new THREE.BoxGeometry(2.6, 0.05, 0.3), metal, 0, 3.92, z, noCast);
  }
  const tdesk = new THREE.Group();
  tdesk.position.set(2.5, 0, -3.7);
  room.add(tdesk);
  add(tdesk, new THREE.BoxGeometry(1.7, 0.08, 0.85), wood, 0, 0.76, 0);
  add(tdesk, new THREE.BoxGeometry(1.6, 0.7, 0.06), wood, 0, 0.38, -0.35);
  for (const s of [-1, 1]) add(tdesk, new THREE.BoxGeometry(0.06, 0.72, 0.8), wood, s * 0.8, 0.36, 0);
  add(tdesk, new THREE.SphereGeometry(0.09, 16, 12), M.clay(0xd94a4a, { roughness: 0.4 }), 0.5, 0.88, 0.1);
  for (const [c, y] of [[0x3fa7d6, 0.06], [0xff8f70, 0.11], [PALETTE.invader, 0.16]]) add(tdesk, new THREE.BoxGeometry(0.4, 0.05, 0.3), M.clay(c), -0.45, 0.78 + y, -0.05);

  // desks and chairs
  const deskTop = M.clay(0xc9a77c, { roughness: 0.7 }), chair = M.clay(0x6f9bb8, { roughness: 0.6 });
  for (const [x, z] of SEATS) {
    add(room, new THREE.BoxGeometry(1.15, 0.06, 0.62), deskTop, x, 0.72, z);
    for (const a of [-1, 1]) for (const b of [-1, 1]) add(room, new THREE.BoxGeometry(0.05, 0.7, 0.05), metal, x + a * 0.52, 0.35, z + b * 0.26);
    add(room, new THREE.BoxGeometry(0.5, 0.05, 0.44), chair, x, 0.45, z + 0.55);
    add(room, new THREE.BoxGeometry(0.5, 0.42, 0.05), chair, x, 0.72, z + 0.8);
    for (const a of [-1, 1]) for (const b of [-1, 1]) add(room, new THREE.BoxGeometry(0.04, 0.45, 0.04), metal, x + a * 0.22, 0.22, z + 0.55 + b * 0.2);
  }

  // dust in the air
  const dp: number[] = [];
  for (let i = 0; i < 260; i++) dp.push(-5.5 + rnd() * 11, 0.3 + rnd() * 3.3, -4.5 + rnd() * 9);
  const dg = new THREE.BufferGeometry();
  dg.setAttribute("position", new THREE.Float32BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff2d0, size: 0.025, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(dust);

  // lights: overcast window key, a flickering tube, the hallway spill and a soft fill for faces at the door
  const key = new THREE.DirectionalLight(0xd6e4ff, 1.8);
  key.position.set(-9, 7, 1.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  const tube = new THREE.PointLight(0xfff1d6, 22, 16, 2);
  tube.position.set(0, 3.5, 0.5);
  const spill = new THREE.SpotLight(0xffd9b0, 0, 16, 0.38, 0.75, 1.4);
  spill.position.set(8.4, 2.0, -3.5);
  spill.target.position.set(2, 0, -2);
  spill.castShadow = true;
  spill.shadow.mapSize.set(1024, 1024);
  const fill = new THREE.PointLight(0xffe8cc, 0, 9, 2);
  fill.position.set(2.6, 2.2, -1.6);
  scene.add(key, tube, spill, spill.target, fill);

  let flicker = 0;
  return {
    room, door, write, dust,
    lights: { key, tube, spill, fill },
    /** Per-frame ambience. `doorOpen` 0..1 drives the hallway spill; `buzz` enables the tired-tube flicker. */
    update(T: number, dt: number, mood: { hall: number; spill: number; fill: number; buzz: boolean; on: boolean }) {
      const open = door.rotation.y > 0.3 ? 1 : 0;
      const k = Math.min(1, dt * 2);
      hall.emissiveIntensity += (mood.hall * (open ? 1 : 0.25) - hall.emissiveIntensity) * k;
      spill.intensity += (mood.spill * open - spill.intensity) * k;
      fill.intensity += (mood.fill - fill.intensity) * k;
      key.intensity = mood.on ? 1.8 : 0;
      if (mood.buzz && flicker <= 0 && rnd() < 0.005) flicker = 0.35;
      if (flicker > 0) {
        flicker -= dt;
        const lit = rnd() > 0.5;
        tubeMat.emissiveIntensity = lit ? 2.2 : 0.3;
        tube.intensity = mood.on ? (lit ? 22 : 4) : 0;
      } else {
        tubeMat.emissiveIntensity = 2.2;
        tube.intensity = mood.on ? 22 : 0;
      }
      minuteHand.rotation.z = -T * 0.2;
      hourHand.rotation.z = -T * 0.017;
      dust.position.y = Math.sin(T * 0.25) * 0.12;
      dust.rotation.y = T * 0.012;
    },
  };
}
export type Classroom = ReturnType<typeof buildClassroom>;
