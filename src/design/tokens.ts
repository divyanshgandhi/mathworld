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

/* ---- Added by the kit track (additions only; nothing above is renamed or removed) ---- */

/** Font stacks. `sans` is the one game face; `code` is only for the adult /admin dashboard. */
export const FONT = {
  sans: `"${TYPE.family}", system-ui, sans-serif`,
  code: `ui-monospace, "SF Mono", Menlo, Consolas, monospace`,
} as const;

/** Fills between the void and a panel: the hover/pressed inside of a pill, and a hovered tile. */
export const FILL = {
  /** The inside of a primary pill when hovered or pressed. */
  lift: "#10121c",
  /** A hovered or opened tile on the void (shadow at 55%). */
  raised: "rgba(26,31,51,0.55)",
  /** A sheet's fill when it floats over a 3D scene (panel at 92%). */
  sheet: "rgba(10,12,20,0.92)",
  /** The scrim behind a modal sheet. */
  scrim: "rgba(7,7,10,0.72)",
} as const;

/**
 * The type scale in px. Every step is at or above its voice's minimum in `TYPE.min`:
 * labels never go under 13, body never under 16, and anything a child must read is 17 or more.
 */
export const SIZE = {
  "label-sm": 13,
  label: 15,
  "body-sm": 16,
  body: 17,
  child: 19,
  title: 26,
  display: 56,
} as const;

/** The colours a cadet can pick at sign-up (none is the invaders' green). */
export const CADET = {
  "cadet-1": COLOR.sky,
  "cadet-2": COLOR.gold,
  "cadet-3": COLOR.ember,
  "cadet-4": COLOR.approach,
  "cadet-5": "#b59cff",
  "cadet-6": "#f07a95",
} as const;
export type CadetColor = keyof typeof CADET;

/**
 * Every design value as a CSS custom property, in the exact form globals.css declares it.
 * `tests/design-tokens.test.ts` fails if the stylesheet and this map ever disagree.
 * Names in Tailwind 4 theme namespaces (`--color-*`, `--radius-*`, `--font-*`, `--ease-*`,
 * `--transition-duration-*`, `--text-*`) also generate utilities: `bg-void`, `text-ink-2`,
 * `border-line-1`, `rounded-panel`, `ease-out`, `duration-route`, `text-body`.
 */
export const CSS_VARS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(COLOR).map(([k, v]) => [`--color-${k}`, v])),
  ...Object.fromEntries(Object.entries(INK).map(([k, v]) => [`--color-ink-${k}`, v])),
  ...Object.fromEntries(Object.entries(LINE).map(([k, v]) => [`--color-line-${k}`, v])),
  ...Object.fromEntries(Object.entries(FILL).map(([k, v]) => [`--color-${k}`, v])),
  ...Object.fromEntries(Object.entries(MASTERY).map(([k, v]) => [`--color-mastery-${k}`, v.color])),
  ...Object.fromEntries(Object.entries(RADIUS).map(([k, v]) => [`--radius-${k}`, `${v}px`])),
  ...Object.fromEntries(Object.entries(SIZE).map(([k, v]) => [`--text-${k}`, `${v}px`])),
  "--text-xs": `${TYPE.min.label}px`,
  "--font-sans": FONT.sans,
  "--font-mono": FONT.sans,
  "--font-code": FONT.code,
  "--ease-out": MOTION.ease,
  "--default-transition-timing-function": MOTION.ease,
  "--default-transition-duration": `${MOTION.quick}ms`,
  "--transition-duration-quick": `${MOTION.quick}ms`,
  "--transition-duration-route": `${MOTION.route}ms`,
  "--transition-duration-moment": `${MOTION.moment}ms`,
  "--edge-rest": EDGE.rest,
  "--edge-hot": EDGE.hot,
};
