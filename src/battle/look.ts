import { COLOR, FONT, hex, LINE, MOTION } from "@/design/tokens";
import { LOOKS, tone } from "@/worlds/looks";
import { GHOST } from "@/worlds/space/ships";

/**
 * The battle's look, in one place, built only from `src/design/tokens.ts` and the `space` look in
 * `src/worlds/looks.ts` (its lights come from `lookLights`). Nothing else under `src/battle/` writes
 * a colour. The rules it keeps: one gold key, a cool rim, matte bodies; nothing in a battle crosses the
 * bloom threshold (only the Sun and the Launch moment glow); hints are sky, heat is ember, gold is
 * the key light and a leader's pennant.
 */
const space = LOOKS.space;
/** CSS colour with alpha from a token. */
const rgba = (c: string, a: number) => { const n = hex(c); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
/** A three.js hex number as a CSS colour (for canvas ink). */
const css = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export const LOOK = {
  // the one void behind every screen; background, exposure and bloom come from the `space` look; only the far plane is the battle's
  scene: { far: 3000 },
  /** The battle's three lights: the `space` look's key, rim and fill (see `lookLights`). */
  light: { key: space.key, rim: space.rim, fill: space.fill },
  /** World labels (the holo component): Saira on a near-void pill. */
  holo: { ink: COLOR.sky, bg: rgba(COLOR.void, 0.78), font: FONT.sans, weight: "600", pxH: 96 },
  /** Label inks on the fleet. */
  ink: { gold: COLOR.gold, cyan: COLOR.sky, amber: css(tone(COLOR.gold, COLOR.ember, 0.35)), coral: COLOR.ember, white: COLOR.approach },
  /** Plates behind groups of ships. `lime` and `cyan` are kept as keys for callers; both draw in the hint colour. */
  tone: { cyan: hex(COLOR.sky), amber: tone(COLOR.gold, COLOR.ember, 0.45), gold: hex(COLOR.gold), coral: hex(COLOR.ember), lime: hex(COLOR.sky) },
  plate: { opacity: 0.2, edge: 0.75, active: 0.36 },
  /** The structure hint: brackets, axis rules and scan counts. */
  bracket: { color: hex(COLOR.sky) },
  rail: tone(COLOR.horizon, COLOR.sky, 0.3),
  ghost: { color: GHOST.color, fill: 0.12, outlineFill: 0.08 },
  // every emissive stays under the space look's bloom threshold
  laser: { color: hex(COLOR.gold), intensity: 0.45 },
  shield: { color: hex(COLOR.sky), peak: 0.2 },
  dim: { color: hex(COLOR.void), opacity: 0.62 },
  /** Balls with nothing left to hit (an overshoot): the same ball, cooling to ember as it fizzes. */
  over: { color: hex(COLOR.ember), intensity: 0.45 },
  ball: { intensity: 0.45 },
  /** Kept for callers; kills now throw matte shards (see systems/kill.ts). */
  spark: [0.62, 0.55, 0.32, 0.75] as [number, number, number, number],
  zeroRing: { color: hex(COLOR.sky), intensity: 0 },
  /** A soft label (a hint the player did not ask for). */
  soft: { opacity: 0.6 },
  /** Scans: the lock-on bracket, its counts, and a soft (first-sight) scan's strength. */
  scan: { color: hex(COLOR.sky), ink: COLOR.sky, soft: 0.55, line: 1.5, countPx: 22, softPx: 18 },
  /** Misses in the world: the survivors' and the extras' brackets and their words. */
  miss: { color: hex(COLOR.sky), ink: COLOR.approach, px: 22 },
  /** The kill: a hairline ring and matte shards, gone within about a quarter second (shards drift on). */
  kill: { ring: hex(COLOR.approach), ringOpacity: 0.7, pennant: hex(COLOR.gold), shards: 6, maxShards: 320 },
  /** The number on the rocket's nose: the display voice in cool white. */
  charge: { ink: COLOR.approach, px: 40, pxPhone: 32, weight: "200" },
  /** A planet cleared: a gold hairline ring round its body. */
  clearRing: hex(COLOR.gold),
  /** A faint hairline for anything that only needs to be there (the lanes of an empty fleet). */
  hairline: LINE[2],
  /** Durations (seconds) from the motion tokens. */
  quick: MOTION.quick / 1000,
  moment: MOTION.moment / 1000,
} as const;
export type Tone = keyof typeof LOOK.tone;

/** The player asked for less motion: shorter beats, no hit-stop, no camera nudge, no warp streaks. */
let reduced: MediaQueryList | null = null;
export function reducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  reduced ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return reduced.matches;
}

/** Saira for canvas text: resolves once the face is ready (the font contract in DESIGN.md). */
let fontReady: Promise<unknown> | null = null;
export function sairaReady() {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  fontReady ??= Promise.all([document.fonts.load(`400 16px ${FONT.sans}`), document.fonts.load(`200 16px ${FONT.sans}`), document.fonts.load(`600 16px ${FONT.sans}`)]).catch(() => undefined);
  return fontReady;
}
