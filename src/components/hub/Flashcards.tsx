"use client";
import { Button } from "@ui-sdk/react/button";
import { useEffect, useRef, useState } from "react";
import type { EventInput } from "@/db/events";
import type { PlayerState } from "@/director/fold";
import { DECK_SIZE, flashcardDeck, FLASHCARD_ORBS } from "@/director/hub";
import { seeded } from "@/engine/util";
import { ghost, glass, Keypad, lime } from "../battle/ui";
import { Icon } from "../kit/Icon";

/**
 * Quick Flashcards (SPEC §2.4): five low-pressure cards from recently learned or shaky facts.
 * No timer on screen, no streak to lose: a wrong card just shows its answer and moves on.
 * Every card appends `flashcard_answered` (the fold gives a fast, correct card its gentle mastery
 * nudge); a correct card earns a bonus Orb.
 */
export function Flashcards({ state, emit, onClose }: { state: PlayerState; emit: (e: EventInput) => void; onClose: () => void }) {
  const [deck] = useState(() => flashcardDeck(state, seeded(Math.floor(Math.random() * 1e6) + 1)));
  const [i, setI] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; answer: number } | null>(null);
  const [right, setRight] = useState(0);
  const shown = useRef(0);
  useEffect(() => { shown.current = performance.now(); }, [i]);
  const card = deck[i], done = i >= deck.length;

  const answer = (n: number) => {
    if (!card || result) return;
    const ok = n === card.a * card.b, latencyMs = Math.round(performance.now() - shown.current);
    emit({ type: "flashcard_answered", payload: { a: card.a, b: card.b, guess: n, latencyMs } });
    if (ok) { emit({ type: "orb_earned", payload: { amount: FLASHCARD_ORBS, reason: "flashcard" } }); setRight((r) => r + 1); }
    void import("@/engine/audio").then(({ audio }) => audio.sfx(ok ? "blip_ok" : "blip_close"));
    setResult({ ok, answer: card.a * card.b });
    window.setTimeout(() => { setResult(null); setI((k) => k + 1); }, ok ? 700 : 1500);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Flashcards" className="fixed inset-0 z-30 grid place-items-center bg-void p-3">
      <div className={`${glass} flex w-[min(96vw,620px)] flex-col gap-4 p-5 md:flex-row md:items-stretch`}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="type-label-sm text-ink-2">Flashcards · {Math.min(i + 1, DECK_SIZE)} of {deck.length}</p>
          {!done && card && (
            <div className={`grid min-h-40 w-full place-items-center rounded-panel border px-6 py-6 transition ${result ? (result.ok ? "border-gold" : "border-sky") : "border-line-2"}`}>
              <p className="type-display type-number text-6xl md:text-7xl" aria-live="polite">{card.a}<span className="mx-3 text-ink-3">×</span>{card.b}</p>
              {result && <p className={`mt-3 flex items-center gap-2 type-child ${result.ok ? "text-gold" : "text-sky"}`} role="status">{result.ok && <Icon name="check" size={20} />}{result.ok ? "Instant!" : `It's ${result.answer}. Next one!`}</p>}
            </div>
          )}
          {done && (
            <div className="flex flex-col items-center gap-2 py-6">
              <p className="type-display text-4xl">Deck done</p>
              <p className="type-child text-ink-2">{right}/{deck.length} right · +{right * FLASHCARD_ORBS} orbs</p>
            </div>
          )}
          <p className="type-body-sm text-ink-3">No timer. Take your time.</p>
        </div>
        <div className="w-full md:w-[260px]">
          {!done ? <Keypad onFire={answer} disabled={!!result} label="Answer" fire="Go" /> : (
            <div className="flex h-full flex-col justify-center gap-2">
              <Button className={`${lime} py-3 text-base`} onClick={onClose}>Back to the Bay</Button>
            </div>
          )}
          {!done && <Button className={`${ghost} mt-2 w-full py-2`} onClick={onClose}>Close deck</Button>}
        </div>
      </div>
    </div>
  );
}
