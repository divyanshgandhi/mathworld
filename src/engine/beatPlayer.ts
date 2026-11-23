import { BREATH, lineKey, speechSeconds } from "@/rig/showme";
import { audio } from "./audio";
import { drop, line, type VoiceName } from "./voice";

/**
 * The one Beat Player (SPEC §4.4): plays a list of beats, each a visual move and at most one line.
 * Used by in-battle Show Me How now and by the Academy films later.
 *
 * Voice, in two layers (SPEC §6): a baked Phonon clip when one has the same words, otherwise live
 * Phonon (voice.ts, pre-fetched while the cadet thinks), otherwise the caption alone, paced on
 * reading time. A beat waits for the words to stop plus a breath, so a line never cuts itself off.
 * `cancel()` stops everything at once: the voice, the caption, the waits, and any line still being
 * synthesised, so nothing from a closed lesson can start late over what comes next.
 */
export interface PlayBeat { caption: string; speech: string; hold: number }

export interface BeatPlayerOpts {
  speaker?: string;
  voice?: VoiceName;
  caption: (speaker: string, text: string) => void;
  breath?: number;
  /** How long to wait for a live line that is not ready yet before going on with the caption alone. */
  patience?: number;
}

export function createBeatPlayer(o: BeatPlayerOpts) {
  const speaker = o.speaker ?? "Nova", voice = o.voice ?? "Zoey", breath = o.breath ?? BREATH, patience = o.patience ?? 1.5;
  let run = 0, playing = false, slow = false, wanted: string[] = [];
  /** Where each spoken line came from (checked in the browser: is the voice really heard?). */
  const stats = { baked: 0, live: 0, captions: 0 };
  /** Pending waits: each one resolves false at once if the run is cancelled. */
  const waits = new Set<() => void>();
  /** Resolves true after `sec`, or false as soon as this run is cancelled. */
  const sleep = (sec: number, id: number) => new Promise<boolean>((r) => {
    const stop = () => { window.clearTimeout(t); waits.delete(stop); r(false); };
    const t = window.setTimeout(() => { waits.delete(stop); r(run === id); }, Math.max(0, sec * 1000));
    waits.add(stop);
  });
  const baked = (speech: string) => audio.clipFor(speech, lineKey);

  /** Start speaking lines ahead of time (Beat 1 while the cadet is still thinking). */
  function prefetch(speeches: string[]) {
    for (const s of speeches) if (s && !baked(s)) { void line(s, voice); if (!wanted.includes(s)) wanted.push(s); }
  }

  /**
   * Play the beats in order. `onBeat` draws beat i's visual move as it starts; `onLine` reports the
   * seconds until its words stop (0 for a silent beat). Resolves true when the last line has been said,
   * false if cancelled.
   */
  async function play<B extends PlayBeat>(beats: B[], onBeat: (b: B, i: number) => void, onLine?: (sec: number) => void) {
    stop();
    const id = ++run;
    playing = true;
    prefetch(beats.map((b) => b.speech));
    for (let i = 0; i < beats.length; i++) {
      if (run !== id) return false;
      const b = beats[i], last = i === beats.length - 1;
      onBeat(b, i);
      if (!b.speech) { onLine?.(0); if (!(await sleep(b.hold, id))) return false; continue; }
      let len: number;
      const clip = baked(b.speech);
      if (clip) {
        o.caption(speaker, b.caption);
        len = audio.spoken(clip, 0.4 + speechSeconds(b.speech));
        stats.baked++;
        void audio.say(clip, () => run === id);
      } else {
        // wait a moment for live speech; once it has missed a line, stop making the cadet wait
        const buf = await Promise.race([line(b.speech, voice), sleep(slow ? 0.15 : patience, id).then(() => null)]);
        if (run !== id) return false;
        slow = !buf;
        o.caption(speaker, b.caption);
        if (buf) { void audio.play(buf); len = audio.spokenLength(buf); stats.live++; } else { len = 0.4 + speechSeconds(b.speech); stats.captions++; }
      }
      onLine?.(len);
      if (!(await sleep(len + (last ? 0 : breath), id))) return false;
    }
    if (run === id) playing = false;
    return run === id;
  }

  /** End the current run: voice, caption and pending waits (pre-fetched lines are kept). */
  function stop() {
    run++;
    if (playing) { audio.stopVoice(); o.caption("", ""); }
    playing = false;
    for (const w of [...waits]) w();
  }
  /** Stop at once, and abort lines still being synthesised for this lesson. */
  function cancel() {
    stop();
    drop(wanted, voice);
    wanted = [];
  }

  return {
    play, prefetch, cancel, stop, stats,
    /** A line is being spoken or a beat is holding. */
    get playing() { return playing; },
    /** Live speech has been too slow this session: lessons are paced on captions instead. */
    get slow() { return slow; },
  };
}
export type BeatPlayer = ReturnType<typeof createBeatPlayer>;
