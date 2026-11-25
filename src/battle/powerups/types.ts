import type { Fleet } from "@/rig/fleet";
import type { TrickId } from "@/rig/tricks";
import type { LineId } from "@/worlds/space/lines";
import type { FleetView } from "../systems/fleetView";
import type { Marks } from "../systems/marks";

/** What a Power-Up can touch when it acts on the live fleet. */
export interface PowerUpCtx {
  a: number; b: number;
  has: (n: number) => boolean;
  fleet: Fleet;
  fv: FleetView;
  marks: Marks;
  /** Stage time now. */
  time: number;
  /** This wave cracks Battle Sectors (multi-digit × multi-digit). */
  sectorLock: boolean;
  /** Big & Small Split may enter Sector-Lock (false when a lesson borrows the visual). */
  lockMode: boolean;
  /** Turn the fleet a quarter (Flip It!). */
  flip: () => void;
  enterSectorLock: () => void;
}

/**
 * A Power-Up (a trick, free and unlimited): it reshapes the live fleet and never reveals the answer.
 * Adding one is adding a file in this folder and a line in `index.ts`.
 */
export interface PowerUp {
  id: TrickId;
  /** The card name the cadet sees. */
  name: string;
  /** Can this Power-Up act on an a × b fleet? Always within `powerUpFits` (src/rig/tricks.ts). */
  fits: (a: number, b: number) => boolean;
  /** Keeps the marks already on the fleet (Flip It! only turns it). */
  keepsMarks?: boolean;
  apply: (ctx: PowerUpCtx) => void;
  /** Nova's line when it is used. */
  line: (ctx: { a: number; b: number; sectorLock: boolean; fv: FleetView }) => LineId;
}
