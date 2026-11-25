import type { Sfx } from "@/engine/audio";
import type { Bus } from "./bus";

/**
 * Sound cues: every battle sound comes from a bus event. Shots and bursts are throttled on the stage
 * clock so a 45-ball volley is a rattle, not a roar.
 */
export const SOUND = {
  wave_started: "flyby", resolved_exact: "clear", battle_done: "clear", regroup: "shield", extras: "flyby",
  launch: { sfx: "shot", every: 0.06 }, hit: { sfx: "tick", every: 0.035 }, last: "burst",
} as const;

/**
 * The hit tick steps up in pitch along a squad (`step`), so a squad sounds like counting; the last ship
 * of the fleet lands with the bigger burst. Mute is the audio engine's (its master gain), so it holds here.
 */
export function attachSound(bus: Bus, play: (s: Sfx, o?: { step?: number }) => void) {
  let shotAt = -1, burstAt = -1;
  const offs = [
    bus.on("wave_started", () => play(SOUND.wave_started)),
    bus.on("launch", (p) => { if (p.extra) return; if (p.t - shotAt > SOUND.launch.every) { play(SOUND.launch.sfx); shotAt = p.t; } }),
    bus.on("hit", (p) => {
      if (p.last) { play(SOUND.last); burstAt = p.t; return; }
      if (p.t - burstAt > SOUND.hit.every) { play(SOUND.hit.sfx, { step: p.step ?? 0 }); burstAt = p.t; }
    }),
    bus.on("resolved", (p) => { if (p.correct) play(SOUND.resolved_exact); }),
    bus.on("regroup", () => play(SOUND.regroup)),
    bus.on("battle_done", (p) => { if (p.kind !== "academy") play(SOUND.battle_done); }),
    bus.on("cue", (p) => play(p.sfx)),
  ];
  return () => offs.forEach((off) => off());
}
