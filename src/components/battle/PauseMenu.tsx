"use client";
import { Button } from "@ui-sdk/react/button";
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@ui-sdk/react/dialog";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { audio } from "@/engine/audio";
import { flushed } from "@/engine/outbox";
import { buttonClass } from "@/components/kit/Button";
import { Icon, RocketGlyph } from "@/components/kit/Icon";
import { CARD_OPEN } from "./Console";
import { hold } from "./pause";
import { backdrop, dialogBox } from "./ui";

/**
 * The game holds still while the tab is hidden (another tab, a locked phone) and runs on when it
 * comes back, exactly where it was. A pause the player chose stays a pause.
 */
export function usePauseWhenHidden() {
  useEffect(() => {
    const sync = () => (document.visibilityState === "hidden" ? hold.on("hidden") : hold.off("hidden"));
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => { document.removeEventListener("visibilitychange", sync); hold.off("hidden"); };
  }, []);
}

/**
 * The pause menu (Escape, or the menu button): Resume, How to play, Sound, Star map, Resting Bay.
 * Pausing really pauses: the stage clock (every battle timer) and the sound stop until Resume.
 * Events still in flight are stored before leaving. `blocked`: another card is up, so Escape leaves it alone.
 */
export function PauseMenu({ label = "Paused", blocked = false, onOpenChange }: { label?: string; blocked?: boolean; onOpenChange?: (open: boolean) => void }) {
  const router = useRouter();
  const [open, setOpenState] = useState(false);
  const [help, setHelp] = useState(false);
  const muted = useSyncExternalStore(audio.subscribe, () => audio.muted, () => false);
  const openRef = useRef(open), blockedRef = useRef(blocked), cb = useRef(onOpenChange);
  useEffect(() => { blockedRef.current = blocked; cb.current = onOpenChange; });
  const setOpen = (o: boolean) => {
    openRef.current = o;
    setOpenState(o);
    if (!o) setHelp(false);
    if (o) hold.on("menu"); else hold.off("menu");
    cb.current?.(o);
  };
  const setOpenRef = useRef(setOpen);
  useEffect(() => { setOpenRef.current = setOpen; });
  // Escape toggles the menu. Capture phase, state from a ref: a listener re-registered mid-event
  // (React flushes the dialog's own close between listeners) would otherwise open it again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.repeat) return;
      // another card is up (a briefing, a clear): Escape is that card's business
      if (!openRef.current && (blockedRef.current || document.querySelector(CARD_OPEN))) return;
      e.preventDefault();
      setOpenRef.current(!openRef.current);
    };
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); hold.off("menu"); };
  }, []);
  const go = async (to: string) => { setOpen(false); await flushed(); router.push(to); };
  const sound = () => { if (audio.muted) audio.unlock(); audio.setMuted(!audio.muted); };
  const row = `${buttonClass("secondary", "md")} w-full justify-start`;
  return (
    <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
      <DialogTrigger aria-label="Pause" title="Pause (Esc)" className="mw-btn mw-icon bg-void"><Icon name="menu" size={20} /></DialogTrigger>
      <DialogBackdrop className={backdrop} />
      <DialogContent className={`${dialogBox} flex w-[min(92vw,400px)] flex-col gap-2.5 p-6`} initialFocus="[data-primary]">
        <DialogTitle className="mb-3 text-center type-display text-[34px]">{label}</DialogTitle>
        <DialogClose data-primary className={`${buttonClass("primary", "md", true)} mb-2 w-full justify-between`}>Resume<RocketGlyph size={34} /></DialogClose>
        <Button className={row} aria-expanded={help} onClick={() => setHelp((h) => !h)}><Icon name="help" size={20} />How to play</Button>
        {help && (
          <div className="flex flex-col gap-2 px-2 py-1 type-child text-ink-2">
            <p className="m-0">Look at the fleet. How many ships are there in all?</p>
            <p className="m-0">Type the number, then press Fire. You fire exactly that many plasma balls.</p>
            <p className="m-0">Stuck? Press Show me how and Nova will help.</p>
          </div>
        )}
        <Button className={row} aria-pressed={!muted} onClick={sound}><Icon name={muted ? "sound-off" : "sound-on"} size={20} />{muted ? "Sound is off" : "Sound is on"}</Button>
        <Button className={row} onClick={() => void go("/map")}><Icon name="map" size={20} />Star map</Button>
        <Button className={row} onClick={() => void go("/bay")}><Icon name="bay" size={20} />Resting Bay</Button>
      </DialogContent>
    </Dialog>
  );
}
