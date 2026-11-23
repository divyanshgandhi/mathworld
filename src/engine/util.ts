export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));

/** Ease in and out (quadratic). */
export const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/** Frame-rate independent approach of `a` towards `b` at `rate` per second. */
export const approach = (a: number, b: number, rate: number, dt: number) => a + (b - a) * Math.min(1, dt * rate);

/** A deterministic random generator, so scenes look the same on every load. */
export function seeded(seed = 11) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
export type Rng = ReturnType<typeof seeded>;

/** Piecewise keyframes [time, value], eased between keys. */
export function keyframes(keys: [number, number][]) {
  return (t: number) => {
    for (let i = 1; i < keys.length; i++) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i];
      if (t <= b) return va + (vb - va) * ease(clamp((t - a) / (b - a)));
    }
    return keys[keys.length - 1][1];
  };
}
