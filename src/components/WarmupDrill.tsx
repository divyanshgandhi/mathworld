"use client";
import { Button } from "@ui-sdk/react/button";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EventInput } from "@/db/events";
import type { PlayerState } from "@/director/fold";
import { seeded } from "@/engine/util";
import { flushed } from "@/engine/outbox";
import { warmupRun, WARMUP_LENGTH, WARMUP_OF } from "@/rig/warmup";
import type { Warmup } from "@/worlds/space/warmup";
import { PauseMenu } from "./battle/PauseMenu";
import { ghost, glass, Keypad, lime } from "./battle/ui";
import { Icon, RocketGlyph } from "./kit/Icon";
import { useCadet } from "./hub/useCadet";
import { useScene } from "./hub/Scene";

const NAME = { mercury: "Mercury", venus: "Venus" } as const;

/**
 * Mercury (addition) and Venus (subtraction) warm-ups, up to 20: five quick sums on the battle
 * stage and keypad. Each answer appends `warmup_answered`; a first-try answer earns an Orb.
 */
export function WarmupDrill({ planet }: { planet: "mercury" | "venus" }) {
  const cadet = useCadet();
  if (!cadet.state) return <div className="fixed inset-0 bg-void" />;
  return <Drill planet={planet} state={cadet.state} emit={cadet.emit} />;
}

function Drill({ planet, state, emit }: { planet: "mercury" | "venus"; state: PlayerState; emit: (e: EventInput) => void }) {
  const router = useRouter();
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
  const shown = useRef(0);
  const dock = useRef<HTMLDivElement>(null), plate = useRef<HTMLDivElement>(null);
  const p = run[i];

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

  useEffect(() => {
    if (!drill) return;
    const measure = () => {
      const phone = window.innerWidth < 768, d = dock.current?.getBoundingClientRect(), pl = plate.current?.getBoundingClientRect();
      (drill as Warmup).setSafe({ top: (pl?.bottom ?? 130) + 40, right: !phone && d ? window.innerWidth - d.left + 8 : 0, bottom: phone && d ? window.innerHeight - d.top + 4 : 0 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [drill, started, i]);

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

  const sign = op === "add" ? "+" : "−", done = i >= WARMUP_LENGTH;
  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-void text-approach">
      <div ref={box} className="absolute inset-0" />
      <div className="absolute left-3 top-3 z-20"><PauseMenu label="Warm-up paused" /></div>
      <div className="pointer-events-none absolute right-16 top-3 z-10 hidden h-11 items-center gap-2 rounded-pill bg-void px-3 type-name type-number text-[17px] md:flex"><Icon name="orb" size={20} className="text-gold" />{state.orbs} <span className="text-[15px] text-ink-2">orbs</span></div>

      {started && p && !done && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center gap-2">
          <div ref={plate} className={`${glass} px-6 py-2 text-center md:px-8 md:py-3`} aria-live="polite">
            <p className="type-label-sm text-ink-2">{NAME[planet]} · warm-up {i + 1} of {WARMUP_LENGTH}</p>
            <p className="mt-1 type-display type-number text-5xl md:mt-2 md:text-7xl">{p.a}<span className="mx-3 text-ink-3">{sign}</span>{p.b}</p>
            <p className="mt-1.5 type-body-sm text-ink-2">{op === "add" ? <><b className="font-semibold text-approach">{p.a}</b> drones · <b className="font-semibold text-approach">{p.b}</b> more arrive</> : <><b className="font-semibold text-approach">{p.a}</b> drones · <b className="font-semibold text-approach">{p.b}</b> fly away</>}</p>
          </div>
          {outcome && (
            <div role="status" className={`flex items-center gap-2 rounded-pill border bg-void px-5 py-1.5 type-name type-number text-lg ${outcome.kind === "exact" ? "border-gold text-gold" : "border-ember text-ember"}`}>
              {outcome.kind === "exact" && <Icon name="check" size={20} />}{outcome.kind === "exact" ? "Dead on" : outcome.kind === "under" ? `${outcome.value} still flying` : `+${outcome.value} flew past`}
            </div>
          )}
        </div>
      )}

      {started && !done && (
        <div ref={dock} className={`${glass} absolute bottom-2 left-1/2 z-10 w-[min(96vw,340px)] -translate-x-1/2 p-2.5 md:bottom-auto md:left-auto md:right-5 md:top-1/2 md:w-[300px] md:-translate-y-1/2 md:translate-x-0 md:p-3`}>
          <Keypad onFire={(n) => void fire(n)} disabled={!ready} />
        </div>
      )}

      {!started && (
        <div className={`${glass} absolute inset-0 z-20 m-auto flex h-fit w-fit flex-col items-center gap-3 p-6 text-center`}>
          <p className="type-display text-4xl">{NAME[planet]}</p>
          <p className="type-label-sm text-ink-2">{op === "add" ? "Addition" : "Subtraction"} warm-up</p>
          <p className="type-child text-ink-2">Five quick ones, up to 20.</p>
          <Button className={`${lime} mw-md mw-has-glyph`} onClick={() => void start()}>Launch (sound on)<RocketGlyph size={34} /></Button>
        </div>
      )}
      {done && (
        <div className={`${glass} absolute inset-0 z-20 m-auto flex h-fit w-[min(92%,420px)] flex-col items-center gap-3 p-6 text-center`}>
          <p className="type-label-sm text-ink-2">{NAME[planet]}</p>
          <p className="type-display text-4xl">Warm-up done</p>
          <p className="flex items-center gap-2 type-child text-ink-2">{score} of {WARMUP_LENGTH} first try · <Icon name="orb" size={20} className="text-gold" />{state.orbs} orbs</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button className={`${lime} px-6 py-3 text-base`} onClick={() => void flushed().then(() => router.push("/map"))}>Solar map</Button>
            <Button className={`${ghost} px-5 py-3 text-base`} onClick={() => { setSeed((x) => x + 7); setI(0); setScore(0); setOutcome(null); }}>Again</Button>
          </div>
        </div>
      )}
    </div>
  );
}
