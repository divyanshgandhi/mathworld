"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** Whether the player asked for reduced motion (false on the server). */
export function useReducedMotion() {
  return useSyncExternalStore(
    (f) => { const m = matchMedia(QUERY); m.addEventListener("change", f); return () => m.removeEventListener("change", f); },
    () => matchMedia(QUERY).matches,
    () => false,
  );
}

/**
 * A looping clock for a picture: the time in ms inside a loop of `period`, from when `active` turned on.
 * `null` means "show the still frame": reduced motion, or not active (a page that is not in view).
 */
export function useLoop(period: number, active: boolean): number | null {
  const reduced = useReducedMotion();
  const run = active && !reduced && period > 0;
  const [t, setT] = useState<number | null>(null);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => { setT((now - t0) % period); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); setT(null); };
  }, [run, period]);
  return run ? (t ?? 0) : null;
}
