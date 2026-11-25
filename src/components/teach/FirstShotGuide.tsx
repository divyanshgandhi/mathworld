"use client";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import type { Bus } from "@/battle/bus";
import type { ArenaUi } from "@/worlds/space/arena";
import { freeArea, GUIDE_START, guideShows, guideStep, placeCaption, COUNT_MS, type Box, type GuideAnchor, type GuideEvent, type Side } from "@/teach/guide";
import { GUIDE_FIRST_SHOT } from "@/teach/keys";
import { useSeen, type SeenSource } from "@/teach/seen";

/**
 * The guided first shot: a coach layer for a player's very first wave, gone for good once that
 * first shot resolves (seen key `guide:first-shot`).
 *
 *   <FirstShotGuide ui={ui} bus={arena?.bus ?? null} />
 *
 * 1. It rings the fleet: "Count the ships."
 * 2. It points at the keypad: "Type how many."
 * 3. On the first digit, it points at Fire: "Now press Fire."
 * The shot hides it; when the shot resolves it is recorded and never shows again.
 *
 * A dim scrim with a cut-out round the thing it points at, a hairline ring, and one short caption
 * beside it. It takes no pointer events and no focus, so it never blocks or covers the control it
 * points at. It finds its anchors by the console's `data-guide` names ("fleet" is optional: pass
 * `fleetRect` when the arena can say where the fleet is) and measures them with a ResizeObserver,
 * so it works in every layout. If an anchor is missing it shows nothing at all.
 */
export function FirstShotGuide({ ui, bus, seen, fleetRect, rocketRect, root }: {
  ui: ArenaUi | null;
  bus: Bus | null;
  seen?: SeenSource;
  /** Where the fleet is on screen, in CSS px, if the arena can say. */
  fleetRect?: () => DOMRect | null;
  /** Where the rocket is on screen: captions keep off it (the typed number rides its nose). */
  rocketRect?: () => DOMRect | null;
  /** Where to look for `data-guide` anchors (default: the whole document). */
  root?: HTMLElement | null;
}) {
  const { seen: met, mark } = useSeen(GUIDE_FIRST_SHOT, seen);
  if (met !== false) return null;
  return <Guide ui={ui} bus={bus} mark={mark} fleetRect={fleetRect} rocketRect={rocketRect} root={root} />;
}

const now = () => performance.now();

function Guide({ ui, bus, mark, fleetRect, rocketRect, root }: { ui: ArenaUi | null; bus: Bus | null; mark: () => void; fleetRect?: () => DOMRect | null; rocketRect?: () => DOMRect | null; root?: HTMLElement | null }) {
  const [state, send] = useReducer(guideStep, GUIDE_START);

  useEffect(() => { send({ type: "ui", ui: ui ? { wave: ui.wave, canFire: ui.canFire, lesson: ui.lesson, done: ui.done, offer: ui.offer } : null, now: now() }); }, [ui]);
  useEffect(() => {
    if (!bus) return;
    const offs = [
      bus.on("charge", (p) => send({ type: "charge", n: p.n, now: now() })),
      bus.on("fire", () => send({ type: "fire", now: now() })),
      bus.on("resolved", () => send({ type: "resolved", now: now() })),
    ];
    return () => offs.forEach((off) => off());
  }, [bus]);
  useEffect(() => {
    if (state.step !== "count") return;
    const t = setTimeout(() => send({ type: "tick", now: now() } satisfies GuideEvent), COUNT_MS);
    return () => clearTimeout(t);
  }, [state.step, state.since]);
  useEffect(() => { if (state.step === "done") mark(); }, [state.step, mark]);

  const show = guideShows(state.step);
  if (!show) return null;
  return <Coach key={state.step} anchor={show.anchor} text={show.text} fleetRect={fleetRect} rocketRect={rocketRect} root={root} />;
}

const toBox = (r: DOMRect | null | undefined): Box | null => (r && r.width > 0 && r.height > 0 ? { x: r.x, y: r.y, w: r.width, h: r.height } : null);
const pad = (b: Box, p: number): Box => ({ x: b.x - p, y: b.y - p, w: b.w + p * 2, h: b.h + p * 2 });

interface Layout { view: Box; target: Box; avoid: Box[]; soft: Box[]; prefer: Side[]; round: boolean }

const union = (bs: Box[]): Box | null => {
  if (!bs.length) return null;
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y };
};
const some = (bs: (Box | null)[]) => bs.filter((b): b is Box => !!b);

const keypadEl = (scope: ParentNode) => scope.querySelector<HTMLElement>('[data-guide="keypad"]');

/**
 * Finds the anchor and what the caption must keep clear of, in CSS px. Null: an anchor is missing.
 * `avoid` are controls (never covered); `soft` (the question, the fleet) are covered only if nothing else fits.
 */
function measure(anchor: GuideAnchor, scope: ParentNode, fleetRect?: () => DOMRect | null, rocketRect?: () => DOMRect | null): Layout | null {
  const view = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  const box = (name: string) => toBox(scope.querySelector<HTMLElement>(`[data-guide="${name}"]`)?.getBoundingClientRect());
  const question = box("question"), keypad = box("keypad"), fire = box("fire"), help = box("help"), powerups = box("powerups"), orbs = box("orbs");
  const controls = some([help, powerups, orbs]);
  const fleet = toBox(fleetRect?.()) ?? box("fleet"), rocket = toBox(rocketRect?.());
  if (anchor === "fleet") {
    // no fleet anchor: the free part of the screen above (or beside) the whole console
    const target = fleet ?? freeArea(view, question, union(some([keypad, help, powerups])));
    if (!target) return null;
    return { view, target: pad(target, 12), avoid: some([keypad, ...controls]), soft: some([question, rocket]), prefer: ["below", "above", "right", "left"], round: true };
  }
  // "Type how many." rings the digit keys alone ([data-key] inside the keypad), not Fire and the Power-Ups beside them
  const keys = keypadEl(scope) ? union(some([...keypadEl(scope)!.querySelectorAll<HTMLElement>("[data-key]")].map((el) => toBox(el.getBoundingClientRect())))) : null;
  const target = anchor === "keypad" ? keys ?? keypad : fire;
  if (!target) return null;
  return { view, target: pad(target, 8), avoid: some([anchor === "fire" ? keypad : fire, ...controls]), soft: some([question, fleet, rocket]), prefer: ["above", "left", "below", "right"], round: false };
}

/** One step on screen: the scrim with its cut-out, the ring, and the caption beside it. */
function Coach({ anchor, text, fleetRect, rocketRect, root }: { anchor: GuideAnchor; text: string; fleetRect?: () => DOMRect | null; rocketRect?: () => DOMRect | null; root?: HTMLElement | null }) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [cap, setCap] = useState<{ w: number; h: number } | null>(null);
  const capRef = useRef<HTMLDivElement>(null);

  const remeasure = useCallback(() => {
    const next = measure(anchor, root ?? document, fleetRect, rocketRect);
    setLayout((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [anchor, root, fleetRect, rocketRect]);

  useEffect(() => {
    const scope = root ?? document.body;
    let raf = 0;
    // a timer as well as a frame: a page that is not painting (a background tab) still gets measured
    const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(remeasure); setTimeout(remeasure, 50); };
    const first = setTimeout(remeasure, 0);
    // anchors resize, reflow or appear: watch them all (the console mounts its parts as the wave starts)
    const ro = new ResizeObserver(soon);
    const watch = () => { ro.disconnect(); scope.querySelectorAll("[data-guide]").forEach((el) => ro.observe(el)); };
    watch();
    const mo = new MutationObserver(() => { watch(); soon(); });
    mo.observe(scope, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-guide", "class", "style"] });
    addEventListener("resize", soon);
    addEventListener("orientationchange", soon);
    // a console that slides in moves without resizing: follow it for its first moments
    const until = now() + 900;
    const follow = () => { remeasure(); if (now() < until) raf = requestAnimationFrame(follow); };
    raf = requestAnimationFrame(follow);
    return () => { clearTimeout(first); cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); removeEventListener("resize", soon); removeEventListener("orientationchange", soon); };
  }, [remeasure, root]);

  useLayoutEffect(() => {
    const el = capRef.current;
    if (!el) return;
    const size = { w: el.offsetWidth, h: el.offsetHeight };
    setCap((prev) => (prev && prev.w === size.w && prev.h === size.h ? prev : size));
  }, [text, layout]);

  if (!layout) return null;
  const { view, target, avoid, soft, prefer, round } = layout;
  // a soft corner, never a stadium: a circle would clip the ships in the fleet's corners
  const r = round ? Math.min(32, target.w / 2, target.h / 2) : 22;
  const place = cap ? placeCaption(target, cap, pad(view, -12), avoid, prefer, 14, soft) : null;
  const orbit = pad(target, 7);

  return (
    <div className="pointer-events-none fixed inset-0 z-[15]" data-guide-step={anchor}>
      <svg className="absolute inset-0 h-full w-full" width={view.w} height={view.h} aria-hidden>
        <defs>
          <mask id="mw-guide-cut">
            <rect width="100%" height="100%" fill="white" />
            <rect x={target.x} y={target.y} width={target.w} height={target.h} rx={r} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" className="fill-void" fillOpacity={0.5} mask="url(#mw-guide-cut)" />
        <rect x={target.x} y={target.y} width={target.w} height={target.h} rx={r} pathLength={1}
          className="fill-none stroke-gold motion-safe:animate-[mw-guide-ring_var(--mw-guide)_both]" strokeWidth={1}
          style={{ ["--mw-guide" as string]: "var(--transition-duration-moment) var(--ease-out)" }} />
        <rect x={orbit.x} y={orbit.y} width={orbit.w} height={orbit.h} rx={r + 7}
          className="fill-none stroke-line-2" strokeWidth={1} strokeDasharray="3 6" />
      </svg>
      <div ref={capRef} role="status" aria-live="polite"
        className="absolute rounded-panel border border-line-2 bg-panel px-4 py-2.5 type-child text-[20px] leading-snug text-approach motion-safe:animate-[mw-guide-in_var(--mw-guide)_both]"
        style={{ left: place?.box.x ?? 0, top: place?.box.y ?? 0, visibility: place ? "visible" : "hidden", maxWidth: Math.min(320, view.w - 24), ["--mw-guide" as string]: "var(--transition-duration-route) var(--ease-out)" }}>
        {text}
      </div>
      <style>{"@keyframes mw-guide-ring{from{stroke-dasharray:1;stroke-dashoffset:1}to{stroke-dasharray:1;stroke-dashoffset:0}}@keyframes mw-guide-in{from{opacity:0}to{opacity:1}}"}</style>
    </div>
  );
}
