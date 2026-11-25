import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast, over } from "@/design/contrast";
import { COLOR, CSS_VARS, FILL, INK, MASTERY } from "@/design/tokens";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const kit = readFileSync(new URL("../src/components/kit/kit.css", import.meta.url), "utf8");
const norm = (v: string) => v.replace(/\s+/g, " ").replace(/\s*,\s*/g, ",").trim().toLowerCase();

/** Every `--name: value;` the stylesheet declares (first one wins), comments stripped. */
function declared(src: string) {
  const out = new Map<string, string>();
  for (const m of src.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) if (!out.has(m[1])) out.set(m[1], m[2]);
  return out;
}

describe("tokens and globals.css never drift", () => {
  const vars = declared(css);
  it.each(Object.entries(CSS_VARS))("%s matches tokens.ts", (name, value) => {
    expect(vars.has(name), `${name} is missing from globals.css`).toBe(true);
    expect(norm(vars.get(name)!)).toBe(norm(value));
  });
  it("declares no design variable that tokens.ts does not know", () => {
    const legacy = new Set(["--background", "--foreground", "--color-background", "--color-foreground"]);
    const extra = [...vars.keys()].filter((k) => !legacy.has(k) && !(k in CSS_VARS));
    expect(extra).toEqual([]);
  });
  it("the kit stylesheet writes no raw colour", () => {
    expect(kit.replace(/\/\*[\s\S]*?\*\//g, "").match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) ?? []).toEqual([]);
  });
});

describe("every text colour is readable on the void", () => {
  const grounds = { void: COLOR.void, panel: COLOR.panel, lift: FILL.lift, sheetOnVoid: `rgb(${over(FILL.sheet, COLOR.void).join(",")})` };
  const text = { "ink-1": INK[1], "ink-2": INK[2], "ink-3": INK[3], sky: COLOR.sky, gold: COLOR.gold, ember: COLOR.ember, recede: COLOR.recede };
  for (const [g, bg] of Object.entries(grounds)) {
    it.each(Object.entries(text))(`%s on ${g} is at least 4.5:1`, (_, fg) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("the deep cool (disk) is only for large display or marks: at least 3:1", () => {
    expect(contrast(COLOR.disk, COLOR.void)).toBeGreaterThanOrEqual(3);
  });
  it("text on a gold fill (the selection, a gold chip) uses the void and passes", () => {
    expect(contrast(COLOR.void, COLOR.gold)).toBeGreaterThanOrEqual(4.5);
  });
  it("every mastery mark but New stands out from the void at 3:1 (non-text contrast)", () => {
    for (const k of ["gold", "got", "learn"] as const) expect(contrast(MASTERY[k].color, COLOR.void)).toBeGreaterThanOrEqual(3);
  });
});
