import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Every .ts/.tsx file under src/, except the two places allowed to touch the stage's bloom. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

describe("looks", () => {
  it("no scene sets its own bloom: only src/worlds/looks.ts (and the stage that owns it) touch it", () => {
    const allowed = [join("src", "worlds", "looks.ts"), join("src", "engine", "stage.ts")];
    const offenders = files("src").filter((p) => !allowed.some((a) => p.endsWith(a)) && /\.bloom\b/.test(readFileSync(p, "utf8")));
    expect(offenders).toEqual([]);
  });
});
