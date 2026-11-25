/**
 * Which chrome is on screen. A mounted TopBar owns the sound button, so the floating one in the
 * root layout hides while any TopBar is up. A tiny external store, read with useSyncExternalStore.
 */
let bars = 0;
const subs = new Set<() => void>();

export const topBars = {
  subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; },
  count: () => bars,
  /** Call on mount; the returned function on unmount. */
  mount() {
    bars += 1; subs.forEach((f) => f());
    return () => { bars = Math.max(0, bars - 1); subs.forEach((f) => f()); };
  },
};
