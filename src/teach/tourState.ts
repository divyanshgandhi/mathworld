/**
 * What the tours need to know about the page, kept in one place:
 * - whether the guided first shot is running (a tour never runs with it);
 * - which screen tour is mounted, so the Field Manual can offer "Show me around";
 * - a replay asked for from the manual.
 * Plain module state with a subscribe, for useSyncExternalStore.
 */
type Listener = () => void;
const subs = new Set<Listener>();
let version = 0;
const notify = () => { version++; subs.forEach((f) => f()); };

let guides = 0;
const mounted: string[] = [];
let replay: string | null = null;

export const tourState = {
  subscribe(f: Listener) { subs.add(f); return () => { subs.delete(f); }; },
  version: () => version,

  /** The guided first shot calls this while it runs; the returned function lets go. */
  guideOn() { guides++; notify(); let done = false; return () => { if (!done) { done = true; guides--; notify(); } }; },
  get guideRunning() { return guides > 0; },

  /** A screen tour is on the page (the last mounted wins). Returns the unmount. */
  mount(id: string) { mounted.push(id); notify(); return () => { const i = mounted.lastIndexOf(id); if (i >= 0) mounted.splice(i, 1); if (replay === id && !mounted.includes(id)) replay = null; notify(); }; },
  get current(): string | null { return mounted.at(-1) ?? null; },

  /** Ask the mounted tour to run again (from the Field Manual's "Show me around"). */
  askReplay(id?: string) { const t = id ?? mounted.at(-1); if (t) { replay = t; notify(); } },
  get replay() { return replay; },
  takeReplay(id: string) { if (replay !== id) return false; replay = null; notify(); return true; },
};
