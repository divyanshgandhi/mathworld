import type { UPGRADE_SLOTS } from "@/db/events";
import { PLANETS_BY_TIER, tierOfPlanet, type PlanetId } from "@/rig/pools";

/**
 * The Hangar catalogue: what orbs buy. Looks only, never power (OVERHAUL.md); tricks are free and
 * never sold. Pure data, so the fold charges the real price and checks the unlock whatever a client
 * sends. Ids match the styles in src/worlds/space/ships.ts (HULLS, BLASTERS, THRUSTERS).
 *
 * Adding a thing is adding one entry to ITEMS (and its style in ships.ts). A new slot is one entry in
 * SLOTS plus its id in UPGRADE_SLOTS (src/db/events.ts). Prices come from the earning rate: see
 * docs/overhaul/w2-economy.md.
 */
export type Slot = (typeof UPGRADE_SLOTS)[number];

/** How a swatch draws in the shop: CSS colours built from token variables only. */
export interface Swatch { kind: "paint" | "ball" | "flame"; main: string; second: string; shape?: "one" | "twin" | "bolt" | "beam" | "short" | "long" | "comet" }

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  /** Orbs. 0 is a starter: every cadet has it from the first day. */
  cost: number;
  /** One plain line. */
  blurb: string;
  /** Progress that opens it: a planet whose mission must be cleared (or jumped past with Gold) first. */
  unlock?: { cleared: PlanetId };
  swatch: Swatch;
}

const v = (name: string) => `var(--color-${name})`;
const mixed = (a: string, b: string, pct: number) => `color-mix(in oklab, ${v(a)}, ${v(b)} ${pct}%)`;

/** The registry: one entry per thing a cadet can put on their rocket. Starters first in each slot. */
export const ITEMS: Item[] = [
  // ---- Paint ----
  { id: "cadet-white", slot: "hull", name: "Cadet White", cost: 0, blurb: "Your first paint, fresh from the hangar", swatch: { kind: "paint", main: v("approach"), second: v("sky") } },
  { id: "solar-gold", slot: "hull", name: "Solar Gold", cost: 30, blurb: "Gold all over, like the Sun", swatch: { kind: "paint", main: v("gold"), second: v("ember") } },
  { id: "nebula-violet", slot: "hull", name: "Nebula Violet", cost: 100, blurb: "Deep purple with gold trim", unlock: { cleared: "moon" }, swatch: { kind: "paint", main: mixed("disk", "recede", 22), second: v("gold") } },
  { id: "obsidian-stealth", slot: "hull", name: "Obsidian Stealth", cost: 160, blurb: "Almost black, with sky-blue trim", unlock: { cleared: "mars" }, swatch: { kind: "paint", main: v("horizon"), second: v("sky") } },
  // ---- Blasters ----
  { id: "plasma-ball", slot: "blaster", name: "Plasma Ball", cost: 0, blurb: "One white ball for every ship", swatch: { kind: "ball", main: v("approach"), second: v("approach"), shape: "one" } },
  { id: "twin-plasma", slot: "blaster", name: "Twin Plasma", cost: 60, blurb: "Two small blue balls side by side", swatch: { kind: "ball", main: v("sky"), second: v("sky"), shape: "twin" } },
  { id: "ion-arc", slot: "blaster", name: "Ion Arc", cost: 120, blurb: "Long blue bolts", unlock: { cleared: "moon" }, swatch: { kind: "ball", main: mixed("sky", "disk", 35), second: v("sky"), shape: "bolt" } },
  { id: "nova-beam", slot: "blaster", name: "Nova Beam", cost: 200, blurb: "Thin gold streaks of light", unlock: { cleared: "asteroid-belt" }, swatch: { kind: "ball", main: v("gold"), second: v("gold"), shape: "beam" } },
  // ---- Thrusters ----
  { id: "amber-flame", slot: "thruster", name: "Amber Flame", cost: 0, blurb: "A short orange flame", swatch: { kind: "flame", main: v("ember"), second: v("gold"), shape: "short" } },
  { id: "cyan-ion", slot: "thruster", name: "Cyan Ion", cost: 80, blurb: "A long, cool blue jet", swatch: { kind: "flame", main: v("sky"), second: v("approach"), shape: "long" } },
  { id: "starlight-comet", slot: "thruster", name: "Starlight Comet", cost: 140, blurb: "A white comet tail with gold sparks", unlock: { cleared: "mars" }, swatch: { kind: "flame", main: v("approach"), second: v("gold"), shape: "comet" } },
];

/** The slots, in tab order, with their one-word names (three tabs fit one row on any screen). */
export const SLOTS: { id: Slot; name: string }[] = [
  { id: "hull", name: "Paint" },
  { id: "blaster", name: "Blasters" },
  { id: "thruster", name: "Thrusters" },
];

/** The catalogue by slot (read from ITEMS). */
export const CATALOG: Record<Slot, Item[]> = Object.fromEntries(SLOTS.map((s) => [s.id, ITEMS.filter((i) => i.slot === s.id)])) as Record<Slot, Item[]>;
export const SLOT_NAMES: Record<Slot, string> = Object.fromEntries(SLOTS.map((s) => [s.id, s.name])) as Record<Slot, string>;
/** Each slot's starter: the first free item. */
export const STARTER: Record<Slot, string> = Object.fromEntries(SLOTS.map((s) => [s.id, CATALOG[s.id].find((i) => i.cost === 0)!.id])) as Record<Slot, string>;

export const itemOf = (slot: Slot, id: string) => CATALOG[slot].find((i) => i.id === id) ?? null;

/** What the fold knows about progress, for unlocks. */
interface Progress { cleared: number[]; aceCleared: number[] }

/** The planet's name as it reads in a sentence ("Clear the Moon first"). */
export const PLANET_IN_A_SENTENCE: Record<PlanetId, string> = {
  earth: "Earth", moon: "the Moon", mars: "Mars", "asteroid-belt": "the Asteroid Belt", jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", "deep-space": "Deep Space",
};

/** Whether this cadet's progress has opened the item. */
export function isUnlocked(item: Item, s: Progress) {
  if (!item.unlock) return true;
  const t = tierOfPlanet(item.unlock.cleared);
  return s.cleared.includes(t) || s.aceCleared.includes(t);
}
/** "Clear Mars first", or null when the item is open. */
export function lockedWords(item: Item, s: Progress) {
  return isUnlocked(item, s) ? null : `Clear ${PLANET_IN_A_SENTENCE[item.unlock!.cleared]} first`;
}

/** What an item costs this cadet now: nothing if it is a starter or already owned. Null: no such item. */
export function priceFor(slot: Slot, id: string, owned: readonly string[]): number | null {
  const item = itemOf(slot, id);
  if (!item) return null;
  return item.cost === 0 || owned.includes(`${slot}:${id}`) ? 0 : item.cost;
}

type ShopState = Progress & { orbs: number; owned: string[]; equipped: Partial<Record<Slot, string>> };

/**
 * The event that buys (or re-equips) an item, or null when it cannot: unknown item, still locked,
 * already equipped, or not enough orbs. The fold applies the same rule, so a bad event changes nothing.
 */
export function purchase(state: ShopState, slot: Slot, id: string) {
  const item = itemOf(slot, id), cost = priceFor(slot, id, state.owned);
  if (!item || cost === null || cost > state.orbs) return null;
  if (cost > 0 && !isUnlocked(item, state)) return null;
  if ((state.equipped[slot] ?? STARTER[slot]) === id) return null;
  return { type: "upgrade_purchased" as const, payload: { slot, itemId: id, cost } };
}

/** One item as the shop shows it to this cadet. */
export type ItemState =
  | { kind: "equipped" }
  | { kind: "owned" }
  | { kind: "price"; cost: number; short: number }
  | { kind: "locked"; words: string };
export function itemState(state: ShopState, item: Item): ItemState {
  if ((state.equipped[item.slot] ?? STARTER[item.slot]) === item.id) return { kind: "equipped" };
  const cost = priceFor(item.slot, item.id, state.owned) ?? item.cost;
  if (cost === 0) return { kind: "owned" };
  const words = lockedWords(item, state);
  if (words) return { kind: "locked", words };
  return { kind: "price", cost, short: Math.max(0, cost - state.orbs) };
}

/**
 * The next goal the shop points at: the cheapest look not owned yet that the cadet can work towards
 * now (open, or opened by the next planet). Null when everything is owned.
 */
export function nextGoal(state: ShopState): Item | null {
  const left = ITEMS.filter((i) => i.cost > 0 && !state.owned.includes(`${i.slot}:${i.id}`));
  const open = left.filter((i) => isUnlocked(i, state)).sort((a, b) => a.cost - b.cost);
  if (open.length) return open[0];
  const byPlanet = left.sort((a, b) => tierOfPlanet(a.unlock!.cleared) - tierOfPlanet(b.unlock!.cleared) || a.cost - b.cost);
  return byPlanet[0] ?? null;
}

export const PLANETS_WITH_UNLOCKS = [...new Set(ITEMS.flatMap((i) => (i.unlock ? [i.unlock.cleared] : [])))].sort((a, b) => PLANETS_BY_TIER.indexOf(a) - PLANETS_BY_TIER.indexOf(b));
