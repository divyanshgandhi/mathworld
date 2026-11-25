"use client";
import { useState } from "react";
import { DailyPatrol, PatrolSlot, patrolSlotState, useClock } from "@/components/hub/DailyPatrol";
import { useCadet } from "@/components/hub/useCadet";
import { Button } from "@/components/kit";

const DAY = 86_400_000;
const SAMPLE = [{ a: 3, b: 8 }, { a: 4, b: 7 }, { a: 6, b: 6 }, { a: 2, b: 9 }, { a: 7, b: 5 }].map((f) => ({ ...f, key: `${f.a}x${f.b}`, band: "practicing" as const }));

/**
 * The review: the slot as it looks when facts are due, when today's patrol is done, and (an empty
 * box) when nothing is due. Below, this device's cadet with the clock shifted forward for choosing
 * facts only, so a real patrol can be played now. Its pay uses the real clock and the real fold.
 */
export function PatrolReview() {
  const { state, log, emit } = useCadet({ needIntro: false });
  const [shift, setShift] = useState(8);
  const clock = useClock(), now = clock + shift * DAY;
  return (
    <main className="min-h-dvh bg-void p-6 text-approach md:p-10">
      <div className="mx-auto flex max-w-[640px] flex-col gap-8">
        <h1 className="m-0 type-name text-2xl">Daily patrol: the bay slot</h1>
        <section className="flex flex-col gap-2"><h2 className="m-0 type-label text-ink-2">Facts due</h2><PatrolSlot slot={{ kind: "due", facts: SAMPLE }} /></section>
        <section className="flex flex-col gap-2"><h2 className="m-0 type-label text-ink-2">Done today</h2><PatrolSlot slot={{ kind: "done" }} /></section>
        <section className="flex flex-col gap-2"><h2 className="m-0 type-label text-ink-2">Nothing due (shows nothing)</h2><div className="min-h-6 rounded-panel border border-dashed border-line-1"><PatrolSlot slot={{ kind: "none" }} /></div></section>
        <section className="flex flex-col gap-3">
          <h2 className="m-0 type-label text-ink-2">This cadet, {shift} days from now (choosing facts only)</h2>
          <div className="flex gap-2">
            {[0, 1, 3, 8].map((d) => <Button key={d} size="sm" variant={d === shift ? "primary" : "secondary"} onClick={() => setShift(d)}>{d} days</Button>)}
          </div>
          {!state || !log ? <p className="m-0 type-body text-ink-3">Loading the cadet...</p> : (
            <>
              <p className="m-0 type-body text-ink-2">Slot state: {patrolSlotState(state, clock, now).kind}. Orbs: {state.orbs}.</p>
              <DailyPatrol state={state} log={log} emit={emit} now={now} />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
