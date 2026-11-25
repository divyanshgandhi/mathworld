import * as THREE from "three";
import type { Sfx } from "@/engine/audio";
import type { Plan, Step } from "@/rig/showme";
import type { TrickId } from "@/rig/tricks";
import { LOOK } from "./look";
import { tens } from "./powerups/easy-5-10";
import { doubleSide, jumpSplit, splitFive } from "./powerups/shared";
import type { Scheduler } from "./scheduler";
import { fmt, GAP, type FleetView, type ShipView } from "./systems/fleetView";
import type { Marks } from "./systems/marks";

/**
 * Show Me How on the live fleet: each beat's typed Show (src/rig/showme.ts) becomes one visual move.
 * Values are labelled here (this is I Do); the Power-Ups never reveal them (We Do).
 */
export interface LessonCtx {
  fv: FleetView;
  marks: Marks;
  at: Scheduler;
  /** Use a Power-Up's visual (without entering Sector-Lock). */
  powerUp: (t: TrickId) => void;
  cue: (sfx: Sfx) => void;
  /** This lesson is still the one on screen. */
  current: (id: number) => boolean;
}

export function createLessonStage(ctx: LessonCtx) {
  const { fv, marks, at, cue } = ctx;
  let lv: { plates: (THREE.Object3D | null)[]; block: number; rowsPlate: THREE.Object3D | null; banded: boolean; halved: boolean } = { plates: [], block: 0, rowsPlate: null, banded: false, halved: false };
  const bands = () => { if (!fv.fleet || lv.banded) return; lv.banded = true; marks.bands(); };
  return {
    reset() { lv = { plates: [], block: 0, rowsPlate: null, banded: false, halved: false }; },
    beat(p: Plan, st: Step, id: number, a: number, b: number, now: number) {
      const f = fv.fleet;
      if (!f) return;
      const views = fv.views, sh = st.show, t = p.trick;
      // the lesson's squads: a turned lesson (8 × 3 taught as 3 squads of 8) counts the fleet's columns, top first
      const turned = p.silentFlip || p.lesson.flipBeats > 0, perSquad = turned ? a : b;
      const squad = (v: ShipView) => (turned ? b - 1 - v.gCol : v.gRow);
      const rightOf = (vs: ShipView[]) => {
        // just right of a squad as the cadet sees it (the formation may be turned a quarter)
        const vis = vs.map((v) => (turned ? new THREE.Vector2(-v.home.y, v.home.x) : new THREE.Vector2(v.home.x, v.home.y)));
        const x = Math.max(...vis.map((q) => q.x)) + 1.1, y = vis.reduce((s, q) => s + q.y, 0) / vis.length;
        return turned ? new THREE.Vector3(y, -x, 0) : new THREE.Vector3(x, y, 0);
      };
      const rowsUpTo = (k: number) => {
        if (lv.rowsPlate) fv.visuals.remove(lv.rowsPlate);
        lv.rowsPlate = marks.plate(views.filter((v) => squad(v) < k), "cyan");
        const row = views.filter((v) => squad(v) === k - 1);
        if (row.length) marks.badge(fmt(k * perSquad), rightOf(row));
        cue("blip_ok");
      };
      switch (sh.kind) {
        case "fleet": fv.labelPulse = now; break;
        case "empty": fv.zeroRing.scale.setScalar(1.35); marks.badge("0 ships", marks.under(), LOOK.ink.cyan); break;
        case "mirror": marks.plate(views, "cyan"); marks.badge(`mirror · ${fmt(a * b)}`, marks.under(), LOOK.ink.cyan); marks.pulseAll(views); break;
        case "rotate": if (!fv.flipped) ctx.powerUp("flip-it"); break;
        case "rows":
          if (st.sweep) for (let k = 1; k <= sh.upTo; k++) at.at((k - 1) * 0.5, () => { if (ctx.current(id)) rowsUpTo(k); });
          else rowsUpTo(sh.upTo);
          break;
        case "halves": {
          const k = doubleSide(a, b), n = k === a ? b : a;
          if (!lv.halved) {
            lv.halved = true;
            const r = marks.split(a === k ? "row" : "col", k / 2);
            lv.plates = r.plates;
            if (k === 2) { marks.badge(fmt(n), marks.centre(r.first)); marks.badge(fmt(n), marks.centre(r.rest)); break; }
            marks.hide(r.plates[1]);
            marks.badge(fmt(sh.value), marks.centre(r.first));
          } else {
            const rest = views.filter((v) => (a === k ? v.gRow : v.gCol) >= k / 2);
            marks.show(lv.plates[1]);
            marks.badge(fmt(sh.value), marks.centre(rest), LOOK.ink.amber);
          }
          break;
        }
        case "pods": {
          const big = views.filter((v) => v.kind !== "fighter"), unit = 10 ** (String(Math.max(a, b)).length - 1);
          // up to 10 × 10 a 10 is ten single ships: each group of ten gets its own gold plate
          if (!big.length && (a === 10 || b === 10)) tens(views, a, b).forEach((g) => marks.plate(g, "gold"));
          else marks.plate(big.length ? big : views, "gold");
          marks.pulseAll(big.length ? big : views);
          marks.badge(t === "easy-5-10" ? `${fmt(sh.value)} Pods` : `${fmt(sh.value)} × ${fmt(unit)}`, marks.under());
          break;
        }
        case "twin": {
          ctx.powerUp("easy-5-10");
          marks.badge(`${fmt(sh.value / 10)} × 10 = ${fmt(sh.value)}`, marks.under(0.9), LOOK.ink.cyan);
          break;
        }
        case "slice": {
          if (t === "easy-5-10") {
            // the borrowed twin half fades: 5 is half of 10
            const real = b === 5 ? views.filter((v) => v.gCol === 4) : views.filter((v) => v.gRow === 4);
            for (const g of fv.ghosts) g.userData.fade = now;
            for (const c of fv.visuals.children) if (!c.userData.upright && !c.userData.grow) c.userData.fade = now; // the twin's plate goes with it
            marks.plate(views, "gold");
            if (real.length) { if (b === 5) marks.laser(Math.max(...real.map((v) => v.home.x)) + 0.5 + GAP / 2, null); else marks.laser(null, Math.min(...real.map((v) => v.home.y)) - 0.5 - GAP / 2); }
            marks.badge(`½ of ${fmt(2 * p.answer)}`, marks.under(2.2));
          } else if (t === "split-and-add") {
            const r = splitFive(marks, a, b);
            lv.plates = r.plates;
            r.plates.forEach(marks.hide);
            cue("blip_close");
          } else bands();
          break;
        }
        case "block": {
          const i = lv.block++;
          if (t === "split-and-add" || t === "jump-one-more") {
            if (t === "jump-one-more" && i === 0) {
              const r = jumpSplit(marks, a, b);
              lv.plates = r.plates;
              marks.hide(r.plates[1]);
            }
            marks.show(lv.plates[i]);
            const sel = views.filter((v) => (lv.plates[0] ? v.offset.lengthSq() === 0 : true) === (i === 0));
            marks.badge(t === "jump-one-more" && i === 1 ? `+ ${fmt(sh.value)}` : fmt(sh.value), marks.centre(sel.length ? sel : views), i === 0 ? LOOK.ink.gold : LOOK.ink.amber);
          } else if (t === "borrow-take-back") {
            marks.plate(views, "cyan", fv.ghosts);
            marks.badge(fmt(sh.value), marks.centre(views));
          } else {
            // Big & Small Split: one place-value band at a time
            bands();
            const byCols = b === Math.max(a, b), band = (v: ShipView) => (byCols ? f.sectors[v.ship.sector].colBand : f.sectors[v.ship.sector].rowBand);
            const sel = views.filter((v) => band(v) === i), ones = (byCols ? f.colParts : f.rowParts)[i] < 10;
            marks.plate(sel, ones ? "amber" : "cyan");
            if (sel.length) marks.badge(fmt(sh.value), marks.centre(sel));
          }
          cue("blip_ok");
          break;
        }
        case "ghosts": ctx.powerUp("borrow-take-back"); cue("shield"); break;
        case "sector": {
          bands();
          const lo = Math.min(a, b), [rp, cp] = lo === a ? [sh.x, sh.y] : [sh.y, sh.x];
          const sec = f.sectors.find((x) => x.rowPart === rp && x.colPart === cp);
          const sel = sec ? views.filter((v) => v.ship.sector === sec.i) : [];
          marks.plate(sel, "gold");
          if (sel.length) marks.badge(fmt(sh.value), marks.centre(sel));
          cue("blip_ok");
          break;
        }
        case "reshape": {
          // a hologram of the fleet's outline: cut in half, and the half slides beside (or under) the other
          const W = fv.fw / fv.scale, H = fv.fh / fv.scale, rowsHalved = a % 2 === 0 && b % 10 === 5;
          if (rowsHalved) { marks.outline(W, H / 2, 0, H / 4); const lower = marks.outline(W, H / 2, 0, -H / 4); lower.userData.slide = { from: lower.position.clone(), to: new THREE.Vector3(W + 0.6, H / 4, 0.3), t0: now }; marks.laser(null, 0); }
          else { marks.outline(W / 2, H, -W / 4, 0); const right = marks.outline(W / 2, H, W / 4, 0); right.userData.slide = { from: right.position.clone(), to: new THREE.Vector3(-W / 4, -H - 0.6, 0.3), t0: now }; marks.laser(0, null); }
          marks.badge(`${fmt(sh.a)} × ${fmt(sh.b)}`, marks.under(0.3), LOOK.ink.cyan);
          break;
        }
        case "wedo": {
          if (t === "borrow-take-back") {
            for (const g of fv.ghosts) g.traverse((o) => { const m = o as THREE.Mesh; if (m.material && "color" in m.material) { m.material = (m.material as THREE.MeshBasicMaterial).clone(); (m.material as THREE.MeshBasicMaterial).color.set(LOOK.tone.coral); } });
            if (fv.ghosts.length) marks.badge(`− ${fmt(fv.ghosts.length > 1 ? Math.abs(p.lesson.parts[1] ?? 0) : 1)}`, new THREE.Vector3(marks.axisLeft() + 0.4, marks.axisTop(), 0), LOOK.ink.coral);
          } else if (t === "fast-adding") {
            const last = views.filter((v) => squad(v) === Math.max(...views.map(squad)));
            if (last.length) { marks.badge("+ ?", rightOf(last), LOOK.ink.cyan); marks.pulseAll(last); }
            break;
          }
          marks.pulseAll(views.filter((v) => v.alive));
          break;
        }
      }
    },
  };
}
export type LessonStage = ReturnType<typeof createLessonStage>;
