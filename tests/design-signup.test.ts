import { describe, expect, it } from "vitest";
import { checkName, limitName, NAME_MAX } from "@/components/hub/cadetName";

describe("cadet names: 1 to 16 letters, numbers and spaces", () => {
  it("an empty or blank name is pointed out", () => {
    expect(checkName("").problem).toBe("empty");
    expect(checkName("    ").problem).toBe("empty");
  });
  it("trims and collapses spaces", () => {
    expect(checkName("  Kit   Nova  ")).toEqual({ name: "Kit Nova", problem: null });
  });
  it("letters from any alphabet, accents and numbers are fine", () => {
    for (const n of ["José", "Zoë", "Ana 2", "Łukasz", "さくら", "Приве"]) expect(checkName(n).problem).toBeNull();
  });
  it("emoji and symbols are pointed out", () => {
    for (const n of ["Kit 🚀", "Kit!", "a@b.com", "<b>", "Kit_1"]) expect(checkName(n).problem).toBe("symbols");
  });
  it("a 40-character paste is cut to 16 and says so", () => {
    const l = limitName("Abcdefghij Klmnopqrst Uvwxyz Abcdefghijk");
    expect(Array.from(l.value)).toHaveLength(NAME_MAX);
    expect(l.cut).toBe(true);
    expect(checkName(l.value).problem).toBeNull();
  });
  it("a name of exactly 16 is not cut; leading spaces never count", () => {
    expect(limitName("Abcdefghijklmnop")).toEqual({ value: "Abcdefghijklmnop", cut: false });
    expect(limitName("   Kit")).toEqual({ value: "Kit", cut: false });
  });
  it("an emoji counts as one character when cutting", () => {
    expect(Array.from(limitName("🚀".repeat(20)).value)).toHaveLength(NAME_MAX);
  });
  it("what it saves always fits the server's limit", () => {
    expect(checkName("Abcdefghijklmnop").name.length).toBeLessThanOrEqual(24);
  });
});

import { deckFor, arrayOf } from "@/components/hub/deck";
import { initialState } from "@/director/fold";
import { seeded } from "@/engine/util";
import { DECK_SIZE } from "@/director/hub";

describe("flashcards on one table", () => {
  it("five cards, all from that table, no repeats, any order of the factors", () => {
    const d = deckFor(initialState(), seeded(3), 7);
    expect(d).toHaveLength(DECK_SIZE);
    for (const f of d) expect(f.a === 7 || f.b === 7).toBe(true);
    const keys = d.map((f) => `${Math.min(f.a, f.b)}x${Math.max(f.a, f.b)}`);
    expect(new Set(keys).size).toBe(DECK_SIZE);
  });
  it("facts furthest from Gold come first", () => {
    const s = initialState();
    for (let n = 1; n <= 10; n++) if (n !== 4) s.facts[`${Math.min(3, n)}x${Math.max(3, n)}`] = { m: 0.95, seen: 9, fastWins: 5 };
    const d = deckFor(s, seeded(5), 3);
    expect(d.some((f) => f.a * f.b === 12)).toBe(true);
  });
  it("an array is a rows of b, and the count is the product", () => {
    expect(arrayOf({ a: 3, b: 5 })).toEqual({ rows: 3, cols: 5, total: 15 });
    expect(arrayOf({ a: 0, b: 7 }).total).toBe(0);
  });
});
