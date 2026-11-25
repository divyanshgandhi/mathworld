import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { currentCadet } from "@/app/api/cadet";
import { OrbLedger } from "@/components/admin/Dashboard";
import { patrolDay } from "@/db/events";
import { listEvents } from "@/db/store";
import { fold, type LoggedEvent } from "@/director/fold";
import { patrol, patrolDone } from "@/director/hub";

export const metadata: Metadata = { title: "Economy review · Math World", robots: { index: false } };

/** This device's cadet and their folded log, as of now (the clock is read here, at request time). */
async function load() {
  await connection();
  const { db, player } = await currentCadet();
  if (!player) return null;
  const log = (await listEvents(db, player.id)).map((r) => ({ type: r.type, payload: r.payload, at: r.createdAt.getTime() }) as LoggedEvent);
  return { player, log, now: Date.now() };
}

/** This device's cadet: their orb ledger (the same view /admin shows) and today's patrol. Dev only. */
async function Review() {
  const got = await load();
  if (!got) return <p className="p-8 type-body text-ink-2">No cadet on this device yet.</p>;
  const { player, log, now } = got, s = fold(log), due = patrol(s, now);
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 md:p-10">
      <h1 className="type-name text-2xl">{player.name}: orbs</h1>
      <OrbLedger s={s} log={log} />
      <p className="type-body text-ink-2">
        Daily patrol: {patrolDone(s, patrolDay(now)) ? "done today" : due ? `due, ${due.map((f) => `${f.a} × ${f.b}`).join(", ")}` : "nothing due"}.
      </p>
    </main>
  );
}

export default function EconomyReviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="min-h-dvh bg-void text-approach">
      <Suspense fallback={<p className="p-8 type-body text-ink-3">Loading…</p>}>
        <Review />
      </Suspense>
    </div>
  );
}
