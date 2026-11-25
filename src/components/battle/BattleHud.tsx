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
import { BriefingCard, ClearCard, MissionOverCard, OfferCard, PLANET_TEACHES } from "./Cards";
import { CARD_OPEN, Console, fmtN, useEntry } from "./Console";
import { useConsoleLayout, useReducedMotion, type ConsoleLayout } from "./layout";
import { MissionStrip, useOrbReward } from "./MissionStrip";
import { missionOver } from "./mission";
import { usePauseWhenHidden } from "./PauseMenu";
import { hold } from "./pause";
import { PowerUpList, PowerUpsButton } from "./PowerUps";
import { XRay } from "./XRay";
import { css } from "./cockpit";

/** Waves that do not count toward the mission (a breather, a check from another planet). */
const BONUS = new Set(["recharge", "probe", "transfer"]);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const TRICK_BY_CARD = Object.fromEntries(Object.entries(CARD).map(([id, name]) => [name, id as TrickId])) as Record<string, TrickId>;
/** After a card or the menu closes, presses on the console wait this long (a double tap's second tap is not an answer). */
const SETTLE_MS = 350;
/** A planet by its own name, never the mission's ("Earth", not "Cadet Bay"); "the Moon" in the middle of a sentence. */
export const planetName = (id: PlanetId, mid = false) => (mid ? BODY_NAME[id].replace(/^The /, "the ") : BODY_NAME[id]);

export type Safe = { top: number; right: number; bottom: number; left: number };

/**
 * Tell the 3D side where the cockpit is: the free area for the fleet and the rocket, and the band
 * for Nova's caption (just above the console on phones, bottom left on wider screens). Measured on
 * mount, resize and rotation only: nothing in the cockpit changes size during play.
 */
export function useCockpitSafe(layout: ConsoleLayout, strip: React.RefObject<HTMLElement | null>, con: React.RefObject<HTMLElement | null>,
  apply: ((s: Omit<Safe, "left">, caption: { px: number; side: "centre" | "left"; max?: number }) => void) | null) {
  const safe = useRef<Safe>({ top: 0, right: 0, bottom: 0, left: 0 });
  useEffect(() => {
    if (!apply) return;
    const measure = () => {
      const W = window.innerWidth, H = window.innerHeight, s = strip.current?.getBoundingClientRect(), c = con.current?.getBoundingClientRect();
      if (!s || !c) return;
      const top = Math.round(s.bottom + 6);
      let right = 0, bottom: number, cap: { px: number; side: "centre" | "left"; max?: number };
      if (layout === "pad") {
        // Nova's caption has its own band right above the keypad, under the rocket
        const band = 76;
        bottom = Math.round(H - c.top + band);
        cap = { px: Math.round(H - c.top + 10), side: "centre", max: W - 24 };
      } else if (layout === "column") {
        // a phone on its side: Nova speaks bottom-left, beside the rocket rather than under it, so the
        // fleet keeps the height. The plate stops short of the rocket at the free area's bottom centre
        right = Math.round(W - c.left);
        bottom = 34; // the rocket's flame hangs below its base: this keeps it on screen
        cap = { px: 10, side: "left", max: Math.max(160, (W - right) / 2 - 32 - 52) };
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
  // a Power-Up just landed on the belt: no card (nothing needs interrupting). Nova's caption names it
  // ("Flip It is on your belt now!") and its slot pulses for as long as the arena keeps `unlock` up
  const fresh = new Set((ui?.unlock?.cards ?? []).map((name) => TRICK_BY_CARD[name]).filter(Boolean));
  const [jumping, setJumping] = useState<string | null>(null);
  const briefing = !!ui && launch && !ui.started && !ui.done;
  const offer = !!ui?.offer && !jumping;
  const done = !!ui?.done;
  // ---- a mission that ended without a win: one card, before the next mission's first wave plays ----
  const [over, setOver] = useState<{ won: number; of: number } | null>(null);
  const lastMission = useRef<{ n: number; tier: number } | null>(null);
  const missionKey = ui?.wave ? `${ui.wave.index}:${ui.wave.a}x${ui.wave.b}` : "";
  useEffect(() => {
    if (!arena || ui?.mode !== "campaign" || !ui.wave) return;
    const s = fold(arena.log()), m = s.mission, prev = lastMission.current;
    lastMission.current = { n: m.n, tier: s.tier };
    const ended = missionOver(prev, s);
    if (ended) setOver(ended);
  }, [missionKey, arena]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (over) hold.on("mission-over"); else hold.off("mission-over"); }, [over]);
  // ---- the Power-Ups list ----
  const [listOpen, setListOpen] = useState(false);
  const [puEl, setPuEl] = useState<HTMLButtonElement | null>(null);
  useEffect(() => { if (listOpen) hold.on("powerups"); else hold.off("powerups"); }, [listOpen]);
  useEffect(() => () => hold.off("powerups"), []);
  const cardOpen = briefing || offer || done || !!jumping || !!over;
  // the keyboard works without a click: the game root has focus whenever no card is up
  useEffect(() => { if (!cardOpen && !paused) rootRef.current?.closest<HTMLElement>("[data-cockpit]")?.focus({ preventScroll: true }); }, [cardOpen, paused]);
  // a card or the menu just closed: the second tap of a double tap lands on the console under it, so for a
  // moment the console ignores presses (a stray digit on Fire, or a Power-Up switched on, by accident)
  const closedAt = useRef(-Infinity);
  const covered = cardOpen || paused || listOpen;
  useEffect(() => { if (!covered) closedAt.current = performance.now(); }, [covered]);
  const settled = useCallback(() => performance.now() - closedAt.current > SETTLE_MS, []);

  // ---- the number ----
  const live = !!ui?.canFire && !!w && !cardOpen && !paused && !listOpen;
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

  // the key P opens the Power-Ups list (only when the button itself could be pressed)
  const puReady = !!ui && ui.belt.length > 0 && live && !ui.lesson && !ui.sectors;
  useEffect(() => {
    if (!puReady) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || (e.key !== "p" && e.key !== "P")) return;
      if ((e.target as HTMLElement | null)?.closest?.("input, textarea, [contenteditable]") || document.querySelector(CARD_OPEN)) return;
      if (!settled()) return;
      e.preventDefault();
      setListOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [puReady, settled]);

  // ---- where the cockpit is ----
  const apply = useMemo(() => arena ? (s: Omit<Safe, "left">, cap: { px: number; side: "centre" | "left"; max?: number }) => { arena.setSafe(s); arena.captionAt(cap.px, cap.side, cap.max); } : null, [arena]);
  const centre = useCockpitSafe(layout, stripRef, conRef, apply);
  // each structure word shows once: beside the fleet where there is room, in the strip on a phone held upright
  const wordsInStrip = layout === "pad";
  useEffect(() => { arena?.setAxisWords(!wordsInStrip); }, [arena, wordsInStrip]);

  // ---- orbs: earned this battle, and the flight to the counter ----
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
  const hintWords = wordsInStrip && w && h && (h.squads === "on" || h.each === "on") ? (
    <>
      {h.squads === "on" && <span><b>{fmtN(ra)}</b> {plural(ra, "squad", "squads")}</span>}
      {h.squads === "on" && h.each === "on" && <span className={css.soft}> · </span>}
      {/* the same words the scan writes in the world (fleetView's squadsText / eachText) */}
      {h.each === "on" && <span><b>{fmtN(rb)}</b> in each squad</span>}
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
  // a mission's first fleet is an easier one that sets up the trick: it does not count toward the mission, so it says so
  else if (w && ui.mode === "campaign" && w.role === "anchor") lineA = <span className={css.soft}>Warm-up wave: not part of the mission score</span>;
  if (ui.sectors && !lesson) lineB = <span><b>{ui.sectors.filter((s) => s.value !== null).length}</b> of {ui.sectors.length} sectors locked</span>;
  if (ui.lockTotal !== null && ui.sectors) lineB = <span className={css.exact}>{ui.sectors.map((s) => fmtN(s.value ?? 0)).join(" + ")} = <b>{fmtN(ui.lockTotal)}</b></span>;

  // ---- the one Power-Ups button (the list it opens shows the whole belt); Sector-Lock's sectors sit under the question ----
  const hinted = h?.powerUp ?? null;
  const puOrbit = ui.belt.some((t) => t.fits && !t.active && (t.id === hinted || fresh.has(t.id)));
  const puDisabled = !live || !!lesson || !!ui.sectors;
  const slots = (
    <PowerUpsButton empty={ui.belt.length === 0} disabled={puDisabled} orbit={puOrbit} reduced={reduced} open={listOpen} buttonRef={setPuEl}
      onPress={() => { if (settled()) setListOpen(true); }} />
  );
  const sectorRow = ui.sectors ? (
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
  ) : null;

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
        lines={[lineA, lineB]} below={sectorRow} />
      {dev && (
        <div className="pointer-events-none absolute left-3 top-40 z-10 hidden type-body-sm type-number text-ink-3 [:root:has([data-xray][data-open])_&]:left-[356px] [:root:has([data-xray][data-open])_&]:block">
          <p>shots (s): {ui.shots.map((s) => (s / 1000).toFixed(1)).join(" · ") || "none"}</p>
          <p>lessons (s): {ui.lessons.map((s) => (s / 1000).toFixed(1)).join(" · ") || "none"}</p>
        </div>
      )}
      <Console layout={layout} consoleRef={conRef} entry={entry} live={live} fireWord={sectorActive ? "Lock" : "Fire"} onKey={(k) => { if (settled()) press(k); }}
        slots={slots} label={sectorActive ? `Console, sector ${sectorActive.label}` : "Console"}
        help={ui.mode === "academy" ? null : { onPress: () => { if (settled()) arena?.showMeHow(); }, disabled: !live || !!lesson, invite: ui.invite }} />
      <PowerUpList open={listOpen} onClose={() => setListOpen(false)} belt={ui.belt} hinted={hinted} layout={layout} anchor={puEl}
        onPick={(id) => { hold.off("powerups"); arena?.powerUp(id); }} />
      <p className={css.srOnly} aria-live="polite">{entry === "" ? "" : `${fmtN(Number(entry))} plasma balls loaded`}</p>

      <MissionOverCard open={!!over && !done} won={over?.won ?? 0} of={over?.of ?? 0}
        onAgain={() => setOver(null)} onRest={() => leave("/bay")} />
      <BriefingCard open={briefing} body={ui.planet} name={planetTitle} teaches={PLANET_TEACHES[ui.planet] ?? ""} win={winLine} onLaunch={() => arena?.start()} />
      <OfferCard open={offer} title={ui.offer ? planetName(ui.offer.to) : ""} name={ui.offer ? planetName(ui.offer.to, true) : ""} body={ui.offer?.to ?? null}
        onJump={() => { const name = ui.offer ? planetName(ui.offer.to, true) : null, to = arena?.acceptJump(); if (to) { setJumping(name); onFly?.(to); } }}
        onStay={() => arena?.declineJump()} />
      <ClearCard open={done && !jumping} body={ui.planet} title={clearTitle} orbs={d?.orbs ?? null}
        sub={d?.sub && !/clear$/i.test(d.title) ? d.sub : d?.next && d.next !== ui.planet ? `${planetName(d.next)} is open.` : undefined}
        actions={d && (doneActions ? doneActions(d) : <>
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
