import type { ReactNode } from "react";

/** The ring logo: a white orbit, a gold inner ring and a moon. */
export function RingLogo({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 34 34" width={size} height={size} aria-hidden focusable="false" className={`shrink-0 ${className}`}>
      <circle cx="17" cy="17" r="15.2" className="fill-none stroke-approach" strokeWidth="1.1" />
      <circle cx="17" cy="17" r="7.5" className="fill-none stroke-gold" strokeWidth="1.1" />
      <circle cx="29.6" cy="8.8" r="1.9" className="fill-approach" />
    </svg>
  );
}

/**
 * The Math World wordmark: the ring logo and MATH WORLD in the display voice.
 * `sm` is the top-bar size (the name hides on phones), `lg` the title-screen lockup.
 */
export function Wordmark({ size = "sm", className = "" }: { size?: "sm" | "lg"; className?: string }) {
  if (size === "lg") {
    return (
      <span className={`flex items-center gap-[clamp(16px,2vw,28px)] ${className}`}>
        <RingLogo size={84} className="h-auto w-[clamp(40px,6vw,84px)]" />
        <span className="whitespace-nowrap text-[clamp(26px,5.2vw,80px)] font-extralight uppercase leading-none tracking-[0.14em] [font-stretch:125%]">Math World</span>
      </span>
    );
  }
  return (
    <span className={`flex items-center gap-3.5 ${className}`}>
      <RingLogo size={34} />
      <span className="hidden whitespace-nowrap text-[17px] font-light uppercase tracking-[0.42em] [font-stretch:125%] md:inline">Math World</span>
    </span>
  );
}

/** Nova's face: a white pod, a dark visor with blue eyes, ember ear lights. */
export function NovaPortrait({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden focusable="false" className={`shrink-0 ${className}`}>
      <circle cx="24" cy="24" r="15" className="fill-approach" />
      <rect x="14" y="17" width="20" height="13" rx="6.5" className="fill-shadow" />
      <circle cx="19.5" cy="23.5" r="2.2" className="fill-sky" />
      <circle cx="28.5" cy="23.5" r="2.2" className="fill-sky" />
      <path d="M20.5 33c2.2 1.5 4.8 1.5 7 0" className="fill-none stroke-disk" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8.5" cy="24" r="3" className="fill-ember" />
      <circle cx="39.5" cy="24" r="3" className="fill-ember" />
    </svg>
  );
}

/**
 * One spoken line: a portrait, the speaker's name, the words. Used for Nova in the bay, in battle
 * and in the film, so every voice in the game looks the same. `portrait` replaces Nova's face for
 * another speaker; `size="child"` (the default) keeps the words at 19 px.
 */
export function NovaLine({ speaker = "Nova", portrait, children, size = "child", live = false, className = "" }: {
  speaker?: string; portrait?: ReactNode; children: ReactNode; size?: "child" | "body"; live?: boolean; className?: string;
}) {
  return (
    <div className={`flex items-center gap-4 ${className}`} role={live ? "status" : undefined} aria-live={live ? "polite" : undefined}>
      {portrait ?? <NovaPortrait />}
      <p className={`m-0 max-w-[34ch] ${size === "child" ? "type-child" : "type-body"}`}>
        <b className="font-semibold text-sky">{speaker}:</b> {children}
      </p>
    </div>
  );
}
