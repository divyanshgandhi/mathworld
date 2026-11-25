"use client";
import { Button } from "@ui-sdk/react/button";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { hyperJumpStatus, mapStops, type Stop } from "@/director/hub";
import type { SolarMapScene } from "@/worlds/space/solarMap";
import { PLANET_NAMES } from "@/worlds/space/lines";
import { glass, lime } from "./battle/ui";
import { Icon, RocketGlyph } from "./kit/Icon";
import { Anchor, useScene } from "./hub/Scene";
import { useCadet } from "./hub/useCadet";

export const STOP_NAMES: Record<Stop["id"], string> = { mercury: "Mercury", venus: "Venus", ...PLANET_NAMES };
const STATUS: Record<Stop["status"], { label: string; tone: string }> = {
  warmup: { label: "Warm-up", tone: "border-sky text-sky" },
  cleared: { label: "Cleared", tone: "border-gold text-gold" },
  ace: { label: "Ace cleared", tone: "border-gold bg-gold text-void" },
  frontier: { label: "Frontier", tone: "border-approach text-approach" },
  open: { label: "Open", tone: "border-line-2 text-ink-2" },
  locked: { label: "Locked", tone: "border-line-1 text-ink-3" },
};

/**
 * The Solar System map (/map): scroll along the planets (wheel, drag, swipe, arrow keys), centred
 * on the frontier. Launch opens /play/[planet]; Mercury and Venus are warm-ups; locked planets wait.
 */
export function SolarMap() {
  const router = useRouter();
  const { state } = useCadet();
  const stops = useMemo(() => (state ? mapStops(state) : null), [state]);
  const { box, stage, scene } = useScene<SolarMapScene>(async (s) => {
    const [{ mountSolarMap }, { mapStops: ms }, { initialState }] = await Promise.all([import("@/worlds/space/solarMap"), import("@/director/hub"), import("@/director/fold")]);
    return mountSolarMap(s, ms(initialState()));
  });
  const [sel, setSel] = useState<number | null>(null);
  const settleT = useRef(0);

  // centre on the frontier once the cadet's state is in
  const frontier = stops ? Math.max(0, stops.findIndex((x) => x.status === "frontier")) : 0;
  const i = sel ?? frontier;
  useEffect(() => { if (scene && stops) scene.setStops(stops); }, [scene, stops]);
  useEffect(() => { scene?.focus(i); }, [scene, i]);
  useEffect(() => { void import("@/engine/audio").then(({ audio }) => audio.mood("space")); }, []);

  // wheel, drag and arrow keys glide along the line; letting go settles on the nearest planet
  useEffect(() => {
    if (!scene || !stops) return;
    const settle = () => { window.clearTimeout(settleT.current); settleT.current = window.setTimeout(() => setSel(scene.settle()), 160); };
    const onWheel = (e: WheelEvent) => { scene.pan((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.025); settle(); };
    let down: number | null = null;
    const onDown = (e: PointerEvent) => { if ((e.target as HTMLElement).closest("button")) return; down = e.clientX; };
    const onMove = (e: PointerEvent) => { if (down === null) return; scene.pan(-(e.clientX - down) * 0.045); down = e.clientX; };
    const onUp = () => { if (down !== null) { down = null; settle(); } };
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "ArrowRight") setSel((s) => Math.min(stops.length - 1, (s ?? frontier) + 1));
      if (e.key === "ArrowLeft") setSel((s) => Math.max(0, (s ?? frontier) - 1));
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("wheel", onWheel); window.removeEventListener("pointerdown", onDown); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("keydown", onKey); };
  }, [scene, stops, frontier]);

  const stop = stops?.[i], jump = state ? hyperJumpStatus(state) : null;
  const launch = (s: Stop) => router.push(`/play/${s.id}`);
  const cta = !stop ? "" : stop.status === "warmup" ? "Warm up" : stop.status === "cleared" || stop.status === "ace" ? "Replay" : stop.status === "locked" ? "Locked" : "Launch";

  return (
    <div className="fixed inset-0 touch-none select-none overflow-hidden bg-void text-approach">
      <div ref={box} className="absolute inset-0" />
      {scene && stops && state && (
        <>
          <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
            <Button aria-label="Resting Bay" title="Resting Bay" onClick={() => router.push("/bay")} className="mw-btn mw-icon bg-void"><Icon name="home" size={20} /></Button>
            <span className="pointer-events-none flex h-11 items-center rounded-pill bg-void px-3 type-label text-[13px] tracking-[0.1em] text-ink-2 sm:px-4 sm:text-[15px] sm:tracking-[0.18em]">Star map</span>
          </div>
          <div className="pointer-events-none absolute right-16 top-3.5 z-10 flex flex-col items-end gap-1.5">
            <span className="flex h-11 items-center gap-2 rounded-pill bg-void px-3 type-name type-number text-[17px]"><Icon name="orb" size={20} className="text-gold" />{state.orbs} <span className="hidden text-[15px] text-ink-2 sm:inline">orbs</span></span>
            {jump && <span className={`flex items-center gap-1.5 rounded-pill border bg-void px-3 py-1 text-xs ${jump.available ? "border-gold text-gold" : "border-line-1 text-ink-2"}`}><Icon name="jump" size={16} />{jump.available || !jump.to ? jump.label : `${jump.streak} of ${jump.need} perfect shots in a row lets you Hyper-Jump`}</span>}
          </div>

          {stops.map((s, k) => (
            <Anchor key={s.id} stage={stage} scene={scene} id={`stop:${s.id}`}>
              <Button aria-label={`${STOP_NAMES[s.id]}: ${STATUS[s.status].label}`} aria-pressed={k === i} onClick={() => setSel(k)}
                className={`flex flex-col items-center gap-1 rounded-chip px-2 py-1 transition ${k === i ? "scale-110" : "opacity-80 hover:opacity-100"}`}>
                <span className={`flex items-center gap-1 whitespace-nowrap type-name text-[16px] ${s.status === "locked" ? "text-ink-3" : "text-approach"}`}>{s.status === "locked" && <Icon name="lock" size={16} />}{STOP_NAMES[s.id]}</span>
                <span className={`whitespace-nowrap rounded-pill border bg-void px-2 py-0.5 text-xs ${STATUS[s.status].tone}`}>{STATUS[s.status].label}</span>
              </Button>
            </Anchor>
          ))}

          {stop && (
            <div className={`${glass} absolute bottom-3 left-1/2 z-20 flex w-[min(94vw,520px)] -translate-x-1/2 items-center gap-4 p-4`} aria-live="polite">
              <div className="min-w-0 flex-1">
                <p className="m-0 type-display text-[24px] leading-tight md:text-[30px]">{STOP_NAMES[stop.id]}</p>
                <p className="mt-1 type-body-sm text-ink-2">{STATUS[stop.status].label} · {stop.status === "locked" ? `Clear ${STOP_NAMES[stops[i - 1]?.id ?? "earth"]} to open it` : stop.teaches}</p>
              </div>
              <Button disabled={stop.status === "locked"} onClick={() => launch(stop)} className={`${lime} mw-md mw-has-glyph shrink-0`}>{stop.status === "locked" && <Icon name="lock" size={18} />}{cta}<RocketGlyph size={34} /></Button>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-56 z-10 md:bottom-44 flex justify-center">
            <div className="pointer-events-auto flex gap-2">
              <Button aria-label="Previous planet" disabled={i === 0} onClick={() => setSel(Math.max(0, i - 1))} className="mw-btn mw-icon bg-void"><Icon name="back" size={20} /></Button>
              <Button aria-label="Next planet" disabled={i === stops.length - 1} onClick={() => setSel(Math.min(stops.length - 1, i + 1))} className="mw-btn mw-icon bg-void"><Icon name="forward" size={20} /></Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
