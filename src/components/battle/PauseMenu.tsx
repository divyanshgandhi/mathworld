"use client";
import { Button } from "@ui-sdk/react/button";
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@ui-sdk/react/dialog";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { flushed } from "@/engine/outbox";
import { Icon } from "@/components/kit/Icon";
import { backdrop, dialogBox, ghost, lime } from "./ui";

/**
 * The in-game pause menu (Escape, or the menu button): resume, or head for the Solar System map or the
 * Resting Bay. Events still in flight are stored before leaving.
 */
export function PauseMenu({ label = "Battle paused" }: { label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !open) { e.preventDefault(); setOpen(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const go = async (to: string) => { setOpen(false); await flushed(); router.push(to); };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger aria-label="Menu" title="Menu (Esc)" className="mw-btn mw-icon bg-void"><Icon name="menu" size={20} /></DialogTrigger>
      <DialogBackdrop className={backdrop} />
      <DialogContent className={`${dialogBox} flex w-[min(92vw,360px)] flex-col gap-3 p-6 text-center`}>
        <DialogTitle className="mb-2 type-display text-[30px]">{label}</DialogTitle>
        <DialogClose className={`${lime} min-h-13 text-base`}>Resume</DialogClose>
        <Button className={`${ghost} min-h-13 text-base`} onClick={() => void go("/map")}><Icon name="map" size={20} />Solar System map</Button>
        <Button className={`${ghost} min-h-13 text-base`} onClick={() => void go("/bay")}><Icon name="bay" size={20} />Resting Bay</Button>
      </DialogContent>
    </Dialog>
  );
}
