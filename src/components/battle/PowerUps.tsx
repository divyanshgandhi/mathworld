"use client";
import { Button } from "@ui-sdk/react/button";
import { Popover, PopoverClose, PopoverContent, PopoverTitle } from "@ui-sdk/react/popover";
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type Ref } from "react";
import { dialogClass } from "@/components/kit/Dialog";
import { buttonClass } from "@/components/kit/Button";
import { Icon } from "@/components/kit/Icon";
import type { TrickId } from "@/rig/tricks";
import { useNarrow, type ConsoleLayout } from "./layout";
import { POWERUP_DOES, PowerUpGlyph, SECTOR_LOCK_DOES } from "./PowerUpGlyph";
import { css } from "./cockpit";

/** One Power-Up on the belt, as the list shows it. */
export type BeltItem = { id: TrickId; card: string; fits: boolean; active: boolean };

/** The words for an empty list of fits. */
export const NONE_FIT = "No Power-Up fits this fleet. Tap Show me how.";

/**
 * The belt in the order the list shows it: the hinted one first, then the ones that fit this fleet,
 * then the rest (dim). Belt order is kept inside each group.
 */
export function orderBelt(belt: BeltItem[], hinted: TrickId | null | undefined): BeltItem[] {
  const rank = (t: BeltItem) => (t.id === hinted && t.fits ? 0 : t.fits ? 1 : 2);
  return belt.map((t, i) => ({ t, i })).sort((x, y) => rank(x.t) - rank(y.t) || x.i - y.i).map((x) => x.t);
}

const keep = (e: React.MouseEvent) => e.preventDefault();

/**
 * The one Power-Ups button: a glyph and the word. Its place on the console is always reserved; with
 * nothing on the belt it is an empty space of the same size. `orbit`: the slow dashed gold orbit the
 * hint puts round it after a second miss (it holds still under reduced motion).
 * `data-enter-fires`: Enter on it still fires the loaded number (Space opens the list).
 */
export function PowerUpsButton({ empty, disabled, orbit, reduced, onPress, buttonRef, open }: {
  empty: boolean; disabled: boolean; orbit: boolean; reduced: boolean; onPress: () => void; buttonRef?: Ref<HTMLButtonElement>; open: boolean;
}) {
  // an empty belt: a reserved space, no anchor, so a tour never spotlights nothing
  if (empty) return <span className={css.puButton} data-empty aria-hidden />;
  return (
    <Button ref={buttonRef} className={css.puButton} onMouseDown={keep} data-guide="powerups" data-enter-fires aria-haspopup="dialog" aria-expanded={open}
      aria-keyshortcuts="P" title="Power-Ups (P)" disabled={disabled} data-hinted={orbit || undefined} onClick={onPress}>
      <span className={css.puRing}>
        <Icon name="trick" size={20} />
        {orbit && !disabled && <span className={css.orbit} data-still={reduced || undefined} aria-hidden />}
      </span>
      <span className={css.puWord}>Power-Ups</span>
    </Button>
  );
}

/**
 * The list the button opens. On a phone held upright (under 600 px wide) it is the kit's bottom sheet; elsewhere a small
 * dialog anchored to the button (above it on a wide screen, beside it on a phone on its side).
 * One row per Power-Up on the belt: glyph, name, what it does, and its state. A row that fits is a
 * button; one that does not is dim. Arrow keys move between rows, Enter or a tap runs one (once).
 */
export function PowerUpList({ open, onClose, onPick, belt, hinted, layout, anchor }: {
  open: boolean;
  onClose: () => void;
  /** A fitting row was chosen: the list is already closing. Called once per opening. */
  onPick: (id: TrickId) => void;
  belt: BeltItem[];
  hinted: TrickId | null | undefined;
  layout: ConsoleLayout;
  anchor: HTMLElement | null;
}) {
  const picked = useRef(false);
  useEffect(() => { if (open) picked.current = false; }, [open]);
  const rows = orderBelt(belt, hinted);
  const anyFits = rows.some((t) => t.fits);
  // a phone held upright: the kit's bottom sheet; a tablet held upright, a laptop, a phone on its side: beside the button
  const narrow = useNarrow();
  const sheet = layout === "pad" && narrow;
  const pick = (id: TrickId) => {
    if (picked.current) return;
    picked.current = true;
    onClose();
    onPick(id);
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const all = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-row]:not([data-dim])"));
    if (!all.length) return;
    e.preventDefault();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? all.length - 1
      : e.key === "ArrowDown" ? (at + 1) % all.length : (at - 1 + all.length) % all.length;
    all[next]?.focus();
  };
  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) onClose(); }} modal presentation={sheet ? "sheet" : "popover"}>
      <PopoverContent anchor={anchor} side={layout === "column" ? "left" : "top"} align={layout === "column" ? "end" : "start"} sideOffset={12} collisionPadding={12}
        className={sheet ? `${dialogClass} ${css.puSheet}` : `mw-sheet ${css.puPop}`} data-layout={layout}
        initialFocus={() => anchor?.ownerDocument.querySelector<HTMLElement>("[data-pu-list] [data-row]:not([data-dim])") ?? null}
        finalFocus={anchor ?? undefined}>
        <div className={css.puHead}>
          <PopoverTitle className={css.puTitle}>Power-Ups</PopoverTitle>
          <PopoverClose aria-label="Close" title="Close" className={`${buttonClass("icon")} -mr-2`}>
            <Icon name="close" size={20} />
          </PopoverClose>
        </div>
        {!anyFits && <p className={css.puNone}>{NONE_FIT}</p>}
        <div className={css.puList} data-pu-list role="list" aria-label="Power-Ups on your belt" onKeyDown={onKeyDown}>
          {rows.map((t) => {
            const lock = t.card === "Sector-Lock";
            const does = lock ? SECTOR_LOCK_DOES : POWERUP_DOES[t.id];
            const body = (
              <>
                <span className={css.puRowRing}><PowerUpGlyph id={t.id} lock={lock} size={22} /></span>
                <span className={css.puRowText}>
                  <span className={css.puRowName}>
                    {t.card}
                    {t.fits && t.id === hinted && <span className={css.puChip}>Try this</span>}
                  </span>
                  <span className={css.puRowDoes}>{t.fits ? does : "Not for this fleet"}</span>
                </span>
                {t.fits && <span className={css.puRowState}>{t.active ? "On" : null}</span>}
              </>
            );
            return (
              <div key={t.id} role="listitem">
                {t.fits ? (
                  <Button className={css.puRow} data-row aria-pressed={t.active} onClick={() => pick(t.id)}>{body}</Button>
                ) : (
                  <div className={css.puRow} data-row data-dim aria-disabled="true">{body}</div>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
