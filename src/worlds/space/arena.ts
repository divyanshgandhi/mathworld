import * as THREE from "three";
import { TRICKS, type EventInput } from "@/db/events";
import { audio } from "@/engine/audio";
import { add, canvasTexture, fitText, PALETTE } from "@/engine/materials";
import { createOverlay } from "@/engine/overlay";
import type { Stage } from "@/engine/stage";
import { ease, seeded } from "@/engine/util";
import { prepare, warmVoice } from "@/engine/voice";
import { fold, type LoggedEvent, type PlayerState } from "@/director/fold";
import { acceptHyperJump, housekeeping, mix, nextWave, practiceWave, PRACTICE_WAVES, scaffold, type Wave } from "@/director/next";
import { classifyError, radarChoices } from "@/rig/errors";
import { fleetOf, unitLabel, volley, type Fleet, type Ship } from "@/rig/fleet";
import { factKey, PLANETS_BY_TIER, tierOfPlanet, type PlanetId } from "@/rig/pools";
import { CARD, lesson, powerUpFits, selectTrick, type Lesson, type TrickId } from "@/rig/tricks";
import { BATTLE_LINES, ERROR_LINE, EXACT_LINES, jumpLine, PLANET_NAMES, POWERUP_LINE } from "./lines";
import { BLASTERS, makeCarrier, makeDreadnought, makeFighterLite, makeGhost, makeInvader, makeRocket, makeTenSquadPod } from "./ships";
import { mountSky } from "./skies";

/**
 * The battle engine (SPEC §1, §3, §4): one wave at a time from the director, a Base-10 fleet laid
 * out rows × columns, a volley that pops exactly `n` ships' worth, and progressive scaffolding.
 * The answer is the action; every action is an event. Used by /play/[planet] and by Cadet Bay.
 *
 * Shot budget: the volley is capped at ~1.5 s however big the number, the outcome holds ~1 s, Nova's
 * line is one short sentence, and the fleet regroups in ~0.4 s, so fire → ready stays under ~5 s.
 */
export interface ArenaUi {
  planet: PlanetId;
  planetName: string;
  mode: "campaign" | "practice";
  started: boolean;
  wave: { a: number; b: number; role: string; index: number; of: number; flipped: boolean; sectorLock: boolean } | null;
  canFire: boolean;
  outcome: { kind: "exact" | "under" | "over"; value: number; orbs?: number } | null;
  radar: number[] | null;
  invite: boolean;
  belt: { id: TrickId; card: string; fits: boolean; active: boolean }[];
  sectors: { i: number; label: string; value: number | null; active: boolean }[] | null;
  lockTotal: number | null;
  lesson: { card: string; prompt: string | null } | null;
  offer: { to: PlanetId; name: string } | null;
  done: { title: string; sub: string; next: PlanetId | null } | null;
  orbs: number;
  /** fire → ready again, in ms, for every shot so far (the 5–10 s rule, checked in the browser). */
  shots: number[];
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
}

type Kind = "fighter" | "pod" | "carrier" | "dread";
interface ShipView {
  ship: Ship; kind: Kind; g: THREE.Group; home: THREE.Vector3; offset: THREE.Vector3; pos: THREE.Vector3;
  gRow: number; gCol: number; size: THREE.Vector2;
  alive: boolean; pop: number; enter: number; wink: number; ph: number;
  micro?: THREE.Group[]; carrier?: ReturnType<typeof makeCarrier>; dread?: ReturnType<typeof makeDreadnought>; base: number;
}
type Ball = { m: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; land?: () => void };

const CELL = 1.0, BIG = 2.4, GAP = 0.16, GUTTER = 0.75;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const fmt = (n: number) => n.toLocaleString("en-US");

/** A text plate that always faces the straight-on battle camera. */
function textPlane(text: string, height: number, color = "#d9f99d", bg = "rgba(11,13,26,0.72)") {
  const pxH = 96, { texture, ctx } = canvasTexture(16, 16), c = ctx.canvas;
  ctx.font = `700 ${pxH * 0.62}px ui-sans-serif, system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width + pxH * 0.7);
  c.width = w; c.height = pxH;
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(0, 0, w, pxH, pxH / 2); ctx.fill();
  ctx.fillStyle = color;
  fitText(ctx, text, w / 2, pxH / 2 + 2, w - pxH * 0.4, pxH * 0.62, "700", "ui-sans-serif, system-ui, sans-serif");
  texture.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry((height * w) / pxH, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
  m.renderOrder = 5;
  return m;
}

export function mountArena(stage: Stage, opts: ArenaOpts) {
  const { scene, camera, mats: M } = stage, rnd = seeded(5), seed = opts.seed ?? 7;
  const planet = opts.planet, tier = tierOfPlanet(planet);
  const origin = opts.origin?.clone() ?? new THREE.Vector3(0, 0, 0);
  const overlay = createOverlay(stage.container, stage.renderer.domElement);
  const log: LoggedEvent[] = [...(opts.history ?? [])];
  void audio.preload();
  const sky = opts.sky === false ? null : mountSky(stage, planet, origin);
  const root = new THREE.Group();
  root.position.copy(origin);
  scene.add(root);

  // light: warm key, cool rim, soft sky fill; no shadows needed for a fleet in space
  const key = new THREE.DirectionalLight(0xfff1dc, 1.6);
  key.position.set(origin.x - 8, origin.y + 14, origin.z + 10);
  key.target.position.copy(origin);
  const rim = new THREE.DirectionalLight(0x7dfcff, 0.9);
  rim.position.set(origin.x + 6, origin.y + 6, origin.z - 10);
  const fill = new THREE.HemisphereLight(0xc8d8ff, 0x1a2244, 0.85);
  scene.add(key, key.target, rim, fill);

  const s0 = fold(log);
  const rocket = makeRocket(M, { hull: s0.equipped.hull, thruster: s0.equipped.thruster });
  const blaster = BLASTERS[(s0.equipped.blaster ?? "plasma-ball") as keyof typeof BLASTERS] ?? BLASTERS["plasma-ball"];
  rocket.group.rotation.set(-1.05, 0, 0);
  rocket.group.scale.setScalar(0.55);
  root.add(rocket.group);

  // the fleet lives in `formation` (it can turn for Flip It!); labels stay upright outside it
  const formation = new THREE.Group(), labels = new THREE.Group();
  formation.position.set(0, 4.2, 0);
  root.add(formation, labels);
  const zeroRing = add(formation, new THREE.TorusGeometry(1.4, 0.05, 12, 96), M.glow(PALETTE.cyan, 0.6), 0, 0, 0, { cast: false });
  zeroRing.visible = false;
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x7dfcff, transparent: true, opacity: 0, depthWrite: false }));
  shield.position.z = 0.8;
  formation.add(shield);

  // ---- state ----
  let mode: "campaign" | "practice" = opts.force || s0.tier !== tier ? "practice" : "campaign";
  let practiceK = 0, declinedAt = -1, started = false, disposed = false;
  let wave: Wave | null = null, fleet: Fleet | null = null, views: ShipView[] = [], ghosts: THREE.Object3D[] = [];
  let attempts = 0, shownAt = 0, lastActivity = 0, shotStart = 0, scale = 1, fw = 8, fh = 5;
  let usedRadar = false, active: TrickId | null = null, flipped = false, flipT = 0, pendingLesson: Lesson | null = null;
  let locked: Map<number, number> = new Map(), activeSector: number | null = null, sectorMode = false;
  let wild: number[] = [];
  let ui: ArenaUi = {
    planet, planetName: PLANET_NAMES[planet], mode, started: false, wave: null, canFire: false, outcome: null, radar: null, invite: false,
    belt: [], sectors: null, lockTotal: null, lesson: null, offer: null, done: null, orbs: s0.orbs, shots: [],
  };
  const setUi = (p: Partial<ArenaUi>) => { ui = { ...ui, ...p }; opts.onUi?.(ui); };
  const emit = (e: EventInput) => { log.push({ ...e, at: Date.now() }); opts.onEvent?.(e); if (e.type === "orb_earned") setUi({ orbs: ui.orbs + e.payload.amount }); };

  // ---- a scheduler on the stage clock, so `stage.paused` + `stage.step` can inspect any frame ----
  const timers: { at: number; fn: () => void }[] = [];
  const after = (sec: number) => new Promise<void>((r) => timers.push({ at: stage.time + sec, fn: r }));

  // ---- Nova ----
  let voiceUntil = 0, captionTimer = 0;
  const lineText = (id: string) => audio.text(id) || (BATTLE_LINES as Record<string, string>)[id] || "";
  const readTime = (text: string) => 0.7 + text.split(/\s+/).length * 0.24; // captions-only pace when no voice is ready
  /**
   * One Nova (or Captain) line. Never cuts off a line that is still being spoken: a reaction that
   * arrives while she talks is dropped (the HUD already shows the outcome); `queue` waits instead.
   * Resolves when the words stop plus a short breath.
   */
  async function say(id: string, { queue = false, speaker = "Nova" } = {}) {
    const now = performance.now();
    if (now < voiceUntil) { if (!queue) return; await wait(voiceUntil - now); }
    const text = lineText(id);
    if (!text) return;
    overlay.caption(speaker, text);
    const clip = audio.manifest[id];
    const len = clip ? audio.spoken(id) : readTime(text);
    voiceUntil = performance.now() + len * 1000 + 250;
    if (clip) void audio.say(id);
    window.clearTimeout(captionTimer);
    captionTimer = window.setTimeout(() => overlay.caption("", ""), len * 1000 + 900);
    await wait(len * 1000 + 250);
  }
  /** A live line (lesson beats with this fleet's numbers): a baked clip if the words match, else Phonon, else captions paced on reading time. */
  const liveCache = new Map<string, Promise<AudioBuffer | null>>();
  let liveSlow = false;
  const live = (text: string) => { if (!liveCache.has(text)) liveCache.set(text, prepare(text, "Zoey")); return liveCache.get(text)!; };
  async function speak(text: string) {
    const baked = Object.entries(audio.manifest).find(([k, c]) => k.startsWith("nova") && norm(c.text) === norm(text))?.[0];
    if (baked) return say(baked, { queue: true });
    const now = performance.now();
    if (now < voiceUntil) await wait(voiceUntil - now);
    overlay.caption("Nova", text);
    window.clearTimeout(captionTimer);
    // wait a moment for live speech, but once it has missed a line, don't keep making the cadet wait
    const buf = await Promise.race([live(text), wait(liveSlow ? 150 : 1200).then(() => null)]);
    liveSlow = !buf;
    const len = buf ? audio.spokenLength(buf) : readTime(text);
    if (buf) void audio.play(buf);
    voiceUntil = performance.now() + len * 1000 + 550;
    window.clearTimeout(captionTimer);
    captionTimer = window.setTimeout(() => overlay.caption("", ""), len * 1000 + 900); // never left hanging over the next wave
    await wait(len * 1000 + 550); // pace on the end of speech plus a breath, so a line never cuts itself off
  }

  // ---- fleet building ----
  const lite = (f: Fleet) => f.ships.length > 140;
  function clearFleet() {
    for (const v of views) { v.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); formation.remove(v.g); }
    views = [];
    clearVisuals();
    labels.clear();
  }

  function build(a: number, b: number) {
    clearFleet();
    fleet = fleetOf(a, b);
    const f = fleet;
    const colW = f.colParts.map((c) => { const k = String(c).length - 1, d = c / 10 ** k, w = k === 0 ? CELL : BIG; return { d, w, span: d * w + (d - 1) * GAP }; });
    const rowH = f.rowParts.map((r) => { const k = String(r).length - 1, d = r / 10 ** k, h = k === 0 ? CELL : BIG; return { d, h, span: d * h + (d - 1) * GAP }; });
    const colX: number[] = [], rowY: number[] = [];
    colW.reduce((x, c, i) => { colX[i] = x; return x + c.span + GUTTER; }, 0);
    rowH.reduce((y, r, i) => { rowY[i] = y; return y + r.span + GUTTER; }, 0);
    const W = colW.length ? colX[colX.length - 1] + colW[colW.length - 1].span : 0, H = rowH.length ? rowY[rowY.length - 1] + rowH[rowH.length - 1].span : 0;
    scale = Math.min(1.55, 11 / Math.max(W, 1), 6.6 / Math.max(H, 1));
    fw = Math.max(W * scale, 3); fh = Math.max(H * scale, 2);
    formation.scale.setScalar(scale);
    const slotsBefore = (parts: number[], i: number) => parts.slice(0, i).reduce((s, p) => s + p / 10 ** (String(p).length - 1), 0);
    const stagger = Math.min(0.025, 0.5 / Math.max(1, f.ships.length));
    for (const ship of f.ships) {
      const sec = f.sectors[ship.sector], cw = colW[sec.colBand], rh = rowH[sec.rowBand];
      const x = colX[sec.colBand] + ship.col * (cw.w + GAP) + cw.w / 2 - W / 2, y = H / 2 - (rowY[sec.rowBand] + ship.row * (rh.h + GAP) + rh.h / 2);
      const kind: Kind = ship.k === 0 ? "fighter" : ship.k === 1 ? "pod" : ship.k === 2 ? "carrier" : "dread";
      const v: ShipView = {
        ship, kind, g: new THREE.Group(), home: new THREE.Vector3(x, y, 0), offset: new THREE.Vector3(), pos: new THREE.Vector3(), size: new THREE.Vector2(cw.w, rh.h),
        gRow: slotsBefore(f.rowParts, sec.rowBand) + ship.row, gCol: slotsBefore(f.colParts, sec.colBand) + ship.col,
        alive: true, pop: 0, enter: -ship.id * stagger, wink: 0, ph: rnd() * 6, base: 1,
      };
      if (kind === "fighter") { v.g.add(lite(f) ? makeFighterLite(M) : makeInvader(M)); v.base = 0.78; }
      else if (kind === "pod") { const p = makeTenSquadPod(M, sec.orient); v.g.add(p.group); v.micro = p.micro; }
      else if (kind === "carrier") { v.carrier = makeCarrier(M, sec.orient); v.g.add(v.carrier.group); }
      else { v.dread = makeDreadnought(M, unitLabel(ship.k), sec.orient); v.g.add(v.dread.group); }
      v.g.scale.setScalar(v.base);
      v.pos.copy(v.home).add(new THREE.Vector3(0, 5, -26));
      v.g.position.copy(v.pos);
      formation.add(v.g);
      views.push(v);
    }
    zeroRing.visible = a === 0 || b === 0;
    // lanes with nothing in them (5 × 0): faint rails, one per squad
    if (a > 0 && b === 0) for (let r = 0; r < Math.min(a, 10); r++) {
      const rail = add(labels, new THREE.BoxGeometry(5, 0.04, 0.04), M.clay(0x3b4470), 0, 4.2 + (Math.min(a, 10) / 2 - r - 0.5) * 0.7, 0, { cast: false });
      rail.userData.rail = true;
    }
    shield.scale.set(W + 1.2, H + 1.2, 1);
    axisLabels();
  }

  /** "3 squads" down the left, "8 each" along the top: rows vs columns are never ambiguous. */
  function axisLabels() {
    for (const c of [...labels.children]) if (!c.userData.rail) labels.remove(c);
    if (!wave) return;
    const [ra, rb] = flipped ? [wave.b, wave.a] : [wave.a, wave.b];
    const [w, h] = flipped ? [fh, fw] : [fw, fh];
    const left = textPlane(`${fmt(ra)} ${ra === 1 ? "squad" : "squads"}`, 0.5), top = textPlane(`${fmt(rb)} each`, 0.5);
    left.position.set(-w / 2 - 0.35 - (left.geometry as THREE.PlaneGeometry).parameters.width / 2, 4.2, 0.4);
    top.position.set(0, 4.2 + h / 2 + 0.55, 0.4);
    labels.add(left, top);
    const brk = M.clay(0xbef264, { emissive: 0xbef264, emissiveIntensity: 0.25 });
    add(labels, new THREE.BoxGeometry(0.05, Math.max(h, 0.6), 0.05), brk, -w / 2 - 0.22, 4.2, 0.3, { cast: false });
    add(labels, new THREE.BoxGeometry(Math.max(w, 0.6), 0.05, 0.05), brk, 0, 4.2 + h / 2 + 0.22, 0.3, { cast: false });
  }

  // ---- power-up visuals: tint plates behind ships, offsets, ghosts, laser slices, band labels ----
  const visuals = new THREE.Group();
  formation.add(visuals);
  let pulses: { v: ShipView; t0: number }[] = [], rowPulse: { rows: number; t0: number } | null = null;
  function clearVisuals() {
    visuals.clear();
    for (const g of ghosts) formation.remove(g);
    ghosts = [];
    for (const v of views) v.offset.set(0, 0, 0);
    pulses = []; rowPulse = null;
  }
  const TONE = { cyan: 0x2fb7d6, amber: 0xf0a13a, gold: 0xf2c14e, coral: 0xff8f70, lime: 0xbef264 } as const;
  /** A translucent plate behind a set of ships (in formation space, offsets included). */
  function plate(sel: ShipView[], tone: keyof typeof TONE, extra: THREE.Vector3[] = []) {
    if (!sel.length && !extra.length) return null;
    const box = new THREE.Box2();
    for (const v of sel) { const c = v.home.clone().add(v.offset); box.expandByPoint(new THREE.Vector2(c.x - v.size.x / 2, c.y - v.size.y / 2)); box.expandByPoint(new THREE.Vector2(c.x + v.size.x / 2, c.y + v.size.y / 2)); }
    for (const p of extra) { box.expandByPoint(new THREE.Vector2(p.x - 0.5, p.y - 0.5)); box.expandByPoint(new THREE.Vector2(p.x + 0.5, p.y + 0.5)); }
    const size = box.getSize(new THREE.Vector2()).addScalar(0.3), c = box.getCenter(new THREE.Vector2());
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), new THREE.MeshBasicMaterial({ color: TONE[tone], transparent: true, opacity: 0.26, depthWrite: false }));
    m.position.set(c.x, c.y, -0.55);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: TONE[tone], transparent: true, opacity: 0.9 }));
    m.add(edge);
    visuals.add(m);
    return m;
  }
  function tag(text: string, at: THREE.Vector3, color = "#fde68a") {
    const t = textPlane(text, 0.55 / scale, color);
    t.position.copy(at).setZ(0.6);
    t.userData.upright = true;
    visuals.add(t);
    return t;
  }
  function laser(x: number | null, y: number | null) {
    const W = fw / scale + 1.4, H = fh / scale + 1.4;
    const m = new THREE.Mesh(x !== null ? new THREE.BoxGeometry(0.07, H, 0.07) : new THREE.BoxGeometry(W, 0.07, 0.07), M.glow(0xffd36b, 1.1));
    m.position.set(x ?? 0, y ?? 0, 0.5);
    m.userData.grow = { t0: stage.time, axis: x !== null ? "y" : "x" };
    visuals.add(m);
  }
  function ghostAt(p: THREE.Vector3) {
    const g = makeGhost();
    g.position.copy(p);
    g.scale.setScalar(0.78);
    g.userData.upright = true;
    formation.add(g);
    ghosts.push(g);
    return p;
  }
  const pitch = CELL + GAP;
  /** Split along columns at `at` (cols ≥ at shift right) or rows (rows ≥ at shift down). */
  function split(axis: "col" | "row", at: number, tones: [keyof typeof TONE, keyof typeof TONE] = ["cyan", "amber"]) {
    const first = views.filter((v) => (axis === "col" ? v.gCol : v.gRow) < at), rest = views.filter((v) => (axis === "col" ? v.gCol : v.gRow) >= at);
    for (const v of rest) v.offset.set(axis === "col" ? 0.7 : 0, axis === "row" ? -0.7 : 0, 0);
    plate(first, tones[0]); plate(rest, tones[1]);
    if (!first.length || !rest.length) return { first, rest };
    const edge = first.reduce((m, v) => (axis === "col" ? Math.max(m, v.home.x + v.size.x / 2) : Math.min(m, v.home.y - v.size.y / 2)), axis === "col" ? -Infinity : Infinity);
    if (axis === "col") laser(edge + 0.35 + GAP / 2, null); else laser(null, edge - 0.35 - GAP / 2);
    return { first, rest };
  }
  // trick tags sit below and to the right of the fleet, clear of the "3 squads" / "8 each" axis labels
  const axisTop = () => -fh / scale / 2 - 0.75, axisLeft = () => fw / scale / 2 + 0.9;
  const meanX = (vs: ShipView[]) => vs.reduce((s, v) => s + v.home.x + v.offset.x, 0) / vs.length;
  const meanY = (vs: ShipView[]) => vs.reduce((s, v) => s + v.home.y + v.offset.y, 0) / vs.length;

  /** Can this trick act on this fleet? (Single-digit sides use the squad grid; multi-digit fleets use bands.) */
  function visualFits(t: TrickId, a: number, b: number) {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    if (!powerUpFits(t, a, b)) return false;
    if (t === "split-and-add") return hi <= 9;
    if (t === "fast-adding") return a <= 9 && a >= 2;
    if (t === "jump-one-more" || t === "double-it") return hi <= 10 || lo <= 9;
    if (t === "borrow-take-back") return a % 10 === 9 || b % 10 === 9;
    return true;
  }

  function applyPowerUp(t: TrickId, { lockMode = true } = {}) {
    if (!wave || !fleet) return;
    const { a, b } = wave, has = (n: number) => a === n || b === n;
    if (t === "flip-it") { flipped = !flipped; flipT = stage.time; axisLabels(); setUi({ wave: { ...ui.wave!, flipped } }); return; }
    clearVisuals();
    // another trick replaces Sector-Lock: its plates are gone, so its chips go too
    if (sectorMode) { sectorMode = false; locked = new Map(); activeSector = null; sectorPlate = null; setUi({ sectors: null, lockTotal: null }); }
    switch (t) {
      case "empty-mirror": {
        if (a === 0 || b === 0) { zeroRing.scale.setScalar(1.3); break; }
        plate(views, "cyan");
        tag("mirror", new THREE.Vector3(0, axisTop(), 0), "#a5f3fc");
        break;
      }
      case "fast-adding": {
        rowPulse = { rows: a, t0: stage.time };
        for (let r = 0; r < a; r++) {
          const row = views.filter((v) => v.gRow === r);
          if (!row.length) continue;
          const xMax = Math.max(...row.map((v) => v.home.x + v.size.x / 2));
          tag(r === a - 1 ? "+ ?" : fmt((r + 1) * b), new THREE.Vector3(xMax + 0.95, row[0].home.y, 0)).visible = false;
        }
        break;
      }
      case "double-it": {
        const k = [2, 4].find((x) => has(x) && ![5, 9, 10].includes(x === a ? b : a)) ?? (has(2) ? 2 : 4);
        if (a === k) split("row", k / 2); else split("col", k / 2);
        break;
      }
      case "split-and-add": {
        const axis = b >= a ? "col" : "row", big = Math.max(a, b);
        const { first, rest } = split(axis, 5);
        if (axis === "col") { tag("5", new THREE.Vector3(meanX(first), axisTop(), 0)); tag(String(big - 5), new THREE.Vector3(meanX(rest), axisTop(), 0)); }
        else { tag("5", new THREE.Vector3(axisLeft(), meanY(first), 0)); tag(String(big - 5), new THREE.Vector3(axisLeft(), meanY(rest), 0)); }
        break;
      }
      case "jump-one-more": {
        if (Math.abs(a - b) === 1 && Math.min(a, b) >= 6) split(a > b ? "row" : "col", Math.min(a, b));
        else { const k = has(3) ? 3 : 6; split(a === k ? "row" : "col", k - 1); }
        break;
      }
      case "borrow-take-back": {
        const extra: THREE.Vector3[] = [];
        if (b % 10 === 9) {
          // one ghost per squad at the end of the 9s, so every squad reads as a round number
          const unitsBand = fleet.colParts.length - 1;
          for (let r = 0; r < (a <= 9 ? a : 0); r++) {
            const row = views.filter((v) => v.gRow === r && fleet!.sectors[v.ship.sector].colBand === unitsBand);
            if (!row.length) continue;
            const last = row.reduce((m, v) => (v.home.x > m.home.x ? v : m));
            extra.push(ghostAt(last.home.clone().add(new THREE.Vector3(pitch, 0, 0))));
          }
          tag(`${fmt(b + 1)} each`, new THREE.Vector3(0, axisTop(), 0), "#a5f3fc");
        } else {
          const unitsBand = fleet.rowParts.length - 1;
          for (let c = 0; c < (b <= 9 ? b : 0); c++) {
            const col = views.filter((v) => v.gCol === c && fleet!.sectors[v.ship.sector].rowBand === unitsBand);
            if (!col.length) continue;
            const last = col.reduce((m, v) => (v.home.y < m.home.y ? v : m));
            extra.push(ghostAt(last.home.clone().add(new THREE.Vector3(0, -pitch, 0))));
          }
          tag(`${fmt(a + 1)} squads`, new THREE.Vector3(axisLeft() + 0.4, 0, 0), "#a5f3fc");
        }
        plate(views, "cyan", extra);
        break;
      }
      case "easy-5-10": {
        if (has(10) || views.some((v) => v.kind === "pod")) {
          const pods = views.filter((v) => v.kind !== "fighter");
          plate(pods, "gold");
          pulses = pods.map((v, i) => ({ v, t0: stage.time + i * 0.12 }));
          break;
        }
        // ×5: project the twin 5 as ghosts, so each squad reads as half of a 10
        const extra: THREE.Vector3[] = [];
        if (b === 5) for (const v of views.filter((x) => x.gCol === 4)) for (let c = 1; c <= 5; c++) extra.push(ghostAt(v.home.clone().add(new THREE.Vector3(c * pitch, 0, 0))));
        else for (const v of views.filter((x) => x.gRow === 4)) for (let r = 1; r <= 5; r++) extra.push(ghostAt(v.home.clone().add(new THREE.Vector3(0, -r * pitch, 0))));
        plate(views, "cyan");
        tag("half of 10", new THREE.Vector3(0, axisTop(), 0), "#a5f3fc");
        break;
      }
      case "big-small-split":
      case "half-double": {
        // slice between the place-value bands: big ships on one side, small on the other
        const bands = fleet.colParts.length, rows = fleet.rowParts.length;
        for (const v of views) { const s = fleet.sectors[v.ship.sector]; v.offset.set(s.colBand * 0.9, -s.rowBand * 0.9, 0); }
        const tones: (keyof typeof TONE)[] = ["cyan", "amber", "coral", "lime", "gold"];
        for (const s of fleet.sectors) plate(views.filter((v) => v.ship.sector === s.i), tones[(s.rowBand + s.colBand) % tones.length]);
        fleet.colParts.forEach((c, i) => { const vs = views.filter((v) => fleet!.sectors[v.ship.sector].colBand === i); if (vs.length && bands > 1) tag(fmt(c), new THREE.Vector3(meanX(vs), axisTop() - 0.2, 0)); });
        fleet.rowParts.forEach((r, i) => { const vs = views.filter((v) => fleet!.sectors[v.ship.sector].rowBand === i); if (vs.length && rows > 1) tag(fmt(r), new THREE.Vector3(axisLeft() + 0.4, meanY(vs), 0)); });
        if (wave.sectorLock && t === "big-small-split" && lockMode) enterSectorLock();
        break;
      }
    }
  }

  // ---- Sector-Lock (SPEC §3): crack each Battle Sector's sub-product; the sum is the plasma lock ----
  function sectorUi() {
    if (!fleet || !sectorMode) return { sectors: null, lockTotal: null };
    const all = fleet.sectors.every((s) => locked.has(s.i));
    return {
      sectors: fleet.sectors.map((s) => ({ i: s.i, label: `${fmt(s.rowPart)} × ${fmt(s.colPart)}`, value: locked.get(s.i) ?? null, active: activeSector === s.i })),
      lockTotal: all ? [...locked.values()].reduce((x, y) => x + y, 0) : null,
    };
  }
  function enterSectorLock() {
    sectorMode = true;
    locked = new Map();
    activeSector = fleet?.sectors[0]?.i ?? null;
    highlightSector();
    setUi({ ...sectorUi(), radar: null });
  }
  let sectorPlate: THREE.Object3D | null = null;
  function highlightSector() {
    if (sectorPlate) visuals.remove(sectorPlate);
    sectorPlate = activeSector === null ? null : plate(views.filter((v) => v.ship.sector === activeSector), "lime");
    if (sectorPlate) ((sectorPlate as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.42;
  }
  function selectSector(i: number) {
    if (!sectorMode || locked.has(i)) return;
    activeSector = i;
    highlightSector();
    setUi(sectorUi());
  }
  function lockSector(value: number) {
    if (!fleet || activeSector === null) return false;
    const s = fleet.sectors[activeSector];
    if (value !== s.value) { void say("nova_sector_no"); audio.sfx("blip_close"); return false; }
    audio.sfx("blip_ok");
    locked.set(s.i, value);
    const vs = views.filter((v) => v.ship.sector === s.i);
    plate(vs, "gold");
    tag(fmt(value), new THREE.Vector3(meanX(vs), meanY(vs), 0), "#fde68a");
    const next = fleet.sectors.find((x) => !locked.has(x.i));
    activeSector = next?.i ?? null;
    highlightSector();
    void say(next ? "nova_sector_ok" : "nova_all_locked");
    setUi(sectorUi());
    return true;
  }

  // ---- the director: which wave comes next ----
  const state = () => fold(log);
  function beltFor(s: PlayerState, w: Wave | null): ArenaUi["belt"] {
    if (!w) return [];
    const unlocked = TRICKS.filter((t) => opts.dev || (s.seenTricks[t] ?? 0) > 0);
    return unlocked.map((id) => ({ id, card: id === "big-small-split" && w.sectorLock ? "Sector-Lock" : CARD[id], fits: visualFits(id, w.a, w.b), active: active === id || (id === "flip-it" && flipped) }));
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
        zeroRing.visible = false;
        wave = null;
        setUi({ offer: { to, name: PLANET_NAMES[to] }, wave: null, canFire: false });
        void say(jumpLine(to), { speaker: "Captain", queue: true });
        return;
      }
      const hk = housekeeping(s);
      if (hk.length) { hk.forEach(emit); return finish("clear"); }
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
    attempts = 0; usedRadar = false; active = null; flipped = false; flipT = 0; pendingLesson = null; sectorMode = false; locked = new Map(); activeSector = null; wild = [];
    formation.rotation.z = 0;
    build(w.a, w.b);
    const index = mode === "campaign" ? s.mission.waves : practiceK;
    setUi({
      wave: { a: w.a, b: w.b, role: w.role, index, of: tier === 0 && mode === "campaign" ? 3 : PRACTICE_WAVES, flipped: false, sectorLock: w.sectorLock },
      canFire: false, outcome: null, radar: null, invite: false, belt: beltFor(s, w), sectors: null, lockTotal: null, lesson: null, offer: null,
    });
    audio.sfx("flyby");
    if (s.waves === 0 && mode === "campaign" && opts.lines?.intro) await say(opts.lines.intro, { queue: true });
    else if (index === 0) void say("nova_incoming_short");
    await after(0.75); // the fleet flies in
    ready();
  }

  /** End of a shot: record fire → ready (the 5–10 s rule). */
  function markShot() { if (shotStart) { setUi({ shots: [...ui.shots, Math.round(performance.now() - shotStart)] }); shotStart = 0; } }
  function ready() {
    markShot();
    shownAt = lastActivity = performance.now();
    setUi({ canFire: true });
  }

  async function finish(kind: "clear" | "practice") {
    const s = state();
    if (planet === "earth" && !s.introCompleted) emit({ type: "intro_completed", payload: {} });
    clearFleet();
    zeroRing.visible = false;
    wave = null;
    if (kind === "clear") {
      emit({ type: "orb_earned", payload: { amount: 20, reason: "planet_cleared" } });
      const next = PLANETS_BY_TIER[Math.min(tier + 1, PLANETS_BY_TIER.length - 1)];
      setUi({ wave: null, canFire: false, outcome: null, radar: null, done: { title: `${PLANET_NAMES[planet].toUpperCase()} CLEAR`, sub: tier === 7 ? "A bigger sector opens" : `${PLANET_NAMES[next]} is open`, next: tier === 7 ? planet : next } });
      audio.sfx("clear");
      await say(opts.lines?.clear ?? "nova_planet_clear", { queue: true });
    } else {
      const frontier = PLANETS_BY_TIER[s.tier];
      setUi({ wave: null, canFire: false, outcome: null, radar: null, done: { title: "PRACTICE COMPLETE", sub: `${PLANET_NAMES[planet]} · ${PRACTICE_WAVES} waves`, next: frontier } });
      audio.sfx("clear");
      await say("nova_practice_done", { queue: true });
    }
  }

  // ---- firing ----
  type FireOpts = { radar?: boolean };
  async function fire(n: number, o: FireOpts = {}) {
    if (!wave || !fleet || !ui.canFire) return;
    const w = wave, f = fleet, p = w.a * w.b, latency = Math.round(performance.now() - shownAt);
    shotStart = performance.now();
    setUi({ canFire: false, outcome: null, radar: o.radar ? null : ui.radar });
    attempts++;
    usedRadar ||= !!o.radar;
    if (pendingLesson) {
      for (const t of pendingLesson.tricks) emit({ type: "explanation_completed", payload: { trickId: t, a: w.a, b: w.b, mode: pendingLesson.mode, wedoCorrect: n === p } });
      pendingLesson = null;
      setUi({ lesson: null });
    }
    const errorType = classifyError(w.a, w.b, n);
    emit({ type: "attempt_submitted", payload: { a: w.a, b: w.b, planetId: planet, guess: n, latencyMs: latency, errorType, attemptIndex: attempts, usedRadar, powerUpUsed: active, isTransferCheck: w.isTransferCheck, waveRole: mode === "practice" ? "practice" : w.role } });

    // the volley: every ball pops exactly its ship's worth; the whole thing takes at most ~1.5 s
    const plan = volley(f, n), extras = Math.min(plan.extra, 14), count = plan.hits.length + extras;
    const gap = count > 1 ? Math.min(0.13, 1.15 / (count - 1)) : 0, flight = 0.42;
    let sfxAt = -1;
    plan.hits.forEach((h, i) => {
      const v = views[h.ship];
      timers.push({ at: stage.time + i * gap, fn: () => {
        if (stage.time - sfxAt > 0.06) { audio.sfx("shot"); sfxAt = stage.time; }
        launch(v.g.getWorldPosition(new THREE.Vector3()), v.kind, () => land(v, h.amount, h.full));
      } });
    });
    for (let i = 0; i < extras; i++) timers.push({ at: stage.time + (plan.hits.length + i) * gap, fn: () => {
      const target = formation.localToWorld(new THREE.Vector3((rnd() - 0.5) * 8, (rnd() - 0.2) * 5, -40));
      launch(target, "fighter", undefined, 0xff9a3c, 0.9);
    } });
    if (extras) timers.push({ at: stage.time + plan.hits.length * gap, fn: () => audio.sfx("flyby") });
    await after(count ? (count - 1) * gap + flight + 0.2 : 0.35);

    if (n === p) {
      audio.sfx("clear");
      const orbs = attempts === 1 ? 5 : 3;
      emit({ type: "orb_earned", payload: { amount: orbs, reason: "wave_clear" } });
      setUi({ outcome: { kind: "exact", value: p, orbs }, radar: null, invite: false, sectors: null, lockTotal: null });
      void say(EXACT_LINES[(state().waves + attempts) % EXACT_LINES.length]);
      await after(0.9);
      if (mode === "practice") practiceK++;
      return startWave();
    }

    // a miss: the outcome is visible in the world, then shields shimmer back on for another try
    const over = n > p;
    setUi({ outcome: { kind: over ? "over" : "under", value: over ? plan.extra : plan.remaining } });
    for (const v of views) if (v.alive) v.wink = stage.time;
    if (errorType === "wild_guess") wild = [...wild.filter((t) => performance.now() - t < 12_000), performance.now()];
    const misses = attempts, sc = scaffold(misses, w.a, w.b, n);
    const mash = errorType === "wild_guess" && wild.length >= 3 && latency < 4000;
    if (mash) wild = [];
    // predictive pre-fetch (SPEC §6): a miss makes Show Me How likely, so voice its beats now
    if (misses === 1) try { lesson(w.a, w.b, state().seenTricks).beats.forEach((b) => void live(b.say)); } catch { /* no lesson for this fleet */ }
    if (sc.showMeHow && !pendingLesson) {
      // third miss: no reaction line (Nova's lesson is the reaction), shields up, straight into Show Me How
      await after(0.7);
      restore();
      return void showMeHow(true);
    }
    const radar = sc.radar ? radarChoices(w.a, w.b, seeded(mix(seed, w.a, w.b, attempts))) : null;
    setUi({ radar: radar ?? ui.radar, invite: sc.invite });
    // the calming line matters more than a reaction, so it waits its turn instead of being dropped
    void say(mash ? "nova_hold_fire" : sc.invite ? "nova_invite" : errorType ? ERROR_LINE[errorType] : over ? "nova_err_over" : "nova_err_under", { queue: mash });
    await after(1.05);
    restore();
    await after(0.4);
    ready();
  }

  /** Shields back up: every ship returns, so the next shot is at the whole fleet again. */
  function restore() {
    audio.sfx("shield");
    shield.userData.t0 = stage.time;
    for (const v of views) {
      v.alive = true; v.pop = 0; v.wink = 0;
      v.g.visible = true;
      v.micro?.forEach((m) => (m.visible = true));
      v.carrier?.popped(0);
      v.dread?.damaged(0);
    }
  }

  // plasma balls and pops
  const balls: Ball[] = [], ballGeo = new THREE.SphereGeometry(0.14, 14, 10), ballMat = M.glow(blaster.color, 1.45), overMat = M.glow(0xff9a3c, 1.3); // just over the bloom threshold: a little glow, never a halo
  const BALL_SIZE: Record<Kind, number> = { fighter: 1, pod: 1.25, carrier: 1.5, dread: 1.8 };
  function launch(to: THREE.Vector3, kind: Kind, onLand?: () => void, color?: number, sizeK = 1) {
    const from = rocket.muzzle();
    for (const side of blaster.twin ? [-0.12, 0.12] : [0]) {
      const m = new THREE.Mesh(ballGeo, color ? overMat : ballMat);
      m.scale.set(1, 1, blaster.stretch).multiplyScalar(BALL_SIZE[kind] * blaster.size * sizeK);
      const f = from.clone().add(new THREE.Vector3(side, 0, 0));
      m.position.copy(f);
      scene.add(m);
      balls.push({ m, from: f, to: to.clone(), t0: stage.time, dur: color ? 0.9 : 0.42, land: side <= 0 ? onLand : undefined });
    }
  }
  const sparks: { m: THREE.Mesh; v: THREE.Vector3; t0: number }[] = [], sparkGeo = new THREE.IcosahedronGeometry(0.07, 0), sparkMat = M.additive(1.2, 2.0, 1.0, 0.9);
  let burstAt = -1;
  function land(v: ShipView, amount: number, full: boolean) {
    if (full) { v.alive = false; v.pop = stage.time; }
    else if (v.micro) v.micro.forEach((m, i) => { m.visible = i >= amount; });
    else if (v.carrier) v.carrier.popped(amount);
    else if (v.dread) v.dread.damaged(amount / v.ship.value);
    if (stage.time - burstAt > 0.05) { audio.sfx("burst"); burstAt = stage.time; }
    if (sparks.length < 160) {
      const at = v.g.getWorldPosition(new THREE.Vector3());
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(sparkGeo, sparkMat);
        m.position.copy(at);
        scene.add(m);
        sparks.push({ m, v: new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() - 0.2).normalize().multiplyScalar(2 + rnd() * 2.5), t0: stage.time });
      }
    }
  }

  // ---- Radar, Power-Ups, Show Me How ----
  function powerUp(t: TrickId) {
    if (!wave || !ui.canFire) return;
    const fits = visualFits(t, wave.a, wave.b);
    emit({ type: "powerup_used", payload: { trickId: t, a: wave.a, b: wave.b, valid: fits } });
    lastActivity = performance.now();
    if (!fits) { void say("nova_misfit"); return; }
    if (t !== "flip-it") active = t;
    applyPowerUp(t);
    void say(t === "big-small-split" && wave.sectorLock ? "pu_sector" : t === "easy-5-10" && !(wave.a === 10 || wave.b === 10 || views.some((v) => v.kind !== "fighter")) ? "pu_easy5" : POWERUP_LINE[t]);
    setUi({ belt: beltFor(state(), wave) });
  }

  /** I Do (Phase 2 form): Nova walks the trick's beats over this live fleet, then hands back the winning shot. */
  async function showMeHow(auto = false) {
    if (!wave || pendingLesson || ui.lesson || (!auto && !ui.canFire)) return;
    const w = wave, s = state(), l = lesson(w.a, w.b, s.seenTricks);
    setUi({ canFire: false, radar: null, invite: false, lesson: { card: l.card, prompt: null } });
    if (sectorMode) { sectorMode = false; setUi({ sectors: null, lockTotal: null }); }
    emit({ type: "explanation_started", payload: { trickId: l.trick, a: w.a, b: w.b, mode: l.mode } });
    // Fast Replay (SPEC §4.4: ≤ 8 s): the visual split + ONE reminder line + the We-Do. On a flipped
    // fact the fleet turns while Nova gives the trick's reminder, instead of a second spoken line.
    // (Only when Flip It is itself a repeat: a first Flip It keeps its own three beats.)
    const silentFlip = l.mode === "fast" && l.beats[0]?.show.kind === "rotate" && l.beats.length > 2;
    const beats = silentFlip ? l.beats.slice(1) : l.beats;
    if (silentFlip && !flipped) applyPowerUp("flip-it");
    beats.forEach((b) => void live(b.say)); // prepare every beat while the first one plays
    let shown = false;
    for (const beat of beats) {
      if (wave !== w) return;
      const k = beat.show.kind;
      if (k === "rotate" && !flipped) applyPowerUp("flip-it");
      else if (!shown && k !== "fleet" && k !== "wedo" && k !== "rotate") {
        shown = true;
        if (visualFits(l.trick, w.a, w.b)) applyPowerUp(l.trick, { lockMode: false });
      }
      if (k === "wedo") {
        pendingLesson = l;
        setUi({ lesson: { card: l.card, prompt: beat.say } });
        void speak(beat.say);
        break;
      }
      await speak(beat.say);
    }
    ready();
  }

  // ---- the frame ----
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let safe = { top: 150, right: 0, bottom: 0, left: 0 }, camInit = false;
  const stop = stage.onUpdate((dt, T) => {
    for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= stage.time) { const t = timers[i]; timers.splice(i, 1); t.fn(); }
    // Flip It!: the formation turns a quarter; ships stay upright, labels re-read the new axes
    const fk = flipT ? Math.min(1, (stage.time - flipT) / 0.8) : 1;
    formation.rotation.z = (flipped ? ease(fk) : 1 - ease(fk)) * (flipT ? Math.PI / 2 : 0);
    for (const v of views) {
      const target = v.home.clone().add(v.offset);
      v.enter += dt;
      if (v.enter < 0) continue;
      const k = Math.min(1, v.enter / 0.55);
      if (k < 1) v.pos.lerpVectors(v.home.clone().add(new THREE.Vector3(0, 5, -26)), target, ease(k));
      else v.pos.lerp(target, Math.min(1, dt * 8));
      v.g.position.copy(v.pos).setY(v.pos.y + Math.sin(T * 2 + v.ph) * (v.kind === "fighter" ? 0.05 : 0.015));
      // fighters, carriers and dreadnoughts stay upright when the fleet turns; a pod turns with it (its 10 now runs the other way)
      v.g.rotation.z = v.kind === "pod" ? 0 : -formation.rotation.z + (v.kind === "fighter" ? Math.sin(T * 1.7 + v.ph) * 0.06 : 0);
      if (v.kind === "fighter") v.g.rotation.y = Math.sin(T * 1.3 + v.ph) * 0.35;
      let sc = v.base;
      if (!v.alive) { const p = Math.max(0, 1 - (stage.time - v.pop) * 6); sc *= p; v.g.visible = p > 0; }
      else if (v.wink) sc *= 1 + Math.max(0, Math.sin((stage.time - v.wink) * 14)) * 0.14;
      for (const pl of pulses) if (pl.v === v && stage.time > pl.t0) sc *= 1 + Math.max(0, Math.sin((stage.time - pl.t0) * 5)) * 0.1;
      v.g.scale.setScalar(sc);
    }
    if (rowPulse) {
      // Fast Adding: squads light up one at a time with a running total (the last one stays a question)
      const lit = Math.min(rowPulse.rows, Math.floor((stage.time - rowPulse.t0) / 0.45) + 1);
      let i = 0;
      for (const c of visuals.children) if (c.userData.upright) { c.visible = i < lit; i++; }
      for (const v of views) if (v.gRow < lit && v.alive) v.g.scale.multiplyScalar(1.06);
    }
    for (const c of [...visuals.children, ...ghosts]) {
      if (c.userData.upright) c.rotation.z = -formation.rotation.z;
      const grow = c.userData.grow as { t0: number; axis: "x" | "y" } | undefined;
      if (grow) { const k = Math.max(0.01, Math.min(1, (stage.time - grow.t0) / 0.35)); c.scale.set(grow.axis === "x" ? k : 1, grow.axis === "y" ? k : 1, 1); }
    }
    for (const g of ghosts) g.position.y += Math.sin(T * 2.4) * 0.002;
    const sh = shield.userData.t0 as number | undefined;
    (shield.material as THREE.MeshBasicMaterial).opacity = sh === undefined ? 0 : Math.max(0, 0.28 * (1 - (stage.time - sh) / 0.5));
    zeroRing.rotation.z += dt * 0.6;
    zeroRing.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 1.5);

    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i], k = (stage.time - b.t0) / b.dur;
      if (k >= 1) { scene.remove(b.m); b.land?.(); balls.splice(i, 1); continue; }
      b.m.position.lerpVectors(b.from, b.to, k);
      b.m.position.y += Math.sin(Math.PI * k) * 0.6;
      b.m.lookAt(b.to);
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i], a = (stage.time - s.t0) / 0.5;
      if (a >= 1) { scene.remove(s.m); sparks.splice(i, 1); continue; }
      s.m.position.addScaledVector(s.v, dt);
      s.m.scale.setScalar(1 - a);
    }

    // the rocket sits under the fleet; the camera frames fleet + rocket inside the HUD's free area
    // frame what is actually there: ships with their trick offsets, plus any ghosts
    let ex = fw / scale / 2, ey = fh / scale / 2;
    for (const v of views) { ex = Math.max(ex, Math.abs(v.home.x + v.offset.x) + v.size.x / 2); ey = Math.max(ey, Math.abs(v.home.y + v.offset.y) + v.size.y / 2); }
    for (const g of ghosts) { ex = Math.max(ex, Math.abs(g.position.x) + 0.5); ey = Math.max(ey, Math.abs(g.position.y) + 0.5); }
    const h = (flipped ? ex : ey) * 2 * scale, w = (flipped ? ey : ex) * 2 * scale;
    const bottom = 4.2 - h / 2;
    rocket.group.position.set(Math.sin(T * 0.9) * 0.12, bottom - 2.1 + Math.sin(T * 1.6) * 0.06, 1.8);
    rocket.group.rotation.z = Math.sin(T * 0.9) * 0.05;
    rocket.flicker(T, 1);
    const ymin = bottom - 2.9, ymax = 4.2 + h / 2 + 1.0, xmin = -w / 2 - 2.4, xmax = w / 2 + 0.5;
    const W = stage.renderer.domElement.clientWidth || 1, H = stage.renderer.domElement.clientHeight || 1;
    const fwPx = Math.max(120, W - safe.left - safe.right), fhPx = Math.max(120, H - safe.top - safe.bottom), tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max(((ymax - ymin) * H) / (2 * tan * fhPx * 0.94), ((xmax - xmin) * H) / (2 * tan * fwPx * 0.94), 7);
    const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
    const targetPos = new THREE.Vector3(origin.x + cx, origin.y + cy, origin.z + d), targetLook = new THREE.Vector3(origin.x + cx, origin.y + cy, origin.z);
    if (!camInit) { camPos.copy(targetPos); camLook.copy(targetLook); camInit = true; }
    camPos.lerp(targetPos, Math.min(1, dt * 3)); camLook.lerp(targetLook, Math.min(1, dt * 3));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    camera.setViewOffset(W, H, W / 2 - (safe.left + fwPx / 2), H / 2 - (safe.top + fhPx / 2), W, H);
    sky?.update(dt);

    // idle for 10 s with nothing typed: the Radar slides in quietly
    if (ui.canFire && wave && !ui.radar && !ui.lesson && !sectorMode && performance.now() - lastActivity > 10_000) {
      setUi({ radar: radarChoices(wave.a, wave.b, seeded(mix(seed, wave.a, wave.b, 99))) });
    }
  });

  // the battle look: clean and readable, no halos on ships or drones
  camera.far = 3000;
  camera.updateProjectionMatrix();
  scene.background = new THREE.Color(0x030612);
  scene.fog = null;
  Object.assign(stage.bloom, { strength: 0.12, radius: 0.2, threshold: 1.4 });
  stage.renderer.toneMappingExposure = 1.0;
  stage.grade.sat.value = 1;
  stage.grade.tint.value.set(1, 1, 1);
  setUi({});

  return {
    /** Begin (from a click or key press, so sound can start). */
    start() {
      if (started) return;
      started = true;
      audio.unlock();
      void warmVoice(); // live speech for Show Me How warms in the background
      audio.mood("battle");
      setUi({ started: true });
      void startWave();
    },
    fire: (n: number) => fire(n),
    radar: (n: number) => fire(n, { radar: true }),
    powerUp,
    showMeHow: () => void showMeHow(),
    selectSector,
    lockSector,
    /** The cadet is typing: the idle Radar waits. */
    poke: () => { lastActivity = performance.now(); },
    acceptJump() {
      const jump = acceptHyperJump(state());
      if (!jump) return null;
      emit(jump);
      setUi({ offer: null });
      return jump.payload.toPlanet as PlanetId;
    },
    declineJump() { declinedAt = state().waves; setUi({ offer: null }); void startWave(); },
    /** The HUD's footprint in px, so the fleet is framed in the free part of the screen. */
    setSafe(s: Partial<typeof safe>) { safe = { ...safe, ...s }; },
    captionAt: (px: number) => overlay.captionAt(px),
    get ui() { return ui; },
    log: () => log,
    dispose() {
      disposed = true;
      stop();
      clearFleet();
      overlay.dispose();
      audio.stopVoice();
      camera.clearViewOffset();
      scene.remove(root, key, key.target, rim, fill);
      sky?.dispose();
      for (const b of balls) scene.remove(b.m);
      for (const s of sparks) scene.remove(s.m);
    },
  };
}
export type Arena = ReturnType<typeof mountArena>;
