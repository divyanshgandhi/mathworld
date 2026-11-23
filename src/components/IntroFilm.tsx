"use client";
import { Button } from "@ui-sdk/react/button";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushed, history, post } from "@/engine/outbox";
import type { Stage } from "@/engine/stage";
import type { Bay, BayUi } from "@/worlds/space/cadetBay";
import type { Chapter, Film, FilmUi } from "@/worlds/space/intro";
import { BattleHud } from "./battle/BattleHud";
import { CadetSignUp, ghost, glass, lime } from "./battle/ui";

const CHAPTERS: [Chapter, string][] = [["orbit", "Earth"], ["dive", "Dive"], ["wake", "Classroom"], ["knock", "The knock"], ["hangar", "Hangar"]];

/**
 * The opening film and Level 0 as one full-screen game: the engine owns the frame, React owns the
 * HUD (the big `a × b` plate, the cockpit keypad, choices and gates). `?dev` adds a chapter dock.
 */
export function IntroFilm() {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null), film = useRef<Film | null>(null), bay = useRef<Bay | null>(null);
  const [player, setPlayer] = useState<{ name: string; avatar: string } | null | undefined>(undefined);
  const [phase, setPhase] = useState<"gate" | "film" | "bay">("gate");
  const [ui, setUi] = useState<FilmUi | null>(null);
  const [bayUi, setBayUi] = useState<BayUi | null>(null);
  const [bayArena, setBayArena] = useState<Bay | null>(null);
  const router = useRouter();
  const dev = useSyncExternalStore(() => () => {}, () => new URLSearchParams(location.search).has("dev"), () => false);

  const startBay = useCallback(async () => {
    const s = stage.current;
    if (!s) return;
    film.current?.dispose();
    const { mountCadetBay } = await import("@/worlds/space/cadetBay");
    bay.current = mountCadetBay(s, { onUi: setBayUi, onEvent: post, history: await history(), dev: new URLSearchParams(location.search).has("dev") });
    window.__mw = { stage: s, arena: bay.current };
    setBayArena(bay.current);
    setPhase("bay");
  }, []);

  useEffect(() => {
    let gone = false, cleanup = () => {};
    (async () => {
      const [{ createStage }, { mountIntro }] = await Promise.all([import("@/engine/stage"), import("@/worlds/space/intro")]);
      if (gone || !box.current) return;
      const s = createStage(box.current, { fill: true });
      stage.current = s;
      film.current = mountIntro(s, { onUi: setUi, onEnd: () => void startBay() });
      window.__mw = { stage: s, film: film.current };
      cleanup = () => { film.current?.dispose(); bay.current?.dispose(); s.dispose(); };
    })();
    fetch("/api/player").then((r) => r.json()).then((j) => setPlayer(j.player)).catch(() => setPlayer(null));
    return () => { gone = true; cleanup(); };
  }, [startBay]);

  const begin = (n: string) => { film.current?.setName(n); film.current?.play(); setPhase("film"); };
  const switchCadet = async () => { await fetch("/api/player", { method: "DELETE" }); setPlayer(null); };

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black text-white">
      <div ref={box} className="absolute inset-0" />

      {dev && (
        <div className="absolute left-3 top-3 z-20 flex flex-wrap gap-1.5" role="toolbar" aria-label="Chapters">
          {CHAPTERS.map(([c, label]) => (
            <Button key={c} className={`${ghost} bg-black/40 px-2.5 py-1 text-xs`} disabled={!player} onClick={() => { film.current?.setName(player?.name ?? ""); film.current?.jump(c); setPhase("film"); }}>{label}</Button>
          ))}
          <Button className={`${ghost} bg-black/40 px-2.5 py-1 text-xs`} disabled={!player || phase === "bay"} onClick={() => void startBay()}>Cadet Bay</Button>
        </div>
      )}

      {phase === "gate" && player === null && <CadetSignUp onDone={(p) => { setPlayer(p); begin(p.name); }} />}
      {phase === "gate" && player && (
        <div className={`${glass} absolute inset-0 z-10 m-auto flex h-fit w-fit flex-col items-center gap-3 p-6`}>
          <p className="text-white/80">Welcome back, <b className="text-white">{player.name}</b></p>
          <Button className={`${lime} px-6 py-3 text-base`} onClick={() => begin(player.name)}>▶ Play (sound on)</Button>
          <Button className="text-sm text-white/50 underline-offset-4 hover:underline" onClick={() => void switchCadet()}>Not you? Switch cadet</Button>
        </div>
      )}

      {phase === "film" && ui?.prompt?.stage === "raise" && (
        <div className="absolute inset-x-0 bottom-24 z-10 flex flex-col items-center gap-3">
          <span className="rounded-full bg-[#0d0e1a]/75 px-4 py-1 font-mono text-sm text-white/85">{ui.prompt.eq} · know it? Raise your hand</span>
          <Button aria-label="Raise your hand" className={`${lime} px-6 py-3 text-base`} onClick={() => film.current?.raise()}>✋ Raise hand <kbd className="ml-2 rounded bg-black/15 px-1.5 text-xs">Space</kbd></Button>
        </div>
      )}
      {phase === "film" && ui?.prompt?.stage === "choose" && (
        <div className="absolute inset-x-0 bottom-24 z-10 flex flex-col items-center gap-3">
          <span className="rounded-full bg-[#0d0e1a]/75 px-4 py-1 font-mono text-sm text-white/85">{ui.prompt.eq}</span>
          <div className="flex gap-5" role="group" aria-label="Answer">
            {ui.prompt.options.map((v, i) => (
              <Button key={v} aria-label={`Answer ${v}`} className="size-20 rounded-full border-2 border-white/80 bg-[#0d0e1a]/60 text-3xl font-medium text-white outline-none transition hover:scale-105 hover:border-lime-300 hover:bg-lime-300 hover:text-[#0d0e1a] focus-visible:ring-2 focus-visible:ring-lime-300" onClick={() => film.current?.pick(v)}>
                {v}<span className="sr-only"> (key {i + 1})</span>
              </Button>
            ))}
          </div>
        </div>
      )}
      {phase === "film" && ui?.cta && (
        <div className="absolute inset-x-0 bottom-28 z-10 flex justify-center">
          <Button className={`${lime} px-7 py-3 text-base shadow-[0_0_40px_rgba(182,242,58,.45)]`} onClick={() => film.current?.ignite()}>🚀 {ui.cta}</Button>
        </div>
      )}

      {phase === "bay" && <BattleHud arena={bayArena} ui={bayUi} drone onFly={(to) => void flushed().then(() => router.push(`/play/${to}`))} />}
    </div>
  );
}
