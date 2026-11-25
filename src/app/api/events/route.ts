import { EventBody } from "@/db/events";
import { appendEvents, listEvents } from "@/db/store";
import { badRequest, currentCadet } from "../cadet";
import { freshOnly, seenIds } from "./dedupe";

const noCadet = () => Response.json({ error: "no cadet" }, { status: 401 });

/** Append one event or a batch to the current cadet's log. Validated, ordered, never edited. */
export async function POST(req: Request) {
  const { db, player } = await currentCadet();
  if (!player) return noCadet();
  const raw = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const parsed = EventBody.safeParse(raw);
  if (!parsed.success) return badRequest(parsed.error.issues);
  // a retried batch (same client ids) whose first try was stored is not stored twice
  const list = freshOnly(seenIds, player.id, "events" in parsed.data ? parsed.data.events : [parsed.data], raw?.ids);
  return Response.json({ events: list.length ? await appendEvents(db, player.id, list) : [] }, { status: 201 });
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
