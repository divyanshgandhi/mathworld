import { audio } from "./audio";

/**
 * Live speech, on the device: Gradium Phonon compiled to WebAssembly (phonon-tts), running in a
 * Web Worker. Used for lines a clip cannot hold: the cadet's name, and Nova's lines with live numbers.
 * The package is served from /vendor/phonon-tts (copied there on install) and loaded natively, never
 * bundled and never on the server.
 */
export const VOICES = {
  Hadley: "bXwrkHhURL1VFJdG", // the Teacher
  Zoey: "NbpkqMVS3CJeq2j8", // Nova
  Miles: "d9XCyhjo4JhkHF1d", // the Captain
} as const;
export type VoiceName = keyof typeof VOICES;

interface Tts {
  sampleRate: number;
  addVoice(name: string, src: string): Promise<void>;
  synth(text: string, o?: { voice?: string }): Promise<Float32Array>;
}

let tts: Promise<Tts | null> | null = null;
const added = new Map<string, Promise<void>>();

/** Start downloading the model in the background (cached by the browser after the first visit). */
export function warmVoice(): Promise<Tts | null> {
  return (tts ??= (async () => {
    try {
      const url = "/vendor/phonon-tts/index.js";
      const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)) as { PhononTTS: { load(o: object): Promise<Tts> } };
      return await mod.PhononTTS.load({ lang: "en" });
    } catch (e) {
      console.warn("voice: live speech unavailable", e);
      return null;
    }
  })());
}

function ensure(t: Tts, v: VoiceName) {
  if (!added.has(v)) added.set(v, t.addVoice(v, `https://huggingface.co/gradium/phonon-voices/resolve/main/voices/${VOICES[v]}.safetensors`));
  return added.get(v)!;
}

/** Speak `text` as `voice` into an AudioBuffer, or null if live speech is not available. */
export async function synth(text: string, voice: VoiceName, timeoutMs = 6000): Promise<AudioBuffer | null> {
  const ctx = audio.context;
  if (!ctx) return null;
  const work = (async () => {
    const t = await warmVoice();
    if (!t) return null;
    await ensure(t, voice);
    const pcm = await t.synth(text, { voice });
    const buf = ctx.createBuffer(1, pcm.length, t.sampleRate);
    buf.getChannelData(0).set(pcm);
    return buf;
  })().catch(() => null);
  return Promise.race([work, new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]);
}

/** Prepare a line ahead of time; play it later with `audio.play(buffer)`. */
export const prepare = (text: string, voice: VoiceName) => synth(text, voice, 20_000);
