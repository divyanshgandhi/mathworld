import type { UPGRADE_SLOTS } from "@/db/events";

/**
 * The Hangar catalogue (SPEC §2.6): three slots, a free starter in each, and Orb prices for the rest.
 * Pure data, so the fold can charge the real price whatever a client sends. Ids match the styles
 * in src/worlds/space/ships.ts (HULLS, BLASTERS, THRUSTERS).
 */
export type Slot = (typeof UPGRADE_SLOTS)[number];
export interface Item { id: string; name: string; cost: number; blurb: string }

export const CATALOG: Record<Slot, Item[]> = {
  hull: [
    { id: "cadet-white", name: "Cadet White", cost: 0, blurb: "Fresh from the academy" },
    { id: "solar-gold", name: "Solar Gold", cost: 30, blurb: "Shines like the Sun" },
    { id: "nebula-violet", name: "Nebula Violet", cost: 60, blurb: "Painted in deep space" },
    { id: "obsidian-stealth", name: "Obsidian Stealth", cost: 100, blurb: "Dark hull, cyan trim" },
  ],
  blaster: [
    { id: "plasma-ball", name: "Plasma Ball", cost: 0, blurb: "One bright ball a shot" },
    { id: "twin-plasma", name: "Twin Plasma", cost: 35, blurb: "Two balls, side by side" },
    { id: "ion-arc", name: "Ion Arc", cost: 70, blurb: "Long cyan bolts" },
    { id: "nova-beam", name: "Nova Beam", cost: 110, blurb: "Lime streaks of light" },
  ],
  thruster: [
    { id: "amber-flame", name: "Amber Flame", cost: 0, blurb: "The classic burn" },
    { id: "cyan-ion", name: "Cyan Ion", cost: 40, blurb: "A cool blue jet" },
    { id: "starlight-comet", name: "Starlight Comet", cost: 80, blurb: "A violet comet tail" },
  ],
};
export const SLOT_NAMES: Record<Slot, string> = { hull: "Hull Paint", blaster: "Blaster FX", thruster: "Thruster Trail" };
export const STARTER: Record<Slot, string> = { hull: "cadet-white", blaster: "plasma-ball", thruster: "amber-flame" };

export const itemOf = (slot: Slot, id: string) => CATALOG[slot].find((i) => i.id === id) ?? null;

/** What an item costs this cadet now: nothing if it is a starter or already owned. Null: no such item. */
export function priceFor(slot: Slot, id: string, owned: readonly string[]): number | null {
  const item = itemOf(slot, id);
  if (!item) return null;
  return item.cost === 0 || owned.includes(`${slot}:${id}`) ? 0 : item.cost;
}

/**
 * The event that buys (or re-equips) an item, or null when it cannot: unknown item, already
 * equipped, or not enough Orbs. The fold applies the same rule, so a bad event changes nothing.
 */
export function purchase(state: { orbs: number; owned: string[]; equipped: Partial<Record<Slot, string>> }, slot: Slot, id: string) {
  const cost = priceFor(slot, id, state.owned);
  if (cost === null || cost > state.orbs) return null;
  if ((state.equipped[slot] ?? STARTER[slot]) === id) return null;
  return { type: "upgrade_purchased" as const, payload: { slot, itemId: id, cost } };
}
