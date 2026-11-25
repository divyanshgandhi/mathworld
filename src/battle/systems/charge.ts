import * as THREE from "three";
import type { Stage } from "@/engine/stage";
import { fmt } from "./fleetView";
import { LOOK, reducedMotion } from "../look";
import { inkText } from "./ink";

/**
 * The charge: the number the cadet types, drawn on the rocket's nose in the display voice, so their
 * eyes stay on the action (OVERHAUL.md: "what the player types appears on the cannon"). Each digit
 * pulses it a little; 0 shows as "0"; null hides it. When the volley fires it counts down as the balls
 * leave (42 … 0): the answer IS the number of balls. It keeps at least `px` CSS pixels tall on screen.
 */
export function createCharge(stage: Stage, root: THREE.Object3D, nose: (out: THREE.Vector3) => THREE.Vector3) {
  const ink = inkText("", { color: LOOK.charge.ink, weight: LOOK.charge.weight, stretch: true });
  ink.mesh.visible = false;
  ink.mesh.renderOrder = 7;
  root.add(ink.mesh);
  let shown: number | null = null, pulse = -9, fade = -1;
  const at = new THREE.Vector3();
  const show = (n: number | null) => {
    if (n === shown) return;
    shown = n;
    fade = -1;
    if (n === null) { ink.mesh.visible = false; return; }
    ink.set(fmt(n));
    ink.mesh.visible = true;
    pulse = stage.time;
  };
  return {
    get value() { return shown; },
    /** The digits being typed (null: nothing typed). */
    set(n: number | null) { show(n); },
    /** A ball leaves: the number drops by what it carries. */
    take(worth: number) { if (shown !== null) show(Math.max(0, shown - worth)); },
    /** The volley is over: the 0 fades away. */
    release() { if (shown !== null) fade = stage.time; },
    /** Place it over the nose, `pxH` CSS px tall at `unitsPerPx` world units per px. */
    update(unitsPerPx: number, pxH: number) {
      if (!ink.mesh.visible) return;
      const now = stage.time, k = (now - pulse) / LOOK.quick;
      const s = k < 1 && !reducedMotion() ? 1 + Math.sin(Math.PI * k) * 0.14 : 1;
      // `pxH` is the digits' own height on screen; the text plane is taller than its figures
      const h = (pxH / 0.6) * unitsPerPx;
      ink.height(h * s);
      root.worldToLocal(nose(at));
      ink.mesh.position.set(at.x, at.y + h * 0.62, at.z + 0.4);
      if (fade >= 0) {
        const f = Math.min(1, (now - fade) / 0.35);
        (ink.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - f;
        if (f >= 1) { ink.mesh.visible = false; shown = null; fade = -1; (ink.mesh.material as THREE.MeshBasicMaterial).opacity = 1; }
      } else (ink.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
    },
    dispose() { ink.dispose(); },
  };
}
export type Charge = ReturnType<typeof createCharge>;
