import * as THREE from "three";
import { CARD, powerUpFits } from "@/rig/tricks";
import { LOOK } from "../look";
import { PITCH } from "../systems/fleetView";
import type { PowerUp } from "./types";

/** ×10: the pods glow in turn. ×5: the twin 5 shows as ghosts, so each squad reads as half of a 10. */
export const easy510: PowerUp = {
  id: "easy-5-10", name: CARD["easy-5-10"],
  fits: (a, b) => powerUpFits("easy-5-10", a, b),
  apply({ b, has, fv, marks, time }) {
    if (has(10) || fv.views.some((v) => v.kind === "pod")) {
      const pods = fv.views.filter((v) => v.kind !== "fighter");
      marks.plate(pods, "gold");
      fv.pulses = pods.map((v, i) => ({ v, t0: time + i * 0.12 }));
      return;
    }
    if (b === 5) for (const v of fv.views.filter((x) => x.gCol === 4)) for (let c = 1; c <= 5; c++) marks.ghostAt(v.home.clone().add(new THREE.Vector3(c * PITCH, 0, 0)));
    else for (const v of fv.views.filter((x) => x.gRow === 4)) for (let r = 1; r <= 5; r++) marks.ghostAt(v.home.clone().add(new THREE.Vector3(0, -r * PITCH, 0)));
    marks.plate(fv.views, "cyan", fv.ghosts);
    marks.tag("half of 10", new THREE.Vector3(0, marks.axisTop(), 0), LOOK.ink.cyan);
  },
  line: ({ a, b, fv }) => (!(a === 10 || b === 10 || fv.views.some((v) => v.kind !== "fighter")) ? "pu_easy5" : "pu_easy"),
};
