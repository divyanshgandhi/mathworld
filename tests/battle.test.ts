import { describe, expect, it } from "vitest";
import { TRICKS } from "@/db/events";
import { scaffold } from "@/director/next";
import { LADDER, nextHint } from "@/battle/hints";
import { PLANET_THEMES } from "@/battle/planets";
import { fittingPowerUps, POWERUPS } from "@/battle/powerups";
import { doubleSide } from "@/battle/powerups/shared";
import { ORB_RULES, planetClearOrbs, waveClearOrbs } from "@/battle/rewards";
import { canAim, hintState, initialBattle, MASH_LATENCY_MS, reduce, routeMiss, WILD_WINDOW_MS, type BattleAction, type BattleState } from "@/battle/state";
import { classifyError } from "@/rig/errors";
import { pickMissLine } from "@/battle/lines";
import { PLANETS_BY_TIER } from "@/rig/pools";
import { CARD, powerUpFits } from "@/rig/tricks";
import { BATTLE_LINES, POWERUP_LINE } from "@/worlds/space/lines";
import { COMBAT_LINES } from "@/battle/lines";

const run = (actions: BattleAction[], s: BattleState = initialBattle()) => actions.reduce(reduce, s);
const aiming = (a: number, b: number) => run([{ type: "start" }, { type: "wave", a, b }, { type: "ready" }]);
/** Fire `guess` at the wave and resolve it (a miss at `now` ms). */
const shot = (s: BattleState, guess: number, { now = 0, latencyMs = 6000, tier = 2, radar = false } = {}) => {
  const { a, b } = s.wave!;
  const fired = reduce(s, { type: "fire", radar });
  return guess === a * b ? reduce(fired, { type: "exact" }) : reduce(fired, { type: "miss", guess, errorType: classifyError(a, b, guess), latencyMs, now, tier });
};

describe("battle phase machine", () => {
  it("briefing → next → aiming, and the keypad is live only while aiming or in a lesson", () => {
    let s = initialBattle();
    expect(s.phase).toBe("briefing");
    expect(canAim(s)).toBe(false);
    s = reduce(s, { type: "start" });
    expect(s.phase).toBe("next");
    s = reduce(s, { type: "wave", a: 3, b: 8 });
    expect(s.phase).toBe("next");
    expect(canAim(s)).toBe(false);
    s = reduce(s, { type: "ready" });
    expect(s.phase).toBe("aiming");
    expect(canAim(s)).toBe(true);
  });

  it("a shot is counted once, and a shot while not aiming is ignored", () => {
    const s = aiming(3, 8), fired = reduce(s, { type: "fire", radar: false });
    expect(fired.phase).toBe("volley");
    expect(fired.attempts).toBe(1);
    expect(reduce(fired, { type: "fire", radar: false })).toBe(fired);
    expect(reduce(initialBattle(), { type: "fire", radar: false }).attempts).toBe(0);
  });

  it("the Radar flag sticks for the rest of the wave", () => {
    let s = shot(aiming(3, 8), 5, { radar: true });
    s = reduce(s, { type: "ready" });
    s = shot(s, 6);
    expect(s.usedRadar).toBe(true);
    expect(reduce(s, { type: "wave", a: 2, b: 2 }).usedRadar).toBe(false);
  });

  it("an exact shot resolves, clears, and builds the first-try streak", () => {
    let s = shot(aiming(3, 8), 24);
    expect(s.phase).toBe("resolve");
    s = reduce(s, { type: "cleared" });
    expect(s.phase).toBe("cleared");
    expect(s.streak).toBe(1);
    s = run([{ type: "wave", a: 4, b: 6 }, { type: "ready" }], s);
    s = reduce(shot(s, 24), { type: "cleared" });
    expect(s.streak).toBe(2);
    // a miss first: the clear is not first-try, and the streak resets
    s = run([{ type: "wave", a: 5, b: 6 }, { type: "ready" }], s);
    s = shot(s, 20);
    expect(s.streak).toBe(0);
    s = reduce(shot(reduce(s, { type: "ready" }), 30), { type: "cleared" });
    expect(s.streak).toBe(0);
  });

  it("0 is a valid answer", () => {
    const s = shot(aiming(0, 7), 0);
    expect(s.phase).toBe("resolve");
    expect(shot(aiming(0, 7), 7).phase).toBe("hint");
  });

  it("a new wave resets the per-wave state and keeps the streak", () => {
    let s = reduce(shot(aiming(3, 8), 24), { type: "cleared" });
    s = shot(run([{ type: "wave", a: 6, b: 7 }, { type: "ready" }], s), 40);
    s = reduce(s, { type: "lesson", fallback: true });
    const w = reduce(s, { type: "wave", a: 2, b: 9 });
    expect(w).toMatchObject({ attempts: 0, usedRadar: false, lessons: 0, fallbackUsed: false, lessonOn: false, lastMiss: null, wild: [], charge: null, wave: { a: 2, b: 9 } });
    expect(w.waveNo).toBe(s.waveNo + 1);
    expect(w.hint.level).toBe(0);
  });

  it("misses follow scaffold(): the invite on miss 2 (never a Radar), Show Me How on miss 3", () => {
    let s = shot(aiming(3, 8), 23); // close
    expect(s.lastMiss).toEqual({ kind: "react", mash: false, radar: false, invite: false });
    s = shot(aiming(3, 8), 2); // way off: still no Radar on the first miss
    expect(s.lastMiss).toMatchObject({ kind: "react", radar: false, invite: false });
    s = shot(reduce(shot(aiming(3, 8), 23), { type: "ready" }), 22);
    expect(s.lastMiss).toMatchObject({ kind: "react", radar: false, invite: true });
    s = shot(reduce(s, { type: "ready" }), 21);
    expect(s.lastMiss?.kind).toBe("show-me-how");
    for (let misses = 1; misses <= 5; misses++) {
      const sc = scaffold(misses);
      const r = routeMiss({ ...aiming(3, 8), attempts: misses }, 3, 8, 20, false, 2);
      if (sc.showMeHow) expect(r.kind).toBe("show-me-how");
      else expect(r).toMatchObject({ kind: "react", radar: sc.radar, invite: sc.invite });
    }
  });

  it("a miss after a lesson on an early level drops to the safety net, once a wave", () => {
    let s = reduce(aiming(6, 7), { type: "lesson", fallback: false });
    s = reduce(s, { type: "ready" });
    expect(s.phase).toBe("lesson");
    s = shot(s, 40, { tier: 2 });
    expect(s.lastMiss?.kind).toBe("safety-net");
    s = reduce(reduce(s, { type: "lesson", fallback: true }), { type: "ready" });
    s = shot(reduce(s, { type: "lesson_end" }), 41, { tier: 2 });
    expect(s.lastMiss?.kind).toBe("react");
    // beyond tier 3 (or a multi-digit fleet) there is no safety net
    let far = reduce(aiming(6, 7), { type: "lesson", fallback: false });
    far = shot(far, 40, { tier: 5 });
    expect(far.lastMiss?.kind).toBe("react");
  });

  it("anti-mash: three fast wild guesses inside 12 s ask the cadet to hold fire", () => {
    const wild = (s: BattleState, now: number, latencyMs = 1000) => reduce(shot(s, 900, { now, latencyMs }), { type: "ready" });
    expect(classifyError(3, 8, 900)).toBe("wild_guess");
    let s = wild(aiming(3, 8), 0);
    s = wild(s, 2000);
    expect(s.lastMiss?.mash).toBe(false);
    s = shot(s, 900, { now: 4000, latencyMs: 1000 });
    expect(s.lastMiss?.mash).toBe(true);
    expect(s.wild).toEqual([]);
    // spread out: the old ones fall out of the window
    let slow = wild(aiming(3, 8), 0);
    slow = wild(slow, WILD_WINDOW_MS + 1);
    slow = shot(slow, 900, { now: WILD_WINDOW_MS + 2, latencyMs: 1000 });
    expect(slow.lastMiss?.mash).toBe(false);
    // a slow third guess is thinking, not mashing
    let thought = wild(wild(aiming(3, 8), 0), 1000);
    thought = shot(thought, 900, { now: 2000, latencyMs: MASH_LATENCY_MS });
    expect(thought.lastMiss?.mash).toBe(false);
  });

  it("Show Me How keeps the keypad live and ends cleanly", () => {
    let s = reduce(aiming(3, 8), { type: "lesson", fallback: false });
    expect(s).toMatchObject({ phase: "lesson", lessonOn: true, lessons: 1 });
    expect(canAim(s)).toBe(true);
    const fired = reduce(s, { type: "fire", radar: false });
    expect(fired.phase).toBe("volley");
    expect(reduce(fired, { type: "lesson_end" })).toMatchObject({ phase: "volley", lessonOn: false });
    s = reduce(s, { type: "lesson_end" });
    expect(s).toMatchObject({ phase: "aiming", lessonOn: false });
    expect(reduce(s, { type: "lesson_end" })).toBe(s);
  });

  it("offer and done take the fleet away; charge holds the typed digits", () => {
    expect(reduce(aiming(3, 8), { type: "offer" })).toMatchObject({ phase: "offer", wave: null });
    expect(reduce(aiming(3, 8), { type: "done" })).toMatchObject({ phase: "done", wave: null });
    let s = reduce(aiming(3, 8), { type: "charge", n: 24 });
    expect(s.charge).toBe(24);
    s = reduce(s, { type: "fire", radar: false });
    expect(s.charge).toBeNull();
  });
});

describe("hint ladder", () => {
  it("is data: one rung per miss up to Show Me How, cumulative reveals", () => {
    expect(LADDER.map((r) => [r.id, r.misses])).toEqual([["squads", 1], ["each", 2], ["show-me-how", 3]]);
    expect(LADDER[1].reveal).toEqual(["squads", "each"]);
    expect(LADDER[1].flagPowerUp).toBe(true);
    expect(LADDER[0].afterLine).toBe(true);
  });

  it("agrees with scaffold(): the invite on miss 2 and Show Me How on miss 3", () => {
    for (const r of LADDER) {
      const sc = scaffold(r.misses);
      expect(sc.showMeHow).toBe(r.showMeHow);
      if (r.flagPowerUp && !r.showMeHow) expect(sc.invite).toBe(true);
    }
  });

  it("a fact never met gets the squads label softly at once; a known fact gets nothing unprompted", () => {
    const first = nextHint({ misses: 0, level: 0, asked: false }, "unseen");
    expect(first).toMatchObject({ id: "squads", soft: true, trigger: "first-sight", afterLine: false });
    for (const tier of ["practicing", "understood", "gold"] as const) expect(nextHint({ misses: 0, level: 0, asked: false }, tier)).toBeNull();
    expect(nextHint({ misses: 0, level: 0, asked: false, soft: true }, "unseen")).toBeNull();
  });

  it("climbs one rung per miss and never repeats one", () => {
    expect(nextHint({ misses: 1, level: 0, asked: false }, "gold")).toMatchObject({ id: "squads", level: 1, trigger: "miss", soft: false });
    expect(nextHint({ misses: 1, level: 1, asked: false }, "gold")).toBeNull();
    expect(nextHint({ misses: 2, level: 1, asked: false }, "gold")).toMatchObject({ id: "each", flagPowerUp: true });
    expect(nextHint({ misses: 3, level: 2, asked: false }, "gold")).toMatchObject({ id: "show-me-how", showMeHow: true });
    expect(nextHint({ misses: 5, level: 3, asked: false }, "gold")).toBeNull();
    // a soft first sight still firms up on miss 1
    expect(nextHint({ misses: 1, level: 0, asked: false, soft: true }, "unseen")).toMatchObject({ id: "squads", level: 1 });
  });

  it("asking Nova jumps straight to Show Me How", () => {
    expect(nextHint({ misses: 0, level: 0, asked: true }, "gold")).toMatchObject({ id: "show-me-how", trigger: "asked" });
    expect(nextHint({ misses: 1, level: 3, asked: true }, "gold")).toBeNull();
  });

  it("the reducer records what the ladder revealed", () => {
    let s = aiming(3, 8);
    s = reduce(s, { type: "hint", step: nextHint(hintState(s), "unseen")! });
    expect(s.hint).toMatchObject({ level: 0, soft: true, squads: true, each: false });
    s = shot(s, 20);
    s = reduce(s, { type: "hint", step: nextHint(hintState(s), "unseen")! });
    expect(s.hint).toMatchObject({ level: 1, squads: true, each: false, powerUp: false });
    s = shot(reduce(s, { type: "ready" }), 21);
    s = reduce(s, { type: "hint", step: nextHint(hintState(s), "unseen")! });
    expect(s.hint).toMatchObject({ level: 2, squads: true, each: true, powerUp: true });
    expect(nextHint(hintState(reduce(s, { type: "ask" })), "unseen")?.id).toBe("show-me-how");
  });
});

describe("rewards", () => {
  it("pays what the battle always paid", () => {
    expect(waveClearOrbs("campaign", 1)).toBe(5);
    expect(waveClearOrbs("practice", 1)).toBe(5);
    expect(waveClearOrbs("campaign", 2)).toBe(3);
    expect(waveClearOrbs("practice", 4)).toBe(3);
    expect(waveClearOrbs("academy", 1)).toBe(0);
    expect(planetClearOrbs()).toBe(20);
    expect(ORB_RULES.planet_cleared.amount).toBe(20);
  });
});

describe("Power-Up registry", () => {
  const multi: [number, number][] = [[6, 24], [24, 6], [19, 24], [24, 19], [16, 24], [342, 2647], [12, 12], [11, 9], [9, 11], [25, 4], [4, 25], [15, 6], [99, 7], [7, 99], [10, 12], [12, 10], [3, 12], [20, 5], [5, 20], [29, 3], [199, 4], [45, 8]];
  const facts: [number, number][] = [...multi];
  for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) facts.push([a, b]);

  it("has one entry per trick, named as its card", () => {
    expect(Object.keys(POWERUPS).sort()).toEqual([...TRICKS].sort());
    for (const t of TRICKS) {
      expect(POWERUPS[t].id).toBe(t);
      expect(POWERUPS[t].name).toBe(CARD[t]);
    }
  });

  it("fits() is exactly powerUpFits over 0–10 × 0–10 and multi-digit facts: no battle-only exceptions", () => {
    for (const t of TRICKS) for (const [a, b] of facts) expect(POWERUPS[t].fits(a, b), `${t} ${a}×${b}`).toBe(powerUpFits(t, a, b));
    // the two old exceptions: a side of 10 is now ten real squads or ten real ships
    expect(POWERUPS["fast-adding"].fits(10, 6)).toBe(true);
    expect(POWERUPS["split-and-add"].fits(6, 10)).toBe(true);
    expect(POWERUPS["split-and-add"].fits(10, 7)).toBe(true);
  });

  it("an empty fleet fits only Empty & Mirror", () => {
    for (let n = 0; n <= 10; n++) expect(fittingPowerUps(TRICKS, 0, n)).toEqual(["empty-mirror"]);
  });

  it("Nova's line for each Power-Up is its POWERUP_LINE, apart from Sector-Lock and Easy 5", () => {
    const fvWith = (pod: boolean) => ({ views: pod ? [{ kind: "pod" }] : [{ kind: "fighter" }] }) as never;
    for (const t of TRICKS) {
      const line = POWERUPS[t].line({ a: 6, b: 7, sectorLock: false, fv: fvWith(true) });
      expect(line).toBe(POWERUP_LINE[t]);
      expect(BATTLE_LINES[line]).toBeTruthy();
    }
    expect(POWERUPS["big-small-split"].line({ a: 16, b: 24, sectorLock: true, fv: fvWith(true) })).toBe("pu_sector");
    expect(POWERUPS["easy-5-10"].line({ a: 5, b: 7, sectorLock: false, fv: fvWith(false) })).toBe("pu_easy5");
    expect(POWERUPS["easy-5-10"].line({ a: 10, b: 7, sectorLock: false, fv: fvWith(false) })).toBe("pu_easy");
  });

  it("Double It! halves the 2 or 4 side, never against a 5, 9 or 10", () => {
    expect(doubleSide(2, 7)).toBe(2);
    expect(doubleSide(4, 6)).toBe(4);
    expect(doubleSide(2, 4)).toBe(2);
    expect(doubleSide(4, 2)).toBe(2); // the 2 side wins
    expect(doubleSide(4, 5)).toBe(4);
  });
});

describe("planet themes", () => {
  it("every planet has a theme whose lines exist", () => {
    for (const p of PLANETS_BY_TIER) {
      const t = PLANET_THEMES[p];
      expect(t.id).toBe(p);
      expect(t.mood).toBe("battle");
      const all = { ...BATTLE_LINES, ...COMBAT_LINES } as Record<string, string>;
      expect(all[t.briefing]).toBeTruthy();
      // the first wave's line names no structure (decision 2): "squads" comes only from the hint ladder
      expect(all[t.briefing]).not.toMatch(/squad/i);
      expect((BATTLE_LINES as Record<string, string>)[t.clear]).toBeTruthy();
    }
    expect(PLANET_THEMES.earth.intro).toBe("nova_greet_battle");
    expect(PLANET_THEMES.earth.introClear).toBe("nova_earth_clear");
  });
  it("no battle line Nova says live uses a retired word", () => {
    for (const t of Object.values(COMBAT_LINES)) expect(t).not.toMatch(/\b(load|sneaky|squadrons?|radar|telemetry|ace)\b/i);
  });
});

describe("Earth's first waves", () => {
  it("a new cadet meets no empty fleet until two Earth fleets are cleared", async () => {
    const { initialState } = await import("@/director/fold");
    const { nextWave } = await import("@/director/next");
    const { factKey } = await import("@/rig/pools");
    for (let seed = 1; seed < 60; seed++) {
      const s = initialState();
      const solve = (a: number, b: number) => { s.history.push({ a, b, key: factKey(a, b), factTier: 0, tier: 0, role: "tutorial", outcome: "fast", transfer: false, trick: "empty-mirror", afterLesson: false }); s.waves++; };
      const w1 = nextWave(s, seed);
      expect(w1.a).toBe(1);
      solve(w1.a, w1.b);
      const w2 = nextWave(s, seed);
      expect(w2.a * w2.b).toBeGreaterThan(0);
      expect(factKey(w2.a, w2.b)).not.toBe(factKey(w1.a, w1.b));
    }
  });
});

describe("miss lines tell the truth about the picture", () => {
  const line = (a: number, b: number, n: number) => pickMissLine(classifyError(a, b, n), n > a * b, n, a, b);
  it("says one squad off only for exactly one squad of ships", () => {
    expect(line(3, 4, 8)).toBe("nova_err_group");
    expect(line(3, 4, 9)).toBe("nova_too_few"); // 3 got away, a squad is 4
    expect(line(1, 4, 0)).toBe("nova_too_few"); // nothing fired is not close
  });
  it("keeps 'a hair off' for small gaps and plain words for a sum", () => {
    expect(line(1, 4, 2)).toBe("nova_too_few");
    expect(line(6, 7, 41)).toBe("nova_err_unit");
    expect(line(6, 7, 13)).toBe("nova_too_few");
    expect(line(0, 10, 10)).toBe("nova_too_many");
  });
});
