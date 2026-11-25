"use client";
import { Button as UiButton } from "@ui-sdk/react/button";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { PlayerState } from "@/director/fold";
import type { Stop } from "@/director/hub";
import { PLANET_NAMES } from "@/worlds/space/lines";
import { HomeLink, Icon, masterySummary, PillLink, Pips, RocketGlyph, TopBar } from "./kit";
import { useCadet } from "./hub/useCadet";
import { hereIndex, hyperJump, journey, stopMarks, type JourneyStop } from "./world/journey";
import { PlanetSprite } from "./world/PlanetSprite";
import { preloadSprites } from "./world/spriteStore";
import { Starfield } from "./world/Starfield";
import { ACTION_WORDS, STATE_WORDS, STOP_WORDS, type StopId } from "./world/words";

/** Kept for older imports: each stop's name. New code reads `STOP_WORDS` (src/components/world/words.ts). */
export const STOP_NAMES: Record<Stop["id"], string> = { mercury: "Mercury", venus: "Venus", ...PLANET_NAMES };

/** Each planet's sprite size on the wide map, roughly true to the bodies (Saturn's includes its rings). */
const SIZE: Record<StopId, number> = {
  mercury: 44, venus: 54, earth: 62, moon: 42, mars: 52, "asteroid-belt": 66, jupiter: 90, saturn: 108, uranus: 72, "deep-space": 70,
};
const narrowSize = (id: StopId) => Math.round(Math.min(84, Math.max(38, SIZE[id] * 0.78)));
const SUN = { wide: 240, narrow: 200 };

/** Wide enough for the whole journey on one gentle arc; anything smaller gets a vertical path. */
const WIDE = "(min-width: 1100px) and (min-height: 600px)";
function useWide() {
  return useSyncExternalStore(
    (fn) => { const m = matchMedia(WIDE); m.addEventListener("change", fn); return () => m.removeEventListener("change", fn); },
    () => matchMedia(WIDE).matches,
    () => true,
  );
}

const stateOf = (s: JourneyStop) => (s.here ? "here" : s.locked ? "locked" : s.cleared ? "cleared" : s.warmup ? "warmup" : "open");
const labelOf = (s: JourneyStop) => `${STOP_WORDS[s.id].name}. ${STOP_WORDS[s.id].teaches}. ${STATE_WORDS[stateOf(s)]}${s.cleared && s.here ? `, ${STATE_WORDS.cleared}` : ""}.`;
/** How bright a stop's planet is: the cadet's own planet is the brightest thing on the path. */
const spriteFilter = (s: JourneyStop): CSSProperties["filter"] => (s.locked ? "brightness(0.42) saturate(0)" : s.here ? undefined : "brightness(0.8)");

/**
 * The Star map (/map): where you choose where to launch. The whole journey on one screen, on a dashed
 * hairline path out from the Sun: the two warm-ups, then Earth to Deep Space. Each stop shows its planet,
 * its name and what it teaches; cleared stops wear a gold ring and a check, the cadet's planet has the
 * rocket, locked ones are dim silhouettes with a lock. Choosing a stop opens its panel in place, with one
 * action. Arrow keys move along the path, Enter launches. Wide screens get an arc; phones a vertical path
 * that opens scrolled to the cadet.
 */
export function SolarMap({ onHelp }: { onHelp?: () => void } = {}) {
  const router = useRouter();
  const { state } = useCadet();
  const stops = useMemo(() => (state ? journey(state) : null), [state]);
  const here = stops ? hereIndex(stops) : 0;
  const [picked, setPicked] = useState<number | null>(null);
  const sel = picked ?? here;
  const wide = useWide();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const launching = useRef(false);

  useEffect(() => { void import("@/engine/audio").then(({ audio }) => audio.mood("space")); }, []);
  // every sprite this screen shows, the cadet's planet first
  useEffect(() => {
    if (!stops) return;
    const order = [stops[here], ...stops.filter((_, i) => i !== here)];
    void preloadSprites([...order.map((s) => ({ id: s.id, size: wide ? SIZE[s.id] : narrowSize(s.id) })), { id: "sun", size: wide ? SUN.wide : SUN.narrow }]);
    router.prefetch(`/play/${stops[here].id}`);
  }, [stops, here, wide, router]);

  const launch = useCallback((i: number) => {
    const s = stops?.[i];
    if (!s) return;
    setPicked(i);
    if (!s.action || launching.current) return; // a locked stop never launches: its panel says what opens it
    launching.current = true;
    router.push(`/play/${s.id}`);
  }, [stops, router]);

  const move = useCallback((i: number) => {
    if (!stops) return;
    const k = Math.max(0, Math.min(stops.length - 1, i));
    setPicked(k);
    buttons.current[k]?.focus({ preventScroll: wide });
    if (!wide) buttons.current[k]?.scrollIntoView({ block: "nearest" });
  }, [stops, wide]);

  // arrow keys walk the path from anywhere on the screen; Enter on the page itself launches the chosen stop
  useEffect(() => {
    if (!stops) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || document.querySelector("dialog[open], [role=dialog]")) return;
      const t = e.target as HTMLElement | null, onStop = !!t?.closest("[data-stop]"), free = !t || t === document.body || onStop;
      if (!free) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(sel + 1); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(sel - 1); }
      else if (e.key === "Home") { e.preventDefault(); move(0); }
      else if (e.key === "End") { e.preventDefault(); move(stops.length - 1); }
      else if (e.key === "Enter" && !onStop && !e.repeat) { e.preventDefault(); launch(sel); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stops, sel, move, launch]);

  if (!state || !stops) return <div className="fixed inset-0 bg-void" />;

  const stopProps = (s: JourneyStop, i: number) => ({
    "data-stop": s.id,
    ref: (el: HTMLButtonElement | null) => { buttons.current[i] = el; },
    "aria-label": labelOf(s),
    "aria-pressed": i === sel,
    "aria-current": s.here ? ("location" as const) : undefined,
    onClick: () => setPicked(i),
    onFocus: () => setPicked(i),
    // Enter on a stop launches it (Space still just chooses it); holding Enter never launches twice
    onKeyDown: (e: ReactKeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); if (!e.repeat) launch(i); } },
  });

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-void text-approach">
      <Starfield />
      <TopBar className="sticky top-0 z-20 bg-void" left={<HomeLink />} title="Star map" orbs={state.orbs} onHelp={onHelp} />
      {wide
        ? <WideMap stops={stops} sel={sel} state={state} stopProps={stopProps} />
        : <NarrowMap stops={stops} sel={sel} state={state} stopProps={stopProps} />}
    </div>
  );
}

type StopProps = (s: JourneyStop, i: number) => Record<string, unknown>;

/* ---------- the parts every layout shares ---------- */

/** A 22 px badge on the ring's lower right (the check of a cleared stop, the lock of a locked one). */
const badge = (ring: number): CSSProperties => ({ left: "50%", top: "50%", transform: `translate(${ring * 0.354 - 11}px, ${ring * 0.354 - 11}px)` });

/** A stop's planet with its state marks: the gold ring and check, the rocket, the lock. */
function StopPlanet({ s, size, rocket = "above" }: { s: JourneyStop; size: number; rocket?: "above" | "none" }) {
  const ring = size + 14;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <PlanetSprite id={s.id} size={size} alt="" style={{ filter: spriteFilter(s) }} />
      {s.cleared && (
        <>
          <span aria-hidden className="pointer-events-none absolute rounded-full border-[1.5px] border-gold" style={{ width: ring, height: ring }} />
          <span aria-hidden className="absolute grid size-[22px] place-items-center rounded-full border border-gold bg-void text-gold" style={badge(ring)}>
            <Icon name="check" size={14} />
          </span>
        </>
      )}
      {s.locked && (
        <span aria-hidden className="absolute grid size-[22px] place-items-center rounded-full border border-line-3 bg-void text-ink-1" style={badge(ring)}>
          <Icon name="lock" size={13} />
        </span>
      )}
      {s.here && rocket === "above" && (
        <span aria-hidden className="absolute left-1/2 -translate-x-1/2" style={{ bottom: size + 8 }}><RocketGlyph size={40} /></span>
      )}
    </span>
  );
}

/** The chosen stop's panel: name, what it teaches, the cadet's marks, and its one action. */
function StopPanel({ s, state, compact = false, className = "", style }: { s: JourneyStop; state: PlayerState; compact?: boolean; className?: string; style?: CSSProperties }) {
  const w = STOP_WORDS[s.id], rows = stopMarks(state, s.id), jump = s.here ? hyperJump(state) : null;
  const status = stateOf(s);
  return (
    <section aria-label={w.name} className={`rounded-panel border border-line-1 bg-panel p-5 md:p-6 ${className}`} style={style}>
      <div className={compact ? "sr-only" : "flex flex-wrap items-center gap-x-4 gap-y-1"}>
        <h2 className="m-0 type-display text-[clamp(30px,3.2vw,42px)] leading-none">{w.name}</h2>
        <span className="flex items-center gap-1.5 type-body-sm text-ink-2">
          {status === "here" ? <Icon name="rocket" size={18} /> : status === "cleared" ? <Icon name="check" size={18} className="text-gold" /> : status === "locked" ? <Icon name="lock" size={18} /> : null}
          {STATE_WORDS[status]}{s.here && s.cleared ? `, ${STATE_WORDS.cleared.toLowerCase()}` : ""}
        </span>
      </div>
      <p className={`m-0 max-w-[40ch] type-child text-ink-1 ${compact ? "" : "mt-3"}`} aria-live="polite">{s.locked ? s.lockedBy : w.long}</p>
      {!s.locked && rows.length > 0 && (
        <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3">
              <span className="w-10 type-number text-[17px] text-ink-2" aria-hidden>{r.label}</span>
              <Pips marks={r.marks} columns={Math.min(10, r.marks.length)} size={9} label={`${r.name}: ${masterySummary(r.marks)}`} />
            </li>
          ))}
        </ul>
      )}
      {jump && (
        <p className={`m-0 mt-4 flex items-start gap-2 type-body ${jump.ready ? "text-gold" : "text-ink-2"}`}>
          <Icon name="jump" size={20} className="mt-0.5 shrink-0" />{jump.text}
        </p>
      )}
      {s.action && (
        <PillLink href={`/play/${s.id}`} variant="primary" size="md" className="mt-5 w-full justify-between sm:w-auto" aria-label={`${ACTION_WORDS[s.action]}: ${w.name}`}>
          {ACTION_WORDS[s.action]}
        </PillLink>
      )}
    </section>
  );
}

/* ---------- wide: one gentle arc across the screen ---------- */

const ARC = { base: 210, lift: 66, top: 0, height: 360 };
/** Points through the stops as a smooth curve (Catmull-Rom as cubic Béziers). */
function curve(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function WideMap({ stops, sel, state, stopProps }: { stops: JourneyStop[]; sel: number; state: PlayerState; stopProps: StopProps }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const n = stops.length, here = hereIndex(stops);
  const pos = (i: number): [number, number] => { const t = i / (n - 1); return [w * (0.125 + 0.79 * t), ARC.base - ARC.lift * Math.sin(Math.PI * t)]; };
  const sun: [number, number] = [w * 0.005, ARC.base + 34];
  const pts = stops.map((_, i) => pos(i));
  const col = w ? (w * 0.79) / (n - 1) - 6 : 0;
  const panelW = Math.min(540, w - 48), [sx] = w ? pos(sel) : [0];
  const panelLeft = Math.max(24, Math.min(w - panelW - 24, sx - panelW * 0.3));

  return (
    <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-76px)] max-w-[1600px] flex-col justify-center pb-8">
      <div ref={box} className="relative" style={{ height: ARC.height + 300 }}>
        {w > 0 && (
          <>
            <div className="pointer-events-none absolute" style={{ left: sun[0] - SUN.wide / 2, top: sun[1] - SUN.wide / 2 }}>
              <PlanetSprite id="sun" size={SUN.wide} alt="" />
            </div>
            <svg aria-hidden className="pointer-events-none absolute inset-0" width={w} height={ARC.height}>
              <path d={curve([sun, ...pts.slice(0, here + 1)])} className="fill-none stroke-line-3" strokeWidth={1} strokeDasharray="2 6" strokeLinecap="round" />
              <path d={curve(pts.slice(here))} className="fill-none stroke-line-2" strokeWidth={1} strokeDasharray="2 6" strokeLinecap="round" />
            </svg>
            <ol className="m-0 list-none p-0" aria-label="The journey, from the Sun outward">
              {stops.map((s, i) => {
                const [x, y] = pts[i], size = SIZE[s.id], chosen = i === sel;
                return (
                  <li key={s.id} className="contents">
                    <UiButton {...stopProps(s, i)}
                      className="group absolute flex flex-col items-center gap-3 rounded-chip pb-2 outline-offset-4"
                      style={{ left: x - col / 2, top: y - size / 2 - 6, width: col, paddingTop: 6 }}>
                      <StopPlanet s={s} size={size} />
                      <span className="flex flex-col items-center gap-0.5 text-center">
                        <span className={`type-name text-[18px] leading-tight ${s.locked ? "text-ink-3" : chosen ? "text-approach" : "text-ink-1"} ${chosen ? "underline decoration-gold decoration-1 underline-offset-[6px]" : "group-hover:underline group-hover:decoration-line-3 group-hover:decoration-1 group-hover:underline-offset-[6px]"}`}>{STOP_WORDS[s.id].name}</span>
                        <span className={`type-body text-[17px] leading-snug ${s.locked ? "text-ink-3" : "text-ink-2"}`}>{STOP_WORDS[s.id].teaches}</span>
                      </span>
                    </UiButton>
                    {chosen && (
                      <StopPanel s={s} state={state} className="absolute" style={{ left: panelLeft, top: ARC.height + 8, width: panelW }} />
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </main>
  );
}

/* ---------- narrow: a vertical path that opens scrolled to the cadet ---------- */

function NarrowMap({ stops, sel, state, stopProps }: { stops: JourneyStop[]; sel: number; state: PlayerState; stopProps: StopProps }) {
  const list = useRef<HTMLOListElement>(null);
  const here = hereIndex(stops);
  const [travelled, setTravelled] = useState(0);
  // open on the cadet's planet, and measure how far down the path the rocket is
  useLayoutEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-stop="${stops[here].id}"]`);
    if (!el || !list.current) return;
    // the cadet's stop and its panel (with Launch) in view: centred when they fit, else from the top
    const group = el.closest("li") ?? el;
    group.scrollIntoView({ block: group.offsetHeight + 96 > innerHeight ? "start" : "center" });
    const top = list.current.getBoundingClientRect().top, r = el.getBoundingClientRect();
    setTravelled(r.top - top + 48);
  }, [stops, here]);

  return (
    <main className="relative z-10 mx-auto w-full max-w-[640px] px-4 pb-10">
      <div className="pointer-events-none relative h-[110px] overflow-hidden" aria-hidden>
        <div className="absolute" style={{ left: 48 - SUN.narrow / 2, top: -SUN.narrow / 2 - 10 }}><PlanetSprite id="sun" size={SUN.narrow} alt="" /></div>
      </div>
      <div className="relative">
        {/* the path: travelled from the Sun to the rocket, then the way ahead */}
        <span aria-hidden className="absolute left-[47px] top-[-60px] border-l border-dashed border-line-3" style={{ height: travelled + 60 }} />
        <span aria-hidden className="absolute bottom-6 left-[47px] border-l border-dashed border-line-2" style={{ top: travelled }} />
        <ol ref={list} className="relative m-0 flex list-none flex-col gap-1 p-0" aria-label="The journey, from the Sun outward">
          {stops.map((s, i) => {
            const size = narrowSize(s.id), chosen = i === sel, st = stateOf(s);
            return (
              <li key={s.id} className="flex scroll-mt-[72px] flex-col">
                <UiButton {...stopProps(s, i)} className={`grid min-h-[96px] grid-cols-[96px_1fr] items-center gap-3 rounded-chip py-3 pr-3 text-left transition-colors ${chosen ? "bg-raised" : "hover:bg-raised"}`}>
                  <span className="grid place-items-center">
                    <span className="relative">
                      <StopPlanet s={s} size={size} rocket="none" />
                      {s.here && <span aria-hidden className="absolute -right-5 -top-5"><RocketGlyph size={34} /></span>}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={`type-name text-[19px] leading-tight ${s.locked ? "text-ink-3" : "text-approach"}`}>{STOP_WORDS[s.id].name}</span>
                    <span className={`type-body text-[17px] leading-snug ${s.locked ? "text-ink-3" : "text-ink-2"}`}>{STOP_WORDS[s.id].teaches}</span>
                    {(st === "here" || st === "cleared" || st === "locked") && (
                      <span className={`mt-1 flex items-center gap-1.5 type-body-sm ${st === "cleared" ? "text-gold" : "text-ink-2"}`}>
                        <Icon name={st === "here" ? "rocket" : st === "cleared" ? "check" : "lock"} size={16} />{STATE_WORDS[st]}
                      </span>
                    )}
                  </span>
                </UiButton>
                {chosen && <StopPanel s={s} state={state} compact className="mb-3 mt-1" />}
              </li>
            );
          })}
        </ol>
      </div>
    </main>
  );
}
