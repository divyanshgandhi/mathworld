import * as THREE from "three";
import { add, PALETTE } from "@/engine/materials";
import type { Stage } from "@/engine/stage";
import { ease, type Rng } from "@/engine/util";
import { fleetOf, unitLabel, type Fleet, type Ship } from "@/rig/fleet";
import { makeCarrier, makeDreadnought, makeFighterLite, makeInvader, makeTenSquadPod, squadStyle } from "@/worlds/space/ships";
import { LOOK } from "../look";
import { holoLabel, holoWidth } from "./holo";

/**
 * Fleet view: the formation of ships for one wave, laid out rows × columns true to the numbers
 * (SPEC §3), and everything that moves with it: the fly-in, a kill, the regroup shimmer, the "N squads"
 * / "N each" axis labels, the Flip It! quarter turn, and the group that Power-Up and lesson marks live in.
 */
export type Kind = "fighter" | "pod" | "carrier" | "dread";
export interface ShipView {
  ship: Ship; kind: Kind; g: THREE.Group; home: THREE.Vector3; offset: THREE.Vector3; pos: THREE.Vector3;
  gRow: number; gCol: number; size: THREE.Vector2;
  alive: boolean; pop: number; enter: number; wink: number; ph: number;
  micro?: THREE.Group[]; podTag?: THREE.Object3D; carrier?: ReturnType<typeof makeCarrier>; dread?: ReturnType<typeof makeDreadnought>; base: number;
}

export const CELL = 1.0, BIG = 2.4, GAP = 0.16, GUTTER = 0.75, PITCH = CELL + GAP;
/** The fleet's centre height above the battle origin. */
export const FLEET_Y = 4.2;
export const fmt = (n: number) => n.toLocaleString("en-US");
/** How an axis label shows: fully, softly (an unprompted first-sight hint), or not yet. */
export type AxisShow = "on" | "soft" | "off";

export function createFleetView(stage: Stage, root: THREE.Group, rnd: Rng) {
  const M = stage.mats;
  // the fleet lives in `formation` (it can turn for Flip It!); labels stay upright outside it
  const formation = new THREE.Group(), labels = new THREE.Group();
  formation.position.set(0, FLEET_Y, 0);
  root.add(formation, labels);
  const zeroRing = add(formation, new THREE.TorusGeometry(1.4, 0.05, 12, 96), M.glow(PALETTE.cyan, LOOK.zeroRing.intensity), 0, 0, 0, { cast: false });
  zeroRing.visible = false;
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: LOOK.shield.color, transparent: true, opacity: 0, depthWrite: false }));
  shield.position.z = 0.8;
  formation.add(shield);
  /** Power-Up and lesson marks: plates, tags, badges, lasers. */
  const visuals = new THREE.Group();

  const fv = {
    formation, labels, visuals, zeroRing, shield,
    views: [] as ShipView[], ghosts: [] as THREE.Object3D[], fleet: null as Fleet | null,
    /** Formation scale and on-screen size of the fleet (world units). */
    scale: 1, fw: 8, fh: 5,
    flipped: false, flipT: 0,
    pulses: [] as { v: ShipView; t0: number }[], rowPulse: null as { rows: number; t0: number } | null, labelPulse: -1,
    axis: { squads: "on" as AxisShow, each: "on" as AxisShow },
    /** Mount the marks group (after the shield, so draw order stays what it was). */
    mountMarks() { formation.add(visuals); },

    /** Marks off: plates, ghosts, offsets and pulses go; the fleet keeps its turn. */
    clearMarks() {
      visuals.clear();
      for (const g of fv.ghosts) formation.remove(g);
      fv.ghosts = [];
      for (const v of fv.views) v.offset.set(0, 0, 0);
      fv.pulses = []; fv.rowPulse = null;
    },
    clear() {
      for (const v of fv.views) { v.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); formation.remove(v.g); }
      fv.views = [];
      fv.clearMarks();
      labels.clear();
    },

    /** The fleet for a × b, flying in from deep space. */
    build(a: number, b: number) {
      fv.clear();
      const f = fleetOf(a, b);
      fv.fleet = f;
      const lite = f.ships.length > 140;
      const colW = f.colParts.map((c) => { const k = String(c).length - 1, d = c / 10 ** k, w = k === 0 ? CELL : BIG; return { d, w, span: d * w + (d - 1) * GAP }; });
      const rowH = f.rowParts.map((r) => { const k = String(r).length - 1, d = r / 10 ** k, h = k === 0 ? CELL : BIG; return { d, h, span: d * h + (d - 1) * GAP }; });
      const colX: number[] = [], rowY: number[] = [];
      colW.reduce((x, c, i) => { colX[i] = x; return x + c.span + GUTTER; }, 0);
      rowH.reduce((y, r, i) => { rowY[i] = y; return y + r.span + GUTTER; }, 0);
      const W = colW.length ? colX[colX.length - 1] + colW[colW.length - 1].span : 0, H = rowH.length ? rowY[rowY.length - 1] + rowH[rowH.length - 1].span : 0;
      fv.scale = Math.min(1.55, 11 / Math.max(W, 1), 6.6 / Math.max(H, 1));
      fv.fw = Math.max(W * fv.scale, 3); fv.fh = Math.max(H * fv.scale, 2);
      // an empty fleet still has a size: the zero ring (and its empty lanes), so the axis labels sit outside it
      if (a === 0 || b === 0) { const ring = 2 * 1.4 * fv.scale + 0.5; fv.fw = Math.max(fv.fw, ring, a > 0 ? 5.4 : 0); fv.fh = Math.max(fv.fh, ring, Math.min(a, 10) * 0.7 + 0.4); }
      formation.scale.setScalar(fv.scale);
      const slotsBefore = (parts: number[], i: number) => parts.slice(0, i).reduce((s, p) => s + p / 10 ** (String(p).length - 1), 0);
      const stagger = Math.min(0.025, 0.5 / Math.max(1, f.ships.length));
      // squad tones alternate by squad (row) and the first ship of a squad is its leader; a squad of one ship has no leader
      const gRowOf = (ship: (typeof f.ships)[number]) => slotsBefore(f.rowParts, f.sectors[ship.sector].rowBand) + ship.row;
      const perSquad = new Map<number, number>();
      for (const ship of f.ships) perSquad.set(gRowOf(ship), (perSquad.get(gRowOf(ship)) ?? 0) + 1);
      for (const ship of f.ships) {
        const sec = f.sectors[ship.sector], cw = colW[sec.colBand], rh = rowH[sec.rowBand];
        const x = colX[sec.colBand] + ship.col * (cw.w + GAP) + cw.w / 2 - W / 2, y = H / 2 - (rowY[sec.rowBand] + ship.row * (rh.h + GAP) + rh.h / 2);
        const kind: Kind = ship.k === 0 ? "fighter" : ship.k === 1 ? "pod" : ship.k === 2 ? "carrier" : "dread";
        const v: ShipView = {
          ship, kind, g: new THREE.Group(), home: new THREE.Vector3(x, y, 0), offset: new THREE.Vector3(), pos: new THREE.Vector3(), size: new THREE.Vector2(cw.w, rh.h),
          gRow: slotsBefore(f.rowParts, sec.rowBand) + ship.row, gCol: slotsBefore(f.colParts, sec.colBand) + ship.col,
          alive: true, pop: 0, enter: -ship.id * stagger, wink: 0, ph: rnd() * 6, base: 1,
        };
        const style = squadStyle(v.gRow, v.gCol);
        if ((perSquad.get(v.gRow) ?? 0) < 2) style.leader = false;
        if (kind === "fighter") { v.g.add(lite ? makeFighterLite(M, style) : makeInvader(M, style)); v.base = 0.78; }
        else if (kind === "pod") { const p = makeTenSquadPod(M, sec.orient, style); v.g.add(p.group); v.micro = p.micro; v.podTag = p.tag; }
        else if (kind === "carrier") { v.carrier = makeCarrier(M, sec.orient, style); v.g.add(v.carrier.group); }
        else { v.dread = makeDreadnought(M, unitLabel(ship.k), sec.orient, style); v.g.add(v.dread.group); }
        v.g.scale.setScalar(v.base);
        v.pos.copy(v.home).add(new THREE.Vector3(0, 5, -26));
        v.g.position.copy(v.pos);
        formation.add(v.g);
        fv.views.push(v);
      }
      zeroRing.visible = a === 0 || b === 0;
      // lanes with nothing in them (5 × 0): faint rails, one per squad
      if (a > 0 && b === 0) for (let r = 0; r < Math.min(a, 10); r++) {
        const rail = add(labels, new THREE.BoxGeometry(5, 0.04, 0.04), M.clay(LOOK.rail), 0, FLEET_Y + (Math.min(a, 10) / 2 - r - 0.5) * 0.7, 0, { cast: false });
        rail.userData.rail = true;
      }
      shield.scale.set(W + 1.2, H + 1.2, 1);
    },

    /**
     * "3 squads" down the left, "8 each" along the top: rows vs columns are never ambiguous.
     * `squads` × `each` are the numbers as the cadet sees them (swapped while the fleet is turned).
     */
    axisLabels(squads: number, each: number) {
      for (const c of [...labels.children]) if (!c.userData.rail) labels.remove(c);
      const [w, h] = fv.flipped ? [fv.fh, fv.fw] : [fv.fw, fv.fh];
      const left = holoLabel(`${fmt(squads)} ${squads === 1 ? "squad" : "squads"}`, "axis"), top = holoLabel(`${fmt(each)} each`, "axis");
      left.position.set(-w / 2 - 0.35 - holoWidth(left) / 2, FLEET_Y, 0.4);
      top.position.set(0, FLEET_Y + h / 2 + 0.55, 0.4);
      left.userData.axis = "squads"; top.userData.axis = "each";
      labels.add(left, top);
      const brk = M.clay(LOOK.bracket.color, { emissive: LOOK.bracket.color, emissiveIntensity: LOOK.bracket.emissive });
      add(labels, new THREE.BoxGeometry(0.05, Math.max(h, 0.6), 0.05), brk, -w / 2 - 0.22, FLEET_Y, 0.3, { cast: false }).userData.axis = "squads";
      add(labels, new THREE.BoxGeometry(Math.max(w, 0.6), 0.05, 0.05), brk, 0, FLEET_Y + h / 2 + 0.22, 0.3, { cast: false }).userData.axis = "each";
      fv.showAxis(fv.axis.squads, fv.axis.each);
    },
    /** Show, soften or hide each axis label with its bracket (structure "discover"). */
    showAxis(squads: AxisShow, each: AxisShow) {
      fv.axis = { squads, each };
      for (const c of labels.children) {
        const which = c.userData.axis as "squads" | "each" | undefined;
        if (!which) continue;
        const s = which === "squads" ? squads : each;
        c.visible = s !== "off";
        const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (m && "map" in m && m.map) { m.opacity = s === "soft" ? LOOK.soft.opacity : 1; }
      }
    },

    /** A ball lands: a full hit destroys the ship, a partial one pops part of a pod or a big ship. */
    land(v: ShipView, amount: number, full: boolean) {
      if (full) { v.alive = false; v.pop = stage.time; }
      else if (v.micro) v.micro.forEach((m, i) => { m.visible = i >= amount; });
      else if (v.carrier) v.carrier.popped(amount);
      else if (v.dread) v.dread.damaged(amount / v.ship.value);
    },
    /** A miss: the survivors wink. */
    wink() { for (const v of fv.views) if (v.alive) v.wink = stage.time; },
    /** Shields back up: every ship returns, so the next shot is at the whole fleet again. */
    regroup() {
      shield.userData.t0 = stage.time;
      for (const v of fv.views) {
        v.alive = true; v.pop = 0; v.wink = 0;
        v.g.visible = true;
        v.micro?.forEach((m) => (m.visible = true));
        v.carrier?.popped(0);
        v.dread?.damaged(0);
      }
    },

    update(dt: number, T: number) {
      const now = stage.time;
      // Flip It!: the formation turns a quarter; ships stay upright, labels re-read the new axes
      const fk = fv.flipT ? Math.min(1, (now - fv.flipT) / 0.8) : 1;
      formation.rotation.z = (fv.flipped ? ease(fk) : 1 - ease(fk)) * (fv.flipT ? Math.PI / 2 : 0);
      for (const v of fv.views) {
        const target = v.home.clone().add(v.offset);
        v.enter += dt;
        if (v.enter < 0) continue;
        const k = Math.min(1, v.enter / 0.55);
        if (k < 1) v.pos.lerpVectors(v.home.clone().add(new THREE.Vector3(0, 5, -26)), target, ease(k));
        else v.pos.lerp(target, Math.min(1, dt * 8));
        v.g.position.copy(v.pos).setY(v.pos.y + Math.sin(T * 2 + v.ph) * (v.kind === "fighter" ? 0.05 : 0.015));
        // fighters, carriers and dreadnoughts stay upright when the fleet turns; a pod turns with it (its 10 now runs the other way)
        v.g.rotation.z = v.kind === "pod" ? 0 : -formation.rotation.z + (v.kind === "fighter" ? Math.sin(T * 1.7 + v.ph) * 0.06 : 0);
        if (v.podTag) v.podTag.rotation.z = -formation.rotation.z; // its "10" badge still reads upright
        if (v.kind === "fighter") v.g.rotation.y = Math.sin(T * 1.3 + v.ph) * 0.35;
        let sc = v.base;
        if (!v.alive) { const p = Math.max(0, 1 - (now - v.pop) * 6); sc *= p; v.g.visible = p > 0; }
        else if (v.wink) sc *= 1 + Math.max(0, Math.sin((now - v.wink) * 14)) * 0.14;
        for (const pl of fv.pulses) if (pl.v === v && now > pl.t0) sc *= 1 + Math.max(0, Math.sin((now - pl.t0) * 5)) * 0.1;
        v.g.scale.setScalar(sc);
      }
      if (fv.rowPulse) {
        // Fast Adding: squads light up one at a time with a running total (the last one stays a question)
        const lit = Math.min(fv.rowPulse.rows, Math.floor((now - fv.rowPulse.t0) / 0.45) + 1);
        let i = 0;
        for (const c of visuals.children) if (c.userData.upright) { c.visible = i < lit; i++; }
        for (const v of fv.views) if (v.gRow < lit && v.alive) v.g.scale.multiplyScalar(1.06);
      }
      for (const c of [...visuals.children, ...fv.ghosts]) {
        if (c.userData.upright) c.rotation.z = -formation.rotation.z;
        const pop = c.userData.pop as number | undefined;
        if (pop !== undefined) { const k = Math.min(1, (now - pop) / 0.25); c.scale.setScalar(0.55 + 0.45 * ease(k) + Math.sin(Math.PI * k) * 0.12); if (k >= 1) delete c.userData.pop; }
        const slide = c.userData.slide as { from: THREE.Vector3; to: THREE.Vector3; t0: number } | undefined;
        if (slide) { const k = Math.min(1, Math.max(0, (now - slide.t0 - 0.35) / 0.9)); c.position.lerpVectors(slide.from, slide.to, ease(k)); }
        const fade = c.userData.fade as number | undefined;
        if (fade !== undefined) { const k = Math.min(1, (now - fade) / 0.45); c.scale.setScalar(Math.max(0.001, 1 - k)); if (k >= 1) c.visible = false; }
        const grow = c.userData.grow as { t0: number; axis: "x" | "y" } | undefined;
        if (grow) { const k = Math.max(0.01, Math.min(1, (now - grow.t0) / 0.35)); c.scale.set(grow.axis === "x" ? k : 1, grow.axis === "y" ? k : 1, 1); }
      }
      for (const g of fv.ghosts) if (!g.userData.slide) g.position.y += Math.sin(T * 2.4) * 0.002;
      // the "3 squads" / "8 each" labels pulse when a beat points at the whole fleet
      const lp = fv.labelPulse >= 0 ? now - fv.labelPulse : 9;
      for (const c of labels.children) if (!c.userData.rail) c.scale.setScalar(1 + (lp < 0.8 ? Math.sin((lp / 0.8) * Math.PI) * 0.18 : 0));
      const sh = shield.userData.t0 as number | undefined;
      (shield.material as THREE.MeshBasicMaterial).opacity = sh === undefined ? 0 : Math.max(0, LOOK.shield.peak * (1 - (now - sh) / 0.5));
      zeroRing.rotation.z += dt * 0.6;
      zeroRing.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 1.5);
    },
  };
  return fv;
}
export type FleetView = ReturnType<typeof createFleetView>;
