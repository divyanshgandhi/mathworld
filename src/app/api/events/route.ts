import { EventBody } from "@/db/events";
import { appendEvents, listEvents } from "@/db/store";
import { badRequest, currentCadet } from "../cadet";
import { seenIds, storeOnce } from "./dedupe";

const noCadet = () => Response.json({ error: "no cadet" }, { status: 401 });

/** Append one event or a batch to the current cadet's log. Validated, ordered, never edited. */
export async function POST(req: Request) {
  const { db, player } = await currentCadet();
  if (!player) return noCadet();
  const raw = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const parsed = EventBody.safeParse(raw);
  if (!parsed.success) return badRequest(parsed.error.issues);
  // A retried batch carries the same client ids. The database stores each id once for a cadet (a unique
  // index), which holds on any server. The in-memory list in front of it only saves the round trip.
  const list = "events" in parsed.data ? parsed.data.events : [parsed.data];
  const ids = Array.isArray(raw?.ids) && raw.ids.length === list.length ? (raw.ids as unknown[]) : undefined;
  const at = new Map(list.map((e, i) => [e, ids?.[i]] as const));
  return Response.json({ events: await storeOnce(seenIds, player.id, list, ids, (fresh) => appendEvents(db, player.id, fresh, ids ? fresh.map((e) => at.get(e)) : undefined)) }, { status: 201 });
}

/**
 * The current cadet's log, oldest first. Each payload also carries `loggedAt`, the server's time for
 * the event in ms (never stored, never taken from a client): the fold reads it for the "once a day"
 * orb rules and the daily patrol, because the client's history keeps only `type` and `payload`.
 */
export async function GET() {
  const { db, player } = await currentCadet();
  if (!player) return noCadet();
  const log = await listEvents(db, player.id);
  return Response.json({ events: log.map(({ id, type, payload, createdAt }) => ({ id, type, payload: { ...payload, loggedAt: createdAt.getTime() }, createdAt })) });
}
