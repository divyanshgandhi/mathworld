"use client";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from "@ui-sdk/react/drawer";
import { useEffect, useMemo, useState } from "react";
import { pct, xray, type FactRow } from "@/director/telemetry";
import type { Arena, ArenaUi } from "@/worlds/space/arena";

const BAND = { unseen: "bg-white/10 text-white/50", practicing: "bg-sky-400/25 text-sky-100", understood: "bg-emerald-400/25 text-emerald-100", gold: "bg-amber-300/30 text-amber-100" } as const;
const ERROR_NAME: Record<string, string> = {
  added_instead: "added instead of multiplied", off_by_one_group: "one squad off", off_by_one_unit: "a unit or two off", place_value: "place value",
  undershoot_close: "close, under", overshoot_close: "close, over", wild_guess: "wild guess",
};

function Bar({ m }: { m: number }) {
  return <span className="relative inline-block h-1.5 w-16 overflow-hidden rounded-full bg-white/10 align-middle"><span className="absolute inset-y-0 left-0 rounded-full bg-lime-300" style={{ width: `${Math.round(m * 100)}%` }} /></span>;
}
function Fact({ f, now }: { f: FactRow; now: boolean }) {
  return (
    <li className={`flex items-center justify-between gap-2 rounded-md px-2 py-0.5 ${now ? "bg-lime-300/10 ring-1 ring-lime-300/40" : ""}`}>
      <span className="w-16 tabular-nums">{f.a} × {f.b}</span>
      <Bar m={f.m} />
      <span className="w-10 text-right tabular-nums">{f.seen ? f.m.toFixed(2) : "—"}</span>
      <span className={`w-20 rounded px-1 text-center text-[10px] uppercase tracking-wider ${BAND[f.band]}`}>{f.band}</span>
    </li>
  );
}

/**
 * The hidden Live Telemetry X-Ray (Shift+D in battle, SPEC §7): per-fact EWMA, the error in play, the
 * transfer-check queue and the live Transfer Rate, read from the same event log the game folds.
 * Non-modal and docked left, so the cadet keeps playing while an adult watches. Not linked anywhere.
 */
export function XRay({ arena, ui }: { arena: Arena | null; ui: ArenaUi | null }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.shiftKey && (e.key === "D" || e.key === "d")) || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement)?.closest?.("input, textarea")) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // while it is open, the stage frames the fleet in the space right of the sheet (not on phones: it would vanish)
  useEffect(() => {
    if (!arena) return;
    const place = () => arena.setSafe({ left: open && window.innerWidth >= 768 ? Math.min(window.innerWidth * 0.92, 320) + 8 : 0 });
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [arena, open]);
  const wave = ui?.wave ?? null;
  // the log grows with every shot, and every shot changes `ui`: recompute when either the drawer opens or the HUD moves
  const x = useMemo(() => (open && arena ? xray(arena.log(), wave ? { a: wave.a, b: wave.b } : null) : null), [open, arena, ui]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // the drawer's fixed viewport needs a layer above the stage and the HUD
    <div className="relative z-30">
    <Drawer side="left" modal={false} dismissible={false} open={open} onOpenChange={setOpen}>
      <DrawerContent data-xray aria-label="Live Telemetry X-Ray" initialFocus="content"
        className="flex h-dvh w-[min(92vw,320px)] flex-col gap-3 overflow-y-auto border-r border-white/10 bg-[#070914]/90 p-4 font-mono text-[11px] text-white/85 outline-none backdrop-blur-md">
        <div className="flex items-baseline justify-between">
          <DrawerTitle className="text-xs tracking-[0.3em] text-lime-300">LIVE TELEMETRY X-RAY</DrawerTitle>
          <DrawerClose aria-label="Close X-Ray" className="rounded px-1.5 text-white/50 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-lime-300">✕</DrawerClose>
        </div>
        <DrawerDescription className="-mt-2 text-[10px] text-white/40">Shift+D · read from the event log, same fold as the game</DrawerDescription>
        {x && (
          <>
            <section className="grid grid-cols-3 gap-1.5 text-center">
              {[["tier", `${x.tier} · ${x.planet}`], ["mission", `${x.mission.solved}/${x.mission.inTier} · wave ${x.mission.waves}`], ["streaks", `gold ${x.goldStreak} · hard ${x.struggleStreak}`]].map(([k, v]) => (
                <div key={k} className="rounded-md bg-white/5 px-1 py-1.5"><p className="text-[9px] uppercase tracking-wider text-white/40">{k}</p><p className="mt-0.5 text-white">{v}</p></div>
              ))}
            </section>

            <section aria-label="Transfer Rate">
              <p className="mb-1 text-[10px] tracking-[0.2em] text-sky-200/80">TRANSFER RATE (sister problem after Show Me How)</p>
              <div className="flex gap-1.5 text-center">
                <div className="flex-1 rounded-md bg-sky-300/10 py-1.5"><p className="text-xl text-sky-100">{pct(x.session)}</p><p className="text-[9px] text-white/45">this session · {x.session.solved}/{x.session.n}</p></div>
                <div className="flex-1 rounded-md bg-white/5 py-1.5"><p className="text-xl">{pct(x.overall)}</p><p className="text-[9px] text-white/45">all time · {x.overall.solved}/{x.overall.n}</p></div>
              </div>
              <p className="mt-1 text-[10px] text-white/50">first try, trick not yet explained {pct(x.report.before)} ({x.report.before.n}) · after {pct(x.report.after)} ({x.report.after.n})</p>
            </section>

            <section aria-label="Error in play">
              <p className="mb-1 text-[10px] tracking-[0.2em] text-sky-200/80">ACTIVE ERROR</p>
              {x.activeError
                ? <p className="rounded-md bg-[#ff8f70]/15 px-2 py-1 text-[#ffc2b0]">{x.activeError.type} · {ERROR_NAME[x.activeError.type]}<br /><span className="text-white/55">{x.activeError.a} × {x.activeError.b} → {x.activeError.guess}</span></p>
                : <p className="text-white/40">none</p>}
            </section>

            <section aria-label="Transfer queue">
              <p className="mb-1 text-[10px] tracking-[0.2em] text-sky-200/80">TRANSFER QUEUE</p>
              {x.queue.length
                ? <ul className="space-y-0.5">{x.queue.map((q) => <li key={q.trick} className="flex justify-between"><span>{q.card}</span><span className="text-white/55">from {q.key.replace("x", " × ")} · {q.inWaves ? `in ${q.inWaves} wave${q.inWaves > 1 ? "s" : ""}` : "next"}</span></li>)}</ul>
                : <p className="text-white/40">empty</p>}
            </section>

            <section aria-label="Fact mastery">
              <p className="mb-1 text-[10px] tracking-[0.2em] text-sky-200/80">FACT EWMA (m₀ 0.25 · α 0.35)</p>
              {x.current && <p className="mb-1 text-white/55">on screen: try {x.current.attempts + 1} · fast under {(x.current.fastMs / 1000).toFixed(1)} s</p>}
              <ul className="space-y-0.5">{x.recent.map((f) => <Fact key={f.key} f={f} now={f.key === x.current?.key} />)}</ul>
            </section>
          </>
        )}
      </DrawerContent>
    </Drawer>
    </div>
  );
}
