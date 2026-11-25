"use client";
import { Button } from "@ui-sdk/react/button";
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@ui-sdk/react/dialog";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { TRICKS } from "@/db/events";
import { posters as postersOf, type Poster } from "@/director/hub";
import { missionLength, solvesToClear, type Band } from "@/rig/adaptive";
import { MAX_TIER, PLANETS_BY_TIER } from "@/rig/pools";
import { CARD, type TrickId } from "@/rig/tricks";
import { COLOR, MASTERY, type MasteryKey } from "@/design/tokens";
import { PLANET_NAMES } from "@/worlds/space/lines";
import { backdrop, dialogBox, ghost, lime } from "./battle/ui";
import { Button as KitButton, MasteryKeyLegend, MasteryMark, NovaLine, PillLink, Pips, RingLogo, TopBar, WaveDots } from "./kit";
import { Icon } from "./kit/Icon";
import { Flashcards } from "./hub/Flashcards";
import { useCadet } from "./hub/useCadet";
import { PlanetSprite } from "./world/PlanetSprite";

/** The internal mastery bands, in the words and marks the player sees. */
const LEVEL: Record<Band, MasteryKey> = { gold: "gold", understood: "got", practicing: "learn", unseen: "new" };

/** A quiet field of stars on the void, drawn once per resize (no animation to compete with the page). */
function Stars() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const stars = Array.from({ length: 240 }, () => ({ x: rnd(), y: rnd(), r: rnd() < 0.12 ? 1.2 : 0.7, a: 0.15 + rnd() * 0.55 }));
    const draw = () => {
      const dpr = Math.min(2, devicePixelRatio || 1), g = c.getContext("2d");
      c.width = innerWidth * dpr; c.height = innerHeight * dpr;
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = COLOR.approach;
      for (const s of stars) { g.globalAlpha = s.a; g.fillRect(s.x * innerWidth, s.y * innerHeight, s.r, s.r); }
    };
    draw();
    addEventListener("resize", draw);
    return () => removeEventListener("resize", draw);
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 size-full" />;
}

/**
 * The Resting Bay (/bay): the cadet's home between missions, drawn in 2D (design/bay-accretion.html).
 * The next mission owns the screen: its planet from the same planet factory the battle uses, the
 * waves won so far, and the one primary action, Launch. Below it, the ten times tables as rows of
 * mastery marks (open one to see its facts and practise them) and the places to go.
 */
export function RestingBayScreen() {
  const router = useRouter();
  const { cadet, state, emit } = useCadet();
  const ps = useMemo(() => (state ? postersOf(state) : null), [state]);
  const tricks = useMemo(() => (state ? TRICKS.filter((t) => (state.seenTricks[t] ?? 0) > 0) : []), [state]);
  const [open, setOpen] = useState<Poster | null>(null);
  const [tricksOpen, setTricksOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [deck, setDeck] = useState(false);

  useEffect(() => { void import("@/engine/audio").then(({ audio }) => audio.mood("hangar")); }, []);
  useEffect(() => { for (const to of ["/map", "/hangar", "/academy"]) router.prefetch(to); }, [router]);

  if (!state || !ps) return <div className="fixed inset-0 bg-void" />;

  const tier = Math.min(state.tier, MAX_TIER), planet = PLANETS_BY_TIER[tier], name = planet === "earth" ? "Cadet Bay" : PLANET_NAMES[planet];
  const next = tier < MAX_TIER ? PLANET_NAMES[PLANETS_BY_TIER[tier + 1]] : null;
  const waves = missionLength(tier) - 1, need = solvesToClear(tier), won = Math.min(state.mission.solved, waves);
  // Nova points at the table closest to Gold that is not there yet, if there is one
  const near = ps.filter((p) => p.gold > 0 && p.gold < 10).sort((a, b) => b.gold - a.gold)[0];
  const switchCadet = async () => { await fetch("/api/player", { method: "DELETE" }); router.push("/"); };

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-void text-approach">
      <Stars />
      <TopBar className="relative z-10" left={<RingLogo className="hidden sm:block" />} title="Resting Bay" orbs={state.orbs} onHelp={() => setHelp(true)} />

      <main className="relative z-10 mx-auto flex max-w-[1280px] flex-col gap-10 px-5 pb-8 md:px-[clamp(24px,5.2vw,88px)]">
        <section aria-labelledby="next" className="grid items-center gap-2 md:min-h-[calc(100dvh-76px-260px)] md:grid-cols-[minmax(340px,46%)_1fr]">
          <div className="order-2 md:order-1">
            <h2 id="next" className="m-0 type-display text-[clamp(44px,7vw,96px)] leading-[0.95]">{name}</h2>
            <p className="mt-5 max-w-[30ch] type-child text-ink-2">
              {state.mission.passed && next ? <>Mission won. Launch to fly on to <b className="font-semibold text-approach">{next}</b>.</>
                : next ? <>Your next mission. Win <b className="font-semibold text-approach">{need} of {waves} waves</b> to unlock {next}.</>
                : <>The fleets out here keep growing. How far can you go?</>}
            </p>
            {next && <WaveDots total={waves} won={won} current className="mt-3.5" />}
            <PillLink href={`/play/${planet}`} variant="primary" size="lg" className="mt-8 w-full justify-between md:w-auto">
              Launch<span className="hidden md:inline">&nbsp;to {name}</span>
            </PillLink>
            <NovaLine className="mt-8">
              Welcome back, {cadet?.name ?? "cadet"}! {near ? <>Your {near.table}s are {near.gold >= 7 ? "nearly Gold" : "coming along"}.</> : <>Open a times table below to see your facts.</>}
            </NovaLine>
          </div>
          <div className="order-1 flex justify-center md:order-2">
            <PlanetSprite id={planet} size={360} alt="" className="max-h-[min(62vw,360px)] max-w-[min(62vw,360px)] md:max-h-none md:max-w-none" />
          </div>
        </section>

        <section className="grid gap-8 2xl:grid-cols-[1fr_auto] 2xl:items-end">
          <div className="order-1">
            <h2 id="tables" className="m-0 mb-3 type-label text-ink-2">Your times tables</h2>
            <div role="group" aria-labelledby="tables" className="grid grid-cols-5 gap-2 lg:grid-cols-10">
              {ps.map((p) => {
                const marks = p.cells.map((c) => LEVEL[c.band]);
                return (
                  <Button key={p.table} aria-expanded={open?.table === p.table} aria-label={`The ${p.table}s: ${p.gold} of 10 Gold`}
                    onClick={() => setOpen((o) => (o?.table === p.table ? null : p))}
                    className="mw-tile flex min-h-11 min-w-0 flex-col items-center gap-2.5 px-0 pb-3.5 pt-3">
                    <b className="type-number text-[20px] font-medium">×{p.table}</b>
                    <Pips marks={marks} size={8} columns={5} />
                  </Button>
                );
              })}
            </div>
          </div>
          <nav aria-label="Places" className="order-3 flex flex-col gap-3">
            <h2 className="m-0 type-label text-ink-2">Go to</h2>
            <div className="flex flex-wrap gap-2.5">
              <PillLink href="/map" icon="map">Star map</PillLink>
              <PillLink href="/hangar" icon="hangar">Hangar</PillLink>
              <PillLink href="/academy" icon="academy">Academy</PillLink>
              <KitButton variant="secondary" icon="trick" onClick={() => setTricksOpen(true)}>Tricks · {tricks.length}</KitButton>
            </div>
          </nav>

          {open && (
            <div className="order-2 rounded-panel border border-line-1 bg-panel p-5 2xl:col-span-2" aria-live="polite">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="m-0 type-display text-[26px]">The {open.table}s</h3>
                <MasteryKeyLegend />
              </div>
              <ol className="m-0 grid list-none grid-cols-5 gap-2 p-0 lg:grid-cols-10">
                {open.cells.map((c) => {
                  const lv = LEVEL[c.band];
                  return (
                    <li key={c.n} className="flex flex-col items-center gap-1.5 py-2" aria-label={`${open.table} times ${c.n}: ${MASTERY[lv].word}`}>
                      <span className="type-body-sm text-ink-2">{open.table} × {c.n}</span>
                      <span className={`type-number text-[22px] font-medium ${lv === "gold" ? "text-gold" : lv === "new" ? "text-ink-3" : ""}`}>{lv === "new" ? "?" : open.table * c.n}</span>
                      <MasteryMark level={lv} size={10} />
                    </li>
                  );
                })}
              </ol>
              <div className="mt-4 flex justify-end">
                <KitButton variant="secondary" icon="cards" onClick={() => setDeck(true)}>Practise with flashcards</KitButton>
              </div>
            </div>
          )}
        </section>

        <KitButton variant="quiet" className="self-start" onClick={() => void switchCadet()}>Switch cadet</KitButton>
      </main>

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogBackdrop className={backdrop} />
        <DialogContent className={`${dialogBox} w-[min(92vw,440px)] p-6`}>
          <DialogTitle className="type-display text-[30px]">How to play</DialogTitle>
          <div className="mt-3 flex flex-col gap-2 type-body text-ink-2">
            <p className="m-0">Launch flies you to your next mission. Each fleet is squads of ships: count the squads and the ships in one squad, then fire that many plasma balls.</p>
            <p className="m-0">Your times tables fill with marks as you go: <MasteryMark level="gold" size={9} /> Gold, <MasteryMark level="got" size={9} /> Got it, <MasteryMark level="learn" size={9} /> Learning, <MasteryMark level="new" size={9} /> New.</p>
            <p className="m-0">Spend orbs in the Hangar. Watch any trick in the Academy.</p>
          </div>
          <DialogClose className={`${lime} mt-5 w-full py-2.5`}>Got it</DialogClose>
        </DialogContent>
      </Dialog>

      <Dialog open={tricksOpen} onOpenChange={setTricksOpen}>
        <DialogBackdrop className={backdrop} />
        <DialogContent className={`${dialogBox} w-[min(92vw,440px)] p-5`}>
          <DialogTitle className="type-display text-[30px]">Your tricks</DialogTitle>
          <DialogDescription className="mt-2 type-body text-ink-2">{tricks.length ? "Tap a trick to watch it in the Academy." : "Win a Show Me How in battle to earn your first trick."}</DialogDescription>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {tricks.map((t: TrickId) => (
              <Button key={t} aria-label={`Watch ${CARD[t]}`} onClick={() => router.push(`/academy?trick=${t}`)} className="mw-tile flex min-h-12 items-center gap-2 px-3 py-3 text-left type-name text-[15px]"><Icon name="trick" size={18} className="text-gold" />{CARD[t]}</Button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button className={`${ghost} flex-1 py-2.5`} onClick={() => router.push("/academy")}>Academy</Button>
            <DialogClose className={`${lime} flex-1 py-2.5`}>Done</DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {deck && <Flashcards state={state} emit={emit} onClose={() => setDeck(false)} />}
    </div>
  );
}
