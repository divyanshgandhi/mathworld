/**
 * Placeholder sound effects, synthesised in the browser so the film has timing and texture.
 * Voices and final effects will come from Gradium Phonon; these keep the same call sites.
 */
let ctx: AudioContext | null = null;

/** Browsers only allow audio after a user gesture: call this from a click. */
export function unlockAudio() {
  if (!ctx) ctx = new AudioContext();
  void ctx.resume();
  return ctx;
}

function play(fn: (a: AudioContext, t: number) => void) {
  if (!ctx) return;
  try { fn(ctx, ctx.currentTime); } catch { /* sound is never allowed to break the film */ }
}

function noise(a: AudioContext, sec: number) {
  const b = a.createBuffer(1, Math.ceil(a.sampleRate * sec), a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = b;
  return src;
}

function env(a: AudioContext, t: number, peak: number, attack: number, hold: number, release: number) {
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  g.connect(a.destination);
  return g;
}

export const sfx = {
  whoosh: () => play((a, t) => {
    const n = noise(a, 3.4), f = a.createBiquadFilter();
    f.type = "bandpass"; f.Q.value = 1.2;
    f.frequency.setValueAtTime(250, t); f.frequency.exponentialRampToValueAtTime(2400, t + 3.1);
    n.connect(f).connect(env(a, t, 0.22, 2.8, 0, 0.5)); n.start(t);
  }),
  chime: () => play((a, t) => {
    for (const [fr, dl] of [[659, 0], [880, 0.18], [1319, 0.36]]) {
      const o = a.createOscillator(); o.frequency.value = fr;
      o.connect(env(a, t + dl, 0.1, 0.02, 0, 1.4)); o.start(t + dl); o.stop(t + dl + 1.5);
    }
  }),
  yawn: () => play((a, t) => {
    const g = env(a, t, 0.22, 0.35, 0.9, 0.7);
    const o = a.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(240, t); o.frequency.linearRampToValueAtTime(310, t + 0.45); o.frequency.exponentialRampToValueAtTime(130, t + 1.9);
    for (const [f0, f1, f2] of [[750, 1100, 450], [1150, 1500, 800]]) {
      const f = a.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 5;
      f.frequency.setValueAtTime(f0, t); f.frequency.linearRampToValueAtTime(f1, t + 0.5); f.frequency.exponentialRampToValueAtTime(f2, t + 1.9);
      o.connect(f).connect(g);
    }
    const n = noise(a, 2.1), nf = a.createBiquadFilter(), ng = a.createGain();
    nf.type = "bandpass"; nf.frequency.value = 1200; nf.Q.value = 0.8; ng.gain.value = 0.25;
    n.connect(nf).connect(ng).connect(g);
    o.start(t); o.stop(t + 2.05); n.start(t); n.stop(t + 2.05);
  }),
  knock: () => play((a, t) => {
    for (const dl of [0, 0.2, 0.62, 0.82]) {
      const o = a.createOscillator();
      o.frequency.setValueAtTime(140, t + dl); o.frequency.exponentialRampToValueAtTime(70, t + dl + 0.12);
      o.connect(env(a, t + dl, 0.5, 0.005, 0, 0.15)); o.start(t + dl); o.stop(t + dl + 0.2);
      const n = noise(a, 0.1), f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900;
      n.connect(f).connect(env(a, t + dl, 0.25, 0.002, 0, 0.07)); n.start(t + dl);
    }
  }),
  blip: (good: boolean) => play((a, t) => {
    const o = a.createOscillator();
    o.frequency.setValueAtTime(good ? 880 : 440, t); o.frequency.exponentialRampToValueAtTime(good ? 1320 : 330, t + 0.12);
    o.connect(env(a, t, 0.12, 0.005, 0, 0.2)); o.start(t); o.stop(t + 0.22);
  }),
  thump: () => play((a, t) => {
    const o = a.createOscillator();
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.1);
    o.connect(env(a, t, 0.18, 0.003, 0, 0.12)); o.start(t); o.stop(t + 0.15);
  }),
  pop: () => play((a, t) => {
    const n = noise(a, 0.25), f = a.createBiquadFilter(); f.type = "lowpass";
    f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.22);
    n.connect(f).connect(env(a, t, 0.2, 0.003, 0, 0.22)); n.start(t);
  }),
};
