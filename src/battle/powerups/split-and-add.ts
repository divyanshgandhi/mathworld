import { CARD, powerUpFits } from "@/rig/tricks";
import { splitFive } from "./shared";
import type { PowerUp } from "./types";

/** Cut the long side after 5: a 5-fact and a small fact. A side of 10 is ten real ships, so it cuts too. */
export const splitAndAdd: PowerUp = {
  id: "split-and-add", name: CARD["split-and-add"],
  fits: (a, b) => powerUpFits("split-and-add", a, b),
  apply: ({ a, b, marks }) => void splitFive(marks, a, b),
  line: () => "pu_split",
};
