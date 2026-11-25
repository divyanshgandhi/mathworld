import Link from "next/link";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { Button } from "@ui-sdk/react/button";
import type { EventInput } from "@/db/events";
import type { EventRow, Player } from "@/db/schema";
import { fold, type LoggedEvent, type PlayerState } from "@/director/fold";
import { dayTwo, describe, masteryGrid, pct, sessions, tierProgress, transferReport, type DayTwo, type FactRow, type Rate } from "@/director/telemetry";
import { PLANET_NAMES } from "@/worlds/space/lines";
import { PLANETS_BY_TIER } from "@/rig/pools";
import { ghost, glass } from "@/components/battle/ui";

/** A calendar day in the server's time zone (the testing laptop's, when run locally). */
const localDay = (ms: number) => Math.floor((ms - new Date(ms).getTimezoneOffset() * 60_000) / 86_400_000);
const when = (ms: number) => new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const mins = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`);

interface Cadet { player: Player; log: LoggedEvent[]; times: number[]; s: PlayerState; report: ReturnType<typeof transferReport>; day2: DayTwo }

export function cadetOf(player: Player, rows: EventRow[], now: number): Cadet {
  const log = rows.map((r) => ({ type: r.type, payload: r.payload, at: r.createdAt.getTime() }) as LoggedEvent);
  const times = log.map((e) => e.at!);
  const s = fold(log);
  return { player, log, times, s, report: transferReport(s), day2: dayTwo(times, now, localDay) };
}

const DAY2: Record<DayTwo["status"], [string, string]> = {
  new: ["no play yet", "text-ink-3"], today: ["Day 1", "text-ink-2"], due: ["Day 2: not back yet", "text-gold"],
  missed: ["did not return", "text-ember"], returned: ["returned", "text-gold"],
};
function Day2({ d }: { d: DayTwo }) {
  const [label, tone] = DAY2[d.status];
  return <span className={tone}>{label}{d.status === "returned" ? ` · day ${d.day + 1}` : ""}</span>;
}
function RateCell({ r }: { r: Rate }) {
  return <span className="tabular-nums">{pct(r)} <span className="text-ink-3">({r.solved}/{r.n})</span></span>;
}

const BAND_BG = { unseen: "border border-line-1 text-ink-3", practicing: "border border-sky text-sky", understood: "bg-approach text-void", gold: "bg-gold text-void" } as const;
function Heatmap({ grid }: { grid: FactRow[][] }) {
  return (
    <table className="border-separate border-spacing-0.5 font-code text-xs" aria-label="Fact mastery, 0 to 10 times 0 to 10">
      <thead><tr><th className="w-7 text-ink-3">×</th>{grid[0].map((c) => <th key={c.b} scope="col" className="w-9 text-ink-3">{c.b}</th>)}</tr></thead>
      <tbody>
        {grid.map((row) => (
          <tr key={row[0].a}>
            <th scope="row" className="text-ink-3">{row[0].a}</th>
            {row.map((c) => (
              <td key={c.b} title={`${c.a} × ${c.b} · ${c.band}${c.seen ? ` · m ${c.m.toFixed(2)} · seen ${c.seen} · fast ${c.fastWins}` : ""}`}
                className={`h-8 w-9 rounded text-center tabular-nums ${BAND_BG[c.band]}`}>{c.seen ? Math.round(c.m * 100) : ""}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const th = "px-2 py-1.5 text-left font-code text-xs font-normal uppercase tracking-wider text-ink-3";
const td = "px-2 py-1.5 align-top";

/** The players table: one row per cadet, newest first. */
export function PlayerTable({ cadets, linkFor, selected }: { cadets: Cadet[]; linkFor: (id: string) => string; selected: string | null }) {
  return (
    <div className={`${glass} overflow-x-auto`}>
      <table className="w-full min-w-[860px] text-sm">
        <thead className="border-b border-line-1"><tr>
          {["Cadet", "Joined", "Last played", "Events", "Planet", "Transfer checks", "First try: before → after a lesson", "Day 2"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}
        </tr></thead>
        <tbody>
          {cadets.map(({ player, times, s, report, day2 }) => (
            <tr key={player.id} className={`border-b border-line-1 ${selected === player.id ? "bg-raised" : "hover:bg-raised"}`}>
              <td className={td}><Link href={linkFor(player.id)} className="font-medium text-gold underline-offset-2 hover:underline">{player.name}</Link></td>
              <td className={`${td} text-ink-2`}>{when(player.createdAt.getTime())}</td>
              <td className={`${td} text-ink-2`}>{times.length ? when(Math.max(...times)) : "—"}</td>
              <td className={`${td} tabular-nums`}>{times.length}</td>
              <td className={td}>{s.introCompleted ? PLANET_NAMES[PLANETS_BY_TIER[s.tier]] : "intro"}</td>
              <td className={td}><RateCell r={report.checks} /></td>
              <td className={td}><RateCell r={report.before} /> → <RateCell r={report.after} /></td>
              <td className={td}><Day2 d={day2} /></td>
            </tr>
          ))}
          {!cadets.length && <tr><td colSpan={8} className={`${td} py-6 text-center text-ink-3`}>No cadets yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/** One cadet in depth: mastery heatmap and planets, the transfer metric by trick, sessions and the event timeline. */
export function CadetDetail({ cadet, now }: { cadet: Cadet; now: number }) {
  const { player, log, times, s, report } = cadet;
  const runs = sessions(times), grid = masteryGrid(s), tiers = tierProgress(s);
  const recent = log.map((e, i) => ({ e, i })).reverse().slice(0, 300);
  return (
    <section className={`${glass} p-5`} aria-label={`Cadet ${player.name}`}>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h2 className="text-2xl font-semibold">{player.name}</h2>
        <p className="text-sm text-ink-2">{PLANET_NAMES[PLANETS_BY_TIER[s.tier]]} · {s.cleared.length} cleared{s.aceCleared.length ? ` · ${s.aceCleared.length} ace` : ""} · {s.waves} waves · {s.orbs} orbs · <Day2 d={cadet.day2} /></p>
      </div>
      <Tabs defaultValue="mastery">
        <TabsList aria-label="Cadet views" className="mb-4 inline-flex gap-1 rounded-xl bg-black/35 p-1">
          {[["mastery", "Fact mastery"], ["transfer", "Transfer rate"], ["timeline", "Event timeline"]].map(([v, l]) => (
            <TabsTab key={v} value={v} className="rounded-pill px-3 py-1.5 text-sm font-semibold text-ink-2 outline-none data-selected:bg-raised data-selected:text-approach data-selected:ring-1 data-selected:ring-approach">{l}</TabsTab>
          ))}
        </TabsList>

        <TabsPanel value="mastery" className="flex flex-wrap gap-8">
          <div>
            <p className="mb-2 font-code text-xs tracking-[0.2em] text-ink-3">0–10 × 0–10 · EWMA × 100 · blue outline practising · white understood · gold</p>
            <Heatmap grid={grid} />
          </div>
          <div className="min-w-[260px] flex-1">
            <p className="mb-2 font-code text-xs tracking-[0.2em] text-ink-3">PLANETS · FACTS MET · MEAN MASTERY · GOLD</p>
            <ul className="space-y-1.5 text-sm">
              {tiers.map((t) => (
                <li key={t.tier} className="flex items-center gap-3">
                  <span className={`w-28 ${s.cleared.includes(t.tier) ? "text-gold" : t.tier === s.tier ? "text-gold" : "text-ink-2"}`}>{PLANET_NAMES[PLANETS_BY_TIER[t.tier]]}</span>
                  <span className="relative h-2 w-28 overflow-hidden rounded-full bg-line-1"><span className="absolute inset-y-0 left-0 rounded-full bg-gold" style={{ width: `${Math.round((t.mean ?? 0) * 100)}%` }} /></span>
                  <span className="tabular-nums text-ink-2">{t.seen}{t.total ? `/${t.total}` : ""} · {t.mean === null ? "—" : t.mean.toFixed(2)} · {t.gold}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-3">Warm-ups {s.warmups.correct}/{s.warmups.answered} · Hyper-Jump streak {s.goldStreak} · transfer queue {s.transferQueue.map((q) => q.key).join(", ") || "empty"}</p>
          </div>
        </TabsPanel>

        <TabsPanel value="transfer">
          <p className="mb-3 max-w-2xl text-sm text-ink-2">North star: is a fleet solved on the first try (unassisted, or with a Power-Up) once its trick has been explained, against before? <b className="text-approach">Transfer checks</b> are the sister problems the director serves two waves after a Show Me How.</p>
          <table className="text-sm">
            <thead><tr>{["Trick", "Before a lesson", "After a lesson", "Transfer checks"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
            <tbody>
              <tr className="border-b border-line-1 font-semibold"><td className={td}>All tricks</td><td className={td}><RateCell r={report.before} /></td><td className={td}><RateCell r={report.after} /></td><td className={td}><RateCell r={report.checks} /></td></tr>
              {report.byTrick.map((t) => <tr key={t.trick}><td className={td}>{t.card}</td><td className={td}><RateCell r={t.before} /></td><td className={td}><RateCell r={t.after} /></td><td className={td}><RateCell r={t.checks} /></td></tr>)}
            </tbody>
          </table>
          <p className="mt-4 mb-1 font-code text-xs tracking-[0.2em] text-ink-3">SESSIONS (a gap over 30 min starts a new one)</p>
          <ul className="text-sm text-ink-2">{runs.map((r) => <li key={r.start}>{when(r.start)} · {mins(r.end - r.start)} · {r.events} events</li>)}</ul>
        </TabsPanel>

        <TabsPanel value="timeline">
          <p className="mb-2 font-code text-xs tracking-[0.2em] text-ink-3">NEWEST FIRST · {log.length} EVENTS{log.length > 300 ? " · LAST 300 SHOWN" : ""}</p>
          <ol className="max-h-[60vh] space-y-0.5 overflow-y-auto pr-2 font-code text-xs">
            {recent.map(({ e, i }) => (
              <li key={i} className="flex gap-3"><span className="w-16 shrink-0 text-ink-3">{clock(e.at!)}</span><span className="w-36 shrink-0 text-sky">{e.type}</span><span className="text-ink-2">{describe(e as EventInput)}</span></li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-ink-3">As of {when(now)}.</p>
        </TabsPanel>
      </Tabs>
    </section>
  );
}

export function SignOut() {
  return (
    <form method="post" action="/api/admin/session">
      <input type="hidden" name="logout" value="1" />
      <Button type="submit" className={`${ghost} px-3 py-1.5 text-xs`}>Lock</Button>
    </form>
  );
}
