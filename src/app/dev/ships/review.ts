import * as THREE from "three";
import type { Stage } from "@/engine/stage";
import { fleetOf } from "@/rig/fleet";
import { unitLabel } from "@/rig/fleet";
import { applyLook, type LookId } from "@/worlds/looks";
import {
  makeCarrier, makeDreadnought, makeFighterLite, makeGhost, makeInvader, makePlasmaBall, makeRocket, makeTenSquadPod,
  squadStyle, BLASTERS,
} from "@/worlds/space/ships";

/**
 * /dev/ships: review scenes for the ship models on the void, at battle scale.
 * The fleet layout copies the battle's (src/worlds/space/arena.ts `build`): the same cell sizes, gaps,
 * gutters, formation scale, ship classes and fighter scale, and the battle's camera fit. The squad
 * styling is the one proposed for the battle: `squadStyle(gRow, gCol)` (tone by squad, leader first).
 */

// arena.ts constants (kept in step by hand: this is a review page, not the battle)
const CELL = 1.0, BIG = 2.4, GAP = 0.16, GUTTER = 0.75, FIGHTER = 0.78, LITE_OVER = 140;

/** The screen strip the battle HUD covers, as fractions of the frame (the battle's `safe`). */
export type Safe = { top: number; bottom: number; left: number; right: number };
export const SAFE = {
  desktop: { top: 0.15, bottom: 0.18, left: 0, right: 0 },
  phone: { top: 0.12, bottom: 0.42, left: 0, right: 0 },
} satisfies Record<string, Safe>;

/** The space look's lights, built the way every scene should: from the look, nothing else. */
function lights(stage: Stage, id: LookId) {
  const look = applyLook(stage, id), { scene } = stage;
  scene.fog = null;
  const key = new THREE.DirectionalLight(look.key.color, look.key.intensity);
  key.position.set(-8, 14, 10);
  const rim = new THREE.DirectionalLight(look.rim.color, look.rim.intensity);
  rim.position.set(6, 6, -10);
  scene.add(key, rim, new THREE.HemisphereLight(look.fill.sky, look.fill.ground, look.fill.intensity));
}

/** A fleet exactly as the battle lays it out, with the rocket under it. */
export function mountFleet(stage: Stage, a: number, b: number, safe: Safe) {
  const { scene, camera, mats: M } = stage;
  lights(stage, "space");
  const root = new THREE.Group(), formation = new THREE.Group();
  scene.add(root);
  root.add(formation);
  formation.position.set(0, 4.2, 0);

  const f = fleetOf(a, b), lite = f.ships.length > LITE_OVER;
  const colW = f.colParts.map((c) => { const k = String(c).length - 1, d = c / 10 ** k, w = k === 0 ? CELL : BIG; return { d, w, span: d * w + (d - 1) * GAP }; });
  const rowH = f.rowParts.map((r) => { const k = String(r).length - 1, d = r / 10 ** k, h = k === 0 ? CELL : BIG; return { d, h, span: d * h + (d - 1) * GAP }; });
  const colX: number[] = [], rowY: number[] = [];
  colW.reduce((x, c, i) => { colX[i] = x; return x + c.span + GUTTER; }, 0);
  rowH.reduce((y, r, i) => { rowY[i] = y; return y + r.span + GUTTER; }, 0);
  const W = colX[colX.length - 1] + colW[colW.length - 1].span, H = rowY[rowY.length - 1] + rowH[rowH.length - 1].span;
  const scale = Math.min(1.55, 11 / Math.max(W, 1), 6.6 / Math.max(H, 1));
  formation.scale.setScalar(scale);
  const slotsBefore = (parts: number[], i: number) => parts.slice(0, i).reduce((s, p) => s + p / 10 ** (String(p).length - 1), 0);
  for (const ship of f.ships) {
    const sec = f.sectors[ship.sector], cw = colW[sec.colBand], rh = rowH[sec.rowBand];
    const x = colX[sec.colBand] + ship.col * (cw.w + GAP) + cw.w / 2 - W / 2, y = H / 2 - (rowY[sec.rowBand] + ship.row * (rh.h + GAP) + rh.h / 2);
    const gRow = slotsBefore(f.rowParts, sec.rowBand) + ship.row, gCol = slotsBefore(f.colParts, sec.colBand) + ship.col;
    // a squad of one ship (3 × 10: one pod per squad) needs no leader
    const perSquad = f.colParts.reduce((n, c) => n + c / 10 ** (String(c).length - 1), 0);
    const style = { ...squadStyle(gRow, gCol), leader: perSquad > 1 && gCol === 0 };
    let g: THREE.Object3D;
    if (ship.k === 0) { g = lite ? makeFighterLite(M, style) : makeInvader(M, style); g.scale.setScalar(FIGHTER); }
    else if (ship.k === 1) g = makeTenSquadPod(M, sec.orient, style).group;
    else if (ship.k === 2) g = makeCarrier(M, sec.orient, style).group;
    else g = makeDreadnought(M, unitLabel(ship.k), sec.orient, style).group;
    g.position.set(x, y, 0);
    formation.add(g);
  }

  const rocket = makeRocket(M);
  rocket.group.rotation.set(-1.05, 0, 0);
  rocket.group.scale.setScalar(0.55);
  root.add(rocket.group);

  const fw = W * scale, fh = H * scale, bottom = 4.2 - fh / 2;
  rocket.group.position.set(0, bottom - 2.1, 1.8);
  const stop = stage.onUpdate((_dt, T) => {
    rocket.flicker(T, 1);
    // the battle's camera fit: fleet, axis-label room on the left, the rocket below
    const ymin = bottom - 2.9, ymax = 4.2 + fh / 2 + 1.0, xmin = -fw / 2 - 2.4, xmax = fw / 2 + 0.5;
    const Wp = stage.renderer.domElement.clientWidth || 1, Hp = stage.renderer.domElement.clientHeight || 1;
    const s = { top: safe.top * Hp, bottom: safe.bottom * Hp, left: safe.left * Wp, right: safe.right * Wp };
    const fwPx = Math.max(120, Wp - s.left - s.right), fhPx = Math.max(120, Hp - s.top - s.bottom), tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max(((ymax - ymin) * Hp) / (2 * tan * fhPx * 0.94), ((xmax - xmin) * Hp) / (2 * tan * fwPx * 0.94), 7);
    const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
    camera.position.set(cx, cy, d);
    camera.lookAt(cx, cy, 0);
    camera.setViewOffset(Wp, Hp, Wp / 2 - (s.left + fwPx / 2), Hp / 2 - (s.top + fhPx / 2), Wp, Hp);
  });
  camera.far = 3000;
  camera.updateProjectionMatrix();
  return { ships: f.ships.length, dispose() { stop(); camera.clearViewOffset(); scene.remove(root); } };
}

/** The rows of the line-up, top to bottom, for the page's legend. */
export const LINEUP = [
  "Rocket (battle size, upright) · drone, ember · drone, apricot · leader, ember · leader, apricot · cheap fighter · cheap leader · ghost fighter",
  "10 pod · 10 pod, 4 popped · 10 pod leader, apricot · 10 pod stood up",
  "100 carrier · 100 carrier, 37 popped · 1K flagship · 1K flagship, 4 tenths gone",
  `Plasma balls: ${Object.keys(BLASTERS).join(" · ")} (at fighter size)`,
];

/** Every ship type side by side at battle scale (formation scale 1). */
export function mountLineup(stage: Stage) {
  const { scene, camera, mats: M } = stage;
  lights(stage, "space");
  const root = new THREE.Group();
  scene.add(root);
  const row = (y: number, items: THREE.Object3D[], pitch: number) => items.forEach((o, i) => { o.position.set((i - (items.length - 1) / 2) * pitch, y, 0); root.add(o); });
  const fighter = (o: THREE.Object3D) => { o.scale.setScalar(FIGHTER); return o; };
  const rocket = makeRocket(M);
  rocket.group.scale.setScalar(0.55);
  const ghost = makeGhost();
  ghost.scale.setScalar(FIGHTER);
  row(6.2, [
    rocket.group, fighter(makeInvader(M)), fighter(makeInvader(M, { tone: "apricot" })), fighter(makeInvader(M, { leader: true })),
    fighter(makeInvader(M, { tone: "apricot", leader: true })), fighter(makeFighterLite(M)), fighter(makeFighterLite(M, { tone: "apricot", leader: true })), ghost,
  ], 1.45);
  const popped = makeTenSquadPod(M, "h");
  popped.micro.forEach((m, i) => { m.visible = i >= 4; });
  row(3.4, [makeTenSquadPod(M, "h").group, popped.group, makeTenSquadPod(M, "h", { tone: "apricot", leader: true }).group, makeTenSquadPod(M, "v").group], 2.9);
  const carrier = makeCarrier(M, "h");
  carrier.popped(37);
  const hurt = makeDreadnought(M, "1K", "h");
  hurt.damaged(0.4);
  row(0.6, [makeCarrier(M, "h").group, carrier.group, makeDreadnought(M, "1K", "h").group, hurt.group], 2.9);
  row(-1.4, Object.keys(BLASTERS).map((id) => { const g = new THREE.Group(), ball = makePlasmaBall(M, id); ball.rotation.y = Math.PI / 2; g.add(ball); if (BLASTERS[id as keyof typeof BLASTERS].twin) { const b2 = makePlasmaBall(M, id); b2.rotation.y = Math.PI / 2; ball.position.x = -0.12; b2.position.x = 0.12; g.add(b2); } return g; }), 1.6);
  const stop = stage.onUpdate((_dt, T) => {
    rocket.flicker(T, 1);
    const aspect = camera.aspect, needW = 12.4, needH = 10.4, tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max(needH / 2 / tan, needW / 2 / tan / aspect);
    camera.position.set(0, 2.4, d);
    camera.lookAt(0, 2.4, 0);
  });
  return { dispose() { stop(); scene.remove(root); } };
}
