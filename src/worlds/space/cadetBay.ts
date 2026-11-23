import * as THREE from "three";
import type { EventInput } from "@/db/events";
import { audio } from "@/engine/audio";
import { CameraRig } from "@/engine/camera";
import { add, PALETTE } from "@/engine/materials";
import { createOverlay } from "@/engine/overlay";
import type { Stage } from "@/engine/stage";
import { seeded } from "@/engine/util";
import { synth } from "@/engine/voice";
import { fold, type LoggedEvent } from "@/director/fold";
import { acceptHyperJump, housekeeping, nextWave, type Wave } from "@/director/next";
import { classifyError } from "@/rig/errors";
import { PLANETS_BY_TIER } from "@/rig/pools";
import { lesson } from "@/rig/tricks";
import { makeInvader, makeRocket } from "./ships";
import { SPACE_AT } from "./intro";

/**
 * Level 0, Earth · Cadet Bay: the tutorial right after the intro. Waves come from the real
 * director (Earth's ×0 and ×1 tutorial facts, with the Hyper-Jump probe), shots are one plasma
 * ball per drone, misses show in the world, and Nova teaches Empty & Mirror with her voice.
 */
export interface BayUi { wave: { a: number; b: number; label: string } | null; canFire: boolean; done: { title: string; sub: string } | null }

const BAY = SPACE_AT.clone().add(new THREE.Vector3(0, 38, 46));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export function mountCadetBay(stage: Stage, opts: { onUi?: (ui: BayUi) => void; onEvent?: (e: EventInput) => void; history?: LoggedEvent[]; seed?: number } = {}) {
  const { scene, camera, mats: M } = stage, rnd = seeded(5), seed = opts.seed ?? 7;
  const overlay = createOverlay(stage.container, stage.renderer.domElement);
  const cam = new CameraRig();
  const log: LoggedEvent[] = [...(opts.history ?? [])];
  const group = new THREE.Group();
  group.position.copy(BAY);
  scene.add(group);

  const key = new THREE.DirectionalLight(0xfff1dc, 1.5);
  key.position.set(BAY.x - 8, BAY.y + 12, BAY.z + 6);
  key.target.position.copy(BAY);
  const rim = new THREE.DirectionalLight(0x7dfcff, 1.0);
  rim.position.set(BAY.x + 5, BAY.y + 5, BAY.z - 10);
  const fill = new THREE.HemisphereLight(0xc8d8ff, 0x1a2244, 0.8);
  scene.add(key, key.target, rim, fill);

  const rocket = makeRocket(M);
  rocket.group.rotation.set(-0.95, 0.35, 0.12);
  rocket.group.scale.setScalar(0.5);
  rocket.group.position.set(-2.0, 1.7, 7.6);
  group.add(rocket.group);
  const zeroRing = add(group, new THREE.TorusGeometry(1.5, 0.05, 12, 96), M.glow(PALETTE.cyan, 1.6), 0, 4.2, 0, { cast: false });
  zeroRing.visible = false;

  type Drone = { g: THREE.Group; home: THREE.Vector3; alive: boolean; dying: number; ph: number };
  let drones: Drone[] = [], wave: Wave | null = null, attempts = 0, shownAt = 0, busy = false, done = false;
  let ui: BayUi = { wave: null, canFire: false, done: null };
  const setUi = (p: Partial<BayUi>) => { ui = { ...ui, ...p }; opts.onUi?.(ui); };
  const emit = (e: EventInput) => { log.push({ ...e, at: Date.now() }); opts.onEvent?.(e); };

  /** Nova speaks: a baked clip when the words match one, live Phonon otherwise. Captions always. */
  async function nova(text: string) {
    overlay.caption("Nova", text);
    const id = Object.entries(audio.manifest).find(([k, c]) => k.startsWith("nova") && norm(c.text) === norm(text))?.[0];
    if (id) return audio.say(id);
    const buf = await synth(text, "Zoey");
    if (buf) await audio.play(buf);
    else await new Promise((r) => setTimeout(r, 900 + text.length * 45));
  }

  function formation(a: number, b: number) {
    for (const d of drones) group.remove(d.g);
    drones = [];
    zeroRing.visible = a === 0 || b === 0;
    const rowGap = a > 5 ? 8.0 / a : 1.6, colGap = b > 6 ? 9.6 / b : 1.5;
    for (let r = 0; r < a; r++) for (let c = 0; c < b; c++) {
      const g = makeInvader(M);
      g.scale.setScalar(Math.min(1.2, colGap * 0.8, rowGap * 0.8));
      const home = new THREE.Vector3((c - (b - 1) / 2) * colGap, 2.4 + (a - 1 - r) * rowGap, 0);
      g.position.copy(home).add(new THREE.Vector3(0, 8, -40));
      group.add(g);
      drones.push({ g, home, alive: true, dying: 0, ph: rnd() * 6 });
    }
  }

  async function startWave() {
    const s = fold(log);
    const jump = acceptHyperJump(s);
    if (jump) { emit(jump); return finish("ACE TELEMETRY", `Hyper-Jump to ${PLANETS_BY_TIER[s.offers.hyperJumpTo!].replace("-", " ")} cleared`, true); }
    const hk = housekeeping(s);
    if (hk.length) { hk.forEach(emit); return finish("CADET BAY CLEAR", "The Moon is open", false); }
    wave = nextWave(s, seed);
    attempts = 0;
    formation(wave.a, wave.b);
    const label = `${wave.a} ${wave.a === 1 ? "squad" : "squads"} × ${wave.b} each`;
    setUi({ wave: { a: wave.a, b: wave.b, label }, canFire: false });
    if (s.waves === 0) await nova(audio.text("nova_l0_intro"));
    shownAt = performance.now();
    setUi({ canFire: true });
  }

  async function finish(title: string, sub: string, jumped: boolean) {
    done = true;
    if (!fold(log).introCompleted) emit({ type: "intro_completed", payload: {} });
    emit({ type: "orb_earned", payload: { amount: jumped ? 30 : 20, reason: "planet_cleared" } });
    audio.sfx("clear");
    for (const d of drones) group.remove(d.g);
    drones = [];
    zeroRing.visible = false;
    setUi({ wave: null, canFire: false, done: { title, sub } });
    overlay.card("EARTH · CADET BAY", title, sub);
    await nova(audio.text("nova_l0_clear"));
  }

  /** Fire `n` plasma balls: one per drone; extras fly past; too few leaves drones winking. */
  async function fire(n: number) {
    if (!wave || busy || done) return;
    busy = true;
    setUi({ canFire: false });
    const w = wave, p = w.a * w.b, latency = Math.round(performance.now() - shownAt);
    attempts++;
    emit({ type: "attempt_submitted", payload: { a: w.a, b: w.b, planetId: w.planetId, guess: n, latencyMs: latency, errorType: classifyError(w.a, w.b, n), attemptIndex: attempts, usedRadar: false, powerUpUsed: null, isTransferCheck: w.isTransferCheck, waveRole: w.role } });
    const alive = drones.filter((d) => d.alive);
    // the whole volley takes at most ~1.5 s however big the number, so a shot never drags
    const shots = Math.min(n, alive.length + 6), gap = Math.max(12, Math.min(150, 1500 / Math.max(1, shots)));
    for (let i = 0; i < shots; i++) {
      if (i % Math.max(1, Math.round(60 / gap)) === 0) audio.sfx("shot");
      const target = alive[i];
      launch(target ? target.g.position.clone().add(group.position) : null, target);
      await wait(gap);
    }
    if (n > alive.length) audio.sfx("flyby");
    await wait(500);
    if (n === p) {
      audio.sfx("clear");
      overlay.card("", "");
      emit({ type: "orb_earned", payload: { amount: attempts === 1 ? 5 : 3, reason: "wave_clear" } });
      await nova(audio.text("nova_exact"));
      busy = false;
      return startWave();
    }
    overlay.card("", n > p ? `+${n - p}` : `${p - n} left`, n > p ? "plasma balls flew past" : "drones slipped past");
    await nova(audio.text(n > p ? "nova_over" : "nova_under"));
    overlay.card("", "");
    // shields back up: the drones regroup for another try
    audio.sfx("shield");
    formation(w.a, w.b);
    if (attempts >= 2) await showMeHow(w);
    else await nova(audio.text("nova_retry"));
    busy = false;
    shownAt = performance.now();
    setUi({ canFire: true });
  }

  /** I Do: Nova walks through the trick for this exact formation, then hands back the shot (We Do). */
  async function showMeHow(w: Wave) {
    const s = fold(log), l = lesson(w.a, w.b, s.seenTricks);
    emit({ type: "explanation_started", payload: { trickId: l.trick, a: w.a, b: w.b, mode: l.mode } });
    for (const beat of l.beats) {
      if (beat.show.kind === "empty") zeroRing.scale.setScalar(1.25);
      if (beat.show.kind === "mirror") drones.forEach((d) => d.g.scale.multiplyScalar(1.15));
      await nova(beat.say);
      zeroRing.scale.setScalar(1);
    }
    emit({ type: "explanation_completed", payload: { trickId: l.trick, a: w.a, b: w.b, mode: l.mode, wedoCorrect: true } });
  }

  type Ball = { m: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t0: number; target: Drone | undefined };
  const balls: Ball[] = [], ballGeo = new THREE.SphereGeometry(0.14, 16, 12), ballMat = M.glow(PALETTE.shot, 2.2);
  function launch(to: THREE.Vector3 | null, target: Drone | undefined) {
    const from = rocket.muzzle(), m = new THREE.Mesh(ballGeo, ballMat);
    m.position.copy(from);
    scene.add(m);
    const aim = to ?? group.position.clone().add(new THREE.Vector3((rnd() - 0.5) * 8, 7 + rnd() * 4, -30));
    balls.push({ m, from, to: aim, t0: stage.time, target });
    if (target) { target.alive = false; target.dying = -1; } // shrinks when its ball lands
  }
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const stop = stage.onUpdate((dt, T) => {
    for (const d of drones) {
      d.g.position.lerp(d.home, Math.min(1, dt * 2.2));
      d.g.position.y += Math.sin(T * 2 + d.ph) * 0.002;
      d.g.rotation.y = Math.sin(T * 1.3 + d.ph) * 0.35;
      if (!d.alive && d.dying >= 0) { d.dying += dt * 6; const s = Math.max(0, 1 - d.dying); d.g.scale.setScalar(s * 1.1); if (s === 0) d.g.visible = false; }
    }
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i], k = (stage.time - b.t0) / 0.45;
      if (k >= 1) { scene.remove(b.m); if (b.target) { audio.sfx("burst"); b.target.dying = 0; } balls.splice(i, 1); continue; }
      b.m.position.lerpVectors(b.from, b.to, k);
      b.m.position.y += Math.sin(Math.PI * k) * 0.8;
    }
    // drones that survived a short volley wink red-ish via a pulse in scale
    zeroRing.rotation.z += dt * 0.6;
    rocket.flicker(T, 1);
    rocket.group.position.y = 1.7 + Math.sin(T * 1.6) * 0.08;
    cam.apply(camera, dt, T);
  });

  // camera: behind the rocket, Earth's limb below
  camera.far = 3000;
  camera.updateProjectionMatrix();
  scene.background = new THREE.Color(0x030612);
  scene.fog = null;
  Object.assign(stage.bloom, { strength: 0.12, radius: 0.2, threshold: 1.4 }); // battle reads clean: no halos on ships or drones
  stage.renderer.toneMappingExposure = 1.0;
  stage.grade.sat.value = 1;
  stage.grade.tint.value.set(1, 1, 1);
  const c = BAY;
  // look slightly up: the ship reads against dark space and Earth's limb sits low in the frame
  cam.shot([c.x - 0.5, c.y + 3.0, c.z + 12.5], [c.x, c.y + 5.6, c.z - 3], 0);
  audio.mood("battle");
  void startWave();

  return {
    fire,
    get ui() { return ui; },
    log: () => log,
    /** Lift Nova's captions clear of a keypad docked at the bottom (mobile). */
    captionAt: (px: number) => overlay.captionAt(px),
    dispose() { stop(); overlay.dispose(); scene.remove(group); },
  };
}
export type Bay = ReturnType<typeof mountCadetBay>;
