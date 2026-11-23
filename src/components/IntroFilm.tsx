"use client";
import { useEffect, useRef, useState } from "react";
import type { Stage } from "@/engine/stage";
import type { StyleKey } from "@/worlds/space/cast";
import type { mountIntro } from "@/worlds/space/intro";

type Intro = ReturnType<typeof mountIntro>;
declare global { interface Window { __mw?: { stage: Stage; intro?: Intro } } }

const STYLE_OPTIONS: [StyleKey, string][] = [["story", "Storybook"], ["bean", "Clay bean"], ["toy", "Big-eye toy"]];
const CHAPTERS: [string, string][] = [["earth", "Earth"], ["wake", "Classroom"], ["knock", "The knock"]];

/** The opening film. The engine owns the frame; React only mounts it and draws the controls around it. */
export function IntroFilm() {
  const box = useRef<HTMLDivElement>(null);
  const [intro, setIntro] = useState<Intro | null>(null);
  const [style, setStyle] = useState<StyleKey>("story");

  useEffect(() => {
    let gone = false, cleanup = () => {};
    (async () => {
      const [{ createStage }, { mountIntro }] = await Promise.all([import("@/engine/stage"), import("@/worlds/space/intro")]);
      if (gone || !box.current) return;
      const stage = createStage(box.current);
      const film = mountIntro(stage);
      window.__mw = { stage, intro: film };
      setIntro(film);
      cleanup = () => { film.dispose(); stage.dispose(); };
    })();
    return () => { gone = true; cleanup(); };
  }, []);

  const chip = (on: boolean) => `rounded-lg border px-3 py-1.5 text-sm transition ${on ? "border-lime-300 bg-lime-300/15 text-lime-200" : "border-white/15 text-white/80 hover:border-white/40"}`;
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-20 text-xs text-white/50">Characters</span>
        {STYLE_OPTIONS.map(([k, label]) => (
          <button key={k} className={chip(style === k)} disabled={!intro} onClick={() => { setStyle(k); intro?.setStyle(k); }}>{label}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-20 text-xs text-white/50">Jump to</span>
        {CHAPTERS.map(([name, label]) => (
          <button key={name} className={chip(false)} disabled={!intro} onClick={() => intro?.jump(name)}>{label}</button>
        ))}
      </div>
      <div ref={box} className="relative w-full overflow-hidden rounded-xl bg-black" />
    </div>
  );
}
