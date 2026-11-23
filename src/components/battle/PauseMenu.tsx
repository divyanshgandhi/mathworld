"use client";
import { Button } from "@ui-sdk/react/button";
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@ui-sdk/react/dialog";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { flushed } from "@/engine/outbox";
import { backdrop, dialogBox, ghost, lime } from "./ui";

/**
 * The in-game pause menu (Escape, or the ☰ button): resume, or head for the Solar System map or the
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
      <DialogTrigger aria-label="Menu" className={`${ghost} grid size-10 place-items-center bg-black/40 p-0 text-lg`}>☰</DialogTrigger>
      <DialogBackdrop className={backdrop} />
      <DialogContent className={`${dialogBox} flex w-[min(92vw,340px)] flex-col gap-3 p-6 text-center`}>
        <DialogTitle className="font-mono text-xs tracking-[0.3em] text-lime-300">{label.toUpperCase()}</DialogTitle>
        <DialogClose className={`${lime} py-3 text-base`}>Resume</DialogClose>
        <Button className={`${ghost} py-3 text-base`} onClick={() => void go("/map")}>Solar System map</Button>
        <Button className={`${ghost} py-3 text-base`} onClick={() => void go("/bay")}>Resting Bay</Button>
      </DialogContent>
    </Dialog>
  );
}
