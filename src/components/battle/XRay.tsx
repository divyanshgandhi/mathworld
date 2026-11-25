"use client";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from "@ui-sdk/react/drawer";
import { useEffect, useMemo, useState } from "react";
import { pct, xray, type FactRow } from "@/director/telemetry";
import type { Arena, ArenaUi } from "@/worlds/space/arena";
import { Icon } from "@/components/kit/Icon";

const BAND = { unseen: "border border-line-1 text-ink-3", practicing: "border border-sky text-sky", understood: "bg-approach text-void", gold: "bg-gold text-void" } as const;
const ERROR_NAME: Record<string, string> = {
  added_instead: "added instead of multiplied", off_by_one_group: "one squad off", off_by_one_unit: "a unit or two off", place_value: "place value",
  undershoot_close: "close, under", overshoot_close: "close, over", wild_guess: "wild guess",
};

function Bar({ m }: { m: number }) {
  return <span className="relative inline-block h-1.5 w-16 overflow-hidden rounded-pill bg-line-1 align-middle"><span className="absolute inset-y-0 left-0 rounded-pill bg-gold" style={{ width: `${Math.round(m * 100)}%` }} /></span>;
}
function Fact({ f, now }: { f: FactRow; now: boolean }) {
  return (
    <li className={`flex items-center justify-between gap-2 rounded-md px-2 py-0.5 ${now ? "bg-raised ring-1 ring-gold/60" : ""}`}>
      <span className="w-16 tabular-nums">{f.a} × {f.b}</span>
      <Bar m={f.m} />
      <span className="w-10 text-right tabular-nums">{f.seen ? f.m.toFixed(2) : "—"}</span>
      <span className={`w-24 rounded-[6px] px-1 text-center text-xs ${BAND[f.band]}`}>{f.band}</span>
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
        className="flex h-dvh w-[min(92vw,340px)] flex-col gap-3 overflow-y-auto border-r border-line-1 bg-panel p-4 type-number text-xs text-ink-2 outline-none">
        <div className="flex items-baseline justify-between">
          <DrawerTitle className="type-label-sm text-gold">Live telemetry X-Ray</DrawerTitle>
          <DrawerClose aria-label="Close X-Ray" className="mw-btn mw-icon"><Icon name="close" size={18} /></DrawerClose>
        </div>
        <DrawerDescription className="-mt-2 text-xs text-ink-3">Shift+D · read from the event log, same fold as the game</DrawerDescription>
        {x && (
          <>
            <section className="grid grid-cols-3 gap-1.5 text-center">
              {[["tier", `${x.tier} · ${x.planet}`], ["mission", `${x.mission.solved}/${x.mission.inTier} · wave ${x.mission.waves}`], ["streaks", `gold ${x.goldStreak} · hard ${x.struggleStreak}`]].map(([k, v]) => (
                <div key={k} className="rounded-[8px] border border-line-1 px-1 py-1.5"><p className="text-xs text-ink-3">{k}</p><p className="mt-0.5 text-approach">{v}</p></div>
              ))}
            </section>

            <section aria-label="Transfer Rate">
              <p className="mb-1 type-label-sm text-sky">TRANSFER RATE (sister problem after Show Me How)</p>
              <div className="flex gap-1.5 text-center">
                <div className="flex-1 rounded-[8px] border border-sky/50 py-1.5"><p className="text-xl text-sky">{pct(x.session)}</p><p className="text-xs text-ink-3">this session · {x.session.solved}/{x.session.n}</p></div>
                <div className="flex-1 rounded-[8px] border border-line-1 py-1.5"><p className="text-xl text-approach">{pct(x.overall)}</p><p className="text-xs text-ink-3">all time · {x.overall.solved}/{x.overall.n}</p></div>
              </div>
              <p className="mt-1 text-xs text-ink-3">first try, trick not yet explained {pct(x.report.before)} ({x.report.before.n}) · after {pct(x.report.after)} ({x.report.after.n})</p>
            </section>

            <section aria-label="Error in play">
              <p className="mb-1 type-label-sm text-sky">ACTIVE ERROR</p>
              {x.activeError
                ? <p className="rounded-[8px] border border-ember/60 px-2 py-1 text-ember">{x.activeError.type} · {ERROR_NAME[x.activeError.type]}<br /><span className="text-ink-2">{x.activeError.a} × {x.activeError.b}, answered {x.activeError.guess}</span></p>
                : <p className="text-ink-3">none</p>}
            </section>

            <section aria-label="Transfer queue">
              <p className="mb-1 type-label-sm text-sky">TRANSFER QUEUE</p>
              {x.queue.length
                ? <ul className="space-y-0.5">{x.queue.map((q) => <li key={q.trick} className="flex justify-between"><span>{q.card}</span><span className="text-ink-3">from {q.key.replace("x", " × ")} · {q.inWaves ? `in ${q.inWaves} wave${q.inWaves > 1 ? "s" : ""}` : "next"}</span></li>)}</ul>
                : <p className="text-ink-3">empty</p>}
            </section>

            <section aria-label="Fact mastery">
              <p className="mb-1 type-label-sm text-sky">FACT EWMA (m₀ 0.25 · α 0.35)</p>
              {x.current && <p className="mb-1 text-ink-3">on screen: try {x.current.attempts + 1} · fast under {(x.current.fastMs / 1000).toFixed(1)} s</p>}
              <ul className="space-y-0.5">{x.recent.map((f) => <Fact key={f.key} f={f} now={f.key === x.current?.key} />)}</ul>
            </section>
          </>
        )}
      </DrawerContent>
    </Drawer>
    </div>
  );
}
