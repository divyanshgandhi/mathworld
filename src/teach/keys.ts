/**
 * Seen keys: what the teaching layer records with `{ type: "seen", payload: { key } }`.
 * The event schema allows `[a-z0-9:-]{1,48}` (src/db/events.ts). Keys follow OVERHAUL.md:
 * `greet:<screen>`, `guide:<step>`, `manual:<page>`.
 */
export const SEEN_KEY_RE = /^[a-z0-9:-]{1,48}$/;

export const greetKey = (screen: string) => `greet:${screen}`;
export const manualKey = (page: string) => `manual:${page}`;
/** The guided first shot: recorded once the player's first shot has resolved, then never shown again. */
export const GUIDE_FIRST_SHOT = "guide:first-shot";
