"use client";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@ui-sdk/react/dialog";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import "./hub.css";
import type { EventInput } from "@/db/events";
import type { PlayerState } from "@/director/fold";
import { seeded } from "@/engine/util";
import { Button, buttonClass } from "../kit/Button";
import { EmptyState } from "../kit/Empty";
import { Icon } from "../kit/Icon";
import { Keypad } from "../kit/Keypad";
import { Greeting } from "../teach/Greeting";
import type { Fact } from "@/rig/pools";
import { deckFor } from "./deck";

export type CardResult = { a: number; b: number; guess: number; ok: boolean };
type Result = CardResult;
/** How long a right answer stays on the card before the next one. A miss waits for the player. */
const RIGHT_MS = 900;
/** How long a miss shows its picture before Next card wakes up. */
const LOOK_MS = 1200;

/**
 * Flashcards: a calm sheet of five cards. One big fact, a keypad, no timer and no orbs.
 * - Right: the answer turns gold for a moment, then the next card.
 * - Not right: the fact is drawn as a true array (`a` rows of `b` dots) with the answer, and the
 *   player moves on with Next card when ready (Enter works too). A miss is information, not a penalty.
 * - The end: "4 of 5 right", the five facts with their answers, and Done.
 * Every card appends `flashcard_answered` (the fold gives a fast, right card a gentle mastery nudge).
 * Pass `table` to practise one times table ("Practise the 7s"); leave it out for the mixed deck.
 * The first deck ever opens with Nova's one-line greeting under the header (seen key `greet:flashcards`).
 * Optional (the daily patrol uses them): `facts` is a fixed deck, `title` the sheet's name,
 * `retryMisses` brings a missed fact back once at the end, `progress="dots"` shows dots instead of
 * "Card 2 of 5", `greet={false}` skips Nova's line, `onFinish` runs once with every answer when the
 * last card is done, and `end` replaces the default end card.
 */
export function Flashcards({ state, emit, onClose, table = null, facts, title: name, retryMisses = false, progress = "count", greet = true, onFinish, end }: {
  state: PlayerState; emit: (e: EventInput) => void; onClose: () => void; table?: number | null;
  facts?: Fact[]; title?: string; retryMisses?: boolean; progress?: "count" | "dots"; greet?: boolean;
  onFinish?: (results: CardResult[]) => void; end?: (results: CardResult[]) => ReactNode;
}) {
  const [deck, setDeck] = useState<Fact[]>(() => facts ? facts.map(({ a, b }) => ({ a, b })) : deckFor(state, seeded(Math.floor(Math.random() * 1e6) + 1), table));
  const retried = useRef(new Set<number>());
  const [i, setI] = useState(0);
  const [entry, setEntry] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [done, setDone] = useState<Result[]>([]);
  const shown = useRef(0);
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => { shown.current = performance.now(); }, [i]);
  const card = deck[i], finished = i >= deck.length;
  const right = done.filter((r) => r.ok).length;

  const advance = useCallback(() => { setResult(null); setEntry(""); setI((k) => k + 1); }, []);

  const answer = (n: number) => {
    if (!card || result) return;
    const ok = n === card.a * card.b, latencyMs = Math.round(performance.now() - shown.current);
    emit({ type: "flashcard_answered", payload: { a: card.a, b: card.b, guess: n, latencyMs } });
    void import("@/engine/audio").then(({ audio }) => audio.sfx(ok ? "blip_ok" : "blip_close")).catch(() => {});
    const r = { a: card.a, b: card.b, guess: n, ok };
    setResult(r);
    setDone((d) => [...d, r]);
    // a miss comes back once, at the end (never a second time)
    if (!ok && retryMisses && !retried.current.has(i)) {
      retried.current.add(i);
      retried.current.add(deck.length);
      setDeck((d) => [...d, { a: card.a, b: card.b }]);
    }
  };
  const finishedOnce = useRef(false);
  useEffect(() => {
    if (!finished || finishedOnce.current || deck.length === 0) return;
    finishedOnce.current = true;
    onFinish?.(done);
  }, [finished, deck.length, done, onFinish]);

  // a right answer moves on by itself; a miss waits for Next card (or Enter), which wakes up after a
  // short look so a mashed Enter cannot skip the picture of the fact
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!result) return;
    if (result.ok) { const t = window.setTimeout(advance, RIGHT_MS); return () => window.clearTimeout(t); }
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat || (e.target as HTMLElement | null)?.closest?.("button")) return;
      e.preventDefault();
      advance();
    };
    const t = window.setTimeout(() => { setReady(true); next.current?.focus(); window.addEventListener("keydown", key); }, LOOK_MS);
    return () => { window.clearTimeout(t); window.removeEventListener("keydown", key); setReady(false); };
  }, [result, advance]);

  const title = name ?? (table ? `The ${table}s` : "Flashcards");

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="mw-cards" initialFocus="content">
        <header className="mw-topbar">
          <DialogTitle className="mw-topbar-title">{title}</DialogTitle>
          <span className="flex-1" />
          {!finished && deck.length > 0 && progress === "count" && <span className="type-body text-ink-2" aria-live="polite">Card {i + 1} of {deck.length}</span>}
          {!finished && deck.length > 0 && progress === "dots" && (
            <span className="mw-cards-dots" role="img" aria-label={`Card ${i + 1} of ${deck.length}`}>
              {deck.map((_, k) => <i key={k} data-state={k < i ? "done" : k === i ? "now" : undefined} />)}
            </span>
          )}
          <DialogClose aria-label={name ? `Close ${name.toLowerCase()}` : "Close flashcards"} title="Close" className={buttonClass("icon")}><Icon name="close" size={20} /></DialogClose>
        </header>

        {/* laid over the top of the card, so nothing moves when it goes */}
        {greet && deck.length > 0 && !finished && (
          <div className="relative z-10 h-0">
            <Greeting screen="flashcards" placement="inline" seen={{ seen: state.seen, emit }} className="absolute inset-x-0 top-1 mx-auto w-fit max-w-[min(92%,520px)] rounded-panel border border-line-1 bg-panel px-4 py-3" />
          </div>
        )}
        {deck.length === 0 ? (
          <div className="grid flex-1 place-items-center px-6">
            <EmptyState icon="cards" title="No cards yet" action={<Button variant="primary" onClick={onClose}>Done</Button>}>
              Play your first mission to meet some facts. Then they will show up here.
            </EmptyState>
          </div>
        ) : finished && end ? (
          end(done)
        ) : finished ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-10 text-center">
            <p className="m-0 type-display text-[clamp(48px,9vw,96px)]" role="status">{right} of {deck.length} right</p>
            <ol className="m-0 flex list-none flex-wrap justify-center gap-x-6 gap-y-3 p-0" aria-label="Your cards">
              {done.map((r, k) => (
                <li key={k} className="flex items-center gap-2 type-number text-[20px]">
                  <span className={r.ok ? "text-gold" : "text-sky"} aria-hidden><Icon name={r.ok ? "check" : "forward"} size={18} /></span>
                  <span>{r.a} × {r.b} = {r.a * r.b}</span>
                  <span className="sr-only">{r.ok ? "right" : `you said ${r.guess}`}</span>
                </li>
              ))}
            </ol>
            <Button variant="primary" size="lg" autoFocus onClick={onClose} className="w-full max-w-[360px] justify-between">Done</Button>
          </div>
        ) : (
          <div className="mw-cards-body">
            <section className="mw-cards-fact" aria-live="polite" aria-atomic="true">
              {result && !result.ok ? (
                <Miss result={result} />
              ) : (
                <p className="mw-cards-eq m-0 flex items-baseline justify-center gap-[0.3em] type-display type-number leading-none" aria-label={result ? `${card.a} times ${card.b} is ${card.a * card.b}. Right.` : `${card.a} times ${card.b}`}>
                  <span>{card.a}</span><span className="text-ink-3">×</span><span>{card.b}</span><span className="text-ink-3">=</span>
                  <span className={`mw-cards-slot ${result?.ok ? "text-gold" : ""}`} data-empty={!entry && !result ? "" : undefined}>
                    {result?.ok ? card.a * card.b : entry || "?"}
                  </span>
                </p>
              )}
              {result?.ok && <p className="m-0 mt-6 flex items-center justify-center gap-2 type-child text-gold"><Icon name="check" size={22} />Right</p>}
            </section>
            <div className="mw-cards-pad">
              {result && !result.ok ? (
                <Button ref={next} variant="primary" size="lg" onClick={() => { if (ready) advance(); }} disabled={!ready} focusableWhenDisabled className="w-full justify-between">{i + 1 < deck.length ? "Next card" : "See how you did"}</Button>
              ) : (
                <Keypad value={entry} onValueChange={setEntry} onSubmit={answer} submitLabel="Check" disabled={!!result} maxLength={3} label="Your answer" />
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A miss: the fact as a true array of dots (`a` rows of `b`), with the answer and plain words. */
function Miss({ result }: { result: Result }) {
  const { a, b, guess } = result, total = a * b;
  // dots shrink to fit a big fact, never below a size a child can count
  const dot = Math.max(10, Math.min(26, Math.floor(300 / Math.max(a, b, 1)) - 6));
  return (
    <div className="mw-miss flex flex-col items-center gap-6 text-center">
      <p className="mw-miss-eq m-0 type-display type-number leading-none">
        {a} <span className="text-ink-3">×</span> {b} <span className="text-ink-3">=</span> <span className="text-gold">{total}</span>
      </p>
      {total > 0 ? (
        <div
          className="mw-dots"
          role="img"
          aria-label={`${a} rows of ${b} dots: ${total} dots`}
          style={{ "--dot-want": `${dot}px`, "--rows": a, gridTemplateColumns: b > 5 ? `repeat(5, var(--dot)) calc(var(--dot) * 0.4) repeat(${b - 5}, var(--dot))` : `repeat(${b}, var(--dot))` } as CSSProperties}
        >
          {/* a rows of b, with a small gap after every fifth dot so a row is easy to count */}
          {Array.from({ length: total }, (_, k) => { const c = k % b; return <i key={k} style={{ gridRow: Math.floor(k / b) + 1, gridColumn: c + 1 + (c >= 5 ? 1 : 0) }} />; })}
        </div>
      ) : (
        <span className="mw-orbit size-24" aria-hidden />
      )}
      <p className="mw-miss-words m-0 max-w-[30ch] type-child text-ink-2">
        {total > 0 ? <>{a} {a === 1 ? "row" : "rows"} of {b} make {total}.</> : <>{a === 0 ? `No rows of ${b}` : `${a} rows of none`} make 0.</>} You said {guess}.
      </p>
    </div>
  );
}
