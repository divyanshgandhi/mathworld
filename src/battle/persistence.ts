import type { EventInput } from "@/db/events";
import type { Bus } from "./bus";

/**
 * Persistence: the battle's bus events become the stored EventInput log (src/db/events.ts), with
 * exactly the types, fields and order the battle has always written. Subscribe this first, so the log
 * is written before anything that folds it.
 */
export function attachPersistence(bus: Bus, write: (e: EventInput) => void) {
  const offs = [
    bus.on("lesson_completed", (p) => { for (const t of p.tricks) write({ type: "explanation_completed", payload: { trickId: t, a: p.a, b: p.b, mode: p.mode, wedoCorrect: p.wedoCorrect } }); }),
    bus.on("fire", (p) => write({
      type: "attempt_submitted",
      payload: { a: p.a, b: p.b, planetId: p.planet, guess: p.n, latencyMs: p.latencyMs, errorType: p.errorType, attemptIndex: p.attempt, usedRadar: p.usedRadar, powerUpUsed: p.powerUp, isTransferCheck: p.isTransferCheck, waveRole: p.waveRole },
    })),
    bus.on("orb_burst", (p) => write({ type: "orb_earned", payload: { amount: p.amount, reason: p.reason } })),
    bus.on("powerup_applied", (p) => write({ type: "powerup_used", payload: { trickId: p.id, a: p.a, b: p.b, valid: p.fits } })),
    bus.on("lesson_started", (p) => { for (const t of p.tricks) write({ type: "explanation_started", payload: { trickId: t, a: p.a, b: p.b, mode: p.mode } }); }),
    bus.on("record", (p) => write(p.event)),
  ];
  return () => offs.forEach((off) => off());
}
