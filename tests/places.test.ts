import { describe, expect, it } from "vitest";
import { TRICKS } from "@/db/events";
import { fold, type LoggedEvent } from "@/director/fold";
import { canLaunch } from "@/director/hub";
import { FILMS, FILMS_BY_JOURNEY, FIRST_MET } from "@/rig/academy";
import { drawFrom, factsOf, ENUMERABLE_TIERS, MAX_TIER, PLANETS_BY_TIER, type PlanetId } from "@/rig/pools";
import { lesson, type TrickId } from "@/rig/tricks";
import { seeded } from "@/engine/util";
import { hereIndex, hyperJump, journey, stopMarks } from "@/components/world/journey";
import { layoutPicture, solidDots, trickPicture } from "@/components/world/trickPictures";
import { STOP_WORDS, TRICK_REASON } from "@/components/world/words";
import { spriteDisc, BODY_IDS } from "@/worlds/space/bodies";

const cleared = (p: PlanetId): LoggedEvent => ({ type: "planet_cleared", payload: { planetId: p } });
const intro: LoggedEvent = { type: "intro_completed", payload: {} };
const onMars = () => fold([intro, cleared("earth"), cleared("moon")]);
const allCleared = () => fold([intro, ...PLANETS_BY_TIER.map(cleared)]);

describe("Star map journey", () => {
  it("runs from Mercury out to Deep Space, ten stops, with words for each", () => {
    const j = journey(fold([intro]));
    expect(j.map((s) => s.id)).toEqual(["mercury", "venus", ...PLANETS_BY_TIER]);
    for (const s of j) expect(STOP_WORDS[s.id].teaches.length).toBeGreaterThan(0);
    // far planets are said in words a child knows, never "2-digit × 1-digit"
    for (const id of ["jupiter", "saturn", "uranus", "deep-space"] as const) expect(STOP_WORDS[id].teaches).not.toMatch(/digit/i);
  });

  it("a brand-new cadet is on Earth, the warm-ups are open and everything past Earth is locked", () => {
    const s = fold([intro]), j = journey(s);
    expect(j[hereIndex(j)].id).toBe("earth");
    expect(j.filter((x) => x.warmup).every((x) => x.action === "warmup" && !x.locked)).toBe(true);
    expect(j.find((x) => x.id === "earth")).toMatchObject({ here: true, cleared: false, action: "launch" });
    expect(j.find((x) => x.id === "moon")).toMatchObject({ locked: true, action: null, lockedBy: "Clear Earth to open the Moon." });
    expect(j.find((x) => x.id === "asteroid-belt")?.lockedBy).toBe("Clear Mars to open the Asteroid Belt.");
  });

  it("a cadet on Mars has Earth and the Moon cleared (Practise), Mars to launch, the rest locked", () => {
    const j = journey(onMars());
    expect(j[hereIndex(j)].id).toBe("mars");
    expect(j.find((x) => x.id === "earth")).toMatchObject({ cleared: true, here: false, action: "practise" });
    expect(j.find((x) => x.id === "moon")).toMatchObject({ cleared: true, action: "practise" });
    expect(j.find((x) => x.id === "mars")).toMatchObject({ here: true, cleared: false, action: "launch" });
    expect(j.find((x) => x.id === "jupiter")).toMatchObject({ locked: true, action: null });
  });

  it("everything cleared: every planet is cleared and the cadet is in Deep Space", () => {
    const j = journey(allCleared());
    expect(j[hereIndex(j)].id).toBe("deep-space");
    expect(j.filter((x) => !x.warmup).every((x) => x.cleared && !x.locked)).toBe(true);
    expect(j.find((x) => x.id === "deep-space")?.action).toBe("launch");
  });

  it("never offers an action on a stop the director would refuse to launch", () => {
    for (const s of [fold([intro]), onMars(), allCleared()]) {
      for (const x of journey(s)) expect(x.action !== null).toBe(canLaunch(s, x.id));
    }
  });

  it("shows the Hyper-Jump only when it is close or earned", () => {
    expect(hyperJump(fold([intro]))).toBeNull();
    expect(hyperJump(allCleared())).toBeNull();
    const close = { ...onMars(), goldStreak: 1 };
    expect(hyperJump(close)).toEqual({ ready: false, text: "2 more perfect shots in a row and you can jump ahead to Jupiter." });
    const ready = { ...onMars(), goldStreak: 3, offers: { hyperJumpTo: 4, cushion: false, clear: false } };
    expect(hyperJump(ready)?.ready).toBe(true);
    expect(hyperJump(ready)?.text).toMatch(/jump ahead to Jupiter/);
  });

  it("gives each times-table stop ten marks per table, and far planets the facts met there", () => {
    const s = fold([intro]);
    expect(stopMarks(s, "moon").map((r) => r.label)).toEqual(["×2", "×5", "×10"]);
    expect(stopMarks(s, "moon").every((r) => r.marks.length === 10 && r.marks.every((m) => m === "new"))).toBe(true);
    expect(stopMarks(s, "mercury")).toEqual([]);
    expect(stopMarks(s, "jupiter")).toEqual([]);
  });
});

describe("Academy", () => {
  /** The first planet whose facts' Show Me How uses each trick, found from the router itself. */
  function firstMet(): Partial<Record<TrickId, PlanetId>> {
    const out: Partial<Record<TrickId, PlanetId>> = {};
    const note = (tier: number, a: number, b: number) => {
      for (const t of lesson(a, b).tricks) out[t] ??= PLANETS_BY_TIER[tier];
    };
    for (let tier = 0; tier <= MAX_TIER; tier++) {
      if (ENUMERABLE_TIERS.includes(tier)) for (const f of factsOf(tier)) { note(tier, f.a, f.b); note(tier, f.b, f.a); }
      else { const rng = seeded(tier + 11); for (let i = 0; i < 400; i++) { const f = drawFrom(tier, rng, i % 4); note(tier, f.a, f.b); } }
    }
    return out;
  }

  it("says truly where the journey first meets each trick", () => {
    expect(firstMet()).toEqual(FIRST_MET);
  });

  it("lists the ten tricks in the order the journey meets them, each with a plain reason", () => {
    expect(FILMS_BY_JOURNEY.map((f) => f.trick).sort()).toEqual([...TRICKS].sort());
    const tiers = FILMS_BY_JOURNEY.map((f) => PLANETS_BY_TIER.indexOf(FIRST_MET[f.trick]));
    expect(tiers).toEqual([...tiers].sort((x, y) => x - y));
    for (const t of TRICKS) expect(TRICK_REASON[t].length).toBeGreaterThan(10);
  });

  it("draws every trick picture with exactly a × b solid dots in each panel", () => {
    for (const f of FILMS) {
      for (const [a, b] of [[f.a, f.b], f.sister] as const) {
        const p = trickPicture(f.trick, a, b);
        expect(p.panels.length, f.card).toBeGreaterThan(0);
        for (const q of p.panels) expect(solidDots(q), `${f.card} ${a}×${b}: ${q.says}`).toBe(q.a * q.b);
        // the first panel is the fact itself; every other panel is the same number of ships, reshaped
        // (Empty & Mirror is the one exception: 0 × 7 is shown beside the mirror 1 × 7)
        expect(p.panels[0].a * p.panels[0].b).toBe(a * b);
        if (f.trick !== "empty-mirror") for (const q of p.panels) expect(q.a * q.b).toBe(a * b);
        // no two dots on top of each other
        for (const q of p.panels) expect(new Set(q.dots.map((d) => `${d.x},${d.y}`)).size).toBe(q.dots.length);
      }
    }
  });

  it("draws the two pictures the brief names exactly", () => {
    const flip = trickPicture("flip-it", 8, 3);
    expect(flip.panels.map((p) => [p.a, p.b, solidDots(p)])).toEqual([[8, 3, 24], [3, 8, 24]]);
    expect(flip.panels[0].h).toBe(8); // 8 rows
    expect(flip.panels[1].h).toBe(3); // 3 rows
    const dbl = trickPicture("double-it", 4, 7);
    const rows = [...new Set(dbl.panels[0].dots.map((d) => d.y))];
    expect(rows).toHaveLength(4); // 2 rows of 7, then 2 more rows of 7
    expect(dbl.panels[0].dots.filter((d) => d.kind === "one")).toHaveLength(14);
    expect(dbl.panels[0].dots.filter((d) => d.kind === "two")).toHaveLength(14);
  });

  it("lays every picture out inside its box", () => {
    for (const f of FILMS) {
      const l = layoutPicture(trickPicture(f.trick, f.a, f.b), 176, 88);
      expect(l.w * l.unit).toBeLessThanOrEqual(176.001);
      expect(l.h * l.unit).toBeLessThanOrEqual(88.001);
      expect(l.unit).toBeGreaterThan(1);
    }
  });
});

describe("Planet sprites", () => {
  it("hold each body's place with a circle no larger than the square", () => {
    for (const id of BODY_IDS) { expect(spriteDisc(id)).toBeGreaterThan(0.3); expect(spriteDisc(id)).toBeLessThanOrEqual(1); }
  });
});
