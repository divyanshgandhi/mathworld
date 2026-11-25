/**
 * The ship sprite kinds and their boxes, without three.js, so 2D components can size a placeholder
 * without pulling the 3D builders into their bundle (the bake itself is src/worlds/shipSprites.ts).
 */
export type ShipKind = "rocket" | "invader" | "leader" | "pod" | "ball";
export const SHIP_KINDS: ShipKind[] = ["rocket", "invader", "leader", "pod", "ball"];
export type ShipTone = "ember" | "apricot";

/** The sprite's box for a size: square, except the ten pod, which is a wide tray. */
export function shipSpriteBox(kind: ShipKind, sizePx: number) {
  return kind === "pod" ? { w: sizePx, h: Math.round(sizePx * 0.42) } : { w: sizePx, h: sizePx };
}

export const SHIP_ALT: Record<ShipKind, string> = {
  rocket: "Your rocket", invader: "A ship", leader: "A squad leader", pod: "A pod of ten ships", ball: "A plasma ball",
};

/**
 * The battle's squad styling (`squadStyle` in src/worlds/space/ships.ts), repeated here without three.js:
 * squads alternate ember and apricot, and the first ship of a squad is its leader.
 * tests/teach.test.ts proves the two always agree.
 */
export function squadLook(squad: number, index: number): { tone: ShipTone; leader: boolean } {
  return { tone: ((squad % 2) + 2) % 2 === 0 ? "ember" : "apricot", leader: index === 0 };
}
