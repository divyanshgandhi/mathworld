"use client";
import { Button as UiButton } from "@ui-sdk/react/button";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "delete", "0", "submit"] as const;
type Key = (typeof KEYS)[number];

/** True when a key press belongs to something else: a text field, or a modal that does not hold this keypad. */
function elsewhere(e: KeyboardEvent, own: HTMLElement | null) {
  const t = e.target as HTMLElement | null;
  if (t?.closest?.("input, textarea, select, [contenteditable='true']")) return true;
  const modal = [...document.querySelectorAll("dialog[open]")].at(-1);
  return !!modal && !!own && !modal.contains(own);
}

/**
 * The game's number pad for 2D screens (flashcards, warm-ups, any screen that asks for a number):
 * twelve 56 px keys (1 to 9, Delete, 0 and the submit key) and the physical keyboard too
 * (digits, Backspace, Enter). It draws no readout of its own: put the number where the eyes are
 * (on the card, on the rocket) and pass it back in as `value`.
 *
 * - Controlled: `value` + `onValueChange`. Uncontrolled: leave both out.
 * - `onSubmit(n)` runs on the submit key or Enter, never with an empty entry. `0` is a fine answer.
 * - Built to be mashed: keys pressed faster than a render are never lost, a held key does not repeat
 *   (Backspace excepted), and Enter cannot submit twice before `disabled` comes back.
 * - Keys from the keyboard are ignored while focus is in a text field or another modal is open.
 */
export function Keypad({
  value, onValueChange, onSubmit, submitLabel = "Go", disabled = false, maxLength = 6, keyboard = true, label = "Number pad", className = "",
}: {
  value?: string;
  onValueChange?: (v: string) => void;
  onSubmit: (n: number) => void;
  /** The words on the submit key: "Go", "Fire", "Check". */
  submitLabel?: string;
  /** Pauses the whole pad (keys and keyboard), e.g. while a card shows its answer. */
  disabled?: boolean;
  maxLength?: number;
  /** Listen to the physical keyboard (on by default). Turn it off when two pads share a screen. */
  keyboard?: boolean;
  label?: string;
  className?: string;
}) {
  const [inner, setInner] = useState("");
  const entry = value ?? inner;
  // the latest entry and the latest props, so mashed keys and stale closures never lose a digit
  const live = useRef(entry);
  const props = useRef({ onValueChange, onSubmit, disabled, maxLength });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { live.current = entry; }, [entry]);
  useEffect(() => { props.current = { onValueChange, onSubmit, disabled, maxLength }; });

  const set = (v: string) => { live.current = v; setInner(v); props.current.onValueChange?.(v); };
  const press = (k: Key) => {
    const p = props.current, v = live.current;
    if (p.disabled) return;
    if (k === "submit") { if (v === "") return; set(""); p.onSubmit(Number(v)); return; }
    if (k === "delete") return set(v.slice(0, -1));
    if (v.length >= p.maxLength) return;
    set(v === "0" ? k : v + k);
  };
  const pressRef = useRef(press);
  useEffect(() => { pressRef.current = press; });

  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || elsewhere(e, box.current)) return;
      if (/^\d$/.test(e.key)) { if (!e.repeat) pressRef.current(e.key as Key); }
      else if (e.key === "Backspace") { e.preventDefault(); pressRef.current("delete"); }
      else if (e.key === "Enter") { e.preventDefault(); if (!e.repeat) pressRef.current("submit"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboard]);

  return (
    <div ref={box} role="group" aria-label={label} className={`mw-keypad ${className}`} data-disabled={disabled || undefined}>
      {KEYS.map((k) => (
        <UiButton
          key={k}
          aria-label={k === "delete" ? "Delete" : k === "submit" ? submitLabel : k}
          disabled={disabled || (k === "submit" && entry === "") || (k === "delete" && entry === "")}
          focusableWhenDisabled
          onClick={() => press(k)}
          className={k === "submit" ? "mw-btn mw-primary mw-key mw-key-go" : "mw-btn mw-secondary mw-key"}
        >
          {k === "delete" ? <Icon name="delete" size={24} /> : k === "submit" ? submitLabel : k}
        </UiButton>
      ))}
    </div>
  );
}
