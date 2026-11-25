import * as THREE from "three";
import { FLEET_Y, type FleetView } from "./fleetView";

/**
 * Camera framing: the battle camera looks straight on and frames what is actually there (ships with
 * their trick offsets, ghosts, labels) plus the rocket, inside the part of the screen the HUD leaves
 * free (`safe`, in px). It eases to each new frame.
 */
export interface Safe { top: number; right: number; bottom: number; left: number }

/** The fleet's on-screen size as the cadet sees it (`w` × `h`, turned with Flip It!) and its lower edge. */
export function measure(fv: FleetView) {
  // frame what is actually there: ships with their trick offsets, plus any ghosts
  let ex = fv.fw / fv.scale / 2, ey = fv.fh / fv.scale / 2;
  for (const v of fv.views) { ex = Math.max(ex, Math.abs(v.home.x + v.offset.x) + v.size.x / 2); ey = Math.max(ey, Math.abs(v.home.y + v.offset.y) + v.size.y / 2); }
  for (const g of fv.ghosts) { const hs = g.userData.half as THREE.Vector2; ex = Math.max(ex, Math.abs(g.position.x) + hs.x); ey = Math.max(ey, Math.abs(g.position.y) + hs.y); }
  // labels on the fleet (running totals, parts) are framed too, so none hides behind the keypad
  for (const c of fv.visuals.children) {
    const pg = (c as THREE.Mesh).geometry as THREE.PlaneGeometry | undefined;
    if (!c.visible || !c.userData.upright || !pg?.parameters) continue;
    const [hw, hh] = fv.flipped ? [pg.parameters.height / 2, pg.parameters.width / 2] : [pg.parameters.width / 2, pg.parameters.height / 2];
    ex = Math.max(ex, Math.abs(c.position.x) + hw + 0.2); ey = Math.max(ey, Math.abs(c.position.y) + hh + 0.2);
  }
  const h = (fv.flipped ? ex : ey) * 2 * fv.scale, w = (fv.flipped ? ey : ex) * 2 * fv.scale;
  return { w, h, bottom: FLEET_Y - h / 2 };
}

/** The box to frame (battle-local units): the fleet and rocket, or in a lesson the fleet and Nova. */
export function frameBox(m: { w: number; h: number; bottom: number }, lessonOn: boolean, nova: { to: number; y: number }) {
  // a lesson pushes the camera in: frame the fleet and Nova, leave the rocket at the bottom edge
  // (the bottom keeps room for Nova's caption, which floats over the rocket's place)
  const ymin = lessonOn ? m.bottom - 1.9 : m.bottom - 2.9, xmax = m.w / 2 + 0.5;
  let ymax = FLEET_Y + m.h / 2 + 1.0, xmin = -m.w / 2 - 2.4;
  if (lessonOn) { xmin = Math.min(xmin, nova.to - 1.5); ymax = Math.max(ymax, nova.y + 1.1); }
  return { xmin, xmax, ymin, ymax };
}

export function createCameraRig(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement, origin: THREE.Vector3) {
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let init = false;
  const rig = {
    safe: { top: 150, right: 0, bottom: 0, left: 0 } as Safe,
    /** Ease toward framing `box` this frame. */
    follow(dt: number, box: { xmin: number; xmax: number; ymin: number; ymax: number }) {
      const { safe } = rig, { xmin, xmax, ymin, ymax } = box;
      const W = canvas.clientWidth || 1, H = canvas.clientHeight || 1;
      const fwPx = Math.max(120, W - safe.left - safe.right), fhPx = Math.max(120, H - safe.top - safe.bottom), tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const d = Math.max(((ymax - ymin) * H) / (2 * tan * fhPx * 0.94), ((xmax - xmin) * H) / (2 * tan * fwPx * 0.94), 7);
      const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
      const targetPos = new THREE.Vector3(origin.x + cx, origin.y + cy, origin.z + d), targetLook = new THREE.Vector3(origin.x + cx, origin.y + cy, origin.z);
      if (!init) { camPos.copy(targetPos); camLook.copy(targetLook); init = true; }
      camPos.lerp(targetPos, Math.min(1, dt * 3)); camLook.lerp(targetLook, Math.min(1, dt * 3));
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      camera.setViewOffset(W, H, W / 2 - (safe.left + fwPx / 2), H / 2 - (safe.top + fhPx / 2), W, H);
    },
    dispose() { camera.clearViewOffset(); },
  };
  return rig;
}
