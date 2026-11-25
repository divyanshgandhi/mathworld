import * as THREE from "three";
import { CARD, powerUpFits } from "@/rig/tricks";
import { LOOK } from "../look";
import { fmt, GAP } from "../systems/fleetView";
import type { PowerUp } from "./types";

/**
 * One ghost after the last ship of the 9s band, in every row (or column), the same class as the ship
 * beside it: each squad (or each column) becomes a round number, 19 × 24 → 20 × 24 − 24.
 */
export const borrowTakeBack: PowerUp = {
  id: "borrow-take-back", name: CARD["borrow-take-back"],
  fits: (a, b) => powerUpFits("borrow-take-back", a, b) && (a % 10 === 9 || b % 10 === 9),
  apply({ a, b, fleet: f, fv, marks }) {
    if (b % 10 === 9) {
      const unitsBand = f.colParts.length - 1, inBand = fv.views.filter((v) => f.sectors[v.ship.sector].colBand === unitsBand);
      const lastCol = Math.max(...inBand.map((v) => v.ship.col));
      for (const v of inBand.filter((x) => x.ship.col === lastCol)) marks.ghostAt(v.home.clone().add(new THREE.Vector3(v.size.x + GAP, 0, 0)), v);
      marks.tag(`${fmt(b + 1)} each`, new THREE.Vector3(0, marks.axisTop(), 0), LOOK.ink.cyan);
    } else {
      const unitsBand = f.rowParts.length - 1, inBand = fv.views.filter((v) => f.sectors[v.ship.sector].rowBand === unitsBand);
      const lastRow = Math.max(...inBand.map((v) => v.ship.row));
      for (const v of inBand.filter((x) => x.ship.row === lastRow)) marks.ghostAt(v.home.clone().add(new THREE.Vector3(0, -(v.size.y + GAP), 0)), v);
      marks.tag(`${fmt(a + 1)} squads`, new THREE.Vector3(marks.axisLeft(), 0, 0), LOOK.ink.cyan, true);
    }
    marks.plate(fv.views, "cyan", fv.ghosts);
  },
  line: () => "pu_borrow",
};
