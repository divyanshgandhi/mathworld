import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * Nothing here yet, said plainly, with the way forward. A dashed orbit (the house motif) around one
 * icon, a short title, one sentence, and at most one action. Not a card: it sits on the void.
 *
 * Do: say what will fill this place and how ("Win a Show Me How in battle to earn your first trick.").
 * Do not: apologise, joke, or show an empty state while something is still loading (use `Loading`).
 */
export function EmptyState({ icon = "star", title, children, action, className = "" }: {
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
  /** One button or link: the way forward. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-4 py-8 text-center ${className}`}>
      <span className="mw-orbit grid size-20 place-items-center text-ink-2" aria-hidden>
        <Icon name={icon} size={26} />
      </span>
      <p className="m-0 type-name text-[22px]">{title}</p>
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
