import * as THREE from "three";
import { COLOR, INK, MASTERY } from "@/design/tokens";
import { add, canvasTexture, fitText, outline } from "@/engine/materials";
import type { Stage } from "@/engine/stage";
import { seeded } from "@/engine/util";
import type { Poster } from "@/director/hub";
import type { Band } from "@/rig/adaptive";
import { makeNova } from "./cast";
import { makeBody, starfield } from "./planets";

/**
 * The Resting Bay (SPEC §2.4): the cadet's cabin, seen as a cut-away diorama so it always fits the
 * screen. The back wall has three doors (The Hangar, Launch to Space, The Academy) under a window
 * onto the Solar System; the left wall holds the ×1–×10 posters, lit from folded mastery; the desk
 * holds the collected Trick Cards and the Quick Flashcards deck. Nova idles by the desk.
 * The HUD pins its buttons to `anchor(id)`: door:*, poster:1…10, desk:cards, desk:deck.
 */
/** A token colour laid over the void at strength `t`, as a CSS hex string (works on canvas and in CSS). */
function over(c: string, t: number): string {
  const a = parseInt(COLOR.void.slice(1), 16), b = parseInt(c.slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

/** Bay posters use the mastery colours (Gold, Got it, Learning, New), so the 2D marks and the 3D posters agree. */
export const BAND_COLOURS: Record<Band, { bg: string; ink: string; edge: string }> = {
  unseen: { bg: COLOR.panel, ink: INK[3], edge: COLOR.horizon },
  practicing: { bg: over(MASTERY.learn.color, 0.16), ink: MASTERY.learn.color, edge: MASTERY.learn.color },
  understood: { bg: over(MASTERY.got.color, 0.12), ink: MASTERY.got.color, edge: MASTERY.got.color },
  gold: { bg: over(MASTERY.gold.color, 0.16), ink: MASTERY.gold.color, edge: MASTERY.gold.color },
};

const W = 15, D = 10, HGT = 5.6; // room: x −7.5…7.5, z −6…4, floor at 0
const BACK = -6;
const LW = 7, FLARE = 0.5; // the flared left wall: length, and how far it opens toward the cadet (rad)

function sign(text: string, w: number, h: number, colour = "#d9f99d") {
  const { texture, ctx } = canvasTexture(512, Math.round((512 * h) / w));
  const c = ctx.canvas;
  ctx.fillStyle = "#0b0f1f"; ctx.beginPath(); ctx.roundRect(0, 0, c.width, c.height, 18); ctx.fill();
  ctx.strokeStyle = colour; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(6, 6, c.width - 12, c.height - 12, 14); ctx.stroke();
  ctx.fillStyle = colour;
  fitText(ctx, text, c.width / 2, c.height / 2 + 2, c.width - 50, c.height * 0.5, "800", "Saira, sans-serif");
  texture.needsUpdate = true;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.55, roughness: 0.6 }));
}

/** Draw one poster: "×7" and its ten facts, each cell in its mastery colour, the frame in the poster's. */
function drawPoster(ctx: CanvasRenderingContext2D, p: Poster) {
  const c = ctx.canvas, w = c.width, h = c.height, frame = BAND_COLOURS[p.band];
  ctx.fillStyle = "#0b0f1f"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = frame.edge; ctx.fillRect(0, 0, w, 10); ctx.fillRect(0, h - 10, w, 10); ctx.fillRect(0, 0, 10, h); ctx.fillRect(w - 10, 0, 10, h);
  ctx.fillStyle = frame.edge;
  fitText(ctx, `×${p.table}`, w / 2, 52, w - 40, 64, "800", "Saira, sans-serif");
  const top = 100, rowH = (h - top - 22) / 10;
  p.cells.forEach((cell, i) => {
    const col = BAND_COLOURS[cell.band], y = top + i * rowH;
    ctx.fillStyle = col.bg; ctx.beginPath(); ctx.roundRect(20, y + 3, w - 40, rowH - 6, 8); ctx.fill();
    ctx.fillStyle = col.ink;
    fitText(ctx, `${p.table} × ${cell.n} = ${p.table * cell.n}`, w / 2, y + rowH / 2 + 1, w - 60, rowH * 0.62, "700", "Saira, sans-serif");
  });
}

export function mountRestingBay(stage: Stage, init: { posters: Poster[]; cards: string[] }) {
  const { scene, camera, mats: M } = stage, rnd = seeded(77), root = new THREE.Group(), nc = { cast: false };
  scene.add(root);
  scene.background = new THREE.Color(0x05070f);
  scene.fog = null;
  camera.fov = 42;
  camera.far = 3000;
  camera.updateProjectionMatrix();
  Object.assign(stage.bloom, { strength: 0.35, radius: 0.4, threshold: 1.1 });
  stage.renderer.toneMappingExposure = 1.05;
  stage.grade.vig.value = 0.38;

  // ---- the shell: floor, back wall with a window, left wall, right wall ----
  const floorTex = canvasTexture(512, 512);
  {
    const x = floorTex.ctx;
    x.fillStyle = "#2b3247"; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? "#2f374e" : "#283045"; x.fillRect(0, i * 64, 512, 62); }
    x.fillStyle = "rgba(190,242,100,0.25)"; x.fillRect(0, 252, 512, 4);
    floorTex.texture.wrapS = floorTex.texture.wrapT = THREE.RepeatWrapping;
    floorTex.texture.repeat.set(3, 2);
    floorTex.texture.needsUpdate = true;
  }
  add(root, new THREE.PlaneGeometry(W + 6, D), M.clay(0xffffff, { map: floorTex.texture, roughness: 0.55, metalness: 0.2 }), -3, 0, BACK + D / 2).rotation.x = -Math.PI / 2;
  const wallMat = M.clay(0x39415c, { roughness: 0.7 }), trim = M.clay(0x1b2238, { roughness: 0.5, metalness: 0.4 });
  // back wall, built around the window (x −3.4…3.4, y 3.3…5.1)
  const wx = 3.4, wy0 = 3.35, wy1 = 5.15;
  add(root, new THREE.BoxGeometry(W, wy0, 0.3), wallMat, 0, wy0 / 2, BACK - 0.15);
  add(root, new THREE.BoxGeometry(W / 2 - wx, HGT - wy0, 0.3), wallMat, -(wx + (W / 2 - wx) / 2), wy0 + (HGT - wy0) / 2, BACK - 0.15);
  add(root, new THREE.BoxGeometry(W / 2 - wx, HGT - wy0, 0.3), wallMat, wx + (W / 2 - wx) / 2, wy0 + (HGT - wy0) / 2, BACK - 0.15);
  add(root, new THREE.BoxGeometry(2 * wx, HGT - wy1, 0.3), wallMat, 0, wy1 + (HGT - wy1) / 2, BACK - 0.15);
  for (const [x, y, w, h] of [[0, wy0, 2 * wx + 0.3, 0.14], [0, wy1, 2 * wx + 0.3, 0.14], [-wx, (wy0 + wy1) / 2, 0.14, wy1 - wy0], [wx, (wy0 + wy1) / 2, 0.14, wy1 - wy0], [0, (wy0 + wy1) / 2, 0.08, wy1 - wy0]] as const) add(root, new THREE.BoxGeometry(w, h, 0.3), trim, x, y, BACK - 0.08);
  // the left wall flares out toward the front like a stage set, so its posters face the cadet
  const lw = new THREE.Group();
  lw.position.set(-W / 2, 0, BACK);
  lw.rotation.y = -Math.PI / 2 - FLARE;
  root.add(lw);
  add(lw, new THREE.BoxGeometry(LW, HGT, 0.3), wallMat, LW / 2, HGT / 2, 0.15);
  lw.updateMatrixWorld(true);
  add(root, new THREE.BoxGeometry(0.3, HGT, D), wallMat, W / 2 + 0.15, HGT / 2, BACK + D / 2);
  // skirting light strip
  add(root, new THREE.BoxGeometry(W, 0.05, 0.05), M.glow(0x38bdf8, 1.2), 0, 0.08, BACK + 0.05, nc);

  // ---- the view: the Sun and planets through the window ----
  const view = new THREE.Group();
  view.position.set(0, 4.2, BACK - 40);
  root.add(view);
  const sun = makeBody(M, "sun", 2.2);
  sun.group.position.set(-4.5, 0.3, -10);
  view.add(sun.group);
  for (const [id, x, y, r] of [["earth", 3.2, -1.2, 2.0], ["moon", 5.6, 0.8, 0.5], ["saturn", 0.2, 1.6, 0.9]] as const) {
    const b = makeBody(M, id, r, { glow: 0.35 });
    b.group.position.set(x, y, 0);
    view.add(b.group);
  }
  view.add(starfield(900, 120, rnd, new THREE.Vector3(0, 0, -40)));

  // ---- three doors on the back wall ----
  const doors: Record<string, THREE.Vector3> = {};
  const door = (id: string, x: number, w: number, h: number, label: string, colour: number, signCol: string) => {
    const g = new THREE.Group();
    g.position.set(x, 0, BACK + 0.02);
    root.add(g);
    add(g, new THREE.BoxGeometry(w + 0.36, h + 0.2, 0.2), trim, 0, (h + 0.2) / 2, 0.02);
    const panel = add(g, new THREE.BoxGeometry(w, h, 0.12), M.clay(colour, { roughness: 0.45, metalness: 0.3 }), 0, h / 2, 0.12);
    outline(panel, M);
    add(g, new THREE.BoxGeometry(0.06, h - 0.3, 0.02), M.clay(0x0b0f1f), 0, h / 2, 0.19, nc); // the split between the two leaves
    add(g, new THREE.BoxGeometry(w * 0.9, 0.06, 0.04), M.glow(new THREE.Color(signCol).getHex(), 1.3), 0, h + 0.14, 0.14, nc);
    const s = sign(label, Math.max(w + 0.4, 2.2), 0.5, signCol);
    s.position.set(0, h + 0.52, 0.16);
    g.add(s);
    doors[id] = new THREE.Vector3(x, h / 2 + 0.2, BACK + 0.4);
  };
  door("hangar", -4.6, 1.9, 2.75, "THE HANGAR", 0x4b5a7c, "#7dd3fc");
  door("launch", 0, 2.5, 3.0, "LAUNCH TO SPACE", 0x5a6b3c, "#bef264");
  door("academy", 4.6, 1.9, 2.75, "THE ACADEMY", 0x5c4b7c, "#d8b4fe");

  // ---- the poster wall: ×1–×10 on the flared left wall (its room side is local −z) ----
  const posterAt: Record<number, THREE.Vector3> = {};
  const posterTex = new Map<number, ReturnType<typeof canvasTexture>>();
  const posterMats: THREE.MeshStandardMaterial[] = [];
  const PW = 1.05, PH = 1.42;
  for (let i = 0; i < 10; i++) {
    const row = Math.floor(i / 5), col = i % 5;
    const t = canvasTexture(256, 352);
    posterTex.set(i + 1, t);
    const m = new THREE.MeshStandardMaterial({ map: t.texture, emissive: 0xffffff, emissiveMap: t.texture, emissiveIntensity: 0.35, roughness: 0.7 });
    posterMats.push(m);
    const x = 0.95 + (4 - col) * 1.25, y = row === 0 ? 3.65 : 2.05;
    const p = add(lw, new THREE.PlaneGeometry(PW, PH), m, x, y, -0.05, nc);
    p.rotation.y = Math.PI;
    add(lw, new THREE.BoxGeometry(PW + 0.08, PH + 0.08, 0.04), trim, x, y, -0.02, nc);
    posterAt[i + 1] = lw.localToWorld(new THREE.Vector3(x, y, -0.2));
  }
  const posterLabel = sign("TIMES TABLES", 2.6, 0.42, "#fde68a");
  posterLabel.rotation.y = Math.PI;
  posterLabel.position.set(0.95 + 2 * 1.25, 4.8, -0.06);
  lw.add(posterLabel);
  function setPosters(ps: Poster[]) {
    for (const p of ps) { const t = posterTex.get(p.table); if (!t) continue; drawPoster(t.ctx, p); t.texture.needsUpdate = true; }
  }

  // ---- right wall: a bunk and a locker, so it reads as a cabin ----
  add(root, new THREE.BoxGeometry(1.6, 0.5, 3.4), M.clay(0x2a3250), W / 2 - 0.85, 0.55, BACK + 2.4);
  add(root, new THREE.BoxGeometry(1.4, 0.22, 3.2), M.fabric(0x3b82f6), W / 2 - 0.85, 0.91, BACK + 2.4);
  add(root, new THREE.BoxGeometry(1.1, 0.2, 0.6), M.fabric(0xf3eee6), W / 2 - 0.85, 1.1, BACK + 1.0);
  add(root, new THREE.BoxGeometry(1.0, 3.0, 1.2), M.clay(0x4b5670, { metalness: 0.4, roughness: 0.4 }), W / 2 - 0.55, 1.5, BACK + 5.2);
  const port = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.MeshBasicMaterial({ color: 0x0a1230 }));
  port.rotation.y = -Math.PI / 2;
  port.position.set(W / 2 - 0.02, 3.2, BACK + 2.4);
  root.add(port);
  const pe = makeBody(M, "earth", 0.45, { glow: 0.45 });
  pe.group.position.set(W / 2 - 0.06, 3.0, BACK + 2.2);
  root.add(pe.group);
  add(root, new THREE.TorusGeometry(0.9, 0.08, 12, 48), trim, W / 2 - 0.02, 3.2, BACK + 2.4).rotation.y = Math.PI / 2;

  // ---- the desk, with Trick Cards fanned out and the flashcard deck ----
  const desk = new THREE.Group();
  desk.position.set(1.6, 0, 0.4);
  root.add(desk);
  const wood = M.clay(0x8a5a3c, { roughness: 0.6 });
  add(desk, new THREE.BoxGeometry(3.4, 0.12, 1.3), wood, 0, 0.98, 0);
  for (const [x, z] of [[-1.55, -0.5], [1.55, -0.5], [-1.55, 0.5], [1.55, 0.5]]) add(desk, new THREE.BoxGeometry(0.1, 0.96, 0.1), M.clay(0x5a3a24), x, 0.48, z);
  const lamp = add(desk, new THREE.ConeGeometry(0.22, 0.3, 24, 1, true), M.clay(0xbef264, { side: THREE.DoubleSide }), 1.3, 1.6, -0.35);
  lamp.rotation.z = 0.5;
  add(desk, new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8), M.clay(0x1b2238), 1.42, 1.3, -0.35);
  const lampLight = new THREE.PointLight(0xfff1c8, 6, 5, 1.5);
  lampLight.position.set(1.1, 1.5, -0.2);
  desk.add(lampLight);
  const cards = new THREE.Group();
  desk.add(cards);
  function setCards(names: string[]) {
    cards.clear();
    const n = Math.max(names.length, 1);
    names.forEach((name, i) => {
      const t = canvasTexture(128, 176), x = t.ctx;
      x.fillStyle = "#fde68a"; x.beginPath(); x.roundRect(0, 0, 128, 176, 12); x.fill();
      x.fillStyle = "#1a1406"; x.fillRect(8, 8, 112, 4);
      fitText(x, "⚡", 64, 56, 100, 54, "700", "system-ui");
      for (const [k, word] of name.split(" ").entries()) fitText(x, word, 64, 108 + k * 26, 112, 22, "800", "ui-sans-serif, system-ui");
      t.texture.needsUpdate = true;
      const m = add(cards, new THREE.PlaneGeometry(0.3, 0.41), new THREE.MeshStandardMaterial({ map: t.texture, roughness: 0.7 }), -0.6 + (i - (n - 1) / 2) * 0.17, 1.045 + i * 0.002, 0.05, nc);
      m.rotation.set(-Math.PI / 2, 0, (i - (n - 1) / 2) * 0.12);
    });
    if (!names.length) {
      const t = canvasTexture(256, 96);
      t.ctx.fillStyle = "rgba(255,255,255,0.08)"; t.ctx.beginPath(); t.ctx.roundRect(0, 0, 256, 96, 12); t.ctx.fill();
      t.ctx.fillStyle = "#9aa3c0"; fitText(t.ctx, "no cards yet", 128, 48, 220, 28, "600", "system-ui");
      t.texture.needsUpdate = true;
      add(cards, new THREE.PlaneGeometry(0.7, 0.26), new THREE.MeshBasicMaterial({ map: t.texture, transparent: true }), -0.6, 1.045, 0.05, nc).rotation.x = -Math.PI / 2;
    }
  }
  // the flashcard deck: a small stack with a sky-blue band
  const deck = new THREE.Group();
  deck.position.set(0.7, 1.04, 0.1);
  desk.add(deck);
  for (let i = 0; i < 6; i++) add(deck, new THREE.BoxGeometry(0.34, 0.018, 0.46), M.clay(i === 5 ? 0x7dd3fc : 0xf3eee6), 0, i * 0.02, 0, nc).rotation.y = (rnd() - 0.5) * 0.1;
  // chair
  add(root, new THREE.BoxGeometry(0.8, 0.1, 0.8), M.clay(0x2b2d42), 1.4, 0.6, 1.5);
  add(root, new THREE.BoxGeometry(0.8, 0.9, 0.1), M.clay(0x2b2d42), 1.4, 1.05, 1.9);
  add(root, new THREE.CylinderGeometry(0.06, 0.06, 0.55, 8), M.clay(0x1b2238), 1.4, 0.28, 1.5);

  // Nova keeps the cadet company by the desk
  const nova = makeNova(M);
  nova.group.scale.setScalar(1.1);
  nova.group.position.set(-2.3, 0, 1.2);
  root.add(nova.group);

  // light: a warm ceiling key, cool window spill, soft fill
  const key = new THREE.DirectionalLight(0xfff1dc, 1.9);
  key.position.set(3, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
  const spill = new THREE.PointLight(0x7dd3fc, 8, 12, 1.4);
  spill.position.set(0, 4.2, BACK + 1.2);
  root.add(key, spill, new THREE.HemisphereLight(0xc8d8ff, 0x2a2238, 1.3));

  setPosters(init.posters);
  setCards(init.cards);

  // a cut-away diorama: the camera backs off until the whole room fits, at any aspect ratio
  const xmin = -W / 2 - LW * Math.sin(FLARE), xmax = W / 2;
  const look = new THREE.Vector3((xmin + xmax) / 2, 2.4, BACK + D / 2 - 1.2), cam = new THREE.Vector3();
  let mx = 0, my = 0;
  const onMove = (e: PointerEvent) => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; };
  window.addEventListener("pointermove", onMove);
  const stop = stage.onUpdate((dt, T) => {
    nova.animate(T, dt, 1.6, 0);
    sun.spin.rotation.y += dt * 0.05;
    pe.spin.rotation.y += dt * 0.1;
    const aspect = camera.aspect, tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fitW = ((xmax - xmin) / 2 + 1.6) / (tan * aspect), fitH = (HGT / 2 + 0.9) / tan;
    const dist = Math.max(fitW, fitH) * 0.98;
    cam.set(look.x + mx * 0.8, look.y + 0.9 - my * 0.4, look.z + dist);
    camera.position.lerp(cam, Math.min(1, dt * 3));
    if (T < 0.1) camera.position.copy(cam);
    camera.lookAt(look);
  });

  const deskAt = (o: THREE.Vector3) => desk.localToWorld(o.clone());
  return {
    setPosters, setCards,
    anchor(id: string): THREE.Vector3 | null {
      if (id.startsWith("door:")) return doors[id.slice(5)] ?? null;
      if (id.startsWith("poster:")) return posterAt[Number(id.slice(7))] ?? null;
      if (id === "desk:cards") return deskAt(new THREE.Vector3(-0.6, 1.3, 0.1));
      if (id === "desk:deck") return deskAt(new THREE.Vector3(0.7, 1.35, 0.1));
      return null;
    },
    dispose() { stop(); window.removeEventListener("pointermove", onMove); scene.remove(root); },
  };
}
export type RestingBay = ReturnType<typeof mountRestingBay>;
