import * as THREE from "three";
import { add } from "@/engine/materials";
import type { Stage } from "@/engine/stage";
import { ease, type Rng } from "@/engine/util";
import { unitLabel, type Fleet, type Ship } from "@/rig/fleet";
import { makeCarrier, makeDreadnought, makeFighterLite, makeInvader, makeTenSquadPod, squadStyle } from "@/worlds/space/ships";
import { battleFleet, BIG as BIG_CELL, CELL as CELL_W, GAP as SHIP_GAP, laneBoxes, layoutFleet, PITCH as SHIP_PITCH, type Layout, type Slot } from "../formation";
import { LOOK, reducedMotion } from "../look";
import { holoLabel, holoWidth } from "./holo";

/**
 * Fleet view: the formation of ships for one wave, laid out by `src/battle/formation.ts` (rows ×
 * columns true to the numbers, squads apart), and everything that moves with it: the warp-in squad
 * by squad, the flinch, squash and pop of a kill, the survivors gathering after a short shot, their
 * wink, the regroup, the "N squads" / "N in each squad" axis labels, the Flip It! quarter turn, and
 * the group that Power-Up and lesson marks live in.
 */
export type Kind = "fighter" | "pod" | "carrier" | "dread";
export interface ShipView {
  ship: Ship; kind: Kind; g: THREE.Group; home: THREE.Vector3; offset: THREE.Vector3; pos: THREE.Vector3;
  /** Squad (0 is the top squad) and place along it (0 is the leader's place). */
  gRow: number; gCol: number; size: THREE.Vector2;
  alive: boolean; pop: number; enter: number; wink: number; ph: number;
  micro?: THREE.Group[]; podTag?: THREE.Object3D; carrier?: ReturnType<typeof makeCarrier>; dread?: ReturnType<typeof makeDreadnought>; base: number;
  /** Its place in the layout. */
  slot: Slot;
  /** Where it gathers to after a short shot (formation units, from home), and since when. */
  shift: THREE.Vector3; shiftFrom: THREE.Vector3; shiftTo: THREE.Vector3; shiftT: number;
  /** Stage time its ball lands (it flinches just before), the hit-stop hold, and the regroup scale-in. */
  flinch: number; hold: number; back: number;
  /** Seconds since it set off on its warp-in (negative: still waiting its turn). */
  warp: number;
}

// layout constants: kept here too, because Power-Ups and lessons import them from this file
export const CELL = CELL_W, BIG = BIG_CELL, GAP = SHIP_GAP, GUTTER = 0.75, PITCH = SHIP_PITCH;
/** The fleet's centre height above the battle origin. */
export const FLEET_Y = 4.2;
/** The axis labels' base world height (the battle raises it on small screens so the words stay readable). */
export const AXIS_H = 0.5;
export const fmt = (n: number) => n.toLocaleString("en-US");
/** How an axis label shows: fully, softly (an unprompted first-sight hint), or not yet. */
export type AxisShow = "on" | "soft" | "off";
/** The words on the axes. */
export const squadsText = (n: number) => `${fmt(n)} ${n === 1 ? "squad" : "squads"}`;
export const eachText = (n: number) => `${fmt(n)} in each squad`;

/** Fighters above this count use the cheap fighter (three draws instead of eleven). */
export const LITE_OVER = 48;
/** Seconds a ship takes from deep space to its place, and the warp-in's whole budget. */
const WARP_FLIGHT = 0.42, WARP_SPREAD = 0.62;
/** A kill: the squash and pop (seconds), and the anticipation before a ball lands. */
const POP = 0.16, FLINCH = 0.14;

export function createFleetView(stage: Stage, root: THREE.Group, rnd: Rng) {
  const M = stage.mats;
  // the fleet lives in `formation` (it can turn for Flip It!); labels stay upright outside it
  const formation = new THREE.Group(), labels = new THREE.Group();
  formation.position.set(0, FLEET_Y, 0);
  root.add(formation, labels);
  const zeroRing = add(formation, new THREE.TorusGeometry(1.4, 0.035, 12, 96), M.clay(LOOK.zeroRing.color, { roughness: 0.6 }), 0, 0, 0, { cast: false });
  zeroRing.visible = false;
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: LOOK.shield.color, transparent: true, opacity: 0, depthWrite: false }));
  shield.position.z = 0.8;
  formation.add(shield);
  /** Power-Up and lesson marks: plates, tags, badges, lasers. */
  const visuals = new THREE.Group();
  /** The battle's own world marks (scans, brackets, counts): never cleared by a Power-Up. */
  const overlay = new THREE.Group();
  /** Empty lanes of a b = 0 fleet (one per squad). */
  const lanes = new THREE.Group();
  formation.add(lanes);

  const fv = {
    formation, labels, visuals, overlay, lanes, zeroRing, shield,
    views: [] as ShipView[], ghosts: [] as THREE.Object3D[], fleet: null as Fleet | null, layout: null as Layout | null,
    /** Formation scale and on-screen size of the fleet (world units). */
    scale: 1, fw: 8, fh: 5,
    flipped: false, flipT: 0,
    pulses: [] as { v: ShipView; t0: number }[], rowPulse: null as { rows: number; t0: number } | null, labelPulse: -1,
    axis: { squads: "on" as AxisShow, each: "on" as AxisShow },
    /** When this fleet's warp-in ends (stage time). */
    landed: 0,
    /** Mount the marks group (after the shield, so draw order stays what it was). */
    mountMarks() { formation.add(visuals, overlay); },

    /** Marks off: plates, ghosts, offsets and pulses go; the fleet keeps its turn. */
    clearMarks() {
      visuals.clear();
      for (const g of fv.ghosts) formation.remove(g);
      fv.ghosts = [];
      for (const v of fv.views) v.offset.set(0, 0, 0);
      fv.pulses = []; fv.rowPulse = null;
    },
    clear() {
      for (const v of fv.views) formation.remove(v.g);
      fv.views = [];
      fv.clearMarks();
      overlay.clear();
      lanes.clear();
      labels.clear();
      fv.axisBox = null;
    },

    /** The fleet for a × b, warping in from deep space squad by squad, each squad's leader first. */
    build(a: number, b: number) {
      fv.clear();
      const f = battleFleet(a, b), l = layoutFleet(f);
      fv.fleet = f; fv.layout = l;
      const { W, H } = l;
      fv.scale = Math.min(1.55, 11 / Math.max(W, 1), 8 / Math.max(H, 1));
      fv.fw = Math.max(W * fv.scale, 3); fv.fh = Math.max(H * fv.scale, 2);
      formation.scale.setScalar(fv.scale);
      const fighters = f.ships.filter((s) => s.k === 0).length, lite = fighters > LITE_OVER;
      const perSquad = new Map<number, number>();
      for (const s of l.slots) perSquad.set(s.squad, (perSquad.get(s.squad) ?? 0) + 1);
      const reduced = reducedMotion();
      // the warp-in: squads land one after another inside WARP_SPREAD, leader first and the squad as a unit
      const rows = Math.max(1, l.rows), perRow = Math.min(0.13, WARP_SPREAD / rows);
      for (const ship of f.ships) {
        const slot = l.slots[ship.id], sec = f.sectors[ship.sector];
        const kind: Kind = ship.k === 0 ? "fighter" : ship.k === 1 ? "pod" : ship.k === 2 ? "carrier" : "dread";
        const v: ShipView = {
          ship, kind, slot, g: new THREE.Group(), home: new THREE.Vector3(slot.x, slot.y, 0), offset: new THREE.Vector3(), pos: new THREE.Vector3(), size: new THREE.Vector2(slot.w, slot.h),
          gRow: slot.squad, gCol: slot.index,
          alive: true, pop: 0, enter: 0, wink: 0, ph: rnd() * 6, base: 1,
          shift: new THREE.Vector3(), shiftFrom: new THREE.Vector3(), shiftTo: new THREE.Vector3(), shiftT: -1, flinch: 0, hold: 0, back: 0,
          warp: reduced ? -slot.row * perRow * 0.5 : -(slot.row * perRow + (slot.index === 0 ? 0 : 0.07)),
        };
        const style = squadStyle(slot.squad, slot.index);
        if ((perSquad.get(slot.squad) ?? 0) < 2) style.leader = false;
        if (kind === "fighter") { v.g.add(lite ? makeFighterLite(M, style) : makeInvader(M, style)); v.base = 0.78; }
        else if (kind === "pod") { const p = makeTenSquadPod(M, sec.orient, style); v.g.add(p.group); v.micro = p.micro; v.podTag = p.tag; }
        else if (kind === "carrier") { v.carrier = makeCarrier(M, sec.orient, style); v.g.add(v.carrier.group); }
        else { v.dread = makeDreadnought(M, unitLabel(ship.k), sec.orient, style); v.g.add(v.dread.group); }
        v.g.scale.setScalar(0.001);
        v.g.visible = false;
        v.pos.copy(v.home);
        formation.add(v.g);
        fv.views.push(v);
      }
      fv.landed = stage.time + (reduced ? rows * perRow * 0.5 + 0.3 : WARP_SPREAD + 0.07 + WARP_FLIGHT + 0.1);
      zeroRing.visible = a === 0 || b === 0;
      zeroRing.scale.setScalar(1);
      // lanes with nothing in them (5 × 0): faint rails, one per squad, true to the number of squads
      if (a > 0 && b === 0) for (const box of laneBoxes(a)) {
        const rail = add(lanes, new THREE.BoxGeometry(box.hx * 2, 0.04, 0.04), M.clay(LOOK.rail, { roughness: 0.8 }), box.x, box.y, 0, { cast: false });
        rail.userData.warp = -box.y;
      }
      // an empty fleet still has a size: the zero ring and its lanes, so labels sit outside it
      if (a === 0 || b === 0) {
        const lh = a > 0 && b === 0 ? laneBoxes(a).reduce((m, x) => Math.max(m, Math.abs(x.y) + 0.5), 0) * 2 : 0;
        const ring = 2 * 1.5 * fv.scale;
        fv.fw = Math.max(fv.fw, ring, a > 0 ? 5 * fv.scale : 0); fv.fh = Math.max(fv.fh, ring, lh * fv.scale);
      }
      shield.scale.set(W + 1.2, H + 1.2, 1);
    },

    /**
     * "3 squads" down the left, "8 in each squad" along the top: rows vs columns are never ambiguous.
     * `squads` × `each` are the numbers as the cadet sees them (swapped while the fleet is turned).
     */
    axisLabels(squads: number, each: number) {
      labels.clear();
      const [w, h] = fv.flipped ? [fv.fh, fv.fw] : [fv.fw, fv.fh];
      const left = holoLabel(squadsText(squads), "axis"), top = holoLabel(eachText(each), "axis");
      left.userData.axis = "squads"; top.userData.axis = "each";
      left.userData.axisText = top.userData.axisText = true;
      labels.add(left, top);
      const brk = new THREE.MeshBasicMaterial({ color: LOOK.bracket.color, transparent: true, toneMapped: false });
      add(labels, new THREE.PlaneGeometry(0.035, Math.max(h, 0.6)), brk, -w / 2 - 0.22, FLEET_Y, 0.3, { cast: false }).userData.axis = "squads";
      add(labels, new THREE.PlaneGeometry(Math.max(w, 0.6), 0.035), brk, 0, FLEET_Y + h / 2 + 0.22, 0.3, { cast: false }).userData.axis = "each";
      fv.axisBox = { w, h, left, top };
      fv.axisSize(fv.axisH);
      fv.showAxis(fv.axis.squads, fv.axis.each);
    },
    /** World height of the axis labels (the battle keeps them readable on screen); the frame makes room. */
    axisH: AXIS_H,
    axisBox: null as { w: number; h: number; left: THREE.Object3D; top: THREE.Object3D } | null,
    /** How far the axis labels reach beyond the fleet: left of it and above it (world units). */
    axisPad: { left: 2.4, top: 1.0 },
    axisSize(height: number) {
      fv.axisH = height;
      const b = fv.axisBox;
      if (!b) return;
      const k = height / AXIS_H, lw = holoWidth(b.left) * k;
      b.left.userData.k = b.top.userData.k = k;
      b.left.position.set(-b.w / 2 - 0.35 - lw / 2, FLEET_Y, 0.4);
      b.top.position.set(0, FLEET_Y + b.h / 2 + 0.3 + height / 2, 0.4);
      fv.axisPad = { left: Math.max(2.4, 0.35 + lw + 0.3), top: Math.max(1.0, 0.3 + height + 0.25) };
    },
    /** Show, soften or hide each axis label with its bracket (structure "discover"). */
    showAxis(squads: AxisShow, each: AxisShow) {
      fv.axis = { squads, each };
      for (const c of labels.children) {
        const which = c.userData.axis as "squads" | "each" | undefined;
        if (!which) continue;
        const s = which === "squads" ? squads : each;
        if (c.visible !== (s !== "off") && s !== "off") c.userData.settle = stage.time;
        c.visible = s !== "off";
        const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (m) { m.opacity = s === "soft" ? LOOK.soft.opacity : 1; m.transparent = true; }
      }
    },
    /** How far the visible axis labels reach (world units): nothing when they are hidden. */
    visiblePad() {
      return { left: fv.axis.squads !== "off" && fv.axisBox ? fv.axisPad.left : 0, top: fv.axis.each !== "off" && fv.axisBox ? fv.axisPad.top : 0 };
    },

    /** A ball is on its way: the ship flinches just before `at` (stage time). */
    incoming(v: ShipView, at: number) { v.flinch = at; },
    /**
     * A ball lands: a full hit destroys the ship (squash, then gone in POP seconds), a partial one pops
     * part of a pod or a big ship. `hold`: a hit-stop, seconds the squash holds before it pops.
     */
    land(v: ShipView, amount: number, full: boolean, hold = 0) {
      if (full) { v.alive = false; v.pop = stage.time; v.hold = hold; }
      else if (v.micro) v.micro.forEach((m, i) => { m.visible = i >= amount; });
      else if (v.carrier) v.carrier.popped(amount);
      else if (v.dread) v.dread.damaged(amount / v.ship.value);
    },
    /** Survivors gather into true rows at the top left: survivor i takes the place of `order[i]`. */
    gather(order: number[]) {
      const alive = order.map((id) => fv.views[id]).filter((v) => v.alive);
      // only a fleet of single fighters packs cleanly; pods and big ships stay where they are
      if (alive.some((v) => v.kind !== "fighter")) return alive;
      alive.forEach((v, i) => {
        const to = fv.views[order[i]];
        v.shiftFrom.copy(v.shift); v.shiftTo.set(to.home.x - v.home.x, to.home.y - v.home.y, 0); v.shiftT = stage.time + i * 0.012;
      });
      return alive;
    },
    /** A miss: the survivors give a cheeky wink (a hop and a tilt), one after another. */
    wink(delay = 0) { let i = 0; for (const v of fv.views) if (v.alive) v.wink = stage.time + delay + Math.min(0.3, i++ * 0.02); },
    /** Shields back up: every ship returns, so the next shot is at the whole fleet again. */
    regroup() {
      shield.userData.t0 = stage.time;
      for (const v of fv.views) {
        if (!v.alive) v.back = stage.time;
        v.alive = true; v.pop = 0; v.wink = 0; v.flinch = 0; v.hold = 0;
        if (v.shiftT >= 0 || v.shift.lengthSq() > 0) { v.shiftFrom.copy(v.shift); v.shiftTo.set(0, 0, 0); v.shiftT = stage.time; }
        v.g.visible = true;
        v.micro?.forEach((m) => (m.visible = true));
        v.carrier?.popped(0);
        v.dread?.damaged(0);
      }
    },
    /** Where a ship is now in formation space (home, trick offset and gather shift). */
    placeOf(v: ShipView, out = new THREE.Vector3()) { return out.copy(v.home).add(v.offset).add(v.shift); },

    update(dt: number, T: number) {
      const now = stage.time, reduced = reducedMotion();
      // Flip It!: the formation turns a quarter; ships stay upright, labels re-read the new axes
      const fk = fv.flipT ? Math.min(1, (now - fv.flipT) / 0.8) : 1;
      formation.rotation.z = (fv.flipped ? ease(fk) : 1 - ease(fk)) * (fv.flipT ? Math.PI / 2 : 0);
      const target = new THREE.Vector3();
      for (const v of fv.views) {
        v.warp += dt;
        if (v.warp < 0) { v.g.visible = false; continue; }
        // gather (or come home): eased over 0.45 s
        if (v.shiftT >= 0 && now >= v.shiftT) {
          const k = Math.min(1, (now - v.shiftT) / 0.45);
          v.shift.lerpVectors(v.shiftFrom, v.shiftTo, 1 - Math.pow(1 - k, 3));
          if (k >= 1) v.shiftT = -1;
        }
        fv.placeOf(v, target);
        const wk = Math.min(1, v.warp / WARP_FLIGHT);
        let sx = 1, sy = 1;
        if (wk < 1) {
          // the warp: from deep space, stretched along its flight, settling as it lands
          const e = 1 - Math.pow(1 - wk, 3);
          v.pos.set(target.x, target.y + (1 - e) * (reduced ? 0.6 : 3.2), (1 - e) * (reduced ? -3 : -24));
          if (!reduced) { sx = 0.7 + 0.3 * e; sy = 1.6 - 0.6 * e; }
          v.g.visible = true;
        } else {
          v.pos.lerp(target, Math.min(1, dt * 10));
          // the landing: one small squash as the squad arrives as a unit
          const lk = (v.warp - WARP_FLIGHT) / 0.14;
          if (lk < 1 && !reduced) { const s = Math.sin(Math.PI * lk) * 0.12; sx = 1 + s; sy = 1 - s; }
        }
        const bob = v.alive ? Math.sin(T * 2 + v.ph) * (v.kind === "fighter" ? 0.05 : 0.015) : 0;
        v.g.position.copy(v.pos).setY(v.pos.y + bob);
        // fighters, carriers and dreadnoughts stay upright when the fleet turns; a pod turns with it (its 10 now runs the other way)
        let rz = v.kind === "pod" ? 0 : -formation.rotation.z + (v.kind === "fighter" ? Math.sin(T * 1.7 + v.ph) * 0.06 : 0), rx = 0;
        if (v.podTag) v.podTag.rotation.z = -formation.rotation.z; // its "10" badge still reads upright
        if (v.kind === "fighter") v.g.rotation.y = Math.sin(T * 1.3 + v.ph) * 0.35;
        let sc = v.base;
        if (!v.alive) {
          // impact: a quick squash (held through a hit-stop), then it pops to nothing
          const pop = reduced ? POP * 0.7 : POP, held = now - v.pop < v.hold, k = held ? 0.2 : (now - v.pop - v.hold) / pop;
          if (k >= 1) { v.g.visible = false; v.g.scale.setScalar(0.001); continue; }
          const sq = Math.sin(Math.PI * Math.min(1, k / 0.4));
          sx *= 1 + 0.32 * sq; sy *= 1 - 0.38 * sq;
          sc *= k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6;
        } else {
          // anticipation: it leans back as the ball closes in
          if (v.flinch && !reduced) {
            const q = 1 - (v.flinch - now) / FLINCH;
            if (q > 0 && q <= 1) { rx = -0.38 * q; sy *= 1 - 0.07 * q; v.g.position.y += 0.05 * q; }
          }
          // the cheeky wink: a hop and a tilt, never a threat
          if (v.wink && now >= v.wink) {
            const k = (now - v.wink) / 0.42;
            if (k < 1) { const h = Math.sin(Math.PI * k); v.g.position.y += h * (reduced ? 0.06 : 0.22); rz += Math.sin(k * Math.PI * 2) * (reduced ? 0 : 0.22); sx *= 1 + 0.05 * h; }
          }
          // back after the regroup: it pops into its place
          if (v.back) { const k = Math.min(1, (now - v.back) / 0.3); sc *= ease(k) * (1 + Math.sin(Math.PI * k) * 0.08); if (k >= 1) v.back = 0; }
        }
        for (const pl of fv.pulses) if (pl.v === v && now > pl.t0) sc *= 1 + Math.max(0, Math.sin((now - pl.t0) * 5)) * 0.1;
        v.g.rotation.z = rz; v.g.rotation.x = rx;
        v.g.visible = true;
        v.g.scale.set(sc * sx, sc * sy, sc);
      }
      for (const r of lanes.children) {
        const k = Math.min(1, Math.max(0, (now - (fv.landed - 0.5) + (r.userData.warp as number) * 0.03) / 0.4));
        r.scale.set(Math.max(0.001, ease(k)), 1, 1);
      }
      if (fv.rowPulse) {
        // Fast Adding: squads light up one at a time with a running total (the last one stays a question)
        const lit = Math.min(fv.rowPulse.rows, Math.floor((now - fv.rowPulse.t0) / 0.45) + 1);
        let i = 0;
        for (const c of visuals.children) if (c.userData.upright) { c.visible = i < lit; i++; }
        for (const v of fv.views) if (v.gRow < lit && v.alive) v.g.scale.multiplyScalar(1.06);
      }
      for (const c of [...visuals.children, ...overlay.children, ...fv.ghosts]) {
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
      // the axis labels settle in when the ladder reveals them, and pulse when a beat points at the whole fleet
      const lp = fv.labelPulse >= 0 ? now - fv.labelPulse : 9;
      for (const c of labels.children) {
        const st = c.userData.settle as number | undefined, sk = st === undefined ? 1 : Math.min(1, (now - st) / 0.35);
        const settle = 0.9 + 0.1 * (1 - Math.pow(1 - sk, 3));
        c.scale.setScalar(((c.userData.k as number | undefined) ?? 1) * settle * (1 + (lp < 0.8 ? Math.sin((lp / 0.8) * Math.PI) * 0.18 : 0)));
      }
      const sh = shield.userData.t0 as number | undefined;
      (shield.material as THREE.MeshBasicMaterial).opacity = sh === undefined ? 0 : Math.max(0, LOOK.shield.peak * (1 - (now - sh) / 0.5));
      zeroRing.rotation.z += dt * 0.6;
      zeroRing.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 1.5);
    },
  };
  return fv;
}
export type FleetView = ReturnType<typeof createFleetView>;
