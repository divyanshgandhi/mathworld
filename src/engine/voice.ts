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
  synth(text: string, o?: { voice?: string; signal?: AbortSignal }): Promise<Float32Array>;
}

let tts: Promise<Tts | null> | null = null;
const added = new Map<string, Promise<void>>();

/**
 * Start downloading the model in the background (cached by the browser after the first visit), and
 * the voices that will speak live soon (Nova's for Show Me How), so the first live line is quick.
 */
export function warmVoice(voices: VoiceName[] = []): Promise<Tts | null> {
  const ready = load();
  for (const v of voices) void ready.then((t) => t && ensure(t, v).catch(() => {}));
  return ready;
}
function load(): Promise<Tts | null> {
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

/** Speak `text` as `voice` into an AudioBuffer, or null if live speech is not available (or aborted). */
export async function synth(text: string, voice: VoiceName, timeoutMs = 6000, signal?: AbortSignal): Promise<AudioBuffer | null> {
  const ctx = audio.context;
  if (!ctx) return null;
  const work = (async () => {
    const t = await warmVoice();
    if (!t) return null;
    await ensure(t, voice);
    if (signal?.aborted) return null;
    const pcm = await t.synth(text, { voice, signal });
    const buf = ctx.createBuffer(1, pcm.length, t.sampleRate);
    buf.getChannelData(0).set(pcm);
    return buf;
  })().catch(() => null);
  return Promise.race([work, new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]);
}

/** Prepare a line ahead of time; play it later with `audio.play(buffer)`. */
export const prepare = (text: string, voice: VoiceName) => synth(text, voice, 20_000);

/**
 * Lines with live numbers, synthesised once and kept: `line()` starts (or reuses) the speech for a
 * text, so asking early (predictive pre-fetch) makes it instant later. `drop()` aborts lines that
 * are no longer wanted (a lesson closed), so the worker stops spending time on them.
 */
const lines = new Map<string, { p: Promise<AudioBuffer | null>; ac: AbortController; done: boolean }>();
export function line(text: string, voice: VoiceName = "Zoey") {
  const key = `${voice}|${text}`;
  let e = lines.get(key);
  if (!e) {
    const ac = new AbortController();
    const entry: { p: Promise<AudioBuffer | null>; ac: AbortController; done: boolean } = { ac, done: false, p: Promise.resolve(null) };
    entry.p = synth(text, voice, 20_000, ac.signal).then((buf) => { entry.done = true; if (!buf && lines.get(key) === entry) lines.delete(key); return buf; });
    lines.set(key, (e = entry));
  }
  return e.p;
}
/** Is this line already spoken into a buffer? */
export const lineReady = (text: string, voice: VoiceName = "Zoey") => !!lines.get(`${voice}|${text}`)?.done;
export function drop(texts: string[], voice: VoiceName = "Zoey") {
  for (const t of texts) {
    const key = `${voice}|${t}`, e = lines.get(key);
    if (e && !e.done) { e.ac.abort(); lines.delete(key); }
  }
}
