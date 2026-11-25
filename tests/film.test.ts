import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { keepWhole, PACE, readingTime, scheduleCaptions, splitCaption } from "@/engine/overlay";
import { BATTLE_LINES, FILM_LINES } from "@/worlds/space/lines";
import { ALLOWED, FILM_PACE, filmSchedule } from "@/worlds/space/pace";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
/** A caption plate two lines of `n` characters wide. */
const twoLines = (n: number) => (t: string) => {
  let lines = 1, used = 0;
  for (const w of t.split(" ")) { if (used && used + 1 + w.length > n) { lines++; used = w.length; } else used += (used ? 1 : 0) + w.length; }
  return lines <= 2;
};

describe("film captions", () => {
  it("a heard caption has no time of its own: it goes up and leaves with its voice", () => {
    expect(readingTime("Two! Brilliant.")).toBe(0);
    expect(scheduleCaptions(["Then call their names."], 1.211).hold).toBeCloseTo(1.211);
    // a long line in two captions: each has its share of the speech, and the line ends with the voice
    const pieces = splitCaption(FILM_LINES.teacher_intro, twoLines(36)), { starts, hold } = scheduleCaptions(pieces, 6.59);
    expect(pieces.length).toBeGreaterThan(1);
    expect(hold).toBeCloseTo(6.59);
    expect(starts.at(-1)!).toBeLessThan(6.59);
  });

  it("read alone (sound off, or no clip) a caption stays up for 0.8 s plus 0.42 s a word", () => {
    expect(readingTime("Two! Brilliant.", false)).toBeCloseTo(1.64);
    expect(readingTime("Knock, knock, knock.", false)).toBeCloseTo(2.06);
    // however a long line is cut, every caption of it has its own reading time
    const text = FILM_LINES.teacher_intro, pieces = splitCaption(text, twoLines(36)), { starts, hold } = scheduleCaptions(pieces, 0, false);
    pieces.forEach((p, i) => expect((starts[i + 1] ?? hold) - starts[i]).toBeCloseTo(readingTime(p, false)));
    // and the lips are never cut off: a line read faster than it is spoken still holds for the speech
    expect(scheduleCaptions(["Yes?"], 4, false).hold).toBe(4);
  });

  it("a hyphenated word stays on one line", () => {
    expect(keepWhole(FILM_LINES.nova_hi)).toBe("Hi! I am Nova, your co\u2011pilot. Ready for launch?");
    expect(keepWhole("Knock - knock")).toBe("Knock - knock"); // a dash between words is left alone
  });

  it("every line of the film is cut into captions of at most two lines, on a phone and on a desktop", () => {
    for (const width of [30, 36, 42]) {
      const fits = twoLines(width);
      for (const text of Object.values(FILM_LINES)) {
        const pieces = splitCaption(text, fits);
        expect(pieces.join(" ")).toBe(text); // nothing lost, nothing reordered
        for (const p of pieces) expect(fits(p), `${width}: ${p}`).toBe(true);
        // no caption is a one-word leftover
        if (pieces.length > 1) expect(pieces.at(-1)!.split(" ").length).toBeGreaterThan(1);
      }
    }
  });

  it("a break falls at the end of a sentence when there is one", () => {
    const danger = splitCaption(FILM_LINES.captain_danger, twoLines(30));
    expect(danger.length).toBeGreaterThan(1);
    for (const p of danger) expect(p).toMatch(/[.!?]$/);
    expect(splitCaption(FILM_LINES.captain_brief2, twoLines(36))).toEqual([FILM_LINES.captain_brief2]);
  });

});

describe("film words", () => {
  const vo = JSON.parse(read("public/vo/vo.json")) as Record<string, { text: string; duration: number; end?: number }>;
  const script = read("scripts/bake-voices.py");

  it("every film line is baked with the same words", () => {
    for (const [id, text] of Object.entries(FILM_LINES)) {
      expect(vo[id]?.text, id).toBe(text);
      expect(script, id).toContain(`("${id}",`);
      expect(vo[id].end ?? vo[id].duration, id).toBeGreaterThan(0.5);
    }
  });

  it("every battle line that has a clip says the same words as its caption", () => {
    for (const [id, text] of Object.entries(BATTLE_LINES)) if (vo[id]) expect(vo[id].text, id).toBe(text);
    expect(vo.nova_zero_squads.text).toBe(BATTLE_LINES.nova_zero_squads);
    expect(vo.nova_zero_each.text).toBe(BATTLE_LINES.nova_zero_each);
  });

  it("the film and Nova's own lines use the glossary: plasma balls, squads, ships", () => {
    const spoken = [...Object.values(FILM_LINES), ...Object.entries(vo).filter(([id]) => /^(nova_|captain_|teacher_|principal_|kid_)/.test(id)).map(([, c]) => c.text)].join(" ");
    for (const retired of [/squadron/i, /plasma cells?/i, /cannonballs?/i, /\binvaders?\b/i, /\benem(y|ies)\b/i]) expect(spoken, String(retired)).not.toMatch(retired);
  });
});

describe("film pacing", () => {
  const vo = JSON.parse(read("public/vo/vo.json")) as Record<string, { end?: number; duration: number }>;
  const spoken = (id: string) => vo[id].end ?? vo[id].duration;
  const within = (n: number, [lo, hi]: readonly [number, number]) => n >= lo - 1e-6 && n <= hi + 1e-6;
  /** The film on every plate, with sound on and off, with every invitation taken at once and with none taken. */
  const runs = [0, 30, 36, 42].flatMap((width) => [true, false].flatMap((heard) => [true, false].map((input) => ({
    name: `${heard ? "sound on" : "sound off"}, ${input ? "played" : "watched"}, ${width || "wide"} plate`, heard,
    film: filmSchedule({ heard, input, spoken, fits: width ? (_, t) => twoLines(width)(t) : undefined }),
  }))));

  it("every clip of the film is measured", () => {
    for (const id of Object.keys(FILM_LINES)) expect(spoken(id), id).toBeGreaterThan(0.5);
  });

  it("a reply comes 0.15 to 0.45 s after the line before it; the same speaker's next thought 0.3 to 0.6 s", () => {
    for (const { name, film } of runs) for (const [i, g] of film.gaps.entries()) {
      const label = `${name}: ${g.after} > ${g.before} (${g.seconds.toFixed(2)} s)`, a = film.lines[i], b = film.lines[i + 1];
      expect([a.id, b.id], label).toEqual([g.after, g.before]);
      if (g.kind === "reply") { expect(within(g.seconds, PACE.reply), label).toBe(true); expect(a.who, label).not.toBe(b.who); }
      else if (g.kind === "same") { expect(within(g.seconds, PACE.same), label).toBe(true); expect(a.who, label).toBe(b.who); }
      else if (g.kind === "scene") expect(within(g.seconds, PACE.scene), label).toBe(true);
      // the player's own time: the film is ready the moment they are
      else if (g.kind === "input") expect(within(g.seconds, [0, PACE.reply[1]]), label).toBe(true);
      // an invitation nobody takes: the story moves on
      else if (g.kind === "wait") expect(within(g.seconds, [0, PACE.wait]), label).toBe(true);
      else {
        // anything longer is on the short list, with what is happening on screen all the way through it
        const ok = ALLOWED[`${g.after}>${g.before}`];
        expect(ok, label).toBeTruthy();
        expect(ok.why.length, label).toBeGreaterThan(20);
        expect(g.seconds, label).toBeLessThanOrEqual(ok.max + 1e-6);
      }
    }
  });

  it("nothing holds in silence for more than 1.2 s unless it is on the short list, with its reason", () => {
    for (const { name, film } of runs) for (const h of film.holds) {
      const label = `${name}: ${h.name} (${h.seconds.toFixed(2)} s)`;
      if (h.name.endsWith("-wait")) { expect(h.seconds, label).toBeLessThanOrEqual(PACE.wait); continue; }
      if (h.seconds <= PACE.hold) continue;
      expect(ALLOWED[h.name], label).toBeTruthy();
      expect(ALLOWED[h.name].why.length, label).toBeGreaterThan(20);
      expect(h.seconds, label).toBeLessThanOrEqual(ALLOWED[h.name].max + 1e-6);
    }
    // the list stays short, and nothing on it is a pause between two people talking
    expect(Object.keys(ALLOWED).length).toBeLessThanOrEqual(10);
    expect(Object.keys(ALLOWED).filter((k) => k.includes(">"))).toEqual(["knock>principal_sorry", "teacher_pick_generic>captain_brief1"]);
  });

  it("a heard caption leaves with its voice; read alone it has 0.8 s plus 0.42 s a word; none overlaps the next", () => {
    for (const { name, heard, film } of runs) for (const [i, l] of film.lines.entries()) {
      const next = film.lines[i + 1]?.start ?? Infinity;
      l.captions.forEach((c, k) => {
        const label = `${name}: ${l.id} "${c.text}"`, words = c.text.split(/\s+/).length;
        // a caption gives way to the next line the moment that line starts, and never before its own time is up
        const shown = Math.min(c.off, next) - c.on;
        expect(shown, label).toBeGreaterThanOrEqual(c.need - 1e-6);
        if (!heard || l.who === "") expect(c.need, label).toBeCloseTo(PACE.read.base + PACE.read.word * words);
        if (k + 1 < l.captions.length) expect(c.off, label).toBeCloseTo(l.captions[k + 1].on);
      });
      const last = l.captions.at(-1)!;
      if (heard && l.who !== "") { expect(last.off - l.voiceEnd, l.id).toBeGreaterThanOrEqual(0); expect(last.off - l.voiceEnd, l.id).toBeLessThanOrEqual(PACE.linger + 1e-6); }
      expect(l.end, l.id).toBeGreaterThanOrEqual(l.voiceEnd - 1e-6); // nobody is cut off mid-word
    }
  });

  it("a join of two chapters takes a second at most, and an invitation waits five", () => {
    expect(FILM_PACE.fade.out + FILM_PACE.fade.in).toBeLessThanOrEqual(PACE.join);
    expect(FILM_PACE.arrival.clear).toBeLessThanOrEqual(PACE.join);
    expect(FILM_PACE.town.in).toBeLessThanOrEqual(PACE.join);
    for (const w of [FILM_PACE.question.wait, FILM_PACE.question.answer, FILM_PACE.nova.wait]) expect(w).toBeLessThanOrEqual(PACE.wait);
    expect(FILM_PACE.question.rival).toBeLessThan(FILM_PACE.question.wait); // a classmate's hand is up before the wait is over
    expect(read("src/components/IntroFilm.tsx")).toContain(`const FILM_FADE = { out: ${FILM_PACE.fade.out * 1000}, in: ${FILM_PACE.fade.in * 1000} };`);
  });

  it("the film is a film, not a wait: under two minutes with the sound on, played or only watched", () => {
    for (const { name, heard, film } of runs) expect(film.total, name).toBeLessThan(heard ? 120 : 150);
  });
});

describe("film colours", () => {
  // a colour literal: 0xRRGGBB, #rgb / #rrggbb in a string, or rgb()/rgba()/hsl() with numbers typed in
  const raw = /0x[0-9a-fA-F]{6}\b|["'`]#[0-9a-fA-F]{3,8}["'`]|\b(?:rgba?|hsla?)\(\s*\d/;
  const files = ["src/worlds/space/intro.ts", "src/worlds/space/cast.ts", "src/worlds/space/classroom.ts", "src/worlds/space/town.ts", "src/worlds/space/hangar.ts", "src/worlds/space/hand.ts", "src/worlds/space/lines.ts", "src/worlds/space/pace.ts", "src/components/IntroFilm.tsx", "src/engine/overlay.ts", "src/app/dev/cast/CastReview.tsx"];
  it("no film file writes a raw colour: every one is mixed from the tokens", () => {
    for (const f of files) {
      const hits = read(f).split("\n").map((l, i) => [i + 1, l] as const).filter(([, l]) => raw.test(l)).map(([n]) => n);
      expect(hits, f).toEqual([]);
    }
  });
  it("the interior look is built from the tokens", () => {
    const looks = read("src/worlds/looks.ts"), entry = looks.slice(looks.indexOf("  interior: {"), looks.indexOf("  // a single hero object on show"));
    expect(entry).not.toMatch(raw);
  });
});
