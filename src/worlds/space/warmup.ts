import * as THREE from "three";
import { audio } from "@/engine/audio";
import type { Stage } from "@/engine/stage";
import { ease, seeded } from "@/engine/util";
import type { WarmupProblem } from "@/rig/warmup";
import { makeBody, starfield } from "./planets";
import { BLASTERS, makeInvader, makeRocket } from "./ships";

/**
 * Mercury and Venus warm-ups on the battle look (no glow on ships, bloom nearly off): drones in
 * rows of ten, the cadet's rocket below. Mercury: a squad arrives, then b more (a + b). Venus: a
 * drones, b fly away and leave ghosts (a − b). The answer is the volley, exactly like a battle.
 */
interface Drone { g: THREE.Group; home: THREE.Vector3; pos: THREE.Vector3; alive: boolean; pop: number; gone: number; enter: number; ph: number }

export function mountWarmup(stage: Stage, planet: "mercury" | "venus", style: { hull?: string; thruster?: string; blaster?: string } = {}) {
  const { scene, camera, mats: M } = stage, rnd = seeded(13), root = new THREE.Group();
  scene.add(root);
  scene.background = new THREE.Color(0x030612);
  scene.fog = null;
  Object.assign(stage.bloom, { strength: 0.12, radius: 0.2, threshold: 1.4 });
  stage.renderer.toneMappingExposure = 1;
  camera.far = 3000;
  camera.updateProjectionMatrix();

  const world = makeBody(M, planet, 60, { glow: 0.3 });
  world.group.position.set(-8, -78, -60);
  root.add(world.group, starfield(1800, 900, rnd));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.6);
  key.position.set(-8, 14, 10);
  root.add(key, new THREE.HemisphereLight(0xc8d8ff, 0x1a2244, 0.85));

  const rocket = makeRocket(M, style);
  rocket.flames.forEach((m, i) => m.color.multiplyScalar((i ? 0.75 : 0.55) / Math.max(m.color.r, m.color.g, m.color.b)));
  rocket.group.rotation.x = -1.05;
  rocket.group.scale.setScalar(0.55);
  root.add(rocket.group);
  const blaster = BLASTERS[(style.blaster ?? "plasma-ball") as keyof typeof BLASTERS] ?? BLASTERS["plasma-ball"];

  const fleet = new THREE.Group();
  root.add(fleet);
  let drones: Drone[] = [], problem: WarmupProblem | null = null, H = 2;
  const timers: { at: number; fn: () => void }[] = [];
  const after = (s: number) => new Promise<void>((r) => timers.push({ at: stage.time + s, fn: r }));

  /** Rows of ten, the first group (a) on top, then the second group (b) for Mercury. */
  function load(p: WarmupProblem) {
    problem = p;
    for (const d of drones) fleet.remove(d.g);
    drones = [];
    const groups = p.op === "add" ? [p.a, p.b] : [p.a];
    let row = 0;
    groups.forEach((n, gi) => {
      for (let i = 0; i < n; i++) {
        const r = row + Math.floor(i / 10), c = i % 10;
        const g = new THREE.Group();
        g.add(makeInvader(M));
        g.scale.setScalar(0.78);
        const home = new THREE.Vector3((c - 4.5) * 1.15, -r * 1.15, 0);
        const pos = home.clone().add(new THREE.Vector3(0, 6, -24));
        g.position.copy(pos);
        fleet.add(g);
        drones.push({ g, home, pos, alive: true, pop: 0, gone: 0, enter: -(i * 0.03 + gi * 0.6), ph: rnd() * 6 });
      }
      row += Math.ceil(n / 10) + (gi === 0 && groups.length > 1 ? 0.5 : 0);
    });
    H = Math.max(1, row);
    fleet.position.set(0, 4 + H * 0.55, 0);
    // Venus: the last b drones fly away (their places stay as faint ghosts)
    if (p.op === "sub") timers.push({ at: stage.time + 1.0, fn: () => { for (const d of drones.slice(p.a - p.b)) d.gone = stage.time; if (p.b) audio.sfx("flyby"); } });
  }

  const balls: { m: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t0: number; land?: () => void }[] = [];
  const ballGeo = new THREE.SphereGeometry(0.14, 14, 10), ballMat = M.glow(blaster.color, 1.45), overMat = M.glow(0xff9a3c, 1.3);
  function shoot(to: THREE.Vector3, land?: () => void, over = false) {
    const from = rocket.muzzle();
    for (const side of blaster.twin ? [-0.12, 0.12] : [0]) {
      const m = new THREE.Mesh(ballGeo, over ? overMat : ballMat);
      m.scale.set(1, 1, blaster.stretch).multiplyScalar(blaster.size);
      const f = from.clone().add(new THREE.Vector3(side, 0, 0));
      m.position.copy(f);
      scene.add(m);
      balls.push({ m, from: f, to, t0: stage.time, land: side <= 0 ? land : undefined });
    }
  }

  /** Fire n balls: each pops one drone still here. Resolves with the outcome (≤ ~2 s in all). */
  async function fire(n: number): Promise<{ kind: "exact" | "under" | "over"; value: number }> {
    const p = problem!, targets = drones.filter((d) => d.alive && !d.gone), hits = Math.min(n, targets.length), extra = Math.max(0, n - targets.length);
    const count = hits + Math.min(extra, 10), gap = count > 1 ? Math.min(0.11, 1.0 / (count - 1)) : 0;
    for (let i = 0; i < hits; i++) timers.push({ at: stage.time + i * gap, fn: () => { audio.sfx("shot"); const d = targets[i]; shoot(d.g.getWorldPosition(new THREE.Vector3()), () => { d.alive = false; d.pop = stage.time; audio.sfx("burst"); }); } });
    for (let i = 0; i < Math.min(extra, 10); i++) timers.push({ at: stage.time + (hits + i) * gap, fn: () => shoot(fleet.localToWorld(new THREE.Vector3((rnd() - 0.5) * 10, 2, -40)), undefined, true) });
    await after(count ? (count - 1) * gap + 0.62 : 0.3);
    if (n === p.answer) { audio.sfx("clear"); return { kind: "exact", value: n }; }
    // a miss: the popped drones come back for another try
    await after(0.5);
    for (const d of drones) if (!d.gone) { d.alive = true; d.pop = 0; d.g.visible = true; }
    audio.sfx("shield");
    return n < p.answer ? { kind: "under", value: p.answer - n } : { kind: "over", value: n - p.answer };
  }

  let safe = { top: 150, right: 0, bottom: 0 };
  const camPos = new THREE.Vector3(), look = new THREE.Vector3();
  let init = false;
  const stop = stage.onUpdate((dt, T) => {
    for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= stage.time) { const t = timers[i]; timers.splice(i, 1); t.fn(); }
    world.spin.rotation.y += dt * 0.02;
    for (const d of drones) {
      d.enter += dt;
      if (d.enter < 0) continue;
      const k = Math.min(1, d.enter / 0.55);
      const target = d.home.clone();
      if (d.gone) target.add(new THREE.Vector3(14, 6, -30));
      const start = d.home.clone().add(new THREE.Vector3(0, 6, -24));
      if (k < 1) d.pos.lerpVectors(start, target, ease(k));
      else d.pos.lerp(target, Math.min(1, dt * (d.gone ? 2.2 : 8)));
      d.g.position.copy(d.pos).setY(d.pos.y + Math.sin(T * 2 + d.ph) * 0.05);
      d.g.rotation.y = Math.sin(T * 1.3 + d.ph) * 0.35;
      let sc = 0.78;
      if (d.gone) { const q = Math.max(0, 1 - (stage.time - d.gone) * 1.1); sc *= q; d.g.visible = q > 0; }
      else if (!d.alive) { const q = Math.max(0, 1 - (stage.time - d.pop) * 6); sc *= q; d.g.visible = q > 0; }
      d.g.scale.setScalar(sc);
    }
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i], k = Math.min(1, (stage.time - b.t0) / 0.42);
      b.m.position.lerpVectors(b.from, b.to, k);
      b.m.lookAt(b.to);
      if (k >= 1) { scene.remove(b.m); balls.splice(i, 1); b.land?.(); }
    }
    const bottom = 4 + H * 0.55 - H * 1.15 - 1;
    rocket.group.position.set(Math.sin(T * 0.9) * 0.12, bottom - 2.1, 1.8);
    rocket.flicker(T, 1);
    // frame the drones and the rocket in the free part of the screen
    const W = stage.renderer.domElement.clientWidth || 1, Hpx = stage.renderer.domElement.clientHeight || 1;
    const fw = Math.max(120, W - safe.right), fh = Math.max(120, Hpx - safe.top - safe.bottom), tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const ymax = 4 + H * 0.55 + 1.2, ymin = bottom - 3, xw = 13;
    const dist = Math.max(((ymax - ymin) * Hpx) / (2 * tan * fh * 0.94), (xw * Hpx) / (2 * tan * fw * 0.94), 8);
    const cy = (ymax + ymin) / 2;
    if (!init) { camPos.set(0, cy, dist); look.set(0, cy, 0); init = true; }
    camPos.lerp(new THREE.Vector3(0, cy, dist), Math.min(1, dt * 3));
    look.lerp(new THREE.Vector3(0, cy, 0), Math.min(1, dt * 3));
    camera.position.copy(camPos);
    camera.lookAt(look);
    camera.setViewOffset(W, Hpx, W / 2 - fw / 2, Hpx / 2 - (safe.top + fh / 2), W, Hpx);
  });

  return {
    load, fire,
    setSafe(s: Partial<typeof safe>) { safe = { ...safe, ...s }; },
    clear() { for (const d of drones) fleet.remove(d.g); drones = []; problem = null; },
    dispose() { stop(); camera.clearViewOffset(); for (const b of balls) scene.remove(b.m); scene.remove(root); },
  };
}
export type Warmup = ReturnType<typeof mountWarmup>;
