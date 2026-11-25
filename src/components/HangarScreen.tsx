"use client";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ORB_RULES } from "@/battle/rewards";
import type { EventInput } from "@/db/events";
import { fold, type LoggedEvent } from "@/director/fold";
import { CATALOG, itemOf, itemState, nextGoal, PLANET_IN_A_SENTENCE, purchase, SLOTS, STARTER, type Item, type Slot } from "@/director/hangar";
import { flushed } from "@/engine/outbox";
import type { HangarBay, ShipStyle } from "@/worlds/space/hangarBay";
import { Button, buttonClass, HomeLink, Icon, PillLink, TopBar } from "./kit";
import { useScene } from "./hub/Scene";
import { useCadet } from "./hub/useCadet";
import { FieldManual } from "./teach/FieldManual";
import { Greeting } from "./teach/Greeting";

/**
 * The Hangar (/hangar): the cadet's rocket on show, and a shop of looks bought with orbs.
 * - Tap a row to try it on the rocket at once, without buying.
 * - One button then says what will happen: "Buy for 30 orbs", "Equip", or (neutral) how many
 *   more orbs to go and how to earn them.
 * - Buying asks once, in place, and saves before it says it is done; a double tap cannot buy twice
 *   (and the fold would charge once anyway). Then the rocket shows off and the orbs tick down.
 * Looks only: what orbs buy never changes how the game plays.
 */

const EARN_LINE = `A first-try answer earns ${ORB_RULES.wave_clear.firstTry} orbs.`;
/** A press on the confirm's Buy this soon after it appeared is the second half of a double tap: ignored. */
const ARM_MS = 450;

type Phase =
  | { kind: "idle" }
  | { kind: "confirm"; item: Item; cost: number; armedAt: number }
  | { kind: "saving"; item: Item }
  | { kind: "failed"; item: Item }
  | { kind: "done"; item: Item; bought: boolean };

/** The orb count shown in the top bar: it ticks towards the real count (instantly with reduced motion). */
function useTicker(target: number | null) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (target === null) return;
    const start = from.current;
    from.current = target;
    if (start === null || start === target || matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(target); return; }
    let raf = 0;
    const t0 = performance.now(), dur = 650;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(2, -10 * k);
      setShown(Math.round(start + (target - start) * (k >= 1 ? 1 : e)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); setShown(target); };
  }, [target]);
  return target === null ? null : shown;
}

/** A look's swatch: a paint chip, a plasma ball or a flame, drawn from token colours. */
function Swatch({ item, size = 44 }: { item: Item; size?: number }) {
  const { kind, main, second, shape } = item.swatch;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden className="flex-none">
      <circle cx="22" cy="22" r="21" fill="none" style={{ stroke: "var(--color-line-2)" }} strokeWidth="1" />
      {kind === "paint" && (
        <>
          <circle cx="22" cy="22" r="15" style={{ fill: main }} />
          <circle cx="22" cy="22" r="15" fill="none" style={{ stroke: second }} strokeWidth="2.5" />
        </>
      )}
      {kind === "ball" && shape === "one" && <circle cx="22" cy="22" r="7" style={{ fill: main }} />}
      {kind === "ball" && shape === "twin" && <><circle cx="16" cy="22" r="5.5" style={{ fill: main }} /><circle cx="28" cy="22" r="5.5" style={{ fill: main }} /></>}
      {kind === "ball" && shape === "bolt" && <rect x="9" y="17" width="26" height="10" rx="5" transform="rotate(-35 22 22)" style={{ fill: main }} />}
      {kind === "ball" && shape === "beam" && <rect x="6" y="19.5" width="32" height="5" rx="2.5" transform="rotate(-35 22 22)" style={{ fill: main }} />}
      {kind === "flame" && (
        <>
          <path d={shape === "long" ? "M22 6c4 7 5.5 13 5.5 19a5.5 5.5 0 0 1-11 0C16.5 19 18 13 22 6z" : "M22 11c5 5 7 10 7 15a7 7 0 0 1-14 0c0-5 2-10 7-15z"} style={{ fill: main }} transform="rotate(180 22 22)" />
          <path d={shape === "long" ? "M22 15c2 4 2.6 8 2.6 11a2.6 2.6 0 0 1-5.2 0c0-3 .6-7 2.6-11z" : "M22 18c2.6 3 3.4 6 3.4 8.5a3.4 3.4 0 0 1-6.8 0c0-2.5.8-5.5 3.4-8.5z"} style={{ fill: second }} transform="rotate(180 22 22)" />
          {shape === "comet" && <><circle cx="14" cy="10" r="1.6" style={{ fill: second }} /><circle cx="29" cy="8" r="1.3" style={{ fill: second }} /><circle cx="22" cy="5.5" r="1.1" style={{ fill: second }} /></>}
        </>
      )}
    </svg>
  );
}

/** What a row says about its look, in words. */
function StateWords({ st }: { st: ReturnType<typeof itemState> }) {
  switch (st.kind) {
    case "equipped": return <span className="flex items-center gap-1.5 type-name text-[16px] text-approach"><Icon name="check" size={18} />Equipped</span>;
    case "owned": return <span className="type-name text-[16px] text-ink-2">Owned</span>;
    case "price": return <span className="flex items-center gap-1.5 type-name type-number text-[17px] text-approach"><Icon name="orb" size={18} className="text-gold" />{st.cost}<span className="sr-only"> orbs</span></span>;
    case "locked": return <span className="flex items-center gap-1.5 type-name text-[16px] text-ink-3"><Icon name="lock" size={17} />{st.words}</span>;
  }
}

export function HangarScreen({ onHelp }: { onHelp?: () => void } = {}) {
  const { log, emit } = useCadet();
  const [help, setHelp] = useState(false);
  // purchases this screen has saved: folded on top of the cadet's log, so the screen updates at once
  const [mine, setMine] = useState<LoggedEvent[]>([]);
  const state = useMemo(() => (log ? fold([...log, ...mine]) : null), [log, mine]);
  const { box, scene } = useScene<HangarBay>(async (s) => (await import("@/worlds/space/hangarBay")).mountHangarBay(s, {}));
  const [slot, setSlot] = useState<Slot>("hull");
  const [preview, setPreview] = useState<Partial<Record<Slot, string>>>({});
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const busy = useRef(false);
  const frameEl = useRef<HTMLDivElement>(null);
  const orbs = useTicker(state?.orbs ?? null);

  const equipped = useCallback((s: Slot) => state?.equipped[s] ?? STARTER[s], [state]);
  const shown = (s: Slot) => preview[s] ?? equipped(s);
  const style: ShipStyle | null = state ? { hull: shown("hull"), thruster: shown("thruster"), blaster: shown("blaster") } : null;
  useEffect(() => { if (scene && style) scene.setStyle(style); }, [scene, style?.hull, style?.thruster, style?.blaster]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void import("@/engine/audio").then(({ audio }) => audio.mood("hangar")); }, []);

  // frame the rocket in the part of the screen the shop leaves free
  useEffect(() => {
    const el = frameEl.current;
    if (!scene || !el) return;
    const fit = () => { const r = el.getBoundingClientRect(); scene.setFrame({ x: r.left, y: r.top, w: r.width, h: r.height }); };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    addEventListener("resize", fit);
    return () => { ro.disconnect(); removeEventListener("resize", fit); };
  }, [scene]);

  const selected = itemOf(slot, shown(slot)) ?? CATALOG[slot][0];
  const tryOn = (item: Item) => {
    if (busy.current) return;
    setPreview((p) => ({ ...p, [item.slot]: item.id }));
    setPhase({ kind: "idle" });
    if (item.slot === "blaster" && shown("blaster") === item.id) scene?.demo(); // a second tap fires it again
  };

  /** Save one purchase: everything queued goes first (the fold reads order), then this, and wait for the answer. */
  const save = async (item: Item, cost: number) => {
    if (!state || busy.current) return;
    const e = purchase(state, item.slot, item.id);
    if (!e) return;
    busy.current = true;
    setPhase({ kind: "saving", item });
    let ok = false;
    try {
      await flushed();
      const r = await fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(e satisfies EventInput) });
      ok = r.ok;
    } catch { ok = false; }
    busy.current = false;
    if (!ok) { setPhase({ kind: "failed", item }); return; }
    setMine((m) => [...m, { ...e, at: Date.now() }]);
    setPreview((p) => ({ ...p, [item.slot]: undefined }));
    setPhase({ kind: "done", item, bought: cost > 0 });
    void import("@/engine/audio").then(({ audio }) => audio.sfx(cost ? "fanfare" : "blip_ok"));
    if (cost > 0) window.setTimeout(() => scene?.celebrate(), 450); // after the orbs have ticked down
  };

  /** Ask before buying. `t` is the press's event time (the same clock as performance.now()). */
  const ask = (item: Item, cost: number, t: number) => { if (!busy.current) setPhase({ kind: "confirm", item, cost, armedAt: t + ARM_MS }); };
  const noRepeat = (e: KeyboardEvent) => { if (e.repeat) e.preventDefault(); }; // holding Enter never buys

  // keep the confirm about the item on show: switching tabs or trying another look closes it
  const confirming = phase.kind === "confirm" && phase.item.id === selected.id ? phase : null;
  useEffect(() => {
    if (phase.kind !== "confirm") return;
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setPhase({ kind: "idle" }); };
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [phase.kind]);

  const st = state ? itemState(state, selected) : null;
  const goal = state ? nextGoal(state) : null;

  /** Where the next look is: ready to buy, a few orbs away, or behind a planet. */
  const goalLine = () => {
    if (!state || !goal) return "You own every look in the Hangar.";
    const g = itemState(state, goal);
    if (g.kind === "price" && g.short === 0) return `You can buy ${goal.name} now. Tap it to try it on.`;
    if (g.kind === "locked") return `Next: ${goal.name}. ${g.words}.`;
    return `Next: ${goal.name} for ${goal.cost} orbs. ${EARN_LINE}`;
  };

  /** The one thing to do now, pinned under the list. */
  const dock = () => {
    if (!state || !st) return <p className="type-child text-ink-3">Opening the Hangar…</p>;
    if (confirming) {
      return (
        <div className="flex flex-col gap-3" role="group" aria-labelledby="hangar-ask">
          {/* both answers wait out ARM_MS: the second tap of a double tap on Buy is neither a yes nor a no */}
          <p id="hangar-ask" className="type-child text-approach">Buy {confirming.item.name} for {confirming.cost} orbs?</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" size="md" autoFocus onKeyDown={noRepeat} onClick={(e) => { if (e.timeStamp >= confirming.armedAt) setPhase({ kind: "idle" }); }} className="w-full">Not now</Button>
            <Button variant="primary" size="md" glyph={false} onKeyDown={noRepeat} onClick={(e) => { if (e.timeStamp >= confirming.armedAt) void save(confirming.item, confirming.cost); }} className="w-full">Buy</Button>
          </div>
        </div>
      );
    }
    if (phase.kind === "saving") return <Button variant="primary" size="lg" disabled className="w-full justify-between" glyph={false}>Saving…</Button>;
    if (phase.kind === "failed" && phase.item.id === selected.id) {
      return (
        <div className="flex flex-col gap-3">
          <p role="alert" className="type-child text-approach">That did not save. Your orbs are safe. Check the connection and try again.</p>
          <Button variant="primary" size="lg" onKeyDown={noRepeat} onClick={(e) => (itemState(state, selected).kind === "price" ? ask(selected, selected.cost, e.timeStamp) : void save(selected, 0))} className="w-full justify-between">Try again</Button>
        </div>
      );
    }
    switch (st.kind) {
      case "price":
        if (st.short === 0) return <Button variant="primary" size="lg" onKeyDown={noRepeat} onClick={(e) => ask(selected, st.cost, e.timeStamp)} className="w-full justify-between">Buy for {st.cost} orbs</Button>;
        return (
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-2 type-name text-[20px] text-approach"><Icon name="orb" size={22} className="text-gold" />{st.short} more orbs to go</p>
            <p className="type-child text-ink-2">{EARN_LINE}</p>
          </div>
        );
      case "locked":
        return (
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-2 type-name text-[20px] text-approach"><Icon name="lock" size={20} />{st.words}</p>
            <p className="type-child text-ink-2">Win the {PLANET_IN_A_SENTENCE[selected.unlock!.cleared].replace(/^the /, "")} mission to open it. Then it costs {selected.cost} orbs.</p>
          </div>
        );
      case "owned":
        return <Button variant="primary" size="lg" onKeyDown={noRepeat} onClick={() => void save(selected, 0)} className="w-full justify-between">Equip</Button>;
      case "equipped": {
        const just = phase.kind === "done" && phase.item.id === selected.id;
        return (
          <div className="flex flex-col gap-1" role="status">
            <p className="flex items-center gap-2 type-name text-[20px] text-approach"><Icon name="check" size={20} />{just ? `${selected.name} is on your rocket` : "On your rocket now"}</p>
            <p className="type-child text-ink-2 [@media(max-height:440px)]:hidden">
              {goalLine()}
            </p>
          </div>
        );
      }
    }
  };

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-void text-approach">
      <div ref={box} className="absolute inset-0" />
      {/* the part of the screen the rocket is framed in (the scene reads its size) */}
      <div ref={frameEl} aria-hidden className="pointer-events-none absolute inset-x-0 top-16 h-[calc(45dvh-4rem)] [@media(max-height:699px)_and_(max-aspect-ratio:1/1)]:h-[calc(36dvh-4rem)] [@media(min-aspect-ratio:1/1)_and_(min-width:640px)]:bottom-0 [@media(min-aspect-ratio:1/1)_and_(min-width:640px)]:right-[clamp(340px,34vw,480px)] [@media(min-aspect-ratio:1/1)_and_(min-width:640px)]:h-auto [@media(min-aspect-ratio:1/1)_and_(min-width:900px)]:top-[76px]" />

      <TopBar left={<HomeLink />} title="Hangar" orbs={orbs} onHelp={onHelp ?? (() => setHelp(true))} className="absolute inset-x-0 top-0" />
      {state && <Greeting screen="hangar" edge="top" seen={{ seen: state.seen, emit }} className="[@media(min-aspect-ratio:1/1)_and_(min-width:640px)]:pr-[calc(clamp(340px,34vw,480px)+16px)] [@media(min-aspect-ratio:1/1)_and_(min-width:900px)]:top-[92px]" />}
      {state && <FieldManual open={help} onClose={() => setHelp(false)} topic="orbs" seen={{ seen: state.seen, emit }} replayFrom="/hangar" />}

      <section
        aria-label="Shop"
        className="absolute inset-x-0 bottom-0 top-[45dvh] [@media(max-height:699px)_and_(max-aspect-ratio:1/1)]:top-[36dvh] z-10 flex flex-col rounded-t-panel border-t border-line-1 bg-sheet [@media(min-aspect-ratio:1/1)_and_(min-width:640px)]:left-auto [@media(min-aspect-ratio:1/1)_and_(min-width:640px)]:top-16 [@media(min-aspect-ratio:1/1)_and_(min-width:640px)]:w-[clamp(340px,34vw,480px)] [@media(min-aspect-ratio:1/1)_and_(min-width:640px)]:rounded-none [@media(min-aspect-ratio:1/1)_and_(min-width:640px)]:border-l [@media(min-aspect-ratio:1/1)_and_(min-width:640px)]:border-t-0 [@media(min-aspect-ratio:1/1)_and_(min-width:640px)]:bg-void [@media(min-aspect-ratio:1/1)_and_(min-width:900px)]:top-[76px]"
      >
        <Tabs value={slot} onValueChange={(v) => { if (v && !busy.current) { setSlot(v as Slot); setPhase({ kind: "idle" }); } }} className="flex min-h-0 flex-1 flex-col">
          <TabsList aria-label="What to change" className="grid grid-cols-3 gap-2 px-4 pt-3.5 md:px-6 md:pt-6">
            {SLOTS.map((s) => <TabsTab key={s.id} value={s.id} className={`${buttonClass("secondary", "sm")} w-full px-2 text-[16px]`}>{s.name}</TabsTab>)}
          </TabsList>
          {SLOTS.map((s) => (
            <TabsPanel key={s.id} value={s.id} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2.5 md:px-6 md:py-4">
              <ul className="flex flex-col gap-2" aria-label={`${s.name} you can try on`}>
                {CATALOG[s.id].map((item) => {
                  const its = state ? itemState(state, item) : null, on = shown(s.id) === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        aria-label={`${item.name}. ${item.blurb}. ${its ? (its.kind === "price" ? `${its.cost} orbs` : its.kind === "locked" ? its.words : its.kind === "equipped" ? "Equipped" : "Owned") : ""}`}
                        onClick={() => tryOn(item)}
                        className="mw-tile flex min-h-16 w-full items-center gap-3.5 px-3.5 py-2.5 text-left md:min-h-[72px] md:py-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                      >
                        <Swatch item={item} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                            <span className="type-name text-[18px] text-approach">{item.name}</span>
                            {its && <StateWords st={its} />}
                          </span>
                          <span className="type-body-sm text-ink-2">{item.blurb}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </TabsPanel>
          ))}
        </Tabs>
        <div className="border-t border-line-1 px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3 md:px-6 md:pb-6 md:pt-5" aria-live="polite">
          {dock()}
          {state && st?.kind === "equipped" && state.orbs === 0 && !state.owned.length && (
            <PillLink href="/map" variant="secondary" size="sm" icon="map" className="mt-3 [@media(max-height:699px)_and_(max-aspect-ratio:1/1)]:hidden">Star map</PillLink>
          )}
        </div>
      </section>
    </div>
  );
}
