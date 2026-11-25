"use client";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Radio, RadioGroup, RadioIndicator } from "@ui-sdk/react/radio";
import { useEffect, useRef, useState } from "react";
import { RocketGlyph, Icon } from "@/components/kit/Icon";
import { CADET } from "@/design/tokens";

/**
 * The shared class strings every older screen uses, now in the Void and Gold language (see DESIGN.md).
 * The names are kept so nothing that imports them breaks; new code should use the kit
 * (`@/components/kit`) instead: <Button variant="primary">, <Sheet>, <IconButton>.
 * - `btn`: the base of every button (a pill, 44 px tall at least, gold focus ring, neutral disabled).
 * - `ghost`: a hairline pill (secondary). `quiet`: words only.
 * - `lime`: the primary action, the gradient-edge pill. The old name stays; nothing is lime any more.
 * - `glass`: the rare raised sheet. No glass, no blur, no shadow any more.
 */
export const btn = "mw-btn min-h-11 px-4 py-2 text-[15px]";
export const ghost = `${btn} mw-secondary`;
export const lime = `${btn} mw-primary`;
export const quiet = `${btn} mw-quiet`;
export const primary = lime;
export const glass = "mw-sheet";

export interface Cadet { name: string; avatar: string }

const AVATARS = Object.entries(CADET).map(([id, color]) => ({ id, color }));
const NAME_OF: Record<string, string> = { "cadet-1": "Sky blue", "cadet-2": "Gold", "cadet-3": "Ember", "cadet-4": "White", "cadet-5": "Violet", "cadet-6": "Rose" };
/** Older callers pass a glyph in their label ("▶ Begin"); the kit draws its own glyph instead. */
const words = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "").trim();

/** The one-card Cadet Sign-Up (name + colour). Creates the player and sets the cookie. */
export function CadetSignUp({ onDone, cta = "Start" }: { onDone: (p: Cadet) => void; cta?: string }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("cadet-1");
  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/player", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, avatar }) });
    if (res.ok) onDone((await res.json()).player);
  };
  return (
    <form onSubmit={signUp} aria-labelledby="signup-title" className={`${glass} absolute inset-0 z-30 m-auto flex h-fit w-[min(92%,440px)] flex-col gap-6 p-6 md:p-8`}>
      <h2 id="signup-title" className="m-0 type-display text-[clamp(30px,6vw,40px)]">New cadet</h2>
      <Field name="name">
        <FieldLabel className="type-name text-[17px] text-ink-2">Your name</FieldLabel>
        <Input autoFocus required maxLength={24} value={name} onValueChange={setName} autoComplete="given-name" className="mw-input mt-2" />
      </Field>
      <Field name="avatar">
        <FieldLabel className="type-name text-[17px] text-ink-2">Pick your colour</FieldLabel>
        <RadioGroup value={avatar} onValueChange={(v) => setAvatar(String(v))} className="mt-3 flex flex-wrap gap-3">
          {AVATARS.map((a) => (
            <label key={a.id} data-slot="label" className="cursor-pointer">
              <Radio value={a.id} aria-label={NAME_OF[a.id] ?? a.id}
                className="grid size-11 place-items-center rounded-full outline-none ring-offset-2 ring-offset-panel transition data-checked:ring-2 data-checked:ring-approach focus-visible:ring-2 focus-visible:ring-gold"
                style={{ background: a.color }}>
                <RadioIndicator className="size-3 rounded-full bg-void" />
              </Radio>
            </label>
          ))}
        </RadioGroup>
      </Field>
      <Button type="submit" className="mw-btn mw-primary mw-md mw-has-glyph w-full justify-between" disabled={!name.trim()}>
        {words(cta) || "Start"}
        <RocketGlyph size={34} />
      </Button>
    </form>
  );
}

const PAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "Fire"];
/** A keypad key: a chip-radius hairline key, big equal-width digits. */
export const padKey = "mw-btn mw-secondary rounded-chip px-0 type-number text-[22px] font-medium";

/**
 * The cockpit keypad on its own (warm-ups, Quick Flashcards): a readout and twelve keys, with the
 * physical keyboard too (digits, Backspace, Enter). `0` is a fine answer. Battles use BattleHud's.
 */
export function Keypad({ onFire, disabled = false, label = "Plasma balls", fire = "Fire", className = "" }: { onFire: (n: number) => void; disabled?: boolean; label?: string; fire?: string; className?: string }) {
  const [entry, setEntryState] = useState("");
  // the latest entry, so keys pressed faster than a render (or typed by a script) never get lost
  const live = useRef("");
  const setEntry = (v: string) => { live.current = v; setEntryState(v); };
  const press = (k: string) => {
    const v = live.current;
    if (k === "Fire") { if (v === "" || disabled) return; onFire(Number(v)); setEntry(""); return; }
    if (k === "⌫") return setEntry(v.slice(0, -1));
    setEntry(v === "0" ? k : (v + k).slice(0, 6));
  };
  const pressRef = useRef(press);
  useEffect(() => { pressRef.current = press; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea") || document.querySelector("dialog[open]:not([data-keypad])")) return;
      if (/^\d$/.test(e.key)) pressRef.current(e.key);
      else if (e.key === "Backspace") pressRef.current("⌫");
      else if (e.key === "Enter") { e.preventDefault(); pressRef.current("Fire"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-3 rounded-chip border border-line-1 bg-void px-4 py-1.5 md:py-2">
        <span className="flex items-center gap-2 type-label-sm text-ink-3"><Icon name="plasma" size={18} />{label}</span>
        <output aria-live="polite" aria-label={label} className="type-number text-[34px] font-medium leading-none text-approach md:text-[40px]">{entry || "0"}</output>
      </div>
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Keypad">
        {PAD.map((k) => (
          <Button key={k} aria-label={k === "⌫" ? "Delete" : k === "Fire" ? fire : k} disabled={k === "Fire" && (entry === "" || disabled)}
            className={k === "Fire" ? `${lime} min-h-12 px-2 text-[15px]` : `${padKey} min-h-12`} onClick={() => press(k)}>
            {k === "Fire" ? fire : k === "⌫" ? <Icon name="delete" size={22} /> : k}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Dialog parts render in the top layer: pin the backdrop to the whole screen and centre the box. */
export const backdrop = "fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-scrim p-0";
export const dialogBox = `${glass} fixed left-1/2 top-1/2 m-0 max-h-[92dvh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto text-approach`;
