"use client";
import { Button } from "@ui-sdk/react/button";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { Icon, RocketGlyph } from "@/components/kit/Icon";
import { NovaPortrait } from "@/components/kit/Brand";
import type { ConsoleLayout } from "./layout";
import { css } from "./cockpit";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;
export const fmtN = (n: number) => n.toLocaleString("en-US");
/** A ui-sdk dialog (a card, the pause menu) is open. ui-sdk dialogs are not <dialog> elements, so `dialog[open]` never matches. */
export const CARD_OPEN = "[data-slot=dialog-content][data-open], [data-slot=alert-dialog-content][data-open], [data-slot=popover-content][data-open]";

/**
 * The typed number, with every input-safety rule in one place:
 * - digits, Backspace and Enter from the keyboard (no click needed first); key auto-repeat is ignored;
 * - at most `maxDigits` digits (what the fleet could need, plus one); a leading 0 is replaced, and "0" alone is an answer;
 * - nothing happens while `live` is false (the fleet is not ready, or a card or the pause menu is open);
 * - `onChange` runs on every change (the arena's `setCharge`).
 */
export function useEntry({ maxDigits, live, onChange, onFire }: {
  maxDigits: number; live: boolean; onChange?: (n: number | null) => void; onFire: (n: number) => boolean | void;
}) {
  const [entry, setState] = useState("");
  // the latest value, so a digit and Enter in the same frame (fast fingers, scripts) are never lost
  const now = useRef("");
  const cb = useRef({ maxDigits, live, onChange, onFire });
  useEffect(() => { cb.current = { maxDigits, live, onChange, onFire }; });
  // Fire pressed while the fleet warps in or a shot plays out: it waits and goes once the keypad is live
  // (a fast player's answer is never swallowed). Digits typed meanwhile wait on the button the same way.
  const pending = useRef(false);
  const set = useCallback((v: string) => {
    pending.current = false;
    if (v === now.current) return;
    now.current = v;
    setState(v);
    cb.current.onChange?.(v === "" ? null : Number(v));
  }, []);
  const press = useCallback((k: string) => {
    const { live: ok, maxDigits: cap } = cb.current;
    const v = now.current;
    if (k === "del") { pending.current = false; return set(v.slice(0, -1)); }
    if (k === "fire") {
      if (v === "") return;
      if (!ok) { pending.current = true; return; }
      pending.current = false;
      // a handler that refuses (returns false) keeps the number on the button
      if (cb.current.onFire(Number(v)) !== false) set("");
      return;
    }
    if (!/^\d$/.test(k)) return;
    const next = v === "0" ? k : v + k;
    if (next.length > cap) return;
    set(next);
  }, [set]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, [contenteditable]")) return;
      // Enter on a focused button presses that button; it must not also fire. The Power-Ups button is the
      // exception: focus returns to it when its list closes, and Enter there still fires (Space opens the list)
      if (e.key === "Enter" && t?.closest?.("button, a") && !t.closest("[data-enter-fires]")) return;
      // a card or the pause menu is up (the X-Ray is a drawer, not a dialog: typing goes on behind it)
      if (document.querySelector(CARD_OPEN)) return;
      if (/^\d$/.test(e.key)) { press(e.key); return; }
      if (e.key === "Backspace") { e.preventDefault(); press("del"); return; }
      if (e.key === "Enter") { e.preventDefault(); press("fire"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);
  useEffect(() => { if (live && pending.current) press("fire"); }, [live, press]);
  return { entry, press, set };
}

/** A press with the mouse or a finger leaves focus on the game, so Enter still fires and digits still type. */
const keep = (e: React.MouseEvent) => e.preventDefault();

/** One Power-Up (or empty) slot: a round labelled button, the glyph inside, the name under it where there is room. */
export function Slot({ label, glyph, onPress, disabled, pressed, pulse }: {
  label: string; glyph: ReactNode; onPress: () => void; disabled?: boolean; pressed?: boolean; pulse?: boolean;
}) {
  return (
    <Button className={css.slot} onMouseDown={keep} aria-label={`Power-Up ${label}`} title={label} aria-pressed={pressed} disabled={disabled} onClick={onPress}>
      <span className={css.ring}>{glyph}{pulse && !disabled && <span className={css.orbit} aria-hidden />}</span>
      <span className={css.slotName} aria-hidden>{label}</span>
    </Button>
  );
}
export const EmptySlot = () => <span className={css.empty} aria-hidden />;

/**
 * The console: one instrument band with the same anatomy everywhere (keypad, Fire, Power-Ups, Delete, help).
 * `slots` holds the one Power-Ups button (PowerUpsButton), or an empty reserved space of the same size.
 * Its size and place depend only on the screen, never on the game: everything that comes and goes
 * fills a slot it already reserves. There is no input box: the number shows on Fire ("Fire 42").
 */
export function Console({ layout, entry, live, fireWord = "Fire", onKey, slots, help, consoleRef, label = "Console" }: {
  layout: ConsoleLayout;
  entry: string;
  /** The fleet is ready and no card is open: keys and Fire work. */
  live: boolean;
  /** "Fire", or "Lock" while a Sector-Lock sector is chosen. */
  fireWord?: string;
  onKey: (k: string) => void;
  /** The Power-Up slots (or the Sector-Lock row). Empty slots stay quiet. */
  slots?: ReactNode;
  /** Show Me How; null keeps its place quiet (warm-ups). */
  help?: { onPress: () => void; disabled: boolean; invite: boolean } | null;
  consoleRef?: Ref<HTMLDivElement>;
  label?: string;
}) {
  const n = entry === "" ? null : Number(entry);
  const loaded = n !== null && live;
  const digits = entry.length + Math.floor(Math.max(0, entry.length - 1) / 3);
  const fireN: CSSProperties = digits > 5 ? { fontSize: "calc(var(--fire-n, 44px) * 0.58)" } : digits > 3 ? { fontSize: "calc(var(--fire-n, 44px) * 0.76)" } : {};
  return (
    <div ref={consoleRef} className={css.console} data-layout={layout} role="group" aria-label={label}>
      <div className={css.grid} data-guide="keypad">
        {DIGITS.map((d) => (
          <Button key={d} className={css.key} onMouseDown={keep} style={{ gridArea: `k${d}` }} aria-label={d} disabled={!live} data-key={d}
            onClick={() => onKey(d)}>{d}</Button>
        ))}
        <Button className={`mw-btn mw-primary ${css.fire}`} onMouseDown={keep} data-guide="fire" data-armed={loaded || undefined} disabled={!loaded}
          aria-label={n === null ? fireWord : `${fireWord} ${fmtN(n)}`} onClick={() => onKey("fire")}>
          <span className={css.fireWord}>{fireWord}</span>
          <span className={css.fireGlyph}><RocketGlyph size={30} /></span>
          <span className={css.fireNumber} style={fireN}>{n === null ? "" : fmtN(n)}</span>
        </Button>
        {/* Power-Ups, Delete and Show me how: their own row on a phone held upright, their own places elsewhere */}
        <div className={css.tools}>
          <div className={css.slots}>{slots}</div>
          <Button className={`${css.key} ${css.del}`} onMouseDown={keep} aria-label="Delete" title="Delete" disabled={!live || entry === ""} onClick={() => onKey("del")}>
            <Icon name="delete" size={22} />
          </Button>
          {help === null || help === undefined ? (
            <span className={css.help} data-quiet aria-hidden />
          ) : (
            <Button className={css.help} onMouseDown={keep} data-guide="help" disabled={help.disabled} data-invite={help.invite || undefined} aria-label="Show me how" title="Show me how" onClick={help.onPress}>
              <span className={css.ring}><NovaPortrait size={layout === "strip" ? 40 : 30} /></span>
              <span className={css.helpWords}>Show me how</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
