"use client";
import { Button } from "@ui-sdk/react/button";
import { useRouter } from "next/navigation";
import { type ComponentProps, type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { COLOR, EDGE, INK, LINE, MOTION, TYPE } from "@/design/tokens";
import { flushed, history, post } from "@/engine/outbox";
import type { Stage } from "@/engine/stage";
import type { Bay, BayUi } from "@/worlds/space/cadetBay";
import type { Chapter, Film, FilmUi } from "@/worlds/space/intro";
import { PLANET_NAMES } from "@/worlds/space/lines";
import { BattleHud } from "./battle/BattleHud";
import { CadetSignUp, ghost, lime } from "./battle/ui";

const CHAPTERS: [Chapter, string][] = [["orbit", "Earth"], ["dive", "Dive"], ["wake", "Classroom"], ["knock", "The knock"], ["hangar", "Hangar"]];

const FAMILY = `"${TYPE.family}", system-ui, sans-serif`;
const display: CSSProperties = { fontWeight: TYPE.display.weight, fontStretch: `${TYPE.display.stretch}%`, textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.02 };
const labelText: CSSProperties = { fontWeight: 600, fontStretch: "118%", letterSpacing: "0.18em", textTransform: "uppercase" };
/** The words under a control: plain, and never smaller than a child can read. */
const hint: CSSProperties = { fontSize: TYPE.min.child, lineHeight: 1.4, color: INK[2], margin: 0 };
const VARS = { "--edge": EDGE.rest, "--edge-hot": EDGE.hot, "--fill": COLOR.void, "--fill-hot": COLOR.panel, "--gold": COLOR.gold, "--line": LINE[3], "--ink": INK[1] } as CSSProperties;
const fine = "outline-none focus-visible:[outline:2px_solid_var(--gold)] focus-visible:[outline-offset:4px]";

/** Things arrive with one short eased move, and simply appear for anyone who asked for less motion. */
function arrive(el: HTMLElement | null) {
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: MOTION.route * 1.4, easing: MOTION.ease, fill: "backwards" });
}

/** The one primary action on screen: a pill with the cool-to-hot edge, gold when hovered or armed, and a glyph in a dashed ring. */
function Primary({ glyph, armed = false, children, ...rest }: { glyph: ReactNode; armed?: boolean; children: ReactNode } & Omit<ComponentProps<typeof Button>, "children" | "className" | "style">) {
  return (
    <Button {...rest}
      className={`inline-flex h-[72px] max-w-full cursor-pointer items-center gap-4 whitespace-nowrap rounded-full border-2 border-transparent pl-7 pr-3.5 transition-[background] duration-300 sm:gap-5 sm:pl-9 [background:linear-gradient(var(--fill),var(--fill))_padding-box,var(--edge)_border-box] hover:[background:linear-gradient(var(--fill-hot),var(--fill-hot))_padding-box,var(--edge-hot)_border-box] ${fine}`}
      style={{ ...labelText, letterSpacing: "0.16em", fontSize: "clamp(15px, 4.2vw, 18px)", color: INK[1], ...(armed ? ({ "--edge": EDGE.hot } as CSSProperties) : null) }}>
      <span>{children}</span>
      <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true" className="flex-none">
        <circle cx="22" cy="22" r="20" fill="none" stroke={COLOR.gold} strokeWidth="1.3" strokeDasharray="2 3.4" />
        {glyph}
      </svg>
    </Button>
  );
}
const ROCKET = (
  <>
    <path d="M22 10c4.5 3.6 6.4 9 5.4 15.5H16.6C15.6 19 17.5 13.6 22 10z" fill={COLOR.approach} />
    <circle cx="22" cy="18.5" r="2.2" fill={COLOR.void} />
    <path d="M18.5 25.5l-3 4.5M25.5 25.5l3 4.5" stroke={COLOR.approach} strokeWidth="1.6" strokeLinecap="round" fill="none" />
    <path d="M22 27.5v5" stroke={COLOR.ember} strokeWidth="1.6" strokeLinecap="round" fill="none" />
  </>
);
const HAND = (
  <>
    <path d="M17.2 23v-7.4M20.5 22v-10M23.8 22v-9.2M27.1 23v-6.4" stroke={COLOR.approach} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M15.9 22.6h12.5v3.6a6.2 6.2 0 0 1-12.5 0z" fill={COLOR.approach} />
    <path d="M16 26.6l-3.4-4" stroke={COLOR.approach} strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </>
);
const PLAY = <path d="M18.5 14.5l11 7.5-11 7.5z" fill={COLOR.approach} />;

/**
 * The opening film and Level 0 as one full-screen game: the engine owns the frame, React owns the
 * controls (the invitation to raise a hand, the two answers, Launch) and the battle HUD after it.
 * `?dev` adds a chapter dock.
 */
export function IntroFilm() {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null), film = useRef<Film | null>(null), bay = useRef<Bay | null>(null);
  const [player, setPlayer] = useState<{ name: string; avatar: string } | null | undefined>(undefined);
  /** The cadet already fought in Cadet Bay (a refresh after the film): carry on there, no film replay. */
  const [inBay, setInBay] = useState(false);
  const [filmReady, setFilmReady] = useState(false);
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
      setFilmReady(true);
      cleanup = () => { film.current?.dispose(); bay.current?.dispose(); s.dispose(); };
    })();
    const devMode = new URLSearchParams(location.search).has("dev");
    (async () => {
      const j = await fetch("/api/player").then((r) => r.json()).catch(() => ({ player: null }));
      // the Title owns sign-up; a cadet who has finished the intro never sees it again
      if (!j.player && !devMode) return router.replace("/");
      if (j.introCompleted && !devMode) return router.replace("/bay");
      if (j.player) setInBay((await history()).some((e) => e.type === "attempt_submitted" && e.payload.planetId === "earth"));
      setPlayer(j.player);
    })();
    return () => { gone = true; cleanup(); };
  }, [startBay, router]);

  const begin = useCallback((n: string) => { film.current?.setName(n); film.current?.play(); setPhase("film"); }, []);
  const go = useCallback(() => { if (!player) return; if (inBay) void startBay(); else begin(player.name); }, [player, inBay, startBay, begin]);

  // straight from Start Game on the Title: sound is already unlocked, so the film rolls at once
  useEffect(() => {
    if (phase !== "gate" || !player || !filmReady) return;
    void import("@/engine/audio").then(({ audio }) => { if (audio.context?.state === "running") go(); });
  }, [phase, player, filmReady, go]);

  const prompt = phase === "film" ? ui?.prompt : null;
  return (
    <div className="fixed inset-0 select-none overflow-hidden" style={{ background: COLOR.void, color: INK[1] }}>
      <div ref={box} className="absolute inset-0" />

      {dev && (
        <div className="absolute left-3 top-3 z-20 flex flex-wrap gap-1.5" role="toolbar" aria-label="Chapters" style={{ ...VARS, fontFamily: FAMILY }}>
          {CHAPTERS.map(([c, label]) => (
            <Button key={c} className={`h-8 rounded-full border px-3 hover:border-[color:var(--line)] data-disabled:opacity-40 ${fine}`} style={{ borderColor: LINE[2], background: COLOR.void, color: INK[2], fontSize: TYPE.min.label }} disabled={!player} onClick={() => { film.current?.setName(player?.name ?? ""); film.current?.jump(c); setPhase("film"); }}>{label}</Button>
          ))}
          <Button className={`h-8 rounded-full border px-3 hover:border-[color:var(--line)] data-disabled:opacity-40 ${fine}`} style={{ borderColor: LINE[2], background: COLOR.void, color: INK[2], fontSize: TYPE.min.label }} disabled={!player || phase === "bay"} onClick={() => void startBay()}>Cadet Bay</Button>
        </div>
      )}

      {phase === "gate" && player === null && <CadetSignUp onDone={(p) => { setPlayer(p); begin(p.name); }} />}
      {phase === "gate" && player && (
        <div ref={arrive} className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-7 px-6 text-center" style={{ ...VARS, fontFamily: FAMILY, background: `radial-gradient(ellipse 70% 60% at 50% 50%, ${COLOR.void} 0%, transparent 100%)` }}>
          <h1 style={{ ...display, margin: 0, fontSize: "clamp(30px, 6vw, 64px)" }}>{inBay ? "Welcome back" : "Ready"}, {player.name}?</h1>
          <Primary glyph={PLAY} disabled={!filmReady} onClick={go}>{inBay ? "Continue" : "Play"}</Primary>
          <p style={hint}>{inBay ? "Back to Cadet Bay." : "A short film, then your first mission. Best with sound."}</p>
        </div>
      )}

      {prompt && (
        <div key={prompt.eq} ref={arrive} className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-4 px-5 pt-24 text-center" style={{ ...VARS, fontFamily: FAMILY, paddingBottom: "max(104px, 13vh)", background: `linear-gradient(0deg, ${COLOR.void} 0%, ${COLOR.void} 22%, transparent 100%)` }}>
          <p style={{ ...display, margin: 0, letterSpacing: "0.08em", fontSize: "clamp(34px, 6vw, 56px)" }}>{prompt.eq}</p>
          {prompt.stage !== "choose" ? (
            <>
              <Primary glyph={HAND} armed={prompt.stage === "called"} aria-label="Raise your hand" aria-pressed={prompt.stage === "called"} onClick={() => film.current?.raise()}>
                {prompt.stage === "called" ? "Hand up" : "Raise your hand"}
              </Primary>
              <p style={hint} aria-live="polite">
                {prompt.stage === "called" ? "Your hand is up. Here comes the teacher." : <>Know the answer? Put your hand up<span className="[@media(pointer:coarse)]:hidden">, or press Space</span>.</>}
              </p>
            </>
          ) : (
            <>
              <div className="flex gap-6" role="group" aria-label="Answer">
                {prompt.options.map((v, i) => (
                  <Button key={v} aria-label={`Answer ${v}`} onClick={() => film.current?.pick(v)}
                    className={`grid size-[88px] cursor-pointer place-items-center rounded-full border-[1.5px] border-[color:var(--line)] transition-colors duration-200 hover:border-[color:var(--gold)] ${fine}`}
                    style={{ background: COLOR.void, color: INK[1], fontSize: 40, fontWeight: 300, fontStretch: "112%" }}>
                    {v}<span className="sr-only"> (key {i + 1})</span>
                  </Button>
                ))}
              </div>
              <p style={hint}>Tap the answer<span className="[@media(pointer:coarse)]:hidden">, or press 1 or 2</span>.</p>
            </>
          )}
        </div>
      )}
      {phase === "film" && ui?.cta && (
        <div ref={arrive} className="absolute inset-x-0 bottom-0 z-10 flex justify-center px-5 pt-24" style={{ ...VARS, fontFamily: FAMILY, paddingBottom: "max(96px, 12vh)", background: `linear-gradient(0deg, ${COLOR.void} 0%, transparent 100%)` }}>
          <Primary glyph={ROCKET} onClick={() => film.current?.ignite()}>{ui.cta}</Primary>
        </div>
      )}

      {phase === "bay" && (
        <BattleHud arena={bayArena} ui={bayUi} drone launch={false}
          doneActions={(d) => (
            <>
              <Button className={`${lime} px-6 py-3 text-base`} onClick={() => void flushed().then(() => router.push("/bay"))}>Enter the Resting Bay</Button>
              {d.next && <Button className={`${ghost} px-5 py-3 text-base`} onClick={() => void flushed().then(() => router.push(`/play/${d.next}`))}>Fly to {PLANET_NAMES[d.next]}</Button>}
            </>
          )} />
      )}
    </div>
  );
}
