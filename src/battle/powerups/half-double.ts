import { CARD, powerUpFits } from "@/rig/tricks";
import type { PowerUp } from "./types";

/** The battle draws Half & Double on the place-value bands; the lesson shows the reshape. */
export const halfDouble: PowerUp = {
  id: "half-double", name: CARD["half-double"],
  fits: (a, b) => powerUpFits("half-double", a, b),
  apply: ({ marks }) => marks.bands({ plates: true }),
  line: () => "pu_half",
};
