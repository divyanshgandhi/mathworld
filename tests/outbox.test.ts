import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freshOnly } from "@/app/api/events/dedupe";

describe("event retry safety", () => {
  it("drops ids the server already stored for that cadet", () => {
    const seen = new Map<string, Set<string>>();
    expect(freshOnly(seen, "p1", ["a", "b"], ["1", "2"])).toEqual(["a", "b"]);
    expect(freshOnly(seen, "p1", ["a", "b", "c"], ["1", "2", "3"])).toEqual(["c"]);
    expect(freshOnly(seen, "p2", ["a"], ["1"])).toEqual(["a"]);
    expect(freshOnly(seen, "p1", ["x"], undefined)).toEqual(["x"]);
  });
});

describe("outbox", () => {
  const calls: unknown[] = [];
  let fail = true;
  beforeEach(() => {
    vi.useFakeTimers();
    calls.length = 0;
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: { body: string }) => {
      calls.push(JSON.parse(init.body));
      return fail ? Promise.reject(new TypeError("offline")) : new Response("{}", { status: 201 });
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

  it("keeps retrying with the same ids past three failures, and keeps the queue in storage", async () => {
    const ob = await import("@/engine/outbox");
    ob.post({ type: "planet_cleared", payload: { planetId: "earth" } });
    for (let i = 0; i < 8; i++) await vi.advanceTimersByTimeAsync(ob.backoff(i));
    expect(calls.length).toBeGreaterThan(3);
    expect(ob.saveState()).toBe("waiting");
    expect(JSON.parse(localStorage.getItem("mw:outbox")!)).toHaveLength(1);
    const ids = (calls as { ids: string[] }[]).map((c) => c.ids[0]);
    expect(new Set(ids).size).toBe(1);
    fail = false;
    await vi.advanceTimersByTimeAsync(10_000);
    await ob.flushed();
    expect(ob.saveState()).toBe("saved");
    expect(JSON.parse(localStorage.getItem("mw:outbox")!)).toHaveLength(0);
  });
});
