import { describe, expect, it } from "vitest";
import { GREETINGS, GREET_SCREENS } from "@/teach/greetings";
import { COUNT_MS, freeArea, GUIDE_LINES, GUIDE_START, guideShows, guideStep, placeCaption, type GuideEvent, type GuideState, type GuideUi } from "@/teach/guide";
import { GUIDE_FIRST_SHOT, SEEN_KEY_RE, manualKey } from "@/teach/keys";
import { MANUAL_PAGES, pageOf } from "@/teach/manual";
import {
  arrayLayout, countFrame, countPeriod, fireFrame, firePeriod, flipFrame, flipLayouts, flipPeriod, missFrame, missPeriod, rewardFrame,
  rewardPeriod, squadsFrame, squadsPeriod, volleyEnd, volleyFrame, SCENE_H, SCENE_W,
} from "@/teach/scenes";
import { squadLook } from "@/teach/shipKinds";
import { MAX_WORDS, readMs, sentences, words } from "@/teach/words";
import { squadStyle } from "@/worlds/space/ships";
import { EventInput } from "@/db/events";

/** Every line a player reads from the teaching layer. */
const COPY = [
  ...MANUAL_PAGES.flatMap((p) => p.lines),
  ...Object.values(GREETINGS).map((g) => g.text),
  ...Object.values(GUIDE_LINES).map((l) => l.text),
];

/**
 * The words the teaching layer may use: everyday words a Grade 3 reader knows, plus the game's own
 * names from docs/glossary.md. A new word fails this test until someone reads it aloud as an
 * 8-year-old and adds it here on purpose.
 */
const ALLOWED = new Set(`
a again and answer answers away ball change clear count each earn easier facts few first-try flash fly for get
here how i in is it just know let's looks many me next no now number on one open past pick planet press real
rocket row shape ship ships show so some spend stuck take tap the them there these this time timer to too trick
try turn type welcome will win you your
`.split(/\s+/).filter(Boolean));
/** The game's own words, from docs/glossary.md: taught by the game itself, so allowed. */
const GAME_WORDS = new Set(["squad", "squads", "plasma", "orbs", "gold", "power-ups", "resting", "bay", "cadet", "launch", "fire", "show", "me", "how"]);
const BANNED = ["squadron", "squadrons", "calibrate", "calibration", "load", "telemetry", "radar", "sector", "drone", "drones", "invader", "ammo", "cannonball"];

describe("teaching copy", () => {
  it("never says more than 12 words in a sentence, and every caption fits the budget", () => {
    expect(MAX_WORDS).toBe(12);
    for (const line of COPY) for (const s of sentences(line)) expect(words(s).length, s).toBeLessThanOrEqual(MAX_WORDS);
    for (const g of Object.values(GREETINGS)) expect(words(g.text).length, g.text).toBeLessThanOrEqual(MAX_WORDS);
    for (const l of Object.values(GUIDE_LINES)) expect(words(l.text).length, l.text).toBeLessThanOrEqual(MAX_WORDS);
  });

  it("uses only plain words a Grade 3 reader knows, and none of the retired jargon", () => {
    for (const line of COPY) for (const w of words(line)) {
      const lw = w.toLowerCase();
      if (/^\d+$/.test(lw) || GAME_WORDS.has(lw)) continue;
      expect(ALLOWED.has(lw), `"${w}" in "${line}"`).toBe(true);
      expect(BANNED).not.toContain(lw);
    }
  });

  it("keeps each manual page to one picture and at most two lines", () => {
    expect(MANUAL_PAGES.length).toBeLessThanOrEqual(6);
    for (const p of MANUAL_PAGES) expect(p.lines.length).toBeLessThanOrEqual(2);
  });

  it("gives every screen one greeting, with a valid seen key", () => {
    for (const s of GREET_SCREENS) {
      expect(GREETINGS[s].key).toBe(`greet:${s}`);
      expect(SEEN_KEY_RE.test(GREETINGS[s].key)).toBe(true);
      expect(sentences(GREETINGS[s].text).length).toBeLessThanOrEqual(2);
    }
  });

  it("records only keys the event log accepts", () => {
    const keys = [GUIDE_FIRST_SHOT, ...MANUAL_PAGES.map((p) => manualKey(p.id)), ...GREET_SCREENS.map((s) => GREETINGS[s].key)];
    for (const key of keys) expect(EventInput.safeParse({ type: "seen", payload: { key } }).success, key).toBe(true);
  });

  it("times a line at 1.5 s plus 0.3 s a word", () => {
    expect(readMs("Count the ships.")).toBe(2400);
    expect(readMs("This is your Resting Bay. Press Launch to fly.")).toBe(1500 + 9 * 300);
    expect(COUNT_MS).toBe(2400);
  });

  it("opens the page a topic names", () => {
    expect(pageOf("fire")).toBe(2);
    expect(pageOf("orbs")).toBe(5);
    expect(pageOf("nope")).toBe(0);
    expect(pageOf(null)).toBe(0);
  });
});

describe("manual pictures are true arrays", () => {
  it("lays a × b out as a squads of b ships, in rows, styled like the battle", () => {
    for (const [a, b] of [[3, 4], [2, 3], [6, 2], [1, 5], [4, 1]]) {
      const ships = arrayLayout(a, b);
      expect(ships.length).toBe(a * b);
      const rows = new Set(ships.map((s) => s.y)), cols = new Set(ships.map((s) => s.x));
      expect(rows.size).toBe(a);
      expect(cols.size).toBe(b);
      for (const y of rows) expect(ships.filter((s) => s.y === y).length).toBe(b);
      // no two ships share a place
      expect(new Set(ships.map((s) => `${s.x},${s.y}`)).size).toBe(a * b);
      for (const s of ships) {
        expect(s.tone).toBe(squadStyle(s.squad, s.index).tone);
        expect(s.leader).toBe(b > 1 && squadStyle(s.squad, s.index).leader);
      }
      // squads are further apart than the ships inside a squad
      if (a > 1 && b > 1) expect(ships[b].y - ships[0].y - 30).toBeGreaterThan(ships[1].x - ships[0].x - 30);
    }
  });

  it("repeats the battle's squad styling exactly", () => {
    for (let s = 0; s < 12; s++) for (let i = 0; i < 12; i++) expect(squadLook(s, i)).toEqual(squadStyle(s, i));
  });

  it("fits every page's fleet inside the picture", () => {
    for (const p of MANUAL_PAGES) {
      if (p.scene.kind === "reward") continue;
      const ships = arrayLayout(p.scene.squads, p.scene.each);
      expect(ships.length).toBe(p.scene.squads * p.scene.each);
    }
    const cell = 30;
    for (const s of arrayLayout(3, 4, { cell, top: 24 })) {
      expect(s.x - cell / 2).toBeGreaterThanOrEqual(0);
      expect(s.x + cell / 2).toBeLessThanOrEqual(SCENE_W);
      expect(s.y + cell / 2).toBeLessThanOrEqual(SCENE_H);
    }
  });

  it("outlines the squads one after another, then all of them", () => {
    expect(squadsFrame(3, 0).outlined).toBe(1);
    expect(squadsFrame(3, 1000).outlined).toBe(2);
    expect(squadsFrame(3, squadsPeriod(3) - 1).outlined).toBe(3);
    expect(squadsFrame(3, null).outlined).toBe(3);
  });

  it("counts every ship once, up to the real total", () => {
    const n = 12;
    let last = 0;
    for (let t = 0; t < countPeriod(n); t += 50) { const c = countFrame(n, t).counted; expect(c).toBeGreaterThanOrEqual(last); last = c; }
    expect(last).toBe(n);
    expect(countFrame(n, null).counted).toBe(n);
  });

  it("fires one plasma ball for each ship and clears the fleet", () => {
    const ships = arrayLayout(2, 3), n = 6;
    const end = volleyFrame(ships, n, 160, 146, volleyEnd(n));
    expect(end.balls.length).toBe(n);
    expect(end.popped.filter(Boolean).length).toBe(n);
    expect(end.escaped).toBe(0);
    expect(end.past).toBe(0);
    const still = fireFrame(ships, 160, 146, null);
    expect(still.balls.length).toBe(n);
    for (let t = 0; t < firePeriod(n); t += 40) {
      const f = fireFrame(ships, 160, 146, t);
      expect(f.popped.filter(Boolean).length).toBeLessThanOrEqual(n);
      expect(f.balls.length === 0 || f.balls.length === n).toBe(true);
    }
  });

  it("shows a miss as the real difference: too few get away, too many fly past", () => {
    const left = arrayLayout(2, 3), right = arrayLayout(2, 3);
    const under = volleyFrame(left, 4, 80, 142, volleyEnd(4));
    expect(under.balls.length).toBe(4);
    expect(under.popped.filter(Boolean).length).toBe(4);
    expect(under.escaped).toBe(2);
    const over = volleyFrame(right, 8, 240, 142, volleyEnd(8));
    expect(over.balls.length).toBe(8);
    expect(over.popped.filter(Boolean).length).toBe(6);
    expect(over.past).toBe(2);
    expect(over.balls.filter((b) => b.on).length).toBe(2);
    const still = missFrame(left, right, 4, 8, { l: [80, 142], r: [240, 142] }, null);
    expect(still.under.popped.filter(Boolean).length).toBe(4);
    expect(still.over?.popped.filter(Boolean).length).toBe(6);
    expect(still.over?.balls.filter((b) => b.on).length).toBe(2);
    // the right half waits for the left
    expect(missFrame(left, right, 4, 8, { l: [80, 142], r: [240, 142] }, 100).over).toBeNull();
    expect(missPeriod()).toBeGreaterThan(0);
  });

  it("turns 6 squads of 2 into 2 squads of 6: the same ships, every one in a true place", () => {
    const { before, after, to } = flipLayouts(6, 2);
    expect(before.length).toBe(12);
    expect(new Set(to.map((s) => s.i)).size).toBe(12);
    expect(new Set(after.map((s) => s.y)).size).toBe(2);
    expect(new Set(after.map((s) => s.x)).size).toBe(6);
    expect(flipFrame(0).k).toBe(0);
    expect(flipFrame(null).k).toBe(1);
    expect(flipFrame(flipPeriod() - 1).k).toBeLessThan(0.01);
  });

  it("adds one orb for a first-try answer, then steps the fact to Gold", () => {
    expect(rewardFrame(4, 0)).toEqual({ right: false, orbs: 4, level: "learn" });
    expect(rewardFrame(4, null)).toEqual({ right: true, orbs: 5, level: "gold" });
    expect(rewardPeriod()).toBeGreaterThan(0);
  });
});

describe("the guided first shot", () => {
  const live: GuideUi = { wave: {}, canFire: true, lesson: null, done: null, offer: null };
  const run = (events: GuideEvent[], from: GuideState = GUIDE_START) => events.reduce(guideStep, from);

  it("rings the fleet, then the keypad, then Fire on the first digit, and is gone after the shot", () => {
    let s = run([{ type: "ui", ui: { ...live, canFire: false }, now: 0 }]);
    expect(s.step).toBe("wait");
    s = run([{ type: "ui", ui: live, now: 100 }], s);
    expect(s.step).toBe("count");
    expect(guideShows(s.step)?.anchor).toBe("fleet");
    s = run([{ type: "tick", now: 100 + COUNT_MS - 1 }], s);
    expect(s.step).toBe("count");
    s = run([{ type: "tick", now: 100 + COUNT_MS }], s);
    expect(s.step).toBe("type");
    expect(guideShows(s.step)?.anchor).toBe("keypad");
    s = run([{ type: "charge", n: 1, now: 3000 }], s);
    expect(s.step).toBe("fire");
    expect(guideShows(s.step)?.text).toBe("Now press Fire.");
    s = run([{ type: "charge", n: null, now: 3100 }], s);
    expect(s.step).toBe("type");
    s = run([{ type: "charge", n: 4, now: 3200 }, { type: "fire", now: 3300 }], s);
    expect(s.step).toBe("flying");
    expect(guideShows(s.step)).toBeNull();
    s = run([{ type: "ui", ui: live, now: 3400 }], s);
    expect(s.step).toBe("flying");
    s = run([{ type: "resolved", now: 4000 }, { type: "ui", ui: live, now: 4100 }, { type: "charge", n: 3, now: 4200 }], s);
    expect(s.step).toBe("done");
  });

  it("goes straight to Fire for a player who types during the first step", () => {
    const s = run([{ type: "ui", ui: live, now: 0 }, { type: "charge", n: 1, now: 200 }]);
    expect(s.step).toBe("fire");
  });

  it("steps aside for Show Me How and comes back at the keypad", () => {
    let s = run([{ type: "ui", ui: live, now: 0 }]);
    s = run([{ type: "ui", ui: { ...live, lesson: {} }, now: 500 }], s);
    expect(s.step).toBe("away");
    expect(guideShows(s.step)).toBeNull();
    s = run([{ type: "ui", ui: live, now: 900 }], s);
    expect(s.step).toBe("type");
  });

  it("puts its caption beside the thing it points at, on screen, never over it", () => {
    const view = { x: 12, y: 12, w: 351, h: 788 };
    const keypad = { x: 18, y: 520, w: 340, h: 270 };
    const p = placeCaption(keypad, { w: 200, h: 48 }, view);
    expect(p.side).toBe("above");
    expect(p.box.y + p.box.h).toBeLessThanOrEqual(keypad.y);
    expect(p.box.x).toBeGreaterThanOrEqual(view.x);
    expect(p.box.x + p.box.w).toBeLessThanOrEqual(view.x + view.w);
    // a side dock: no room above a tall dock, so it goes to the left
    const dock = { x: 1100, y: 20, w: 320, h: 860 };
    const q = placeCaption(dock, { w: 220, h: 48 }, { x: 12, y: 12, w: 1416, h: 876 });
    expect(q.side).toBe("left");
    expect(q.box.x + q.box.w).toBeLessThanOrEqual(dock.x);
    // it keeps clear of boxes it is told to avoid
    const fleet = { x: 60, y: 200, w: 255, h: 160 };
    const r = placeCaption(fleet, { w: 200, h: 48 }, view, [{ x: 0, y: 380, w: 375, h: 432 }], ["below", "above"]);
    expect(r.side).toBe("above");
  });

  it("finds the free part of the screen when the arena cannot say where the fleet is, and nothing without anchors", () => {
    const view = { x: 0, y: 0, w: 375, h: 812 };
    const a = freeArea(view, { x: 80, y: 12, w: 215, h: 110 }, { x: 18, y: 470, w: 340, h: 330 });
    expect(a).not.toBeNull();
    expect(a!.y).toBeGreaterThan(122);
    expect(a!.y + a!.h).toBeLessThan(470);
    const wide = freeArea({ x: 0, y: 0, w: 1440, h: 900 }, { x: 560, y: 12, w: 320, h: 130 }, { x: 1120, y: 300, w: 300, h: 580 });
    expect(wide!.x + wide!.w).toBeLessThan(1120);
    expect(freeArea(view, null, { x: 18, y: 470, w: 340, h: 330 })).toBeNull();
  });
});
