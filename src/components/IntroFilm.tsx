"use client";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, NovaLine, Sheet } from "@/components/kit";
import { CADET, MOTION, type CadetColor } from "@/design/tokens";
import { flushed, history, post } from "@/engine/outbox";
import { keepWhole } from "@/engine/overlay";
import type { Stage } from "@/engine/stage";
import type { Bay, BayUi } from "@/worlds/space/cadetBay";
import type { Chapter, Film, FilmCaption, FilmUi } from "@/worlds/space/intro";
import { BattleHud, planetName } from "./battle/BattleHud";
import { PauseMenu } from "./battle/PauseMenu";
import { FirstShotGuide } from "./teach/FirstShotGuide";
import { CadetSignUp } from "./hub/CadetSignUp";

/** The film's fade grammar (ms): out to the void, and back in (the same as `fade` in pace.ts). The two together are one join. */
const FILM_FADE = { out: 500, in: 500 };

const CHAPTERS: [Chapter, string][] = [["orbit", "Earth"], ["dive", "Dive"], ["wake", "Classroom"], ["knock", "The knock"], ["hangar", "Hangar"]];

/** What the address asks for: `?dev` adds the chapter dock, `?replay` plays the film again, `from` is where to go back to after a replay. */
function useQuery() {
  const search = useSyncExternalStore(() => () => {}, () => location.search, () => "");
  const q = new URLSearchParams(search), from = q.get("from") ?? "";
  // only a path on this site is a place to go back to
  return { dev: q.has("dev"), replay: q.has("replay"), from: /^\/(?!\/)[\w\-/?=&.]*$/.test(from) ? from : "/bay" };
}

/** Things arrive with one short eased move, and simply appear for anyone who asked for less motion. */
function arrive(el: HTMLElement | null) {
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: MOTION.route * 1.4, easing: MOTION.ease, fill: "backwards" });
}

/** A raised hand in a dashed ring: the glyph on the one button that is not about a rocket. */
const HandGlyph = () => (
  <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true" focusable="false" className="flex-none text-ink-1">
    <circle cx="22" cy="22" r="20" fill="none" stroke="var(--color-gold)" strokeWidth="1.3" strokeDasharray="2 3.4" />
    <path d="M17.2 23v-7.4M20.5 22v-10M23.8 22v-9.2M27.1 23v-6.4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M15.9 22.6h12.5v3.6a6.2 6.2 0 0 1-12.5 0z" fill="currentColor" />
    <path d="M16 26.6l-3.4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </svg>
);

/** The words under a control: plain, and never smaller than a child can read. */
const hint = "m-0 text-[17px] leading-snug text-ink-2";
/** A phone gets the kit's 17 px line, anything wider its 19 px one. */
const useNarrow = () => useSyncExternalStore((f) => { addEventListener("resize", f); return () => removeEventListener("resize", f); }, () => innerWidth < 480, () => false);

/**
 * One spoken line of the film on its plate: the kit's NovaLine (Nova keeps her portrait; a person is
 * a name and their words), or the bare words for a sound with no speaker.
 */
function Caption({ line, narrow, live = false }: { line: FilmCaption; narrow: boolean; live?: boolean }) {
  return (
    <div className="max-w-full rounded-chip border border-line-1 bg-sheet px-4 py-2.5 text-left text-ink-1 sm:px-5 sm:py-3" data-film-caption>
      {line.who ? (
        <NovaLine speaker={line.who} portrait={line.who === "Nova" ? undefined : <></>} size={narrow ? "body" : "child"} live={live}>{keepWhole(line.text)}</NovaLine>
      ) : (
        <p className={`m-0 max-w-[34ch] ${narrow ? "type-body" : "type-child"}`} role={live ? "status" : undefined}>{keepWhole(line.text)}</p>
      )}
    </div>
  );
}

/**
 * The opening film and Level 0 as one full-screen game: the engine owns the picture, React owns the
 * words and the controls (captions, the invitation to raise a hand, the two answers, Launch, Skip)
 * and the battle HUD after it. `?dev` adds a chapter dock. `?replay` plays the film again for a
 * cadet who has finished it: nothing is recorded, and the end (or Skip) goes back to `from`.
 */
/** Recorded when the film hands over to the battle (played through or skipped), so a reload resumes the battle. */
export const FILM_DONE = "film:done";

export function IntroFilm() {
  const box = useRef<HTMLDivElement>(null), ruler = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null), film = useRef<Film | null>(null), bay = useRef<Bay | null>(null);
  const [player, setPlayer] = useState<{ name: string; avatar: string } | null | undefined>(undefined);
  /** The cadet already fought in Cadet Bay (a refresh after the film): carry on there, no film replay. */
  const [inBay, setInBay] = useState(false);
  /** The film is being watched again by a cadet who has finished it. */
  const [again, setAgain] = useState(false);
  const [filmReady, setFilmReady] = useState(false);
  const [phase, setPhase] = useState<"gate" | "film" | "bay">("gate");
  const [ui, setUi] = useState<FilmUi | null>(null);
  const [bayUi, setBayUi] = useState<BayUi | null>(null);
  const [bayArena, setBayArena] = useState<Bay | null>(null);
  const router = useRouter();
  const { dev, from } = useQuery();
  const narrow = useNarrow();
  /** How the film ends: into Cadet Bay the first time, back where the cadet came from on a replay. Read when it ends. */
  const ending = useRef<() => void>(() => {});

  /**
   * The hand-off from the film to Cadet Bay is one designed dip, in the film's own fade grammar: the last
   * frame goes to the void, the battle is built behind it, and the void lifts. (The battle's framing depends
   * on the screen and the HUD, so a cut would only match the film's last frame by luck.)
   */
  const [veil, setVeil] = useState<"off" | "down" | "lifting">("off");
  const startBay = useCallback(async () => {
    const s = stage.current;
    if (!s) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // load what the battle needs while the film's last frame is still up, so the void is short
    const [{ mountCadetBay }, log] = await Promise.all([import("@/worlds/space/cadetBay"), history()]);
    setVeil("down");
    await new Promise((r) => setTimeout(r, still ? 0 : FILM_FADE.out));
    film.current?.dispose();
    bay.current = mountCadetBay(s, { onUi: setBayUi, onEvent: post, history: log, dev: new URLSearchParams(location.search).has("dev") });
    window.__mw = { stage: s, arena: bay.current };
    setBayArena(bay.current);
    setPhase("bay");
    requestAnimationFrame(() => requestAnimationFrame(() => setVeil("lifting")));
    setTimeout(() => setVeil("off"), (still ? 0 : FILM_FADE.in) + 100);
  }, []);
  // the film is over the moment the battle opens: a reload from here on carries on in the battle, not at the film's start
  useEffect(() => { ending.current = again ? () => router.replace(from) : () => { post({ type: "seen", payload: { key: FILM_DONE } }); void startBay(); }; }, [again, from, router, startBay]);

  /**
   * Does this piece of a line fit the caption plate in two lines on this screen? The film asks before it
   * cuts a long line into captions. A hidden twin of the plate is measured, so the answer is the real one.
   */
  const fits = useCallback((who: string, text: string) => {
    const twin = ruler.current, p = twin?.querySelector("p"), name = twin?.querySelector("b"), face = twin?.querySelector("svg");
    if (!twin || !p || !name) return text.length <= 84;
    name.textContent = who ? `${who}:` : "";
    if (face) (face as SVGElement).style.display = who === "Nova" ? "" : "none";
    (p.lastChild as Text).data = ` ${keepWhole(text)}`;
    return p.getBoundingClientRect().height <= parseFloat(getComputedStyle(p).lineHeight) * 2.2;
  }, []);

  useEffect(() => {
    let gone = false, cleanup = () => {};
    (async () => {
      const [{ createStage }, { mountIntro }] = await Promise.all([import("@/engine/stage"), import("@/worlds/space/intro")]);
      if (gone || !box.current) return;
      const s = createStage(box.current, { fill: true });
      stage.current = s;
      // `?calm` plays the film as someone who asked for less motion sees it (for review; the system setting does it for real)
      // `?pace=heard` or `?pace=read` paces the captions as with sound on or off, whatever the sound is doing (for review and timing)
      const asked = new URLSearchParams(location.search).get("pace"), pace = asked === "heard" || asked === "read" ? asked : undefined;
      film.current = mountIntro(s, { onUi: setUi, onEnd: () => ending.current(), fits, calm: new URLSearchParams(location.search).has("calm") || undefined, pace });
      window.__mw = { stage: s, film: film.current };
      setFilmReady(true);
      cleanup = () => { film.current?.dispose(); bay.current?.dispose(); s.dispose(); };
    })();
    const q = new URLSearchParams(location.search), devMode = q.has("dev"), wantReplay = q.has("replay");
    (async () => {
      const j = await fetch("/api/player").then((r) => r.json()).catch(() => ({ player: null }));
      // the Title owns sign-up; a cadet who has finished the intro only comes back here to watch the film again
      if (!j.player && !devMode) return router.replace("/");
      const watching = wantReplay && (!!j.introCompleted || devMode);
      if (j.introCompleted && !devMode && !watching) return router.replace("/bay");
      if (j.player && !watching) setInBay((await history()).some((e) => (e.type === "seen" && e.payload.key === FILM_DONE) || (e.type === "attempt_submitted" && e.payload.planetId === "earth")));
      setAgain(watching);
      setPlayer(j.player);
    })();
    return () => { gone = true; cleanup(); };
  }, [fits, router]);

  // the hoodie and the first-person sleeve take the colour picked at sign-up
  useEffect(() => {
    const c = player && CADET[player.avatar as CadetColor];
    if (filmReady && c) film.current?.setColour(c);
  }, [player, filmReady]);

  // the battle's code is fetched while the film plays, so the join at the end never waits for it
  const begin = useCallback((n: string) => { film.current?.setName(n); film.current?.play(); setPhase("film"); void import("@/worlds/space/cadetBay"); }, []);
  const go = useCallback(() => { if (!player) return; if (inBay) void startBay(); else begin(player.name); }, [player, inBay, startBay, begin]);

  // straight from Start game on the Title (or a link to the replay): sound is already unlocked, so the film rolls at once
  useEffect(() => {
    if (phase !== "gate" || !player || !filmReady) return;
    void import("@/engine/audio").then(({ audio }) => { if (audio.context?.state === "running") go(); });
  }, [phase, player, filmReady, go]);

  const playing = phase === "film" && !!ui && !ui.ended;
  const prompt = playing ? ui.prompt : null, caption = playing ? ui.caption : null, cta = playing ? ui.cta : null;
  let controls: ReactNode = null;
  if (prompt && prompt.stage !== "choose") {
    controls = (
      <>
        <Button variant="primary" size="lg" glyph={false} className="!pr-3.5" data-armed={prompt.stage === "called" ? "" : undefined} aria-label="Raise your hand" aria-pressed={prompt.stage === "called"} onClick={() => film.current?.raise()}>
          {prompt.stage === "called" ? "Hand up" : "Raise your hand"}<HandGlyph />
        </Button>
        {prompt.stage === "raise" && <p className={hint}>Know the answer? Put your hand up<span className="[@media(pointer:coarse)]:hidden">, or press Space</span>.</p>}
      </>
    );
  } else if (prompt) {
    controls = (
      <>
        {/* the sum is on the board, in the picture; the two answers sit under it, in the clear space the shot leaves */}
        <div className="flex gap-6" role="group" aria-label={`${prompt.eq.replace("?", "what")}. Pick the answer`}>
          {prompt.options.map((v, i) => (
            <Button key={v} variant="secondary" size="lg" aria-label={`Answer ${v}`} onClick={() => film.current?.pick(v)} className="size-[88px] bg-void !p-0 text-[40px] font-light [font-stretch:112%]">
              {v}<span className="sr-only"> (key {i + 1})</span>
            </Button>
          ))}
        </div>
        <p className={hint}>Tap the answer<span className="[@media(pointer:coarse)]:hidden">, or press 1 or 2</span>.</p>
      </>
    );
  } else if (cta) {
    controls = <Button variant="primary" size="lg" onClick={() => film.current?.ignite()}>{cta}</Button>;
  }

  return (
    // in Cadet Bay this is the game root (data-cockpit): the HUD gives it focus back after a card or the pause menu, so Enter fires
    <div className="fixed inset-0 select-none overflow-hidden bg-void text-ink-1 outline-none" data-cockpit={phase === "bay" ? "" : undefined} tabIndex={-1}>
      <div ref={box} className="absolute inset-0" />
      {veil !== "off" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] bg-void ease-out"
          style={{ opacity: veil === "down" ? 1 : 0, transition: `opacity ${veil === "down" ? FILM_FADE.out : FILM_FADE.in}ms`, animation: veil === "down" ? `mw-veil-in ${FILM_FADE.out}ms ${MOTION.ease} both` : undefined }}>
          <style>{"@keyframes mw-veil-in{from{opacity:0}to{opacity:1}}"}</style>
        </div>
      )}

      {dev && (
        <div className="absolute left-3 top-3 z-20 flex max-w-[calc(100%-140px)] flex-wrap gap-1.5" role="toolbar" aria-label="Chapters">
          {CHAPTERS.map(([c, label]) => (
            <Button key={c} size="sm" className="!min-h-8 bg-void !px-3 !text-[13px]" disabled={!player} onClick={() => { if (!film.current) return; film.current.setName(player?.name ?? ""); film.current.jump(c); setPhase("film"); }}>{label}</Button>
          ))}
          <Button size="sm" className="!min-h-8 bg-void !px-3 !text-[13px]" disabled={!player || phase === "bay"} onClick={() => void startBay()}>Cadet Bay</Button>
        </div>
      )}

      {phase === "gate" && player === null && (
        <Sheet className="absolute inset-0 z-30 m-auto h-fit max-h-[92dvh] w-[min(92%,520px)] overflow-y-auto p-6 md:p-8">
          <CadetSignUp onDone={(p) => { setPlayer(p); begin(p.name); }} />
        </Sheet>
      )}
      {phase === "gate" && player && (
        <div ref={arrive} className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-7 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,var(--color-void)_0%,transparent_100%)] px-6 text-center">
          <h1 className="type-display m-0 text-[clamp(30px,6vw,64px)] leading-none [overflow-wrap:anywhere]">{again ? "The film" : inBay ? <>Welcome back, {player.name}</> : <>Ready, {player.name}?</>}</h1>
          <Button variant="primary" size="lg" disabled={!filmReady} onClick={go}>{inBay ? "Continue" : "Play"}</Button>
          <p className={hint}>{again ? "The story so far, from Earth to your first launch." : inBay ? "Back to Cadet Bay." : "A short film, then your first mission. Best with sound."}</p>
          {again && <Button variant="quiet" icon="back" onClick={() => router.replace(from)}>Back</Button>}
        </div>
      )}

      {/* Skip: quiet, in the corner beside the sound button, a few seconds in. One tap; the film can be watched again */}
      {playing && ui.canSkip && (
        <div ref={arrive} className="absolute right-[64px] top-3 z-20">
          <Button variant="quiet" size="sm" icon="forward" className="bg-void/70" aria-label={again ? "Skip the film" : "Skip the film and go to your first mission"} onClick={() => film.current?.skip()}>Skip</Button>
        </div>
      )}

      {/* everything written at the foot of the frame is one stack: the controls, then the line being spoken. Every shot is composed to leave this band clear */}
      {(controls || caption) && (
        <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-2 pb-[max(20px,env(safe-area-inset-bottom))] text-center sm:gap-4 sm:px-5 ${controls ? "bg-[linear-gradient(0deg,var(--color-void)_0%,var(--color-scrim)_55%,transparent_100%)] pt-20" : ""}`}>
          {controls && <div key={prompt ? `${prompt.eq}${prompt.stage === "choose"}` : "cta"} ref={arrive} className="pointer-events-auto flex flex-col items-center gap-3.5">{controls}</div>}
          {caption && <Caption line={caption} narrow={narrow} live />}
        </div>
      )}
      {/* the ruler: a hidden twin of the caption plate, which `fits` measures */}
      <div ref={ruler} aria-hidden="true" className="invisible absolute inset-x-0 bottom-0 flex flex-col items-center px-2 sm:px-5">
        <Caption line={{ who: "Nova", text: "." }} narrow={narrow} />
      </div>

      {phase === "bay" && bayArena && <FirstShotGuide ui={bayUi} bus={bayArena.bus} fleetRect={bayArena.fleetRect} rocketRect={bayArena.rocketRect} />}
      {phase === "bay" && (
        <BattleHud arena={bayArena} ui={bayUi} drone launch={false} menu={<PauseMenu places={false} />}
          doneActions={(d) => (
            <>
              {/* the same order as every later clear: fly on is the one primary; home is the second way */}
              {d.next && <Button variant="primary" size="md" data-primary className="w-full justify-between" onClick={() => void flushed().then(() => router.push(`/play/${d.next}`))}>Fly to {planetName(d.next, true)}</Button>}
              <Button variant={d.next ? "secondary" : "primary"} size="md" icon="bay" className="w-full" onClick={() => void flushed().then(() => router.push("/bay"))}>Resting Bay</Button>
            </>
          )} />
      )}
    </div>
  );
}
