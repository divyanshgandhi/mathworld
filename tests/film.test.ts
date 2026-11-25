import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readingTime, scheduleCaptions, splitCaption } from "@/engine/overlay";
import { BATTLE_LINES, FILM_LINES } from "@/worlds/space/lines";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
/** A caption plate two lines of `n` characters wide. */
const twoLines = (n: number) => (t: string) => {
  let lines = 1, used = 0;
  for (const w of t.split(" ")) { if (used && used + 1 + w.length > n) { lines++; used = w.length; } else used += (used ? 1 : 0) + w.length; }
  return lines <= 2;
};

describe("film captions", () => {
  it("a caption stays up for 1.5 s plus 0.3 s a word", () => {
    expect(readingTime("Two! Brilliant.")).toBeCloseTo(2.1);
    expect(readingTime("Knock, knock, knock.")).toBeCloseTo(2.4);
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
    expect(splitCaption(FILM_LINES.captain_danger, twoLines(40))).toEqual(["There is grave danger in deep space. Earth needs its sharpest young minds.", "We are enrolling five cadets today."]);
    expect(splitCaption(FILM_LINES.captain_brief3, twoLines(36))).toEqual([FILM_LINES.captain_brief3]);
  });

  it("each caption gets its share of the speech and never less than its reading time", () => {
    const pieces = splitCaption(FILM_LINES.captain_danger, twoLines(40)), { starts, hold } = scheduleCaptions(pieces, 6.26);
    expect(starts[0]).toBe(0);
    expect(starts[1]).toBeGreaterThanOrEqual(readingTime(pieces[0]) - 1e-9);
    expect(hold - starts[1]).toBeGreaterThanOrEqual(readingTime(pieces[1]) - 1e-9);
    // a short line with a long clip holds for the clip
    expect(scheduleCaptions(["Yes?"], 4).hold).toBe(4);
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

describe("film colours", () => {
  // a colour literal: 0xRRGGBB, #rgb / #rrggbb in a string, or rgb()/rgba()/hsl() with numbers typed in
  const raw = /0x[0-9a-fA-F]{6}\b|["'`]#[0-9a-fA-F]{3,8}["'`]|\b(?:rgba?|hsla?)\(\s*\d/;
  const files = ["src/worlds/space/intro.ts", "src/worlds/space/cast.ts", "src/worlds/space/classroom.ts", "src/worlds/space/town.ts", "src/worlds/space/hangar.ts", "src/worlds/space/hand.ts", "src/worlds/space/lines.ts", "src/components/IntroFilm.tsx", "src/engine/overlay.ts", "src/app/dev/cast/CastReview.tsx"];
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
