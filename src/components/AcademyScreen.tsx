"use client";
import { Button as UiButton } from "@ui-sdk/react/button";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { EventInput } from "@/db/events";
import type { LoggedEvent } from "@/director/fold";
import type { Stage } from "@/engine/stage";
import { FILMS_BY_JOURNEY, FIRST_MET, filmOf, type Film } from "@/rig/academy";
import { PLANETS_BY_TIER, tierOf, tierOfPlanet, type PlanetId } from "@/rig/pools";
import type { TrickId } from "@/rig/tricks";
import type { Arena, ArenaUi } from "@/worlds/space/arena";
import { BattleHud } from "./battle/BattleHud";
import { Button, HomeLink, Icon, IconButton, TopBar } from "./kit";
import { useCadet } from "./hub/useCadet";
import { FieldManual } from "./teach/FieldManual";
import { ScreenTour } from "./teach/Tour";
import { greetKey } from "@/teach/keys";
import { PlanetSprite } from "./world/PlanetSprite";
import { preloadSprites } from "./world/spriteStore";
import { Starfield } from "./world/Starfield";
import { TrickPicture } from "./world/TrickPicture";
import { ACADEMY_WORDS, STOP_WORDS, TRICK_REASON } from "./world/words";

/* ---------- which film is playing lives in the URL (?watch=flip-it), so Back returns to the list ---------- */

const URL_EVENT = "mw:academy-url";
const subscribeUrl = (fn: () => void) => {
  addEventListener("popstate", fn); addEventListener(URL_EVENT, fn);
  return () => { removeEventListener("popstate", fn); removeEventListener(URL_EVENT, fn); };
};
const param = (k: string) => () => new URLSearchParams(location.search).get(k);
const watchParam = param("watch"), trickParam = param("trick");
const noParam = () => null;
function setUrl(search: string, push: boolean) {
  const url = `${location.pathname}${search}`;
  if (push) history.pushState(null, "", url); else history.replaceState(null, "", url);
  dispatchEvent(new Event(URL_EVENT));
}

interface Playing { trick: TrickId; a: number; b: number; watch: boolean; n: number }

/**
 * The Academy (/academy): where Nova shows any trick on a real fleet. In 2D, the ten tricks as one list in
 * the order the journey meets them, each with its kid name, one plain reason, an example fact and a small
 * true picture of the trick in dots. Watched tricks wear a gold ring. Choosing one plays its trick film in
 * the 3D battle (the arena's academy mode), then it is the cadet's turn; "All tricks" is always on screen.
 */
export function AcademyScreen({ onHelp }: { onHelp?: () => void } = {}) {
  const { state, log, emit } = useCadet();
  const watching = useSyncExternalStore(subscribeUrl, watchParam, noParam);
  const highlight = useSyncExternalStore(subscribeUrl, trickParam, noParam);
  const [override, setOverride] = useState<Playing | null>(null);
  const pushed = useRef(false);
  const [help, setHelp] = useState(false);
  // a first visit: Nova's greeting says what the intro line says, so the line waits for the next visit
  const [newHere, setNewHere] = useState<boolean | null>(null);
  if (state && newHere === null) setNewHere(!(state.seen[greetKey("academy")] ?? 0));

  const base = watching ? filmOf(watching) : null;
  const film: Playing | null = !base ? null : override?.trick === base.trick ? override : { trick: base.trick, a: base.a, b: base.b, watch: true, n: 0 };

  useEffect(() => { void import("@/engine/audio").then(({ audio }) => audio.mood("hangar")); }, []);
  useEffect(() => { void preloadSprites(PLANETS_BY_TIER.map((id) => ({ id, size: 36 }))); }, []);

  // closing a trick film puts focus back on that trick's row (the list is drawn again, so the row is new)
  const opener = useRef<string | null>(null);
  useEffect(() => {
    if (film || !opener.current) return;
    const row = document.querySelector<HTMLElement>(`[data-trick="${opener.current}"]`);
    opener.current = null;
    if (row && (document.activeElement === document.body || !document.activeElement)) row.focus({ preventScroll: false });
  });
  const watch = useCallback((f: Film) => { opener.current = f.trick; pushed.current = true; setOverride(null); setUrl(`?watch=${f.trick}`, true); }, []);
  const back = useCallback(() => {
    setOverride(null);
    if (pushed.current) { pushed.current = false; history.back(); } else setUrl("", false);
  }, []);

  if (!state) return <div className="fixed inset-0 bg-void" />;
  if (film && base) {
    return (
      <TrickFilm film={film} f={base} log={log} emit={emit} onBack={back}
        onAgain={() => setOverride({ trick: base.trick, a: base.a, b: base.b, watch: true, n: film.n + 1 })}
        onSister={() => setOverride({ trick: base.trick, a: base.sister[0], b: base.sister[1], watch: false, n: film.n + 1 })} />
    );
  }

  const seen = (t: TrickId) => (state.seenTricks[t] ?? 0) > 0;
  const reached = (p: PlanetId) => tierOfPlanet(p) <= state.tier;
  const next = FILMS_BY_JOURNEY.find((f) => !seen(f.trick) && reached(FIRST_MET[f.trick]))?.trick ?? null;
  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-void text-approach">
      <Starfield seed={23} />
      <TopBar className="sticky top-0 z-20 bg-void" left={<HomeLink />} title="Academy" orbs={state.orbs} onHelp={onHelp ?? (() => setHelp(true))} />
      {/* the list only: a trick film has Nova's own voice and captions */}
      <FieldManual open={help} onClose={() => setHelp(false)} topic="help" seen={{ seen: state.seen, emit }} replayFrom="/academy" />
      <ScreenTour id="academy" seen={{ seen: state.seen, emit }} />
      <main className="relative z-10 mx-auto w-full max-w-[920px] px-4 pb-16 pt-4 sm:px-8 md:pt-10">
        <h2 className="m-0 type-display text-[clamp(44px,7vw,80px)] leading-[0.95]">{ACADEMY_WORDS.heading}</h2>
        {newHere === false && <p className="m-0 mt-4 max-w-[36ch] type-child text-ink-2">{ACADEMY_WORDS.intro}</p>}
        <TrickList seen={seen} reached={reached} next={next} highlight={highlight} onWatch={watch} />
      </main>
    </div>
  );
}

/* ---------- the list: planet by planet along a dashed path, one row per trick ---------- */

function TrickList({ seen, reached, next, highlight, onWatch }: {
  seen: (t: TrickId) => boolean; reached: (p: PlanetId) => boolean; next: TrickId | null; highlight: string | null; onWatch: (f: Film) => void;
}) {
  const groups = useMemo(() => {
    const out: { planet: PlanetId; films: Film[] }[] = [];
    for (const f of FILMS_BY_JOURNEY) {
      const p = FIRST_MET[f.trick], g = out.at(-1);
      if (g?.planet === p) g.films.push(f); else out.push({ planet: p, films: [f] });
    }
    return out;
  }, []);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlight) list.current?.querySelector<HTMLElement>(`[data-trick="${highlight}"]`)?.scrollIntoView({ block: "center" });
  }, [highlight]);

  return (
    <div ref={list} className="relative mt-10">
      {/* the journey's dashed path runs down the left, through each planet */}
      <span aria-hidden className="absolute bottom-10 left-[17px] top-4 border-l border-dashed border-line-2" />
      {groups.map(({ planet, films }, i) => (
        <section key={planet} aria-labelledby={`at-${planet}`} data-guide={i === 0 ? "academy-list" : undefined} className="relative mb-6">
          <h3 id={`at-${planet}`} className="m-0 flex items-center gap-4 py-2">
            <PlanetSprite id={planet} size={36} alt="" />
            <span className="type-name text-[17px] text-ink-2">{STOP_WORDS[planet].name}</span>
          </h3>
          <ul className="m-0 list-none p-0 pl-[36px] sm:pl-[52px]">
            {films.map((f) => (
              <li key={f.trick} className="border-b border-line-1 last:border-b-0">
                <TrickRow f={f} seen={seen(f.trick)} future={!reached(planet)} next={next === f.trick} lit={highlight === f.trick} onWatch={onWatch} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TrickRow({ f, seen, future, next, lit, onWatch }: { f: Film; seen: boolean; future: boolean; next: boolean; lit: boolean; onWatch: (f: Film) => void }) {
  const status = seen ? ACADEMY_WORDS.watched : next ? ACADEMY_WORDS.next : ACADEMY_WORDS.watch;
  return (
    <UiButton data-trick={f.trick} onClick={() => onWatch(f)}
      aria-label={`${f.card}. ${TRICK_REASON[f.trick]} Example: ${f.a} × ${f.b}. ${seen ? ACADEMY_WORDS.watched : ACADEMY_WORDS.watch}.`}
      className={`group my-1 flex w-full flex-col gap-3 rounded-chip px-3 py-4 text-left transition-colors hover:bg-raised sm:grid sm:grid-cols-[176px_1fr_auto] sm:items-center sm:gap-x-6 ${lit ? "bg-raised" : ""}`}>
      <span className="flex items-center gap-4 sm:flex-col sm:gap-1.5">
        <TrickPicture trick={f.trick} a={f.a} b={f.b} width={176} height={84} className="hidden sm:block" />
        <TrickPicture trick={f.trick} a={f.a} b={f.b} width={150} height={64} className="sm:hidden" />
        {/* Empty & Mirror draws two pictures for a fleet with a 0 in it (empty, then its 1 × twin): the caption names both */}
        <span className="type-number text-[17px] text-ink-2" aria-hidden>{f.a} × {f.b}{f.trick === "empty-mirror" && (f.a === 0 || f.b === 0) ? <> and {f.a === 0 ? 1 : f.a} × {f.b === 0 ? 1 : f.b}</> : null}</span>
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="type-name text-[21px] leading-tight text-approach">{f.card}</span>
        <span className="type-child text-[18px] leading-snug text-ink-2">{TRICK_REASON[f.trick]}</span>
        {future && <span className="mt-0.5 type-body-sm text-ink-3">{ACADEMY_WORDS.meet(FIRST_MET[f.trick])}</span>}
        {/* phones: the status as words under the reason */}
        <span className={`mt-1 flex items-center gap-1.5 type-body-sm sm:hidden ${seen ? "text-gold" : "text-ink-2"}`}>
          <Icon name={seen ? "check" : "play"} size={16} />{status}
        </span>
      </span>
      <span className="hidden w-[88px] flex-col items-center gap-1.5 whitespace-nowrap sm:flex" aria-hidden>
        <span className={`grid size-11 place-items-center rounded-full border ${seen ? "border-[1.5px] border-gold text-gold" : next ? "border-line-3 text-approach" : "border-line-2 text-ink-2"} transition-colors group-hover:border-gold`}>
          <Icon name="play" size={18} />
        </span>
        <span className={`type-body-sm ${seen ? "text-gold" : next ? "text-approach" : "text-ink-3"}`}>{status}</span>
      </span>
    </UiButton>
  );
}

/* ---------- the film: the battle stage in academy mode, then "Your turn" ---------- */

function TrickFilm({ film, f, log, emit, onBack, onAgain, onSister }: {
  film: Playing; f: Film; log: LoggedEvent[] | null; emit: (e: EventInput) => void;
  onBack: () => void; onAgain: () => void; onSister: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [arena, setArena] = useState<Arena | null>(null);
  const [ui, setUi] = useState<ArenaUi | null>(null);
  const logRef = useRef(log);
  useEffect(() => { logRef.current = log; }, [log]);

  useEffect(() => {
    let gone = false, made: Stage | null = null;
    void import("@/engine/stage").then(({ createStage }) => {
      if (gone || !box.current) return;
      made = createStage(box.current, { fill: true });
      setStage(made);
    });
    return () => { gone = true; made?.dispose(); setStage(null); };
  }, []);

  useEffect(() => {
    if (!stage) return;
    let gone = false, cleanup = () => {};
    void import("@/worlds/space/arena").then(({ mountArena }) => {
      if (gone) return;
      const planet = PLANETS_BY_TIER[tierOf(film.a, film.b) ?? 1];
      const a = mountArena(stage, { planet, history: logRef.current ?? [], onUi: setUi, onEvent: emit, force: { a: film.a, b: film.b }, academy: { film: film.watch } });
      window.__mw = { stage, arena: a };
      setArena(a);
      a.start();
      cleanup = () => { a.dispose(); setArena(null); setUi(null); };
    });
    return () => { gone = true; cleanup(); };
  }, [stage, film.trick, film.a, film.b, film.watch, film.n, emit]);

  // Escape is the way out of a film, as everywhere else
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("dialog[open], [role=dialog]")) onBack(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onBack]);

  const backButton = (
    <>
      <IconButton icon="back" label={ACADEMY_WORDS.back} onClick={onBack} className="bg-void md:hidden" />
      <Button variant="secondary" icon="back" onClick={onBack} className="hidden bg-void md:inline-flex">{ACADEMY_WORDS.back}</Button>
    </>
  );
  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-void text-approach">
      <div ref={box} className="absolute inset-0" />
      <BattleHud arena={arena} ui={ui} launch={false} menu={backButton}
        doneActions={() => (
          <>
            <Button variant="primary" onClick={onSister}>{ACADEMY_WORDS.tryFact(f.sister[0], f.sister[1])}</Button>
            <Button variant="secondary" icon="play" onClick={onAgain}>{ACADEMY_WORDS.again}</Button>
            <Button variant="secondary" icon="back" onClick={onBack}>{ACADEMY_WORDS.back}</Button>
          </>
        )} />
    </div>
  );
}
