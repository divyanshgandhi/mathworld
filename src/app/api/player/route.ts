import { cookies } from "next/headers";
import { z } from "zod";
import { NewPlayer } from "@/db/events";
import { createPlayer, findPlayer, hasEvent, publicPlayer, touchPlayer } from "@/db/store";
import { badRequest, CADET_COOKIE, cadetCookieOptions, currentCadet } from "../cadet";

/** Resume: the cadet behind this device's cookie, and whether they have finished the intro. */
export async function GET() {
  const { db, player } = await currentCadet();
  if (!player) return Response.json({ player: null });
  await touchPlayer(db, player.id);
  return Response.json({ player: publicPlayer(player), introCompleted: await hasEvent(db, player.id, "intro_completed") });
}

/** Sign up: create a cadet from name + avatar and remember them on this device. */
export async function POST(req: Request) {
  const parsed = NewPlayer.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues);
  const { db } = await currentCadet();
  const player = await createPlayer(db, parsed.data);
  (await cookies()).set(CADET_COOKIE, player.id, cadetCookieOptions);
  return Response.json({ player: publicPlayer(player), introCompleted: false }, { status: 201 });
}

/** Switch Cadet to one made on this device before (the title lists them): play as that cadet again. */
export async function PUT(req: Request) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues);
  const { db } = await currentCadet();
  const player = await findPlayer(db, parsed.data.id);
  if (!player) return Response.json({ player: null }, { status: 404 });
  (await cookies()).set(CADET_COOKIE, player.id, cadetCookieOptions);
  return Response.json({ player: publicPlayer(player), introCompleted: await hasEvent(db, player.id, "intro_completed") });
}

/** Switch Cadet: forget this device's cadet (their history stays in the log). */
export async function DELETE() {
  (await cookies()).delete(CADET_COOKIE);
  return Response.json({ ok: true });
}
