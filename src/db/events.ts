import { z } from "zod";

/**
 * The event contract: every event a client may append, validated before it touches the log.
 * Pure (zod only), so the director's fold and the client can share these types.
 */
export const PLANETS = ["mercury", "venus", "earth", "moon", "mars", "asteroid-belt", "jupiter", "saturn", "uranus", "deep-space"] as const;
export const TRICKS = ["empty-mirror", "fast-adding", "flip-it", "double-it", "easy-5-10", "jump-one-more", "split-and-add", "borrow-take-back", "big-small-split", "half-double"] as const;
export const ERROR_TYPES = ["added_instead", "off_by_one_group", "off_by_one_unit", "place_value", "undershoot_close", "overshoot_close", "wild_guess"] as const;
export const UPGRADE_SLOTS = ["hull", "blaster", "thruster"] as const;
/** Where a wave sits in its mission (see src/director/next.ts). "practice": a replay of another planet, mastery only. */
export const WAVE_ROLES = ["tutorial", "anchor", "discovery", "application", "adaptive", "transfer", "boss", "recharge", "probe", "practice"] as const;

/** Factors go up to 5-digit × 3-digit; the product stays well inside safe integers. */
const factor = z.number().int().min(0).max(99_999);
const count = z.number().int().min(0);
const planet = z.enum(PLANETS);
const trick = z.enum(TRICKS);
const mode = z.enum(["full", "fast"]);

export const EventInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("intro_completed"), payload: z.object({}).strict().default({}) }),
  z.object({
    type: z.literal("attempt_submitted"),
    payload: z.object({
      a: factor, b: factor, planetId: planet, guess: z.number().int().min(0).max(1e10),
      /** Recomputed by the server from a, b and guess: the client never decides what is correct. */
      correct: z.boolean().optional(),
      latencyMs: count, errorType: z.enum(ERROR_TYPES).nullable(), attemptIndex: z.number().int().min(1),
      usedRadar: z.boolean(), powerUpUsed: trick.nullable(), isTransferCheck: z.boolean(),
      waveRole: z.enum(WAVE_ROLES).optional(),
    }),
  }),
  z.object({ type: z.literal("powerup_used"), payload: z.object({ trickId: trick, a: factor, b: factor, valid: z.boolean() }) }),
  z.object({ type: z.literal("explanation_started"), payload: z.object({ trickId: trick, a: factor, b: factor, mode }) }),
  z.object({ type: z.literal("explanation_completed"), payload: z.object({ trickId: trick, a: factor, b: factor, mode, wedoCorrect: z.boolean() }) }),
  z.object({ type: z.literal("planet_cleared"), payload: z.object({ planetId: planet }) }),
  z.object({ type: z.literal("hyper_jump_taken"), payload: z.object({ fromPlanet: planet, toPlanet: planet }) }),
  z.object({ type: z.literal("orb_earned"), payload: z.object({ amount: z.number().int().min(1), reason: z.string().max(64) }) }),
  z.object({ type: z.literal("upgrade_purchased"), payload: z.object({ slot: z.enum(UPGRADE_SLOTS), itemId: z.string().regex(/^[a-z0-9-]{1,40}$/), cost: count }) }),
  /** Mercury (addition) and Venus (subtraction) warm-ups, up to 20. */
  z.object({ type: z.literal("warmup_answered"), payload: z.object({ op: z.enum(["add", "sub"]), a: z.number().int().min(0).max(20), b: z.number().int().min(0).max(20), guess: z.number().int().min(0).max(1e6), correct: z.boolean().optional(), latencyMs: count }) }),
  z.object({ type: z.literal("flashcard_answered"), payload: z.object({ a: factor, b: factor, correct: z.boolean().optional(), latencyMs: count, guess: z.number().int().min(0).max(1e10) }) }),
  /** The cadet has met something once: a screen's greeting, a help page, a guided step. Keys look like "greet:bay" or "guide:first-shot". */
  z.object({ type: z.literal("seen"), payload: z.object({ key: z.string().regex(/^[a-z0-9:-]{1,48}$/) }) }),
]);
export type EventInput = z.infer<typeof EventInput>;
export type EventType = EventInput["type"];

/** One event, or a batch of up to 50 (a wave's worth of attempts). */
export const EventBody = z.union([EventInput, z.object({ events: z.array(EventInput).min(1).max(50) })]);

/** Server-side truth: correctness is recomputed from the numbers, whatever the client sent. */
export function normalize(e: EventInput): EventInput {
  if (e.type === "attempt_submitted" || e.type === "flashcard_answered") {
    return { ...e, payload: { ...e.payload, correct: e.payload.guess === e.payload.a * e.payload.b } } as EventInput;
  }
  if (e.type === "warmup_answered") {
    const p = e.payload;
    return { ...e, payload: { ...p, correct: p.guess === (p.op === "add" ? p.a + p.b : p.a - p.b) } };
  }
  return e;
}

export const NewPlayer = z.object({
  name: z.string().trim().min(1).max(24),
  avatar: z.string().regex(/^[a-z0-9-]{1,32}$/).default("cadet-1"),
});
