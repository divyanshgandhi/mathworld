"use client";
import { Button as UiButton } from "@ui-sdk/react/button";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MOTION } from "@/design/tokens";
import type { PlayerState } from "@/director/fold";
import { HomeLink, Icon, IconButton, masterySummary, PillLink, Pips, RocketGlyph, TopBar } from "./kit";
import { useCadet } from "./hub/useCadet";
import { FieldManual } from "./teach/FieldManual";
import { Greeting } from "./teach/Greeting";
import { buttonOf, cardLine, chipOf, hyperJump, journey, openingPage, stopMarks, type JourneyStop } from "./world/journey";
import { ARROW, DOTS_H, mapLayout, type MapLayout } from "./world/mapLayout";
import { PlanetSprite } from "./world/PlanetSprite";
import { preloadSprites } from "./world/spriteStore";
import { Starfield } from "./world/Starfield";
import { STATE_WORDS, STOP_WORDS } from "./world/words";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Exponential ease-out, the house curve, for the one scripted move (an arrow, a key or a dot). */
const easeOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
/** Pages this close to the one in view draw their planet; the rest hold its place with a hairline circle. */
const NEAR = 2;

const labelOf = (s: JourneyStop) => `${STOP_WORDS[s.id].name}, ${chipOf(s).text.toLowerCase()}`;

/** Read where the map was asked to open: `?at=` (a reload) or `?locked=` (a locked planet's address). */
function askedFor() {
  if (typeof location === "undefined") return {};
  const q = new URLSearchParams(location.search);
  return { at: q.get("at"), locked: q.get("locked") };
}

/**
 * The Star map (/map): a pager, one planet a page, opening on the cadet's own planet. The planet is the
 * hero, its neighbours peek in dim at the edges on a dashed path, and its card says where it stands, what
 * it teaches and its one action. Move by scrolling or swiping sideways (it snaps a page at a time), the
 * arrows at the sides, the arrow keys, or the ten journey dots under the page.
 */
export function SolarMap({ onHelp }: { onHelp?: () => void } = {}) {
  const router = useRouter();
  const { state, emit } = useCadet();
  const [help, setHelp] = useState(false);
  const stops = useMemo(() => (state ? journey(state) : null), [state]);
  const [asked] = useState(askedFor);
  const [at, setAt] = useState<number | null>(null);
  const page = at ?? (stops ? openingPage(stops, asked) : 0);

  const scroller = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const prevBtn = useRef<HTMLButtonElement>(null), nextBtn = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [cardH, setCardH] = useState(300);
  const atRef = useRef(page);
  // the page in view, for handlers and effects (kept in step before anything below reads it)
  useLayoutEffect(() => { atRef.current = page; }, [page]);
  const tween = useRef<{ raf: number; timer: number } | null>(null);
  const launching = useRef(false);

  useEffect(() => { void import("@/engine/audio").then(({ audio }) => audio.mood("space")); }, []);

  // the pager's size: one observer; a resize or a rotation keeps the same page in view
  const ready = !!stops;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const read = () => setBox((b) => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }));
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, [ready]);
  // open on the page at once (no ride past the others), and stay on it through a resize
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !box.w || tween.current) return;
    el.scrollLeft = atRef.current * box.w;
  }, [box.w, ready]);

  // the tallest card decides how much room the planet has above it on a phone, so the button is always in view
  useLayoutEffect(() => {
    if (!ready) return;
    const read = () => { const h = Math.max(0, ...cards.current.map((c) => c?.offsetHeight ?? 0)); if (h) setCardH((o) => (Math.abs(o - h) < 2 ? o : h)); };
    const ro = new ResizeObserver(read);
    cards.current.forEach((c) => c && ro.observe(c));
    read();
    return () => ro.disconnect();
  }, [ready, box.w]);

  const L = useMemo(() => (box.w ? mapLayout(box.w, box.h, cardH) : null), [box.w, box.h, cardH]);

  // the planets this screen shows, the one in view first, then its neighbours, then the rest
  useEffect(() => {
    if (!stops || !L) return;
    const order = stops.map((_, i) => i).sort((a, b) => Math.abs(a - page) - Math.abs(b - page));
    void preloadSprites([
      ...order.slice(0, 3).flatMap((i) => [{ id: stops[i].id, size: L.hero }, { id: stops[i].id, size: L.peek }]),
      { id: "sun" as const, size: sunSize(L) },
      ...order.slice(3).flatMap((i) => [{ id: stops[i].id, size: L.hero }, { id: stops[i].id, size: L.peek }]),
    ]);
  }, [stops, L, page]);
  useEffect(() => { if (stops) router.prefetch(`/play/${stops[page].id}`); }, [stops, page, router]);

  // the address follows the page (replace, never push: Back leaves the map, it does not walk the planets)
  useEffect(() => {
    if (!stops || at === null) return;
    const t = window.setTimeout(() => {
      const u = new URL(location.href);
      u.searchParams.set("at", stops[at].id);
      u.searchParams.delete("locked");
      if (u.href !== location.href) history.replaceState(history.state, "", u.href);
    }, 200);
    return () => window.clearTimeout(t);
  }, [stops, at]);

  const settle = useCallback(() => {
    const el = scroller.current, t = tween.current;
    if (t) { cancelAnimationFrame(t.raf); clearTimeout(t.timer); tween.current = null; }
    if (el) { el.scrollLeft = atRef.current * el.clientWidth; el.style.scrollSnapType = ""; }
  }, []);

  /** Go to a page: at most MOTION.route ms, none under reduced motion. */
  const go = useCallback((i: number) => {
    const el = scroller.current;
    if (!stops || !el) return;
    const k = Math.max(0, Math.min(stops.length - 1, i));
    // an arrow that is about to vanish (the first or last page) hands focus to the other one
    const f = document.activeElement;
    if ((k === 0 && f === prevBtn.current) || (k === stops.length - 1 && f === nextBtn.current)) (k === 0 ? nextBtn : prevBtn).current?.focus({ preventScroll: true });
    if (tween.current) settle();
    atRef.current = k;
    setAt(k);
    const from = el.scrollLeft, to = k * el.clientWidth;
    if (reduced() || Math.abs(to - from) < 1) { el.scrollLeft = to; return; }
    el.style.scrollSnapType = "none";
    const t0 = performance.now();
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / MOTION.route);
      el.scrollLeft = from + (to - from) * easeOut(p);
      if (p < 1 && tween.current) tween.current.raf = requestAnimationFrame(frame);
      else settle();
    };
    // a hidden tab runs no frames: the timer lands the page anyway
    tween.current = { raf: requestAnimationFrame(frame), timer: window.setTimeout(settle, MOTION.route + 60) };
  }, [stops, settle]);

  // a scroll or swipe by hand: the page nearest the middle is the page
  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el || tween.current || !el.clientWidth) return;
    const k = Math.round(el.scrollLeft / el.clientWidth);
    if (k !== atRef.current && stops && k >= 0 && k < stops.length) { atRef.current = k; setAt(k); }
  }, [stops]);

  const launch = useCallback(() => {
    const s = stops?.[atRef.current];
    if (!s?.action || launching.current) return;
    launching.current = true;
    router.push(`/play/${s.id}`);
  }, [stops, router]);

  // the arrow keys move a page from anywhere on the screen; Enter on the page itself takes the page's one action
  useEffect(() => {
    if (!stops) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || document.querySelector("dialog[open], [role=dialog]")) return;
      const t = e.target as HTMLElement | null;
      if (t && t !== document.body && !t.closest("[data-pager]") && !t.closest("[data-map-control]")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(atRef.current + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(atRef.current - 1); }
      else if (e.key === "Home") { e.preventDefault(); go(0); }
      else if (e.key === "End") { e.preventDefault(); go(stops.length - 1); }
      else if (e.key === "Enter" && !e.repeat && (!t || t === document.body || t === scroller.current)) { e.preventDefault(); launch(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stops, go, launch]);

  useEffect(() => () => { const t = tween.current; if (t) { cancelAnimationFrame(t.raf); clearTimeout(t.timer); } }, []);

  if (!state || !stops) return <div className="fixed inset-0 bg-void" />;
  const last = stops.length - 1;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-void text-approach">
      <Starfield />
      <TopBar className="relative z-20 shrink-0" left={<HomeLink />} title="Star map" orbs={state.orbs} onHelp={onHelp ?? (() => setHelp(true))} />
      <main className="relative z-10 min-h-0 flex-1">
        <div
          ref={scroller}
          data-pager
          tabIndex={-1}
          onScroll={onScroll}
          role="region"
          aria-roledescription="carousel"
          aria-label="The journey, one planet at a time"
          className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {stops.map((s, i) => (
            <Page key={s.id} s={s} i={i} n={stops.length} state={state} L={L} current={i === page} near={Math.abs(i - page) <= NEAR}
              prev={stops[i - 1] ?? null} next={stops[i + 1] ?? null}
              cardRef={(el) => { cards.current[i] = el; }} />
          ))}
        </div>
        {L && (
          <>
            {page > 0 && (
              <IconButton ref={prevBtn} data-map-control data-guide="map-prev" icon="back" label={`Back to ${STOP_WORDS[stops[page - 1].id].inSentence}`}
                className="absolute z-20 bg-void" style={{ left: L.arrowLeftX, top: L.arrowY - ARROW / 2, width: ARROW, height: ARROW }} onClick={() => go(page - 1)} />
            )}
            {page < last && (
              <IconButton ref={nextBtn} data-map-control data-guide="map-next" icon="forward" label={`On to ${STOP_WORDS[stops[page + 1].id].inSentence}`}
                className="absolute z-20 bg-void" style={{ left: L.arrowRightX, top: L.arrowY - ARROW / 2, width: ARROW, height: ARROW }} onClick={() => go(page + 1)} />
            )}
            <JourneyDots stops={stops} page={page} L={L} onPick={go} />
          </>
        )}
      </main>
      <Greeting screen="map" seen={{ seen: state.seen, emit }} />
      <FieldManual open={help} onClose={() => setHelp(false)} topic="squads" seen={{ seen: state.seen, emit }} replayFrom="/map" />
    </div>
  );
}

const sunSize = (L: MapLayout) => Math.max(96, Math.floor((L.hero * 1.1) / 8) * 8);

/* ---------- one page: the planet, its neighbours on the path, its card ---------- */

function Page({ s, i, n, state, L, current, near, prev, next, cardRef }: {
  s: JourneyStop; i: number; n: number; state: PlayerState; L: MapLayout | null; current: boolean; near: boolean;
  prev: JourneyStop | null; next: JourneyStop | null; cardRef: (el: HTMLElement | null) => void;
}) {
  const w = STOP_WORDS[s.id];
  return (
    <section
      className="relative h-full w-full shrink-0 snap-center snap-always"
      role="group"
      aria-roledescription="slide"
      aria-label={`${i + 1} of ${n}: ${w.name}`}
      aria-hidden={!current || undefined}
      inert={!current}
    >
      {L && (
        <>
          {/* the path: a dashed hairline through the neighbours and the planet */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line-2" style={{ top: L.heroCy }} />
          {i === 0
            ? <Peek id="sun" size={sunSize(L)} cx={L.peekLeftCx - sunSize(L) * 0.3} cy={L.heroCy} near={near} sun />
            : prev && <Peek id={prev.id} size={L.peek} cx={L.peekLeftCx} cy={L.heroCy} near={near} />}
          {next && <Peek id={next.id} size={L.peek} cx={L.peekRightCx} cy={L.heroCy} near={near} />}
          <Hero s={s} L={L} near={near} current={current} />
          <Card s={s} state={state} L={L} current={current} cardRef={cardRef} />
        </>
      )}
    </section>
  );
}

function Peek({ id, size, cx, cy, near, sun = false }: { id: JourneyStop["id"] | "sun"; size: number; cx: number; cy: number; near: boolean; sun?: boolean }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute ${sun ? "" : "opacity-45"}`} style={{ left: cx - size / 2, top: cy - size / 2, width: size, height: size }}>
      {near ? <PlanetSprite id={id} size={size} alt="" /> : null}
    </span>
  );
}

/** The page's planet, large, with its marks: the gold ring and check when cleared, the lock when locked, the rocket when it is the cadet's. */
function Hero({ s, L, near, current }: { s: JourneyStop; L: MapLayout; near: boolean; current: boolean }) {
  const size = L.hero, ring = size + 18, badge = Math.max(28, Math.round(size * 0.12));
  const off = ring * 0.354 - badge / 2;
  return (
    <span data-guide={current ? "map-planet" : undefined} className="absolute grid place-items-center"
      style={{ left: L.heroCx - size / 2, top: L.heroCy - size / 2, width: size, height: size }}>
      {near
        ? <PlanetSprite id={s.id} size={size} alt={STOP_WORDS[s.id].name} style={s.locked ? { filter: "brightness(0.42) saturate(0)" } : undefined} />
        : <span aria-hidden className="rounded-full border border-line-1" style={{ width: size * 0.8, height: size * 0.8 }} />}
      {s.cleared && <span aria-hidden className="pointer-events-none absolute rounded-full border-[1.5px] border-gold" style={{ width: ring, height: ring }} />}
      {(s.cleared || s.locked) && (
        <span aria-hidden className={`absolute grid place-items-center rounded-full border bg-void ${s.cleared ? "border-gold text-gold" : "border-line-3 text-ink-1"}`}
          style={{ width: badge, height: badge, left: "50%", top: "50%", transform: `translate(${off - badge / 2}px, ${off - badge / 2}px)` }}>
          <Icon name={s.cleared ? "check" : "lock"} size={Math.round(badge * 0.6)} />
        </span>
      )}
      {s.here && (
        <span aria-hidden className="absolute" style={{ left: "50%", top: "50%", transform: `translate(${-off - 22}px, ${-off - 22}px)` }}><RocketGlyph size={44} /></span>
      )}
    </span>
  );
}

/** The card: as wide as its words, everything on one left edge. Chip, name, one line, the table rows, one button. */
function Card({ s, state, L, current, cardRef }: { s: JourneyStop; state: PlayerState; L: MapLayout; current: boolean; cardRef: (el: HTMLElement | null) => void }) {
  const w = STOP_WORDS[s.id], chip = chipOf(s), rows = s.locked ? [] : stopMarks(state, s.id), jump = s.here ? hyperJump(state) : null, btn = buttonOf(s);
  const tight = L.short;
  const pos: CSSProperties = L.mode === "side"
    ? { left: L.cardLeft, top: L.cardCy, transform: "translateY(-50%)", maxWidth: L.cardMaxW }
    : { left: "50%", top: L.cardTop, transform: "translateX(-50%)", maxWidth: L.cardMaxW };
  return (
    <section ref={cardRef} data-guide={current ? "map-card" : undefined} aria-label={w.name}
      className={`absolute flex w-max flex-col items-start rounded-panel border border-line-1 bg-panel ${tight ? "gap-2 p-4" : "gap-3 p-5"}`}
      style={{ ...pos, minWidth: Math.min(320, L.cardMaxW) }}>
      <span className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-line-2 px-3 type-name text-[17px] leading-none text-ink-1">
        {chip.icon && <Icon name={chip.icon} size={18} className={chip.icon === "lock" ? "text-ink-2" : "text-gold"} />}
        {chip.text}{s.here && s.cleared ? `, ${STATE_WORDS.cleared.toLowerCase()}` : ""}
      </span>
      <h2 className={`m-0 type-display text-balance ${tight ? "text-[28px]" : "text-[clamp(30px,3vw,40px)]"}`}>{w.name}</h2>
      <p className="m-0 type-child text-ink-1" aria-live={current ? "polite" : undefined}>{cardLine(s)}</p>
      {rows.length > 0 && (
        <ul className={`m-0 flex list-none flex-col p-0 ${tight ? "gap-1" : "gap-2"}`}>
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3">
              <span className="w-10 type-number text-[17px] text-ink-2" aria-hidden>{r.label}</span>
              <Pips marks={r.marks} columns={Math.min(10, r.marks.length)} size={9} label={`${r.name}: ${masterySummary(r.marks)}`} />
            </li>
          ))}
        </ul>
      )}
      {jump && (
        <p className={`m-0 flex max-w-[34ch] items-start gap-2 type-body ${jump.ready ? "text-gold" : "text-ink-2"}`}>
          <Icon name="jump" size={20} className="mt-0.5 shrink-0" />{jump.text}
        </p>
      )}
      {btn && (
        <PillLink href={`/play/${s.id}`} variant={btn.primary ? "primary" : "secondary"} size="md" data-guide={current ? "map-launch" : undefined}
          className={tight ? "mt-1" : "mt-2"} aria-label={`${btn.text}: ${w.name}`}>
          {btn.text}
        </PillLink>
      )}
    </section>
  );
}

/* ---------- the ten dots of the whole journey ---------- */

/** The dot of one stop: the cadet's planet a gold ring, a cleared one filled with a check, a locked one a small lock. */
function Dot({ s }: { s: JourneyStop }) {
  if (s.here) return <span className="block size-[14px] rounded-full border-2 border-gold" />;
  if (s.locked) return <Icon name="lock" size={14} className="text-ink-3" />;
  if (s.cleared) return <span className="grid size-[16px] place-items-center rounded-full bg-gold text-void"><Icon name="check" size={11} /></span>;
  return <span className="block size-[10px] rounded-full border border-line-3" />;
}

function JourneyDots({ stops, page, L, onPick }: { stops: JourneyStop[]; page: number; L: MapLayout; onPick: (i: number) => void }) {
  // 44 px a dot where the page has room; a small phone gets the widest dots that fit in one row
  const each = L.dotEach, W = stops.length * each;
  return (
    <nav aria-label="The whole journey" data-guide="map-dots" data-map-control className="absolute z-20 flex items-center"
      style={{ left: Math.max(4, L.dotsCx - W / 2), top: L.dotsTop, height: DOTS_H }}>
      {stops.map((s, i) => (
        <UiButton key={s.id} aria-label={labelOf(s)} aria-current={i === page ? "page" : undefined} onClick={() => onPick(i)}
          style={{ width: each }} className="relative grid h-11 place-items-center rounded-full outline-offset-0">
          <Dot s={s} />
          {i === page && <span aria-hidden className="pointer-events-none absolute bottom-0.5 left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full bg-approach" />}
        </UiButton>
      ))}
    </nav>
  );
}
