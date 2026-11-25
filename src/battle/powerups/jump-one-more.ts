import { CARD, powerUpFits } from "@/rig/tricks";
import { jumpSplit } from "./shared";
import type { PowerUp } from "./types";

export const jumpOneMore: PowerUp = {
  id: "jump-one-more", name: CARD["jump-one-more"],
  fits: (a, b) => powerUpFits("jump-one-more", a, b) && (Math.max(a, b) <= 10 || Math.min(a, b) <= 9),
  apply: ({ a, b, marks }) => void jumpSplit(marks, a, b),
  line: () => "pu_jump",
};
