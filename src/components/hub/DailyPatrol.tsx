"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import "./hub.css";
import "./patrol.css";
import { patrolDay, type EventInput } from "@/db/events";
import type { LoggedEvent, PlayerState } from "@/director/fold";
import type { PatrolFact } from "@/director/hub";
import { flushed } from "@/engine/outbox";
import { ORB_RULES } from "@/battle/rewards";
import type { Fact } from "@/rig/pools";
import { Button } from "../kit/Button";
import { Icon } from "../kit/Icon";
import { RestingBayScreen } from "../RestingBayScreen";
import { Flashcards, type CardResult } from "./Flashcards";
import { patrolPaid, patrolReport, patrolSlotState, type PatrolSlotState } from "./patrolSlot";

export { patrolPaid, patrolReport, patrolSlotState, type PatrolSlotState };

/** The bay's slot: one quiet line and one secondary action. Nothing at all when nothing is due. */
export function PatrolSlot({ slot, onStart }: { slot: PatrolSlotState; onStart?: () => void }) {
  if (slot.kind === "none") return null;
  if (slot.kind === "done") return <div className="mw-patrol-slot"><p className="mw-patrol-line">Patrol done. Come back tomorrow.</p></div>;
  const n = slot.facts.length;
  return (
    <div className="mw-patrol-slot">
      <p className="mw-patrol-line">
        <span>Daily patrol. {n} quick {n === 1 ? "fact" : "facts"}.</span>
        <span className="mw-patrol-pay"><Icon name="orb" size={18} className="text-gold" />{ORB_RULES.patrol.amount}<span className="sr-only"> orbs</span></span>
      </p>
      <Button onClick={onStart} aria-label={`Start patrol: ${n} quick ${n === 1 ? "fact" : "facts"}`}>Start patrol</Button>
    </div>
  );
}

type Save = { kind: "none" } | { kind: "saving" } | { kind: "paid"; orbs: number } | { kind: "failed" };

/**
 * The daily patrol on the bay: the slot, and the patrol itself as the flashcards sheet with the
 * due facts fixed when it opens (answers change what is due, so the list never moves under the
 * cadet). A miss comes back once at the end. At the end `patrol_completed` goes out exactly once,
 * after every answer (the outbox keeps order), and the end card shows what the server's log, folded,
 * really paid. `now` shifts only which facts are chosen (the /dev/patrol review); pay uses the real clock.
 */
export function DailyPatrol({ state, emit, now }: { state: PlayerState; log?: LoggedEvent[]; emit: (e: EventInput) => void; now?: number }) {
  const [facts, setFacts] = useState<PatrolFact[] | null>(null);
  const [save, setSave] = useState<Save>({ kind: "none" });
  const sent = useRef(false), day = useRef(0), report = useRef<Fact[]>([]);
  const clock = useClock();
  const slot = patrolSlotState(state, clock, now ?? clock);

  /** Ask the server what it paid for this day. */
  const check = useCallback(async () => {
    await flushed();
    const r = await fetch("/api/events").catch(() => null);
    const j = r?.ok ? ((await r.json().catch(() => null)) as { events: LoggedEvent[] } | null) : null;
    return j ? patrolPaid(j.events.map(({ type, payload }) => ({ type, payload }) as LoggedEvent), day.current) : null;
  }, []);

  const finish = useCallback(async (results: CardResult[]) => {
    if (sent.current) return;
    report.current = patrolReport(facts ?? [], results);
    if (!report.current.length) { setSave({ kind: "paid", orbs: 0 }); return; } // nothing right: no patrol to report, it stays open
    sent.current = true;
    day.current = patrolDay(Date.now());
    setSave({ kind: "saving" });
    emit({ type: "patrol_completed", payload: { day: day.current, facts: report.current } });
    const paid = await check();
    setSave(paid === null ? { kind: "failed" } : { kind: "paid", orbs: paid });
  }, [facts, emit, check]);

  const retry = async () => {
    if (save.kind !== "failed") return;
    setSave({ kind: "saving" });
    let paid = await check();
    if (paid === null) {
      await fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "patrol_completed", payload: { day: day.current, facts: report.current } } satisfies EventInput) }).catch(() => null);
      paid = await check();
    }
    setSave(paid === null ? { kind: "failed" } : { kind: "paid", orbs: paid });
  };

  const close = () => { setFacts(null); setSave({ kind: "none" }); sent.current = false; };

  return (
    <>
      <PatrolSlot slot={slot} onStart={() => { if (slot.kind === "due" && !facts) setFacts(slot.facts); }} />
      {facts && (
        <Flashcards state={state} emit={emit} onClose={close} facts={facts} title="Daily patrol" retryMisses progress="dots" greet={false}
          onFinish={(r) => void finish(r)} end={() => <PatrolEnd save={save} onRetry={retry} onDone={close} />} />
      )}
    </>
  );
}

/** The time now, read once and then each minute (so the slot follows the day rolling over). */
export function useClock() {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setT(Date.now()), 60_000); return () => window.clearInterval(id); }, []);
  return t;
}

/** The end card: "Patrol done." and what the ledger paid, or Saving..., or a plain failure with Try again. */
function PatrolEnd({ save, onRetry, onDone }: { save: Save; onRetry: () => void; onDone: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-10 text-center">
      <p className="m-0 type-display text-[clamp(44px,8vw,88px)]">Patrol done.</p>
      <div role="status" aria-live="polite" className="min-h-[56px] type-child">
        {save.kind === "saving" || save.kind === "none" ? <p className="m-0 text-ink-2">Saving...</p>
          : save.kind === "failed" ? (
            <div className="flex flex-col items-center gap-4">
              <p className="m-0 max-w-[30ch] text-ink-2">That did not save. Check the connection and try again.</p>
              <Button onClick={onRetry}>Try again</Button>
            </div>
          ) : save.orbs > 0 ? (
            <p className="m-0 flex items-center justify-center gap-2 type-number text-[32px] text-approach"><Icon name="orb" size={30} className="text-gold" />+{save.orbs}<span className="sr-only"> orbs</span></p>
          ) : <p className="m-0 max-w-[30ch] text-ink-2">Good practice. Get one right on the next patrol to earn orbs.</p>}
      </div>
      <Button variant="primary" size="lg" autoFocus onClick={onDone} className="w-full max-w-[360px] justify-between">Back to the bay</Button>
    </div>
  );
}

/** The Resting Bay with the daily patrol in its slot (mounted by /bay). */
export function RestingBayWithPatrol() {
  return <RestingBayScreen patrol={(c) => <DailyPatrol {...c} />} />;
}
