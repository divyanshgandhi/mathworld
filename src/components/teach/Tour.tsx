"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { hold } from "@/components/battle/pause";
import { Button } from "@/components/kit/Button";
import { NovaPortrait } from "@/components/kit/Brand";
import { MOTION, RADIUS } from "@/design/tokens";
import type { Box } from "@/teach/guide";
import { useSeen, type SeenSource } from "@/teach/seen";
import { clipTo, placePlate, ringOf, tourKey, TOURS, type TourId, type TourStep } from "@/teach/tour";
import { tourState } from "@/teach/tourState";
import { useReducedMotion } from "./motion";

/**
 * The spotlight tour (review-round decision 8): the screen dims, one control shows through a rounded
 * cut-out with a gold hairline ring, and a small plate beside it carries Nova's one line, the step
 * dots, "Next" ("Got it" on the last) and a quiet "Skip".
 *
 *   <Tour id="bay" steps={TOURS.bay} seen={{ seen: state.seen, emit }} />
 *   <ScreenTour id="bay" seen={{ seen: state.seen, emit }} />     // the same, with the steps from src/teach/tour.ts
 *
 * - It starts on the first visit (seen key `tour:<id>`), once the screen has settled: no dialog, card
 *   or sheet open and the guided first shot not running. It is marked seen when its first step shows.
 * - A step whose `data-guide` anchor is missing or hidden is skipped. If none is there it ends
 *   without being marked seen, so it can show on a later visit.
 * - `when={false}` holds it back (a wave in action, a film playing). `hold` holds the game still
 *   with `hold.on("tour")` while it shows (the battle).
 * - If a dialog or card opens over it, it closes (it never stays open under a card).
 * - Focus stays in the plate; Escape skips; Enter goes on; the line is announced politely.
 * - Replay: a mounted `ScreenTour` is what the Field Manual's "Show me around" runs again.
 */
export function Tour({ id, steps, seen, when = true, hold: holdGame = false, force = false, onDone }: {
  id: string; steps: readonly TourStep[]; seen?: SeenSource; when?: boolean; hold?: boolean;
  /** Show it even if it has been seen (the dev review and dev parameters). */
  force?: boolean;
  onDone?: (how: "done" | "skipped" | "nothing" | "interrupted") => void;
}) {
  const t = useTour({ id, steps, seen, when, hold: holdGame, force, onDone });
  return t.open ? <Spotlight {...t} /> : null;
}

/** The drop-in for a screen: its tour from src/teach/tour.ts, and the target of "Show me around". */
export function ScreenTour({ id, seen, when, hold: holdGame, force, onDone }: {
  id: TourId; seen?: SeenSource; when?: boolean; hold?: boolean; force?: boolean; onDone?: (how: "done" | "skipped" | "nothing" | "interrupted") => void;
}) {
  useEffect(() => tourState.mount(id), [id]);
  return <Tour id={id} steps={TOURS[id]} seen={seen} when={when} hold={holdGame} force={force} onDone={onDone} />;
}

/* ---------- the page, read from the DOM ---------- */

const BUSY = '[role="dialog"], [role="alertdialog"], dialog[open], [aria-modal="true"]';

function visible(el: Element): boolean {
  if (el.closest("[data-tour]")) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  const cv = (el as HTMLElement & { checkVisibility?: (o?: object) => boolean }).checkVisibility;
  return cv ? cv.call(el, { opacityProperty: true, visibilityProperty: true }) : true;
}

/** The first visible element carrying this anchor, or null. */
export function findAnchor(anchor: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-guide="${CSS.escape(anchor)}"]`)) if (visible(el)) return el;
  return null;
}

/** Whether something covers the screen now: a dialog, a card or a sheet, or the guided first shot. */
export function pageBusy(): boolean {
  if (tourState.guideRunning) return true;
  for (const el of document.querySelectorAll(BUSY)) if (visible(el)) return true;
  return false;
}

/** The screen less its safe areas and a small margin, in CSS px. */
function viewBox(probe: HTMLElement | null, margin = 8): Box {
  const vv = window.visualViewport;
  const W = vv?.width ?? innerWidth, H = vv?.height ?? innerHeight;
  const cs = probe ? getComputedStyle(probe) : null;
  const px = (v: string | undefined) => parseFloat(v ?? "0") || 0;
  const t = px(cs?.paddingTop), r = px(cs?.paddingRight), b = px(cs?.paddingBottom), l = px(cs?.paddingLeft);
  return { x: l + margin, y: t + margin, w: W - l - r - margin * 2, h: H - t - b - margin * 2 };
}

/* ---------- the hook ---------- */

type How = "done" | "skipped" | "nothing" | "interrupted";

export function useTour({ id, steps, seen, when = true, hold: holdGame = false, force = false, onDone }: {
  id: string; steps: readonly TourStep[]; seen?: SeenSource; when?: boolean; hold?: boolean; force?: boolean; onDone?: (how: How) => void;
}) {
  const { seen: met, mark } = useSeen(tourKey(id), seen);
  // decided once, on the first render that knows the answer: a tour never comes back by itself mid-visit
  const [want, setWant] = useState<boolean | null>(null);
  if (want === null && (force || met !== null)) setWant(force || !met);
  const [run, setRun] = useState<{ order: number[]; at: number } | null>(null);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; });

  // "Show me around" from the Field Manual
  const asked = useSyncExternalStore(tourState.subscribe, () => tourState.replay === id, () => false);
  if (asked && !run && want !== true) setWant(true);
  useEffect(() => { if (asked && want) tourState.takeReplay(id); }, [asked, want, id]);

  const end = useCallback((how: How) => { setRun(null); setWant(false); doneRef.current?.(how); }, []);

  // wait for the screen to settle, then start on the anchors that are there
  useEffect(() => {
    if (!want || run || !when) return;
    let calm = 0, waited = 0;
    const iv = setInterval(() => {
      if (pageBusy()) { calm = 0; return; }
      calm += 200;
      if (calm < 600) return;
      const order = steps.flatMap((s, i) => (findAnchor(s.anchor) ? [i] : []));
      if (order.length) { mark(); setRun({ order, at: 0 }); return; }
      waited += 200;
      if (waited >= 3000) end("nothing"); // nothing to show: not marked seen
    }, 200);
    return () => clearInterval(iv);
  }, [want, run, when, steps, mark, end]);

  // a step whose anchor has gone is passed over; a card opening over the tour closes it
  const advance = useCallback(() => {
    setRun((r) => {
      if (!r) return r;
      for (let k = r.at + 1; k < r.order.length; k++) if (findAnchor(steps[r.order[k]].anchor)) return { ...r, at: k };
      queueMicrotask(() => end("done"));
      return r;
    });
  }, [steps, end]);
  const skip = useCallback(() => end("skipped"), [end]);

  useEffect(() => {
    if (!run) return;
    const iv = setInterval(() => {
      if (!when || pageBusy()) end("interrupted");
      else if (!findAnchor(steps[run.order[run.at]].anchor)) advance();
    }, 250);
    return () => clearInterval(iv);
  }, [run, when, steps, advance, end]);

  // the battle holds still while the tour shows
  const open = !!run;
  useEffect(() => {
    if (!open || !holdGame) return;
    hold.on("tour");
    return () => hold.off("tour");
  }, [open, holdGame]);

  const step = run ? steps[run.order[run.at]] : null;
  return { open, step, index: run?.at ?? 0, count: run?.order.length ?? 0, next: advance, skip };
}

/* ---------- the spotlight ---------- */

const PAD = 6;
const PLATE_W = 340;

function Spotlight({ step, index, count, next, skip }: ReturnType<typeof useTour>) {
  const reduced = useReducedMotion();
  const plate = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const [geo, setGeo] = useState<{ ring: Box; view: Box; size: { w: number; h: number } } | null>(null);
  const anchor = step?.anchor ?? "";
  const last = index === count - 1;

  // the target first scrolls into view
  useEffect(() => {
    const el = findAnchor(anchor);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) el.scrollIntoView({ block: "center", inline: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [anchor, reduced]);

  // follow the target and the screen every frame (resize, scroll, rotation, a target that moves)
  useLayoutEffect(() => {
    let raf = 0, prev = "";
    const tick = () => {
      const el = findAnchor(anchor);
      if (el) {
        const view = viewBox(probe.current);
        const r = el.getBoundingClientRect();
        const ring = clipTo(ringOf({ x: r.left, y: r.top, w: r.width, h: r.height }, PAD), { x: 0, y: 0, w: innerWidth, h: innerHeight });
        const size = { w: Math.min(PLATE_W, view.w), h: plate.current?.offsetHeight ?? 120 };
        const key = [ring.x, ring.y, ring.w, ring.h, view.w, view.h, size.w, size.h].map((n) => Math.round(n)).join(",");
        if (key !== prev) { prev = key; setGeo({ ring, view, size }); }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [anchor]);

  // focus stays in the plate; keys belong to the tour while it shows
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => { if (before?.isConnected) before.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { nextBtn.current?.focus({ preventScroll: true }); }, [anchor]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inPlate = !!plate.current?.contains(e.target as Node);
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); skip(); return; }
      if (e.key === "Enter" || e.key === " ") {
        if (inPlate && (e.target as HTMLElement).tagName === "BUTTON") return; // the focused button acts
        e.preventDefault(); if (e.key === "Enter") next(); return;
      }
      if (e.key === "Tab") {
        const btns = Array.from(plate.current?.querySelectorAll<HTMLElement>("button") ?? []);
        if (!btns.length) return;
        e.preventDefault();
        const i = btns.indexOf(document.activeElement as HTMLElement);
        btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
        return;
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey) e.preventDefault(); // typing does not reach the game under the tour
    };
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, [next, skip]);

  const place = geo ? placePlate(geo.ring, geo.size, geo.view) : null;
  const move = reduced ? "none" : `left ${MOTION.route}ms ${MOTION.ease}, top ${MOTION.route}ms ${MOTION.ease}, width ${MOTION.route}ms ${MOTION.ease}, height ${MOTION.route}ms ${MOTION.ease}`;

  return createPortal(
    <div data-tour className="fixed inset-0 z-[60]">
      <div ref={probe} aria-hidden className="pointer-events-none fixed inset-0 invisible pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]" />
      {/* taps outside the plate do nothing: the tour is read, then dismissed with its own buttons */}
      <div className="absolute inset-0" onPointerDown={(e) => e.preventDefault()} />
      {geo && (
        <div aria-hidden className="pointer-events-none fixed border border-gold"
          style={{ left: geo.ring.x, top: geo.ring.y, width: geo.ring.w, height: geo.ring.h, borderRadius: RADIUS.chip, boxShadow: "0 0 0 200vmax var(--color-scrim)", transition: move }} />
      )}
      <div ref={plate} role="dialog" aria-modal="true" aria-label="Show me around"
        className="fixed flex flex-col gap-3 rounded-panel border border-line-2 bg-panel p-4 text-approach"
        style={{ left: place?.x ?? 0, top: place?.y ?? 0, width: geo?.size.w ?? PLATE_W, visibility: place ? "visible" : "hidden", transition: move }}>
        <div className="flex items-start gap-3">
          <NovaPortrait size={40} />
          <p key={anchor} className="m-0 min-w-0 flex-1 pt-1.5 type-child text-[19px] leading-snug text-balance" aria-live="polite">{step?.line}</p>
        </div>
        <div className="flex items-center gap-2">
          {count > 1 && (
            <span className="mr-auto flex items-center gap-2 pl-1" role="img" aria-label={`Step ${index + 1} of ${count}`}>
              {Array.from({ length: count }, (_, i) => (
                <span key={i} className={`block size-2 rounded-full border ${i === index ? "border-approach bg-approach" : "border-line-3"}`} />
              ))}
            </span>
          )}
          {!last && <Button variant="quiet" size="sm" onClick={skip} className={count > 1 ? "" : "mr-auto"}>Skip</Button>}
          <Button ref={nextBtn} size="sm" onClick={next} className={`min-w-[96px] justify-center ${count > 1 || !last ? "" : "ml-auto"}`}>{last ? "Got it" : "Next"}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
