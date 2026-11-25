import type { Mood } from "@/engine/audio";
import type { PlanetId } from "@/rig/pools";

/**
 * One planet's battle theme, as data. The arena reads `mood`, `briefing` and `clear`; `backdrop` and
 * `ground` describe what the sky (src/worlds/space/skies.ts) draws for this planet today, so the
 * worlds restyle can drive the sky from here instead of from its own table.
 */
export interface PlanetTheme {
  id: PlanetId;
  /** What hangs behind the fleet. */
  backdrop: { body: PlanetId | "none"; ring?: boolean; rocks?: boolean; nebula?: boolean; earthBehind?: boolean };
  /** A planet surface along the bottom of the frame, under the cannon. */
  ground: "surface" | "none";
  /** The music mood while fighting here. */
  mood: Mood;
  /** Line ids (a baked clip in the audio manifest, else a key of BATTLE_LINES in lines.ts). */
  /** Nova's line as the first fleet of a mission flies in. */
  briefing: string;
  /** Nova's line when the planet is clear. */
  clear: string;
  /** Cadet Bay only: Nova's welcome on the very first wave, and its own closing line. */
  intro?: string;
  introClear?: string;
}
