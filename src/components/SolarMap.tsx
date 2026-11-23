"use client";
import { Button } from "@ui-sdk/react/button";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { hyperJumpStatus, mapStops, type Stop } from "@/director/hub";
import type { SolarMapScene } from "@/worlds/space/solarMap";
import { PLANET_NAMES } from "@/worlds/space/lines";
import { ghost, glass, lime } from "./battle/ui";
import { Anchor, useScene } from "./hub/Scene";
import { useCadet } from "./hub/useCadet";

export const STOP_NAMES: Record<Stop["id"], string> = { mercury: "Mercury", venus: "Venus", ...PLANET_NAMES };
const STATUS: Record<Stop["status"], { label: string; tone: string }> = {
  warmup: { label: "Warm-up", tone: "bg-sky-300/20 text-sky-100 border-sky-300/50" },
  cleared: { label: "Cleared", tone: "bg-amber-300/20 text-amber-100 border-amber-300/60" },
  ace: { label: "Ace cleared", tone: "bg-amber-300/20 text-amber-100 border-amber-300/60" },
  frontier: { label: "Frontier", tone: "bg-lime-300 text-[#0d0e1a] border-lime-300" },
  open: { label: "Open", tone: "bg-white/10 text-white/85 border-white/30" },
  locked: { label: "Locked", tone: "bg-black/40 text-white/45 border-white/15" },
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
    <div className="fixed inset-0 touch-none select-none overflow-hidden bg-[#02030a] text-white">
      <div ref={box} className="absolute inset-0" />
      {scene && stops && state && (
        <>
          <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
            <Button aria-label="Resting Bay" onClick={() => router.push("/bay")} className={`${ghost} grid size-10 place-items-center bg-black/45 p-0 text-lg`}>⌂</Button>
            <span className={`${glass} pointer-events-none px-4 py-2 font-mono text-xs tracking-[0.25em] text-lime-200`}>SOLAR SYSTEM</span>
          </div>
          <div className="pointer-events-none absolute right-16 top-3.5 z-10 flex flex-col items-end gap-1.5">
            <span className="rounded-full bg-black/45 px-3 py-1.5 font-mono text-sm text-amber-200">✦ {state.orbs} orbs</span>
            {jump && <span className={`rounded-full border px-3 py-1 font-mono text-[11px] ${jump.available ? "border-amber-300 bg-amber-300/20 text-amber-100" : "border-white/15 bg-black/45 text-white/70"}`}>⚡ {jump.label}</span>}
          </div>

          {stops.map((s, k) => (
            <Anchor key={s.id} stage={stage} scene={scene} id={`stop:${s.id}`}>
              <Button aria-label={`${STOP_NAMES[s.id]}: ${STATUS[s.status].label}`} aria-pressed={k === i} onClick={() => setSel(k)}
                className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1 outline-none transition focus-visible:ring-2 focus-visible:ring-lime-300 ${k === i ? "scale-110" : "opacity-80 hover:opacity-100"}`}>
                <span className={`whitespace-nowrap text-sm font-semibold drop-shadow ${s.status === "locked" ? "text-white/45" : "text-white"}`}>{s.status === "locked" ? "🔒 " : ""}{STOP_NAMES[s.id]}</span>
                <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10px] ${STATUS[s.status].tone}`}>{STATUS[s.status].label}</span>
              </Button>
            </Anchor>
          ))}

          {stop && (
            <div className={`${glass} absolute bottom-3 left-1/2 z-20 flex w-[min(94vw,520px)] -translate-x-1/2 items-center gap-4 p-4`} aria-live="polite">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] tracking-[0.25em] text-white/55">{stop.tier === null ? "INNER PLANET · WARM-UP" : `PLANET ${stop.tier} · ${STATUS[stop.status].label.toUpperCase()}`}</p>
                <p className="truncate text-2xl font-semibold">{STOP_NAMES[stop.id]}</p>
                <p className="text-sm text-white/70">{stop.status === "locked" ? `Clear ${STOP_NAMES[stops[i - 1]?.id ?? "earth"]} to open it` : stop.teaches}</p>
              </div>
              <Button disabled={stop.status === "locked"} onClick={() => launch(stop)} className={`${lime} shrink-0 px-6 py-3 text-base`}>{stop.status === "locked" ? "🔒" : "🚀"} {cta}</Button>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 flex justify-center">
            <div className="pointer-events-auto flex gap-2">
              <Button aria-label="Previous planet" disabled={i === 0} onClick={() => setSel(Math.max(0, i - 1))} className={`${ghost} bg-black/45 px-3 py-1.5`}>◀</Button>
              <Button aria-label="Next planet" disabled={i === stops.length - 1} onClick={() => setSel(Math.min(stops.length - 1, i + 1))} className={`${ghost} bg-black/45 px-3 py-1.5`}>▶</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
