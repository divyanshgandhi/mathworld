import { CARD, powerUpFits } from "@/rig/tricks";
import type { PowerUp } from "./types";

/** Slice between the place-value bands: big ships on one side, small on the other. Multi-digit × multi-digit: Sector-Lock. */
export const bigSmallSplit: PowerUp = {
  id: "big-small-split", name: CARD["big-small-split"],
  fits: (a, b) => powerUpFits("big-small-split", a, b),
  apply({ marks, sectorLock, lockMode, enterSectorLock }) {
    marks.bands({ plates: true });
    if (sectorLock && lockMode) enterSectorLock();
  },
  line: ({ sectorLock }) => (sectorLock ? "pu_sector" : "pu_bigsmall"),
};
