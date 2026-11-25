/// <reference lib="webworker" />
import { paintBody, type MapBodyId } from "./planetMaps";

/** Paints planet maps off the main thread (planets.ts sends { n, id, w }, gets the maps back, transferred). */
self.onmessage = (e: MessageEvent<{ n: number; id: MapBodyId; w: number }>) => {
  const { n, id, w } = e.data;
  const m = paintBody(id, w);
  const transfer = [m.albedo.buffer, m.height?.buffer, m.clouds?.buffer].filter((b): b is ArrayBuffer => !!b);
  (self as unknown as Worker).postMessage({ n, maps: m }, transfer);
};
