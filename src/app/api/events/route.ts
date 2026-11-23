import { EventBody } from "@/db/events";
import { appendEvents, listEvents } from "@/db/store";
import { badRequest, currentCadet } from "../cadet";

const noCadet = () => Response.json({ error: "no cadet" }, { status: 401 });

/** Append one event or a batch to the current cadet's log. Validated, ordered, never edited. */
export async function POST(req: Request) {
  const { db, player } = await currentCadet();
  if (!player) return noCadet();
  const parsed = EventBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues);
  const list = "events" in parsed.data ? parsed.data.events : [parsed.data];
  return Response.json({ events: await appendEvents(db, player.id, list) }, { status: 201 });
}

/** The current cadet's log, oldest first. */
export async function GET() {
  const { db, player } = await currentCadet();
  if (!player) return noCadet();
  const log = await listEvents(db, player.id);
  return Response.json({ events: log.map(({ id, type, payload, createdAt }) => ({ id, type, payload, createdAt })) });
}
