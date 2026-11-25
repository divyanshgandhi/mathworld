/**
 * The cadets made on this device: id and name only, in localStorage, newest first. Switch cadet
 * picks from this list, so a child never loses their progress on a shared device. No passwords.
 */
export interface KnownCadet { id: string; name: string }
const KEY = "mw:cadets", MAX = 8;

export function knownCadets(): KnownCadet[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((c): c is KnownCadet => typeof c?.id === "string" && typeof c?.name === "string") : [];
  } catch { return []; }
}

/** Put a cadet at the front of the list (a sign-up, a resume, a switch). */
export function rememberCadet(c: KnownCadet) {
  try { localStorage.setItem(KEY, JSON.stringify([{ id: c.id, name: c.name }, ...knownCadets().filter((k) => k.id !== c.id)].slice(0, MAX))); } catch { /* private mode: nothing kept */ }
}

/** Drop a cadet the server no longer knows. */
export function forgetCadet(id: string) {
  try { localStorage.setItem(KEY, JSON.stringify(knownCadets().filter((k) => k.id !== id))); } catch { /* nothing kept */ }
}
