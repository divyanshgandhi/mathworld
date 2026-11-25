import * as THREE from "three";
import { applyLook, LOOKS, lookLights } from "@/worlds/looks";
import { audio } from "@/engine/audio";
import type { Stage } from "@/engine/stage";
import { seeded } from "@/engine/util";
import type { WarmupProblem } from "@/rig/warmup";
import { LOOK, reducedMotion } from "@/battle/look";
import { createCameraRig } from "@/battle/systems/camera";
import { createCannon, FLIGHT } from "@/battle/systems/cannon";
import { createCharge } from "@/battle/systems/charge";
import { createKillFx } from "@/battle/systems/kill";
import { makeBody, starfield } from "./planets";
import { INVADER, makeInvader, squadStyle } from "./ships";

/**
 * Mercury and Venus warm-ups on the battle's look and with the battle's cannon: drones in rows of ten,
 * the cadet's rocket at the bottom centre, the same plasma balls, recoil and kill beat (flinch, squash,
 * a hairline ring and matte shards). Mercury: a squad arrives, then b more (a + b). Venus: a drones,
 * b fly away and leave their places empty (a − b). The answer is the volley, exactly like a battle:
 * the number on the nose counts down as the balls leave.
 */
interface Drone { g: THREE.Group; home: THREE.Vector3; pos: THREE.Vector3; alive: boolean; pop: number; gone: number; enter: number; ph: number; flinch: number; tone: number }
const PITCH = 1.15, ROW = 1.5, POP = 0.16;

export function mountWarmup(stage: Stage, planet: "mercury" | "venus", style: { hull?: string; thruster?: string; blaster?: string } = {}) {
  const { scene, camera, mats: M } = stage, rnd = seeded(13), root = new THREE.Group();
  scene.add(root);
  applyLook(stage, "space");
  scene.fog = null;
  camera.far = LOOK.scene.far;
  camera.updateProjectionMatrix();

  // the warm-up world sits low, as the battle's ground does: never behind the drones
  const world = makeBody(M, planet, 60, { glow: 0.3 });
  root.add(world.group, starfield(1800, 900, rnd));
  const lights = lookLights(LOOKS.space, { keyFrom: new THREE.Vector3(-8, 14, 10), rimFrom: new THREE.Vector3(6, 6, -10) });
  root.add(lights.group);

  const cannon = createCannon(stage, root, style);
  const kill = createKillFx(stage, root, rnd);
  const charge = createCharge(stage, root, (out) => cannon.rocket.noseWorld(out));
  const cam = createCameraRig(camera, stage.renderer.domElement, new THREE.Vector3());

  const fleet = new THREE.Group();
  root.add(fleet);
  let drones: Drone[] = [], problem: WarmupProblem | null = null, rows = 1;
  const timers: { at: number; fn: () => void }[] = [];
  const after = (s: number) => new Promise<void>((r) => timers.push({ at: stage.time + s, fn: r }));
  const at = (s: number, fn: () => void) => timers.push({ at: stage.time + s, fn });

  /** Rows of ten, the first group (a) on top, then the second group (b) for Mercury, a gap between them. */
  function load(p: WarmupProblem) {
    problem = p;
    for (const d of drones) fleet.remove(d.g);
    drones = [];
    kill.clear();
    const groups = p.op === "add" ? [p.a, p.b] : [p.a];
    let row = 0;
    groups.forEach((n, gi) => {
      for (let i = 0; i < n; i++) {
        const r = row + Math.floor(i / 10), c = i % 10;
        const g = new THREE.Group();
        const st = squadStyle(gi, i);
        st.leader = false;
        g.add(makeInvader(M, st));
        g.scale.setScalar(0.001);
        const home = new THREE.Vector3((c - 4.5) * PITCH, -r * ROW - gi * 0.5, 0);
        const pos = home.clone();
        g.position.copy(pos);
        fleet.add(g);
        drones.push({ g, home, pos, alive: true, pop: 0, gone: 0, enter: -(Math.floor(i / 10) * 0.08 + gi * 0.6 + (c === 0 ? 0 : 0.05)), ph: rnd() * 6, flinch: 0, tone: gi });
      }
      row += Math.ceil(n / 10);
    });
    rows = Math.max(1, row);
    fleet.position.set(0, (rows - 1) * ROW * 0.5 + 0.25, 0);
    // Venus: the last b drones fly away (their places stay empty)
    if (p.op === "sub") at(1.0, () => { for (const d of drones.slice(p.a - p.b)) d.gone = stage.time; if (p.b) audio.sfx("flyby"); });
  }

  /** Fire n balls: each pops one drone still here, quick and in reading order. Resolves with the outcome. */
  async function fire(n: number): Promise<{ kind: "exact" | "under" | "over"; value: number }> {
    const p = problem!, targets = drones.filter((d) => d.alive && !d.gone), hits = Math.min(n, targets.length), extra = Math.max(0, n - targets.length);
    const shown = Math.min(extra, 10), count = hits + shown, gap = count > 1 ? Math.min(0.11, 1.6 / (count - 1)) : 0;
    charge.set(n);
    for (let i = 0; i < hits; i++) at(i * gap, () => {
      const d = targets[i];
      charge.take(1);
      audio.sfx("shot");
      d.flinch = stage.time + FLIGHT;
      cannon.launch(d.g.getWorldPosition(new THREE.Vector3()), "fighter", () => {
        d.alive = false; d.pop = stage.time;
        audio.sfx("tick", { step: i % 10 });
        kill.burst(root.worldToLocal(d.g.getWorldPosition(new THREE.Vector3())), [INVADER[d.tone ? "apricot" : "ember"], INVADER.shade, INVADER.visor], { size: 0.8, big: i === hits - 1 && extra === 0 && n === p.answer });
      }, false, 1, Math.max(0.08, Math.min(0.22, gap * 1.6)));
    });
    for (let i = 0; i < shown; i++) at((hits + i) * gap + (hits ? 0.12 : 0), () => {
      charge.take(i === shown - 1 ? extra - i : 1);
      const to = fleet.localToWorld(new THREE.Vector3((i - (shown - 1) / 2) * PITCH, ROW * 1.2, -6));
      cannon.launch(to, "fighter", () => kill.fizz(root.worldToLocal(to.clone()), 0.3), true, 0.9);
    });
    await after(count ? (count - 1) * gap + (shown ? 0.12 + 0.55 : FLIGHT) + 0.2 : 0.3);
    charge.release();
    if (n === p.answer) { audio.sfx("clear"); return { kind: "exact", value: n }; }
    // a miss: the popped drones come back for another try
    await after(0.6);
    for (const d of drones) if (!d.gone && !d.alive) { d.alive = true; d.pop = 0; d.enter = -0.01; d.g.visible = true; }
    audio.sfx("shield");
    return n < p.answer ? { kind: "under", value: p.answer - n } : { kind: "over", value: n - p.answer };
  }

  const rocketAt = new THREE.Vector3(), target = new THREE.Vector3();
  const stop = stage.onUpdate((dt, T) => {
    for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= stage.time) { const t = timers[i]; timers.splice(i, 1); t.fn(); }
    world.spin.rotation.y += dt * 0.02;
    const now = stage.time, reduced = reducedMotion();
    for (const d of drones) {
      d.enter += dt;
      if (d.enter < 0) { d.g.visible = false; continue; }
      d.g.visible = true;
      const k = Math.min(1, d.enter / 0.42), e = 1 - Math.pow(1 - k, 3);
      target.copy(d.home);
      if (d.gone) target.add(new THREE.Vector3(14, 6, -30));
      if (k < 1) d.pos.set(d.home.x, d.home.y + (1 - e) * (reduced ? 0.6 : 3), (1 - e) * (reduced ? -3 : -22));
      else d.pos.lerp(target, Math.min(1, dt * (d.gone ? 2.2 : 10)));
      d.g.position.copy(d.pos).setY(d.pos.y + Math.sin(T * 2 + d.ph) * 0.05);
      d.g.rotation.y = Math.sin(T * 1.3 + d.ph) * 0.35;
      d.g.rotation.x = 0;
      let sc = 0.78 * (k < 1 ? 0.6 + 0.4 * e : 1), sx = 1, sy = 1;
      if (d.gone) { const q = Math.max(0, 1 - (now - d.gone) * 1.1); sc *= q; d.g.visible = q > 0; }
      else if (!d.alive) {
        const q = (now - d.pop) / POP;
        if (q >= 1) { d.g.visible = false; continue; }
        const s = Math.sin(Math.PI * Math.min(1, q / 0.4));
        sx = 1 + 0.32 * s; sy = 1 - 0.38 * s; sc *= q < 0.4 ? 1 : 1 - (q - 0.4) / 0.6;
      } else if (d.flinch && !reduced) {
        const q = 1 - (d.flinch - now) / 0.14;
        if (q > 0 && q <= 1) { d.g.rotation.x = -0.38 * q; sy *= 1 - 0.07 * q; }
      }
      d.g.scale.set(sc * sx, sc * sy, sc);
    }
    cannon.update();
    kill.update(dt);
    // frame the drones in the free area above the rocket's band, the rocket at the bottom centre
    const top = fleet.position.y + 0.9, bottom = fleet.position.y - (rows - 1) * ROW - (problem?.op === "add" ? 0.5 : 0) - 0.9;
    cam.follow(dt, { xmin: -6.4, xmax: 6.4, ymin: bottom, ymax: top + 0.4 });
    const ppuR = cam.pxPerUnit(1.8);
    if (ppuR > 0) {
      cannon.scale = (cam.band * 0.44) / ppuR / 2.1;
      cam.bottomCentre(cam.band * 0.36, 1.8, rocketAt);
      cannon.pose(T, rocketAt);
    }
    const ppuN = cam.pxPerUnit(2.2);
    if (ppuN > 0) charge.update(1 / ppuN, (stage.renderer.domElement.clientWidth || 800) < 600 ? 32 : 44);
    // the world is the ground: its top just under the rocket
    const fr = cam.free, z = -60, g = cam.at(0, -fr.fh / 2 + 6, z);
    world.group.position.set(g.x, g.y - 60, g.z);
  });

  return {
    load, fire,
    /** The HUD's footprint in px (the drones are framed in what is left). */
    setSafe(s: Partial<{ top: number; right: number; bottom: number; left: number }>) { cam.safe = { ...cam.safe, ...s }; },
    /** The digits being typed, on the rocket's nose (null hides them). */
    setCharge(n: number | null) { charge.set(n); },
    clear() { for (const d of drones) fleet.remove(d.g); drones = []; problem = null; kill.clear(); },
    dispose() { stop(); cam.dispose(); cannon.dispose(); kill.dispose(); charge.dispose(); scene.remove(root); },
  };
}
export type Warmup = ReturnType<typeof mountWarmup>;
