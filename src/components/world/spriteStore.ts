import { COLOR } from "@/design/tokens";
import type { BodyId } from "@/worlds/space/bodies";

/**
 * Where 2D planet sprites live once they are drawn, with no three.js in this file so any screen can import it.
 *
 * - In memory for the session: a sprite drawn once is shown at once on every later screen (`spriteNow`).
 * - Across visits in the browser's Cache Storage, keyed by `SPRITE_CACHE`: a returning player never waits
 *   for the planet painter. Old versions are deleted the first time a sprite is read.
 * - On a miss, `src/worlds/sprites.ts` (three.js, loaded on demand) renders it from the planet factory.
 *
 * Bump `SPRITE_VERSION` whenever the picture of a body changes (the painter, the factory, the sprite camera).
 * The token colours are part of the key, so a palette change refreshes every sprite by itself; a change to the
 * space look is caught by `sprites.ts`, which purges the cache when the look's fingerprint moves.
 */
export const SPRITE_VERSION = 2;

/** A short stable hash (FNV-1a, base 36). */
export function fingerprint(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

const PREFIX = "mw-sprites-";
export const SPRITE_CACHE = `${PREFIX}${SPRITE_VERSION}-${fingerprint(JSON.stringify(COLOR))}`;

/** Device pixels a sprite of `sizePx` CSS pixels is drawn at (pixel ratio capped at 2). */
export function spritePx(sizePx: number) {
  const dpr = typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1);
  return Math.max(8, Math.round(sizePx * dpr));
}
/** Over this many device pixels a sprite uses the factory's high level of detail. */
export const HIGH_LOD_PX = 240;
/** The largest CSS size that still draws from the quick low-detail maps on this screen (a large sprite's preview). */
export const previewSize = () => Math.floor(HIGH_LOD_PX / (spritePx(100) / 100));
const keyOf = (id: BodyId, px: number) => `${id}-${px}`;

const urls = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
const subs = new Set<() => void>();

/** For useSyncExternalStore: called whenever a sprite lands. */
export function subscribeSprites(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; }
/** The sprite's URL if it is already drawn this session, else null. Synchronous, so a revisit never flashes. */
export const spriteNow = (id: BodyId, sizePx: number) => urls.get(keyOf(id, spritePx(sizePx))) ?? null;

const hasCaches = () => typeof window !== "undefined" && "caches" in window && window.isSecureContext;
const requestFor = (key: string) => new Request(`${location.origin}/__mw/sprites/${key}.png`);

let purged: Promise<void> | null = null;
/** Delete every sprite cache but the current one (once per session). */
export function purgeOldSprites(keep = SPRITE_CACHE) {
  if (!hasCaches()) return Promise.resolve();
  purged ??= caches.keys()
    .then((names) => Promise.all(names.filter((n) => n.startsWith(PREFIX) && n !== keep).map((n) => caches.delete(n))))
    .then(() => {}, () => {});
  return purged;
}
/** Forget every stored sprite (a look change): the next visit redraws them. */
export async function clearSpriteCache() {
  if (!hasCaches()) return;
  try { await caches.delete(SPRITE_CACHE); } catch { /* storage blocked: nothing to clear */ }
}

async function fromCache(key: string): Promise<string | null> {
  if (!hasCaches()) return null;
  try {
    void purgeOldSprites();
    const hit = await (await caches.open(SPRITE_CACHE)).match(requestFor(key));
    if (!hit) return null;
    const blob = await hit.blob();
    return blob.size > 0 ? URL.createObjectURL(blob) : null;
  } catch { return null; }
}
async function toCache(key: string, blob: Blob) {
  if (!hasCaches()) return;
  try { await (await caches.open(SPRITE_CACHE)).put(requestFor(key), new Response(blob, { headers: { "content-type": "image/png" } })); }
  catch { /* quota or private mode: the sprite still works for this session */ }
}

/**
 * The sprite of a body at `sizePx` CSS pixels: memory, then Cache Storage, then a fresh render.
 * Concurrent calls share one promise. Rejects only if WebGL is unavailable.
 */
export function getSprite(id: BodyId, sizePx: number): Promise<string> {
  const px = spritePx(sizePx), key = keyOf(id, px);
  const ready = urls.get(key);
  if (ready) return Promise.resolve(ready);
  let p = pending.get(key);
  if (!p) {
    p = (async () => {
      const hit = await fromCache(key);
      if (hit) return hit;
      const { renderSprite } = await import("@/worlds/sprites");
      const out = await renderSprite(id, px);
      if (typeof out === "string") return out;
      void toCache(key, out);
      return URL.createObjectURL(out);
    })();
    pending.set(key, p);
    p.then((url) => { urls.set(key, url); pending.delete(key); subs.forEach((f) => f()); }, () => pending.delete(key));
  }
  return p;
}

/**
 * Start drawing the sprites a screen is about to show, in the order given (put the one that matters most first).
 * Safe to call again: anything drawn or on the way is not drawn twice.
 */
export function preloadSprites(items: readonly { id: BodyId; size: number }[]) {
  return Promise.allSettled(items.map((s) => getSprite(s.id, s.size))).then(() => {});
}
