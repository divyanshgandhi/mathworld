import * as THREE from "three";
import { CARD, powerUpFits } from "@/rig/tricks";
import { fmt } from "../systems/fleetView";
import type { PowerUp } from "./types";

/** Squads light up one at a time with a running total; the last one stays a question. */
export const fastAdding: PowerUp = {
  id: "fast-adding", name: CARD["fast-adding"],
  fits: (a, b) => powerUpFits("fast-adding", a, b) && a <= 9 && a >= 2,
  apply({ a, b, fv, marks, time }) {
    fv.rowPulse = { rows: a, t0: time };
    for (let r = 0; r < a; r++) {
      const row = fv.views.filter((v) => v.gRow === r);
      if (!row.length) continue;
      const xMax = Math.max(...row.map((v) => v.home.x + v.size.x / 2));
      marks.tag(r === a - 1 ? "+ ?" : fmt((r + 1) * b), new THREE.Vector3(xMax + 0.95, row[0].home.y, 0)).visible = false;
    }
  },
  line: () => "pu_fast",
};
