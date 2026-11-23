import { createHash, timingSafeEqual } from "node:crypto";

/**
 * /admin access. The passphrase lives only in the environment (`MW_ADMIN_KEY`, at least 10
 * characters); with none set, /admin is off. It can be given once as `?key=` or through the
 * passphrase form, which stores a hash of it (never the key itself) in an httpOnly cookie.
 */
export const ADMIN_COOKIE = "mw_admin";
export const MIN_KEY = 10;

export const tokenFor = (key: string) => createHash("sha256").update(`mathworld-admin:${key}`).digest("hex");

const same = (a: string, b: string) => {
  const x = Buffer.from(tokenFor(a)), y = Buffer.from(tokenFor(b));
  return timingSafeEqual(x, y);
};
const sameToken = (token: string, key: string) => {
  const x = Buffer.from(token), y = Buffer.from(tokenFor(key));
  return x.length === y.length && timingSafeEqual(x, y);
};

export type Access = "off" | "locked" | "ok";
export function checkAccess(secret: string | undefined, given: { query?: string; cookie?: string }): Access {
  if (!secret || secret.length < MIN_KEY) return "off";
  if (given.query && same(given.query, secret)) return "ok";
  if (given.cookie && sameToken(given.cookie, secret)) return "ok";
  return "locked";
}

export const adminSecret = () => process.env.MW_ADMIN_KEY;
