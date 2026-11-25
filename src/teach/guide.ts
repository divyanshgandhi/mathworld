import { readMs } from "./words";

/**
 * The guided first shot, as a pure state machine. The FirstShotGuide component feeds it the battle's
 * ui and bus events and draws the step it is on. Three steps, one idea each:
 *
 *   count  rings the fleet          "Count the ships."
 *   type   points at the keypad     "Type how many."     (after the count line's reading time)
 *   fire   points at Fire           "Now press Fire."    (on the first digit; back to `type` if cleared)
 *
 * The shot itself hides it (`flying`), and once that shot resolves it is `done` for good.
 * While Show Me How runs, or the keypad is not live, it steps aside (`away`) and comes back at `type`.
 */
export type GuideStep = "wait" | "count" | "type" | "fire" | "away" | "flying" | "done";

export const GUIDE_LINES = {
  count: { id: "nova_guide_count", text: "Count the ships.", anchor: "fleet" },
  type: { id: "nova_guide_type", text: "Type how many.", anchor: "keypad" },
  fire: { id: "nova_guide_fire", text: "Now press Fire.", anchor: "fire" },
} as const;
export type GuideAnchor = (typeof GUIDE_LINES)[keyof typeof GUIDE_LINES]["anchor"];

export interface GuideState { step: GuideStep; since: number; typed: boolean }
export const GUIDE_START: GuideState = { step: "wait", since: 0, typed: false };

/** What the guide needs from the battle's ArenaUi. */
export interface GuideUi { wave: unknown | null; canFire: boolean; lesson: unknown | null; done: unknown | null; offer: unknown | null }

export type GuideEvent =
  | { type: "ui"; ui: GuideUi | null; now: number }
  | { type: "charge"; n: number | null; now: number }
  | { type: "fire"; now: number }
  | { type: "resolved"; now: number }
  | { type: "tick"; now: number };

/** How long "Count the ships." stays before the keypad step: its reading time. */
export const COUNT_MS = readMs(GUIDE_LINES.count.text);

const live = (ui: GuideUi | null) => !!ui && !!ui.wave && ui.canFire && !ui.lesson && !ui.done && !ui.offer;
const to = (s: GuideState, step: GuideStep, now: number): GuideState => (s.step === step ? s : { ...s, step, since: now });

export function guideStep(s: GuideState, e: GuideEvent): GuideState {
  if (s.step === "done") return s;
  switch (e.type) {
    case "ui": {
      if (s.step === "flying") return s;
      if (!live(e.ui)) return s.step === "wait" ? s : to(s, "away", e.now);
      if (s.step === "wait") return to(s, s.typed ? "fire" : "count", e.now);
      if (s.step === "away") return to(s, s.typed ? "fire" : "type", e.now);
      return s;
    }
    case "charge": {
      const typed = e.n !== null;
      const next = { ...s, typed };
      if (s.step === "count" || s.step === "type") return typed ? to(next, "fire", e.now) : next;
      if (s.step === "fire") return typed ? next : to(next, "type", e.now);
      return next;
    }
    case "fire": return to(s, "flying", e.now);
    case "resolved": return to(s, "done", e.now);
    case "tick": return s.step === "count" && e.now - s.since >= COUNT_MS ? to(s, "type", e.now) : s;
  }
}

/** The line and anchor for a step, or null when nothing shows. */
export function guideShows(step: GuideStep) {
  return step === "count" || step === "type" || step === "fire" ? GUIDE_LINES[step] : null;
}

/* ---------- placing the caption beside the thing it points at ---------- */

export interface Box { x: number; y: number; w: number; h: number }
export type Side = "above" | "below" | "left" | "right";

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Box, v: Box) => a.x >= v.x && a.y >= v.y && a.x + a.w <= v.x + v.w && a.y + a.h <= v.y + v.h;

/**
 * Where a caption of `size` goes next to `anchor`: the first side in `prefer` where it fits on screen
 * (`view`, already inset by a margin) without touching the anchor or any box in `avoid`. It is centred
 * on the anchor along that side and slid along to stay on screen. If no side fits, it takes the side
 * with the most room, still clear of the anchor itself, so it never covers the control it points at.
 */
export function placeCaption(anchor: Box, size: { w: number; h: number }, view: Box, avoid: Box[] = [], prefer: Side[] = ["above", "below", "left", "right"], gap = 14): { box: Box; side: Side } {
  const at = (side: Side): Box => {
    const cx = anchor.x + anchor.w / 2 - size.w / 2, cy = anchor.y + anchor.h / 2 - size.h / 2;
    const slideX = (x: number) => Math.max(view.x, Math.min(view.x + view.w - size.w, x));
    const slideY = (y: number) => Math.max(view.y, Math.min(view.y + view.h - size.h, y));
    switch (side) {
      case "above": return { x: slideX(cx), y: anchor.y - gap - size.h, ...size };
      case "below": return { x: slideX(cx), y: anchor.y + anchor.h + gap, ...size };
      case "left": return { x: anchor.x - gap - size.w, y: slideY(cy), ...size };
      case "right": return { x: anchor.x + anchor.w + gap, y: slideY(cy), ...size };
    }
  };
  for (const side of prefer) {
    const box = at(side);
    if (inside(box, view) && !overlaps(box, anchor) && !avoid.some((a) => overlaps(box, a))) return { box, side };
  }
  const room: Record<Side, number> = {
    above: anchor.y - view.y, below: view.y + view.h - (anchor.y + anchor.h), left: anchor.x - view.x, right: view.x + view.w - (anchor.x + anchor.w),
  };
  const side = (Object.keys(room) as Side[]).sort((a, b) => room[b] - room[a])[0];
  return { box: at(side), side };
}

/**
 * Where the fleet is when the battle does not say: the free part of the screen, which is where the
 * arena frames the fleet (the console reports its footprint with `setSafe`). Below the question and
 * above a bottom dock on a phone; below the question and left of a side dock on a wide screen.
 * Null when it cannot tell (no question or no keypad on screen), so the guide shows nothing.
 */
export function freeArea(view: Box, question: Box | null, keypad: Box | null, margin = 16): Box | null {
  if (!question || !keypad) return null;
  const top = question.y + question.h + margin;
  const bottomDock = keypad.y > view.y + view.h * 0.45;
  const area = bottomDock
    ? { x: view.x + margin, y: top, w: view.w - margin * 2, h: keypad.y - margin - top }
    : { x: view.x + margin, y: top, w: keypad.x - margin * 2 - view.x, h: view.y + view.h - margin - top };
  return area.w >= 80 && area.h >= 80 ? area : null;
}
