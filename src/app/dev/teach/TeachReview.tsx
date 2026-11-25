"use client";
import { useState } from "react";
import { Button, PillLink } from "@/components/kit/Button";
import { NovaLine } from "@/components/kit/Brand";
import { FieldManual } from "@/components/teach/FieldManual";
import { Greeting } from "@/components/teach/Greeting";
import { ManualPicture } from "@/components/teach/ManualScenes";
import { ShipSprite } from "@/components/teach/ShipSprite";
import { GREETINGS, GREET_SCREENS, type GreetScreen } from "@/teach/greetings";
import { GUIDE_LINES } from "@/teach/guide";
import { MANUAL_PAGES, type ManualTopic } from "@/teach/manual";
import { memorySource, resetSeen } from "@/teach/seen";
import { SHIP_KINDS, type ShipKind, type ShipTone } from "@/teach/shipKinds";
import { readMs, words } from "@/teach/words";

/** Two frames that each run the mock console in their own viewport, so the guide measures as in a game. */
const SPRITES = SHIP_KINDS.flatMap<{ k: ShipKind; t?: ShipTone }>((k) =>
  k === "invader" || k === "leader" || k === "pod" ? (["ember", "apricot"] as const).map((t) => ({ k, t })) : [{ k }]);

const FRAMES = [
  { name: "Phone", w: 375, h: 812 },
  { name: "Small phone", w: 360, h: 640 },
  { name: "Desktop", w: 1440, h: 900 },
] as const;

export function TeachReview() {
  const [topic, setTopic] = useState<ManualTopic | null>(null);
  const [open, setOpen] = useState(false);
  const [greet, setGreet] = useState<{ screen: GreetScreen; n: number } | null>(null);
  const [source] = useState(() => memorySource());
  const play = (screen: GreetScreen) => { resetSeen([GREETINGS[screen].key]); setGreet((g) => ({ screen, n: (g?.n ?? 0) + 1 })); };

  return (
    <div className="min-h-dvh bg-void px-5 pb-24 pt-8 text-approach md:px-12">
      <h1 className="m-0 type-display text-[clamp(32px,5vw,56px)]">Teaching</h1>
      <p className="mt-3 max-w-[62ch] type-body text-ink-2">The Field Manual, Nova&apos;s first-visit greetings, the guided first shot and the ship sprites. Nothing here is saved.</p>

      <section className="mt-12" aria-labelledby="manual">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="manual" className="m-0 type-display text-[28px]">Field Manual</h2>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="secondary" icon="help" onClick={() => { setTopic(null); setOpen(true); }}>Open How to play</Button>
            <PillLink href="/manual?topic=fire" variant="quiet">/manual?topic=fire</PillLink>
          </div>
        </div>
        <ol className="m-0 mt-6 grid list-none gap-x-8 gap-y-10 p-0 md:grid-cols-2 xl:grid-cols-3">
          {MANUAL_PAGES.map((p, i) => (
            <li key={p.id} className="flex flex-col gap-3">
              <div className="rounded-panel border border-line-1 p-4"><ManualPicture scene={p.scene} active /></div>
              {p.lines.map((l) => <p key={l} className="m-0 type-child">{l}</p>)}
              <p className="m-0 flex flex-wrap items-center gap-3 type-body-sm text-ink-3">
                {i + 1}. manual:{p.id} · {p.lines.map((l) => words(l).length).join(" + ")} words
                <Button variant="quiet" size="sm" onClick={() => { setTopic(p.id); setOpen(true); }}>Open on this page</Button>
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16" aria-labelledby="greetings">
        <h2 id="greetings" className="m-0 type-display text-[28px]">Greetings</h2>
        <p className="mt-2 max-w-[62ch] type-body text-ink-2">Once per screen. It floats above the bottom edge, takes no taps, and leaves on the first action or after its reading time.</p>
        <ul className="m-0 mt-6 grid list-none gap-6 p-0 lg:grid-cols-2">
          {GREET_SCREENS.map((s) => {
            const g = GREETINGS[s];
            return (
              <li key={s} className="flex flex-col gap-3 border-t border-line-1 pt-4">
                <NovaLine>{g.text}</NovaLine>
                <p className="m-0 flex flex-wrap items-center gap-3 type-body-sm text-ink-3">
                  {g.where} · {g.key} · {words(g.text).length} words · {(readMs(g.text) / 1000).toFixed(1)} s
                  <Button variant="quiet" size="sm" onClick={() => play(s)}>Play it</Button>
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-16" aria-labelledby="guide">
        <h2 id="guide" className="m-0 type-display text-[28px]">Guided first shot</h2>
        <ol className="mt-3 flex flex-col gap-1 pl-5 type-body text-ink-2">
          {Object.values(GUIDE_LINES).map((l) => <li key={l.id}>&ldquo;{l.text}&rdquo; points at <b className="font-medium text-approach">{l.anchor}</b></li>)}
        </ol>
        <p className="mt-2 max-w-[62ch] type-body text-ink-2">Each frame runs the mock console in its own viewport. Type in a frame (tap it first), or tap its keys. Replay is under the keypad. <a className="text-sky underline underline-offset-4" href="/dev/teach/console">Open it full size</a>, or <a className="text-sky underline underline-offset-4" href="/dev/teach/console?fleet=0">without a fleet anchor</a>.</p>
        <div className="mt-6 flex flex-wrap items-start gap-8">
          {FRAMES.map((f) => {
            const scale = f.w > 800 ? 0.5 : 0.75;
            return (
              <figure key={f.name} className="m-0 flex flex-col gap-2">
                <figcaption className="type-body-sm text-ink-3">{f.name} · {f.w} × {f.h}</figcaption>
                <div className="overflow-hidden rounded-panel border border-line-1" style={{ width: f.w * scale, height: f.h * scale }}>
                  <iframe title={`Guided first shot, ${f.name}`} src="/dev/teach/console" width={f.w} height={f.h} className="origin-top-left border-0" style={{ transform: `scale(${scale})` }} />
                </div>
              </figure>
            );
          })}
        </div>
      </section>

      <section className="mt-16" aria-labelledby="ships">
        <h2 id="ships" className="m-0 type-display text-[28px]">Ship sprites</h2>
        <p className="mt-2 max-w-[62ch] type-body text-ink-2">Baked once from the battle&apos;s own builders, at 32, 48 and 96 px. The WebGL context is released after each batch.</p>
        <div className="mt-6 flex flex-col gap-6">
          {[32, 48, 96].map((size) => (
            <div key={size} className="flex flex-wrap items-end gap-6">
              <span className="w-14 type-body-sm text-ink-3">{size} px</span>
              {SPRITES.map(({ k, t }) => (
                <figure key={`${k}${t}`} className="m-0 flex flex-col items-center gap-2">
                  <ShipSprite kind={k} size={size} tone={t} />
                  <figcaption className="type-body-sm text-ink-3">{k}{t ? ` · ${t}` : ""}</figcaption>
                </figure>
              ))}
            </div>
          ))}
        </div>
      </section>

      <FieldManual open={open} onClose={() => setOpen(false)} topic={topic} seen={source} />
      {greet && <Greeting key={greet.n} screen={greet.screen} seen={source} />}
    </div>
  );
}
