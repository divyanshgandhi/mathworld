"use client";
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@ui-sdk/react/dialog";
import type { ComponentProps, ReactNode } from "react";
import { buttonClass } from "./Button";
import { Icon } from "./Icon";

/** The plain scrim behind a modal: the void at 72%, no blur. For a DialogBackdrop you compose yourself. */
export const scrimClass = "mw-scrim";
/** A centred sheet in the top layer (or a bottom sheet on a phone). For a DialogContent you compose yourself. */
export const dialogClass = "mw-sheet mw-dialog";

/**
 * The kit's dialog and sheet, on the ui-sdk Dialog: a plain scrim, a sheet with a title, optional
 * words under it, the content, and the actions at the bottom. Escape, a press on the scrim and a
 * round Close button all close it; focus returns to where it came from.
 *
 * Use it only for something that needs an interruption: a question with a real consequence
 * ("Start as a new cadet?"), or one task opened on top of a screen (flashcards, the Field Manual).
 * - `presentation="auto"` slides it up from the bottom as a sheet on small touch screens.
 * - `actions` sits under the content; give it one primary at most. Use `<DialogClose className={buttonClass(...)}>`
 *   (re-exported here as `SheetClose`) for a button that only closes.
 * - `dismissible={false}` keeps Escape and the scrim from closing it (a task in progress).
 */
export function SheetDialog({
  open, onOpenChange, title, description, children, actions, close = true, presentation = "dialog", dismissible = true, size = "md", initialFocus, className = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The dialog's name, in the display voice. */
  title: ReactNode;
  /** One plain sentence under the title (read by screen readers as the description). */
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** Show the round Close button in the corner. */
  close?: boolean;
  presentation?: "dialog" | "sheet" | "auto";
  dismissible?: boolean;
  /** `sm` 420 px, `md` 520 px, `lg` 720 px wide at most. */
  size?: "sm" | "md" | "lg";
  initialFocus?: ComponentProps<typeof DialogContent>["initialFocus"];
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)} presentation={presentation} dismissible={dismissible} closeOnOutsidePress={dismissible}>
      <DialogBackdrop className={scrimClass} />
      <DialogContent className={`${dialogClass} ${className}`} data-size={size} initialFocus={initialFocus}>
        <div className="flex items-start justify-between gap-4">
          <DialogTitle className="m-0 type-display text-[clamp(28px,4vw,36px)] leading-none">{title}</DialogTitle>
          {close && (
            <DialogClose aria-label="Close" title="Close" className={`${buttonClass("icon")} -mr-2 -mt-2`}>
              <Icon name="close" size={20} />
            </DialogClose>
          )}
        </div>
        {description && <DialogDescription className="m-0 mt-3 max-w-[46ch] type-child text-ink-2">{description}</DialogDescription>}
        {children && <div className="mt-5">{children}</div>}
        {actions && <div className="mw-dialog-actions">{actions}</div>}
      </DialogContent>
    </Dialog>
  );
}

/** A button that only closes the dialog it sits in. Pass the kit's look: `className={buttonClass("secondary")}`. */
export { DialogClose as SheetClose };
