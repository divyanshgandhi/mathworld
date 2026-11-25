import type { TrickId } from "@/rig/tricks";
import { bigSmallSplit } from "./big-small-split";
import { borrowTakeBack } from "./borrow-take-back";
import { doubleIt } from "./double-it";
import { easy510 } from "./easy-5-10";
import { emptyMirror } from "./empty-mirror";
import { fastAdding } from "./fast-adding";
import { flipIt } from "./flip-it";
import { halfDouble } from "./half-double";
import { jumpOneMore } from "./jump-one-more";
import { splitAndAdd } from "./split-and-add";
import type { PowerUp } from "./types";

export type { PowerUp, PowerUpCtx } from "./types";

/** Every Power-Up, by trick id. */
export const POWERUPS: Record<TrickId, PowerUp> = {
  "empty-mirror": emptyMirror, "fast-adding": fastAdding, "flip-it": flipIt, "double-it": doubleIt, "easy-5-10": easy510,
  "jump-one-more": jumpOneMore, "split-and-add": splitAndAdd, "borrow-take-back": borrowTakeBack, "big-small-split": bigSmallSplit, "half-double": halfDouble,
};
/** Can this Power-Up act on this fleet in the battle? */
export const fitsPowerUp = (t: TrickId, a: number, b: number) => POWERUPS[t].fits(a, b);
/** The Power-Ups that fit an a × b fleet, in belt order. */
export const fittingPowerUps = (ids: readonly TrickId[], a: number, b: number) => ids.filter((t) => fitsPowerUp(t, a, b));
