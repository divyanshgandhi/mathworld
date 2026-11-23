import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminSecret, checkAccess, tokenFor } from "@/app/admin/access";

/**
 * The /admin passphrase form posts here. A right passphrase stores its hash in an httpOnly cookie
 * scoped to /admin (12 hours); `logout` clears it. Either way it goes back to /admin.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const back = (q = "") => NextResponse.redirect(new URL(`/admin${q}`, req.url), 303);
  if (form?.get("logout")) {
    const res = back();
    res.cookies.set(ADMIN_COOKIE, "", { path: "/admin", maxAge: 0 });
    return res;
  }
  const key = String(form?.get("key") ?? ""), secret = adminSecret();
  if (checkAccess(secret, { query: key }) !== "ok") return back("?denied=1");
  const res = back();
  res.cookies.set(ADMIN_COOKIE, tokenFor(secret!), {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/admin", maxAge: 60 * 60 * 12,
  });
  return res;
}
