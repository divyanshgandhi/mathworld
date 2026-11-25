"use client";
import { Button } from "@ui-sdk/react/button";
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@ui-sdk/react/dialog";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { audio } from "@/engine/audio";
import { flushed } from "@/engine/outbox";
import { Icon } from "@/components/kit/Icon";
import { backdrop, dialogBox, ghost, lime, quiet } from "./ui";

/**
 * The in-game pause menu (Escape opens and closes it, or the menu button): resume, how to play, sound,
 * or head for the Star map or the Resting Bay. Events still in flight are stored before leaving.
 */
export function PauseMenu({ label = "Battle paused" }: { label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const muted = useSyncExternalStore(audio.subscribe, () => audio.muted, () => false);
  // Escape toggles the menu. The listener runs in the capture phase, before the dialog's own Escape
  // handling, and reads the state from a ref: a listener re-registered mid-event (React flushes the
  // dialog's own close between listeners) would otherwise see "closed" and open the menu again.
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.repeat) return;
      e.preventDefault();
      const next = !openRef.current;
      openRef.current = next;
      setOpen(next);
      if (!next) setHelp(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  const go = async (to: string) => { setOpen(false); await flushed(); router.push(to); };
  const sound = () => { if (audio.muted) audio.unlock(); audio.setMuted(!audio.muted); };
  return (
    <Dialog open={open} onOpenChange={(o) => { openRef.current = o; setOpen(o); if (!o) setHelp(false); }}>
      <DialogTrigger aria-label="Menu" title="Menu (Esc)" className="mw-btn mw-icon bg-void"><Icon name="menu" size={20} /></DialogTrigger>
      <DialogBackdrop className={backdrop} />
      <DialogContent className={`${dialogBox} flex w-[min(92vw,380px)] flex-col gap-3 p-6 text-center`}>
        <DialogTitle className="mb-2 type-display text-[30px]">{label}</DialogTitle>
        <DialogClose className={`${lime} min-h-13 text-base`}>Resume</DialogClose>
        <Button className={`${ghost} min-h-13 text-base`} aria-expanded={help} onClick={() => setHelp((h) => !h)}><Icon name="help" size={20} />How to play</Button>
        {help && (
          <div className="rounded-chip border border-line-1 px-4 py-3 text-left type-body text-ink-2">
            <p>Each row of ships is a squad. Count the squads, and the ships in one squad.</p>
            <p className="mt-2">Type how many ships there are in all, then press Fire. You fire exactly that many plasma balls.</p>
            <p className="mt-2">Stuck? Tap Show Me How and Nova shows you.</p>
          </div>
        )}
        <Button className={`${ghost} min-h-13 text-base`} aria-pressed={!muted} onClick={sound}><Icon name={muted ? "sound-off" : "sound-on"} size={20} />{muted ? "Sound is off" : "Sound is on"}</Button>
        <Button className={`${quiet} min-h-13 text-base`} onClick={() => void go("/map")}><Icon name="map" size={20} />Star map</Button>
        <Button className={`${quiet} min-h-13 text-base`} onClick={() => void go("/bay")}><Icon name="bay" size={20} />Resting Bay</Button>
      </DialogContent>
    </Dialog>
  );
}
