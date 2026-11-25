import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMBAT_LINES } from "@/battle/lines";
import { lineKey } from "@/rig/showme";
import { GREETINGS } from "@/teach/greetings";
import { GUIDE_LINES } from "@/teach/guide";
import { BATTLE_LINES, ERROR_LINE, FILM_LINES } from "@/worlds/space/lines";

/**
 * Every spoken line has a baked clip that says its caption, and every clip belongs to a line.
 * Lines live in four tables (the film, the battle, the combat track's lines, the greetings and the
 * guide). Show Me How clips are matched by their words at run time (audio.clipFor), so they count as
 * lines when their id is a trick line (`tr_`) or their words are in the trick scripts.
 */
const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const vo = JSON.parse(read("public/vo/vo.json")) as Record<string, { text: string; duration: number; end?: number; src: string }>;
const files = readdirSync(join(root, "public/vo")).filter((f) => f.endsWith(".mp3")).map((f) => f.slice(0, -4));
const script = read("scripts/bake-voices.py");
const tricks = read("src/rig/tricks.ts");

const LINES: Record<string, string> = {
  ...FILM_LINES, ...BATTLE_LINES, ...COMBAT_LINES,
  ...Object.fromEntries(Object.values(GREETINGS).map((g) => [g.id, g.text])),
  ...Object.fromEntries(Object.values(GUIDE_LINES).map((g) => [g.id, g.text])),
};
/** The words of every string in the trick scripts, keyed the way the Beat Player matches a clip. */
const trickKeys = new Set([...tricks.matchAll(/"([^"\n]*)"/g)].map((m) => lineKey(m[1])));
const lessonClip = (id: string) => id.startsWith("tr_") || trickKeys.has(lineKey(vo[id].text));

describe("voice clips", () => {
  it("every line has a clip that says exactly its caption", () => {
    for (const [id, text] of Object.entries(LINES)) {
      expect(vo[id]?.text, `${id} has no clip`).toBe(text);
      expect(script, id).toContain(`("${id}",`);
    }
  });

  it("every clip belongs to a line: no orphans", () => {
    expect(Object.keys(vo).filter((id) => !(id in LINES) && !lessonClip(id))).toEqual([]);
  });

  it("the manifest and the files match, one for one", () => {
    expect([...files].sort()).toEqual(Object.keys(vo).sort());
    for (const [id, c] of Object.entries(vo)) {
      expect(c.src, id).toBe(`/vo/${id}.mp3`);
      expect(existsSync(join(root, "public", c.src)), id).toBe(true);
    }
  });

  it("every clip is a plausible length", () => {
    for (const [id, c] of Object.entries(vo)) {
      expect(c.duration, id).toBeGreaterThanOrEqual(0.4);
      expect(c.duration, id).toBeLessThanOrEqual(9);
    }
  });

  it("retired lines are gone and the wild guess points at the line the arena plays", () => {
    for (const id of ["nova_l0_intro", "captain_brief3", "captain_brief4", "nova_radar", "nova_invite"]) {
      expect(vo[id], id).toBeUndefined();
      expect(LINES[id], id).toBeUndefined();
    }
    expect(ERROR_LINE.wild_guess).toBe("nova_err_way_off");
    for (const id of Object.values(ERROR_LINE)) expect(vo[id], id).toBeDefined();
  });
});
