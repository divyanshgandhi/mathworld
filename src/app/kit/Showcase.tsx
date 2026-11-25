"use client";
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@ui-sdk/react/dialog";
import { useState, type ReactNode } from "react";
import { backdrop, CadetSignUp, dialogBox, ghost, glass, Keypad, lime } from "@/components/battle/ui";
import {
  Button, buttonClass, HomeLink, Icon, IconButton, ICON_NAMES, MasteryKeyLegend, MasteryMark, NovaLine, NovaPortrait, OrbCount,
  Pips, PillLink, RingLogo, RocketGlyph, Sheet, TopBar, WaveDots, Wordmark, type ButtonSize, type ButtonVariant,
} from "@/components/kit";
import { contrast, over } from "@/design/contrast";
import { COLOR, EDGE, FILL, INK, LINE, MASTERY, MOTION, RADIUS, SIZE, TYPE, type MasteryKey } from "@/design/tokens";

const STATES = ["rest", "hover", "focus", "pressed", "disabled"] as const;
type State = (typeof STATES)[number];
const force = (s: State) => (s === "rest" || s === "disabled" ? {} : { "data-force": s });

/** The Bay prototype's sample mastery: easy tables done, middle ones in progress, hard ones new. */
const sample = (a: number, b: number): MasteryKey => {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  if (lo === 1 || lo === 10 || (lo === 2 && hi <= 6) || (lo === 5 && hi <= 5)) return "gold";
  if (lo === 2 || lo === 5 || (lo === 3 && hi <= 4) || (lo === 7 && hi <= 8)) return "got";
  if (lo <= 4 || (lo === 6 && hi === 7)) return "learn";
  return "new";
};

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line-1 py-10 md:py-14">
      <h2 id={id} className="m-0 type-display text-[clamp(28px,4vw,40px)]">{title}</h2>
      {note && <p className="mt-3 max-w-[64ch] type-body text-ink-2">{note}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <p className="m-0 mt-2 type-body-sm text-ink-3">{children}</p>;
}

function Swatch({ name, value, text = true }: { name: string; value: string; text?: boolean }) {
  const onVoid = contrast(value, COLOR.void);
  return (
    <figure className="m-0 flex flex-col gap-2">
      <span className="block h-16 rounded-chip border border-line-1" style={{ background: value }} />
      <figcaption className="flex flex-col gap-0.5">
        <span className="type-name text-[15px]">{name}</span>
        <span className="type-body-sm text-ink-3">{text ? `${onVoid.toFixed(1)}:1 on void` : "not for text"}</span>
      </figcaption>
    </figure>
  );
}

function ButtonMatrix({ variant, label, icon }: { variant: ButtonVariant; label: string; icon?: Parameters<typeof Icon>[0]["name"] }) {
  const sizes: ButtonSize[] = variant === "icon" ? ["md"] : ["sm", "md", "lg"];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-x-3 border-spacing-y-5">
        <thead>
          <tr>{["", ...STATES].map((s) => <th key={s} scope="col" className="text-left type-label-sm font-medium text-ink-3">{s}</th>)}</tr>
        </thead>
        <tbody>
          {sizes.map((size) => (
            <tr key={size}>
              <th scope="row" className="text-left type-label-sm font-medium text-ink-3">{variant === "icon" ? "44 px" : size}</th>
              {STATES.map((s) => (
                <td key={s}>
                  {variant === "icon"
                    ? <IconButton icon={icon ?? "help"} label={`Help, ${s}`} disabled={s === "disabled"} {...force(s)} />
                    : <Button variant={variant} size={size} icon={variant === "primary" ? undefined : icon} disabled={s === "disabled"} aria-label={`${label}, ${size}, ${s}`} {...force(s)}>{label}</Button>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** /kit: every kit component in every state on the void. The design lead reviews the system here. */
export function KitShowcase() {
  const [pressed, setPressed] = useState(0);
  const [won, setWon] = useState(1);
  const [table, setTable] = useState<number | null>(7);
  const [lastFire, setLastFire] = useState<number | null>(null);
  const [signUp, setSignUp] = useState(false);

  return (
    <div className="min-h-dvh bg-void text-approach">
      <TopBar left={<HomeLink href="/" label="Title" />} title="Kit" orbs={142} onHelp={() => setPressed((n) => n + 1)} />

      <main className="mx-auto max-w-[1360px] px-5 pb-24 md:px-10">
        <header className="py-10 md:py-16">
          <Wordmark size="lg" />
          <p className="mt-7 max-w-[52ch] type-child text-ink-2">
            The Void and Gold kit, as built. Every component below is the one the game uses, shown in every state on the one black.
            The top bar above is live: it owns the sound button while it is up. Help pressed {pressed} {pressed === 1 ? "time" : "times"}.
          </p>
        </header>

        <Section id="colour" title="Colour" note="One void on every screen. Gold is the key light: mastery, orbs and focus. Sky is Nova and Learning. Ember is heat: exhaust and a miss. The ratios are measured on the void.">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {Object.entries(COLOR).map(([k, v]) => <Swatch key={k} name={k} value={v} text={!["void", "panel", "shadow", "horizon", "disk"].includes(k)} />)}
          </div>
          <h3 className="mt-10 type-label text-ink-2">Ink, hairlines, fills</h3>
          <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {Object.entries(INK).map(([k, v]) => <Swatch key={k} name={`ink ${k}`} value={v} />)}
            {Object.entries(LINE).map(([k, v]) => <Swatch key={k} name={`line ${k}`} value={v} text={false} />)}
            {Object.entries(FILL).map(([k, v]) => <Swatch key={k} name={k} value={v} text={false} />)}
          </div>
          <h3 className="mt-10 type-label text-ink-2">The action edge</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <figure className="m-0"><span className="block h-3 rounded-pill" style={{ background: EDGE.rest }} /><Caption>at rest: cool to hot</Caption></figure>
            <figure className="m-0"><span className="block h-3 rounded-pill" style={{ background: EDGE.hot }} /><Caption>hovered or armed: gold</Caption></figure>
          </div>
          <p className="mt-8 type-body-sm text-ink-3">
            On a sheet over a 3D scene (sheet fill on void), ink 3 measures {contrast(INK[3], `rgb(${over(FILL.sheet, COLOR.void).join(",")})`).toFixed(1)}:1.
          </p>
        </Section>

        <Section id="type" title="Type" note={`One family, ${TYPE.family}, in three voices. Labels never go under ${TYPE.min.label} px, body never under ${TYPE.min.body} px, and anything a child must read is ${TYPE.min.child} px or more.`}>
          <div className="flex flex-col gap-8">
            <div><p className="m-0 type-display text-[clamp(48px,7vw,96px)]">The Moon</p><Caption>display · type-display · weight 200, width 125%, capitals · titles, the wordmark, the big a × b</Caption></div>
            <div><p className="m-0 type-display type-number text-[64px]">7 × 8</p><Caption>display with type-number · equal-width digits</Caption></div>
            <div><p className="m-0 type-label">Your times tables</p><Caption>label · type-label · {SIZE.label} px, weight 500, width 115%, tracked capitals · short labels only</Caption></div>
            <div><p className="m-0 type-label-sm">Wave 2 of 4</p><Caption>label small · type-label-sm · {SIZE["label-sm"]} px, the smallest text in the game</Caption></div>
            <div><p className="m-0 type-child max-w-[34ch]">Your next mission. Win 3 of 4 waves to unlock Mars.</p><Caption>child · type-child · {SIZE.child} px · anything a child must read</Caption></div>
            <div><p className="m-0 type-body max-w-[60ch]">Orbs come from first-try answers, Gold facts, streaks and clearing a planet. Spend them on your rocket in the Hangar.</p><Caption>body · type-body · {SIZE.body} px, sentence case</Caption></div>
            <div><p className="m-0 type-body-sm text-ink-2">Sample cadet, demonstration data.</p><Caption>body small · type-body-sm · {SIZE["body-sm"]} px, the floor for body text</Caption></div>
            <div><p className="m-0 type-name text-[17px]">Star map</p><Caption>name · type-name · a label&apos;s weight in sentence case, for places on buttons</Caption></div>
          </div>
        </Section>

        <Section id="buttons" title="Buttons" note="Primary is the gradient-edge pill with the ring-and-rocket glyph; its edge turns gold on hover. One per screen. Secondary is a hairline pill, quiet is words only, icon is round and 44 px. Disabled is the same neutral dim on every variant. Hover, focus and pressed are pinned here so you can see them side by side; the live buttons respond too.">
          <h3 className="type-label text-ink-2">Primary</h3>
          <ButtonMatrix variant="primary" label="Launch" />
          <h3 className="mt-6 type-label text-ink-2">Secondary</h3>
          <ButtonMatrix variant="secondary" label="Star map" icon="map" />
          <h3 className="mt-6 type-label text-ink-2">Quiet</h3>
          <ButtonMatrix variant="quiet" label="Switch cadet" />
          <h3 className="mt-6 type-label text-ink-2">Icon</h3>
          <ButtonMatrix variant="icon" label="Help" icon="help" />
          <h3 className="mt-6 type-label text-ink-2">Chosen (aria-pressed)</h3>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button aria-pressed="true">Hull</Button><Button aria-pressed="false">Thruster</Button><Button aria-pressed="false">Blaster</Button>
          </div>
          <h3 className="mt-10 type-label text-ink-2">Links that look like buttons</h3>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <PillLink href="/bay" variant="primary" size="lg">Launch<span className="hidden sm:inline">&nbsp;to the Moon</span></PillLink>
            <PillLink href="/hangar" icon="hangar">Hangar</PillLink>
            <PillLink href="/academy" icon="academy">Academy</PillLink>
            <PillLink href="/map" icon="map">Star map</PillLink>
            <PillLink href="/map" icon="map" disabled>Locked place</PillLink>
            <HomeLink />
          </div>
          <h3 className="mt-10 type-label text-ink-2">Full width on a phone</h3>
          <div className="mt-4 max-w-[375px] border border-dashed border-line-1 p-4">
            <Button variant="primary" size="lg" className="w-full justify-between">Start game</Button>
          </div>
        </Section>

        <Section id="icons" title="Icons" note="One drawn set on a 24 px grid, one 1.7 px stroke, currentColor. No emoji and no Unicode glyphs stand in for icons.">
          <ul className="m-0 grid list-none grid-cols-3 gap-4 p-0 sm:grid-cols-5 lg:grid-cols-8">
            {ICON_NAMES.map((n) => (
              <li key={n} className="flex flex-col items-center gap-2 rounded-chip border border-line-1 py-4">
                <Icon name={n} size={24} />
                <span className="type-body-sm text-ink-3">{n}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-end gap-8">
            <figure className="m-0"><RocketGlyph size={44} /><Caption>ring and rocket</Caption></figure>
            <figure className="m-0"><RingLogo size={44} /><Caption>ring logo</Caption></figure>
            <figure className="m-0"><NovaPortrait size={48} /><Caption>Nova</Caption></figure>
            <figure className="m-0 text-gold"><Icon name="orb" size={24} /><Caption>orb, in gold</Caption></figure>
          </div>
        </Section>

        <Section id="marks" title="Mastery marks" note="Four words, four shapes. Each mark reads without colour: Gold is a bullseye, Got it is a filled dot, Learning is an outline, New is a small dim dot.">
          <div className="flex flex-wrap gap-10">
            {(Object.keys(MASTERY) as MasteryKey[]).map((k) => (
              <div key={k} className="flex items-center gap-3">
                <MasteryMark level={k} size={14} label /><span className="type-name text-[17px]">{MASTERY[k].word}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-end gap-10">
            <figure className="m-0"><div className="flex gap-3"><MasteryMark level="gold" size={7} /><MasteryMark level="got" size={7} /><MasteryMark level="learn" size={7} /><MasteryMark level="new" size={7} /></div><Caption>7 px, the pip size</Caption></figure>
            <figure className="m-0 grayscale"><div className="flex gap-3"><MasteryMark level="gold" size={12} /><MasteryMark level="got" size={12} /><MasteryMark level="learn" size={12} /><MasteryMark level="new" size={12} /></div><Caption>without colour (greyscale)</Caption></figure>
          </div>
          <h3 className="mt-10 type-label text-ink-2">Your times tables (Pips)</h3>
          <div className="mt-4 grid grid-cols-5 gap-2 md:grid-cols-10" role="group" aria-label="Your times tables">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((t) => {
              const marks = Array.from({ length: 10 }, (_, j) => sample(t, j + 1));
              return (
                <button key={t} type="button" aria-expanded={table === t} onClick={() => setTable(table === t ? null : t)}
                  aria-label={`The ${t}s: ${marks.filter((m) => m === "gold").length} of 10 Gold`}
                  className="mw-tile flex cursor-pointer flex-col items-center gap-2.5 px-1 pb-3 pt-3">
                  <b className="type-number text-[20px] font-medium">×{t}</b>
                  <Pips marks={marks} />
                </button>
              );
            })}
          </div>
          {table && (
            <Sheet className="mt-4 p-5" aria-live="polite">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
                <h3 className="m-0 text-[26px] font-light uppercase tracking-[0.06em] [font-stretch:120%]">The {table}s</h3>
                <MasteryKeyLegend className="hidden md:flex" />
              </div>
              <div className="grid grid-cols-5 gap-2 md:grid-cols-10">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((b) => {
                  const m = sample(table, b);
                  return (
                    <div key={b} className="flex flex-col items-center gap-1.5 rounded-[12px] px-0.5 py-2.5" aria-label={`${table} times ${b}: ${MASTERY[m].word}`} role="img">
                      <span className="type-number text-[15px] text-ink-2">{table} × {b}</span>
                      <span className={`type-number text-[22px] font-medium ${m === "gold" ? "text-gold" : m === "new" ? "text-ink-3" : ""}`}>{m === "new" ? "?" : table * b}</span>
                      <MasteryMark level={m} size={9} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-end"><Button variant="primary" size="sm" glyph={false}>Practise the {table}s</Button></div>
            </Sheet>
          )}
          <h3 className="mt-10 type-label text-ink-2">Wave dots</h3>
          <div className="mt-4 flex flex-col gap-4">
            {[0, 1, 2, 3, 4].map((n) => <WaveDots key={n} total={4} won={n} current={n < 4} />)}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button size="sm" onClick={() => setWon((w) => (w + 1) % 5)}>Win a wave</Button>
            <WaveDots total={4} won={won} current={won < 4} />
          </div>
        </Section>

        <Section id="brand" title="Wordmark and Nova" note="The ring logo with MATH WORLD in the display voice. Nova speaks in one line style everywhere: her portrait, her name in sky, the words at child size.">
          <div className="flex flex-col gap-8">
            <Wordmark size="lg" />
            <div className="flex items-center gap-6"><Wordmark /><Caption>top-bar size (the name hides on phones)</Caption></div>
            <NovaLine>Welcome back, Kit! Your 7s are nearly Gold. Ready for the Moon?</NovaLine>
            <NovaLine speaker="Captain" portrait={<span className="grid size-12 place-items-center rounded-full border border-line-2 text-ink-2"><Icon name="cadet" size={22} /></span>}>Earth needs its sharpest young minds.</NovaLine>
          </div>
        </Section>

        <Section id="top-bar" title="Top bar" note="One bar on every screen: home or menu and the screen's name on the left; orbs, help and sound on the right. It never reflows. The live one is at the top of this page.">
          <div className="flex flex-col gap-4">
            <div className="rounded-panel border border-dashed border-line-1"><TopBar left={<HomeLink />} title="Star map" orbs={142} onHelp={() => setPressed((n) => n + 1)} /></div>
            <div className="rounded-panel border border-dashed border-line-1"><TopBar left={<IconButton icon="menu" label="Menu" />} title="The Moon" orbs={9} /></div>
            <div className="rounded-panel border border-dashed border-line-1"><TopBar left={<Wordmark />} orbs={1250} onHelp={() => setPressed((n) => n + 1)} /></div>
          </div>
          <div className="mt-6 flex items-center gap-6"><OrbCount n={142} /><Caption>orb count</Caption></div>
        </Section>

        <Section id="sheet" title="Sheet" note="The rare raised panel: 16 px radius, a 1 px hairline, near-black. No glass, no blur, no shadow. Most of a screen sits straight on the void.">
          <div className="grid gap-6 md:grid-cols-2">
            <Sheet className="p-6">
              <h3 className="m-0 type-display text-[32px]">Paused</h3>
              <p className="mt-3 type-body text-ink-2">Your fleet waits. Nothing is lost.</p>
              <div className="mt-6 flex flex-col gap-3">
                <Button variant="primary" glyph={false} className="w-full">Resume</Button>
                <Button icon="map" className="w-full">Star map</Button>
                <Button icon="bay" className="w-full">Resting Bay</Button>
              </div>
            </Sheet>
            <div className="flex flex-col items-start gap-4">
              <Dialog>
                <DialogTrigger className={buttonClass("secondary", "md")}>Open a sheet as a dialog</DialogTrigger>
                <DialogBackdrop className={backdrop} />
                <DialogContent className={`${dialogBox} w-[min(92vw,380px)] p-6`}>
                  <DialogTitle className="m-0 type-display text-[32px]">The 7s</DialogTitle>
                  <DialogDescription className="mt-2 type-body text-ink-2">4 of 10 Gold.</DialogDescription>
                  <DialogClose className={`${buttonClass("primary", "md")} mt-6 w-full`}>Done</DialogClose>
                </DialogContent>
              </Dialog>
              <p className="m-0 type-body-sm text-ink-3">Dialog parts take the kit&apos;s class strings: buttonClass(), sheetClass, and backdrop / dialogBox from battle/ui.</p>
            </div>
          </div>
        </Section>

        <Section id="legacy" title="Older screens" note="The shared strings in battle/ui.tsx keep their names (btn, ghost, lime, glass, backdrop, dialogBox) and now draw in this language, so every older screen changed at once. The keypad and the sign-up card live there too.">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                <button type="button" className={`${lime} px-6 py-3 text-base`}>lime</button>
                <button type="button" className={`${ghost} px-5 py-3 text-base`}>ghost</button>
                <button type="button" className={`${lime} px-6 py-3 text-base`} data-disabled="">lime disabled</button>
              </div>
              <div className={`${glass} p-5`}><p className="m-0 type-body">glass is now a sheet.</p></div>
              <div className={`${glass} w-full max-w-[320px] p-3`}>
                <Keypad onFire={setLastFire} />
                <p className="mt-2 text-center type-body-sm text-ink-3" role="status">{lastFire === null ? "Type or tap, then Fire. 0 is a fine answer." : `Fired ${lastFire}`}</p>
              </div>
            </div>
            <div className="relative grid min-h-[520px] place-items-center rounded-panel border border-dashed border-line-1">
              {/* the card takes focus when it mounts, so it waits for a press instead of jumping the page */}
              {signUp ? <CadetSignUp cta="Start" onDone={() => setSignUp(false)} /> : <Button onClick={() => setSignUp(true)}>Show the sign-up card</Button>}
            </div>
          </div>
          <p className="mt-4 type-body-sm text-ink-3">The sign-up card is live: submitting it creates a cadet on this device.</p>
        </Section>

        <Section id="motion" title="Motion" note={`One curve (${MOTION.ease}), three durations: quick ${MOTION.quick} ms for controls, route ${MOTION.route} ms for the fade between screens, moment ${MOTION.moment} ms for the one authored moment per screen. Reduced motion turns them off.`}>
          <p className="m-0 type-body text-ink-2">Radii: panel {RADIUS.panel} px, chip {RADIUS.chip} px, pill. Go to another route to see the fade: <PillLink href="/" size="sm" variant="quiet">Title</PillLink></p>
        </Section>
      </main>
    </div>
  );
}
