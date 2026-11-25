import * as THREE from "three";
import type { Stage } from "@/engine/stage";
import { PITCH, SQUAD_GAP, SQUAD_PITCH, type Box } from "../formation";
import { LOOK } from "../look";
import { fmt, type FleetView, type ShipView } from "./fleetView";
import { createBracket, inkText, type InkText } from "./ink";

/**
 * A miss, shown in the world. This is the teaching moment, so it is calm and exact:
 * - Too few: the survivors (gathered into true rows at the top left) are framed by a hairline bracket
 *   with their count, "12 left".
 * - Too many: the extra balls fizz out past the fleet in true rows (rows of b), and a bracket counts
 *   them, "5 too many". Way off: the balls stream past and only the true count is written.
 * No red, no flash: the bracket is the sky hint colour and the words are plain white.
 */
const circle = (() => {
  const pts = Array.from({ length: 33 }, (_, i) => { const a = (i / 32) * Math.PI * 2; return new THREE.Vector3(Math.cos(a), Math.sin(a), 0); });
  return new THREE.BufferGeometry().setFromPoints(pts);
})();

export function createMisses(stage: Stage, fv: FleetView, hooks: { unitsPerPx: () => number }) {
  const dotMat = new THREE.LineBasicMaterial({ color: LOOK.miss.color, transparent: true, opacity: 0.85, toneMapped: false });
  let bracket: ReturnType<typeof createBracket> | null = null, label: InkText | null = null, box: Box | null = null, below = true;
  let dots: THREE.Line[] = [];
  const clearOverlay = () => {
    bracket?.dispose(); bracket = null;
    label?.dispose(); label = null;
    for (const d of dots) d.removeFromParent();
    dots = [];
    box = null;
    delete fv.overlay.userData.extent;
  };
  /** Frame `b` with the bracket and write `text` beside it (below it, or above when `under` is false). */
  const frame = (b: Box, text: string, under: boolean) => {
    bracket?.dispose(); label?.dispose();
    box = b; below = under;
    bracket = createBracket(LOOK.miss.color);
    fv.overlay.add(bracket.group);
    label = inkText(text, { color: LOOK.miss.ink, weight: "500" });
    label.mesh.userData.born = stage.time;
    label.mesh.userData.upright = true;
    fv.overlay.add(label.mesh);
  };
  const top = () => (fv.layout && fv.layout.H > 0 ? fv.layout.H / 2 : fv.fh / fv.scale / 2);

  const misses = {
    /**
     * Where the extra balls fizz (formation units): true rows above the fleet, nearest row first, or null
     * when there are too many to draw honestly (way off): they stream past and only the label counts them.
     */
    extraSpots(extra: number, b: number): THREE.Vector3[] | null {
      const row = b >= 1 && b <= 12 ? b : 10;
      if (extra <= 0 || extra > Math.min(3 * row, 30)) return null;
      const lined = fv.layout && b <= 10 && fv.views.length && fv.views.every((v) => v.kind === "fighter");
      const xs = Array.from({ length: row }, (_, j) => (lined ? fv.views[j].home.x : (j - (row - 1) / 2) * PITCH));
      const y0 = top() + SQUAD_GAP + 0.55;
      return Array.from({ length: extra }, (_, i) => new THREE.Vector3(xs[i % row], y0 + Math.floor(i / row) * SQUAD_PITCH, 0));
    },
    /** An extra ball fizzed at `p` (formation units): it leaves a small hollow mark you can count. */
    dot(p: THREE.Vector3) {
      const d = new THREE.Line(circle, dotMat);
      d.position.copy(p).setZ(0.6);
      d.scale.setScalar(0.26);
      fv.overlay.add(d);
      dots.push(d);
      const ext = (fv.overlay.userData.extent as { x: number; y: number } | undefined) ?? { x: 0, y: 0 };
      fv.overlay.userData.extent = { x: Math.max(ext.x, Math.abs(p.x) + 0.5), y: Math.max(ext.y, p.y + 0.6) };
    },
    /** Too few: frame the survivors where they stand now, "12 left". */
    under(alive: ShipView[], remaining: number, gathered: boolean) {
      if (!alive.length) return;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      const p = new THREE.Vector3();
      for (const v of alive) {
        // where it is going, not where it is mid-glide
        p.copy(v.home).add(v.offset).add(v.shiftTo.lengthSq() || v.shiftT >= 0 ? v.shiftTo : v.shift);
        x0 = Math.min(x0, p.x - v.size.x / 2); x1 = Math.max(x1, p.x + v.size.x / 2); y0 = Math.min(y0, p.y - v.size.y / 2); y1 = Math.max(y1, p.y + v.size.y / 2);
      }
      frame({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, hx: (x1 - x0) / 2, hy: (y1 - y0) / 2 }, `${fmt(remaining)} left`, gathered);
    },
    /** Too many: frame the fizz marks (or the top of the empty fleet), "5 too many". */
    over(extra: number) {
      let bx: Box;
      if (dots.length) {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const d of dots) { x0 = Math.min(x0, d.position.x - 0.3); x1 = Math.max(x1, d.position.x + 0.3); y0 = Math.min(y0, d.position.y - 0.3); y1 = Math.max(y1, d.position.y + 0.3); }
        bx = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, hx: (x1 - x0) / 2, hy: (y1 - y0) / 2 };
      } else bx = { x: 0, y: top() - 0.4, hx: Math.max(1, (fv.layout?.W ?? 4) / 2), hy: 0.4 };
      frame(bx, `${fmt(extra)} too many`, true);
      if (!dots.length && bracket) bracket.group.visible = false;
    },
    /** The full fleet is back for the retry: the marks go. */
    clear: clearOverlay,
    update() {
      if (!box || !bracket || !label) return;
      const u = hooks.unitsPerPx(), k = Math.min(1, (stage.time - (label.mesh.userData.born as number)) / 0.25);
      const h = LOOK.miss.px * u * (0.8 + 0.2 * (1 - Math.pow(1 - k, 3)));
      bracket.set(box, LOOK.scan.line * u, 0.14);
      label.height(h);
      const w = label.aspect * h, lx = Math.max(box.x - box.hx + 0.12 + w / 2, -(fv.layout?.W ?? 0) / 2 + w / 2);
      label.mesh.position.set(lx, below ? box.y - box.hy - 0.3 - h / 2 : box.y + box.hy + 0.3 + h / 2, 0.8);
    },
    dispose() { clearOverlay(); dotMat.dispose(); },
  };
  return misses;
}
export type Misses = ReturnType<typeof createMisses>;
