import * as THREE from "three";
import type { Stage } from "@/engine/stage";
import type { volley } from "@/rig/fleet";
import { blasterOf, makePlasmaBall, makeRocket } from "@/worlds/space/ships";
import { FLIGHT, type Shot } from "../formation";
import { LOOK, reducedMotion } from "../look";
import type { Scheduler } from "../scheduler";
import type { Kind, ShipView } from "./fleetView";

/**
 * The cannon: the cadet's rocket and the plasma balls it fires, in the equipped blaster's style
 * (`makePlasmaBall`). Every shot kicks the rocket back (`rocket.recoil`). Balls are pooled, so a
 * 100-ball volley allocates nothing. A ball either flies to its ship (with a small arc) or, as an
 * extra with nothing left to hit, flies on through the empty space and fizzes out at the far end.
 */
type Ball = { m: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; arc: number; land?: () => void; fizz?: boolean };
const BALL_SIZE: Record<Kind, number> = { fighter: 1, pod: 1.25, carrier: 1.5, dread: 1.8 };
export { FLIGHT };
/** Seconds an extra ball flies before it fizzes. */
export const EXTRA_FLIGHT = 0.55;

export function createCannon(stage: Stage, root: THREE.Group, equipped: { hull?: string; thruster?: string; blaster?: string }) {
  const { scene, mats: M } = stage;
  const rocket = makeRocket(M, { hull: equipped.hull, thruster: equipped.thruster });
  const blasterId = equipped.blaster ?? "plasma-ball", blaster = blasterOf(blasterId);
  rocket.group.rotation.set(-1.05, 0, 0);
  rocket.group.scale.setScalar(0.55);
  // no halo in battle: the flame keeps its colour, but its two additive cones together stay under
  // the bloom threshold instead of blooming into a disc around the rocket
  rocket.flames.forEach((m, i) => m.color.multiplyScalar((i ? 0.75 : 0.55) / Math.max(m.color.r, m.color.g, m.color.b)));
  root.add(rocket.group);

  const balls: Ball[] = [], pool: THREE.Mesh[] = [];
  const ballMat = (makePlasmaBall(M, blasterId).material as THREE.Material), overMat = M.glow(LOOK.over.color, LOOK.over.intensity, { roughness: 0.4 });
  let charge: number | null = null, recoilT = -9, recoilDur = 0.22, scale = 0.55;

  const take = (over: boolean, size: number) => {
    const m = pool.pop() ?? makePlasmaBall(M, blasterId);
    m.material = over ? overMat : ballMat;
    m.scale.set(1, 1, blaster.stretch).multiplyScalar(blaster.size * size * (scale / 0.55));
    m.visible = true;
    scene.add(m);
    return m;
  };
  const give = (m: THREE.Mesh) => { scene.remove(m); pool.push(m); };

  const cannon = {
    rocket, blaster,
    get charge() { return charge; },
    setCharge(n: number | null) { charge = n; },
    /** The rocket's size (the arena keeps it a steady size on screen). */
    get scale() { return scale; },
    set scale(s: number) { scale = s; rocket.group.scale.setScalar(s); },
    /** One ball (two for a twin blaster) from the muzzle to `to` (world). `over`: a ball with nothing to hit. */
    launch(to: THREE.Vector3, kind: Kind, onLand?: () => void, over = false, sizeK = 1, kick = 0.22) {
      const from = rocket.muzzle();
      for (const side of blaster.twin ? [-0.12, 0.12] : [0]) {
        const m = take(false, BALL_SIZE[kind] * sizeK);
        const f = from.clone().add(new THREE.Vector3(side * scale / 0.55, 0, 0));
        m.position.copy(f);
        m.lookAt(to);
        balls.push({ m, from: f, to: to.clone(), t0: stage.time, dur: over ? EXTRA_FLIGHT : FLIGHT, arc: over ? 0.25 : 0.6, land: side <= 0 ? onLand : undefined, fizz: over });
      }
      recoilT = stage.time;
      recoilDur = reducedMotion() ? Math.min(kick, 0.12) : kick;
    },
    /**
     * Fire `shots` on the stage clock. `onLaunch(shot)` runs as each ball leaves; `onLand(hit)` as a ball
     * reaches its ship; `extraTo(i)` is where extra ball `i` fizzes (world) and `onFizz(i, at)` when it does.
     */
    fire(shots: Shot[], plan: ReturnType<typeof volley>, views: ShipView[], at: Scheduler, hooks: {
      onLaunch: (s: Shot) => void; onLand: (hit: number) => void; onIncoming?: (v: ShipView, landsAt: number) => void;
      extraTo: (i: number) => THREE.Vector3; onFizz: (i: number, at: THREE.Vector3) => void;
    }) {
      shots.forEach((s, i) => {
        const gap = i + 1 < shots.length ? shots[i + 1].t - s.t : 0.22;
        at.at(s.t, () => {
          hooks.onLaunch(s);
          const kick = Math.max(0.08, Math.min(0.22, gap * 1.6));
          if (s.hit !== null) {
            const h = plan.hits[s.hit], v = views[h.ship];
            hooks.onIncoming?.(v, stage.time + FLIGHT);
            cannon.launch(v.g.getWorldPosition(new THREE.Vector3()), v.kind, () => hooks.onLand(s.hit!), false, 1, kick);
          } else {
            const to = hooks.extraTo(s.step);
            cannon.launch(to, "fighter", () => hooks.onFizz(s.step, to), true, 0.9, kick);
          }
        });
      });
    },
    /** Balls in flight, and the recoil. */
    update() {
      const now = stage.time;
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i], k = (now - b.t0) / b.dur;
        if (k >= 1) { give(b.m); b.land?.(); balls.splice(i, 1); continue; }
        b.m.position.lerpVectors(b.from, b.to, k);
        b.m.position.y += Math.sin(Math.PI * k) * b.arc;
        // an extra cools to ember and gives out as it reaches the far end
        if (b.fizz) { if (k > 0.55) b.m.material = overMat; const s = k > 0.8 ? (1 - k) / 0.2 : 1; b.m.scale.setScalar(Math.max(0.05, s) * blaster.size * (scale / 0.55)); }
        else b.m.lookAt(b.to);
      }
      const r = (now - recoilT) / recoilDur;
      rocket.recoil(r >= 0 && r < 1 ? Math.sin(Math.PI * r) : 0);
    },
    /** The rocket bobs at `at` (battle-local), the bottom centre of the free part of the screen. */
    pose(T: number, at: THREE.Vector3) {
      const b = reducedMotion() ? 0 : 1;
      rocket.group.position.set(at.x + Math.sin(T * 0.9) * 0.12 * scale * b, at.y + Math.sin(T * 1.6) * 0.06 * scale * b, at.z);
      rocket.group.rotation.z = Math.sin(T * 0.9) * 0.05 * b;
      rocket.flicker(T, 1);
    },
    /** Balls still in flight: gone (a new fleet). */
    clearBalls() { for (const b of balls) give(b.m); balls.length = 0; },
    dispose() { for (const b of balls) scene.remove(b.m); balls.length = 0; },
  };
  return cannon;
}
export type Cannon = ReturnType<typeof createCannon>;
