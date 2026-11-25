import * as THREE from "three";
import type { Stage } from "@/engine/stage";
import { eachScan, scanTiming, squadScan, type ScanStep } from "../formation";
import { LOOK, reducedMotion } from "../look";
import { createBracket, inkText, type InkText } from "./ink";
import { fmt, type FleetView } from "./fleetView";

/**
 * Scans: how the battle teaches structure without printing it (OVERHAUL.md, the hint ladder).
 * - Squad scan (after miss 1, or soft on first sight of a fact): a hairline lock-on bracket steps down
 *   the fleet squad by squad, a small count lands at each squad's leader (1, 2, 3…), and Nova's caption
 *   counts along; then the "6 squads" label settles on the axis.
 * - Each scan (after miss 2): the bracket runs along the first squad ship by ship (1, 2 … 7), then
 *   "7 in each squad" settles.
 * The whole scan takes 2.5 s or less however many steps it has, and typing or firing skips straight to
 * its end. Every count is the true count; a shape a scan cannot step truthfully (no squads, more than
 * 20 of them, a turned fleet) gets the plain label at once.
 */
export type ScanKind = "squads" | "each";

export interface ScanHooks {
  /** Formation units per CSS pixel right now (so counts and hairlines keep their size on screen). */
  unitsPerPx: () => number;
  /** Nova's caption (null: let it go). */
  caption: (text: string | null) => void;
}

export function createScan(stage: Stage, fv: FleetView, hooks: ScanHooks) {
  let run: {
    kind: ScanKind; soft: boolean; steps: ScanStep[]; t0: number; step: number; settle: number; shown: number;
    done: (() => void) | null; counts: InkText[]; bracket: ReturnType<typeof createBracket>; said: number[];
  } | null = null;
  const tail: { counts: InkText[]; t0: number; bracket: ReturnType<typeof createBracket>; base: number }[] = [];

  /** The label settles and the scan's marks fade (now, or after a skip). */
  function end(skipped: boolean) {
    if (!run) return;
    const r = run;
    run = null;
    r.done?.();
    if (!r.soft && !skipped) hooks.caption(scanCaption(r.kind, r.steps[r.steps.length - 1].count));
    if (skipped) { r.bracket.dispose(); for (const c of r.counts) c.dispose(); return; }
    tail.push({ counts: r.counts, t0: stage.time, bracket: r.bracket, base: r.soft ? LOOK.scan.soft : 1 });
  }

  const scan = {
    get active() { return !!run; },
    /**
     * Start a scan. `done` runs when its label should settle (at the end, on a skip, or at once when
     * there is nothing truthful to step through). Returns false when it showed the label at once.
     */
    start(kind: ScanKind, a: number, b: number, done: () => void, { soft = false } = {}) {
      scan.skip();
      const l = fv.layout, steps = !l || fv.flipped ? null : kind === "squads" ? squadScan(l, a, b) : eachScan(l, b);
      if (!steps || !steps.length) { done(); return false; }
      const reduced = reducedMotion(), t = scanTiming(steps.length, { soft, max: reduced ? 1.6 : 2.5 });
      const bracket = createBracket(LOOK.scan.color);
      bracket.mat.opacity = soft ? LOOK.scan.soft : 1;
      bracket.group.visible = false;
      fv.overlay.add(bracket.group);
      run = { kind, soft, steps, t0: stage.time, step: t.step, settle: t.settle, shown: -1, done, counts: [], bracket, said: [] };
      return true;
    },
    /** Typing or firing: jump to the end (the label is shown; the marks go). */
    skip() { if (run) end(true); },
    /** A new fleet: everything goes, no label. */
    reset() {
      if (run) { run.done = null; end(true); }
      for (const t of tail) { t.bracket.dispose(); for (const c of t.counts) c.dispose(); }
      tail.length = 0;
    },
    update() {
      const now = stage.time, u = hooks.unitsPerPx();
      for (let i = tail.length - 1; i >= 0; i--) {
        const t = tail[i], k = (now - t.t0) / 0.9;
        t.bracket.mat.opacity = t.base * Math.max(0, 1 - k * 2.5);
        for (const c of t.counts) (c.mesh.material as THREE.MeshBasicMaterial).opacity = t.base * Math.max(0, 1 - Math.max(0, k - 0.4) / 0.6);
        if (k >= 1) { t.bracket.dispose(); for (const c of t.counts) c.dispose(); tail.splice(i, 1); }
      }
      // each count lands with a small settle (it grows from 70% with an ease-out)
      for (const list of [run?.counts ?? [], ...tail.map((t) => t.counts)]) for (const c of list) {
        const k = Math.min(1, (now - (c.mesh.userData.born as number)) / 0.22), h = c.mesh.userData.h as number;
        c.height(h * (0.7 + 0.3 * (1 - Math.pow(1 - k, 3))));
      }
      if (!run) return;
      const r = run, i = Math.min(r.steps.length - 1, Math.floor((now - r.t0) / r.step));
      if (i > r.shown) {
        for (let s = r.shown + 1; s <= i; s++) {
          const st = r.steps[s], box = st.box;
          r.bracket.group.visible = true;
          r.bracket.set(box, LOOK.scan.line * u, 0.1);
          // the count lands at the squad's leader (left of the squad), or over the ship for an each scan
          const c = inkText(fmt(st.count), { color: LOOK.scan.ink, weight: "500" });
          const h = (r.soft ? LOOK.scan.softPx : LOOK.scan.countPx) * u;
          c.height(h);
          if (r.kind === "squads") c.mesh.position.set(box.x - box.hx - 0.22 - (c.aspect * h) / 2, box.y, 0.8);
          else c.mesh.position.set(box.x, box.y + box.hy + 0.16 + h / 2, 0.8);
          c.mesh.userData.upright = true;
          c.mesh.userData.born = now;
          c.mesh.userData.h = h;
          (c.mesh.material as THREE.MeshBasicMaterial).opacity = r.soft ? LOOK.scan.soft : 1;
          fv.overlay.add(c.mesh);
          r.counts.push(c);
          r.said.push(st.count);
        }
        r.shown = i;
        if (!r.soft) hooks.caption((r.said.length > 8 ? "… " : "") + r.said.slice(-8).map(fmt).join(", "));
      }
      // the bracket keeps its hairline width as the camera eases
      if (r.shown >= 0) r.bracket.set(r.steps[r.shown].box, LOOK.scan.line * u, 0.1);
      if (now - r.t0 >= r.steps.length * r.step) end(false);
    },
  };
  return scan;
}
export type Scan = ReturnType<typeof createScan>;

/** Nova's caption when a scan's label settles. */
export const scanCaption = (kind: ScanKind, n: number) => (kind === "squads" ? `${fmt(n)} ${n === 1 ? "squad" : "squads"}.` : `${fmt(n)} in each squad.`);
