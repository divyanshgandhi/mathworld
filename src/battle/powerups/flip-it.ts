import { CARD, powerUpFits } from "@/rig/tricks";
import type { PowerUp } from "./types";

/** The fleet turns a quarter: 8 squads of 3 become 3 squads of 8. */
export const flipIt: PowerUp = {
  id: "flip-it", name: CARD["flip-it"],
  fits: (a, b) => powerUpFits("flip-it", a, b),
  keepsMarks: true,
  apply: ({ flip }) => flip(),
  line: () => "pu_flip",
};
