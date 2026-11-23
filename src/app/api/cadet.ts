import { cookies } from "next/headers";
import { getDb } from "@/db";
import { findPlayer } from "@/db/store";

/** The cookie that remembers which cadet this device is playing as. */
export const CADET_COOKIE = "mw_cadet_id";

export const cadetCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/** The current cadet from the cookie, or null. */
export async function currentCadet() {
  const id = (await cookies()).get(CADET_COOKIE)?.value;
  const db = await getDb();
  return { db, player: await findPlayer(db, id) };
}

export const badRequest = (issues: unknown) => Response.json({ error: "invalid", issues }, { status: 400 });
