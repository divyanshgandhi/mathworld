"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { fold } from "@/director/fold";
import { PRACTICE_WAVES } from "@/director/next";
import { flushed } from "@/engine/outbox";
import { missionLength, solvesToClear } from "@/rig/adaptive";
import { tierOfPlanet, type PlanetId } from "@/rig/pools";
import { CARD, type TrickId } from "@/rig/tricks";
import type { Arena, ArenaUi } from "@/worlds/space/arena";
import { BODY_NAME } from "@/worlds/space/bodies";
import { Button } from "@/components/kit/Button";
import { Icon } from "@/components/kit/Icon";
import { BriefingCard, ClearCard, OfferCard, PLANET_TEACHES, UnlockCard } from "./Cards";
import { Console, EmptySlot, fmtN, Slot, useEntry } from "./Console";
import { useConsoleLayout, useReducedMotion, type ConsoleLayout } from "./layout";
import { MissionStrip, useOrbReward } from "./MissionStrip";
import { usePauseWhenHidden } from "./PauseMenu";
import { hold } from "./pause";
import { PowerUpGlyph } from "./PowerUpGlyph";
import { XRay } from "./XRay";
import { css } from "./cockpit";

/** Waves that do not count toward the mission (a breather, a check from another planet). */
const BONUS = new Set(["recharge", "probe", "transfer"]);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const TRICK_BY_CARD = Object.fromEntries(Object.entries(CARD).map(([id, name]) => [name, id as TrickId])) as Record<string, TrickId>;
/** At most this many Power-Ups on the console: the ones that fit this fleet. */
const SLOTS = 3;
/** A planet by its own name, never the mission's ("Earth", not "Cadet Bay"); "the Moon" in the middle of a sentence. */
export const planetName = (id: PlanetId, mid = false) => (mid ? BODY_NAME[id].replace(/^The /, "the ") : BODY_NAME[id]);

export type Safe = { top: number; right: number; bottom: number; left: number };

/**
 * Tell the 3D side where the cockpit is: the free area for the fleet and the rocket, and the band
 * for Nova's caption (just above the console on phones, bottom left on wider screens). Measured on
 * mount, resize and rotation only: nothing in the cockpit changes size during play.
 */
export function useCockpitSafe(layout: ConsoleLayout, strip: React.RefObject<HTMLElement | null>, con: React.RefObject<HTMLElement | null>,
  apply: ((s: Omit<Safe, "left">, caption: { px: number; side: "centre" | "left" }) => void) | null) {
  const safe = useRef<Safe>({ top: 0, right: 0, bottom: 0, left: 0 });
  useEffect(() => {
    if (!apply) return;
    const measure = () => {
      const W = window.innerWidth, H = window.innerHeight, s = strip.current?.getBoundingClientRect(), c = con.current?.getBoundingClientRect();
      if (!s || !c) return;
      const top = Math.round(s.bottom + 6);
      let right = 0, bottom: number, cap: { px: number; side: "centre" | "left" };
      if (layout === "pad") {
        // Nova's caption has its own band right above the keypad, under the rocket
        const band = 76;
        bottom = Math.round(H - c.top + band);
        cap = { px: Math.round(H - c.top + 10), side: "centre" };
      } else if (layout === "column") {
        right = Math.round(W - c.left);
        bottom = 64;
        cap = { px: 8, side: "left" };
      } else {
        bottom = Math.round(H - c.top + 8);
        cap = { px: Math.round(H - c.top + 14), side: "left" };
      }
      safe.current = { ...safe.current, top, right, bottom };
      apply({ top, right, bottom }, cap);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (strip.current) ro.observe(strip.current);
    if (con.current) ro.observe(con.current);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("orientationchange", measure); };
  }, [layout, apply, strip, con]);
  /** The middle of the free area (where the fleet is), in px. */
  const centre = useCallback(() => {
    const s = safe.current, W = window.innerWidth, H = window.innerHeight;
    return { x: (W - s.right) / 2, y: (s.top + H - s.bottom) / 2 };
  }, []);
  return centre;
}

/** "5 ships got away. Try again." / "5 plasma balls flew past. Try again." Never the word wrong. */
export function missLine(kind: "under" | "over", n: number, noun: { one: string; many: string } = { one: "ship", many: "ships" }) {
  return kind === "under"
    ? <><b>{fmtN(n)}</b> {plural(n, `${noun.one} got`, `${noun.many} got`)} away. Try again.</>
    : <><b>{fmtN(n)}</b> {plural(n, "plasma ball", "plasma balls")} flew past. Try again.</>;
}

/**
 * The battle's 2D layer, shared by every planet, Cadet Bay and the Academy: the mission strip along the
 * top, the console on the edge, and the cards (briefing, new Power-Up, Hyper-Jump, planet clear).
 * The world owns the middle of the screen. There is no input box: the typed number rides on Fire
 * (and the arena draws it on the rocket's nose through `setCharge`).
 */
export function BattleHud({ arena, ui, onFly, dev = false, drone = false, doneActions, launch = true, menu }: {
  arena: Arena | null; ui: ArenaUi | null; onFly?: (to: PlanetId) => void; dev?: boolean; drone?: boolean;
  /** Buttons for the end card (default: fly to the next planet, Star map, Resting Bay). */
  doneActions?: (done: NonNullable<ArenaUi["done"]>) => ReactNode;
  /** Show the briefing card before the first wave. */
  launch?: boolean;
  /** The pause menu button (top-left). */
  menu?: ReactNode;
}) {
  const router = useRouter();
  const layout = useConsoleLayout();
  const reduced = useReducedMotion();
  // the menu or a card holds the game: the controls rest. (A hidden tab holds it too, but nobody can press anything then.)
  const paused = useSyncExternalStore(hold.subscribe, () => hold.has("menu") || hold.has("card"), () => false);
  usePauseWhenHidden();
  useEffect(() => () => hold.clear(), []);

  const stripRef = useRef<HTMLDivElement>(null), conRef = useRef<HTMLDivElement>(null), orbsRef = useRef<HTMLDivElement>(null), rootRef = useRef<HTMLDivElement>(null);
  const w = ui?.wave ?? null;
  const sectorActive = ui?.sectors?.find((s) => s.active) ?? null;

  // ---- cards ----
  const [unlocks, setUnlocks] = useState<{ id: TrickId; name: string; sector: boolean }[]>([]);
  const [prevUnlock, setPrevUnlock] = useState<ArenaUi["unlock"]>(null);
  if ((ui?.unlock ?? null) !== prevUnlock) {
    setPrevUnlock(ui?.unlock ?? null);
    const add = (ui?.unlock?.cards ?? []).map((name) => TRICK_BY_CARD[name]).filter(Boolean)
      .map((id) => ({ id, name: id === "big-small-split" && w?.sectorLock ? "Sector-Lock" : CARD[id], sector: id === "big-small-split" && !!w?.sectorLock }));
    if (add.length) setUnlocks((u) => [...u, ...add.filter((a) => !u.some((x) => x.id === a.id))]);
  }
  const unlock = unlocks[0] ?? null;
  const [jumping, setJumping] = useState<string | null>(null);
  const briefing = !!ui && launch && !ui.started && !ui.done;
  const offer = !!ui?.offer && !jumping;
  const done = !!ui?.done;
  const cardOpen = briefing || !!unlock || offer || done || !!jumping;
  // a card to read holds the game still (the next fleet waits for "Got it")
  useEffect(() => { if (unlock) hold.on("card"); else hold.off("card"); }, [unlock]);
  // the keyboard works without a click: the game root has focus whenever no card is up
  useEffect(() => { if (!cardOpen && !paused) rootRef.current?.closest<HTMLElement>("[data-cockpit]")?.focus({ preventScroll: true }); }, [cardOpen, paused]);

  // ---- the number ----
  const live = !!ui?.canFire && !!w && !cardOpen && !paused;
  const [lastFired, setLastFired] = useState<number | null>(null);
  const maxDigits = w ? Math.max(2, String(w.a * w.b).length + 1) : 2;
  const { entry, press, set } = useEntry({
    maxDigits, live,
    onChange: (n) => arena?.setCharge(n),
    onFire: (n) => {
      if (!arena || !ui) return false;
      if (sectorActive) { arena.lockSector(n); return; }
      setLastFired(n);
      void arena.fire(n);
    },
  });
  const waveKey = w ? `${w.index}:${w.a}x${w.b}` : "";
  const [prevWave, setPrevWave] = useState(waveKey);
  if (waveKey !== prevWave) { setPrevWave(waveKey); setLastFired(null); }
  useEffect(() => { set(""); }, [waveKey, set]);
  // every sector locked: their sum loads onto Fire
  useEffect(() => { if (ui?.lockTotal != null) set(String(ui.lockTotal)); }, [ui?.lockTotal, set]);

  // ---- where the cockpit is ----
  const apply = useMemo(() => arena ? (s: Omit<Safe, "left">, cap: { px: number; side: "centre" | "left" }) => { arena.setSafe(s); arena.captionAt(cap.px, cap.side); } : null, [arena]);
  const centre = useCockpitSafe(layout, stripRef, conRef, apply);

  // ---- orbs: earned this battle, and the flight to the counter ----
  const [firstOrbs, setFirstOrbs] = useState<number | null>(null);
  if (ui && firstOrbs === null) setFirstOrbs(ui.orbs);
  const shownOrbs = useOrbReward(ui?.orbs ?? 0, orbsRef, centre, { reduced, still: cardOpen });

  // ---- mission progress ----
  const tier = ui ? tierOfPlanet(ui.planet) : 0;
  const dots = useMemo(() => {
    if (!ui || !w || ui.mode === "academy") return null;
    if (ui.mode === "practice") return { total: w.of, won: Math.min(w.index, w.of), current: true };
    const m = arena ? fold(arena.log()).mission : null;
    return { total: tier === 0 ? missionLength(0) : missionLength(tier) - 1, won: m?.solved ?? 0, current: true };
  }, [ui?.mode, waveKey, arena, tier]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ui) return null;

  const [ra, rb] = w?.flipped ? [w.b, w.a] : [w?.a ?? 0, w?.b ?? 0];
  const noun = drone ? { one: "drone", many: "drones" } : { one: "ship", many: "ships" };
  const o = ui.outcome, h = ui.hint ?? null, lesson = ui.lesson;

  // ---- the two message lines under the question ----
  const hintWords = w && h && (h.squads !== "off" || h.each !== "off") ? (
    <>
      {h.squads !== "off" && <span className={h.squads === "soft" ? css.soft : undefined}><b>{fmtN(ra)}</b> {plural(ra, "squad", "squads")}</span>}
      {h.squads !== "off" && h.each !== "off" && <span className={css.soft}> · </span>}
      {/* the same words the scan writes in the world (fleetView's squadsText / eachText) */}
      {h.each !== "off" && <span className={h.each === "soft" ? css.soft : undefined}><b>{fmtN(rb)}</b> in each squad</span>}
    </>
  ) : null;
  let lineA: ReactNode = null, lineB: ReactNode = hintWords;
  if (jumping) lineA = <span className={css.lesson}>Hyper-Jumping to <b>{jumping}</b></span>;
  else if (lesson) {
    if (lesson.prompt) {
      lineA = <span className={css.turn}>Your turn</span>;
      lineB = lesson.equation ? <span className={css.equation}>{lesson.equation}</span> : <span>{lesson.prompt}</span>;
    } else {
      lineA = <span className={css.lesson}><Icon name="trick" size={20} className={css.icon} />Nova shows you <b>{lesson.card}</b></span>;
      lineB = lesson.why ? <span>{lesson.why.charAt(0).toUpperCase() + lesson.why.slice(1)}.</span> : hintWords;
    }
  } else if (o && w) {
    const p = w.a * w.b, fired = lastFired;
    if (o.kind === "exact") lineA = <span className={css.exact}><Icon name="check" size={20} className={css.icon} />Exactly right{o.orbs ? <> · <b>+{o.orbs}</b> orbs</> : null}</span>;
    else {
      // the count comes from the shot itself: fired against a × b
      const n = fired !== null ? Math.abs(fired - p) : o.value;
      lineA = <span className={o.last ? css.last : css.miss}>{missLine(o.kind, n, noun)}</span>;
    }
  } else if (w && ui.mode !== "academy" && BONUS.has(w.role) && ui.mode !== "practice") lineA = <span className={css.soft}>Bonus wave</span>;
  if (ui.sectors && layout !== "strip" && !lesson) lineB = <span><b>{ui.sectors.filter((s) => s.value !== null).length}</b> of {ui.sectors.length} sectors locked</span>;
  if (ui.lockTotal !== null && ui.sectors) lineB = <span className={css.exact}>{ui.sectors.map((s) => fmtN(s.value ?? 0)).join(" + ")} = <b>{fmtN(ui.lockTotal)}</b></span>;

  // ---- the Power-Up slots: only the ones that fit this fleet, at most three, in belt order ----
  const fits = ui.belt.filter((t) => t.fits);
  const want = new Set([h?.powerUp, ...fits.filter((t) => t.active).map((t) => t.id)].filter(Boolean) as TrickId[]);
  const chosen = [...fits.filter((t) => want.has(t.id)), ...fits.filter((t) => !want.has(t.id))].slice(0, SLOTS);
  const shown = fits.filter((t) => chosen.includes(t));
  const slots = ui.sectors ? (
    <div className={css.sectors} role="group" aria-label="Sectors">
      <span className={css.sectorCount}>{ui.sectors.filter((s) => s.value !== null).length} of {ui.sectors.length} locked</span>
      {ui.sectors.map((s) => (
        <button key={s.i} type="button" className={css.sector} onMouseDown={(e) => e.preventDefault()} data-active={s.active || undefined} data-locked={s.value !== null || undefined}
          disabled={s.value !== null || !live} aria-label={`Sector ${s.label}`} aria-pressed={s.active}
          ref={s.active ? (el) => el?.scrollIntoView?.({ block: "nearest", inline: "nearest" }) : undefined}
          onClick={() => { arena?.selectSector(s.i); set(""); }}>
          {s.label}{s.value !== null ? ` = ${fmtN(s.value)}` : ""}
        </button>
      ))}
    </div>
  ) : (
    <>
      {shown.map((t) => (
        <Slot key={t.id} label={t.card} glyph={<PowerUpGlyph id={t.id} lock={t.card === "Sector-Lock"} />} pressed={t.active}
          disabled={!live || !!lesson} pulse={!reduced && h?.powerUp === t.id && !t.active} onPress={() => arena?.powerUp(t.id)} />
      ))}
      {Array.from({ length: SLOTS - shown.length }, (_, i) => <EmptySlot key={`e${i}`} />)}
    </>
  );

  const leave = (to: string) => void flushed().then(() => router.push(to));
  const planetTitle = planetName(ui.planet);
  const d = ui.done;
  const clearTitle = !d ? "" : /clear$/i.test(d.title) ? `${planetTitle} is clear` : /practice/i.test(d.title) ? "Practice done" : d.title.charAt(0) + d.title.slice(1).toLowerCase();
  const nextName = d?.next ? (d.next === ui.planet ? "the next sector" : planetName(d.next, true)) : null;
  const winLine = ui.mode === "practice" ? `${PRACTICE_WAVES} practice waves. Fire as many plasma balls as there are ships.`
    : `Win ${solvesToClear(tier)} of ${tier === 0 ? missionLength(0) : missionLength(tier) - 1} waves.`;

  return (
    <div ref={rootRef} data-cockpit-hud className="contents">
      <XRay arena={arena} ui={ui} />
      <MissionStrip layout={layout} stripRef={stripRef} orbsRef={orbsRef} orbs={shownOrbs}
        menu={menu} dots={dots}
        question={w ? { a: ra, b: rb } : null}
        lines={[lineA, lineB]} />
      {dev && (
        <div className="pointer-events-none absolute left-3 top-40 z-10 hidden type-body-sm type-number text-ink-3 [:root:has([data-xray][data-open])_&]:left-[356px] [:root:has([data-xray][data-open])_&]:block">
          <p>shots (s): {ui.shots.map((s) => (s / 1000).toFixed(1)).join(" · ") || "none"}</p>
          <p>lessons (s): {ui.lessons.map((s) => (s / 1000).toFixed(1)).join(" · ") || "none"}</p>
        </div>
      )}
      <Console layout={layout} consoleRef={conRef} entry={entry} live={live} fireWord={sectorActive ? "Lock" : "Fire"} onKey={press}
        slots={slots} label={sectorActive ? `Console, sector ${sectorActive.label}` : "Console"}
        help={ui.mode === "academy" ? null : { onPress: () => arena?.showMeHow(), disabled: !live || !!lesson, invite: ui.invite }} />
      <p className={css.srOnly} aria-live="polite">{entry === "" ? "" : `${fmtN(Number(entry))} plasma balls loaded`}</p>

      <BriefingCard open={briefing} body={ui.planet} name={planetTitle} teaches={PLANET_TEACHES[ui.planet] ?? ""} win={winLine} onLaunch={() => arena?.start()} />
      {unlock && <UnlockCard open id={unlock.id} name={unlock.name} sector={unlock.sector} onClose={() => setUnlocks((u) => u.slice(1))} />}
      <OfferCard open={offer} title={ui.offer ? planetName(ui.offer.to) : ""} name={ui.offer ? planetName(ui.offer.to, true) : ""} body={ui.offer?.to ?? null}
        onJump={() => { const name = ui.offer ? planetName(ui.offer.to, true) : null, to = arena?.acceptJump(); if (to) { setJumping(name); onFly?.(to); } }}
        onStay={() => arena?.declineJump()} />
      <ClearCard open={done && !jumping} body={ui.planet} title={clearTitle} orbs={ui.orbs - (firstOrbs ?? ui.orbs)}
        sub={d?.sub && !/clear$/i.test(d.title) ? d.sub : d?.next && d.next !== ui.planet ? `${planetName(d.next)} is open.` : undefined}
        actions={d && (doneActions ? <div className="flex flex-wrap justify-center gap-3">{doneActions(d)}</div> : <>
          {d.next && <Button variant="primary" size="md" data-primary className="w-full justify-between" onClick={() => onFly?.(d.next!)}>Fly to {nextName}</Button>}
          <div className={css.cardRow}>
            <Button variant="secondary" size="md" icon="map" onClick={() => leave("/map")}>Star map</Button>
            <Button variant="secondary" size="md" icon="bay" onClick={() => leave("/bay")}>Resting Bay</Button>
          </div>
        </>)} />
      {jumping && (
        <div role="status" className="sr-only">Hyper-Jumping to {jumping}</div>
      )}
    </div>
  );
}
