/**
 * Tours: a spotlight on one control at a time, with one short line from Nova (review-round decision 8).
 * This file is the data and the pure parts: the tours, their seen keys, which steps can show, and
 * where the plate goes. The component is `Tour` in src/components/teach/Tour.tsx.
 * Where each tour sits in the first five minutes is in docs/teaching.md.
 */
import type { Box, Side } from "./guide";

/** The longest tour line, in words. */
export const TOUR_MAX_WORDS = 10;
/** The most steps a tour may have. */
export const TOUR_MAX_STEPS = 4;

/** One step: the `data-guide` anchor to light, and Nova's one line about it. */
export interface TourStep { anchor: string; line: string }

export const TOUR_IDS = ["bay", "battle", "map", "hangar", "academy"] as const;
export type TourId = (typeof TOUR_IDS)[number];

/** Seen key for a tour: recorded when its first step shows, so a skipped tour is still seen. */
export const tourKey = (id: string) => `tour:${id}`;

const s = (anchor: string, line: string): TourStep => ({ anchor, line });

/** The tours, one a screen. Words come from docs/glossary.md; one idea a step. */
export const TOURS: Record<TourId, TourStep[]> = {
  bay: [
    s("bay-launch", "Press Launch to fly your next mission."),
    s("bay-tables", "Your times tables. Dots fill in as you learn."),
    s("bay-places", "More places to visit."),
    s("orbs", "Orbs. You win them by learning."),
  ],
  battle: [
    s("powerups", "Power-Ups help with tricky fleets."),
    s("help", "Stuck? Nova shows you how."),
    s("dots", "Win these to clear the planet."),
    s("pause", "Need a break? Pause here."),
  ],
  map: [
    s("map-planet", "Each planet teaches new times tables."),
    s("map-next", "Swipe or tap for the next planet."),
    s("map-dots", "Your whole journey."),
    s("map-launch", "Launch when you are ready."),
  ],
  hangar: [
    s("hangar-list", "Looks for your rocket."),
    s("hangar-rocket", "Tap one to try it on."),
    s("hangar-buy", "Buy it with orbs."),
  ],
  academy: [
    s("academy-list", "Every trick, shown with real ships."),
  ],
};

/** The greeting screens that have a tour instead (a greeting stays only where there is no tour). */
export const TOURED_SCREENS: readonly string[] = ["bay", "map", "hangar", "academy"];

/**
 * The steps that can show, in order: those whose anchor is on screen now. `present` answers for one
 * anchor name. An empty result means the tour has nothing to show (and is not marked seen).
 */
export function liveSteps(steps: readonly TourStep[], present: (anchor: string) => boolean): TourStep[] {
  return steps.filter((st) => present(st.anchor));
}

/** The next step index after `from` whose anchor is present, or -1 when the tour is over. */
export function nextStep(steps: readonly TourStep[], from: number, present: (anchor: string) => boolean): number {
  for (let i = from + 1; i < steps.length; i++) if (present(steps[i].anchor)) return i;
  return -1;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Box, v: Box) => a.x >= v.x - 0.5 && a.y >= v.y - 0.5 && a.x + a.w <= v.x + v.w + 0.5 && a.y + a.h <= v.y + v.h + 0.5;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** The ring round a target: the target grown by `pad` on every side. */
export const ringOf = (t: Box, pad: number): Box => ({ x: t.x - pad, y: t.y - pad, w: t.w + pad * 2, h: t.h + pad * 2 });

/** The part of a box inside the view (a target taller than the screen is lit where it shows). */
export function clipTo(b: Box, v: Box): Box {
  const x = Math.max(b.x, v.x), y = Math.max(b.y, v.y);
  return { x, y, w: Math.max(0, Math.min(b.x + b.w, v.x + v.w) - x), h: Math.max(0, Math.min(b.y + b.h, v.y + v.h) - y) };
}

export interface PlatePlace extends Box { side: Side; fits: boolean }

/**
 * Where the plate goes beside a lit ring: below, above, right or left, in that order, the first that
 * keeps the whole plate inside `view` (the screen less its safe areas) and off the ring. Along the
 * side it slides to stay on screen, centred on the ring where it can. If no side has room (a ring as
 * big as the screen), it takes the side with the most room, still inside the view, and `fits` is false.
 */
export function placePlate(ring: Box, plate: { w: number; h: number }, view: Box, gap = 12): PlatePlace {
  const w = Math.min(plate.w, view.w), h = Math.min(plate.h, view.h);
  const cx = clamp(ring.x + ring.w / 2 - w / 2, view.x, view.x + view.w - w);
  const cy = clamp(ring.y + ring.h / 2 - h / 2, view.y, view.y + view.h - h);
  const at: Record<Side, Box> = {
    below: { x: cx, y: ring.y + ring.h + gap, w, h },
    above: { x: cx, y: ring.y - gap - h, w, h },
    right: { x: ring.x + ring.w + gap, y: cy, w, h },
    left: { x: ring.x - gap - w, y: cy, w, h },
  };
  for (const side of ["below", "above", "right", "left"] as Side[]) {
    const b = at[side];
    if (inside(b, view) && !overlaps(b, ring)) return { ...b, side, fits: true };
  }
  const room: Record<Side, number> = {
    below: view.y + view.h - (ring.y + ring.h), above: ring.y - view.y, right: view.x + view.w - (ring.x + ring.w), left: ring.x - view.x,
  };
  const side = (Object.keys(room) as Side[]).sort((a, b) => room[b] - room[a])[0];
  const b = at[side];
  return { x: clamp(b.x, view.x, view.x + view.w - w), y: clamp(b.y, view.y, view.y + view.h - h), w, h, side, fits: false };
}
