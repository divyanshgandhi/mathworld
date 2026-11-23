"use client";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Radio, RadioGroup, RadioIndicator } from "@ui-sdk/react/radio";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EventInput } from "@/db/events";
import type { LoggedEvent } from "@/director/fold";
import type { Stage } from "@/engine/stage";
import type { Bay, BayUi } from "@/worlds/space/cadetBay";
import type { Chapter, Film, FilmUi } from "@/worlds/space/intro";

declare global { interface Window { __mw?: { stage: Stage; film?: Film; bay?: Bay } } }

const AVATARS = [
  { id: "cadet-1", color: "#7ddc3e" }, { id: "cadet-2", color: "#38bdf8" }, { id: "cadet-3", color: "#ff8f70" },
  { id: "cadet-4", color: "#b79cff" }, { id: "cadet-5", color: "#f2c14e" }, { id: "cadet-6", color: "#ef6f8a" },
];
const CHAPTERS: [Chapter, string][] = [["orbit", "Earth"], ["dive", "Dive"], ["wake", "Classroom"], ["knock", "The knock"], ["hangar", "Hangar"]];
const btn = "rounded-xl px-4 py-2 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-lime-300 data-disabled:opacity-40";
const ghost = `${btn} border border-white/15 text-white/85 hover:border-white/40`;
const lime = `${btn} bg-lime-300 text-[#0d0e1a] hover:bg-lime-200`;

const post = (e: EventInput) => void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(e) }).catch(() => {});

/** The opening film and Level 0, in one canvas. The engine owns the frame; React owns the controls. */
export function IntroFilm() {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null), film = useRef<Film | null>(null), bay = useRef<Bay | null>(null);
  const [player, setPlayer] = useState<{ name: string; avatar: string } | null | undefined>(undefined);
  const [phase, setPhase] = useState<"gate" | "film" | "bay">("gate");
  const [ui, setUi] = useState<FilmUi | null>(null);
  const [bayUi, setBayUi] = useState<BayUi | null>(null);
  const [entry, setEntry] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("cadet-1");

  const startBay = useCallback(async () => {
    const s = stage.current;
    if (!s) return;
    film.current?.dispose();
    const { mountCadetBay } = await import("@/worlds/space/cadetBay");
    const history = await fetch("/api/events").then((r) => (r.ok ? r.json() : { events: [] })).then((j: { events: LoggedEvent[] }) => j.events.map(({ type, payload }) => ({ type, payload }) as LoggedEvent)).catch(() => []);
    bay.current = mountCadetBay(s, { onUi: setBayUi, onEvent: post, history });
    window.__mw = { stage: s, bay: bay.current };
    setEntry("");
    setPhase("bay");
  }, []);

  useEffect(() => {
    let gone = false, cleanup = () => {};
    (async () => {
      const [{ createStage }, { mountIntro }] = await Promise.all([import("@/engine/stage"), import("@/worlds/space/intro")]);
      if (gone || !box.current) return;
      const s = createStage(box.current);
      stage.current = s;
      film.current = mountIntro(s, { onUi: setUi, onEnd: () => void startBay() });
      window.__mw = { stage: s, film: film.current };
      cleanup = () => { film.current?.dispose(); bay.current?.dispose(); s.dispose(); };
    })();
    fetch("/api/player").then((r) => r.json()).then((j) => setPlayer(j.player)).catch(() => setPlayer(null));
    return () => { gone = true; cleanup(); };
  }, [startBay]);

  const begin = (n: string) => { film.current?.setName(n); film.current?.play(); setPhase("film"); };
  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/player", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, avatar }) });
    if (!res.ok) return;
    const j = await res.json();
    setPlayer(j.player);
    begin(j.player.name);
  };
  const switchCadet = async () => { await fetch("/api/player", { method: "DELETE" }); setPlayer(null); };

  const fire = useCallback(() => { if (entry !== "" && bayUi?.canFire) { void bay.current?.fire(Number(entry)); setEntry(""); } }, [entry, bayUi]);
  const press = useCallback((k: string) => {
    if (k === "Fire") return fire();
    if (k === "⌫") return setEntry((v) => v.slice(0, -1));
    setEntry((v) => (v === "0" ? k : (v + k).slice(0, 6)));
  }, [fire]);
  useEffect(() => {
    if (phase !== "bay") return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("⌫");
      else if (e.key === "Enter") { e.preventDefault(); press("Fire"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, press]);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Chapters">
        <span className="w-16 text-xs text-white/50">Jump to</span>
        {CHAPTERS.map(([c, label]) => (
          <Button key={c} className={`${ghost} ${ui?.chapter === c && phase === "film" ? "border-lime-300 text-lime-200" : ""}`} disabled={!player} onClick={() => { film.current?.setName(player?.name ?? ""); film.current?.jump(c); setPhase("film"); }}>{label}</Button>
        ))}
        <Button className={`${ghost} ${phase === "bay" ? "border-lime-300 text-lime-200" : ""}`} disabled={!player || phase === "bay"} onClick={() => void startBay()}>Cadet Bay</Button>
      </div>

      <div ref={box} className="relative w-full overflow-hidden rounded-xl bg-black">
        {phase === "gate" && player === null && (
          <form onSubmit={signUp} className="absolute inset-0 z-10 m-auto flex h-fit w-[min(92%,420px)] flex-col gap-4 rounded-2xl border border-white/10 bg-[#0d0e1a]/85 p-6 backdrop-blur">
            <p className="font-mono text-xs tracking-[0.3em] text-lime-300">CADET SIGN-UP</p>
            <Field name="name">
              <FieldLabel className="text-sm text-white/70">Your name</FieldLabel>
              <Input required maxLength={24} value={name} onValueChange={setName} autoComplete="given-name" className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-lg outline-none focus:border-lime-300" />
            </Field>
            <Field name="avatar">
              <FieldLabel className="text-sm text-white/70">Pick your colour</FieldLabel>
              <RadioGroup value={avatar} onValueChange={(v) => setAvatar(String(v))} className="mt-2 flex gap-3">
                {AVATARS.map((a) => (
                  <label key={a.id} data-slot="label" className="cursor-pointer">
                    <Radio value={a.id} aria-label={a.id} className="grid size-10 place-items-center rounded-full border-2 border-transparent outline-none data-checked:border-white focus-visible:ring-2 focus-visible:ring-lime-300" style={{ background: a.color }}>
                      <RadioIndicator className="size-2.5 rounded-full bg-white" />
                    </Radio>
                  </label>
                ))}
              </RadioGroup>
            </Field>
            <Button type="submit" className={lime} disabled={!name.trim()}>▶ Start the intro (sound on)</Button>
          </form>
        )}
        {phase === "gate" && player && (
          <div className="absolute inset-0 z-10 m-auto flex h-fit w-fit flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[#0d0e1a]/80 p-6 backdrop-blur">
            <p className="text-white/80">Welcome back, <b className="text-white">{player.name}</b></p>
            <Button className={lime} onClick={() => begin(player.name)}>▶ Play the intro (sound on)</Button>
            <Button className="text-sm text-white/50 underline-offset-4 hover:underline" onClick={() => void switchCadet()}>Not you? Switch cadet</Button>
          </div>
        )}
        {phase === "film" && ui?.prompt?.stage === "raise" && (
          <div className="absolute inset-x-0 bottom-20 z-10 flex flex-col items-center gap-3">
            <span className="rounded-full bg-[#0d0e1a]/75 px-4 py-1 font-mono text-sm text-white/85">{ui.prompt.eq} · know it? Raise your hand</span>
            <Button aria-label="Raise your hand" className={`${lime} px-6 py-3 text-base`} onClick={() => film.current?.raise()}>✋ Raise hand <kbd className="ml-2 rounded bg-black/15 px-1.5 text-xs">Space</kbd></Button>
          </div>
        )}
        {phase === "film" && ui?.prompt?.stage === "choose" && (
          <div className="absolute inset-x-0 bottom-20 z-10 flex flex-col items-center gap-3">
            <span className="rounded-full bg-[#0d0e1a]/75 px-4 py-1 font-mono text-sm text-white/85">{ui.prompt.eq}</span>
            <div className="flex gap-5" role="group" aria-label="Answer">
              {ui.prompt.options.map((v, i) => (
                <Button key={v} aria-label={`Answer ${v}`} className="size-20 rounded-full border-2 border-white/80 bg-[#0d0e1a]/60 text-3xl font-medium text-white outline-none transition hover:scale-105 hover:border-lime-300 hover:bg-lime-300 hover:text-[#0d0e1a] focus-visible:ring-2 focus-visible:ring-lime-300" onClick={() => film.current?.pick(v)}>
                  {v}<span className="sr-only"> (key {i + 1})</span>
                </Button>
              ))}
            </div>
          </div>
        )}
        {phase === "film" && ui?.cta && (
          <div className="absolute inset-x-0 bottom-24 z-10 flex justify-center">
            <Button className={`${lime} px-7 py-3 text-base shadow-[0_0_40px_rgba(182,242,58,.45)]`} onClick={() => film.current?.ignite()}>🚀 {ui.cta}</Button>
          </div>
        )}
        {phase === "bay" && bayUi?.wave && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg bg-[#0d0e1a]/70 px-3 py-1.5 font-mono text-xs tracking-wider text-white">{bayUi.wave.label.toUpperCase()}</div>
        )}
        {phase === "bay" && bayUi?.done && (
          <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center gap-3">
            <Button className={lime} onClick={() => { film.current = null; location.reload(); }}>↻ Play again</Button>
          </div>
        )}
      </div>

      {phase === "bay" && !bayUi?.done && (
        <div className="mx-auto flex w-full max-w-md flex-col gap-2">
          <div className="flex items-baseline justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2">
            <span className="text-xs text-white/50">Plasma balls</span>
            <output aria-live="polite" className="font-mono text-3xl">{entry || "0"}</output>
          </div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "Fire"].map((k) => (
              <Button key={k} aria-label={k === "⌫" ? "Delete" : k === "Fire" ? "Fire" : k} disabled={k === "Fire" && (!bayUi?.canFire || entry === "")}
                className={k === "Fire" ? `${lime} py-3 text-lg` : `${ghost} py-3 text-lg`} onClick={() => press(k)}>{k}</Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
