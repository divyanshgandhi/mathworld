import type { SVGProps } from "react";

/**
 * The one icon set: drawn on a 24 px grid in a single 1.7 px stroke, round caps and joins,
 * `currentColor` only, so an icon takes the colour of the text around it. Never use emoji or
 * Unicode glyphs as icons; add a path here instead.
 */
const PATHS = {
  rocket: (
    <>
      <path d="M12 3c3.5 2.8 4.8 7 4 12h-8c-.8-5 .5-9.2 4-12z" />
      <circle cx="12" cy="9.5" r="1.6" />
      <path d="M8.3 15l-2.3 4M15.7 15l2.3 4M12 17.5v3" />
    </>
  ),
  // decision 8: an orb is a gold ring (with a count beside it), never a filled bullseye like Gold mastery.
  // The short arc inside is a highlight, so the ring reads as a sphere.
  orb: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.2 10.4a4.3 4.3 0 0 1 3-3" />
    </>
  ),
  plasma: (
    <>
      <circle cx="14" cy="12" r="4.5" />
      <path d="M3.5 9h4M2.5 12h5M3.5 15h4" />
    </>
  ),
  play: <path d="M9 6.5l8.5 5.5L9 17.5z" />,
  map: (
    <>
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-20 12 12)" />
    </>
  ),
  help: (
    <>
      <path d="M9.2 9.3a2.9 2.9 0 1 1 4 2.7c-.7.3-1.2 1-1.2 1.8v.6" />
      <circle cx="12" cy="17.6" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  "sound-on": (
    <>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.4a8 8 0 0 1 0 11.2" />
    </>
  ),
  "sound-off": (
    <>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
      <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
    </>
  ),
  home: (
    <>
      <path d="M4 11l8-6.5 8 6.5" />
      <path d="M6.5 9.5V19h11V9.5" />
      <path d="M10 19v-4.5h4V19" />
    </>
  ),
  menu: <path d="M5 7.5h14M5 12h14M5 16.5h14" />,
  lock: (
    <>
      <rect x="6" y="10.5" width="12" height="9" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  trick: (
    <>
      <rect x="5.5" y="4" width="13" height="16" rx="2" />
      <path d="M12 8.2l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" />
    </>
  ),
  cards: (
    <>
      <rect x="8" y="5" width="11" height="14" rx="2" />
      <path d="M5.5 7.5v10A2.5 2.5 0 0 0 8 20h8" />
    </>
  ),
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  back: <path d="M14.5 6l-6 6 6 6" />,
  forward: <path d="M9.5 6l6 6-6 6" />,
  jump: <path d="M6 6.5l5.5 5.5L6 17.5M12.5 6.5L18 12l-5.5 5.5" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  flag: (
    <>
      <path d="M6.5 20.5V4" />
      <path d="M6.5 5h10.5l-2.2 3.6L17 12H6.5" />
    </>
  ),
  star: <path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4L12 16.3l-4.8 2.6 1-5.4-4-3.8 5.4-.7z" />,
  delete: (
    <>
      <path d="M9 6h10a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 18H9l-5.5-6z" />
      <path d="M11.5 9.5l5 5M16.5 9.5l-5 5" />
    </>
  ),
  cadet: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  hangar: (
    <>
      <path d="M3.5 19.5V11a8.5 8.5 0 0 1 17 0v8.5" />
      <path d="M3 19.5h18M8 19.5v-6h8v6" />
    </>
  ),
  academy: (
    <>
      <path d="M3 9.5L12 5l9 4.5-9 4.5z" />
      <path d="M7 11.5v4c1.4 1.4 3 2 5 2s3.6-.6 5-2v-4M21 9.5v5" />
    </>
  ),
  bay: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="19.2" cy="7.2" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  minus: <path d="M5.5 12h13" />,
} as const;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

/**
 * An icon from the set. Decorative by default (`aria-hidden`); pass `label` when the icon is the
 * only thing that says what it means (the control around it should usually carry the name instead).
 */
export function Icon({ name, size = 20, label, className = "", ...rest }: { name: IconName; size?: number; label?: string } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      data-icon={name}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

/**
 * The ring-and-rocket glyph that rides on the right of every primary action: a dashed gold orbit
 * with the cadet's rocket in it. It lifts on hover (see kit.css), and goes grey when disabled.
 */
export function RocketGlyph({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} aria-hidden focusable="false" className={`mw-glyph shrink-0 ${className}`}>
      <circle cx="22" cy="22" r="20" className="fill-none stroke-gold" strokeWidth="1.3" strokeDasharray="2 3.4" />
      <path d="M22 10c4.5 3.6 6.4 9 5.4 15.5h-10.8C15.6 19 17.5 13.6 22 10z" className="fill-approach" />
      <circle cx="22" cy="18.5" r="2.2" className="fill-void" />
      <path d="M18.5 25.5l-3 4.5M25.5 25.5l3 4.5" className="stroke-approach" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M22 27v6" className="stroke-ember" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
