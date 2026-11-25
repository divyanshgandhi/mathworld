import * as THREE from "three";
import type { Stage } from "@/engine/stage";
import { makeGhost } from "@/worlds/space/ships";
import { LOOK, type Tone } from "../look";
import { fmt, GAP, type FleetView, type ShipView } from "./fleetView";
import { holoLabel, holoPlate, type HoloRect } from "./holo";

/**
 * Marks on the live fleet: the drawing kit Power-Ups and Show Me How share. Plates behind groups of
 * ships, part labels, laser cuts, ghost ships, a split along a row or column, and the place-value bands.
 * Everything lands in the fleet view's marks group (or its ghosts), so `fv.clearMarks()` removes it all.
 */
export function createMarks(stage: Stage, fv: FleetView) {
  const M = stage.mats;
  const rectOf = (v: ShipView): HoloRect => { const c = v.home.clone().add(v.offset); return { x: c.x, y: c.y, hx: v.size.x / 2, hy: v.size.y / 2 }; };
  const marks = {
    /** A translucent plate behind a set of ships (in formation space, offsets included), and any ghosts. */
    plate(sel: ShipView[], tone: Tone, extra: THREE.Object3D[] = []) {
      if (!sel.length && !extra.length) return null;
      const rects = sel.map(rectOf);
      for (const g of extra) { const p = g.position, h = g.userData.half as THREE.Vector2; rects.push({ x: p.x, y: p.y, hx: h.x, hy: h.y }); }
      const m = holoPlate(rects, tone);
      fv.visuals.add(m);
      return m;
    },
    /** A part label in the fleet. `right`: it starts at `at` (labels right of the fleet never overlap it). */
    tag(text: string, at: THREE.Vector3, color: string = LOOK.ink.gold, right = false) {
      const t = holoLabel(text, "tag", { at, scale: fv.scale, color, right });
      fv.visuals.add(t);
      return t;
    },
    /** A value badge for a lesson beat: bigger than a tag, and it pops in. */
    badge(text: string, at: THREE.Vector3, color: string = LOOK.ink.gold) {
      const t = holoLabel(text, "badge", { at, scale: fv.scale, color, time: stage.time });
      fv.visuals.add(t);
      return t;
    },
    /** A cut along a column (`x`) or a row (`y`), growing in. */
    laser(x: number | null, y: number | null) {
      // just past the fleet edge: long enough to read as a cut, short of the axis labels and the keypad
      const W = fv.fw / fv.scale + 0.6, H = fv.fh / fv.scale + 0.6;
      const m = new THREE.Mesh(x !== null ? new THREE.BoxGeometry(0.07, H, 0.07) : new THREE.BoxGeometry(W, 0.07, 0.07), M.glow(LOOK.laser.color, LOOK.laser.intensity));
      m.position.set(x ?? 0, y ?? 0, 0.5);
      m.userData.grow = { t0: stage.time, axis: x !== null ? "y" : "x" };
      fv.visuals.add(m);
    },
    /** A ghost ship at `p`: a fighter ghost, or the dashed outline of the pod or carrier it stands in for. */
    ghostAt(p: THREE.Vector3, like?: ShipView) {
      let g: THREE.Object3D;
      if (!like || like.kind === "fighter") { g = makeGhost(); g.scale.setScalar(0.78); g.userData.upright = true; }
      else {
        // a ghost pod / carrier: the dashed outline of the ship it stands in for, so its worth reads the same
        const box = new THREE.PlaneGeometry(like.size.x * 0.94, like.size.y * 0.7);
        const line = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineDashedMaterial({ color: LOOK.ghost.color, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.9 }));
        line.computeLineDistances();
        g = new THREE.Group().add(new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: LOOK.ghost.color, transparent: true, opacity: LOOK.ghost.fill, depthWrite: false })), line);
      }
      g.position.copy(p);
      g.userData.half = like ? like.size.clone().multiplyScalar(0.5) : new THREE.Vector2(0.5, 0.5);
      fv.formation.add(g);
      fv.ghosts.push(g);
      return p;
    },
    /** A dashed hologram of a w × h outline at (x, y): Show Me How's reshape. */
    outline(w: number, h: number, x: number, y: number) {
      const box = new THREE.PlaneGeometry(w, h), line = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineDashedMaterial({ color: LOOK.ghost.color, dashSize: 0.25, gapSize: 0.15, transparent: true, opacity: 0.95 }));
      line.computeLineDistances();
      const g = new THREE.Group().add(new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: LOOK.ghost.color, transparent: true, opacity: LOOK.ghost.outlineFill, depthWrite: false })), line);
      g.position.set(x, y, 0.3);
      g.userData.half = new THREE.Vector2(w / 2, h / 2);
      fv.formation.add(g);
      fv.ghosts.push(g);
      return g;
    },
    /** Split along columns at `at` (cols ≥ at shift right) or rows (rows ≥ at shift down). */
    split(axis: "col" | "row", at: number, tones: [Tone, Tone] = ["cyan", "amber"]) {
      const first = fv.views.filter((v) => (axis === "col" ? v.gCol : v.gRow) < at), rest = fv.views.filter((v) => (axis === "col" ? v.gCol : v.gRow) >= at);
      for (const v of rest) v.offset.set(axis === "col" ? 0.7 : 0, axis === "row" ? -0.7 : 0, 0);
      const plates = [marks.plate(first, tones[0]), marks.plate(rest, tones[1])];
      if (!first.length || !rest.length) return { first, rest, plates };
      const edge = first.reduce((m, v) => (axis === "col" ? Math.max(m, v.home.x + v.size.x / 2) : Math.min(m, v.home.y - v.size.y / 2)), axis === "col" ? -Infinity : Infinity);
      if (axis === "col") marks.laser(edge + 0.35 + GAP / 2, null); else marks.laser(null, edge - 0.35 - GAP / 2);
      return { first, rest, plates };
    },
    /** Place-value bands pulled apart (big ships on one side, small on the other), labelled with their parts. */
    bands({ plates = false } = {}) {
      const f = fv.fleet;
      if (!f) return;
      for (const v of fv.views) { const s = f.sectors[v.ship.sector]; v.offset.set(s.colBand * 0.9, -s.rowBand * 0.9, 0); }
      if (plates) {
        const tones: Tone[] = ["cyan", "amber", "coral", "lime", "gold"];
        for (const s of f.sectors) marks.plate(fv.views.filter((v) => v.ship.sector === s.i), tones[(s.rowBand + s.colBand) % tones.length]);
      }
      f.colParts.forEach((c, i) => { const vs = fv.views.filter((v) => f.sectors[v.ship.sector].colBand === i); if (vs.length && f.colParts.length > 1) marks.tag(fmt(c), new THREE.Vector3(marks.meanX(vs), marks.axisTop() - 0.2, 0)); });
      f.rowParts.forEach((r, i) => { const vs = fv.views.filter((v) => f.sectors[v.ship.sector].rowBand === i); if (vs.length && f.rowParts.length > 1) marks.tag(fmt(r), new THREE.Vector3(marks.axisLeft(), marks.meanY(vs), 0), undefined, true); });
    },
    // trick tags sit below and to the right of the fleet, clear of the "3 squads" / "8 each" axis labels
    axisTop: () => -fv.fh / fv.scale / 2 - 0.75,
    axisLeft: () => fv.fw / fv.scale / 2 + 0.9,
    meanX: (vs: ShipView[]) => vs.reduce((s, v) => s + v.home.x + v.offset.x, 0) / vs.length,
    meanY: (vs: ShipView[]) => vs.reduce((s, v) => s + v.home.y + v.offset.y, 0) / vs.length,
    centre: (vs: ShipView[]) => new THREE.Vector3(marks.meanX(vs), marks.meanY(vs), 0),
    /** A point `d` under the fleet as the cadet sees it (the formation may be turned a quarter). */
    under: (d = 0) => (fv.flipped ? new THREE.Vector3(-(fv.fw / fv.scale / 2 + 0.95 + d), 0, 0) : new THREE.Vector3(0, -(fv.fh / fv.scale / 2 + 0.95 + d), 0)),
    show(o: THREE.Object3D | null | undefined) { if (o) { o.visible = true; o.userData.pop = stage.time; } },
    hide(o: THREE.Object3D | null | undefined) { if (o) o.visible = false; },
    /** Pulse ships one after another. */
    pulseAll(vs: ShipView[]) { fv.pulses = vs.map((v, i) => ({ v, t0: stage.time + i * Math.min(0.04, 0.6 / vs.length) })); },
  };
  return marks;
}
export type Marks = ReturnType<typeof createMarks>;
