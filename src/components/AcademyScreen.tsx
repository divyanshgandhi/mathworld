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
import { Icon } from "./kit/Icon";
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
    <div className="fixed inset-0 select-none overflow-hidden bg-void text-approach">
      <div ref={box} className="absolute inset-0" />
      <div className="absolute left-3 top-3 z-30 flex items-center gap-2">
        <Button aria-label="Resting Bay" title="Resting Bay" onClick={() => router.push("/bay")} className="mw-btn mw-icon bg-void"><Icon name="home" size={20} /></Button>
        {film ? <Button aria-label="All tricks" onClick={() => setFilm(null)} className={`${ghost} bg-void`}><Icon name="trick" size={18} />All tricks</Button>
          : <span className="pointer-events-none flex h-11 items-center rounded-pill bg-void px-3 type-label text-ink-2">Academy</span>}
      </div>

      {!film && state && (
        <div className="absolute inset-0 z-20 overflow-y-auto px-3 pb-6 pt-20">
          <div className={`${glass} mx-auto w-[min(96vw,760px)] p-4 md:p-6`}>
            <h2 className="m-0 type-display text-[clamp(30px,5vw,44px)]">Academy</h2>
            <p className="mt-2 max-w-[56ch] type-body text-ink-2">Nova shows each trick on a real fleet, then you fire the answer. A trick you have watched goes on your battle belt as a Power-Up.</p>
            <ul className="mt-4 flex flex-col divide-y divide-line-1" aria-label="Tricks">
              {FILMS.map((f) => (
                <li key={f.trick}>
                  <Button aria-label={`Watch ${f.card}${seen(f.trick) ? " (on your belt)" : ""}`} onClick={() => watch(f)}
                    className={`flex w-full items-center gap-4 rounded-chip px-2 py-3.5 text-left transition hover:bg-raised ${wanted?.trick === f.trick ? "bg-raised" : ""}`}>
                    {/* a watched trick wears a gold ring: it is on the battle belt */}
                    <span className={`grid size-11 shrink-0 place-items-center rounded-full border ${seen(f.trick) ? "border-gold text-gold" : "border-line-2 text-ink-2"}`}><Icon name="trick" size={20} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block type-name text-[18px]">{f.card}</span>
                      <span className="mt-0.5 block type-body text-[17px] text-ink-2">{WHY[f.trick]} <span className="type-number whitespace-nowrap text-ink-3">({f.a} × {f.b})</span></span>
                    </span>
                    <Icon name="play" size={20} className="text-ink-2" />
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
              <Button className={`${ghost} px-4 py-3 text-base`} onClick={() => setFilm(null)}>All tricks</Button>
            </>
          )} />
      )}
    </div>
  );
}
