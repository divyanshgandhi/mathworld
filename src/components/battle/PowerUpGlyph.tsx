import type { TrickId } from "@/rig/tricks";
import { Icon } from "@/components/kit/Icon";

/**
 * One drawn mark per Power-Up, in the kit's icon style (a 24 px grid, one 1.7 px stroke, currentColor).
 * Each is a small picture of what the trick does to a fleet's rows and columns, so the slots tell
 * themselves apart on a phone where there is no room for names. The name is always the button's label.
 */
const DOTS = (y: number) => [5, 8.5, 12, 15.5, 19].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.35" fill="currentColor" stroke="none" />);

const GLYPH: Record<TrickId, React.ReactNode> = {
  // two equal halves: count one, then double
  "double-it": <><rect x="4" y="4.5" width="16" height="6.5" rx="1.6" /><rect x="4" y="13" width="16" height="6.5" rx="1.6" /></>,
  // the fleet turned a quarter: a long block, an arc around it
  "flip-it": <><rect x="8.5" y="5" width="7" height="14" rx="1.6" /><path d="M4.2 9.5A8.5 8.5 0 0 1 12 3.5" /><path d="M10 2l2 1.5-1.6 2" /></>,
  // one cut: count each side, then add
  "split-and-add": <><rect x="3.5" y="6" width="9" height="12" rx="1.6" /><rect x="15" y="6" width="5.5" height="12" rx="1.6" /></>,
  // squads one at a time, adding as you go
  "fast-adding": <><path d="M3.5 7h11M3.5 12h11M3.5 17h11" /><path d="M19 9.5v5M16.5 12h5" /></>,
  // two rows of five: pods of 5 and 10
  "easy-5-10": <><rect x="2.5" y="6" width="19" height="12" rx="2" />{DOTS(9.6)}{DOTS(14.4)}</>,
  // a fleet you know, and one more squad
  "jump-one-more": <><path d="M3.5 5.5h17M3.5 10h17M3.5 14.5h17" /><path d="M3.5 19.5h17" strokeDasharray="2.2 2.4" /></>,
  // fill to an easy size, then take the extra away
  "borrow-take-back": <><path d="M3.5 5.5h12M3.5 10h12M3.5 14.5h12" /><path d="M3.5 19h12" strokeDasharray="2.2 2.4" /><path d="M18 19h3.5" /></>,
  // zero is empty, one is a mirror
  "empty-mirror": <><circle cx="12" cy="12" r="7.5" strokeDasharray="2.4 2.6" /><path d="M12 2.5v19" /></>,
  // big ships first, then the small ones
  "big-small-split": <><rect x="3" y="3.5" width="18" height="17" rx="1.8" /><path d="M15 3.5v17M3 14.5h18" /></>,
  // half the squads, twice the ships: the same fleet, an easier shape
  "half-double": <><rect x="3" y="4" width="6.5" height="16" rx="1.6" /><rect x="12.5" y="8.5" width="9" height="7" rx="1.6" /></>,
};

export function PowerUpGlyph({ id, lock = false, size = 24 }: { id: TrickId; lock?: boolean; size?: number }) {
  if (lock) return <Icon name="lock" size={size} />;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" className="shrink-0">
      {GLYPH[id]}
    </svg>
  );
}

/** What each Power-Up does to the fleet, in one plain line (the New Power-Up card). Never the answer. */
export const POWERUP_DOES: Record<TrickId, string> = {
  "empty-mirror": "Zero squads is an empty sky. One squad is just that squad.",
  "fast-adding": "Count the fleet one squad at a time, adding as you go.",
  "flip-it": "Turns the fleet sideways. Same ships, easier squads.",
  "double-it": "Cuts the fleet into two equal halves. Count one half, then double it.",
  "easy-5-10": "Packs the ships into pods of 5 and 10, so they are quick to count.",
  "jump-one-more": "Start from a fleet you know, then add one more squad.",
  "split-and-add": "Splits the fleet in two. Count each part, then add them.",
  "borrow-take-back": "Fills the fleet up to an easy size, then takes the extra ships away.",
  "big-small-split": "Splits each squad into big ships and small ones. Count each, then add.",
  "half-double": "Halves the squads and doubles the ships in each. Same ships, easier shape.",
};
/** The Sector-Lock form of Big & Small Split, on fleets too big to count in one go. */
export const SECTOR_LOCK_DOES = "Cuts a giant fleet into sectors. Lock each one, then add them up.";
