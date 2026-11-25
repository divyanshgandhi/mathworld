import type { HTMLAttributes, ReactNode } from "react";

/** The class string for a sheet, for parts that render their own element (a DialogContent). */
export const sheetClass = "mw-sheet";

/**
 * The rare raised panel: 16 px radius, a 1 px hairline, a near-black fill. No glass, no blur,
 * no shadow. Most of a screen sits straight on the void; reach for a sheet only for something
 * opened on top (the facts of one table, a pause menu, a sign-up card).
 */
export function Sheet({ children, className = "", as: As = "div", ...rest }: { children: ReactNode; className?: string; as?: "div" | "section" | "aside" | "form" } & HTMLAttributes<HTMLElement>) {
  return <As className={`${sheetClass} ${className}`} {...rest}>{children}</As>;
}
