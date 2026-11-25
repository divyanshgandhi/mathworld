"use client";
import {
  Carousel, CarouselContent, CarouselIndicator, CarouselIndicatorGroup, CarouselItem, CarouselNext, CarouselPrevious, CarouselViewport, createCarouselController,
} from "@ui-sdk/react/carousel";
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogTitle } from "@ui-sdk/react/dialog";
import { useEffect, useState, type KeyboardEvent } from "react";
import { buttonClass } from "@/components/kit/Button";
import { Icon } from "@/components/kit/Icon";
import { manualKey } from "@/teach/keys";
import { MANUAL_PAGES, pageOf, type ManualTopic } from "@/teach/manual";
import { useSeen, type SeenSource } from "@/teach/seen";
import { ManualPicture } from "./ManualScenes";

/**
 * The Field Manual, "How to play": six pages, each one live picture and a line or two at child size.
 * It opens as a sheet over any screen (full screen on a phone) and never needs reading in order.
 *
 *   <FieldManual open={help} onClose={() => setHelp(false)} topic="fire" seen={{ seen: state?.seen, emit }} />
 *
 * - `topic` opens the matching page (default: the first).
 * - Arrow keys page it from anywhere in the sheet; a swipe pages it on touch; the dots jump to a page.
 * - Close is always on screen, and Escape closes it too.
 * - Each page the player lands on is recorded as seen (`manual:<page>`), once.
 * - `seen` is optional: without it the manual reads and writes the log itself (see src/teach/seen.ts).
 */
export function FieldManual({ open, onClose, topic, seen }: { open: boolean; onClose: () => void; topic?: ManualTopic | null; seen?: SeenSource }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogBackdrop className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-scrim p-0" />
      <DialogContent
        initialFocus='[data-slot="carousel-viewport"]'
        className="mw-sheet fixed inset-0 m-0 flex h-dvh max-h-none w-screen max-w-none flex-col rounded-none border-0 bg-panel p-0 text-approach sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(92dvh,720px)] sm:w-[min(92vw,620px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-panel sm:border"
      >
        <ManualBody topic={topic} seen={seen} />
      </DialogContent>
    </Dialog>
  );
}

/** Marks one page as seen once it is the page in view. */
function PageSeen({ id, active, seen }: { id: ManualTopic; active: boolean; seen?: SeenSource }) {
  const { mark } = useSeen(manualKey(id), seen);
  useEffect(() => { if (active) mark(); }, [active, mark]);
  return null;
}

const dotClass = "group grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-gold";

/** The sheet's inside. Mounted each time the manual opens, so it starts on the asked-for page. */
function ManualBody({ topic, seen }: { topic?: ManualTopic | null; seen?: SeenSource }) {
  const [page, setPage] = useState(() => pageOf(topic) + 1);
  const [carousel] = useState(createCarouselController);
  const last = page === MANUAL_PAGES.length;

  // arrow keys page the manual from anywhere in the sheet (the viewport and the dots handle their own)
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    if ((e.target as HTMLElement).closest('[data-slot="carousel-viewport"], [data-slot="carousel-indicator-group"]')) return;
    e.preventDefault();
    if (e.key === "ArrowRight") carousel.next(); else carousel.previous();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKey}>
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 pl-5 pr-3 sm:h-[72px] sm:pl-7 sm:pr-4">
        <DialogTitle className="m-0 type-display text-[22px] sm:text-[26px]">How to play</DialogTitle>
        <DialogClose aria-label="Close" title="Close" className={buttonClass("icon")}><Icon name="close" size={20} /></DialogClose>
      </header>

      <Carousel aria-label="How to play" controller={carousel} page={page} onPageChange={(p) => setPage(p)} className="flex min-h-0 flex-1 flex-col">
        <CarouselViewport className="min-h-0 flex-1 outline-none [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold">
          <CarouselContent className="flex h-full">
            {MANUAL_PAGES.map((p, i) => (
              <CarouselItem key={p.id} aria-label={`${i + 1} of ${MANUAL_PAGES.length}: ${p.name}`} className="flex h-full min-w-0 basis-full flex-col items-center justify-center gap-[clamp(16px,4dvh,32px)] overflow-y-auto px-6 pb-2 sm:px-10">
                <figure className="m-0 w-full max-w-[440px]">
                  <ManualPicture scene={p.scene} active={page === i + 1} />
                </figure>
                <div className="flex max-w-[30ch] flex-col items-center gap-2 text-center">
                  {p.lines.map((l) => <p key={l} className="m-0 text-balance type-child text-[clamp(19px,5.4vw,23px)] leading-snug text-approach">{l}</p>)}
                </div>
                <PageSeen id={p.id} active={page === i + 1} seen={seen} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </CarouselViewport>

        <footer className="flex shrink-0 flex-col items-center gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2 min-[440px]:flex-row min-[440px]:justify-between sm:px-5 sm:pb-5">
          <CarouselIndicatorGroup aria-label="Pages" className="order-1 flex items-center min-[440px]:order-2">
            {MANUAL_PAGES.map((p, i) => (
              <CarouselIndicator key={p.id} page={i + 1} aria-label={p.name} className={dotClass}>
                <span aria-hidden className="block size-2.5 rounded-full border border-line-3 transition-colors duration-quick group-hover:border-approach group-data-selected:border-approach group-data-selected:bg-approach" />
              </CarouselIndicator>
            ))}
          </CarouselIndicatorGroup>
          <div className="order-2 flex w-full items-center justify-between gap-3 min-[440px]:contents">
            <CarouselPrevious aria-label="Back" className={`${buttonClass("secondary", "sm")} min-w-[104px] justify-center data-disabled:invisible min-[440px]:order-1`}>
              <Icon name="back" size={18} />Back
            </CarouselPrevious>
            {last ? (
              <DialogClose className={`${buttonClass("secondary", "sm")} min-w-[104px] justify-center min-[440px]:order-3`}>Done<Icon name="check" size={18} /></DialogClose>
            ) : (
              <CarouselNext aria-label="Next" className={`${buttonClass("secondary", "sm")} min-w-[104px] justify-center min-[440px]:order-3`}>
                Next<Icon name="forward" size={18} />
              </CarouselNext>
            )}
          </div>
        </footer>
      </Carousel>
    </div>
  );
}
