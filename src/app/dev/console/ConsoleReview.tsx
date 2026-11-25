"use client";
import { useState, type ReactNode } from "react";
import { PowerUpList, PowerUpsButton, type BeltItem } from "@/components/battle/PowerUps";
import { Button } from "@/components/kit/Button";
import { Icon } from "@/components/kit/Icon";
import { BriefingCard, ClearCard, MissionOverCard, OfferCard, UnlockCard } from "@/components/battle/Cards";
import { Console } from "@/components/battle/Console";
import { useConsoleLayout } from "@/components/battle/layout";
import { MissionStrip } from "@/components/battle/MissionStrip";
import { missLine } from "@/components/battle/BattleHud";
import { PowerUpGlyph } from "@/components/battle/PowerUpGlyph";
import { css } from "@/components/battle/cockpit";
import type { TrickId } from "@/rig/tricks";

const STATES = ["ready", "loaded", "miss", "lesson", "turn", "sectors", "warm-up"] as const;
const CARDS = ["none", "briefing", "unlock", "sector-unlock", "offer", "clear", "mission-over"] as const;
/** The Power-Ups list in every state it can be in. */
const LISTS = ["closed", "empty belt", "one fits", "three", "hinted", "none fit", "seven"] as const;
const B = (id: TrickId, card: string, fits: boolean, active = false): BeltItem => ({ id, card, fits, active });
const BELTS: Record<(typeof LISTS)[number], BeltItem[]> = {
  closed: [B("double-it", "Double It!", true), B("flip-it", "Flip It!", true), B("big-small-split", "Big & Small Split", false)],
  "empty belt": [],
  "one fits": [B("double-it", "Double It!", true)],
  three: [B("double-it", "Double It!", true), B("flip-it", "Flip It!", true, true), B("easy-5-10", "Easy 5 & 10", false)],
  hinted: [B("double-it", "Double It!", true), B("flip-it", "Flip It!", false), B("split-and-add", "Split and Add", true)],
  "none fit": [B("double-it", "Double It!", false), B("flip-it", "Flip It!", false)],
  seven: [B("empty-mirror", "Empty & Mirror", false), B("fast-adding", "Fast Adding", true), B("flip-it", "Flip It!", true), B("double-it", "Double It!", true),
    B("easy-5-10", "Easy 5 & 10", true), B("jump-one-more", "Jump One More", false), B("split-and-add", "Split and Add", true)],
};

/** The cockpit on the void, driven by two pickers: the console's state and the card on top. */
export function ConsoleReview() {
  const layout = useConsoleLayout();
  const [state, setState] = useState<(typeof STATES)[number]>("ready");
  const [card, setCard] = useState<(typeof CARDS)[number]>("none");
  const [list, setList] = useState<(typeof LISTS)[number]>("closed");
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const belt = BELTS[list];
  const hinted: TrickId | null = list === "hinted" ? "split-and-add" : null;
  const entry = state === "loaded" ? "42" : state === "sectors" ? "120" : "";
  const lines: [ReactNode, ReactNode] = state === "miss" ? [<span key="a" className={css.miss}>{missLine("under", 5)}</span>, <span key="b"><b>6</b> squads</span>]
    : state === "lesson" ? [<span key="a" className={css.lesson}><Icon name="trick" size={20} className={css.icon} />Nova shows you <b>Double It!</b></span>, <span key="b">Count one half, then double it.</span>]
    : state === "turn" ? [<span key="a" className={css.turn}>Your turn</span>, <span key="b" className={css.equation}>21 + 21 = ?</span>]
    : state === "sectors" ? [null, <span key="b"><b>1</b> of 4 sectors locked</span>]
    : [null, null];
  const below = state === "sectors" ? (
    <div className={css.sectors} role="group" aria-label="Sectors">
      <span className={css.sectorCount}>1 of 4 locked</span>
      {["10 × 20 = 200", "10 × 4", "6 × 20", "6 × 4"].map((s, i) => <button key={s} type="button" className={css.sector} data-locked={i === 0 || undefined} data-active={i === 2 || undefined}>{s}</button>)}
    </div>
  ) : null;
  const slots = (
    <PowerUpsButton empty={state === "warm-up" || belt.length === 0} disabled={state === "lesson" || state === "turn" || state === "sectors"} orbit={state === "miss" || list === "hinted"} reduced={false}
      open={open} buttonRef={setAnchor} onPress={() => setOpen(true)} />
  );
  return (
    <div className={css.root} data-cockpit>
      <MissionStrip layout={layout} orbs={142} question={state === "warm-up" ? { a: 7, b: 5, op: "+" } : state === "sectors" ? { a: 16, b: 24 } : { a: 6, b: 7 }}
        dots={{ total: 4, won: 1, current: true }} lines={lines} below={below}
        menu={<Button variant="icon" icon="menu" aria-label="Pause" />} />
      <div className="absolute left-1/2 top-1/2 z-20 flex max-w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-wrap justify-center gap-2">
        {STATES.map((s) => <Button key={s} size="sm" aria-pressed={s === state} onClick={() => setState(s)}>{s}</Button>)}
        <span className="basis-full" />
        {CARDS.map((c) => <Button key={c} size="sm" aria-pressed={c === card} onClick={() => setCard(c)}>{c}</Button>)}
        <span className="basis-full" />
        {LISTS.map((l) => <Button key={l} size="sm" aria-pressed={l === list} onClick={() => { setList(l); setOpen(l !== "closed" && BELTS[l].length > 0); }}>{l}</Button>)}
        <span className="basis-full" />
        <span className="flex gap-3 text-ink-2">{(["double-it", "flip-it", "split-and-add", "fast-adding", "easy-5-10", "jump-one-more", "borrow-take-back", "empty-mirror", "big-small-split", "half-double"] as TrickId[]).map((id) => <span key={id} title={id}><PowerUpGlyph id={id} /></span>)}</span>
      </div>
      <Console layout={layout} entry={entry} live={state !== "warm-up" || true} fireWord={state === "sectors" ? "Lock" : "Fire"} onKey={() => {}} slots={slots}
        help={state === "warm-up" ? null : { onPress: () => {}, disabled: state === "lesson" || state === "turn", invite: state === "miss" }} />
      <PowerUpList open={open} onClose={() => setOpen(false)} onPick={() => {}} belt={belt} hinted={hinted} layout={layout} anchor={anchor} />
      <MissionOverCard open={card === "mission-over"} won={1} of={3} onAgain={() => setCard("none")} onRest={() => setCard("none")} />
      <BriefingCard open={card === "briefing"} body="moon" name="The Moon" teaches="Times 2, times 5 and times 10." win="Win 3 of 4 waves." onLaunch={() => setCard("none")} />
      {(card === "unlock" || card === "sector-unlock") && <UnlockCard open id={card === "unlock" ? "double-it" : "big-small-split"} name={card === "unlock" ? "Double It!" : "Sector-Lock"} sector={card === "sector-unlock"} onClose={() => setCard("none")} />}
      <OfferCard open={card === "offer"} title="Jupiter" name="Jupiter" body="jupiter" onJump={() => setCard("none")} onStay={() => setCard("none")} />
      <ClearCard open={card === "clear"} body="moon" title="The Moon is clear" orbs={{ amount: 20, lines: [{ label: "Planet cleared", amount: 20 }] }} sub="Mars is open." actions={<>
        <Button variant="primary" size="md" data-primary className="w-full justify-between" onClick={() => setCard("none")}>Fly to Mars</Button>
        <div className={css.cardRow}><Button icon="map">Star map</Button><Button icon="bay">Resting Bay</Button></div>
      </>} />
    </div>
  );
}
