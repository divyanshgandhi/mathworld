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
