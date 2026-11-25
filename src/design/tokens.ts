/**
 * Void and Gold: the one source of design values for the 2D UI and the 3D worlds (see OVERHAUL.md).
 * CSS variables, the Tailwind theme and three.js colours are all derived from this file.
 * Nothing else in the codebase writes a raw colour, font or duration.
 */
export const COLOR = {
  /** The one background, on every screen, 2D and 3D. */
  void: "#07070a",
  /** A rare raised surface (a sheet, an opened panel). */
  panel: "#0a0c14",
  /** Night side of a planet, pressed and hovered fills. */
  shadow: "#1a1f33",
  /** Dividers on raised surfaces. */
  horizon: "#2b2f3d",
  /** Primary ink: a cool white. */
  approach: "#e6f1ff",
  /** The cool rim light; Nova's colour; the "Learning" mark. */
  sky: "#8fb4ec",
  /** Deep cool: the cold end of the action edge. */
  disk: "#4a79bb",
  /** The key light; Gold mastery; orbs; focus rings. */
  gold: "#ffc857",
  /** Heat: exhaust, a miss, the warm end of the action edge. */
  ember: "#ff6a3d",
  /** The hottest end of the action edge. */
  recede: "#ff3e1f",
} as const;
export type ColorName = keyof typeof COLOR;

/** Ink at three strengths on the void. `2` is body text, `3` is the quietest text that still passes contrast. */
export const INK = { 1: COLOR.approach, 2: "rgba(230,241,255,0.78)", 3: "rgba(230,241,255,0.55)" } as const;
/** Hairlines on the void, quiet to strong. */
export const LINE = { 1: "rgba(230,241,255,0.14)", 2: "rgba(230,241,255,0.24)", 3: "rgba(230,241,255,0.5)" } as const;

/** The primary action's edge: cool to hot at rest, gold when hovered or armed. */
export const EDGE = {
  rest: `linear-gradient(90deg, ${COLOR.sky} 0%, ${COLOR.disk} 38%, #c2473a 72%, ${COLOR.recede} 100%)`,
  hot: `linear-gradient(90deg, #ffe2a1, ${COLOR.gold} 45%, ${COLOR.ember})`,
} as const;

/** Mastery, in the words and marks the player sees. Internal bands map onto these. */
export const MASTERY = {
  gold: { word: "Gold", mark: "filled", color: COLOR.gold },
  got: { word: "Got it", mark: "filled", color: COLOR.approach },
  learn: { word: "Learning", mark: "outline", color: COLOR.sky },
  new: { word: "New", mark: "dim", color: "rgba(230,241,255,0.18)" },
} as const;
export type MasteryKey = keyof typeof MASTERY;

/** One family, three voices. `stretch` is the font-stretch percentage of the variable width axis. */
export const TYPE = {
  family: "Saira",
  display: { weight: 200, stretch: 125, tracking: "0.03em", upper: true },
  label: { weight: 500, stretch: 115, tracking: "0.18em", upper: true },
  body: { weight: 400, stretch: 100, tracking: "0", upper: false },
  /** Minimum sizes in px: anything a child must read, ordinary body, and the smallest label. */
  min: { child: 17, body: 16, label: 13 },
} as const;

export const RADIUS = { panel: 16, chip: 14, pill: 999 } as const;

/** Durations in ms and the one easing curve. */
export const MOTION = {
  ease: "cubic-bezier(0.16, 1, 0.3, 1)",
  quick: 180,
  route: 240,
  moment: 1100,
} as const;

/** A token colour as a three.js hex number. */
export const hex = (c: string) => parseInt(c.slice(1), 16);
