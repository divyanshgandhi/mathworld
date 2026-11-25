import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Nothing here yet, said plainly, with the way forward. A dashed orbit (the house motif) around one
 * icon, a short title, one sentence, and at most one action. Not a card: it sits on the void.
 *
 * Do: say what will fill this place and how ("Win a Show Me How in battle to earn your first trick.").
 * Do not: apologise, joke, or show an empty state while something is still loading (use `Loading`).
 */
export function EmptyState({ icon = "star", title, children, action, size = "inline", className = "" }: {
  icon?: IconName;
  /** `inline` inside a screen or a sheet; `page` when it is the whole screen (not found, an error). */
  size?: "inline" | "page";
  title: ReactNode;
  children?: ReactNode;
  /** One button or link: the way forward. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-4 py-8 text-center ${className}`}>
      <span className={`mw-orbit grid place-items-center text-ink-2 ${size === "page" ? "mb-2 size-28" : "size-20"}`} aria-hidden>
        <Icon name={icon} size={size === "page" ? 32 : 26} />
      </span>
      {size === "page"
        ? <h1 className="m-0 type-display text-[clamp(36px,6vw,64px)] text-balance">{title}</h1>
        : <p className="m-0 type-name text-[22px]">{title}</p>}
      {children && <p className="m-0 max-w-[36ch] type-child text-ink-2">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * Waiting, on the void: a dashed orbit that turns slowly (still under reduced motion) and, after a
 * moment, one plain line. No spinner, no white flash, and it takes the space the screen will take.
 */
export function Loading({ label = "Loading", className = "" }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`mw-loading ${className}`}>
      <span className="mw-orbit mw-orbit-turn size-14" aria-hidden />
      <span className="mw-loading-words type-body-sm text-ink-3">{label}</span>
    </div>
  );
}
