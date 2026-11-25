"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import "./hub.css";
import "./patrol.css";
import { patrolDay, type EventInput } from "@/db/events";
import type { LoggedEvent, PlayerState } from "@/director/fold";
import type { PatrolFact } from "@/director/hub";
import { flushed, onSaveState, saveState } from "@/engine/outbox";
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
/** The bay's emit: the outbox's promise back (true once stored, false if rejected for good). */
export type PatrolEmit = (e: EventInput, o?: { afterSave?: boolean }) => Promise<boolean>;

/**
 * The daily patrol on the bay: the slot, and the patrol itself as the flashcards sheet with the
 * due facts fixed when it opens (answers change what is due, so the list never moves under the
 * cadet). A miss comes back once at the end. At the end `patrol_completed` goes out exactly once
 * through the outbox (after every answer, the outbox keeps order; retried with the same id until it
 * is stored, so it is never lost and never paid twice), and it joins the bay's log only once the
 * server has stored it: the bay never says "Patrol done." or shows the pay before then. The end card
 * shows what the server's log, folded, really paid. `now` shifts only which facts are chosen (the
 * /dev/patrol review); pay uses the real clock.
 */
export function DailyPatrol({ state, emit, now }: { state: PlayerState; log?: LoggedEvent[]; emit: PatrolEmit; now?: number }) {
  const [facts, setFacts] = useState<PatrolFact[] | null>(null);
  const [save, setSave] = useState<Save>({ kind: "none" });
  const sent = useRef(false), day = useRef(0), report = useRef<Fact[]>([]);
  /** The report's save, and whether the server rejected it (then Try again sends it again). */
  const stored = useRef<Promise<boolean> | null>(null), rejected = useRef(false), turn = useRef(0);
  const clock = useClock();
  const slot = patrolSlotState(state, clock, now ?? clock);

  /** Ask the server what it paid for this day, or null when its log cannot be read. */
  const check = useCallback(async () => {
    await flushed();
    const r = await fetch("/api/events").catch(() => null);
    const j = r?.ok ? ((await r.json().catch(() => null)) as { events: LoggedEvent[] } | null) : null;
    return j ? patrolPaid(j.events.map(({ type, payload }) => ({ type, payload }) as LoggedEvent), day.current) : null;
  }, []);

  const send = useCallback(() => {
    rejected.current = false;
    stored.current = emit({ type: "patrol_completed", payload: { day: day.current, facts: report.current } }, { afterSave: true });
  }, [emit]);

  /** Wait for the report to be stored, then read what it paid. A newer turn (Try again, closing) wins. */
  const settle = useCallback(async () => {
    const t = ++turn.current;
    setSave({ kind: "saving" });
    const ok = await stored.current;
    if (t !== turn.current) return;
    if (!ok) { rejected.current = true; setSave({ kind: "failed" }); return; }
    const paid = await check();
    if (t === turn.current) setSave(paid === null ? { kind: "failed" } : { kind: "paid", orbs: paid });
  }, [check]);

  // while it saves, a failed try shows at once (the outbox keeps retrying; a later success still lands)
  useEffect(() => {
    if (save.kind !== "saving") return;
    const look = () => { if (saveState() === "waiting") setSave((s) => (s.kind === "saving" ? { kind: "failed" } : s)); };
    look();
    return onSaveState(look);
  }, [save.kind]);

  const finish = useCallback(async (results: CardResult[]) => {
    if (sent.current) return;
    report.current = patrolReport(facts ?? [], results);
    if (!report.current.length) { setSave({ kind: "paid", orbs: 0 }); return; } // nothing right: no patrol to report, it stays open
    sent.current = true;
    day.current = patrolDay(Date.now());
    send();
    await settle();
  }, [facts, send, settle]);

  const retry = () => {
    if (save.kind !== "failed") return;
    if (rejected.current) send(); // the server refused it: send it again (a day already paid is never paid twice)
    void settle();
  };

  const close = () => { turn.current++; setFacts(null); setSave({ kind: "none" }); sent.current = false; };

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

/** The end card: "Patrol done." and what the ledger paid once it is saved; until then Saving..., or a plain "not saved yet" with Try again. */
function PatrolEnd({ save, onRetry, onDone }: { save: Save; onRetry: () => void; onDone: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-10 text-center">
      <p className="m-0 type-display text-[clamp(44px,8vw,88px)]">{save.kind === "paid" ? "Patrol done." : "Last card done."}</p>
      <div role="status" aria-live="polite" className="min-h-[56px] type-child">
        {save.kind === "saving" || save.kind === "none" ? <p className="m-0 text-ink-2">Saving...</p>
          : save.kind === "failed" ? (
            <div className="flex flex-col items-center gap-4">
              <p className="m-0 max-w-[30ch] text-ink-2">Not saved yet. Check the connection and try again.</p>
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
