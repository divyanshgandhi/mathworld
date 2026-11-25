"use client";
import { Button } from "@ui-sdk/react/button";
import { Toolbar, ToolbarButton } from "@ui-sdk/react/toolbar";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { PlanetId } from "@/rig/pools";
import type { Arena, ArenaUi } from "@/worlds/space/arena";
import { PLANET_NAMES } from "@/worlds/space/lines";
import { Icon, RocketGlyph } from "@/components/kit/Icon";
import { ghost, glass, lime, padKey } from "./ui";
import { XRay } from "./XRay";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "Fire"];
const fmt = (n: number) => n.toLocaleString("en-US");
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * The battle HUD, shared by every planet and Cadet Bay. The multiplication is the hero: a big,
 * centred `a × b` plate naming both axes. The cockpit keypad docks right on desktop and along the
 * bottom on phones; it reports its footprint so the stage frames the fleet in the free space.
 */
export function BattleHud({ arena, ui, onFly, dev = false, drone = false, doneActions, launch = true, menu }: {
  arena: Arena | null; ui: ArenaUi | null; onFly?: (to: PlanetId) => void; dev?: boolean; drone?: boolean;
  /** Buttons for the end-of-mission card (default: fly to the next planet). */
  doneActions?: (done: NonNullable<ArenaUi["done"]>) => ReactNode;
  /** Show the "Launch (sound on)" card before the first wave. */
  launch?: boolean;
  /** The pause menu button (top-left). */
  menu?: ReactNode;
}) {
  const [entry, setEntryState] = useState("");
  // the latest entry, so a digit and Enter in the same frame (fast fingers, scripts) are never lost
  const live = useRef("");
  const setEntry = useCallback((v: string | ((prev: string) => string)) => {
    live.current = typeof v === "function" ? v(live.current) : v;
    setEntryState(live.current);
  }, []);
  // a Hyper-Jump loads the next planet's route: say so while it loads instead of showing a dead screen
  const [jumping, setJumping] = useState<string | null>(null);
  const plateRef = useRef<HTMLDivElement>(null), dockRef = useRef<HTMLDivElement>(null);
  const w = ui?.wave, sectorActive = ui?.sectors?.find((s) => s.active) ?? null;

  // when every sector is locked, the plasma lock (their sum) loads into the readout
  const [prevTotal, setPrevTotal] = useState<number | null>(null);
  if ((ui?.lockTotal ?? null) !== prevTotal) { setPrevTotal(ui?.lockTotal ?? null); if (ui?.lockTotal != null) setEntryState(String(ui.lockTotal)); }
  useEffect(() => { live.current = entry; }, [entry]);

  const fire = useCallback(() => {
    const v = live.current;
    if (!arena || !ui || v === "") return;
    if (sectorActive) { arena.lockSector(Number(v)); setEntry(""); return; }
    if (!ui.canFire) return;
    void arena.fire(Number(v));
    setEntry("");
  }, [arena, ui, sectorActive, setEntry]);
  const press = useCallback((k: string) => {
    arena?.poke();
    if (k === "Fire") return fire();
    if (k === "⌫") return setEntry((v) => v.slice(0, -1));
    setEntry((v) => (v === "0" ? k : (v + k).slice(0, 9)));
  }, [fire, arena, setEntry]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // the X-Ray is a non-modal side sheet: the cadet keeps typing while it is open
      if ((e.target as HTMLElement)?.closest?.("input, textarea, dialog:not([data-xray])") || document.querySelector("dialog[open]:not([data-xray])")) return;
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
      // the top keeps the plate and its chip row (outcome, Show Me How) clear of the fleet.
      // Phones: Nova's caption floats just above the keypad, in a band the stage keeps free, so it
      // covers neither the fleet nor the rocket. Desktop: it sits bottom-left, away from the rocket.
      const capBand = phone ? 84 : 0;
      arena.setSafe({ top: (plate?.bottom ?? 130) + 50, right: !phone && dock ? window.innerWidth - dock.left + 8 : 0, bottom: phone && dock ? window.innerHeight - dock.top + 4 + capBand : 0 }); // `left` belongs to the X-Ray
      if (phone && dock) arena.captionAt(window.innerHeight - dock.top + 8, "centre");
      else arena.captionAt(22, "left");
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
  const noun = drone ? plural(rb, "drone", "drones") : plural(rb, "ship", "ships");
  const o = ui.outcome;
  // the big a × b stays on one line: long numbers step the display size down instead of wrapping
  const digits = fmt(ra).length + fmt(rb).length;
  const plateSize = digits > 9 ? "text-3xl md:text-5xl" : digits > 6 ? "text-4xl md:text-6xl" : "text-5xl md:text-7xl";

  return (
    <>
      <XRay arena={arena} ui={ui} />
      {/* the multiplication: big, centred, both axes named */}
      {w && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center gap-2 px-14 md:px-0">
          <div ref={plateRef} className={`${glass} max-w-full px-4 py-2 text-center md:px-7 md:py-3`} aria-live="polite">
            <p className="type-label-sm tracking-[0.08em] text-balance text-ink-2 md:whitespace-nowrap md:tracking-[0.16em]">{ui.planetName} · {ui.mode === "academy" ? "Trick film" : `${ui.mode === "practice" ? "Practice" : "Wave"} ${Math.min(w.index + 1, w.of)} of ${w.of}`}</p>
            <p className={`mt-1 whitespace-nowrap type-display type-number md:mt-2 ${plateSize}`}>
              {fmt(ra)}<span className="mx-3 text-ink-3">×</span>{fmt(rb)}
            </p>
            <p className="mt-1.5 type-body-sm text-ink-2">
              <b className="font-semibold text-approach">{fmt(ra)}</b> {plural(ra, "squad", "squads")} · <b className="font-semibold text-approach">{fmt(rb)}</b> {noun} each{w.flipped ? " · flipped" : ""}
            </p>
          </div>
          {/* the outcome chip sits in a row under the plate that the stage keeps clear of the fleet */}
          {/* Show Me How: the Card Name banner, with its WHY the first time */}
          {ui.lesson && !o && (
            <div role="status" className="flex max-w-[92vw] flex-col items-center rounded-chip border border-sky bg-void px-5 py-1.5 text-center text-sky">
              <span className="flex items-center gap-2 type-label"><Icon name="trick" size={18} />{ui.lesson.card}</span>
              {ui.lesson.why && <span className="type-body-sm text-ink-2">why? {ui.lesson.why}</span>}
            </div>
          )}
          {ui.unlock && (
            <div role="status" className="flex items-center gap-2 rounded-pill border border-gold bg-void px-4 py-1.5 type-label-sm text-gold">
              <Icon name="trick" size={18} />New Power-Up on your belt: {ui.unlock.cards.join(" + ")}
            </div>
          )}
          {o && (
            <div role="status" className={`flex items-center gap-2 rounded-pill border bg-void px-5 py-1.5 type-name type-number transition ${o.last ? "border-line-2 text-[15px] text-ink-2" : `text-lg ${o.kind === "exact" ? "border-gold text-gold" : "border-ember text-ember"}`}`}>
              {o.kind === "exact" && <Icon name="check" size={20} />}{o.last ? "Last shot: " : ""}{o.kind === "exact" ? `Dead on${o.orbs ? ` · +${o.orbs} orbs` : ""}` : o.kind === "under" ? `${fmt(o.value)} still flying` : `+${fmt(o.value)} flew past`}
            </div>
          )}
        </div>
      )}

      <div className="pointer-events-none absolute right-16 top-3 z-10 hidden h-11 items-center gap-2 rounded-pill bg-void px-3 type-name type-number text-[17px] md:flex"><Icon name="orb" size={20} className="text-gold" />{ui.orbs} <span className="text-[15px] text-ink-2">orbs</span></div>
      {menu && <div className="absolute left-3 top-3 z-20">{menu}</div>}
      {dev && (
        <div className="pointer-events-none absolute left-3 top-16 z-10 hidden type-body-sm type-number text-ink-3 md:block [:root:has([data-xray][data-open])_&]:left-[356px] [:root:has([data-xray][data-open])_&]:block">
          <p>shots (s): {ui.shots.map((s) => (s / 1000).toFixed(1)).join(" · ") || "none"}</p>
          <p>lessons (s): {ui.lessons.map((s) => (s / 1000).toFixed(1)).join(" · ") || "none"}</p>
        </div>
      )}

      {/* the cockpit: keypad docked right (bottom on phones). It never grows past the screen: the belt
          and the sectors are single scrolling rows on phones, and the desktop dock scrolls inside itself. */}
      {w && (
        <div ref={dockRef} className={`${glass} absolute bottom-2 left-1/2 z-10 w-[min(96vw,340px)] -translate-x-1/2 p-2 md:bottom-5 md:left-auto md:right-5 md:max-h-[calc(100dvh-40px)] md:w-[300px] md:translate-x-0 md:overflow-y-auto md:p-3`}>
          {ui.belt.length > 0 && (
            <Toolbar aria-label="Power-Ups" className="-mx-1 mb-1.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
              {ui.belt.map((t) => (
                <ToolbarButton key={t.id} aria-label={`Power-Up ${t.card}`} aria-pressed={t.active} onClick={() => arena?.powerUp(t.id)} disabled={!ui.canFire || !!ui.lesson}
                  className={`flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 type-name text-[15px] md:min-h-10 transition data-disabled:border-line-1 data-disabled:bg-transparent data-disabled:text-ink-3 ${t.active ? "border-gold bg-raised text-gold" : t.fits ? "border-line-3 text-approach hover:border-gold" : "border-line-1 text-ink-3 hover:border-line-2"}`}>
                  <Icon name="trick" size={16} />{t.card}
                </ToolbarButton>
              ))}
            </Toolbar>
          )}
          {ui.sectors && (
            <div className="mb-1.5 md:mb-2" role="group" aria-label="Battle Sectors">
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0">
                {ui.sectors.map((s) => (
                  <Button key={s.i} aria-label={`Sector ${s.label}`} onClick={() => { arena?.selectSector(s.i); setEntry(""); }} disabled={s.value !== null}
                    ref={s.active ? (el: HTMLButtonElement | null) => el?.scrollIntoView?.({ block: "nearest", inline: "nearest" }) : undefined}
                    className={`min-h-11 shrink-0 whitespace-nowrap rounded-chip border px-3 type-name type-number text-[15px] md:min-h-10 md:px-2 ${s.value !== null ? "border-gold text-gold" : s.active ? "border-approach bg-raised text-approach" : "border-line-2 text-ink-2"}`}>
                    {s.label}{s.value !== null ? ` = ${fmt(s.value)}` : ""}
                  </Button>
                ))}
              </div>
              <p className="mt-1 text-center type-body-sm type-number text-ink-2 md:hidden">{ui.sectors.filter((s) => s.value !== null).length} of {ui.sectors.length} sectors locked</p>
              {ui.lockTotal !== null && <p className="mt-1.5 text-center type-body-sm type-number text-gold">Plasma lock: {ui.sectors.map((s) => fmt(s.value ?? 0)).join(" + ")} = {fmt(ui.lockTotal)}</p>}
            </div>
          )}
          {ui.lesson && (
            <div className="mb-1.5 rounded-chip border border-sky px-3 py-1.5 text-center md:mb-2" aria-live="polite">
              <p className="type-label-sm text-sky">{ui.lesson.fallback ? "Safety net" : "Show Me How"} · {ui.lesson.card}</p>
              {ui.lesson.equation
                ? <p className="mt-0.5 type-number text-2xl font-medium text-approach md:text-3xl">{ui.lesson.equation}</p>
                : <p className="mt-0.5 type-body-sm text-ink-2">Watch, or fire any time</p>}
              {ui.lesson.prompt && <p className="mt-0.5 type-body-sm text-ink-2">Your turn: load it and fire!</p>}
            </div>
          )}
          {/* the radar sits above the readout: the dock is anchored at the bottom, so anything that appears
              mid-wave grows it upward and the keypad never moves under a finger */}
          {ui.radar && (
            <div className="mb-1.5 md:mb-2" role="group" aria-label="Radar">
              <p className="mb-1 text-center type-label-sm text-sky">Radar · pick one</p>
              <div className="grid grid-cols-4 gap-1.5">
                {ui.radar.map((v) => (
                  <Button key={v} aria-label={`Radar ${v}`} disabled={!ui.canFire} onClick={() => { setEntry(""); void arena?.radar(v); }}
                    className="min-h-11 rounded-chip border border-sky/60 type-name type-number text-[15px] text-sky transition hover:border-sky data-disabled:border-line-1 data-disabled:text-ink-3">{fmt(v)}</Button>
                ))}
              </div>
            </div>
          )}
          <div className="mb-1.5 flex items-stretch gap-1.5 md:mb-2">
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-chip border border-line-1 bg-void px-3 md:px-4 md:py-2">
              <span className="flex min-w-0 items-center gap-1.5 truncate type-label-sm tracking-[0.04em] text-ink-3 md:gap-2 md:tracking-[0.12em]"><Icon name="plasma" size={18} className="shrink-0" />{sectorActive ? <span className="truncate"><span className="hidden md:inline">Sector </span>{sectorActive.label}</span> : "Plasma balls"}</span>
              <output aria-live="polite" aria-label="Plasma balls loaded" className="type-number text-[30px] font-medium leading-tight text-approach md:text-[40px]">{entry || "0"}</output>
            </div>
            {/* phones: Show Me How rides beside the readout, so the dock is one row shorter (the Academy's film is one already) */}
            {ui.mode !== "academy" && <Button onClick={() => arena?.showMeHow()} disabled={!ui.canFire || !!ui.lesson} aria-label="Show Me How"
              className={`mw-btn min-h-11 shrink-0 border px-3 text-[15px] md:hidden data-disabled:border-line-1 data-disabled:text-ink-3 ${ui.invite ? "border-sky bg-raised text-sky" : "border-line-2 text-ink-2"}`}>
              <Icon name="help" size={20} />Show me
            </Button>}
          </div>
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Keypad">
            {KEYS.map((k) => (
              <Button key={k} aria-label={k === "⌫" ? "Delete" : k === "Fire" ? (sectorActive ? "Lock sector" : "Fire") : k} disabled={k === "Fire" && (entry === "" || (!sectorActive && !ui.canFire))}
                className={k === "Fire" ? `${lime} min-h-11 px-2 text-[15px] md:min-h-12` : `${padKey} min-h-11 md:min-h-12`} onClick={() => press(k)}>
                {k === "Fire" && sectorActive ? "Lock" : k === "⌫" ? <Icon name="delete" size={22} /> : k}
              </Button>
            ))}
          </div>
          {ui.mode !== "academy" && <Button onClick={() => arena?.showMeHow()} disabled={!ui.canFire || !!ui.lesson}
            className={`mw-btn mt-2 hidden min-h-11 w-full border text-[15px] md:flex data-disabled:border-line-1 data-disabled:text-ink-3 ${ui.invite ? "border-sky bg-raised text-sky" : "border-line-2 text-ink-2 hover:border-sky hover:text-sky"}`}>
            Show Me How
          </Button>}
          <p aria-hidden={ui.canFire || !!ui.lesson} className={`mt-1 hidden text-center type-body-sm text-ink-3 md:block ${ui.canFire || ui.lesson ? "invisible" : ""}`}>Stand by…</p>
        </div>
      )}

      {launch && !ui.started && !ui.done && (
        <div className={`${glass} absolute inset-0 z-20 m-auto flex h-fit w-[min(92%,440px)] flex-col items-center gap-3 p-6 text-center`}>
          <p className="type-display text-balance text-[clamp(28px,8vw,36px)]">{ui.planetName}{ui.mode === "practice" ? " · practice" : ""}</p>
          <p className="type-child text-ink-2">Squads on the scanner, cadet.</p>
          <Button className={`${lime} mw-md mw-has-glyph`} onClick={() => arena?.start()}>Launch<RocketGlyph size={34} /></Button>
        </div>
      )}

      {ui.offer && (
        <div className={`${glass} absolute inset-0 z-20 m-auto flex h-fit w-[min(92%,420px)] flex-col items-center gap-3 p-6 text-center`}>
          <p className="type-child text-[22px]">You are flying like an ace. Hyper-Jump straight to <b className="font-semibold">{ui.offer.name}</b>?</p>
          <div className="flex gap-3">
            <Button className={`${lime} px-5 py-3 text-base`} onClick={() => { const name = ui.offer?.name ?? null, to = arena?.acceptJump(); if (to) { setJumping(name); onFly?.(to); } }}><Icon name="jump" size={20} />Hyper-Jump</Button>
            <Button className={`${ghost} px-5 py-3 text-base`} onClick={() => arena?.declineJump()}>Keep flying here</Button>
          </div>
        </div>
      )}

      {jumping && !ui.offer && (
        <div role="status" className={`${glass} absolute inset-0 z-20 m-auto flex h-fit w-[min(92%,420px)] flex-col items-center gap-2 p-6 text-center`}>
          <Icon name="jump" size={28} className="text-gold" />
          <p className="type-child text-[22px]">Hyper-Jumping to <b className="font-semibold">{jumping}</b>…</p>
        </div>
      )}

      {ui.done && (
        <div className={`${glass} absolute inset-0 z-20 m-auto flex h-fit w-[min(92%,440px)] flex-col items-center gap-3 p-6 text-center`}>
          <p className="type-display text-balance text-[clamp(28px,8vw,36px)]">{ui.done.title}</p>
          <p className="flex items-center gap-2 type-child text-ink-2">{ui.done.sub} · <Icon name="orb" size={20} className="text-gold" />{ui.orbs} orbs</p>
          {doneActions ? <div className="flex flex-wrap justify-center gap-3">{doneActions(ui.done)}</div>
            : ui.done.next && <Button className={`${lime} mw-md mw-has-glyph`} onClick={() => onFly?.(ui.done!.next!)}>Fly to {PLANET_NAMES[ui.done.next]}<RocketGlyph size={34} /></Button>}
        </div>
      )}
    </>
  );
}
