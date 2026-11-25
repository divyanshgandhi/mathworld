"use client";
import { Button } from "@ui-sdk/react/button";
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@ui-sdk/react/dialog";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { audio } from "@/engine/audio";
import { flushed } from "@/engine/outbox";
import { buttonClass } from "@/components/kit/Button";
import { Icon, RocketGlyph } from "@/components/kit/Icon";
import { FieldManual } from "@/components/teach/FieldManual";
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
 * How to play opens the Field Manual over the menu, on its "count" page; Escape then closes the manual
 * and leaves the menu open. `places={false}` drops Star map and Resting Bay (Cadet Bay, before the bay exists).
 */
export function PauseMenu({ label = "Paused", blocked = false, onOpenChange, places = true, leave }: {
  label?: string; blocked?: boolean; onOpenChange?: (open: boolean) => void; places?: boolean;
  /** One quiet way out where Star map and Resting Bay do not exist yet (the first battle, inside the film). */
  leave?: { label: string; href: string };
}) {
  const router = useRouter();
  const [open, setOpenState] = useState(false);
  const [help, setHelp] = useState(false);
  const muted = useSyncExternalStore(audio.subscribe, () => audio.muted, () => false);
  const openRef = useRef(open), blockedRef = useRef(blocked), cb = useRef(onOpenChange), helpRef = useRef(help);
  useEffect(() => { blockedRef.current = blocked; cb.current = onOpenChange; helpRef.current = help; });
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
      // the Field Manual is open over the menu: Escape is the manual's, and the menu stays
      if (helpRef.current) return;
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
      <DialogTrigger aria-label="Pause" title="Pause (Esc)" data-guide="pause" className="mw-btn mw-icon bg-void"><Icon name="menu" size={20} /></DialogTrigger>
      <DialogBackdrop className={backdrop} />
      <DialogContent className={`${dialogBox} flex w-[min(92vw,400px)] flex-col gap-2.5 p-6`} initialFocus="[data-primary]">
        <DialogTitle className="mb-3 text-center type-display text-[34px]">{label}</DialogTitle>
        <DialogClose data-primary className={`${buttonClass("primary", "md", true)} mb-2 w-full justify-between`}>Resume<RocketGlyph size={34} /></DialogClose>
        <Button className={row} aria-haspopup="dialog" onClick={() => { helpRef.current = true; setHelp(true); }}><Icon name="help" size={20} />How to play</Button>
        <Button className={row} aria-pressed={!muted} onClick={sound}><Icon name={muted ? "sound-off" : "sound-on"} size={20} />{muted ? "Sound is off" : "Sound is on"}</Button>
        {places && <Button className={row} onClick={() => void go("/map")}><Icon name="map" size={20} />Star map</Button>}
        {places && <Button className={row} onClick={() => void go("/bay")}><Icon name="bay" size={20} />Resting Bay</Button>}
        {!places && leave && <Button className={row} onClick={() => void go(leave.href)}><Icon name="home" size={20} />{leave.label}</Button>}
        {/* nested in the menu, so the manual sits on top of it and closing it comes back here */}
        <FieldManual open={open && help} onClose={() => { helpRef.current = false; setHelp(false); }} topic="count" />
      </DialogContent>
    </Dialog>
  );
}
