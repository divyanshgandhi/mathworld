import { audio } from "@/engine/audio";
import { createBeatPlayer } from "@/engine/beatPlayer";
import type { Overlay } from "@/engine/overlay";
import { BATTLE_LINES } from "@/worlds/space/lines";
import { COMBAT_LINES } from "./lines";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Captions-only pace when no voice clip is ready. */
export const readTime = (text: string) => 0.7 + text.split(/\s+/).length * 0.24;

/**
 * Nova's (and the Captain's) voice in a battle: one short line at a time, always captioned, and the
 * shared Beat Player for Show Me How (baked clip, else live Phonon, else captions only).
 * `teaching()`: Show Me How is on, so reactions stay quiet (the HUD already shows the outcome).
 */
export function createVoice(overlay: Overlay, teaching: () => boolean) {
  let voiceUntil = 0, captionTimer = 0;
  const lineText = (id: string) => audio.text(id) || (BATTLE_LINES as Record<string, string>)[id] || (COMBAT_LINES as Record<string, string>)[id] || "";
  const player = createBeatPlayer({ caption: (who, text) => { window.clearTimeout(captionTimer); overlay.caption(who, text); } });
  return {
    player,
    /**
     * One line. Never cuts off a line that is still being spoken: a reaction that arrives while she
     * talks is dropped; `queue` waits instead; `interrupt` (the cadet's own press) cuts in. Resolves when the words stop plus a short breath.
     */
    async say(id: string, { queue = false, speaker = "Nova", interrupt = false } = {}) {
      if (teaching() && !queue) return;
      const now = performance.now();
      // `interrupt`: the cadet's own action (a Power-Up) speaks over the line before it
      if (interrupt) { audio.stopVoice(); voiceUntil = 0; }
      if (now < voiceUntil) { if (!queue) return; await wait(voiceUntil - now); }
      const text = lineText(id);
      if (!text) return;
      overlay.caption(speaker, text);
      const clip = audio.manifest[id];
      const len = clip ? audio.spoken(id) : readTime(text);
      voiceUntil = performance.now() + len * 1000 + 250;
      if (clip) void audio.say(id);
      window.clearTimeout(captionTimer);
      captionTimer = window.setTimeout(() => overlay.caption("", ""), len * 1000 + 900);
      await wait(len * 1000 + 250);
    },
    /**
     * A caption with no voice (a scan counting along). It holds Nova's place while it shows, so a
     * reaction does not talk over it; `null` lets it go.
     */
    caption(text: string | null, holdMs = 1400) {
      window.clearTimeout(captionTimer);
      if (text === null) { overlay.caption("", ""); voiceUntil = 0; return; }
      overlay.caption("Nova", text);
      voiceUntil = performance.now() + Math.min(holdMs, 400);
      captionTimer = window.setTimeout(() => overlay.caption("", ""), holdMs);
    },
    /** Silence: the caption goes and the next line may start at once. */
    hush() {
      window.clearTimeout(captionTimer);
      overlay.caption("", "");
      voiceUntil = 0;
    },
  };
}
export type Voice = ReturnType<typeof createVoice>;
