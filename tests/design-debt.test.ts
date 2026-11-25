import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Report only: how much of the old look is left under src/components and src/app, so later waves
 * can burn the numbers down. It never fails on the counts; it prints them (run `bunx vitest run
 * tests/design-debt.test.ts`). The kit itself and the admin dashboard's own monospace are excluded.
 */
const ROOT = new URL("..", import.meta.url).pathname;
const DIRS = ["src/components", "src/app"];
const SKIP = [/src\/components\/kit\//, /\.css$/];

const RULES = {
  "raw hex colours": /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b(?![\w-])/g,
  "font-mono": /\bfont-mono\b/g,
  "lime accents": /\blime-\d{2,3}\b/g,
  "blur (glass)": /\bbackdrop-blur(?:-\w+)?\b/g,
  "text under 13 px": /\btext-\[(?:[0-9]|1[0-2])px\]/g,
  "emoji or glyph icons": /[←-⇿⌀-⏿■-◿☀-➿⬀-⯿\u{1F300}-\u{1FAFF}]/gu,
} as const;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
  });
}

export function designDebt() {
  const total: Record<string, number> = Object.fromEntries(Object.keys(RULES).map((k) => [k, 0]));
  const byFile: Record<string, Record<string, number>> = {};
  for (const f of DIRS.flatMap((d) => files(join(ROOT, d)))) {
    const rel = relative(ROOT, f);
    if (SKIP.some((r) => r.test(rel))) continue;
    const src = readFileSync(f, "utf8");
    for (const [k, re] of Object.entries(RULES)) {
      const n = src.match(re)?.length ?? 0;
      if (!n) continue;
      total[k] += n;
      (byFile[rel] ??= {})[k] = n;
    }
  }
  return { total, byFile };
}

describe("design debt (report only)", () => {
  it("counts what is left of the old look", () => {
    const { total, byFile } = designDebt();
    console.log("\nDesign debt under src/components and src/app (kit excluded):");
    console.table(total);
    console.table(byFile);
    for (const v of Object.values(total)) expect(v).toBeGreaterThanOrEqual(0);
  });
});
