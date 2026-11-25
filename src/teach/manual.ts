import { manualKey } from "./keys";

/**
 * The Field Manual ("How to play"): six pages, each one picture and a line or two at child size.
 * The pictures are live scenes made from the game's own ship art (src/components/teach/ManualScenes.tsx),
 * laid out as true arrays (src/teach/scenes.ts). Opening a page records `manual:<page>` as seen.
 */
export const MANUAL_PAGES = [
  {
    id: "squads",
    name: "Squads",
    lines: ["Ships fly in squads. Each row is one squad."],
    scene: { kind: "squads", squads: 3, each: 4 },
  },
  {
    id: "count",
    name: "Count",
    lines: ["Count them. Type the number."],
    scene: { kind: "count", squads: 3, each: 4 },
  },
  {
    id: "fire",
    name: "Fire",
    lines: ["Press Fire. One plasma ball for each ship."],
    scene: { kind: "fire", squads: 2, each: 3 },
  },
  {
    id: "miss",
    name: "Too few or too many",
    lines: ["Too few and some get away. Too many and some fly past.", "Just try again."],
    scene: { kind: "miss", squads: 2, each: 3, under: 4, over: 8 },
  },
  {
    id: "help",
    name: "Show Me How and Power-Ups",
    lines: ["Stuck? Press Show Me How.", "Power-Ups change the shape so it is easier to count."],
    scene: { kind: "flip", squads: 6, each: 2 },
  },
  {
    id: "orbs",
    name: "Orbs and Gold",
    lines: ["First-try answers earn orbs. Facts you know in a flash turn Gold."],
    scene: { kind: "reward", squads: 3, each: 4 },
  },
] as const;

export type ManualPage = (typeof MANUAL_PAGES)[number];
export type ManualTopic = ManualPage["id"];
export type ManualScene = ManualPage["scene"];

export const MANUAL_TOPICS: ManualTopic[] = MANUAL_PAGES.map((p) => p.id);

/** The page index (from 0) a topic opens on. An unknown topic opens the first page. */
export function pageOf(topic: string | null | undefined): number {
  const i = MANUAL_PAGES.findIndex((p) => p.id === topic);
  return i < 0 ? 0 : i;
}

export const manualPageKey = (page: ManualTopic) => manualKey(page);
