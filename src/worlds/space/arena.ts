import * as THREE from "three";
import { TRICKS, type EventInput } from "@/db/events";
import { audio } from "@/engine/audio";
import { createOverlay } from "@/engine/overlay";
import type { Stage } from "@/engine/stage";
import { seeded } from "@/engine/util";
import { warmVoice } from "@/engine/voice";
import { fold, type LoggedEvent, type PlayerState } from "@/director/fold";
import { acceptHyperJump, housekeeping, mix, nextWave, practiceWave, PRACTICE_WAVES, type Wave } from "@/director/next";
import { band } from "@/rig/adaptive";
import { classifyError, radarChoices } from "@/rig/errors";
import { volley } from "@/rig/fleet";
import { factKey, PLANETS_BY_TIER, tierOfPlanet, type PlanetId } from "@/rig/pools";
import { FLIP_SEC, planShowMeHow, safetyNetApplies, SHOT, WHY, type Plan } from "@/rig/showme";
import { CARD, selectTrick, type TrickId } from "@/rig/tricks";
import { createBus } from "@/battle/bus";
import { nextHint, type HintStep } from "@/battle/hints";
import { createLessonStage } from "@/battle/lessonBeats";
import { attachPersistence } from "@/battle/persistence";
import { themeOf } from "@/battle/planets";
import { POWERUPS } from "@/battle/powerups";
import { planetClearOrbs, waveClearOrbs } from "@/battle/rewards";
import { createScheduler } from "@/battle/scheduler";
import { createSectorLock } from "@/battle/sectorLock";
import { attachSound } from "@/battle/sound";
import { canAim, hintState, initialBattle, reduce, type BattleAction, type BattleState, type Structure } from "@/battle/state";
import { createBackdrop } from "@/battle/systems/backdrop";
import { createCameraRig, frameBox, measure, type Safe } from "@/battle/systems/camera";
import { createCannon } from "@/battle/systems/cannon";
import { AXIS_H, createFleetView, fmt, type AxisShow } from "@/battle/systems/fleetView";
/** On-screen height (px) the axis label pills keep, so their words read at about 16 px. */
const AXIS_PX = 26;
import { createFx } from "@/battle/systems/fx";
import { createMarks } from "@/battle/systems/marks";
import { createNovaFigure } from "@/battle/systems/nova";
import { attachTelemetry } from "@/battle/telemetry";
import { createVoice } from "@/battle/voice";
import { ERROR_LINE, EXACT_LINES, jumpLine, PLANET_NAMES, unlockLine } from "./lines";

/**
 * The battle (SPEC §1, §3, §4): one wave at a time from the director, a Base-10 fleet laid out
 * rows × columns, a volley that pops exactly `n` ships' worth, and progressive scaffolding.
 * The answer is the action; every action is an event. Used by /play/[planet], Cadet Bay and the Academy.
 *
 * This file is the glue. The rules live in `src/battle/state.ts` (a pure phase machine), every in-battle
 * happening goes out on the bus (`src/battle/bus.ts`) where persistence, sound and telemetry subscribe,
 * and the drawing is split into systems under `src/battle/systems/`. Power-Ups, hints, rewards and planet
 * themes are registries under `src/battle/`.
 *
 * Shot budget: the volley is capped at ~1.5 s however big the number, the outcome holds ~1 s, Nova's
 * line is one short sentence, and the fleet regroups in ~0.4 s, so fire → ready stays under ~5 s.
 */
export interface ArenaUi {
  planet: PlanetId;
  planetName: string;
  mode: "campaign" | "practice" | "academy";
  started: boolean;
  wave: { a: number; b: number; role: string; index: number; of: number; flipped: boolean; sectorLock: boolean } | null;
  canFire: boolean;
  /** `last`: the shields are back up, so the chip now reports the previous shot, not the fleet on screen. */
  outcome: { kind: "exact" | "under" | "over"; value: number; orbs?: number; last?: boolean } | null;
  radar: number[] | null;
  invite: boolean;
  belt: { id: TrickId; card: string; fits: boolean; active: boolean }[];
  sectors: { i: number; label: string; value: number | null; active: boolean }[] | null;
  lockTotal: number | null;
  /** Show Me How in progress: the Card Name banner (with its WHY on first sight), then the We-Do. */
  lesson: { card: string; why: string | null; mode: "full" | "fast"; fallback: boolean; prompt: string | null; equation: string | null } | null;
  /** Trick Cards just unlocked onto the belt (shown for a moment). */
  unlock: { cards: string[] } | null;
  offer: { to: PlanetId; name: string } | null;
  done: { title: string; sub: string; next: PlanetId | null } | null;
  orbs: number;
  /** fire → ready again, in ms, for every shot so far (the 5–10 s rule, checked in the browser). */
  shots: number[];
  /** Show Me How start → last line said, in ms (the keypad stays live throughout). */
  lessons: number[];
  /** How the fleet's structure is shown: always labelled, or discovered through the hint ladder. */
  structure?: Structure;
  /**
   * Structure "discover": what the hint ladder has shown for this fleet. `squads` / `each`: the axis
   * labels ("soft" is an unprompted first-sight hint). `powerUp`: the Power-Up that fits, flagged on miss 2.
   */
  hint?: { level: number; squads: AxisShow; each: AxisShow; powerUp: TrickId | null } | null;
  /** The digits being typed (wave 2 draws them on the cannon). */
  charge?: number | null;
}

export interface ArenaOpts {
  planet: PlanetId;
  history?: LoggedEvent[];
  onUi?: (ui: ArenaUi) => void;
  onEvent?: (e: EventInput) => void;
  seed?: number;
  /** Where in the scene to fight; a fresh space sky is built around it unless `sky` is false. */
  origin?: THREE.Vector3;
  sky?: boolean;
  dev?: boolean;
  /** Dev drills: start with this exact fleet. */
  force?: { a: number; b: number } | null;
  /** Cadet Bay: its own opening line and closing line. */
  lines?: { intro?: string; clear?: string };
  /**
   * The Academy: one forced fleet (`force`), its Trick Film spoken in full as soon as the fleet is in
   * (`film`), and no next wave: a solved fleet ends with `onSolved` and the HUD's done card.
   */
  academy?: { film: boolean; onSolved?: () => void };
  /**
   * "labels" (default): the "N squads" / "N each" labels are always shown. "discover": they start hidden
   * and the hint ladder (src/battle/hints) reveals them. In dev, `?discover` in the URL turns it on.
   */
  structure?: Structure;
}

export function mountArena(stage: Stage, opts: ArenaOpts) {
  const { scene, camera } = stage, rnd = seeded(5), seed = opts.seed ?? 7;
  const planet = opts.planet, tier = tierOfPlanet(planet), theme = themeOf(planet);
  // temporary dev switch until a screen passes `structure` (wave 2)
  const structure: Structure = opts.structure ?? (opts.dev && typeof location !== "undefined" && new URLSearchParams(location.search).has("discover") ? "discover" : "labels");
  const origin = opts.origin?.clone() ?? new THREE.Vector3(0, 0, 0);
  const overlay = createOverlay(stage.container, stage.renderer.domElement);
  const log: LoggedEvent[] = [...(opts.history ?? [])];
  void audio.preload();

  // ---- the world: the systems, in the draw order the battle has always had ----
  const backdrop = createBackdrop(stage, planet, origin, opts.sky !== false);
  const root = new THREE.Group();
  root.position.copy(origin);
  scene.add(root);
  backdrop.light();
  const s0 = fold(log);
  const cannon = createCannon(stage, root, s0.equipped);
  const fv = createFleetView(stage, root, rnd);
  const fx = createFx(stage, root, rnd);
  const nova = createNovaFigure(stage, root);
  fv.mountMarks();
  const marks = createMarks(stage, fv);
  const cam = createCameraRig(camera, stage.renderer.domElement, origin);
  const sched = createScheduler(stage);

  // ---- state ----
  let mode: ArenaUi["mode"] = opts.academy ? "academy" : opts.force || s0.tier !== tier ? "practice" : "campaign";
  let practiceK = 0, declinedAt = -1, started = false, disposed = false;
  let wave: Wave | null = null, shownAt = 0, rocketBottom: number | null = null;
  let active: TrickId | null = null, pendingLesson: Plan | null = null, lessonId = 0;
  let bs: BattleState = initialBattle();
  const dispatch = (a: BattleAction) => { bs = reduce(bs, a); };
  let ui: ArenaUi = {
    planet, planetName: opts.academy ? "Academy" : PLANET_NAMES[planet], mode, started: false, wave: null, canFire: false, outcome: null, radar: null, invite: false,
    belt: [], sectors: null, lockTotal: null, lesson: null, unlock: null, offer: null, done: null, orbs: s0.orbs, shots: [], lessons: [],
    structure, hint: null, charge: null,
  };
  const setUi = (p: Partial<ArenaUi>) => { ui = { ...ui, ...p }; opts.onUi?.(ui); };

  // ---- the bus: persistence first (the log is folded right after), then UI, sound, telemetry ----
  const bus = createBus();
  attachPersistence(bus, (e) => { log.push({ ...e, at: Date.now() }); opts.onEvent?.(e); });
  bus.on("orb_burst", (p) => setUi({ orbs: ui.orbs + p.amount }));
  bus.on("record", ({ event: e }) => { if (e.type === "orb_earned") setUi({ orbs: ui.orbs + e.payload.amount }); });
  bus.on("charge", (p) => setUi({ charge: p.n }));
  attachSound(bus, (s) => audio.sfx(s));
  attachTelemetry(bus, (t) => setUi(t));
  const cue = (sfx: Parameters<typeof audio.sfx>[0]) => bus.emit("cue", { sfx });

  // ---- Nova ----
  const voice = createVoice(overlay, () => bs.lessonOn), say = voice.say, player = voice.player;

  const sector = createSectorLock(fv, marks, { say: (id) => void say(id), cue });
  const lesson = createLessonStage({ fv, marks, at: sched, powerUp: (t) => applyPowerUp(t), cue, current: (id) => id === lessonId });

  // ---- the fleet ----
  /** The axis labels for the fleet as the cadet sees it (swapped while it is turned). */
  function axisLabels() {
    if (!wave) return;
    const [ra, rb] = fv.flipped ? [wave.b, wave.a] : [wave.a, wave.b];
    fv.axisLabels(ra, rb);
  }
  function build(a: number, b: number) { fv.build(a, b); axisLabels(); }
  const clearFleet = () => fv.clear();

  // ---- Power-Ups ----
  function flip() { fv.flipped = !fv.flipped; fv.flipT = stage.time; axisLabels(); setUi({ wave: { ...ui.wave!, flipped: fv.flipped } }); }
  function enterSectorLock() { sector.enter(); setUi({ ...sector.ui(), radar: null }); }
  function applyPowerUp(t: TrickId, { lockMode = true } = {}) {
    const f = fv.fleet;
    if (!wave || !f) return;
    const pu = POWERUPS[t], { a, b } = wave;
    if (!pu.keepsMarks) {
      fv.clearMarks();
      // another trick replaces Sector-Lock: its plates are gone, so its chips go too
      if (sector.on) { sector.reset(); setUi({ sectors: null, lockTotal: null }); }
    }
    pu.apply({ a, b, has: (n) => a === n || b === n, fleet: f, fv, marks, time: stage.time, sectorLock: wave.sectorLock, lockMode, flip, enterSectorLock });
  }

  // ---- the hint ladder (structure "discover") ----
  const factBand = (w: { a: number; b: number }) => band(state().facts[factKey(w.a, w.b)]);
  /** The Power-Up that fits this fleet: its own trick if the cadet has it, else the first that fits. */
  function fittingPowerUp(): TrickId | null {
    if (!wave) return null;
    const { a, b } = wave, belt = ui.belt.map((x) => x.id);
    return [selectTrick(a, b), ...belt].find((t) => belt.includes(t) && POWERUPS[t].fits(a, b)) ?? null;
  }
  function hintUi(): NonNullable<ArenaUi["hint"]> {
    const h = bs.hint;
    return { level: h.level, squads: h.squads ? (h.level >= 1 ? "on" : "soft") : "off", each: h.each ? "on" : "off", powerUp: h.powerUp ? fittingPowerUp() : null };
  }
  function showHint(step: HintStep) {
    if (!wave) return;
    dispatch({ type: "hint", step });
    const h = hintUi();
    fv.showAxis(h.squads, h.each);
    setUi({ hint: h });
    bus.emit("hint_shown", { id: step.id, level: step.level, a: wave.a, b: wave.b, soft: step.soft, trigger: step.trigger, reveal: step.reveal, powerUp: h.powerUp });
  }
  /** Climb the ladder if it has a rung for now. `afterLine`: Nova's reaction, which rung 1 waits for. */
  function climb(afterLine?: Promise<void>) {
    if (structure !== "discover" || !wave) return;
    const step = nextHint(hintState(bs), factBand(wave));
    if (!step) return;
    if (!step.afterLine || !afterLine) return showHint(step);
    const wn = bs.waveNo, misses = bs.attempts;
    void afterLine.then(() => { if (!disposed && bs.waveNo === wn && bs.attempts === misses) showHint(step); });
  }

  // ---- the director: which wave comes next ----
  const state = () => fold(log);
  function beltFor(s: PlayerState, w: Wave | null): ArenaUi["belt"] {
    if (!w) return [];
    const unlocked = TRICKS.filter((t) => opts.dev || (s.seenTricks[t] ?? 0) > 0);
    return unlocked.map((id) => ({ id, card: id === "big-small-split" && w.sectorLock ? "Sector-Lock" : POWERUPS[id].name, fits: POWERUPS[id].fits(w.a, w.b), active: active === id || (id === "flip-it" && fv.flipped) }));
  }

  /**
   * Practice waves never repeat the fleet just played. The plan picks the weakest fact, and a fleet
   * just missed is exactly that, so for this pick it counts as mastered; other seeds break any tie left.
   */
  let lastKey = "";
  function practiceDraw(s0: PlayerState) {
    const s: PlayerState = lastKey ? { ...s0, facts: { ...s0.facts, [lastKey]: { m: 1, seen: 1, fastWins: 1 } } } : s0;
    let w = practiceWave(s, tier, practiceK, mix(seed, practiceK, tier));
    for (let i = 1; i < 6 && factKey(w.a, w.b) === lastKey; i++) w = practiceWave(s, tier, practiceK, mix(seed, practiceK, tier, i));
    return w;
  }

  async function startWave() {
    if (disposed) return;
    let s = state();
    if (mode === "campaign") {
      const jump = acceptHyperJump(s);
      if (jump && declinedAt !== s.waves) {
        const to = jump.payload.toPlanet as PlanetId;
        clearFleet();
        fv.zeroRing.visible = false;
        wave = null;
        dispatch({ type: "offer" });
        setUi({ offer: { to, name: PLANET_NAMES[to] }, wave: null, canFire: canAim(bs) });
        void say(jumpLine(to), { speaker: "Captain", queue: true });
        return;
      }
      const hk = housekeeping(s);
      if (hk.length) { hk.forEach((event) => bus.emit("record", { event })); return finish("clear"); }
      if (s.tier !== tier) { mode = "practice"; setUi({ mode }); }
    }
    if (mode === "practice" && practiceK >= PRACTICE_WAVES && !opts.force) return finish("practice");
    s = state();
    const forced = opts.force && practiceK === 0 ? opts.force : null;
    const w: Wave = mode === "campaign" ? nextWave(s, seed) : forced
      ? { ...forced, tier, planetId: planet, role: "practice", trick: selectTrick(forced.a, forced.b), isTransferCheck: false, sectorLock: Math.min(forced.a, forced.b) >= 10 }
      : practiceDraw(s);
    wave = w;
    lastKey = factKey(w.a, w.b);
    endLesson();
    player.cancel(); // a new fleet: lines for the last one are no longer wanted
    dispatch({ type: "wave", a: w.a, b: w.b });
    active = null; fv.flipped = false; fv.flipT = 0; pendingLesson = null; sector.reset();
    fv.formation.rotation.z = 0;
    fv.axis = structure === "discover" ? { squads: "off", each: "off" } : { squads: "on", each: "on" };
    build(w.a, w.b);
    const index = mode === "campaign" ? s.mission.waves : practiceK;
    setUi({
      wave: { a: w.a, b: w.b, role: w.role, index, of: tier === 0 && mode === "campaign" ? 3 : PRACTICE_WAVES, flipped: false, sectorLock: w.sectorLock },
      canFire: canAim(bs), outcome: null, radar: null, invite: false, belt: beltFor(s, w), sectors: null, lockTotal: null, lesson: null, offer: null,
      hint: structure === "discover" ? hintUi() : null, charge: null,
    });
    bus.emit("wave_started", { a: w.a, b: w.b, index, role: w.role });
    prefetchLesson(false); // Beat 1 of this fleet's Show Me How, while the cadet thinks
    climb(); // a fact never met: the squads label, softly
    if (s.waves === 0 && mode === "campaign" && opts.lines?.intro) await say(opts.lines.intro, { queue: true });
    else if (index === 0 && mode !== "academy") void say(theme.briefing);
    await sched.after(0.75); // the fleet flies in
    ready();
    if (mode === "academy" && opts.academy?.film) void showMeHow({ auto: true, film: true });
  }

  function ready() {
    bus.emit("ready", {});
    dispatch({ type: "ready" });
    shownAt = performance.now();
    setUi({ canFire: canAim(bs) });
  }

  /** The Academy: the fleet is solved; the HUD offers the next step (a sister fleet, another film). */
  function academyDone(w: Wave) {
    clearFleet();
    fv.zeroRing.visible = false;
    wave = null;
    dispatch({ type: "done" });
    bus.emit("battle_done", { kind: "academy" });
    setUi({ wave: null, canFire: canAim(bs), outcome: null, radar: null, lesson: null, done: { title: "NAILED IT", sub: `${fmt(w.a)} × ${fmt(w.b)} = ${fmt(w.a * w.b)}`, next: null } });
    opts.academy?.onSolved?.();
  }

  async function finish(kind: "clear" | "practice") {
    const s = state();
    if (planet === "earth" && !s.introCompleted) bus.emit("record", { event: { type: "intro_completed", payload: {} } });
    clearFleet();
    fv.zeroRing.visible = false;
    wave = null;
    dispatch({ type: "done" });
    if (kind === "clear") {
      bus.emit("orb_burst", { amount: planetClearOrbs(), reason: "planet_cleared" });
      const next = PLANETS_BY_TIER[Math.min(tier + 1, PLANETS_BY_TIER.length - 1)];
      setUi({ wave: null, canFire: canAim(bs), outcome: null, radar: null, done: { title: `${planet === "earth" ? "Cadet Bay" : PLANET_NAMES[planet]} clear`, sub: tier === 7 ? "A bigger sector opens" : `${PLANET_NAMES[next]} is open`, next: tier === 7 ? planet : next } });
      bus.emit("battle_done", { kind });
      await say(opts.lines?.clear ?? theme.clear, { queue: true });
    } else {
      const frontier = PLANETS_BY_TIER[s.tier];
      setUi({ wave: null, canFire: canAim(bs), outcome: null, radar: null, done: { title: "PRACTICE COMPLETE", sub: `${PLANET_NAMES[planet]} · ${PRACTICE_WAVES} waves`, next: frontier } });
      bus.emit("battle_done", { kind });
      await say("nova_practice_done", { queue: true });
    }
  }

  // ---- firing ----
  type FireOpts = { radar?: boolean };
  async function fire(n: number, o: FireOpts = {}) {
    const f = fv.fleet;
    if (!wave || !f || !canAim(bs)) return;
    const w = wave, p = w.a * w.b, latency = Math.round(performance.now() - shownAt);
    const typed = bs.charge;
    dispatch({ type: "fire", radar: !!o.radar });
    setUi({ canFire: canAim(bs), outcome: null, radar: o.radar ? null : ui.radar });
    if (typed !== null) bus.emit("charge", { n: null }); // the digits are spent
    let unlocked: TrickId[] = [];
    if (pendingLesson) {
      const l = pendingLesson, before = state().seenTricks;
      unlocked = l.tricks.filter((t) => !(before[t] ?? 0));
      bus.emit("lesson_completed", { tricks: l.tricks, a: w.a, b: w.b, mode: l.mode, wedoCorrect: n === p });
      pendingLesson = null;
      endLesson();
      if (unlocked.length) {
        // the Trick Card lands on the belt: free and unlimited from now on
        setUi({ unlock: { cards: unlocked.map((t) => CARD[t]) }, belt: beltFor(state(), w) });
        sched.at(3.2, () => setUi({ unlock: null }));
      }
    }
    const errorType = classifyError(w.a, w.b, n);
    bus.emit("fire", {
      n, a: w.a, b: w.b, planet, latencyMs: latency, attempt: bs.attempts, radar: !!o.radar, usedRadar: bs.usedRadar, errorType, powerUp: active,
      isTransferCheck: w.isTransferCheck, waveRole: mode === "campaign" ? w.role : "practice",
    });

    // the volley: every ball pops exactly its ship's worth; the whole thing takes at most ~1.5 s
    const plan = volley(f, n);
    const dur = cannon.volley(plan, fv.views, sched, rnd, fv.formation, {
      onLaunch: (extra) => bus.emit("launch", { extra, t: stage.time }),
      onLand: (v, amount, full, ship) => {
        fv.land(v, amount, full);
        bus.emit("hit", { ship, amount, full, t: stage.time });
        fx.burst(v.g.getWorldPosition(new THREE.Vector3()));
      },
      onExtras: () => cue("flyby"),
    });
    await sched.after(dur);

    if (n === p) {
      dispatch({ type: "exact" });
      bus.emit("resolved", { correct: true, n, product: p, attempt: bs.attempts });
      const orbs = waveClearOrbs(mode, bs.attempts);
      if (orbs) bus.emit("orb_burst", { amount: orbs, reason: "wave_clear" });
      setUi({ outcome: { kind: "exact", value: p, orbs }, radar: null, invite: false, sectors: null, lockTotal: null });
      dispatch({ type: "cleared" });
      bus.emit("wave_cleared", { a: w.a, b: w.b, attempts: bs.attempts, firstTry: bs.attempts === 1, streak: bs.streak });
      void say(unlocked.length ? unlockLine(unlocked[unlocked.length - 1]) : EXACT_LINES[(state().waves + bs.attempts) % EXACT_LINES.length]);
      await sched.after(0.9);
      if (mode === "academy") return academyDone(w);
      if (mode === "practice") practiceK++;
      return startWave();
    }

    // a miss: the outcome is visible in the world, then shields shimmer back on for another try
    const over = n > p, value = over ? plan.extra : plan.remaining;
    bus.emit("resolved", { correct: false, n, product: p, attempt: bs.attempts });
    setUi({ outcome: { kind: over ? "over" : "under", value } });
    fv.wink();
    dispatch({ type: "miss", guess: n, errorType, latencyMs: latency, now: performance.now(), tier });
    const route = bs.lastMiss!, misses = bs.attempts;
    bus.emit("miss", { kind: over ? "over" : "under", value, errorType, attempt: misses, mash: route.mash });
    // predictive pre-fetch (SPEC §6): a miss makes Show Me How likely, so voice all its lines now
    if (misses === 1) prefetchLesson(true);
    if (route.kind !== "react") {
      // stuck after a trick on an early level: the safety net drops to Fast Adding (once a wave);
      // third miss: no reaction line (Nova's lesson is the reaction), shields up, straight into Show Me How
      await sched.after(SHOT.pause);
      restore();
      return void showMeHow({ auto: true, fallback: route.kind === "safety-net" });
    }
    const radar = route.radar ? radarChoices(w.a, w.b, seeded(mix(seed, w.a, w.b, misses))) : null;
    setUi({ radar: radar ?? ui.radar, invite: route.invite });
    // the calming line matters more than a reaction, so it waits its turn instead of being dropped
    const line = say(route.mash ? "nova_hold_fire" : route.invite ? "nova_invite" : errorType && errorType !== "wild_guess" ? ERROR_LINE[errorType] : over ? "nova_err_over" : "nova_err_under", { queue: route.mash });
    climb(line);
    await sched.after(1.05);
    restore();
    if (ui.outcome) setUi({ outcome: { ...ui.outcome, last: true } });
    await sched.after(0.4);
    ready();
  }

  /** Shields back up: every ship returns, so the next shot is at the whole fleet again. */
  function restore() {
    bus.emit("regroup", {});
    fv.regroup();
  }

  // ---- Radar, Power-Ups, Show Me How ----
  function powerUp(t: TrickId) {
    if (!wave || !canAim(bs)) return;
    if (sector.on && t === "big-small-split") return; // already cracking sectors: keep the locks made so far
    const pu = POWERUPS[t], fits = pu.fits(wave.a, wave.b);
    bus.emit("powerup_applied", { id: t, a: wave.a, b: wave.b, fits });
    if (!fits) { void say("nova_misfit"); return; }
    if (t !== "flip-it") active = t;
    applyPowerUp(t);
    void say(pu.line({ a: wave.a, b: wave.b, sectorLock: wave.sectorLock, fv }));
    setUi({ belt: beltFor(state(), wave) });
  }

  /**
   * I Do: the Beat Player walks the trick over this live fleet (dimmed background, camera pushed in,
   * Nova beside it), one visual move per beat, and ends on the We-Do question. The keypad stays live
   * the whole time: firing at any moment ends the lesson cleanly (the shot budget, SPEC §4.1).
   * `fallback`: the early-level safety net, Fast Adding.
   */
  async function showMeHow({ auto = false, fallback = false, film = false } = {}) {
    if (!wave || bs.lessonOn || (!auto && !canAim(bs))) return;
    const w = wave, s = state();
    let p: Plan;
    try { p = planShowMeHow(w.a, w.b, film ? {} : s.seenTricks, { fallback, film }); } catch { return; }
    const id = ++lessonId;
    dispatch({ type: "lesson", fallback });
    pendingLesson = p;
    if (sector.on) sector.reset();
    active = null;
    fv.clearMarks();
    lesson.reset();
    bus.emit("lesson_started", { tricks: p.tricks, a: w.a, b: w.b, mode: p.mode, auto, fallback });
    if (!auto) dispatch({ type: "ask" });
    climb(); // miss 3 or asked: the top rung (both labels)
    const firstFlip = p.tricks.includes("flip-it") && !(s.seenTricks["flip-it"] ?? 0);
    const banner = (card: string, why: string | null) => setUi({ lesson: { card, why, mode: p.mode, fallback, prompt: null, equation: null } });
    setUi({ radar: null, invite: false, sectors: null, lockTotal: null, outcome: null });
    // a turn of its own shows the Flip It! card first; a turn under the first line goes straight to the trick
    const flipCard = p.silentFlip !== fv.flipped && p.tricks.includes("flip-it") && !p.turnUnderLine;
    banner(flipCard ? CARD["flip-it"] : p.banner.card, flipCard ? (firstFlip ? WHY["flip-it"] : null) : p.banner.why);
    setUi({ belt: beltFor(s, w) });
    if (!fallback && safetyNetApplies(tier, w.a, w.b)) try { player.prefetch(planShowMeHow(w.a, w.b, s.seenTricks, { fallback: true }).steps.map((x) => x.speech)); } catch { /* none */ }
    const lessonT0 = performance.now();
    ready(); // the keypad is live from here on: the cadet may fire the moment they see it
    if (p.silentFlip !== fv.flipped && p.turnUnderLine) applyPowerUp("flip-it"); // the fleet turns while Nova speaks
    else if (p.silentFlip !== fv.flipped) {
      applyPowerUp("flip-it");
      await sched.after(FLIP_SEC);
      if (id !== lessonId) return;
      banner(p.banner.card, p.banner.why);
    }
    const done = await player.play(p.steps, (st) => {
      if (id !== lessonId) return;
      if (st.show.kind === "wedo") setUi({ lesson: { ...ui.lesson!, card: st.card, prompt: st.caption, equation: p.equation } });
      lesson.beat(p, st, id, w.a, w.b, stage.time);
    });
    if (done && id === lessonId) bus.emit("lesson_spoken", { ms: Math.round(performance.now() - lessonT0) });
  }

  /** Close the lesson: voice, caption, pending lines and its visuals (the fleet keeps its turn). */
  function endLesson() {
    if (!bs.lessonOn) return;
    dispatch({ type: "lesson_end" });
    lessonId++;
    player.stop(); // lines already being synthesised for this fleet are kept: a safety net may need them
    voice.hush();
    fv.clearMarks();
    setUi({ lesson: null });
  }

  /** Predictive pre-fetch (SPEC §6): speak the lesson's lines into buffers while the cadet thinks. */
  function prefetchLesson(all: boolean) {
    if (!wave) return;
    try {
      const steps = planShowMeHow(wave.a, wave.b, state().seenTricks).steps.filter((x) => x.speech);
      player.prefetch((all ? steps : steps.slice(0, 1)).map((x) => x.speech));
    } catch { /* no lesson for this fleet */ }
  }

  // ---- the frame ----
  const stop = stage.onUpdate((dt, T) => {
    sched.tick();
    fv.update(dt, T);
    cannon.update();
    fx.update(dt, bs.lessonOn);
    // the rocket sits under the fleet; the camera frames fleet + rocket inside the HUD's free area
    const m = measure(fv);
    // the rocket rides the frame: its height eases at the camera's rate, so a new fleet never leaves
    // it below the bottom edge while the camera catches up
    rocketBottom = rocketBottom === null ? m.bottom : rocketBottom + (m.bottom - rocketBottom) * Math.min(1, dt * 3);
    cannon.pose(T, rocketBottom);
    // Nova: in beside the fleet's top-left corner for a lesson, away otherwise; she lip-syncs to the voice
    const nv = nova.update(dt, T, m.w, m.h, bs.lessonOn);
    cam.follow(dt, frameBox(m, bs.lessonOn, nv, fv.axisPad));
    // axis labels ("7 squads", "8 each") keep at least ~26 px on screen, on a phone too
    const ppu = cam.pxPerUnit();
    if (ppu > 0) {
      const want = Math.min(2.2, Math.max(AXIS_H, AXIS_PX / ppu));
      if (Math.abs(want - fv.axisH) / fv.axisH > 0.04) fv.axisSize(fv.axisH + (want - fv.axisH) * Math.min(1, dt * 4));
    }
    backdrop.update(dt);

  });

  backdrop.applyLook();
  setUi({});

  return {
    /** Begin (from a click or key press, so sound can start). */
    start() {
      if (started) return;
      started = true;
      dispatch({ type: "start" });
      audio.unlock();
      void warmVoice(["Zoey"]); // Nova's live Show Me How lines warm in the background
      audio.mood(theme.mood);
      setUi({ started: true });
      void startWave();
    },
    fire: (n: number) => fire(n),
    radar: (n: number) => fire(n, { radar: true }),
    powerUp,
    showMeHow: () => void showMeHow(),
    /** Dev: the lesson plan this fleet would get now. */
    plan: () => (wave ? planShowMeHow(wave.a, wave.b, state().seenTricks) : null),
    /** Dev: where Show Me How's lines came from (baked clip, live Phonon, captions only). */
    voice: () => ({ ...player.stats, slow: player.slow }),
    selectSector(i: number) { if (sector.select(i)) setUi(sector.ui()); },
    lockSector(value: number) { const ok = sector.lock(value); if (ok) setUi(sector.ui()); return ok; },
    /** The cadet is typing (kept for callers; the Radar no longer comes on idle). */
    poke: () => {},
    /** The digits being typed (null: cleared). Wave 2 draws them on the cannon; the bus gets a `charge` event. */
    setCharge(n: number | null) {
      dispatch({ type: "charge", n });
      cannon.setCharge(n);
      bus.emit("charge", { n });
    },
    acceptJump() {
      const jump = acceptHyperJump(state());
      if (!jump) return null;
      bus.emit("record", { event: jump });
      setUi({ offer: null });
      return jump.payload.toPlanet as PlanetId;
    },
    declineJump() { declinedAt = state().waves; setUi({ offer: null }); void startWave(); },
    /** The HUD's footprint in px, so the fleet is framed in the free part of the screen. */
    setSafe(s: Partial<Safe>) { cam.safe = { ...cam.safe, ...s }; },
    captionAt: (px: number, side?: "centre" | "left") => overlay.captionAt(px, side),
    get ui() { return ui; },
    log: () => log,
    /** The battle's event bus: subscribe for fire, hit, miss, resolved, wave_cleared, hint_shown, charge… */
    bus,
    /** The battle's phase machine state, read-only. */
    get battle(): Readonly<BattleState> { return bs; },
    structure,
    dispose() {
      disposed = true;
      endLesson();
      player.cancel();
      stop();
      clearFleet();
      overlay.dispose();
      audio.stopVoice();
      cam.dispose();
      scene.remove(root);
      backdrop.dispose();
      cannon.dispose();
      fx.dispose();
    },
  };
}
export type Arena = ReturnType<typeof mountArena>;
