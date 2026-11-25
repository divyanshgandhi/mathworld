/**
 * A scheduler on the stage clock (not wall time), so `stage.paused` + `stage.step(s)` can inspect any
 * frame of a battle. Due callbacks run newest first within a frame, as they always have.
 */
export function createScheduler(clock: { readonly time: number }) {
  const timers: { at: number; fn: () => void }[] = [];
  return {
    /** Run `fn` `sec` seconds from now. */
    at(sec: number, fn: () => void) { timers.push({ at: clock.time + sec, fn }); },
    /** Resolve `sec` seconds from now. */
    after(sec: number) { return new Promise<void>((r) => timers.push({ at: clock.time + sec, fn: r })); },
    /** Call once a frame. */
    tick() {
      for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= clock.time) { const t = timers[i]; timers.splice(i, 1); t.fn(); }
    },
    get pending() { return timers.length; },
  };
}
export type Scheduler = ReturnType<typeof createScheduler>;
