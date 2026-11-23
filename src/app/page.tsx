import Link from "next/link";

/** Dev launch list until the Title Screen and Solar System map (Phase 4). Drills open one exact fleet. */
const PLANETS = [
  ["earth", "Earth · Cadet Bay", "×0 and ×1"], ["moon", "The Moon", "×2, ×5, ×10"], ["mars", "Mars", "×3, ×4"], ["asteroid-belt", "Asteroid Belt", "6–9 × 6–9"],
  ["jupiter", "Jupiter", "2-digit × 1-digit"], ["saturn", "Saturn", "2-digit × 2-digit"], ["uranus", "Uranus", "3-digit × 1–2 digit"], ["deep-space", "Deep Space", "unbounded"],
] as const;
const DRILLS = [
  ["earth", 0, 7], ["earth", 1, 10], ["moon", 3, 4], ["moon", 7, 10], ["mars", 3, 8], ["mars", 8, 3], ["mars", 4, 9], ["asteroid-belt", 7, 8],
  ["jupiter", 6, 24], ["jupiter", 4, 19], ["saturn", 16, 24], ["saturn", 24, 16], ["uranus", 7, 345], ["deep-space", 343, 4536],
] as const;

export default function Home() {
  return (
    <main className="fixed inset-0 overflow-y-auto bg-[radial-gradient(ellipse_at_top,#1b2350,#030612_70%)] px-6 py-10 text-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-lime-300">MATH WORLD</p>
          <h1 className="mt-2 text-4xl font-semibold">Answer to fire. Learn from the miss.</h1>
        </div>
        <Link href="/intro" className="w-fit rounded-xl bg-lime-300 px-6 py-3 font-medium text-[#0d0e1a] hover:bg-lime-200">▶ Start: the intro film</Link>
        <section>
          <p className="mb-3 font-mono text-xs tracking-[0.25em] text-white/50">PLANETS</p>
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {PLANETS.map(([id, name, note]) => (
              <li key={id}><Link href={`/play/${id}`} className="block rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 hover:border-lime-300/60"><span className="block">{name}</span><span className="text-xs text-white/50">{note}</span></Link></li>
            ))}
          </ul>
        </section>
        <section>
          <p className="mb-3 font-mono text-xs tracking-[0.25em] text-white/50">DEV DRILLS · every Power-Up unlocked, shot timings shown</p>
          <ul className="flex flex-wrap gap-2">
            {DRILLS.map(([p, a, b]) => (
              <li key={`${p}${a}x${b}`}><Link href={`/play/${p}?dev&a=${a}&b=${b}`} className="block rounded-lg border border-white/10 px-3 py-1.5 font-mono text-sm hover:border-lime-300/60">{a} × {b}</Link></li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
