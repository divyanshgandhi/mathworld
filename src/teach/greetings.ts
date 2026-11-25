import { greetKey } from "./keys";

/**
 * Nova's first-visit greetings: one short line per screen, shown once (seen key `greet:<screen>`).
 * Each line says what this place is for and the one thing to do here. Captions first: the ids are
 * the voice ids to bake later (see "Lines to bake" in docs/overhaul/w2-manual.md).
 */
export const GREET_SCREENS = ["bay", "map", "hangar", "academy", "flashcards", "battle"] as const;
export type GreetScreen = (typeof GREET_SCREENS)[number];

export interface GreetLine { screen: GreetScreen; key: string; id: string; text: string; where: string }

const line = (screen: GreetScreen, text: string, where: string): GreetLine => ({ screen, key: greetKey(screen), id: `nova_greet_${screen}`, text, where });

export const GREETINGS: Record<GreetScreen, GreetLine> = {
  bay: line("bay", "This is your Resting Bay. Press Launch to fly.", "Resting Bay (/bay)"),
  map: line("map", "Tap a planet. Win there to open the next one.", "Star map (/map)"),
  hangar: line("hangar", "Spend your orbs here to change how your rocket looks.", "Hangar (/hangar)"),
  academy: line("academy", "Pick a trick. I will show it on real ships.", "Academy (/academy)"),
  flashcards: line("flashcards", "Type the answer. There is no timer, so take your time.", "Flashcards (over the Resting Bay)"),
  battle: line("battle", "Welcome to Cadet Bay! Let's clear these ships.", "The first battle (Cadet Bay, end of /intro)"),
};
