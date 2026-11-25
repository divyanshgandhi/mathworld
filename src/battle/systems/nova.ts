import * as THREE from "three";
import { audio } from "@/engine/audio";
import type { Stage } from "@/engine/stage";
import { makeNova } from "@/worlds/space/cast";
import { FLEET_Y } from "./fleetView";

/** Nova in the battle: she flies in beside the fleet's top-left corner for a lesson, away otherwise (no glow in battle). */
export function createNovaFigure(stage: Stage, root: THREE.Group) {
  const nova = makeNova(stage.mats, { glow: false });
  nova.group.scale.setScalar(1.7);
  nova.group.visible = false;
  root.add(nova.group);
  let x = -40;
  return {
    /** Where she flies to and her height, for a fleet `w` × `h` on screen. */
    target: (w: number, h: number, lessonOn: boolean) => ({ to: lessonOn ? -w / 2 - 1.7 : -w / 2 - 16, y: FLEET_Y + h / 2 + 0.35 }),
    /** She lip-syncs to the voice while teaching. */
    update(dt: number, T: number, w: number, h: number, lessonOn: boolean) {
      const { to, y } = this.target(w, h, lessonOn);
      x += (to - x) * Math.min(1, dt * 3.2);
      nova.group.visible = lessonOn || x > -w / 2 - 14;
      nova.group.position.set(x, 0, 1.4);
      nova.animate(T, dt, y, lessonOn ? audio.level() : 0);
      return { to, y };
    },
  };
}
