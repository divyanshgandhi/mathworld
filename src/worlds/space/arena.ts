import * as THREE from "three";
import { TRICKS, type EventInput } from "@/db/events";
import { audio } from "@/engine/audio";
import { createOverlay } from "@/engine/overlay";
import type { Stage } from "@/engine/stage";
import { seeded } from "@/engine/util";
import { warmVoice } from "@/engine/voice";
import { fold, orbsBetween, type LoggedEvent, type OrbEntry, type PlayerState } from "@/director/fold";
import { acceptHyperJump, housekeeping, mix, nextWave, practiceWave, PRACTICE_WAVES, type Wave } from "@/director/next";
import { band } from "@/rig/adaptive";
import { classifyError } from "@/rig/errors";
import { factKey, PLANETS_BY_TIER, tierOfPlanet, type PlanetId } from "@/rig/pools";
import { FLIP_SEC, planShowMeHow, safetyNetApplies, SHOT, WHY, type Plan } from "@/rig/showme";
import { CARD, selectTrick, type TrickId } from "@/rig/tricks";
import { createBus } from "@/battle/bus";
import { GUIDE_FIRST_SHOT, greetKey } from "@/teach/keys";
import { planVolley, targetOrder, volleySchedule } from "@/battle/formation";
import { LOOK, reducedMotion, sairaReady } from "@/battle/look";
import { nextHint, type HintStep } from "@/battle/hints";
import { createLessonStage } from "@/battle/lessonBeats";
import { attachPersistence } from "@/battle/persistence";
import { themeOf } from "@/battle/planets";
import { POWERUPS } from "@/battle/powerups";
import { INVADER, INVADER_TONES, makeInvader, makePlasmaBall } from "./ships";
import { createInstancedFleet } from "@/battle/systems/instanced";
import { createScheduler } from "@/battle/scheduler";
import { createSectorLock } from "@/battle/sectorLock";
import { attachSound } from "@/battle/sound";
import { canAim, hintState, initialBattle, reduce, type BattleAction, type BattleState, type Structure } from "@/battle/state";
import { createBackdrop } from "@/battle/systems/backdrop";
import { createCameraRig, frameBox, measure, type Safe } from "@/battle/systems/camera";
import { createCannon } from "@/battle/systems/cannon";
import { createCharge } from "@/battle/systems/charge";
import { AXIS_H, createFleetView, FLEET_Y, fmt, type AxisShow } from "@/battle/systems/fleetView";
import { createFx } from "@/battle/systems/fx";
import { createKillFx } from "@/battle/systems/kill";
import { createMisses } from "@/battle/systems/misses";
import { createScan } from "@/battle/systems/scan";
import { COUNT_PX, LANE, textAspect } from "@/battle/lanes";
import { createMarks } from "@/battle/systems/marks";
import { createNovaFigure } from "@/battle/systems/nova";
import { attachTelemetry } from "@/battle/telemetry";
import { createVoice } from "@/battle/voice";
import { EXACT_LINE, PLANET_NAMES, unlockLine } from "./lines";
import { pickMissLine } from "@/battle/lines";

/** On-screen height (px) the axis label pills keep, so their words read at about 16 px. */
const AXIS_PX = 26;
/** The rocket's height on screen as a share of its band, and its model's height at scale 1 (tilted, flame included). */
const ROCKET_SHARE = 0.44, ROCKET_MODEL_H = 2.1, ROCKET_Z = 1.8;
/** The last kill's hit-stop (s) and the miss beats: survivors gather, the bracket lands, the fleet comes back. */
const HIT_STOP = 0.065, GATHER = 0.45, RESTORE_AT = 1.65, READY_AFTER = 0.35;
/** A scan never starts sooner than this after the strip's miss line (s). */
const SCAN_AFTER_STRIP = 0.6;
/** Px kept clear above a small rocket band for the number on its nose (phones). */
const NOSE_ROOM = 30;
/** Nova's reactions that only say again what the strip and the world already show (dropped before a scan). */
const REPEATS_STRIP = new Set<string>(["nova_too_few", "nova_too_many", "nova_err_way_off"]);
/** Two presses of Power-Ups closer than this are one press (a double tap on a touch screen). */
const POWERUP_DEBOUNCE_MS = 400;

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
 * Shot budget (wave 2): the volley lands inside ~3.4 s however big the number, squad by squad; a miss
 * shows in the world for ~1.6 s (survivors gather and are counted, or the extras fizz out and are
 * counted), then the full fleet is back and the keypad is live ~2 s after the outcome.
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
  /** Always null: the Targeting Radar (multiple choice) is gone for good. Kept so callers compile. */
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
  /** The end card. `orbs`: what this card is paying for (a planet clear, or a practice run), with its lines. */
  done: { title: string; sub: string; next: PlanetId | null; orbs?: { amount: number; lines: { label: string; amount: number }[] } | null } | null;
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
  /** The digits being typed (drawn on the rocket's nose). */
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
   * "discover" (default): the structure labels start hidden; the formation shows the groups and the hint
   * ladder (src/battle/hints) reveals the labels with scans. "labels": the "N squads" / "N in each squad"
   * labels are always shown. In dev, `?labels` in the URL turns labels on.
   */
  structure?: Structure;
}

export function mountArena(stage: Stage, opts: ArenaOpts) {
  const { scene, camera } = stage, rnd = seeded(5), seed = opts.seed ?? 7;
  const planet = opts.planet, tier = tierOfPlanet(planet), theme = themeOf(planet);
  const structure: Structure = opts.structure ?? (opts.dev && typeof location !== "undefined" && new URLSearchParams(location.search).has("labels") ? "labels" : "discover");
  const origin = opts.origin?.clone() ?? new THREE.Vector3(0, 0, 0);
  const overlay = createOverlay(stage.container, stage.renderer.domElement);
  const log: LoggedEvent[] = [...(opts.history ?? [])];
  void audio.preload();
  void sairaReady();

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
  const kill = createKillFx(stage, root, rnd);
  /** Formation units per CSS px (scans, brackets and counts keep their size on screen). */
  const unitsPerPx = () => { const p = cam.pxPerUnit(0) * fv.scale; return p > 0 ? 1 / p : 0.02; };
  const misses = createMisses(stage, fv, { unitsPerPx });
  const charge = createCharge(stage, root, (out) => cannon.rocket.noseWorld(out));

  // ---- state ----
  let mode: ArenaUi["mode"] = opts.academy ? "academy" : opts.force || s0.tier !== tier ? "practice" : "campaign";
  let practiceK = 0, declinedAt = -1, started = false, disposed = false;
  let wave: Wave | null = null, shownAt = 0;
  let active: TrickId | null = null, pendingLesson: Plan | null = null, lessonId = 0;
  /**
   * The guided first shot (FirstShotGuide in the HUD) coaches this wave: nothing else talks or moves
   * for attention until the first shot (no briefing line, no first-sight scan, no empty-fleet line).
   */
  let guided = mode !== "academy" && !(s0.seen[GUIDE_FIRST_SHOT] ?? 0);
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
  bus.on("charge", (p) => setUi({ charge: p.n }));
  attachSound(bus, (s) => audio.sfx(s));
  attachTelemetry(bus, (t) => setUi(t));
  const cue = (sfx: Parameters<typeof audio.sfx>[0]) => bus.emit("cue", { sfx });

  // ---- Nova ----
  const voice = createVoice(overlay, () => bs.lessonOn), say = voice.say, player = voice.player;
  const scan = createScan(stage, fv, { unitsPerPx, caption: (t) => voice.caption(t, 1600) });

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
  const clearFleet = () => { scan.reset(); misses.clear(); fv.clear(); };

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
    return { level: h.level, squads: h.squads ? "on" : "off", each: h.each ? "on" : "off", powerUp: h.powerUp ? fittingPowerUp() : null };
  }
  /**
   * Show a rung. Its label settles at the end of a scan (squads: the bracket steps down the fleet; each:
   * along the first squad), and only then does the HUD hear about it (`ui.hint`), so nothing is spoiled
   * early. Show Me How reveals both labels at once (the lesson is the show).
   */
  function showHint(step: HintStep, then?: () => void) {
    if (!wave) return;
    const before = hintUi();
    dispatch({ type: "hint", step });
    const h = hintUi(), wn = bs.waveNo;
    bus.emit("hint_shown", { id: step.id, level: step.level, a: wave.a, b: wave.b, soft: false, trigger: step.trigger, reveal: step.reveal, powerUp: h.powerUp });
    const reveal = () => { if (disposed || bs.waveNo !== wn) return; const now = hintUi(); fv.showAxis(now.squads, now.each); setUi({ hint: now }); then?.(); };
    if (step.id === "show-me-how") { scan.skip(); return reveal(); }
    // what was already up stays up while the new label is scanned; the label being scanned waits for its scan
    // (the squads label stays, quiet, while the ships of a squad are counted)
    fv.showAxis(step.id === "squads" ? "off" : before.squads === "on" ? "soft" : before.squads, step.id === "each" ? "off" : before.each);
    const [ra, rb] = fv.flipped ? [wave.b, wave.a] : [wave.a, wave.b];
    scan.start(step.id === "squads" ? "squads" : "each", ra, rb, reveal);
  }
  /** The fleet as the cadet sees it (squads x each), for the ladder's 1 x n and empty rules. */
  const seenShape = () => (wave ? (fv.flipped ? { a: wave.b, b: wave.a } : { a: wave.a, b: wave.b }) : undefined);
  /** The rung this moment would show (null: none), without showing it. */
  const pendingHint = () => (structure === "discover" && wave ? nextHint(hintState(bs), factBand(wave), seenShape()) : null);
  /**
   * Climb the ladder if it has a rung for now. Never before a miss or an ask (decision 1). After a miss
   * the scan waits for the full fleet to be back (`back`) and for any line still being said (`afterLine`);
   * `then` runs when the scan's label has landed (Nova's line goes there, so one voice at a time).
   */
  function climb(afterLine?: Promise<unknown> | null, back?: Promise<unknown>, then?: () => void) {
    if (structure !== "discover" || !wave) return;
    const step = pendingHint();
    if (!step) return void then?.();
    const wait = [step.afterLine ? afterLine : null, back].filter(Boolean);
    if (!wait.length) return showHint(step, then);
    const wn = bs.waveNo, missed = bs.attempts;
    void Promise.all(wait).then(() => { if (!disposed && bs.waveNo === wn && bs.attempts === missed && !bs.lessonOn) showHint(step, then); });
  }

  // ---- the director: which wave comes next ----
  const state = () => fold(log);
  /**
   * Orbs are the fold's, never the battle's (decision 4): the counter is set to the folded total, and the
   * reward is what the log written since `from` earned by the rules table (first try, streak, new Gold…).
   */
  let runEarned = 0, lastEntries: OrbEntry[] = [];
  const settleOrbs = (from: number) => {
    const { earned, entries } = orbsBetween(log.slice(0, from), log);
    runEarned += earned;
    lastEntries = entries.filter((e) => e.amount > 0);
    setUi({ orbs: state().orbs });
    return earned;
  };
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
        void say(`nova_jump_${to}`, { queue: true });
        return;
      }
      const hk = housekeeping(s);
      if (hk.length) { const from = log.length; hk.forEach((event) => bus.emit("record", { event })); return finish("clear", from); }
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
    scan.reset(); misses.clear(); kill.clear(); cannon.clearBalls();
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
    const wn = bs.waveNo;
    if (s.waves === 0 && mode === "campaign" && opts.lines?.intro && !(s.seen[greetKey("battle")] ?? 0)) {
      // the first battle's greeting, once ever: the keypad wakes when it is done, then the guide takes over
      bus.emit("record", { event: { type: "seen", payload: { key: greetKey("battle") } } });
      await say(opts.lines.intro, { queue: true });
      if (guided) voice.hush(); // its caption goes now, so it never sits beside the guide's first line
    } else if (index === 0 && mode !== "academy" && !guided) void say(theme.briefing);
    // nothing is drawn or said about the fleet before the first answer (review round, decision 1);
    // an empty fleet gets its honest line after a miss instead
    // the fleet warps in squad by squad (the first structure cue); the keypad goes live as the last squad lands
    await sched.after(Math.max(0.3, fv.landed - stage.time - 0.15));
    if (disposed || bs.waveNo !== wn) return;
    ready();
    if (mode === "academy" && opts.academy?.film) void showMeHow({ auto: true, film: true });
  }

  /** Room for a scan's count lanes (left: two figures; top: one line), in world units at the fleet. */
  let lastPpu = 0;
  function lanePad(p: { left: number; top: number }) {
    if (!(lastPpu > 0)) return p;
    // capped by the fleet's own size: room asked for in px grows as the camera pulls back, so uncapped it
    // would pull the camera back further every frame on a small phone
    const h = COUNT_PX / lastPpu;
    return {
      left: Math.max(p.left, Math.min(LANE.gap + h * textAspect("00") + 0.1, fv.fw * 0.3)),
      top: Math.max(p.top, Math.min(LANE.topGap + h + 0.1, fv.fh * 0.15)),
    };
  }

  function ready() {
    bus.emit("ready", {});
    dispatch({ type: "ready" });
    shownAt = performance.now();
    charge.set(bs.charge); // digits typed while the last shot played out show now
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

  async function finish(kind: "clear" | "practice", from = log.length) {
    const s = state();
    if (planet === "earth" && !s.introCompleted) bus.emit("record", { event: { type: "intro_completed", payload: {} } });
    clearFleet();
    fv.zeroRing.visible = false;
    wave = null;
    dispatch({ type: "done" });
    if (kind === "clear") {
      backdrop.clearRing(); // the planet takes its gold ring, behind the HUD's clear card
      const orbs = settleOrbs(from);
      if (orbs) bus.emit("orb_burst", { amount: orbs, reason: "planet_cleared" });
      const next = PLANETS_BY_TIER[Math.min(tier + 1, PLANETS_BY_TIER.length - 1)];
      // the card says what clearing the planet paid, line by line (each wave's orbs were shown with its shot)
      const lines = lastEntries.map((e) => ({ label: e.reason, amount: e.amount }));
      setUi({ wave: null, canFire: canAim(bs), outcome: null, radar: null, done: { title: `${PLANET_NAMES[planet]} clear`, sub: tier === 7 ? "A bigger sector opens" : `${PLANET_NAMES[next]} is open`, next: tier === 7 ? planet : next, orbs: orbs ? { amount: orbs, lines } : null } });
      bus.emit("battle_done", { kind });
      await say(opts.lines?.clear ?? theme.clear, { queue: true });
    } else {
      const frontier = PLANETS_BY_TIER[s.tier];
      // a practice run is this visit's five waves (it starts again on a reload), so its total is this run's
      setUi({ wave: null, canFire: canAim(bs), outcome: null, radar: null, done: { title: "PRACTICE COMPLETE", sub: `${PLANET_NAMES[planet]} · ${PRACTICE_WAVES} waves`, next: frontier, orbs: runEarned ? { amount: runEarned, lines: [{ label: `${PRACTICE_WAVES} practice waves`, amount: runEarned }] } : null } });
      bus.emit("battle_done", { kind });
      await say("nova_practice_done", { queue: true });
    }
  }

  // ---- firing ----
  async function fire(n: number) {
    const f = fv.fleet, l = fv.layout;
    if (!wave || !f || !l || !canAim(bs)) return;
    const w = wave, p = w.a * w.b, latency = Math.round(performance.now() - shownAt);
    const typed = bs.charge, from = log.length; // the reward is what this shot's events earn in the fold
    scan.skip(); // firing skips a scan to its end
    guided = false; // the guide's work is done once the first shot is away
    dispatch({ type: "fire", radar: false });
    setUi({ canFire: canAim(bs), outcome: null, radar: null });
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
      n, a: w.a, b: w.b, planet, latencyMs: latency, attempt: bs.attempts, radar: false, usedRadar: bs.usedRadar, errorType, powerUp: active,
      isTransferCheck: w.isTransferCheck, waveRole: mode === "campaign" ? w.role : mode === "academy" ? "academy" : "practice",
    });

    // the volley: one ball per ship (a pod takes its 10 in one ball), in reading order squad by squad;
    // the number on the nose counts down as they leave, so the answer IS the number of balls
    const order = targetOrder(l, fv.flipped), plan = planVolley(f, n, order);
    const squadOf = (h: { ship: number }) => (fv.flipped ? Math.round(l.slots[h.ship].x * 100) : l.slots[h.ship].row);
    const { shots, end } = volleySchedule(plan, squadOf, { reduced: reducedMotion() });
    charge.set(n);
    const seen = fv.flipped ? [w.b, w.a] : [w.a, w.b];
    const spots = misses.extraSpots(plan.extra, seen[1]);
    const top = (l.H > 0 ? l.H / 2 : fv.fh / fv.scale / 2);
    const rowSize = new Map<number, number>();
    for (const id of order) rowSize.set(squadOf({ ship: id }), (rowSize.get(squadOf({ ship: id })) ?? 0) + 1);
    let cleared = 0;
    const lastHit = plan.remaining === 0 ? plan.hits.length - 1 : -1, reduced = reducedMotion();
    const wp = new THREE.Vector3();
    cannon.fire(shots, plan, fv.views, sched, {
      onLaunch: (shot) => { charge.take(shot.worth); bus.emit("launch", { extra: shot.hit === null, t: stage.time }); if (shot.hit === null && shot.step === 0) cue("flyby"); },
      onIncoming: (v, at) => fv.incoming(v, at),
      onLand: (i) => {
        const h = plan.hits[i], v = fv.views[h.ship], last = i === lastHit, hold = last && !reduced ? HIT_STOP : 0;
        fv.land(v, h.amount, h.full, hold);
        root.worldToLocal(v.g.getWorldPosition(wp));
        const size = fv.scale * Math.max(v.size.x, v.size.y) * (v.kind === "fighter" ? 0.78 : 0.45);
        kill.burst(wp, shardColours(v), { size, delay: hold, big: last });
        const shot = shots.find((x) => x.hit === i);
        bus.emit("hit", { ship: h.ship, amount: h.amount, full: h.full, t: stage.time, step: shot?.step ?? 0, last });
        if (last) cam.nudge(0, -0.12 * fv.scale);
        // a squad fully cleared: its pennant drops and one count ticks (the squads, counted again without a word)
        const key = squadOf(h);
        if (h.full && rowSize.has(key)) {
          rowSize.set(key, rowSize.get(key)! - 1);
          if (rowSize.get(key) === 0) {
            const slot = l.slots[h.ship];
            cleared = fv.flipped ? cleared + 1 : slot.squad + slot.span;
            bus.emit("squad_cleared", { squad: key, count: cleared, t: stage.time });
            squadBeat(key, cleared, squadOf);
          }
        }
      },
      extraTo: (i) => {
        if (spots && spots[i]) return fv.formation.localToWorld(spots[i].clone());
        return fv.formation.localToWorld(new THREE.Vector3((rnd() - 0.5) * Math.max(2, l.W), top + 2.5 + rnd() * 2, -14));
      },
      onFizz: (i, at) => {
        kill.fizz(root.worldToLocal(at.clone()), 0.35 * fv.scale);
        if (spots && spots[i]) misses.dot(spots[i]);
      },
    });
    await sched.after(end);
    charge.release();

    if (n === p) {
      dispatch({ type: "exact" });
      bus.emit("resolved", { correct: true, n, product: p, attempt: bs.attempts });
      const orbs = settleOrbs(from);
      if (orbs) bus.emit("orb_burst", { amount: orbs, reason: "wave_clear" });
      setUi({ outcome: { kind: "exact", value: p, orbs }, radar: null, invite: false, sectors: null, lockTotal: null });
      dispatch({ type: "cleared" });
      bus.emit("wave_cleared", { a: w.a, b: w.b, attempts: bs.attempts, firstTry: bs.attempts === 1, streak: bs.streak });
      // one word of praise for a right answer, the same every time (docs/teaching.md, step 12a)
      void say(unlocked.length ? unlockLine(unlocked[unlocked.length - 1]) : EXACT_LINE);
      await sched.after(0.8);
      if (mode === "academy") return academyDone(w);
      if (mode === "practice") practiceK++;
      return startWave();
    }

    // a miss, shown in the world: too few and the survivors gather into true rows and are counted;
    // too many and the extras' fizz marks are counted. Then the full fleet is back for another try.
    const over = n > p, value = over ? plan.extra : plan.remaining;
    bus.emit("resolved", { correct: false, n, product: p, attempt: bs.attempts });
    setUi({ outcome: { kind: over ? "over" : "under", value } });
    kill.clearTicks(); // the volley's squad counts go before the miss is counted in the world
    if (over) misses.over(value);
    else {
      const alive = fv.gather(order), gathered = alive.length > 0 && fv.views.every((v) => v.kind === "fighter");
      fv.wink(GATHER);
      sched.at(GATHER + 0.05, () => { if (wave === w && !bs.lessonOn) misses.under(alive, value, gathered); });
    }
    dispatch({ type: "miss", guess: n, errorType, latencyMs: latency, now: performance.now(), tier });
    const route = bs.lastMiss!, missed = bs.attempts;
    bus.emit("miss", { kind: over ? "over" : "under", value, errorType, attempt: missed, mash: route.mash });
    // predictive pre-fetch (SPEC §6): a miss makes Show Me How likely, so voice all its lines now
    if (missed === 1) prefetchLesson(true);
    if (route.kind !== "react") {
      // stuck after a trick on an early level: the safety net drops to Fast Adding (once a wave);
      // third miss: the miss shows, then no reaction line (Nova's lesson is the reaction), straight into Show Me How
      await sched.after(Math.max(SHOT.pause, RESTORE_AT - 0.4));
      restore();
      return void showMeHow({ auto: true, fallback: route.kind === "safety-net" });
    }
    setUi({ radar: null, invite: route.invite });
    // one voice at a time (decision 3): the strip says the miss now; a scan, if one is due, starts once the
    // whole fleet is back (2 s on, so 0.6 s or more after the strip's line); Nova speaks after its label
    // lands, or not at all when her line would only repeat the strip or the count
    const id = route.mash ? "nova_hold_fire" : route.invite ? (fittingPowerUp() ? "nova_invite_power" : "nova_invite_help")
      : w.a === 0 || w.b === 0 ? (w.a === 0 ? "nova_zero_squads" : "nova_zero_each") : missLine(errorType, over, n, w);
    const back = sched.after(Math.max(RESTORE_AT + READY_AFTER, SCAN_AFTER_STRIP));
    const rung = pendingHint();
    if (route.mash || !rung || rung.showMeHow) climb(say(id, { queue: route.mash }), back); // the calming line waits its turn
    else climb(null, back, REPEATS_STRIP.has(id) ? undefined : () => { if (wave === w && !bs.lessonOn) void say(id); });
    await sched.after(RESTORE_AT);
    if (wave !== w) return;
    restore();
    if (ui.outcome) setUi({ outcome: { ...ui.outcome, last: true } });
    await sched.after(READY_AFTER);
    if (wave !== w) return;
    ready();
  }

  /** Nova's reaction to a miss she has no hint for yet: the kind of mistake, in the glossary's words. */
  function missLine(errorType: ReturnType<typeof classifyError>, over: boolean, n: number, w: { a: number; b: number }): string {
    return pickMissLine(errorType, over, n, w.a, w.b);
  }

  /** The colours a ship breaks into: its squad tone and its dark parts. */
  function shardColours(v: { gRow: number }) {
    return [INVADER[INVADER_TONES[v.gRow % 2]], INVADER.shade, INVADER.visor];
  }
  /** A squad is cleared: the leader's pennant drops from its place and one small count ticks beside the squad. */
  function squadBeat(key: number, count: number, squadOf: (h: { ship: number }) => number) {
    const row = fv.views.filter((v) => squadOf({ ship: v.ship.id }) === key);
    if (!row.length || (wave && Math.max(wave.a, wave.b) > 40)) return;
    const lead = row.reduce((m, v) => (v.slot.index < m.slot.index ? v : m), row[0]);
    const p = fv.formation.localToWorld(fv.placeOf(lead));
    root.worldToLocal(p);
    const isLeader = lead.kind === "fighter" && lead.leader;
    if (isLeader) kill.pennant(p.clone().add(new THREE.Vector3(0, 0.5 * fv.scale, 0.2)), fv.scale * 0.78);
    // the left lane holds one thing at a time: with "7 squads" on show there, the squads are not counted again
    if (fv.words && fv.axis.squads !== "off") return void (key >= 0 && cue("tick"));
    const h = 20 * unitsPerPx() * fv.scale;
    kill.tick(p.clone().add(new THREE.Vector3(-(lead.size.x / 2 + 0.45) * fv.scale, 0, 0.6)), fmt(count), h);
    if (key >= 0) cue("tick");
  }

  /** Shields back up: every ship returns, so the next shot is at the whole fleet again. */
  function restore() {
    bus.emit("regroup", {});
    misses.clear();
    fv.regroup();
  }

  // ---- Power-Ups, Show Me How ----
  let powerUpAt = -Infinity;
  function powerUp(t: TrickId) {
    if (!wave || !canAim(bs)) return;
    // a double tap is one press: the second would undo the first (Flip It! turns back) before anyone sees it
    const now = performance.now();
    if (now - powerUpAt < POWERUP_DEBOUNCE_MS) return;
    powerUpAt = now;
    if (sector.on && t === "big-small-split") return; // already cracking sectors: keep the locks made so far
    const pu = POWERUPS[t], fits = pu.fits(wave.a, wave.b);
    bus.emit("powerup_applied", { id: t, a: wave.a, b: wave.b, fits });
    // the cadet's own press: its line replaces whatever Nova was saying, so the caption always names the Power-Up in use
    if (!fits) { void say("nova_misfit", { interrupt: true }); return; }
    if (t !== "flip-it") active = t;
    applyPowerUp(t);
    void say(pu.line({ a: wave.a, b: wave.b, sectorLock: wave.sectorLock, fv }), { interrupt: true });
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
  const rocketAt = new THREE.Vector3(), rectAt = new THREE.Vector3(), rectP = new THREE.Vector3(), rectBox = new THREE.Box3();
  /** How far (px) the rocket is lifted so its flame clears the bottom of the free area. */
  let rocketLift = 0;
  /** A world box as the cadet sees it: its screen box in CSS px, or null if it is empty or off the canvas. */
  function onScreen(box: THREE.Box3): DOMRect | null {
    const r = stage.renderer.domElement.getBoundingClientRect();
    if (box.isEmpty() || !r.width || !r.height) return null;
    camera.updateMatrixWorld();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      rectP.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
      const px = r.left + ((rectP.x + 1) / 2) * r.width, py = r.top + ((1 - rectP.y) / 2) * r.height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return x1 > x0 && y1 > y0 ? new DOMRect(x0, y0, x1 - x0, y1 - y0) : null;
  }
  const stop = stage.onUpdate((dt, T) => {
    sched.tick();
    fv.update(dt, T);
    cannon.update();
    fx.update(dt, bs.lessonOn);
    kill.update(dt);
    scan.update();
    misses.update();
    // Show me how: its plates and tags say the squads and the each, so the axis words step back while it
    // runs (the play area holds the fleet, its plates, the divide, the two tags and the rocket)
    fv.labels.visible = !bs.lessonOn;
    // the camera frames the fleet (and the labels on show) in the HUD's free area, above the rocket's band
    const m = measure(fv);
    const nv = nova.update(dt, T, m.w, (m.top - FLEET_Y) * 2, bs.lessonOn); // she hovers at the fleet's top edge
    // a ship's cell stays at most ~120 px (less on a short screen), so 1 × 4 does not fill the sky with four giants
    const cellMax = Math.min(120, cam.free.fh * 0.2);
    // the room for the axis words is kept from the first frame (structure "discover" reveals them later)
    // and, with no words beside the fleet (a phone), the lanes a scan's one number needs (src/battle/lanes.ts)
    const pad = structure === "discover" ? lanePad(fv.wordsPad()) : fv.visiblePad();
    // a small band leaves the number on the nose reaching above it: the fleet keeps clear of that number too
    cam.follow(dt, frameBox(m, bs.lessonOn, nv, pad), !bs.lessonOn, cellMax / fv.scale, rocketLift + (cam.band < 70 ? NOSE_ROOM : 0));
    // the rocket rests at the bottom centre of the free area, the same size on screen whatever the fleet
    const ppuR = cam.pxPerUnit(ROCKET_Z);
    if (ppuR > 0) {
      cannon.scale = (cam.band * ROCKET_SHARE) / ppuR / ROCKET_MODEL_H;
      cam.bottomCentre(cam.band * 0.3 + rocketLift, ROCKET_Z, rocketAt);
      cannon.pose(T, rocketAt);
      // the whole rocket, flame included, rests inside the free area: Nova's caption band below it is never
      // drawn over the rocket. The flame's reach depends on the model, so it is measured, not guessed
      rectBox.setFromObject(cannon.rocket.group);
      const rr = onScreen(rectBox), fr = cam.free, canvasTop = stage.renderer.domElement.getBoundingClientRect().top;
      if (rr) {
        const over = rr.bottom - (canvasTop + cam.safe.top + fr.fh - 2);
        if (over > 0.5 || (over < -6 && rocketLift > 0)) rocketLift = Math.max(0, Math.min(cam.band * 0.6, rocketLift + over * Math.min(1, dt * 8)));
      }
    }
    // the typed number rides the nose: its figures 28–30 px tall on a phone, 44 px on a larger screen
    const el = stage.renderer.domElement, phone = Math.min(el.clientWidth || 800, el.clientHeight || 800) < 600;
    const ppuN = cam.pxPerUnit(ROCKET_Z + 0.4);
    if (ppuN > 0) charge.update(1 / ppuN, phone ? (cam.band < 100 ? 28 : 30) : 44);
    // axis labels ("7 squads", "8 in each squad") keep at least ~26 px on screen, on a phone too
    const ppu = cam.pxPerUnit();
    lastPpu = ppu;
    if (ppu > 0) {
      const want = Math.min(2.2, Math.max(AXIS_H, AXIS_PX / ppu));
      if (Math.abs(want - fv.axisH) / fv.axisH > 0.04) fv.axisSize(fv.axisH + (want - fv.axisH) * Math.min(1, dt * 4));
    }
    const fr = cam.free;
    backdrop.update(dt, { at: (dx, dy, z) => cam.at(dx, dy, z), ppu: (z) => cam.pxPerUnit(z), fw: fr.fw, fh: fr.fh });
  });

  backdrop.applyLook();
  prewarm();
  setUi({});

  /**
   * Compile every shader a shot will need before the first shot, so the first volley does not stall
   * on a phone: the ball and the extra ball, the shards, the ring, the ink, and the instanced drones.
   */
  function prewarm() {
    const g = new THREE.Group();
    const ball = makePlasmaBall(stage.mats, s0.equipped.blaster), over = makePlasmaBall(stage.mats, s0.equipped.blaster);
    over.material = stage.mats.glow(LOOK.over.color, LOOK.over.intensity, { roughness: 0.4 });
    g.add(ball, over);
    const inst = createInstancedFleet(g, ["ember|1", "ember|0", "apricot|1", "apricot|0"].map((style) => ({ g: new THREE.Object3D(), style, visible: () => false })), (key) => {
      const [tone, leader] = key.split("|");
      return makeInvader(stage.mats, { tone: tone as "ember" | "apricot", leader: leader === "1" });
    });
    root.add(g);
    kill.prewarm(true);
    try { stage.renderer.compile(scene, camera); } catch { /* a lost context compiles on first draw instead */ }
    kill.prewarm(false);
    inst.dispose();
    root.remove(g);
  }

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
    /** The Targeting Radar is gone (no multiple choice); kept as an alias of `fire` so callers compile. */
    radar: (n: number) => fire(n),
    powerUp,
    showMeHow: () => void showMeHow(),
    /** Dev: the lesson plan this fleet would get now. */
    plan: () => (wave ? planShowMeHow(wave.a, wave.b, state().seenTricks) : null),
    /** Dev: how the camera frames the fleet right now (free area and rocket band in px, the fleet and its box in units). */
    frame: () => ({ free: cam.free, safe: cam.safe, band: cam.band, ppu: cam.pxPerUnit(), m: measure(fv), pad: fv.visiblePad(), scale: fv.scale }),
    /** Dev: play the planet-clear beat in the world (the gold ring) without clearing the planet. */
    devClearRing: () => { if (opts.dev) backdrop.clearRing(); },
    /** Dev: where Show Me How's lines came from (baked clip, live Phonon, captions only). */
    voice: () => ({ ...player.stats, slow: player.slow }),
    selectSector(i: number) { if (sector.select(i)) setUi(sector.ui()); },
    lockSector(value: number) { const ok = sector.lock(value); if (ok) setUi(sector.ui()); return ok; },
    /** The cadet is typing (kept for callers; the Radar no longer comes on idle). */
    poke: () => {},
    /**
     * The digits being typed (null: cleared). They show on the rocket's nose (while a shot plays out they
     * wait, and show when the keypad is live again); typing skips a scan to its end. The bus gets `charge`.
     */
    setCharge(n: number | null) {
      dispatch({ type: "charge", n });
      cannon.setCharge(n);
      if (canAim(bs) || !wave) charge.set(n);
      if (n !== null) scan.skip();
      // typing again: the last shot's line ("2 ships got away") has done its job
      if (n !== null && ui.outcome?.last) setUi({ outcome: null });
      bus.emit("charge", { n });
    },
    acceptJump() {
      const jump = acceptHyperJump(state());
      if (!jump) return null;
      bus.emit("record", { event: jump });
      setUi({ offer: null });
      return jump.payload.toPlanet as PlanetId;
    },
    declineJump() { declinedAt = state().waves; voice.hush(); setUi({ offer: null }); void startWave(); }, // the offer line goes with the card
    /**
     * The fleet's box on screen in CSS px (the ships still flying, not their labels), or null with no
     * fleet. The guided first shot rings it.
     */
    fleetRect(): DOMRect | null {
      if (!wave) return null;
      rectBox.makeEmpty();
      for (const v of fv.views) {
        if (!v.alive || !v.g.visible) continue;
        v.g.getWorldPosition(rectAt);
        const hx = (v.size.x * fv.scale) / 2, hy = (v.size.y * fv.scale) / 2;
        rectBox.expandByPoint(rectP.set(rectAt.x - hx, rectAt.y - hy, rectAt.z)).expandByPoint(rectP.set(rectAt.x + hx, rectAt.y + hy, rectAt.z));
      }
      return onScreen(rectBox);
    },
    /**
     * Dev (the playfield review, docs/overhaul/playfield.md): every mark drawn round the fleet now, as a
     * screen rectangle in CSS px (labels, hairlines, scan counts and bracket, miss marks, Power-Up marks,
     * kill ticks), the fleet, the rocket, one ship's size, and every pair of marks that overlap.
     */
    playfield() {
      type R = { id: string; text: string | null; x: number; y: number; w: number; h: number };
      const out: R[] = [], box = new THREE.Box3();
      const visible = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true; };
      const push = (id: string, o: THREE.Object3D) => {
        if (!visible(o)) return;
        const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (m && "opacity" in m && m.opacity < 0.05) return;
        box.setFromObject(o);
        const r = onScreen(box);
        if (r && r.width > 0.5 && r.height > 0.5) out.push({ id, text: (o.userData.text as string) ?? null, x: r.x, y: r.y, w: r.width, h: r.height });
      };
      for (const c of fv.labels.children) push(`axis:${c.userData.axis ?? "?"}${c.userData.axisText ? ":label" : ":hairline"}`, c);
      for (const c of fv.overlay.children) push(c.userData.text ? "overlay:text" : (c as THREE.Line).isLine ? "overlay:dot" : "overlay:bracket", c);
      for (const c of fv.visuals.children) push(c.userData.text ? "visual:text" : "visual", c);
      for (const c of root.children) if (c.userData.text) push("world:text", c);
      const rocket = this.rocketRect();
      // the fleet's box from every ship in place (an instanced fleet draws its fighters without their groups)
      box.makeEmpty();
      for (const v of fv.views) {
        if (!v.alive) continue;
        v.g.getWorldPosition(rectAt);
        const hx = (v.size.x * fv.scale) / 2, hy = (v.size.y * fv.scale) / 2;
        box.expandByPoint(rectP.set(rectAt.x - hx, rectAt.y - hy, rectAt.z)).expandByPoint(rectP.set(rectAt.x + hx, rectAt.y + hy, rectAt.z));
      }
      const fleet = wave ? onScreen(box) : null;
      const ship = fv.views.find((v) => v.alive);
      let shipPx: number | null = null;
      if (ship) { ship.g.getWorldPosition(rectAt); const hy = (ship.size.y * fv.scale) / 2; const hx = (ship.size.x * fv.scale) / 2; box.makeEmpty().expandByPoint(rectP.set(rectAt.x - hx, rectAt.y - hy, rectAt.z)).expandByPoint(rectP.set(rectAt.x + hx, rectAt.y + hy, rectAt.z)); shipPx = onScreen(box)?.height ?? null; }
      const hit: [string, string][] = [];
      const all = [...out, ...(fleet ? [{ id: "fleet", text: null, x: fleet.x, y: fleet.y, w: fleet.width, h: fleet.height }] : [])];
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const p = all[i], q = all[j];
        if (p.x < q.x + q.w - 1 && q.x < p.x + p.w - 1 && p.y < q.y + q.h - 1 && q.y < p.y + p.h - 1) {
          // a scan's bracket and the visual marks are meant to sit on the fleet
          if ((p.id === "fleet" || q.id === "fleet") && /bracket|visual|dot/.test(p.id + q.id)) continue;
          // a lesson's tags sit on its own plates by design
          if (/^visual/.test(p.id) && /^visual/.test(q.id)) continue;
          // lines crossing lines (a bracket round its fizz dots) are not words colliding
          if (!p.text && !q.text && p.id !== "fleet" && q.id !== "fleet") continue;
          hit.push([`${p.id}${p.text ? ` "${p.text}"` : ""}`, `${q.id}${q.text ? ` "${q.text}"` : ""}`]);
        }
      }
      return { time: stage.time, fleet: fleet && { x: fleet.x, y: fleet.y, w: fleet.width, h: fleet.height }, rocket: rocket && { x: rocket.x, y: rocket.y, w: rocket.width, h: rocket.height }, shipPx, marks: out, overlaps: hit, scan: scan.debug(), hint: ui.hint, words: fv.words, safe: cam.safe, band: cam.band, lift: rocketLift, pad: lanePad(fv.wordsPad()), fw: fv.fw, fh: fv.fh };
    },
    /** The rocket and the number on its nose, as a box on screen in CSS px (the guide keeps its captions off them). */
    rocketRect(): DOMRect | null {
      rectBox.setFromObject(cannon.rocket.group);
      if (!rectBox.isEmpty()) rectBox.max.y += (rectBox.max.y - rectBox.min.y) * 0.9; // the number rides just above the nose
      return onScreen(rectBox);
    },
    /**
     * Where the axis words go: beside the fleet (`true`, wide screens) or only in the HUD (`false`, a
     * narrow portrait screen, where the room beside the fleet would shrink it). Each word shows once.
     */
    setAxisWords(on: boolean) { if (fv.words === on) return; fv.words = on; fv.showAxis(fv.axis.squads, fv.axis.each); },
    /** The HUD's footprint in px, so the fleet is framed in the free part of the screen. */
    setSafe(s: Partial<Safe>) { cam.safe = { ...cam.safe, ...s }; },
    captionAt: (px: number, side?: "centre" | "left", maxPx?: number) => overlay.captionAt(px, side, maxPx),
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
      scan.reset();
      misses.dispose();
      clearFleet();
      overlay.dispose();
      audio.stopVoice();
      cam.dispose();
      scene.remove(root);
      backdrop.dispose();
      cannon.dispose();
      fx.dispose();
      kill.dispose();
      charge.dispose();
    },
  };
}
export type Arena = ReturnType<typeof mountArena>;
