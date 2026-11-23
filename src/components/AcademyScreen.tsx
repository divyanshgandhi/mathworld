"use client";
import { Button } from "@ui-sdk/react/button";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FILMS, filmOf, type Film } from "@/rig/academy";
import { PLANETS_BY_TIER, tierOf } from "@/rig/pools";
import { WHY } from "@/rig/showme";
import type { Arena, ArenaUi } from "@/worlds/space/arena";
import { BattleHud } from "./battle/BattleHud";
import { ghost, glass, lime } from "./battle/ui";
import { useScene } from "./hub/Scene";
import { useCadet } from "./hub/useCadet";

/**
 * The Academy (/academy): every Trick Card's film on demand, played by the same Beat Player as
 * battle over a live fleet, every line of docs/tricks.md spoken. Then the cadet answers the We-Do,
 * and can try a sister fleet. Watching a card for the first time unlocks it onto the battle belt.
 */
export function AcademyScreen() {
  const router = useRouter();
  const { state, log, emit } = useCadet();
  const { box, stage } = useScene(() => ({ dispose() {} }));
  const [film, setFilm] = useState<{ f: Film; a: number; b: number; watch: boolean } | null>(null);
  const [arena, setArena] = useState<Arena | null>(null);
  const [ui, setUi] = useState<ArenaUi | null>(null);
  const want = useSyncExternalStore(() => () => {}, () => new URLSearchParams(location.search).get("trick"), () => null);
  const logRef = useRef(log);
  useEffect(() => { logRef.current = log; }, [log]);

  // idle: the Solar System drifts behind the card shelf; a film mounts the battle stage instead
  useEffect(() => {
    if (!stage) return;
    let gone = false, cleanup = () => {};
    (async () => {
      if (!film) {
        const { mountTitle } = await import("@/worlds/space/title");
        if (gone) return;
        const t = mountTitle(stage);
        cleanup = () => t.dispose();
        return;
      }
      const { mountArena } = await import("@/worlds/space/arena");
      if (gone) return;
      const planet = PLANETS_BY_TIER[tierOf(film.a, film.b) ?? 1];
      const a = mountArena(stage, { planet, history: logRef.current ?? [], onUi: setUi, onEvent: emit, force: { a: film.a, b: film.b }, academy: { film: film.watch } });
      window.__mw = { stage, arena: a };
      setArena(a);
      a.start();
      cleanup = () => { a.dispose(); setArena(null); setUi(null); };
    })();
    return () => { gone = true; cleanup(); };
  }, [stage, film, emit]);

  const watch = useCallback((f: Film) => setFilm({ f, a: f.a, b: f.b, watch: true }), []);
  const seen = (t: string) => (state?.seenTricks[t as keyof typeof state.seenTricks] ?? 0) > 0;
  const wanted = want ? filmOf(want) : null;

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#030612] text-white">
      <div ref={box} className="absolute inset-0" />
      <div className="absolute left-3 top-3 z-30 flex items-center gap-2">
        <Button aria-label="Resting Bay" onClick={() => router.push("/bay")} className={`${ghost} grid size-10 place-items-center bg-black/45 p-0 text-lg`}>⌂</Button>
        {film ? <Button aria-label="All Trick Cards" onClick={() => setFilm(null)} className={`${ghost} bg-black/45 px-3 py-2 text-sm`}>⚡ Cards</Button>
          : <span className={`${glass} pointer-events-none px-4 py-2 font-mono text-xs tracking-[0.25em] text-lime-200`}>THE ACADEMY</span>}
      </div>

      {!film && state && (
        <div className="absolute inset-0 z-20 overflow-y-auto px-3 pb-6 pt-20">
          <div className={`${glass} mx-auto w-[min(96vw,760px)] p-4 md:p-6`}>
            <p className="font-mono text-xs tracking-[0.3em] text-amber-300">TRICK FILMS</p>
            <p className="mt-1 text-sm text-white/70">Nova shows each trick on a real fleet, then you fire the answer. New cards go on your battle belt.</p>
            <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Trick Cards">
              {FILMS.map((f) => (
                <li key={f.trick}>
                  <Button aria-label={`Watch ${f.card}`} onClick={() => watch(f)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-lime-300 ${wanted?.trick === f.trick ? "border-lime-300 bg-lime-300/15" : seen(f.trick) ? "border-amber-300/50 bg-amber-300/10 hover:bg-amber-300/20" : "border-white/10 bg-white/[.03] hover:border-white/30"}`}>
                    <span className={`grid size-10 shrink-0 place-items-center rounded-lg text-lg ${seen(f.trick) ? "bg-amber-200 text-[#1a1406]" : "bg-white/10"}`}>⚡</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{f.card}{!seen(f.trick) && <span className="ml-2 rounded-full bg-sky-300/20 px-1.5 py-0.5 font-mono text-[10px] text-sky-200">NEW</span>}</span>
                      <span className="block truncate text-xs text-white/60">{f.a} × {f.b} · {WHY[f.trick]}</span>
                    </span>
                    <span className="font-mono text-xs text-lime-200">▶</span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {film && (
        <BattleHud arena={arena} ui={ui} launch={false}
          doneActions={() => (
            <>
              <Button className={`${lime} px-5 py-3 text-base`} onClick={() => setFilm({ ...film, a: film.f.sister[0], b: film.f.sister[1], watch: false })}>Try {film.f.sister[0]} × {film.f.sister[1]}</Button>
              <Button className={`${ghost} px-4 py-3 text-base`} onClick={() => watch(film.f)}>Watch again</Button>
              <Button className={`${ghost} px-4 py-3 text-base`} onClick={() => setFilm(null)}>All cards</Button>
            </>
          )} />
      )}
    </div>
  );
}
