"use client";
import { Button } from "@ui-sdk/react/button";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { audio } from "@/engine/audio";
import { ghost } from "./battle/ui";

/** The speaker in the top-right corner of every screen: mutes and unmutes the whole game (M key too). */
export function SoundToggle() {
  const muted = useSyncExternalStore(audio.subscribe, () => audio.muted, () => false);
  const toggle = useCallback(() => {
    if (audio.muted) audio.unlock(); // a click or key press is a gesture: make sure the context is running
    audio.setMuted(!audio.muted);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.code !== "KeyM" || e.repeat || e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, textarea, [contenteditable]")) return;
      toggle();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [toggle]);
  return (
    <Button
      aria-label={muted ? "Sound off. Turn sound on" : "Sound on. Mute"}
      aria-pressed={muted}
      title={muted ? "Sound off (M)" : "Mute (M)"}
      onClick={toggle}
      className={`${ghost} fixed right-3 top-3 z-50 grid size-10 place-items-center bg-black/45 p-0 backdrop-blur-sm ${muted ? "text-white/55" : "text-white"}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
        {muted ? <path d="m16 9 6 6m0-6-6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
      </svg>
    </Button>
  );
}
