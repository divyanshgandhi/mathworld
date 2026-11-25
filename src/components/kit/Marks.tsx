import type { CSSProperties } from "react";
import { MASTERY, type MasteryKey } from "@/design/tokens";

const ORDER: MasteryKey[] = ["gold", "got", "learn", "new"];

/**
 * One mastery mark. Gold is a filled gold dot with a ring, Got it a filled white dot, Learning a
 * blue outline, New a small dim dot: each shape reads without colour. Decorative unless `label`.
 */
export function MasteryMark({ level, size = 8, label = false, className = "" }: { level: MasteryKey; size?: number; label?: boolean; className?: string }) {
  return (
    <i
      className={`mw-mark mw-mark-${level} ${className}`}
      style={{ "--mark": `${size}px` } as CSSProperties}
      role={label ? "img" : undefined}
      aria-label={label ? MASTERY[level].word : undefined}
      aria-hidden={label ? undefined : true}
      data-mastery={level}
    />
  );
}

/** "3 Gold, 2 Got it, 5 New": the words a screen reader hears for a row of marks. */
export function masterySummary(marks: readonly MasteryKey[]) {
  return ORDER.map((k) => [k, marks.filter((m) => m === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${MASTERY[k].word}`)
    .join(", ");
}

/** A small grid of mastery marks (a times table's ten facts). One accessible name for the whole grid. */
export function Pips({ marks, columns = 5, size = 7, label, className = "" }: { marks: readonly MasteryKey[]; columns?: number; size?: number; label?: string; className?: string }) {
  return (
    <span
      role="img"
      aria-label={label ?? masterySummary(marks)}
      className={`inline-grid gap-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, ${size}px)` }}
    >
      {marks.map((m, i) => <MasteryMark key={i} level={m} size={size} />)}
    </span>
  );
}

/** The four marks with their words, for a sheet that shows marks for the first time. */
export function MasteryKeyLegend({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-5 gap-y-2 type-body-sm text-ink-2 ${className}`} aria-label="What the marks mean">
      {ORDER.map((k) => (
        <li key={k} className="flex items-center gap-2"><MasteryMark level={k} size={9} />{MASTERY[k].word}</li>
      ))}
    </ul>
  );
}

/**
 * The waves of a mission as dots: won waves filled gold, the one in play outlined white, the rest
 * hairline. The words beside it say the same thing ("1 won").
 */
export function WaveDots({ total, won, current = false, words = true, className = "" }: { total: number; won: number; current?: boolean; words?: boolean; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`} role="img" aria-label={`${won} of ${total} waves won`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="mw-wave" data-state={i < won ? "won" : current && i === won ? "now" : "left"} />
      ))}
      {words && <span className="ml-1.5 type-body-sm text-ink-3" aria-hidden>{won} won</span>}
    </div>
  );
}
