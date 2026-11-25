import { MOTION } from "@/design/tokens";
import type { Stage } from "@/engine/stage";
import { eachScan, scanTiming, squadScan, type ScanStep } from "../formation";
import { LOOK, reducedMotion } from "../look";
import { createBracket, inkText, type InkText } from "./ink";
import { fmt, type FleetView } from "./fleetView";
import { COUNT_PX, eachCountAt, squadCountAt } from "../lanes";

/**
 * Scans: how the battle teaches structure without printing it (OVERHAUL.md, review round decisions 1-3).
 * Nothing runs before a miss. A scan counts one thing at a time:
 * - Squad scan (after miss 1): a hairline lock-on bracket frames one squad, top to bottom, and ONE
 *   number shows in the left lane beside it (1, then 2 …); the number before it goes. After the last
 *   squad, a short beat with nothing new, then `done` runs and the "7 squads" label lands in that lane.
 * - Each scan (after miss 2, or miss 1 on a 1 x n fleet): the same along the first squad, ship by ship,
 *   one number at a time in the top lane, then "8 in each squad".
 * About 0.4 s a step, 4 s at most (src/battle/formation.ts, `scanTiming`); typing or firing skips to the
 * end. No captions: the number in the lane is the only voice while it counts, and the label says the total.
 * Every count is the true count; a shape a scan cannot step truthfully gets the plain label at once.
 */
export type ScanKind = "squads" | "each";

export interface ScanHooks {
  /** Formation units per CSS pixel right now (so counts and hairlines keep their size on screen). */
  unitsPerPx: () => number;
  /** Nova's caption (null: let it go). Not used by the scan any more (one voice at a time). */
  caption: (text: string | null) => void;
}

export function createScan(stage: Stage, fv: FleetView, hooks: ScanHooks) {
  let run: {
    kind: ScanKind; steps: ScanStep[]; t0: number; step: number; settle: number; shown: number;
    done: (() => void) | null; count: InkText | null; bracket: ReturnType<typeof createBracket>; counted: boolean;
  } | null = null;
  const tail: { t0: number; bracket: ReturnType<typeof createBracket> }[] = [];

  /** The label lands (`done`), and the bracket fades (now, or at once after a skip). */
  function end(skipped: boolean) {
    if (!run) return;
    const r = run;
    run = null;
    r.count?.dispose();
    r.done?.();
    if (skipped) { r.bracket.dispose(); return; }
    tail.push({ t0: stage.time, bracket: r.bracket });
  }

  /** One number, in its lane (formation units: the lanes are in fleet world units, divided by the fleet's scale). */
  function place(r: NonNullable<typeof run>, st: ScanStep, u: number) {
    const k = fv.scale || 1, c = r.count!, h = COUNT_PX * u, w = c.aspect * h;
    const at = r.kind === "squads"
      ? squadCountAt(fv.fw, st.box.y * k, w * k, h * k)
      : eachCountAt(fv.fh, st.box.x * k, w * k, h * k);
    c.height(h);
    c.mesh.position.set(at.x / k, at.y / k, 0.8);
  }

  const scan = {
    get active() { return !!run; },
    /**
     * Start a scan. `done` runs when its label should land (after the last count and a beat, on a skip,
     * or at once when there is nothing truthful to step through). Returns false when it showed the label at once.
     */
    start(kind: ScanKind, a: number, b: number, done: () => void, o: { soft?: boolean } = {}) {
      void o;
      scan.skip();
      const l = fv.layout, steps = !l || fv.flipped ? null : kind === "squads" ? squadScan(l, a, b) : eachScan(l, b);
      if (!steps || !steps.length) { done(); return false; }
      const t = scanTiming(steps.length, { max: reducedMotion() ? 2.4 : 4 });
      const bracket = createBracket(LOOK.scan.color);
      bracket.group.visible = false;
      fv.overlay.add(bracket.group);
      run = { kind, steps, t0: stage.time, step: t.step, settle: t.settle, shown: -1, done, count: null, bracket, counted: false };
      return true;
    },
    /** Typing or firing: jump to the end (the label is shown; the marks go). */
    skip() { if (run) end(true); },
    /** A new fleet: everything goes, no label. */
    reset() {
      if (run) { run.done = null; end(true); }
      for (const t of tail) t.bracket.dispose();
      tail.length = 0;
    },
    /** Dev: what the scan shows now (the one number, which step), for the playfield review route. */
    debug() { return run ? { kind: run.kind, step: run.shown, of: run.steps.length, number: run.count?.text ?? null } : null; },
    update() {
      const now = stage.time, u = hooks.unitsPerPx();
      for (let i = tail.length - 1; i >= 0; i--) {
        const t = tail[i], k = (now - t.t0) / (MOTION.route / 1000);
        t.bracket.mat.opacity = Math.max(0, 1 - k);
        if (k >= 1) { t.bracket.dispose(); tail.splice(i, 1); }
      }
      if (!run) return;
      const r = run, el = now - r.t0, n = r.steps.length;
      if (el >= n * r.step) {
        // the last count goes, the bracket lets go: a short beat with nothing new, then the label
        if (!r.counted) { r.counted = true; r.count?.dispose(); r.count = null; r.bracket.mat.opacity = 0.35; }
        if (el >= n * r.step + r.settle) end(false);
        return;
      }
      const i = Math.min(n - 1, Math.floor(el / r.step));
      if (i !== r.shown) {
        r.shown = i;
        const st = r.steps[i];
        r.bracket.group.visible = true;
        // one number at a time: the one before it goes
        r.count?.dispose();
        r.count = inkText(fmt(st.count), { color: LOOK.scan.ink, weight: "500" });
        r.count.mesh.userData.upright = true;
        r.count.mesh.userData.born = now;
        fv.overlay.add(r.count.mesh);
      }
      const st = r.steps[r.shown];
      if (r.count) {
        // the number lands with a small settle (from 80% with an ease-out), then holds still
        const k = Math.min(1, (now - (r.count.mesh.userData.born as number)) / (MOTION.quick / 1000));
        place(r, st, u * (0.8 + 0.2 * (1 - Math.pow(1 - k, 3))));
      }
      // the bracket keeps its hairline width as the camera eases
      r.bracket.set(st.box, LOOK.scan.line * u, 0.1);
    },
  };
  return scan;
}
export type Scan = ReturnType<typeof createScan>;

/** Nova's caption when a scan's label settles. */
export const scanCaption = (kind: ScanKind, n: number) => (kind === "squads" ? `${fmt(n)} ${n === 1 ? "squad" : "squads"}.` : `${fmt(n)} in each squad.`);
