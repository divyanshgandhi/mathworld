import * as THREE from "three";
import { CARD, powerUpFits } from "@/rig/tricks";
import { LOOK } from "../look";
import type { PowerUp } from "./types";

export const emptyMirror: PowerUp = {
  id: "empty-mirror", name: CARD["empty-mirror"],
  fits: (a, b) => powerUpFits("empty-mirror", a, b),
  apply({ a, b, fv, marks }) {
    if (a === 0 || b === 0) { fv.zeroRing.scale.setScalar(1.3); return; }
    marks.plate(fv.views, "cyan");
    marks.tag("mirror", new THREE.Vector3(0, marks.axisTop(), 0), LOOK.ink.cyan);
  },
  line: () => "pu_mirror",
};
