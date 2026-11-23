import { describe, expect, it } from "vitest";
import { Director, type Step } from "@/engine/director";
import { clamp, ease, keyframes, seeded } from "@/engine/util";

describe("Director", () => {
  const run = (steps: Step[], seconds: number, dt = 0.1) => {
    const ended: string[] = [];
    const d = new Director(steps, { onEnd: () => ended.push("end") });
    d.go(0);
    for (let t = 0; t < seconds; t += dt) d.update(dt);
    return { d, ended };
  };

  it("enters each step once and moves on after its duration", () => {
    const log: string[] = [];
    const { d, ended } = run([{ name: "a", d: 0.5, enter: () => log.push("a") }, { name: "b", d: 0.5, enter: () => log.push("b") }], 1.25);
    expect(log).toEqual(["a", "b"]);
    expect(d.running).toBe(false);
    expect(ended).toEqual(["end"]);
  });

  it("waits on a step without a duration until done() says so", () => {
    let answered = false;
    const { d } = run([{ name: "ask", done: () => answered }, { name: "next", d: 9 }], 3);
    expect(d.current?.name).toBe("ask");
    answered = true;
    d.update(0.1);
    expect(d.current?.name).toBe("next");
  });

  it("gives each step its own clock", () => {
    const seen: number[] = [];
    run([{ d: 0.3 }, { d: 1, update: (t) => seen.push(t) }], 0.6);
    expect(seen[0]).toBeCloseTo(0.1, 5);
  });

  it("finds chapters by name and runs beforeEnter first", () => {
    const order: string[] = [];
    const d = new Director<Step>([{ name: "x", d: 1 }, { name: "knock", enter: () => order.push("enter") }], { beforeEnter: () => order.push("before") });
    d.go(d.find("knock"));
    expect(order).toEqual(["before", "enter"]);
    expect(d.find("missing")).toBe(-1);
  });
});

describe("util", () => {
  it("clamps and eases inside 0..1", () => {
    expect(clamp(2)).toBe(1);
    expect(clamp(-1)).toBe(0);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5);
  });

  it("interpolates keyframes and holds the last value", () => {
    const lids = keyframes([[0, 0], [1, 1], [2, 0.5]]);
    expect(lids(0)).toBe(0);
    expect(lids(1)).toBe(1);
    expect(lids(9)).toBe(0.5);
  });

  it("repeats the same random sequence for the same seed", () => {
    const a = seeded(11), b = seeded(11);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
