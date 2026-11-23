"use client";
import { Button } from "@ui-sdk/react/button";
import { Toolbar, ToolbarButton } from "@ui-sdk/react/toolbar";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanetId } from "@/rig/pools";
import type { Arena, ArenaUi } from "@/worlds/space/arena";
import { PLANET_NAMES } from "@/worlds/space/lines";
import { ghost, glass, lime } from "./ui";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "Fire"];
const fmt = (n: number) => n.toLocaleString("en-US");
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * The battle HUD, shared by every planet and Cadet Bay. The multiplication is the hero: a big,
 * centred `a × b` plate naming both axes. The cockpit keypad docks right on desktop and along the
 * bottom on phones; it reports its footprint so the stage frames the fleet in the free space.
 */
export function BattleHud({ arena, ui, onFly, dev = false, drone = false }: { arena: Arena | null; ui: ArenaUi | null; onFly?: (to: PlanetId) => void; dev?: boolean; drone?: boolean }) {
  const [entry, setEntry] = useState("");
  const plateRef = useRef<HTMLDivElement>(null), dockRef = useRef<HTMLDivElement>(null);
  const w = ui?.wave, sectorActive = ui?.sectors?.find((s) => s.active) ?? null;

  // when every sector is locked, the plasma lock (their sum) loads into the readout
  const [prevTotal, setPrevTotal] = useState<number | null>(null);
  if ((ui?.lockTotal ?? null) !== prevTotal) { setPrevTotal(ui?.lockTotal ?? null); if (ui?.lockTotal != null) setEntry(String(ui.lockTotal)); }

  const fire = useCallback(() => {
    if (!arena || !ui || entry === "") return;
    if (sectorActive) { arena.lockSector(Number(entry)); setEntry(""); return; }
    if (!ui.canFire) return;
    void arena.fire(Number(entry));
    setEntry("");
  }, [arena, ui, entry, sectorActive]);
  const press = useCallback((k: string) => {
    arena?.poke();
    if (k === "Fire") return fire();
    if (k === "⌫") return setEntry((v) => v.slice(0, -1));
    setEntry((v) => (v === "0" ? k : (v + k).slice(0, 9)));
  }, [fire, arena]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea")) return;
      if (ui && !ui.started && e.key === "Enter") { e.preventDefault(); arena?.start(); return; }
      if (!ui?.wave) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("⌫");
      else if (e.key === "Enter") { e.preventDefault(); press("Fire"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, ui, arena]);

  // tell the stage where the HUD is, so the fleet sits in the clear part of the screen
  useEffect(() => {
    if (!arena) return;
    const measure = () => {
      const phone = window.innerWidth < 768, plate = plateRef.current?.getBoundingClientRect(), dock = dockRef.current?.getBoundingClientRect();
      // phones: Nova's caption floats just above the keypad, over the rocket, never over the fleet
      arena.setSafe({ top: (plate?.bottom ?? 130) + 6, right: !phone && dock ? window.innerWidth - dock.left + 8 : 0, bottom: phone && dock ? window.innerHeight - dock.top + 4 : 0, left: 0 });
      arena.captionAt(phone && dock ? window.innerHeight - dock.top + 8 : 22);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (plateRef.current) ro.observe(plateRef.current);
    if (dockRef.current) ro.observe(dockRef.current);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [arena, w, ui?.radar, ui?.sectors, ui?.belt.length]);

  if (!ui) return null;
  const [ra, rb] = w?.flipped ? [w.b, w.a] : [w?.a ?? 0, w?.b ?? 0];
  const noun = drone ? plural(rb, "drone", "drones") : plural(rb, "fighter", "fighters");
  const o = ui.outcome;

  return (
    <>
      {/* the multiplication: big, centred, both axes named */}
      {w && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center gap-2">
          <div ref={plateRef} className={`${glass} px-5 py-2 text-center md:px-7 md:py-3`} aria-live="polite">
            <p className="font-mono text-[11px] tracking-[0.3em] text-lime-200/80">{ui.planetName.toUpperCase()} · {ui.mode === "practice" ? "PRACTICE" : "WAVE"} {Math.min(w.index + 1, w.of)}/{w.of}</p>
            <p className="mt-0.5 font-mono text-5xl font-semibold tabular-nums md:mt-1 md:text-7xl">
              {fmt(ra)}<span className="mx-3 text-lime-300">×</span>{fmt(rb)}
            </p>
            <p className="mt-1 text-sm text-white/75">
              <b className="text-white">{fmt(ra)}</b> {plural(ra, "squad", "squads")} · <b className="text-white">{fmt(rb)}</b> {noun} each{w.flipped ? " · flipped" : ""}
            </p>
          </div>
          {o && (
            <div role="status" className={`rounded-full px-5 py-1.5 font-mono text-lg font-semibold tabular-nums shadow-lg ${o.kind === "exact" ? "bg-lime-300 text-[#0d0e1a]" : o.kind === "under" ? "bg-[#ff8f70] text-[#1a0d0d]" : "bg-[#ffb05c] text-[#1a120d]"}`}>
              {o.kind === "exact" ? `✓ Dead on · +${o.orbs} orbs` : o.kind === "under" ? `${fmt(o.value)} still flying` : `+${fmt(o.value)} flew past`}
            </div>
          )}
          {ui.lesson && <div className="rounded-full bg-sky-300/90 px-4 py-1 font-mono text-xs font-semibold tracking-wider text-[#06202b]">SHOW ME HOW · {ui.lesson.card.toUpperCase()}</div>}
        </div>
      )}

      <div className="pointer-events-none absolute right-3 top-3 z-10 hidden rounded-full bg-black/40 px-3 py-1 font-mono text-xs text-amber-200 md:block">✦ {ui.orbs} orbs</div>
      {dev && <div className="pointer-events-none absolute left-3 top-3 z-10 font-mono text-[11px] text-white/60">shots (s): {ui.shots.map((s) => (s / 1000).toFixed(1)).join(" · ") || "—"}</div>}

      {/* the cockpit: keypad docked right (bottom on phones) */}
      {w && (
        <div ref={dockRef} className={`${glass} absolute bottom-2 left-1/2 z-10 w-[min(96vw,340px)] -translate-x-1/2 p-2.5 md:bottom-auto md:left-auto md:right-5 md:top-1/2 md:w-[300px] md:-translate-y-1/2 md:translate-x-0 md:p-3`}>
          {ui.belt.length > 0 && (
            <Toolbar aria-label="Tactical Belt" className="-mx-1 mb-1.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              {ui.belt.map((t) => (
                <ToolbarButton key={t.id} aria-label={`Power-Up ${t.card}`} aria-pressed={t.active} onClick={() => arena?.powerUp(t.id)} disabled={!ui.canFire}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-lime-300 data-disabled:opacity-40 ${t.active ? "bg-amber-300 text-[#1a1406]" : t.fits ? "border border-amber-300/60 bg-amber-300/10 text-amber-100 hover:bg-amber-300/25" : "border border-white/10 text-white/45"}`}>
                  ⚡ {t.card}
                </ToolbarButton>
              ))}
            </Toolbar>
          )}
          {ui.sectors && (
            <div className="mb-2" role="group" aria-label="Battle Sectors">
              <div className="grid grid-cols-2 gap-1.5">
                {ui.sectors.map((s) => (
                  <Button key={s.i} aria-label={`Sector ${s.label}`} onClick={() => { arena?.selectSector(s.i); setEntry(""); }} disabled={s.value !== null}
                    className={`rounded-lg px-2 py-1.5 font-mono text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-lime-300 ${s.value !== null ? "bg-amber-300/90 text-[#1a1406]" : s.active ? "bg-lime-300 text-[#0d0e1a]" : "border border-white/15 text-white/80"}`}>
                    {s.label}{s.value !== null ? ` = ${fmt(s.value)}` : ""}
                  </Button>
                ))}
              </div>
              {ui.lockTotal !== null && <p className="mt-1.5 text-center font-mono text-xs text-amber-200">Plasma lock: {ui.sectors.map((s) => fmt(s.value ?? 0)).join(" + ")} = {fmt(ui.lockTotal)}</p>}
            </div>
          )}
          {ui.lesson?.prompt && <p className="mb-1.5 rounded-lg bg-sky-300/15 px-3 py-1.5 text-center text-sm text-sky-100 md:mb-2">{ui.lesson.prompt}</p>}
          <div className="mb-1.5 flex items-baseline justify-between rounded-xl bg-black/40 px-4 py-1 md:mb-2 md:py-2">
            <span className="text-[11px] uppercase tracking-wider text-white/50">{sectorActive ? `Sector ${sectorActive.label}` : "Plasma balls"}</span>
            <output aria-live="polite" aria-label="Plasma balls loaded" className="font-mono text-3xl tabular-nums text-lime-200 md:text-4xl">{entry || "0"}</output>
          </div>
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Keypad">
            {KEYS.map((k) => (
              <Button key={k} aria-label={k === "⌫" ? "Delete" : k === "Fire" ? (sectorActive ? "Lock sector" : "Fire") : k} disabled={k === "Fire" && (entry === "" || (!sectorActive && !ui.canFire))}
                className={k === "Fire" ? `${lime} py-1.5 text-lg font-semibold md:py-3` : `${ghost} bg-white/[.04] py-1.5 text-lg md:py-3`} onClick={() => press(k)}>
                {k === "Fire" && sectorActive ? "Lock" : k}
              </Button>
            ))}
          </div>
          {ui.radar && (
            <div className="mt-2" role="group" aria-label="Targeting Radar">
              <p className="mb-1 text-center font-mono text-[10px] tracking-[0.25em] text-sky-200/80">TARGETING RADAR</p>
              <div className="grid grid-cols-4 gap-1.5">
                {ui.radar.map((v) => (
                  <Button key={v} aria-label={`Radar ${v}`} disabled={!ui.canFire} onClick={() => { setEntry(""); void arena?.radar(v); }}
                    className="rounded-lg border border-sky-300/50 bg-sky-300/10 py-2 font-mono text-sm tabular-nums text-sky-100 outline-none hover:bg-sky-300/25 focus-visible:ring-2 focus-visible:ring-lime-300 data-disabled:opacity-40">{fmt(v)}</Button>
                ))}
              </div>
            </div>
          )}
          <Button onClick={() => arena?.showMeHow()} disabled={!ui.canFire || !!ui.lesson}
            className={`mt-1.5 w-full rounded-xl py-1.5 text-sm md:mt-2 md:py-2 font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-lime-300 data-disabled:opacity-40 ${ui.invite ? "bg-sky-300 text-[#06202b]" : "border border-sky-300/30 text-sky-100/85 hover:border-sky-300/70"}`}>
            Show Me How
          </Button>
          {!ui.canFire && !ui.lesson && <p className="mt-1 hidden text-center text-xs text-white/45 md:block">Volley in flight…</p>}
        </div>
      )}

      {!ui.started && !ui.done && (
        <div className={`${glass} absolute inset-0 z-20 m-auto flex h-fit w-fit flex-col items-center gap-3 p-6 text-center`}>
          <p className="font-mono text-xs tracking-[0.3em] text-lime-300">{ui.planetName.toUpperCase()}{ui.mode === "practice" ? " · PRACTICE" : ""}</p>
          <p className="text-white/80">Squadrons on the scanner, cadet.</p>
          <Button className={`${lime} px-7 py-3 text-base`} onClick={() => arena?.start()}>🚀 Launch (sound on)</Button>
        </div>
      )}

      {ui.offer && (
        <div className={`${glass} absolute inset-0 z-20 m-auto flex h-fit w-[min(92%,420px)] flex-col items-center gap-3 p-6 text-center`}>
          <p className="font-mono text-xs tracking-[0.3em] text-amber-300">CAPTAIN · ACE TELEMETRY</p>
          <p className="text-xl">Hyper-Jump straight to <b>{ui.offer.name}</b>?</p>
          <div className="flex gap-3">
            <Button className={`${lime} px-5 py-3 text-base`} onClick={() => { const to = arena?.acceptJump(); if (to) onFly?.(to); }}>⚡ Hyper-Jump</Button>
            <Button className={`${ghost} px-5 py-3 text-base`} onClick={() => arena?.declineJump()}>Keep flying here</Button>
          </div>
        </div>
      )}

      {ui.done && (
        <div className={`${glass} absolute inset-0 z-20 m-auto flex h-fit w-[min(92%,440px)] flex-col items-center gap-3 p-6 text-center`}>
          <p className="font-mono text-xs tracking-[0.3em] text-lime-300">{ui.planetName.toUpperCase()}</p>
          <p className="text-3xl font-semibold tracking-wide">{ui.done.title}</p>
          <p className="text-white/75">{ui.done.sub} · ✦ {ui.orbs} orbs</p>
          {ui.done.next && <Button className={`${lime} px-6 py-3 text-base`} onClick={() => onFly?.(ui.done!.next!)}>🚀 Fly to {PLANET_NAMES[ui.done.next]}</Button>}
        </div>
      )}
    </>
  );
}
