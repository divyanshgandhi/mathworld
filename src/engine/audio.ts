/**
 * Sound: baked Gradium Phonon voice clips (public/vo, see scripts/bake-voices.py), live Phonon speech
 * from voice.ts, a voice analyser that drives lip-sync, mood music beds and synthesised effects.
 * One voice at a time: a new line always stops the last, so lines never overlap.
 */
/** `end` is where the speech stops, before the clip's trailing silence (measured at bake time). */
export interface Clip { voice: string; text: string; duration: number; end?: number; src: string }
export type Mood = "space" | "classroom" | "heroic" | "hangar" | "battle";
export type Sfx = "dive" | "chime" | "knock" | "door" | "blip_ok" | "blip_close" | "fanfare" | "nova_chirp" | "ignition" | "yawn" | "shot" | "burst" | "flyby" | "shield" | "clear";

class SoundEngine {
  manifest: Record<string, Clip> = {};
  muted = false;
  speaking = false;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private analyser!: AnalyserNode;
  private wave!: Uint8Array<ArrayBuffer>;
  private buffers = new Map<string, AudioBuffer>();
  private voice: AudioBufferSourceNode | null = null;
  private bed: { gain: GainNode; nodes: OscillatorNode[] } | null = null;
  private lvl = 0;
  private ready: Promise<void> | null = null;

  /** Fetch the clip list (safe before any user gesture). */
  preload() {
    return (this.ready ??= fetch("/vo/vo.json").then((r) => (r.ok ? r.json() : {})).then((m) => void (this.manifest = m)).catch(() => {}));
  }

  /** Create the audio graph; call from a click (browsers need a gesture). Starts decoding every clip. */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.wave = new Uint8Array(this.analyser.fftSize);
      this.analyser.connect(this.master);
    }
    void this.ctx.resume();
    void this.preload().then(() => { for (const id of Object.keys(this.manifest)) void this.load(id); });
    return this.ctx;
  }

  get context() { return this.ctx; }

  private async load(id: string) {
    if (this.buffers.has(id) || !this.ctx) return this.buffers.get(id);
    const clip = this.manifest[id];
    if (!clip) return undefined;
    try {
      const buf = await this.ctx.decodeAudioData(await (await fetch(clip.src)).arrayBuffer());
      this.buffers.set(id, buf);
      return buf;
    } catch { return undefined; }
  }

  duration(id: string, fallback = 3) { return this.manifest[id]?.duration ?? fallback; }
  /** Seconds until the words stop: pace pauses on this, not on the padded file length. */
  spoken(id: string, fallback = 3) { const c = this.manifest[id]; return c ? (c.end ?? c.duration) : fallback; }
  /** The same for live speech: the time of the last sample above a whisper. */
  spokenLength(buf: AudioBuffer) {
    const d = buf.getChannelData(0);
    let i = d.length - 1;
    while (i > 0 && Math.abs(d[i]) < 0.012) i--;
    return Math.min(buf.duration, i / buf.sampleRate + 0.05);
  }
  text(id: string) { return this.manifest[id]?.text ?? ""; }

  stopVoice() {
    try { this.voice?.stop(); } catch { /* already stopped */ }
    this.voice = null;
    this.speaking = false;
  }

  /** Play a baked line. Resolves when it ends (or at once if muted or missing). */
  async say(id: string) {
    await this.preload();
    const buf = this.ctx && !this.muted ? await this.load(id) : undefined;
    return buf ? this.play(buf) : undefined;
  }

  /** Play live speech (an AudioBuffer from voice.ts) through the same lip-sync path. */
  play(buf: AudioBuffer) {
    this.stopVoice();
    if (!this.ctx || this.muted) return Promise.resolve();
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = buf;
    g.gain.value = 1.15;
    src.connect(g).connect(this.analyser);
    this.voice = src;
    this.speaking = true;
    return new Promise<void>((done) => {
      src.onended = () => { if (this.voice === src) { this.voice = null; this.speaking = false; } done(); };
      src.start();
    });
  }

  /** 0..1 loudness of the voice right now, smoothed: drives mouths, Nova's light and caption bars. */
  level() {
    if (!this.speaking || !this.ctx) return (this.lvl *= 0.8);
    this.analyser.getByteTimeDomainData(this.wave);
    let sum = 0;
    for (const v of this.wave) { const n = (v - 128) / 128; sum += n * n; }
    this.lvl += (Math.min(1, Math.sqrt(sum / this.wave.length) * 5.2) - this.lvl) * 0.45;
    return this.lvl;
  }

  /** Cross-fade the music bed. */
  mood(m: Mood) {
    const a = this.ctx;
    if (!a || this.muted) return;
    const t = a.currentTime;
    if (this.bed) {
      const old = this.bed;
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setTargetAtTime(0.0001, t, 0.35);
      setTimeout(() => old.nodes.forEach((n) => { try { n.stop(); } catch { /* stopped */ } }), 1600);
    }
    const BEDS: Record<Mood, { f: number[]; vol: number; cut: number }> = {
      space: { f: [65.41, 130.81, 196.0, 293.66], vol: 0.085, cut: 520 },
      classroom: { f: [110, 164.81], vol: 0.025, cut: 240 },
      heroic: { f: [73.42, 146.83, 220.0, 293.66, 369.99], vol: 0.095, cut: 980 },
      hangar: { f: [82.41, 164.81, 246.94, 329.63, 415.3], vol: 0.09, cut: 1100 },
      battle: { f: [55, 110, 164.81, 220], vol: 0.06, cut: 700 },
    };
    const b = BEDS[m], gain = a.createGain(), filter = a.createBiquadFilter();
    gain.gain.setValueAtTime(0.0001, t);
    gain.connect(this.master);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(b.cut, t);
    filter.connect(gain);
    const nodes = b.f.map((f, i) => {
      const o = a.createOscillator();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.setValueAtTime(f, t);
      o.detune.setValueAtTime((i - 1.5) * 4, t);
      o.connect(filter);
      o.start(t);
      return o;
    });
    gain.gain.setTargetAtTime(b.vol, t + 0.05, 0.6);
    this.bed = { gain, nodes };
  }

  private noise(sec: number) {
    const a = this.ctx!, b = a.createBuffer(1, Math.ceil(a.sampleRate * sec), a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = a.createBufferSource();
    s.buffer = b;
    return s;
  }

  sfx(name: Sfx) {
    const a = this.ctx;
    if (!a || this.muted) return;
    const t = a.currentTime;
    const env = (peak: number, atk: number, rel: number, dl = 0) => {
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t + dl);
      g.gain.exponentialRampToValueAtTime(peak, t + dl + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dl + atk + rel);
      g.connect(this.master);
      return g;
    };
    const tone = (f: number, type: OscillatorType, peak: number, atk: number, rel: number, dl = 0) => {
      const o = a.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(env(peak, atk, rel, dl));
      o.start(t + dl);
      o.stop(t + dl + atk + rel + 0.05);
      return o;
    };
    switch (name) {
      case "dive": {
        const n = this.noise(2.6), f = a.createBiquadFilter();
        f.type = "bandpass"; f.Q.value = 1.4;
        f.frequency.setValueAtTime(220, t); f.frequency.exponentialRampToValueAtTime(2200, t + 2); f.frequency.exponentialRampToValueAtTime(340, t + 2.6);
        n.connect(f).connect(env(0.24, 1.4, 1.1)); n.start(t);
        break;
      }
      case "chime": for (const [f, dl] of [[523.25, 0], [659.25, 0.14], [783.99, 0.28], [1046.5, 0.42]]) tone(f, "sine", 0.09, 0.02, 1.1, dl); break;
      case "knock":
        for (const dl of [0, 0.21, 0.43]) {
          const o = a.createOscillator();
          o.frequency.setValueAtTime(145, t + dl); o.frequency.exponentialRampToValueAtTime(58, t + dl + 0.14);
          o.connect(env(0.65, 0.006, 0.18, dl)); o.start(t + dl); o.stop(t + dl + 0.22);
          const n = this.noise(0.09), f = a.createBiquadFilter();
          f.type = "lowpass"; f.frequency.value = 850;
          n.connect(f).connect(env(0.32, 0.003, 0.08, dl)); n.start(t + dl);
        }
        break;
      case "door": {
        const o = a.createOscillator(), f = a.createBiquadFilter();
        o.type = "sawtooth"; o.frequency.setValueAtTime(190, t); o.frequency.linearRampToValueAtTime(260, t + 0.6);
        f.type = "bandpass"; f.frequency.value = 520; f.Q.value = 6;
        o.connect(f).connect(env(0.06, 0.15, 0.55)); o.start(t); o.stop(t + 0.75);
        break;
      }
      case "blip_ok": tone(784, "triangle", 0.14, 0.008, 0.24); tone(1046.5, "triangle", 0.14, 0.008, 0.24, 0.09); break;
      case "blip_close": {
        const o = a.createOscillator();
        o.type = "triangle"; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(340, t + 0.18);
        o.connect(env(0.11, 0.008, 0.2)); o.start(t); o.stop(t + 0.24);
        break;
      }
      case "fanfare": for (const [f, dl] of [[293.66, 0], [369.99, 0.12], [440, 0.24], [587.33, 0.36]]) tone(f, "triangle", 0.12, 0.03, 1.5, dl); break;
      case "nova_chirp": {
        const o = a.createOscillator();
        o.frequency.setValueAtTime(720, t); o.frequency.exponentialRampToValueAtTime(1380, t + 0.09);
        o.frequency.exponentialRampToValueAtTime(980, t + 0.18); o.frequency.exponentialRampToValueAtTime(1560, t + 0.27);
        o.connect(env(0.12, 0.01, 0.28)); o.start(t); o.stop(t + 0.32);
        break;
      }
      case "ignition": {
        const n = this.noise(3.4), f = a.createBiquadFilter();
        f.type = "lowpass"; f.frequency.setValueAtTime(180, t); f.frequency.exponentialRampToValueAtTime(1400, t + 2.2);
        n.connect(f).connect(env(0.45, 0.4, 2.9)); n.start(t);
        const sub = a.createOscillator();
        sub.frequency.setValueAtTime(55, t); sub.frequency.exponentialRampToValueAtTime(120, t + 2.6);
        sub.connect(env(0.28, 0.2, 2.5)); sub.start(t); sub.stop(t + 2.8);
        break;
      }
      case "yawn": this.yawn(t); break;
      case "shot": {
        const o = a.createOscillator();
        o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
        o.connect(env(0.16, 0.004, 0.13)); o.start(t); o.stop(t + 0.16);
        break;
      }
      case "burst": {
        const n = this.noise(0.35), f = a.createBiquadFilter();
        f.type = "lowpass"; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(260, t + 0.3);
        n.connect(f).connect(env(0.2, 0.004, 0.3)); n.start(t);
        break;
      }
      case "flyby": {
        const n = this.noise(1.2), f = a.createBiquadFilter();
        f.type = "bandpass"; f.Q.value = 3; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.5); f.frequency.exponentialRampToValueAtTime(400, t + 1.1);
        n.connect(f).connect(env(0.14, 0.25, 0.85)); n.start(t);
        break;
      }
      case "shield": for (const [f, dl] of [[880, 0], [660, 0.1], [990, 0.2]]) tone(f, "sine", 0.08, 0.02, 0.4, dl); break;
      case "clear": for (const [f, dl] of [[523.25, 0], [659.25, 0.1], [783.99, 0.2], [1046.5, 0.32], [1318.5, 0.44]]) tone(f, "triangle", 0.11, 0.02, 0.9, dl); break;
    }
  }

  /**
   * A child's yawn, built from how one sounds: a breathy inhale that swells, an open "aah" whose
   * pitch lifts then glides down while the jaw opens (formants rise, then fall), the lips closing into
   * "mm", and a soft exhale. A glottal source with natural harmonic roll-off, through three formants.
   */
  private yawn(t: number) {
    const a = this.ctx!, out = a.createGain();
    out.gain.value = 0.9;
    out.connect(this.master);
    // 1. inhale: breath noise, rising and opening (0 – 0.75 s)
    const inh = this.noise(0.9), inF = a.createBiquadFilter(), inG = a.createGain();
    inF.type = "bandpass"; inF.Q.value = 0.9;
    inF.frequency.setValueAtTime(500, t); inF.frequency.linearRampToValueAtTime(1500, t + 0.75);
    inG.gain.setValueAtTime(0.0001, t); inG.gain.exponentialRampToValueAtTime(0.16, t + 0.55); inG.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    inh.connect(inF).connect(inG).connect(out); inh.start(t);
    // 2. voiced "aah" → "mm" (0.6 – 2.6 s)
    const v0 = t + 0.6, dur = 2.0;
    const harmonics = 24, re = new Float32Array(harmonics + 1), im = new Float32Array(harmonics + 1);
    for (let k = 1; k <= harmonics; k++) im[k] = 1 / Math.pow(k, 1.35); // ~ -12 dB/oct glottal roll-off
    const src = a.createOscillator();
    src.setPeriodicWave(a.createPeriodicWave(re, im));
    src.frequency.setValueAtTime(290, v0);
    src.frequency.linearRampToValueAtTime(345, v0 + 0.35);
    src.frequency.exponentialRampToValueAtTime(210, v0 + 1.45);
    src.frequency.exponentialRampToValueAtTime(175, v0 + dur);
    const vib = a.createOscillator(), vibG = a.createGain();
    vib.frequency.value = 5.2; vibG.gain.value = 4;
    vib.connect(vibG).connect(src.frequency);
    const breath = this.noise(dur + 0.2), breathG = a.createGain();
    breathG.gain.value = 0.35;
    const mix = a.createGain();
    src.connect(mix); breath.connect(breathG).connect(mix);
    // formants: F1/F2 open from "ah" toward wide "aah", then close; F3 steady; lip close = lowpass
    const voiced = a.createGain();
    const formant = (f: [number, number][], q: number, g: number) => {
      const bp = a.createBiquadFilter();
      bp.type = "bandpass"; bp.Q.value = q;
      bp.frequency.setValueAtTime(f[0][1], v0);
      for (const [dt, hz] of f) bp.frequency.linearRampToValueAtTime(hz, v0 + dt);
      const gg = a.createGain();
      gg.gain.value = g;
      mix.connect(bp).connect(gg).connect(voiced);
    };
    formant([[0, 620], [0.4, 900], [1.2, 820], [1.6, 420], [2.0, 300]], 5, 1.0);
    formant([[0, 1150], [0.4, 1300], [1.2, 1200], [1.6, 900], [2.0, 800]], 7, 0.55);
    formant([[0, 2600], [2.0, 2500]], 9, 0.18);
    const lips = a.createBiquadFilter();
    lips.type = "lowpass";
    lips.frequency.setValueAtTime(5000, v0); lips.frequency.setValueAtTime(5000, v0 + 1.45); lips.frequency.exponentialRampToValueAtTime(420, v0 + 1.75);
    const vEnv = a.createGain();
    vEnv.gain.setValueAtTime(0.0001, v0);
    vEnv.gain.exponentialRampToValueAtTime(0.5, v0 + 0.3);
    vEnv.gain.linearRampToValueAtTime(0.42, v0 + 1.3);
    vEnv.gain.linearRampToValueAtTime(0.22, v0 + 1.7);
    vEnv.gain.exponentialRampToValueAtTime(0.0001, v0 + dur);
    voiced.connect(lips).connect(vEnv).connect(out);
    src.start(v0); vib.start(v0); breath.start(v0);
    src.stop(v0 + dur + 0.05); vib.stop(v0 + dur + 0.05); breath.stop(v0 + dur + 0.2);
    // 3. exhale (2.5 – 3.2 s)
    const ex = this.noise(0.8), exF = a.createBiquadFilter(), exG = a.createGain();
    exF.type = "lowpass"; exF.frequency.value = 900;
    exG.gain.setValueAtTime(0.0001, v0 + 1.9); exG.gain.exponentialRampToValueAtTime(0.06, v0 + 2.05); exG.gain.exponentialRampToValueAtTime(0.0001, v0 + 2.6);
    ex.connect(exF).connect(exG).connect(out); ex.start(v0 + 1.9);
  }
}

export const audio = new SoundEngine();
