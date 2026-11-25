import * as THREE from "three";
import type { Stage } from "@/engine/stage";
import type { Rng } from "@/engine/util";
import type { volley } from "@/rig/fleet";
import { BLASTERS, makeRocket } from "@/worlds/space/ships";
import { LOOK } from "../look";
import type { Scheduler } from "../scheduler";
import type { Kind, ShipView } from "./fleetView";

/**
 * The cannon: the cadet's rocket under the fleet, and the volley it fires. The volley fires exactly
 * `n` plasma balls' worth (the answer is the action): one ball per ship it pops, then any extras fly
 * past. However big the number, it takes at most ~1.5 s (1.15 s of shots, 0.42 s of flight, a beat).
 */
type Ball = { m: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; land?: () => void };
const BALL_SIZE: Record<Kind, number> = { fighter: 1, pod: 1.25, carrier: 1.5, dread: 1.8 };
/** Seconds a ball flies to a ship. */
export const FLIGHT = 0.42;

export function createCannon(stage: Stage, root: THREE.Group, equipped: { hull?: string; thruster?: string; blaster?: string }) {
  const { scene, mats: M } = stage;
  const rocket = makeRocket(M, { hull: equipped.hull, thruster: equipped.thruster });
  const blaster = BLASTERS[(equipped.blaster ?? "plasma-ball") as keyof typeof BLASTERS] ?? BLASTERS["plasma-ball"];
  rocket.group.rotation.set(-1.05, 0, 0);
  rocket.group.scale.setScalar(0.55);
  // no halo in battle: the flame keeps its colour, but its two additive cones together stay under
  // the bloom threshold (1.4) instead of blooming into a disc around the rocket
  rocket.flames.forEach((m, i) => m.color.multiplyScalar((i ? 0.75 : 0.55) / Math.max(m.color.r, m.color.g, m.color.b)));
  root.add(rocket.group);

  const balls: Ball[] = [], ballGeo = new THREE.SphereGeometry(0.14, 14, 10), ballMat = M.glow(blaster.color, LOOK.ball.intensity), overMat = M.glow(LOOK.over.color, LOOK.over.intensity);
  /** Digits being typed (wave 2 draws them on the cannon). */
  let charge: number | null = null;

  const cannon = {
    rocket, blaster,
    get charge() { return charge; },
    setCharge(n: number | null) { charge = n; },
    /** One ball (two for a twin blaster) from the muzzle to `to`. `over`: a ball with nothing to hit. */
    launch(to: THREE.Vector3, kind: Kind, onLand?: () => void, over = false, sizeK = 1) {
      const from = rocket.muzzle();
      for (const side of blaster.twin ? [-0.12, 0.12] : [0]) {
        const m = new THREE.Mesh(ballGeo, over ? overMat : ballMat);
        m.scale.set(1, 1, blaster.stretch).multiplyScalar(BALL_SIZE[kind] * blaster.size * sizeK);
        const f = from.clone().add(new THREE.Vector3(side, 0, 0));
        m.position.copy(f);
        scene.add(m);
        balls.push({ m, from: f, to: to.clone(), t0: stage.time, dur: over ? 0.9 : FLIGHT, land: side <= 0 ? onLand : undefined });
      }
    },
    /**
     * Schedule the volley for `plan` on the stage clock. `onLaunch` runs as each ball leaves,
     * `onLand` as a ball reaches its ship, `onExtras` once as the first extra leaves.
     * Returns the seconds until the volley is over.
     */
    volley(plan: ReturnType<typeof volley>, views: ShipView[], at: Scheduler, rnd: Rng, formation: THREE.Object3D, hooks: {
      onLaunch: (extra: boolean) => void; onLand: (v: ShipView, amount: number, full: boolean, i: number) => void; onExtras: () => void;
    }) {
      const extras = Math.min(plan.extra, 14), count = plan.hits.length + extras;
      const gap = count > 1 ? Math.min(0.13, 1.15 / (count - 1)) : 0;
      plan.hits.forEach((h, i) => {
        const v = views[h.ship];
        at.at(i * gap, () => {
          hooks.onLaunch(false);
          cannon.launch(v.g.getWorldPosition(new THREE.Vector3()), v.kind, () => hooks.onLand(v, h.amount, h.full, h.ship));
        });
      });
      for (let i = 0; i < extras; i++) at.at((plan.hits.length + i) * gap, () => {
        const target = formation.localToWorld(new THREE.Vector3((rnd() - 0.5) * 8, (rnd() - 0.2) * 5, -40));
        hooks.onLaunch(true);
        cannon.launch(target, "fighter", undefined, true, 0.9);
      });
      if (extras) at.at(plan.hits.length * gap, hooks.onExtras);
      return count ? (count - 1) * gap + FLIGHT + 0.2 : 0.35;
    },
    /** Balls in flight. */
    update() {
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i], k = (stage.time - b.t0) / b.dur;
        if (k >= 1) { scene.remove(b.m); b.land?.(); balls.splice(i, 1); continue; }
        b.m.position.lerpVectors(b.from, b.to, k);
        b.m.position.y += Math.sin(Math.PI * k) * 0.6;
        b.m.lookAt(b.to);
      }
    },
    /** The rocket bobs under the fleet; `bottom` is the fleet's lower edge. */
    pose(T: number, bottom: number) {
      rocket.group.position.set(Math.sin(T * 0.9) * 0.12, bottom - 2.1 + Math.sin(T * 1.6) * 0.06, 1.8);
      rocket.group.rotation.z = Math.sin(T * 0.9) * 0.05;
      rocket.flicker(T, 1);
    },
    dispose() { for (const b of balls) scene.remove(b.m); },
  };
  return cannon;
}
export type Cannon = ReturnType<typeof createCannon>;
