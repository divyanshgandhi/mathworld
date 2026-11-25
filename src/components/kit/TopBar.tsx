"use client";
import { useEffect, type ReactNode } from "react";
import { SoundButton } from "../SoundToggle";
import { IconButton } from "./Button";
import { topBars } from "./chrome";
import { Icon } from "./Icon";

/** The orb count: the gold orb icon, the number, and the word (the word hides on phones). */
export function OrbCount({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 type-number text-[17px] font-medium tracking-[0.06em] ${className}`} aria-label={`${n} orbs`}>
      <Icon name="orb" size={20} className="text-gold" />
      <span aria-hidden>{n.toLocaleString("en-US")}</span>
      <small className="hidden text-[15px] font-normal tracking-normal text-ink-2 sm:inline" aria-hidden>orbs</small>
    </span>
  );
}

/**
 * The one top bar every screen shares, identical everywhere:
 * left, a home or menu slot (`left`) and the screen's name; right, orbs, help and sound.
 * While it is mounted it owns the sound button (the floating one hides). Fixed height (64 px on
 * phones, 76 px on desktop) and it never reflows: give it a short name.
 */
export function TopBar({ title, left, orbs, onHelp, helpLabel = "How to play", right, className = "" }: {
  /** The screen's name in the label voice: "Resting Bay", "Star map". */
  title?: string;
  /** A HomeLink, a PauseMenu trigger, or a Wordmark. */
  left?: ReactNode;
  /** The cadet's orbs; omit to hide the count. */
  orbs?: number | null;
  /** Show the help button and run this on press. */
  onHelp?: () => void;
  helpLabel?: string;
  /** Anything else for the right side, before help and sound. */
  right?: ReactNode;
  className?: string;
}) {
  useEffect(() => topBars.mount(), []);
  return (
    <header className={`mw-topbar ${className}`}>
      {left}
      {title && <h1 className="mw-topbar-title">{title}</h1>}
      <span className="flex-1" />
      {right}
      {orbs != null && <OrbCount n={orbs} />}
      {onHelp && <IconButton icon="help" label={helpLabel} onClick={onHelp} />}
      <SoundButton />
    </header>
  );
}
