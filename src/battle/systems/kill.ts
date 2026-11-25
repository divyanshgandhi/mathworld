import * as THREE from "three";
import type { Stage } from "@/engine/stage";
import type { Rng } from "@/engine/util";
import { LOOK, reducedMotion } from "../look";
import { inkText, type InkText } from "./ink";

/**
 * The kill beat's world effects, all matte or plain and under the bloom threshold:
 * - a hairline ring that pops out from the hit and is gone in about a quarter second;
 * - a few matte shards in the ship's own colours that drift and shrink away (one instanced draw);
 * - a squad cleared: its gold pennant drops, and one small count ticks beside the squad;
 * - an extra ball's fizz: a small ring where it gives out.
 * Everything is pooled and capped, so a 10 × 10 volley costs the same as a small one.
 */
const RING_LIFE = 0.25, SHARD_LIFE = 0.7, PENNANT_LIFE = 0.75, TICK_LIFE = 0.9;

export function createKillFx(stage: Stage, root: THREE.Object3D, rnd: Rng) {
  const max = LOOK.kill.maxShards;
  // shards: one instanced mesh of small matte tetrahedra, coloured per instance
  const shardGeo = new THREE.TetrahedronGeometry(0.11, 0);
  const shardMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  const shards = new THREE.InstancedMesh(shardGeo, shardMat, max);
  shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shards.count = 0;
  shards.frustumCulled = false;
  root.add(shards);
  const S = Array.from({ length: max }, () => ({ live: false, t0: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), size: 1 }));
  const color = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  let next = 0;

  // rings: a small pool of hairline rings, each with its own material for its fade
  const ringGeo = new THREE.RingGeometry(0.94, 1, 56);
  const rings = Array.from({ length: 28 }, () => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: LOOK.kill.ring, transparent: true, depthWrite: false, toneMapped: false }));
    m.visible = false; m.renderOrder = 4; root.add(m);
    return { m, t0: -1, size: 1, life: RING_LIFE, peak: LOOK.kill.ringOpacity as number };
  });
  let ringNext = 0;

  // pennants: the leader's gold flag falls when its squad is cleared
  const flag = new THREE.Shape();
  flag.moveTo(0, 0); flag.lineTo(0.3, -0.09); flag.lineTo(0, -0.2); flag.closePath();
  const flagGeo = new THREE.ShapeGeometry(flag), flagMat = stage.mats.clay(LOOK.kill.pennant, { roughness: 0.6, side: THREE.DoubleSide });
  const flags: { m: THREE.Mesh; t0: number; v: THREE.Vector3 }[] = [];
  const ticks: { ink: InkText; t0: number; h: number }[] = [];

  const fx = {
    /**
     * A ship pops at `at` (root space): the ring and `n` shards in its `colors`. `size` is the ship's world
     * size; `delay` holds it for a hit-stop; `big` is the last ship's bigger beat.
     */
    burst(at: THREE.Vector3, colors: number[], { size = 1, delay = 0, big = false } = {}) {
      const t0 = stage.time + delay, reduced = reducedMotion();
      const r = rings[ringNext++ % rings.length];
      r.t0 = t0; r.size = size * (big ? 1.5 : 1); r.life = big ? RING_LIFE * 1.5 : RING_LIFE; r.peak = LOOK.kill.ringOpacity;
      r.m.position.copy(at).setZ(at.z + 0.3);
      const n = Math.round(LOOK.kill.shards * (big ? 1.8 : 1) * (reduced ? 0.5 : 1));
      for (let i = 0; i < n; i++) {
        const s = S[next], k = next;
        next = (next + 1) % max;
        s.live = true; s.t0 = t0; s.size = size * (0.7 + rnd() * 0.6);
        s.p.copy(at);
        s.v.set(rnd() * 2 - 1, rnd() * 1.6 - 0.5, rnd() * 0.8 + 0.2).normalize().multiplyScalar(size * (1.4 + rnd() * 1.6) * (big ? 1.4 : 1));
        s.r.set(rnd() * 6, rnd() * 6, rnd() * 6); s.w.set(rnd() * 8 - 4, rnd() * 8 - 4, rnd() * 8 - 4);
        shards.setColorAt(k, color.setHex(colors[i % colors.length]));
      }
      if (shards.instanceColor) shards.instanceColor.needsUpdate = true;
    },
    /** An extra ball gives out: a small ring where it fizzes. */
    fizz(at: THREE.Vector3, size = 0.5) {
      const r = rings[ringNext++ % rings.length];
      r.t0 = stage.time; r.size = size; r.life = 0.32; r.peak = 0.5;
      r.m.position.copy(at);
    },
    /** A squad is cleared: its leader's pennant drops from `at` (root space). */
    pennant(at: THREE.Vector3, size = 1) {
      const m = new THREE.Mesh(flagGeo, flagMat);
      m.position.copy(at); m.scale.setScalar(size); m.renderOrder = 4;
      root.add(m);
      flags.push({ m, t0: stage.time, v: new THREE.Vector3((rnd() - 0.5) * 0.6, 0.4, 0) });
    },
    /** One small count ticks at `at` (root space), `h` world units tall: the squads counted again without a word. */
    tick(at: THREE.Vector3, text: string, h: number) {
      fx.clearTicks(); // one count on screen at a time: the one before it goes
      const ink = inkText(text, { color: LOOK.scan.ink, weight: "500" });
      ink.height(h);
      ink.mesh.position.copy(at);
      root.add(ink.mesh);
      ticks.push({ ink, t0: stage.time, h });
    },
    update(dt: number) {
      const now = stage.time;
      let top = 0;
      for (let i = 0; i < max; i++) {
        const s = S[i];
        if (!s.live) continue;
        const a = (now - s.t0) / SHARD_LIFE;
        if (a >= 1) { s.live = false; continue; }
        top = i + 1;
        if (a < 0) { sc.setScalar(0); m4.compose(s.p, q.identity(), sc); shards.setMatrixAt(i, m4); continue; }
        s.p.addScaledVector(s.v, dt);
        s.v.multiplyScalar(1 - Math.min(1, dt * 2.2));
        s.r.x += s.w.x * dt; s.r.y += s.w.y * dt; s.r.z += s.w.z * dt;
        sc.setScalar(s.size * (1 - a) * (a < 0.08 ? a / 0.08 : 1));
        m4.compose(s.p, q.setFromEuler(s.r), sc);
        shards.setMatrixAt(i, m4);
      }
      // dead slots below `top` must draw nothing
      for (let i = 0; i < top; i++) if (!S[i].live) { sc.setScalar(0); m4.compose(S[i].p, q.identity(), sc); shards.setMatrixAt(i, m4); }
      shards.count = top;
      shards.instanceMatrix.needsUpdate = true;
      for (const r of rings) {
        if (r.t0 < 0) continue;
        const k = (now - r.t0) / r.life;
        if (k >= 1) { r.m.visible = false; r.t0 = -1; continue; }
        r.m.visible = k >= 0;
        if (k < 0) continue;
        const e = 1 - Math.pow(1 - k, 3);
        r.m.scale.setScalar(r.size * (0.25 + 0.4 * e));
        (r.m.material as THREE.MeshBasicMaterial).opacity = r.peak * (1 - k);
      }
      for (let i = flags.length - 1; i >= 0; i--) {
        const f = flags[i], k = (now - f.t0) / PENNANT_LIFE;
        if (k >= 1) { f.m.removeFromParent(); flags.splice(i, 1); continue; }
        f.v.y -= 9 * dt;
        f.m.position.addScaledVector(f.v, dt);
        f.m.rotation.z -= dt * 3.2;
        f.m.scale.setScalar(Math.max(0.001, f.m.scale.x * (k > 0.6 ? 1 - dt * 5 : 1)));
      }
      for (let i = ticks.length - 1; i >= 0; i--) {
        const t = ticks[i], k = (now - t.t0) / TICK_LIFE;
        if (k >= 1) { t.ink.dispose(); ticks.splice(i, 1); continue; }
        (t.ink.mesh.material as THREE.MeshBasicMaterial).opacity = k < 0.15 ? k / 0.15 : k > 0.6 ? (1 - k) / 0.4 : 1;
        t.ink.mesh.position.y += dt * 0.25 * t.h;
      }
    },
    /** Show one of everything (for a shader compile before the first shot), or hide it again. */
    prewarm(on: boolean) {
      rings[0].m.visible = on;
      shards.count = on ? 1 : 0;
      if (on && !shards.instanceColor) shards.setColorAt(0, color.setHex(LOOK.kill.ring));
    },
    /** The squad counts go (a miss is about to be shown and counted in the world). */
    clearTicks() { for (const t of ticks) t.ink.dispose(); ticks.length = 0; },
    /** Everything in flight goes (a new fleet, a dispose). */
    clear() {
      for (const s of S) s.live = false;
      shards.count = 0;
      for (const r of rings) { r.t0 = -1; r.m.visible = false; }
      for (const f of flags) f.m.removeFromParent();
      flags.length = 0;
      for (const t of ticks) t.ink.dispose();
      ticks.length = 0;
    },
    dispose() {
      fx.clear();
      root.remove(shards, ...rings.map((r) => r.m));
      shardGeo.dispose(); shardMat.dispose(); ringGeo.dispose(); flagGeo.dispose();
      for (const r of rings) (r.m.material as THREE.Material).dispose();
    },
  };
  return fx;
}
export type KillFx = ReturnType<typeof createKillFx>;
