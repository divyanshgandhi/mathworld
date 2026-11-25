"use client";
import { Button } from "@ui-sdk/react/button";
import { useEffect, useSyncExternalStore } from "react";
import { audio } from "@/engine/audio";
import { buttonClass } from "./kit/Button";
import { topBars } from "./kit/chrome";
import { Icon } from "./kit/Icon";

const toggleSound = () => {
  if (audio.muted) audio.unlock(); // a click or key press is a gesture: make sure the context is running
  audio.setMuted(!audio.muted);
};

/** The kit's sound button: a round 44 px icon button that mutes and unmutes the whole game. */
export function SoundButton({ className = "" }: { className?: string }) {
  const muted = useSyncExternalStore(audio.subscribe, () => audio.muted, () => false);
  return (
    <Button
      aria-label={muted ? "Sound off. Turn sound on" : "Sound on. Mute"}
      aria-pressed={muted}
      title={muted ? "Sound off (M)" : "Mute (M)"}
      onClick={toggleSound}
      // aria-pressed here means "muted", not "chosen": keep the plain icon look in both states
      className={`${buttonClass("icon")} aria-pressed:border-line-2 aria-pressed:bg-transparent ${muted ? "text-ink-3" : "text-ink-1"} ${className}`}
    >
      <Icon name={muted ? "sound-off" : "sound-on"} size={20} />
    </Button>
  );
}

/**
 * The speaker in the top-right corner of every screen (M key too). While a TopBar is mounted the
 * bar owns the sound button and this floating one hides; the M key always works.
 */
export function SoundToggle() {
  const bar = useSyncExternalStore(topBars.subscribe, topBars.count, () => 0) > 0;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.code !== "KeyM" || e.repeat || e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, textarea, [contenteditable]")) return;
      toggleSound();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  if (bar) return null;
  return <SoundButton className="fixed right-3 top-3 z-50 bg-void" />;
}
