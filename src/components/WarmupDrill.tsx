"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { EventInput } from "@/db/events";
import type { PlayerState } from "@/director/fold";
import { seeded } from "@/engine/util";
import { flushed } from "@/engine/outbox";
import { warmupRun, WARMUP_LENGTH, WARMUP_OF } from "@/rig/warmup";
import type { Warmup } from "@/worlds/space/warmup";
import { BriefingCard, ClearCard, PLANET_TEACHES } from "./battle/Cards";
import { missLine, useCockpitSafe, type Safe } from "./battle/BattleHud";
import { Console, EmptySlot, useEntry } from "./battle/Console";
import { useConsoleLayout, useReducedMotion } from "./battle/layout";
import { MissionStrip, useOrbReward } from "./battle/MissionStrip";
import { PauseMenu, usePauseWhenHidden } from "./battle/PauseMenu";
import { hold } from "./battle/pause";
import { css } from "./battle/cockpit";
import { Button } from "./kit/Button";
import { Icon } from "./kit/Icon";
import { useCadet } from "./hub/useCadet";
import { useScene } from "./hub/Scene";

const NAME = { mercury: "Mercury", venus: "Venus" } as const;
const DRONES = { one: "drone", many: "drones" };

/**
 * Mercury (adding) and Venus (taking away) warm-ups, up to 20: five quick sums on the battle stage,
 * with the battle's own cockpit (the mission strip and the console). Each answer appends
 * `warmup_answered`; a first-try answer earns an orb.
 */
export function WarmupDrill({ planet }: { planet: "mercury" | "venus" }) {
  const cadet = useCadet();
  if (!cadet.state) return <div className={css.root} />;
  return <Drill planet={planet} state={cadet.state} emit={cadet.emit} />;
}

function Drill({ planet, state, emit }: { planet: "mercury" | "venus"; state: PlayerState; emit: (e: EventInput) => void }) {
  const router = useRouter();
  const layout = useConsoleLayout();
  const reduced = useReducedMotion();
  const paused = useSyncExternalStore(hold.subscribe, () => hold.has("menu"), () => false);
  usePauseWhenHidden();
  useEffect(() => () => hold.clear(), []);
  const op = WARMUP_OF[planet];
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const run = useMemo(() => warmupRun(op, seeded(seed + 1)), [op, seed]);
  const [style] = useState(() => state.equipped);
  const { box, scene: drill } = useScene(async (stage) => {
    const { mountWarmup } = await import("@/worlds/space/warmup");
    return mountWarmup(stage, planet, style);
  }, [planet]);
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [ready, setReady] = useState(false);
  const [tries, setTries] = useState(0);
  const [outcome, setOutcome] = useState<{ kind: "exact" | "under" | "over"; value: number } | null>(null);
  const [score, setScore] = useState(0);
  const [startOrbs] = useState(state.orbs);
  const shown = useRef(0);
  const stripRef = useRef<HTMLDivElement>(null), conRef = useRef<HTMLDivElement>(null), orbsRef = useRef<HTMLDivElement>(null), rootRef = useRef<HTMLDivElement>(null);
  const p = run[i];
  const done = i >= WARMUP_LENGTH;

  const start = async () => {
    const { audio } = await import("@/engine/audio");
    audio.unlock();
    audio.mood("battle");
    setStarted(true);
  };
  // from the map, sound is already on: go straight in
  useEffect(() => { void import("@/engine/audio").then(({ audio }) => { if (audio.context?.state === "running") void start(); }); }, []);

  useEffect(() => {
    if (!drill || !started || !p) return;
    (drill as Warmup).load(p);
    const t = window.setTimeout(() => { setReady(true); shown.current = performance.now(); }, p.op === "sub" ? 1500 : 900);
    return () => window.clearTimeout(t);
  }, [drill, started, p]);

  const apply = useMemo(() => drill ? (s: Omit<Safe, "left">) => (drill as Warmup).setSafe(s) : null, [drill]);
  const centre = useCockpitSafe(layout, stripRef, conRef, apply);
  const cardOpen = !started || done;
  useEffect(() => { if (!cardOpen && !paused) rootRef.current?.focus({ preventScroll: true }); }, [cardOpen, paused]);

  const fire = async (n: number) => {
    if (!drill || !ready || !p) return;
    setReady(false); setOutcome(null);
    const latencyMs = Math.round(performance.now() - shown.current);
    emit({ type: "warmup_answered", payload: { op: p.op, a: p.a, b: p.b, guess: n, latencyMs } });
    const o = await (drill as Warmup).fire(n);
    setOutcome(o);
    if (o.kind === "exact") {
      if (tries === 0) { setScore((s) => s + 1); emit({ type: "orb_earned", payload: { amount: 1, reason: "warmup" } }); }
      await new Promise((r) => setTimeout(r, 900));
      setTries(0); setOutcome(null);
      if (i + 1 >= WARMUP_LENGTH) { (drill as Warmup).clear(); setI(WARMUP_LENGTH); return; }
      setI(i + 1);
      return;
    }
    setTries((t) => t + 1);
    shown.current = performance.now();
    setReady(true);
  };
  const live = started && !done && ready && !paused;
  const { entry, press, set } = useEntry({ maxDigits: 3, live, onFire: (n) => { void fire(n); } });
  useEffect(() => { set(""); }, [i, set]);
  const orbs = useOrbReward(state.orbs, orbsRef, centre, { reduced, still: cardOpen });

  const sign = op === "add" ? "+" : "−";
  let lineA: ReactNode = null;
  if (outcome?.kind === "exact") lineA = <span className={css.exact}><Icon name="check" size={20} className={css.icon} />Exactly right{tries === 0 ? <> · <b>+1</b> orb</> : null}</span>;
  else if (outcome) lineA = <span className={css.miss}>{missLine(outcome.kind, outcome.value, DRONES)}</span>;
  const lineB: ReactNode = p && !done ? (op === "add"
    ? <><b>{p.a}</b> {p.a === 1 ? "drone" : "drones"}, and <b>{p.b}</b> more {p.b === 1 ? "flies" : "fly"} in</>
    : <><b>{p.a}</b> {p.a === 1 ? "drone" : "drones"}, and <b>{p.b}</b> {p.b === 1 ? "flies" : "fly"} away</>) : null;

  return (
    <div ref={rootRef} className={css.root} data-cockpit tabIndex={-1} inputMode="none">
      <div ref={box} className="absolute inset-0" />
      <MissionStrip layout={layout} stripRef={stripRef} orbsRef={orbsRef} orbs={orbs}
        menu={<PauseMenu label="Paused" />}
        dots={started ? { total: WARMUP_LENGTH, won: Math.min(i, WARMUP_LENGTH), current: !done } : null}
        question={started && p && !done ? { a: p.a, b: p.b, op: sign } : null}
        lines={[lineA, lineB]} />
      <Console layout={layout} consoleRef={conRef} entry={entry} live={live} onKey={press} help={null}
        slots={<><EmptySlot /><EmptySlot /><EmptySlot /></>} />
      <p className={css.srOnly} aria-live="polite">{entry === "" ? "" : `${entry} plasma balls loaded`}</p>

      <BriefingCard open={!started} body={planet} name={NAME[planet]} teaches={PLANET_TEACHES[planet]} win="Five quick ones." onLaunch={() => void start()} />
      <ClearCard open={done} body={planet} title="Warm-up done" orbs={state.orbs - startOrbs}
        sub={`${score} of ${WARMUP_LENGTH} on the first try.`}
        actions={<>
          <Button variant="primary" size="md" data-primary className="w-full justify-between" onClick={() => void flushed().then(() => router.push("/map"))}>Star map</Button>
          <div className={css.cardRow}>
            <Button variant="secondary" size="md" icon="play" onClick={() => { setSeed((x) => x + 7); setI(0); setScore(0); setOutcome(null); }}>Again</Button>
            <Button variant="secondary" size="md" icon="bay" onClick={() => void flushed().then(() => router.push("/bay"))}>Resting Bay</Button>
          </div>
        </>} />
    </div>
  );
}
