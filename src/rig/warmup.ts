import type { Rng } from "@/engine/util";

/**
 * Mercury and Venus (SPEC §2.5): light addition and subtraction warm-ups up to 20, before the
 * multiplication frontier. Five quick sums a run; they never touch multiplication mastery.
 */
export type WarmupOp = "add" | "sub";
export interface WarmupProblem { op: WarmupOp; a: number; b: number; answer: number }
export const WARMUP_LENGTH = 5;
export const WARMUP_MAX = 20;
export const WARMUP_OF = { mercury: "add", venus: "sub" } as const satisfies Record<string, WarmupOp>;

const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

/** One problem: a + b ≤ 20 (both at least 1), or a − b with 0 ≤ b ≤ a ≤ 20 (0 is a fine answer). */
export function warmupProblem(op: WarmupOp, rng: Rng): WarmupProblem {
  if (op === "add") {
    const a = int(rng, 1, WARMUP_MAX - 1), b = int(rng, 1, WARMUP_MAX - a);
    return { op, a, b, answer: a + b };
  }
  const a = int(rng, 2, WARMUP_MAX), b = int(rng, 0, a);
  return { op, a, b, answer: a - b };
}

/** A run of five, never the same sum twice in a row. */
export function warmupRun(op: WarmupOp, rng: Rng, n = WARMUP_LENGTH): WarmupProblem[] {
  const out: WarmupProblem[] = [];
  while (out.length < n) {
    const p = warmupProblem(op, rng), last = out[out.length - 1];
    if (!last || last.a !== p.a || last.b !== p.b) out.push(p);
  }
  return out;
}
