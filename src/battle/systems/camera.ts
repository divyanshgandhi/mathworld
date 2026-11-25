import * as THREE from "three";
import { reducedMotion } from "../look";
import { FLEET_Y, type FleetView } from "./fleetView";

/**
 * Camera framing: the battle camera looks straight on. The HUD reports its footprint (`safe`, in px);
 * inside the free area that leaves, a band at the bottom belongs to the rocket (it rests at the bottom
 * centre, the same size on screen whatever the fleet), and the fleet fills the rest, as large as it
 * allows, at every aspect ratio. The camera eases to each new frame; `nudge` gives the last kill its jolt.
 */
export interface Safe { top: number; right: number; bottom: number; left: number }

/**
 * The fleet's box as the cadet sees it (battle-local units, turned with Flip It!): its edges, and `w` × `h`
 * for callers that want a size. The box is what is really there and need not be centred on the fleet: a
 * lesson's labels under the fleet reach down without reserving the same room above it.
 */
export function measure(fv: FleetView) {
  const r = fv.formation.rotation.z, c = Math.cos(r), s = Math.sin(r), k = fv.scale;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const put = (x: number, y: number) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  /** A box in the formation's own space (it turns with the fleet). */
  const box = (cx: number, cy: number, hx: number, hy: number) => {
    for (const [dx, dy] of [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]]) { const x = cx + dx, y = cy + dy; put((x * c - y * s) * k, (x * s + y * c) * k); }
  };
  // frame what is actually there: ships with their trick offsets, plus any ghosts
  box(0, 0, fv.fw / k / 2, fv.fh / k / 2);
  for (const v of fv.views) box(v.home.x + v.offset.x, v.home.y + v.offset.y, v.size.x / 2, v.size.y / 2);
  for (const g of fv.ghosts) { if (!g.visible) continue; const hs = g.userData.half as THREE.Vector2; box(g.position.x, g.position.y, hs.x, hs.y); }
  // labels on the fleet (running totals, parts, miss brackets) stay upright, so their size is the screen's way up
  for (const o of [...fv.visuals.children, ...fv.overlay.children]) {
    if (!o.visible || !o.userData.upright) continue;
    const pg = (o as THREE.Mesh).geometry as THREE.PlaneGeometry | undefined;
    const pw = pg?.parameters ? pg.parameters.width * o.scale.x : 0, ph = pg?.parameters ? pg.parameters.height * o.scale.y : 0;
    const x = o.position.x, y = o.position.y, wx = (x * c - y * s) * k, wy = (x * s + y * c) * k;
    put(wx - (pw / 2 + 0.2) * k, wy - (ph / 2 + 0.2) * k); put(wx + (pw / 2 + 0.2) * k, wy + (ph / 2 + 0.2) * k);
  }
  const ext = fv.overlay.userData.extent as { x: number; y: number } | undefined;
  if (ext) box(0, 0, ext.x, ext.y);
  return { w: Math.max(-x0, x1) * 2, h: Math.max(-y0, y1) * 2, left: x0, right: x1, bottom: FLEET_Y + y0, top: FLEET_Y + y1 };
}

/**
 * The box to frame (battle-local units). Out of a lesson it is the fleet with its visible labels,
 * symmetric about the rocket so the rocket stays at the bottom centre. In a lesson the camera pushes
 * in on the fleet, its labels and Nova, and nothing else. `pad`: how far the axis labels reach left of
 * and above the fleet.
 */
export function frameBox(m: { w: number; h: number; bottom: number; top?: number; left?: number; right?: number }, lessonOn: boolean, nova: { to: number; y: number }, pad = { left: 2.4, top: 1.0 }) {
  const top = m.top ?? FLEET_Y + m.h / 2, left = m.left ?? -m.w / 2, right = m.right ?? m.w / 2;
  // the left margin holds the scan counts and the squad ticks that land beside each leader
  let ymax = top + Math.max(0.35, pad.top), xmin = left - Math.max(0.95, pad.left);
  const xmax = right + 0.35;
  const ymin = m.bottom - 0.35;
  if (lessonOn) { xmin = Math.min(xmin, nova.to - 1.5); ymax = Math.max(ymax, nova.y + 1.1); return { xmin, xmax, ymin, ymax }; }
  const half = Math.max(-xmin, xmax);
  return { xmin: -half, xmax: half, ymin, ymax };
}

/** The rocket's band at the bottom of the free area, in CSS px (it holds the rocket and the number on its nose). */
/** On a short free area (a small phone) the band shrinks so the fleet keeps its size (review round, point 7). */
export const rocketBand = (freeH: number) => Math.round(freeH < 280 ? Math.max(56, freeH * 0.26) : freeH < 420 ? Math.max(80, freeH * 0.22) : Math.max(108, Math.min(196, freeH * 0.28)));

export function createCameraRig(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement, origin: THREE.Vector3) {
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let init = false, kick = { t0: -9, x: 0, y: 0 }, clock = 0;
  const tan = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const free = (safe: Safe) => {
    const W = canvas.clientWidth || 1, H = canvas.clientHeight || 1;
    return { W, H, fw: Math.max(120, W - safe.left - safe.right), fh: Math.max(160, H - safe.top - safe.bottom) };
  };
  const rig = {
    safe: { top: 150, right: 0, bottom: 0, left: 0 } as Safe,
    /** The rocket band (px) this frame; 0 in a lesson pushes the fleet down to the bottom edge. */
    band: 0,
    /**
     * Ease toward framing `box` in the free area above the rocket band. `withBand` false (a lesson): the
     * box may use the whole free area. `maxPpu`: the most px per world unit (keeps a tiny fleet a sane size).
     */
    follow(dt: number, box: { xmin: number; xmax: number; ymin: number; ymax: number }, withBand = true, maxPpu = Infinity, lift = 0) {
      const { safe } = rig, { W, H, fw, fh } = free(safe), t = tan();
      clock += dt;
      const band = withBand ? rocketBand(fh) : Math.min(90, rocketBand(fh) * 0.5);
      rig.band = band;
      // `lift`: px the rocket is raised so its flame clears the caption band; the fleet keeps above it
      const availH = Math.max(80, fh - band - lift);
      const bw = box.xmax - box.xmin, bh = box.ymax - box.ymin;
      // as large as the free area allows, but a tiny fleet is not blown up past `maxPpu` px per unit
      const d = Math.max((bh * H) / (2 * t * availH * 0.94), (bw * H) / (2 * t * fw * 0.94), H / (2 * t * maxPpu), 7);
      const ppu = H / (2 * d * t);
      // the free area's centre on screen sits `band / 2` px below the box's centre
      const cx = (box.xmin + box.xmax) / 2, cy = (box.ymin + box.ymax) / 2 - (band + lift) / 2 / ppu;
      const targetPos = new THREE.Vector3(origin.x + cx, origin.y + cy, origin.z + d), targetLook = new THREE.Vector3(origin.x + cx, origin.y + cy, origin.z);
      if (!init) { camPos.copy(targetPos); camLook.copy(targetLook); init = true; }
      camPos.lerp(targetPos, Math.min(1, dt * 3)); camLook.lerp(targetLook, Math.min(1, dt * 3));
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      // the last kill's jolt: a quick decaying shake of the whole view
      const k = clock - kick.t0;
      if (k >= 0 && k < 0.3) { const e = Math.exp(-k * 16) * Math.cos(k * 50); camera.position.x += kick.x * e; camera.position.y += kick.y * e; }
      camera.setViewOffset(W, H, W / 2 - (safe.left + fw / 2), H / 2 - (safe.top + fh / 2), W, H);
    },
    /** Screen px per world unit on the plane `z` (battle-local), as framed right now. */
    pxPerUnit(z = 0) {
      const d = camPos.z - origin.z - z, H = canvas.clientHeight || 1;
      return d > 0 ? H / (2 * d * tan()) : 0;
    },
    /**
     * The point on the plane `z` (battle-local) that shows `up` px above the bottom edge of the free
     * area, at its horizontal centre: where the rocket rests.
     */
    bottomCentre(up: number, z: number, out = new THREE.Vector3()) {
      const { fh } = free(rig.safe), ppu = rig.pxPerUnit(z);
      if (!ppu) return out.set(0, 0, z);
      // the view's centre is the free area's centre (setViewOffset), on the camera's axis
      return out.set(camLook.x - origin.x, camLook.y - origin.y - (fh / 2 - up) / ppu, z);
    },
    /** The world point on the plane `z` (battle-local) shown `dx`, `dy` px from the free area's centre (y up). */
    at(dx: number, dy: number, z: number, out = new THREE.Vector3()) {
      const ppu = rig.pxPerUnit(z) || 1;
      return out.set(camLook.x + dx / ppu, camLook.y + dy / ppu, origin.z + z);
    },
    /** The free area right now, in CSS px. */
    get free() { return free(rig.safe); },
    /** A small jolt (world units at the fleet), for the last ship's kill. Off with reduced motion. */
    nudge(x: number, y: number) { if (!reducedMotion()) kick = { t0: clock, x, y }; },
    dispose() { camera.clearViewOffset(); },
  };
  return rig;
}
