import { CARD, powerUpFits } from "@/rig/tricks";
import { doubleSide } from "./shared";
import type { PowerUp } from "./types";

/** Cut the 2 (or 4) side in half: each half is the fact for 1 (or 2). */
export const doubleIt: PowerUp = {
  id: "double-it", name: CARD["double-it"],
  fits: (a, b) => powerUpFits("double-it", a, b) && (Math.max(a, b) <= 10 || Math.min(a, b) <= 9),
  apply({ a, b, marks }) {
    const k = doubleSide(a, b);
    if (a === k) marks.split("row", k / 2); else marks.split("col", k / 2);
  },
  line: () => "pu_double",
};
