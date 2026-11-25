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
