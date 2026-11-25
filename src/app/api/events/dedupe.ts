/**
 * Retry safety for POST /api/events. The client outbox gives every event an id and re-sends a batch
 * until it hears "stored"; when the first try was stored but its response was lost, the retry carries
 * the same ids. Ids already seen for that cadet are dropped here, so a retry never stores (or pays) twice.
 * Kept in server memory per cadet, the most recent `cap` ids: a retry arrives within seconds or minutes.
 */
type Seen = Map<string, Set<string>>;
const g = globalThis as { __mwSeenEventIds?: Seen };
export const seenIds: Seen = (g.__mwSeenEventIds ??= new Map());

/** The events not stored before, and marks their ids seen. Events without a valid id always pass. */
export function freshOnly<E>(seen: Seen, playerId: string, list: E[], ids: unknown, cap = 2000): E[] {
  if (!Array.isArray(ids) || ids.length !== list.length) return list;
  let mine = seen.get(playerId);
  if (!mine) seen.set(playerId, (mine = new Set()));
  const out: E[] = [];
  list.forEach((e, i) => {
    const id = ids[i];
    if (typeof id !== "string" || id.length > 64) return void out.push(e);
    if (mine.has(id)) return;
    mine.add(id);
    out.push(e);
  });
  // a Set iterates oldest first: keep only the newest `cap`
  for (const id of mine) { if (mine.size <= cap) break; mine.delete(id); }
  return out;
}

/**
 * Stores the events of a batch that were not stored before. If the store fails, the ids this batch
 * marked are taken back, so the client's retry is let through and not dropped as a double.
 */
export async function storeOnce<E, R>(seen: Seen, playerId: string, list: E[], ids: unknown, store: (fresh: E[]) => Promise<R[]>, cap = 2000): Promise<R[]> {
  const before = new Set(seen.get(playerId));
  const fresh = freshOnly(seen, playerId, list, ids, cap);
  if (!fresh.length) return [];
  try {
    return await store(fresh);
  } catch (err) {
    const mine = seen.get(playerId);
    if (mine && Array.isArray(ids)) for (const id of ids) if (typeof id === "string" && !before.has(id)) mine.delete(id);
    throw err;
  }
}
