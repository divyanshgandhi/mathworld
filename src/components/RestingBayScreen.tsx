"use client";
import { Button as UiButton } from "@ui-sdk/react/button";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { posters as postersOf, type Poster } from "@/director/hub";
import type { LoggedEvent, PlayerState } from "@/director/fold";
import { missionLength, solvesToClear, type Band } from "@/rig/adaptive";
import { MAX_TIER, PLANETS_BY_TIER, type PlanetId } from "@/rig/pools";
import { MASTERY, type MasteryKey } from "@/design/tokens";
import { BODY_NAME } from "@/worlds/space/bodies";
import { Button, buttonClass, Loading, masterySummary, MasteryKeyLegend, MasteryMark, NovaLine, PillLink, Pips, RingLogo, SheetClose, SheetDialog, TopBar, WaveDots } from "./kit";
import { Flashcards } from "./hub/Flashcards";
import { FieldManual } from "./teach/FieldManual";
import { GREETINGS } from "@/teach/greetings";
import { greetKey } from "@/teach/keys";
import { useCadet } from "./hub/useCadet";
import { PlanetSprite } from "./world/PlanetSprite";
import "./hub/hub.css";

/** The internal mastery bands, in the words and marks the player sees. */
const LEVEL: Record<Band, MasteryKey> = { gold: "gold", understood: "got", practicing: "learn", unseen: "new" };
/** "The Moon" leads a label; mid-sentence it is "the Moon". */
const inLine = (name: string) => name.replace(/^The /, "the ");
/** The seen key for the bay's first-arrival line (shared with the teaching layer). */
const GREET = greetKey("bay");

/** A quiet field of stars on the void, drawn once per resize (no animation to compete with the page). */
function Stars() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const stars = Array.from({ length: 240 }, () => ({ x: rnd(), y: rnd(), r: rnd() < 0.12 ? 1.2 : 0.7, a: 0.15 + rnd() * 0.5 }));
    const draw = () => {
      const dpr = Math.min(2, devicePixelRatio || 1), g = c.getContext("2d");
      c.width = innerWidth * dpr; c.height = innerHeight * dpr;
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = getComputedStyle(c).color;
      for (const s of stars) { g.globalAlpha = s.a; g.fillRect(s.x * innerWidth, s.y * innerHeight, s.r, s.r); }
    };
    draw();
    addEventListener("resize", draw);
    return () => removeEventListener("resize", draw);
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 size-full text-approach" />;
}

/**
 * The next planet with the cadet's rocket on a dashed orbit around it (design/bay-accretion.html).
 * The orbit is split in two so the rocket passes behind the planet and in front of it. The rocket
 * going round is the screen's one moving thing; under reduced motion it rests in front.
 */
function MissionPlanet({ planet }: { planet: PlanetId }) {
  const back = useRef<SVGGElement>(null), front = useRef<SVGGElement>(null);
  useEffect(() => {
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, t0 = 0;
    const place = (a: number) => {
      const x = 50 + 47 * Math.cos(a), y = 50 + 14 * Math.sin(a), behind = Math.sin(a) < 0;
      for (const [g, on] of [[back.current, behind], [front.current, !behind]] as const) {
        if (!g) continue;
        g.setAttribute("transform", `rotate(-16 50 50) translate(${x.toFixed(2)} ${y.toFixed(2)})`);
        g.style.visibility = on ? "visible" : "hidden";
      }
    };
    if (still) { place(Math.PI * 0.32); return; }
    const tick = (now: number) => { if (!t0) t0 = now; place(-Math.PI * 0.2 + ((now - t0) / 1000) * 0.32); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const rocket = (
    <>
      <circle r="0.55" cx="-1.3" cy="0.25" className="fill-ember" />
      <circle r="1.05" className="fill-approach" />
    </>
  );
  return (
    <div className="mw-bay-planet" aria-hidden>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible">
        {/* the far half of the orbit, behind the planet */}
        <path d="M3 50 A47 14 0 0 1 97 50" transform="rotate(-16 50 50)" className="mw-bay-orbit" pathLength="50" strokeDasharray="0.7 1.1" />
        <g ref={back}>{rocket}</g>
      </svg>
      <PlanetSprite id={planet} size={480} alt="" className="mw-bay-sprite" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible">
        {/* the near half of the orbit, drawn over the planet */}
        <path d="M3 50 A47 14 0 0 0 97 50" transform="rotate(-16 50 50)" className="mw-bay-orbit" pathLength="50" strokeDasharray="0.7 1.1" />
        <g ref={front}>{rocket}</g>
      </svg>
    </div>
  );
}

/** What Nova says when the cadet arrives: true to where they are. Plain words, one or two sentences. */
function novaLine(s: PlayerState, log: LoggedEvent[], name: string, first: boolean, planet: string, ps: Poster[]): string {
  // the first arrival is the bay's greeting (the teaching layer's line): what this place is, and the one thing to do
  if (first) return `Hi, ${name}! ${GREETINGS.bay.text}`;
  const all = s.cleared.includes(MAX_TIER);
  const last = [...log].reverse().find((e) => e.type === "planet_cleared" || e.type === "hyper_jump_taken" || e.type === "attempt_submitted");
  if (last?.type === "planet_cleared" && !all) {
    const from = BODY_NAME[last.payload.planetId as PlanetId] ?? "that planet";
    return `You cleared ${inLine(from)}, ${name}! ${planet} is next.`;
  }
  if (last?.type === "hyper_jump_taken") return `You jumped all the way to ${inLine(planet)}, ${name}! Same rules out here.`;
  if (all) return `Every planet is clear, ${name}. Keep your facts Gold with flashcards.`;
  if (s.mission.passed) return `Great flying, ${name}! Launch to see what is next.`;
  const near = ps.filter((p) => p.gold >= 6 && p.gold < 10).sort((a, b) => b.gold - a.gold || a.table - b.table)[0];
  if (near) return `Welcome back, ${name}! Your ${near.table}s are nearly Gold.`;
  return `Welcome back, ${name}! Ready for ${inLine(planet)}?`;
}

/**
 * The Resting Bay (/bay): the cadet's home between missions, in 2D (design/bay-accretion.html).
 * - The hero is the next mission's planet, named by the planet, with one line of status, the waves
 *   won, the one primary action (Launch) and Nova's line.
 * - `patrol` is the slot under the mission for the daily patrol: a node, or a function given the bay's cadet.
 * - The times tables as ten rows of mastery marks: one opens in place to its ten facts and
 *   "Practise the 7s", which starts flashcards on that table.
 * - Places to go (Star map, Hangar, Academy), and a quiet Switch cadet that asks first.
 * - Help opens the Field Manual (`onHelp` replaces it), with a quiet "Watch the film again".
 * - Nova's line is the bay's greeting on the first arrival (seen key `greet:bay`), so the bay never
 *   floats a second greeting over it.
 */
/** What the patrol slot is given when `patrol` is a function: the bay's own cadet, so a patrol shares its log. */
export type BaySlotContext = { state: PlayerState; log: LoggedEvent[]; emit: ReturnType<typeof useCadet>["emit"] };

export function RestingBayScreen({ onHelp, patrol }: { onHelp?: () => void; patrol?: ReactNode | ((c: BaySlotContext) => ReactNode) } = {}) {
  const router = useRouter();
  const { cadet, log, state, emit } = useCadet();
  const ps = useMemo(() => (state ? postersOf(state) : null), [state]);
  const [open, setOpen] = useState<number | null>(null);
  const [help, setHelp] = useState(false);
  const [deck, setDeck] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // the first arrival is decided once, from the log as it loads (recording it must not change the line)
  const [first, setFirst] = useState<boolean | null>(null);

  useEffect(() => { void import("@/engine/audio").then(({ audio }) => audio.mood("hangar")).catch(() => {}); }, []);
  useEffect(() => { for (const to of ["/map", "/hangar", "/academy"]) router.prefetch(to); }, [router]);
  if (state && first === null) setFirst(!state.seen[GREET]);
  const greeted = useRef(false);
  useEffect(() => {
    if (!first || greeted.current) return;
    greeted.current = true;
    emit({ type: "seen", payload: { key: GREET } });
  }, [first, emit]);
  // an opened table scrolls into view (only as far as it needs); Escape closes it
  useEffect(() => {
    if (open === null) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("facts")?.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
    // capture phase: a sheet on top (flashcards, the manual) is still open when we look, so its Escape is its own
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("dialog[open], [data-slot=dialog-content][data-open], [data-slot=alert-dialog-content][data-open]")) setOpen(null); };
    addEventListener("keydown", key, true);
    return () => removeEventListener("keydown", key, true);
  }, [open]);

  if (!state || !ps || !log) {
    return <div className="fixed inset-0 grid place-items-center bg-void"><Loading label="Opening the Resting Bay" /></div>;
  }

  const tier = Math.min(state.tier, MAX_TIER), planet = PLANETS_BY_TIER[tier], name = BODY_NAME[planet];
  const nextPlanet = tier < MAX_TIER ? BODY_NAME[PLANETS_BY_TIER[tier + 1]] : null;
  const waves = missionLength(tier) - 1, need = solvesToClear(tier), won = Math.min(state.mission.solved, waves);
  const all = state.cleared.includes(MAX_TIER);
  const who = cadet?.name ?? "cadet";
  const status = state.mission.passed && nextPlanet ? <>Mission won. Launch to fly on to <b>{inLine(nextPlanet)}</b>.</>
    : !nextPlanet ? (all ? <>You cleared every planet. The fleets out here keep growing.</> : <>The last frontier. The fleets out here keep growing.</>)
    : tier === 0 ? <>Your first mission. Win <b>both waves</b> to unlock {inLine(nextPlanet)}.</>
    : <>Your next mission. Win <b>{need} of {waves} waves</b> to unlock {inLine(nextPlanet)}.</>;
  const table = open === null ? null : ps.find((p) => p.table === open) ?? null;

  const switchCadet = async () => {
    if (leaving) return;
    setLeaving(true);
    await fetch("/api/player", { method: "DELETE" }).catch(() => null);
    router.push("/?new");
  };

  return (
    <div className="mw-bay fixed inset-0 overflow-y-auto overflow-x-hidden bg-void text-approach">
      <Stars />
      <TopBar left={<RingLogo />} title="Resting Bay" orbs={state.orbs} onHelp={onHelp ?? (() => setHelp(true))} />

      <main className="mw-bay-main">
        <section aria-labelledby="mission" className="mw-bay-hero">
          <MissionPlanet planet={planet} />
          <div className="mw-bay-mission">
            <h2 id="mission" className="m-0 type-display mw-bay-name">{name}</h2>
            <p className="mw-bay-status">{status}</p>
            {nextPlanet && <WaveDots total={waves} won={won} current={!state.mission.passed} className="mt-3.5" />}
            <PillLink href={`/play/${planet}`} variant="primary" size="lg" className="mw-bay-launch" aria-label={`Launch to ${inLine(name)}`}>
              <span>Launch<span className="mw-bay-launch-long"> to {inLine(name)}</span></span>
            </PillLink>
            {/* the daily patrol goes here (wave 3): one line and one secondary action under the mission */}
            <div data-slot="daily-patrol" className="empty:hidden">{typeof patrol === "function" ? patrol({ state, log, emit }) : patrol}</div>
            <NovaLine className="mw-bay-nova">{novaLine(state, log, who, !!first, name, ps)}</NovaLine>
          </div>
        </section>

        <section className="mw-bay-deck">
          <div className="mw-bay-tables">
            <h2 id="tables" className="m-0 mb-3 type-label text-ink-2">Your times tables</h2>
            <div role="group" aria-labelledby="tables" className="mw-bay-strip">
              {ps.map((p) => {
                const marks = p.cells.map((c) => LEVEL[c.band]);
                return (
                  <UiButton key={p.table} aria-expanded={open === p.table} aria-controls="facts"
                    aria-label={`The ${p.table}s: ${masterySummary(marks)}`}
                    onClick={() => setOpen((o) => (o === p.table ? null : p.table))}
                    className="mw-tile mw-bay-table">
                    <b className="type-number text-[20px] font-medium">×{p.table}</b>
                    <Pips marks={marks} />
                  </UiButton>
                );
              })}
            </div>
          </div>

          {table && (
            <div id="facts" className="mw-sheet mw-bay-facts" role="region" aria-labelledby="facts-title">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <h3 id="facts-title" className="m-0 type-display text-[28px]">The {table.table}s</h3>
                <MasteryKeyLegend />
              </div>
              <ol className="m-0 grid list-none grid-cols-5 gap-x-2 gap-y-3 p-0 lg:grid-cols-10">
                {table.cells.map((c) => {
                  const lv = LEVEL[c.band];
                  return (
                    <li key={c.n} className="flex flex-col items-center gap-1.5 py-1.5" aria-label={`${table.table} times ${c.n}${lv === "new" ? "" : ` is ${table.table * c.n}`}: ${MASTERY[lv].word}`}>
                      <span className="type-number text-[16px] text-ink-2" aria-hidden>{table.table} × {c.n}</span>
                      <span className={`type-number text-[24px] font-medium ${lv === "gold" ? "text-gold" : lv === "new" ? "text-ink-3" : ""}`} aria-hidden>{lv === "new" ? "?" : table.table * c.n}</span>
                      <MasteryMark level={lv} size={10} />
                    </li>
                  );
                })}
              </ol>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="m-0 type-body text-ink-2">{table.gold === 10 ? "All ten are Gold." : table.gold > 0 ? `${table.gold} of 10 are Gold.` : "Practise to start turning them Gold."}</p>
                <Button icon="cards" onClick={() => setDeck(table.table)}>Practise the {table.table}s</Button>
              </div>
            </div>
          )}

          <nav aria-labelledby="places" className="mw-bay-places">
            <h2 id="places" className="m-0 mb-3 type-label text-ink-2">Go to</h2>
            <div className="flex flex-wrap gap-2.5">
              <PillLink href="/map" icon="map">Star map</PillLink>
              <PillLink href="/hangar" icon="hangar">Hangar</PillLink>
              <PillLink href="/academy" icon="academy">Academy</PillLink>
            </div>
          </nav>
        </section>

        <div className="mw-bay-foot">
          <Button variant="quiet" size="sm" onClick={() => setAsking(true)}>Switch cadet</Button>
        </div>
      </main>

      <SheetDialog open={asking} onOpenChange={setAsking} size="sm" presentation="auto" title="Start as a new cadet?"
        description={<>This device will forget <b className="font-medium text-ink-1">{who}</b>. {who}&apos;s orbs and Gold facts cannot be brought back.</>}
        actions={<>
          <SheetClose className={`${buttonClass("primary", "md")} justify-center`}>Keep playing</SheetClose>
          <Button onClick={() => void switchCadet()} disabled={leaving} focusableWhenDisabled>New cadet</Button>
        </>} />

      <FieldManual open={help} onClose={() => setHelp(false)} topic="squads" seen={{ seen: state.seen, emit }} replayFrom="/bay" />

      {deck !== null && <Flashcards state={state} emit={emit} table={deck} onClose={() => setDeck(null)} />}
    </div>
  );
}
