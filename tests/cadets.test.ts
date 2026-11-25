import { beforeEach, describe, expect, it } from "vitest";
import { forgetCadet, knownCadets, rememberCadet } from "@/components/hub/cadets";

describe("the cadets made on this device (src/components/hub/cadets.ts)", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  });
  it("keeps every cadet, newest first, once each, so Switch cadet never loses one", () => {
    expect(knownCadets()).toEqual([]);
    rememberCadet({ id: "a", name: "Kit" });
    rememberCadet({ id: "b", name: "Bo" });
    rememberCadet({ id: "a", name: "Kit" });
    expect(knownCadets()).toEqual([{ id: "a", name: "Kit" }, { id: "b", name: "Bo" }]);
    forgetCadet("b");
    expect(knownCadets()).toEqual([{ id: "a", name: "Kit" }]);
  });
  it("reads a broken list as empty", () => {
    localStorage.setItem("mw:cadets", "{oops");
    expect(knownCadets()).toEqual([]);
  });
});
