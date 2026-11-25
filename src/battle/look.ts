import { COLOR, hex } from "@/design/tokens";

/**
 * The battle's current look, in one place. These are the exact values the battle drew before the
 * engine split (wave 1 changes no visuals), gathered here so the battle restyle (wave 2) swaps one
 * file for `src/design/tokens.ts` and `src/worlds/looks.ts` instead of hunting through systems.
 * Nothing else under `src/battle/` writes a raw colour.
 */
export const LOOK = {
  // the one void behind every screen (tokens.ts), so the route fade and the battle share a ground
  // background, exposure and bloom come from the `space` look (src/worlds/looks.ts); only the far plane is the battle's
  scene: { far: 3000 },
  light: {
    key: { color: 0xfff1dc, intensity: 1.6 },
    rim: { color: 0x7dfcff, intensity: 0.9 },
    fill: { sky: 0xc8d8ff, ground: 0x1a2244, intensity: 0.85 },
  },
  /** World labels (the holo component). */
  holo: { ink: COLOR.sky, bg: "rgba(7,7,10,0.78)", font: "Saira, ui-sans-serif, system-ui, sans-serif", weight: "600", pxH: 96 },
  /** Label inks on the fleet. */
  ink: { gold: "#fde68a", cyan: "#a5f3fc", amber: "#fcd34d", coral: "#ff8f70" },
  /** Plates behind groups of ships. */
  // `lime` is kept as a key for callers; it now draws in the cool sky of the hint colour
  tone: { cyan: 0x2fb7d6, amber: 0xf0a13a, gold: 0xf2c14e, coral: 0xff8f70, lime: hex(COLOR.sky) },
  plate: { opacity: 0.26, edge: 0.9, active: 0.42 },
  bracket: { color: hex(COLOR.sky) },
  rail: 0x3b4470,
  ghost: { color: 0x9fe8ff, fill: 0.12, outlineFill: 0.08 },
  // every glow stays under the space look's bloom threshold (1.0): only the Sun and the Launch moment glow
  laser: { color: 0xffd36b, intensity: 0.7 },
  shield: { color: 0x7dfcff, peak: 0.28 },
  dim: { color: 0x01030a, opacity: 0.62 },
  /** Balls that fly past (an overshoot). */
  over: { color: 0xff9a3c, intensity: 0.55 },
  /** Bright, but under the bloom threshold: a ball is a lit object, never a halo. */
  ball: { intensity: 0.55 },
  spark: [0.62, 0.55, 0.32, 0.75] as [number, number, number, number],
  zeroRing: { intensity: 0.6 },
  /** A soft label (a hint the player did not ask for). */
  soft: { opacity: 0.6 },
} as const;
export type Tone = keyof typeof LOOK.tone;
