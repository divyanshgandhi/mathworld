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

/** The fleet's on-screen size as the cadet sees it (`w` × `h`, turned with Flip It!) and its lower edge. */
export function measure(fv: FleetView) {
  // frame what is actually there: ships with their trick offsets, plus any ghosts
  let ex = fv.fw / fv.scale / 2, ey = fv.fh / fv.scale / 2;
  for (const v of fv.views) { ex = Math.max(ex, Math.abs(v.home.x + v.offset.x) + v.size.x / 2); ey = Math.max(ey, Math.abs(v.home.y + v.offset.y) + v.size.y / 2); }
  for (const g of fv.ghosts) { const hs = g.userData.half as THREE.Vector2; ex = Math.max(ex, Math.abs(g.position.x) + hs.x); ey = Math.max(ey, Math.abs(g.position.y) + hs.y); }
  // labels on the fleet (running totals, parts, miss brackets) are framed too, so none hides behind the HUD
  for (const c of [...fv.visuals.children, ...fv.overlay.children]) {
    if (!c.visible || !c.userData.upright) continue;
    const pg = (c as THREE.Mesh).geometry as THREE.PlaneGeometry | undefined;
    const pw = pg?.parameters ? pg.parameters.width * c.scale.x : 0, ph = pg?.parameters ? pg.parameters.height * c.scale.y : 0;
    const [hw, hh] = fv.flipped ? [ph / 2, pw / 2] : [pw / 2, ph / 2];
    ex = Math.max(ex, Math.abs(c.position.x) + hw + 0.2); ey = Math.max(ey, Math.abs(c.position.y) + hh + 0.2);
  }
  const ext = fv.overlay.userData.extent as { x: number; y: number } | undefined;
  if (ext) { ex = Math.max(ex, ext.x); ey = Math.max(ey, ext.y); }
  const h = (fv.flipped ? ex : ey) * 2 * fv.scale, w = (fv.flipped ? ey : ex) * 2 * fv.scale;
  return { w, h, bottom: FLEET_Y - h / 2 };
}

/**
 * The box to frame (battle-local units). Out of a lesson it is the fleet with its visible labels,
 * symmetric about the rocket so the rocket stays at the bottom centre. In a lesson the camera pushes
 * in on the fleet and Nova. `pad`: how far the visible axis labels reach left of and above the fleet.
 */
export function frameBox(m: { w: number; h: number; bottom: number }, lessonOn: boolean, nova: { to: number; y: number }, pad = { left: 2.4, top: 1.0 }) {
  let ymax = FLEET_Y + m.h / 2 + Math.max(0.35, pad.top), xmin = -m.w / 2 - Math.max(0.35, pad.left);
  const xmax = m.w / 2 + 0.35;
  const ymin = m.bottom - 0.35;
  if (lessonOn) { xmin = Math.min(xmin, nova.to - 1.5); ymax = Math.max(ymax, nova.y + 1.1); return { xmin, xmax, ymin, ymax }; }
  const half = Math.max(-xmin, xmax);
  return { xmin: -half, xmax: half, ymin, ymax };
}

/** The rocket's band at the bottom of the free area, in CSS px (it holds the rocket and the number on its nose). */
export const rocketBand = (freeH: number) => Math.round(Math.max(112, Math.min(196, freeH * 0.28)));

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
     * Ease toward framing `box` in the free area above the rocket band. `band` false (a lesson): the box
     * may use the whole free area.
     */
    follow(dt: number, box: { xmin: number; xmax: number; ymin: number; ymax: number }, withBand = true) {
      const { safe } = rig, { W, H, fw, fh } = free(safe), t = tan();
      clock += dt;
      const band = withBand ? rocketBand(fh) : Math.min(90, rocketBand(fh) * 0.5);
      rig.band = band;
      const availH = Math.max(80, fh - band);
      const bw = box.xmax - box.xmin, bh = box.ymax - box.ymin;
      const d = Math.max((bh * H) / (2 * t * availH * 0.94), (bw * H) / (2 * t * fw * 0.94), 7);
      const ppu = H / (2 * d * t);
      // the free area's centre on screen sits `band / 2` px below the box's centre
      const cx = (box.xmin + box.xmax) / 2, cy = (box.ymin + box.ymax) / 2 - band / 2 / ppu;
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
