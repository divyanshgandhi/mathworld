"use client";
import { Button } from "@ui-sdk/react/button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBus } from "@/battle/bus";
import { Button as KitButton, IconButton } from "@/components/kit/Button";
import { Icon } from "@/components/kit/Icon";
import { FirstShotGuide } from "@/components/teach/FirstShotGuide";
import { ShipSprite } from "@/components/teach/ShipSprite";
import { memorySource, resetSeen } from "@/teach/seen";
import { GUIDE_FIRST_SHOT } from "@/teach/keys";
import { arrayLayout } from "@/teach/scenes";
import type { ArenaUi } from "@/worlds/space/arena";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "fire"] as const;

/**
 * A stand-in battle for reviewing the guided first shot: a fleet, the question, and a console that
 * carries the same `data-guide` anchors the real console will ("question", "keypad", "fire", "help",
 * "powerups", "orbs"). A real event bus drives the guide exactly as `arena.bus` would.
 * `?fleet=0` drops the fleet anchor, so the guide falls back to the free part of the screen.
 */
export function MockConsole() {
  const [bus] = useState(createBus);
  const [source] = useState(() => memorySource());
  const [run, setRun] = useState(0);
  const [entry, setEntry] = useState("");
  const [ui, setUi] = useState<ArenaUi | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [fleetAnchor] = useState(() => typeof location === "undefined" || new URLSearchParams(location.search).get("fleet") !== "0");
  const a = 3, b = 4;

  // a wave flies in, then the keypad goes live (as the arena's `ready`)
  useEffect(() => {
    resetSeen([GUIDE_FIRST_SHOT]);
    const base = { wave: { a, b, role: "tutorial", index: 0, of: 3, flipped: false, sectorLock: false }, lesson: null, done: null, offer: null, outcome: null } as unknown as ArenaUi;
    const t0 = setTimeout(() => { setUi({ ...base, canFire: false }); setResult(null); setEntry(""); }, 0);
    const t1 = setTimeout(() => { setUi({ ...base, canFire: true }); bus.emit("ready", {}); }, 750);
    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, [bus, run]);

  const setCharge = useCallback((v: string) => { setEntry(v); bus.emit("charge", { n: v === "" ? null : Number(v) }); }, [bus]);
  const fire = useCallback(() => {
    if (!ui?.canFire || entry === "") return;
    const n = Number(entry);
    bus.emit("fire", { n, a, b, planet: "earth", latencyMs: 0, attempt: 1, radar: false, usedRadar: false, errorType: null, powerUp: null, isTransferCheck: false, waveRole: "tutorial" });
    setUi((u) => (u ? { ...u, canFire: false } : u));
    setCharge("");
    setTimeout(() => {
      bus.emit("resolved", { correct: n === a * b, n, product: a * b, attempt: 1 });
      setResult(n === a * b ? "Dead on" : n < a * b ? `${a * b - n} still flying` : `+${n - a * b} flew past`);
      setUi((u) => (u ? { ...u, canFire: true } : u));
    }, 1200);
  }, [ui, entry, bus, setCharge]);
  const press = useCallback((k: (typeof KEYS)[number]) => {
    if (k === "fire") return fire();
    if (k === "del") return setCharge(entry.slice(0, -1));
    setCharge((entry === "0" ? k : entry + k).slice(0, 4));
  }, [entry, fire, setCharge]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!ui?.wave) return;
      if (/^\d$/.test(e.key)) press(e.key as (typeof KEYS)[number]);
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter") { e.preventDefault(); press("fire"); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [press, ui]);

  const ships = useMemo(() => arrayLayout(a, b, { cell: 44, gap: 12, squadGap: 18, cx: 0, top: 0 }), []);

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-void text-approach">
      {/* the fleet, framed in the free space: above the dock on a phone, left of it on a wide screen */}
      <div className="absolute inset-x-0 bottom-[calc(380px+12px)] top-[150px] flex items-center justify-center md:bottom-0 md:right-[340px]">
        <div data-guide={fleetAnchor ? "fleet" : undefined} className="relative" style={{ width: 4 * 44 + 3 * 12, height: 3 * 44 + 2 * 18 }} role="img" aria-label={`${a} squads of ${b} ships`}>
          {ships.map((s) => (
            <ShipSprite key={s.i} kind={s.leader ? "leader" : "invader"} tone={s.tone} size={44} alt="" className="absolute" style={{ left: s.x - 22 + (4 * 44 + 3 * 12) / 2, top: s.y - 22 }} />
          ))}
        </div>
      </div>

      <div data-guide="question" className="mw-sheet absolute left-1/2 top-3 -translate-x-1/2 px-6 py-2 text-center">
        <p className="m-0 type-label-sm text-ink-2">Cadet Bay · Wave 1 of 3</p>
        <p className="m-0 type-display type-number text-5xl md:text-6xl">{a}<span className="mx-3 text-ink-3">×</span>{b}</p>
        {result && <p role="status" className="m-0 type-name text-gold">{result}</p>}
      </div>
      <div className="absolute left-3 top-3"><IconButton icon="menu" label="Menu" /></div>
      <div data-guide="orbs" className="absolute right-3 top-3 hidden h-11 items-center gap-2 type-name type-number text-[17px] md:flex"><Icon name="orb" size={20} className="text-gold" />0 <span className="text-ink-2">orbs</span></div>

      <div className="mw-sheet absolute bottom-2 left-1/2 w-[min(96vw,340px)] -translate-x-1/2 p-2 md:bottom-5 md:left-auto md:right-5 md:w-[300px] md:translate-x-0 md:p-3">
        <div data-guide="powerups" className="mb-2 flex gap-1.5">
          <KitButton size="sm" icon="trick" disabled={!ui?.canFire}>Flip It!</KitButton>
        </div>
        <div className="mb-2 flex gap-1.5">
          <output aria-label="Plasma balls loaded" className="flex min-h-11 flex-1 items-center justify-between rounded-chip border border-line-1 px-3 type-number text-[30px] font-medium">
            <Icon name="plasma" size={18} className="text-ink-3" />{entry || "0"}
          </output>
          <span data-guide="help"><KitButton size="sm" icon="help" disabled={!ui?.canFire}>Show Me How</KitButton></span>
        </div>
        <div data-guide="keypad" role="group" aria-label="Keypad" className="grid grid-cols-3 gap-1.5">
          {KEYS.map((k) => k === "fire" ? (
            <Button key={k} data-guide="fire" aria-label="Fire" disabled={entry === "" || !ui?.canFire} onClick={() => press(k)} className="mw-btn mw-primary mw-sm min-h-12 justify-center type-number">Fire{entry ? ` ${entry}` : ""}</Button>
          ) : (
            <Button key={k} aria-label={k === "del" ? "Delete" : k} onClick={() => press(k)} className="mw-btn mw-secondary min-h-12 rounded-chip px-0 type-number text-[22px] font-medium">{k === "del" ? <Icon name="delete" size={22} /> : k}</Button>
          ))}
        </div>
        <KitButton variant="quiet" size="sm" className="mt-1 w-full justify-center" onClick={() => setRun((r) => r + 1)}>Replay the guide</KitButton>
      </div>

      <FirstShotGuide key={run} ui={ui} bus={bus} seen={source} />
    </div>
  );
}
