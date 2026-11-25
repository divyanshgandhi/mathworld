import { describe, expect, it } from "vitest";
import { TRICKS } from "@/db/events";
import { normalize } from "@/db/events";
import { seeded } from "@/engine/util";
import { fold, type LoggedEvent } from "@/director/fold";
import { CATALOG, purchase } from "@/director/hangar";
import { canLaunch, DECK_SIZE, flashcardDeck, hyperJumpStatus, mapStops, poster, posters } from "@/director/hub";
import { FILMS } from "@/rig/academy";
import { factKey } from "@/rig/pools";
import { planShowMeHow } from "@/rig/showme";
import { warmupProblem, warmupRun, WARMUP_LENGTH } from "@/rig/warmup";

const shot = (a: number, b: number, guess: number, ms = 1000, i = 1, planetId: "earth" | "moon" | "mars" = "moon", waveRole: "practice" | "tutorial" = "practice"): LoggedEvent => ({
  type: "attempt_submitted", payload: { a, b, planetId, guess, latencyMs: ms, errorType: null, attemptIndex: i, usedRadar: false, powerUpUsed: null, isTransferCheck: false, waveRole },
});
/** Orbs the honest way: first tries on different, careful (not Gold) facts. 7 first tries = 35 + 5 for the fifth in a row. */
const FACTS = [[2, 3], [2, 4], [2, 6], [2, 7], [2, 8], [2, 9], [3, 3], [3, 4], [3, 6], [3, 7], [3, 8], [3, 9]] as const;
const earn = (n: number): LoggedEvent[] => FACTS.slice(0, n).map(([a, b]) => shot(a, b, a * b, 9000));

describe("Resting Bay posters", () => {
  it("colour each fact by its mastery band and the poster by the lowest band reached", () => {
    expect(posters(fold([])).every((p) => p.band === "unseen")).toBe(true);
    // one thoughtful solve of 2 × 3: that fact is practicing, the ×2 and ×3 posters turn sky
    const s = fold([shot(2, 3, 6, 9000)]);
    expect(poster(s, 2).cells[2]).toEqual({ n: 3, key: "2x3", band: "practicing" });
    expect(poster(s, 2).band).toBe("practicing");
    expect(poster(s, 3).cells[1].key).toBe("2x3");
    expect(poster(s, 4).band).toBe("unseen");
    // every ×1 fact fast and repeated: the ×1 poster goes gold
    const log: LoggedEvent[] = [];
    for (let k = 0; k < 6; k++) for (let n = 1; n <= 10; n++) log.push(shot(1, n, n, 800, 1, "earth"));
    const g = poster(fold(log), 1);
    expect(g.band).toBe("gold");
    expect(g.gold).toBe(10);
  });
});

describe("Quick Flashcards", () => {
  it("deal 5 times-table cards, shaky facts first, deterministically", () => {
    const s = fold([shot(3, 8, 23), shot(3, 8, 24, 1000, 2, "mars"), shot(2, 5, 10, 900), shot(4, 7, 28, 9000, 1, "mars"), shot(6, 24, 144)]);
    const deck = flashcardDeck(s, seeded(3));
    expect(deck).toHaveLength(DECK_SIZE);
    expect(flashcardDeck(s, seeded(3))).toEqual(deck);
    const keys = deck.map((c) => factKey(c.a, c.b));
    expect(new Set(keys).size).toBe(DECK_SIZE);
    expect(keys).not.toContain("6x24"); // not a times-table card
    // the self-corrected 3 × 8 is the shakiest, so it comes first
    expect(keys[0]).toBe("3x8");
    for (const c of deck) expect(Math.max(c.a, c.b)).toBeLessThanOrEqual(10);
  });
  it("still deal a full deck to a brand-new cadet, from Earth's facts", () => {
    const deck = flashcardDeck(fold([]), seeded(1));
    expect(deck).toHaveLength(DECK_SIZE);
    for (const c of deck) expect(Math.min(c.a, c.b)).toBeLessThanOrEqual(1);
  });
});

describe("Solar System map", () => {
  it("lists Mercury and Venus as warm-ups, then the frontier, with locked planets ahead", () => {
    const stops = mapStops(fold([]));
    expect(stops.map((x) => x.id)).toEqual(["mercury", "venus", "earth", "moon", "mars", "asteroid-belt", "jupiter", "saturn", "uranus", "deep-space"]);
    expect(stops.slice(0, 2).every((x) => x.status === "warmup")).toBe(true);
    expect(stops[2].status).toBe("frontier");
    expect(stops.slice(3).every((x) => x.status === "locked")).toBe(true);
    expect(canLaunch(fold([]), "moon")).toBe(false);
    expect(canLaunch(fold([]), "venus")).toBe(true);
  });
  it("marks cleared and Ace-cleared planets, and the Hyper-Jump streak", () => {
    const tutorial = [[0, 5], [1, 7], [1, 3]].map(([a, b]) => shot(a, b, a * b, 9000, 1, "earth", "tutorial"));
    const s = fold([...tutorial, { type: "planet_cleared", payload: { planetId: "earth" } }, { type: "hyper_jump_taken", payload: { fromPlanet: "moon", toPlanet: "asteroid-belt" } }]);
    expect(fold([{ type: "planet_cleared", payload: { planetId: "earth" } }]).cleared).toEqual([]); // a clear with no passed mission is ignored
    const st = Object.fromEntries(mapStops(s).map((x) => [x.id, x.status]));
    expect(st).toMatchObject({ earth: "cleared", moon: "ace", mars: "ace", "asteroid-belt": "frontier", jupiter: "locked" });
    expect(canLaunch(s, "mars")).toBe(true);
    expect(hyperJumpStatus(s)).toMatchObject({ available: false, streak: 0, need: 3, to: "saturn" });
  });
});

describe("Hangar", () => {
  it("charges the catalogue price, never below zero, and re-equips owned items for free", () => {
    let log: LoggedEvent[] = earn(7);
    let s = fold(log);
    expect(s.orbs).toBe(40);
    expect(purchase(s, "hull", "nebula-violet")).toBeNull(); // 90 > 40, and the Moon is not cleared
    expect(purchase(s, "hull", "cadet-white")).toBeNull(); // already on
    const buy = purchase(s, "hull", "solar-gold")!;
    expect(buy.payload.cost).toBe(30);
    log = [...log, buy];
    s = fold(log);
    expect(s.orbs).toBe(10);
    expect(s.equipped.hull).toBe("solar-gold");
    // back to white (free), then gold again (owned: free)
    log = [...log, purchase(s, "hull", "cadet-white")!];
    s = fold(log);
    expect(s.orbs).toBe(10);
    expect(purchase(s, "hull", "solar-gold")!.payload.cost).toBe(0);
    // a forged event (cost 0 for a 240-orb blaster) does nothing
    s = fold([...log, { type: "upgrade_purchased", payload: { slot: "blaster", itemId: "nova-beam", cost: 0 } }]);
    expect(s.orbs).toBe(10);
    expect(s.equipped.blaster).toBeUndefined();
    for (const slot of ["hull", "blaster", "thruster"] as const) expect(CATALOG[slot][0].cost).toBe(0);
  });
});

describe("Academy films", () => {
  it("has one film per Trick Card, on a fleet that teaches that card, spoken in full", () => {
    expect(FILMS.map((f) => f.trick)).toEqual([...TRICKS]);
    for (const f of FILMS) {
      for (const [a, b] of [[f.a, f.b], f.sister]) {
        const p = planShowMeHow(a, b, {}, { film: true });
        expect(p.tricks, `${f.card} ${a}×${b}`).toContain(f.trick);
        expect(p.mode).toBe("full");
      }
      const film = planShowMeHow(f.a, f.b, {}, { film: true });
      // every beat of the doc is spoken, and it still ends on the We-Do
      expect(film.steps.every((s) => s.speech)).toBe(true);
      expect(film.steps.at(-1)?.show).toEqual({ kind: "wedo", answer: f.a * f.b });
      expect(film.steps.length).toBeGreaterThanOrEqual(planShowMeHow(f.a, f.b, {}).steps.filter((s) => s.speech).length);
    }
  });
});

describe("Mercury and Venus warm-ups", () => {
  it("stay within 20, never go negative, and are checked by the server", () => {
    const rng = seeded(9);
    for (let i = 0; i < 500; i++) {
      const add = warmupProblem("add", rng), sub = warmupProblem("sub", rng);
      expect(add.a + add.b).toBeLessThanOrEqual(20);
      expect(add.answer).toBe(add.a + add.b);
      expect(sub.answer).toBeGreaterThanOrEqual(0);
      expect(sub.a).toBeLessThanOrEqual(20);
    }
    const run = warmupRun("sub", seeded(2));
    expect(run).toHaveLength(WARMUP_LENGTH);
    const e = normalize({ type: "warmup_answered", payload: { op: "sub", a: 9, b: 9, guess: 0, latencyMs: 900, correct: false } });
    expect(e.type === "warmup_answered" && e.payload.correct).toBe(true);
    const s = fold([e, { type: "warmup_answered", payload: { op: "add", a: 7, b: 8, guess: 14, latencyMs: 900 } }]);
    expect(s.warmups).toEqual({ answered: 2, correct: 1 });
    expect(s.facts).toEqual({});
  });
});
