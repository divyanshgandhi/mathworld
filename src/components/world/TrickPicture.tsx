import { layoutPicture, trickPicture, type Dot, type DotKind } from "./trickPictures";
import type { TrickId } from "@/rig/tricks";

const R = 0.34; // dot radius, in dot units
const CLASS: Record<DotKind, string> = { one: "fill-approach", two: "fill-sky", ghost: "fill-none stroke-line-3" };

/** Every dot of one kind as a single path (a picture of 900 dots stays one element per colour). */
function path(dots: Dot[], ox: number, oy: number) {
  return dots.map((d) => { const x = ox + d.x + 0.5, y = oy + d.y + 0.5; return `M${(x - R).toFixed(2)} ${y.toFixed(2)}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0`; }).join("");
}

/**
 * A trick drawn as dots, true to its numbers: `a × b` is `a` rows of `b` dots (see trickPictures.ts).
 * Solid dots are ships (two parts in white and sky), hollow dots are ships a trick borrows or imagines.
 * An empty panel (× 0) is a dashed outline of empty space. Server-safe: no hooks.
 */
export function TrickPicture({ trick, a, b, width = 176, height = 88, className = "" }: { trick: TrickId; a: number; b: number; width?: number; height?: number; className?: string }) {
  const pic = trickPicture(trick, a, b), l = layoutPicture(pic, width, height);
  const stroke = 1 / l.unit; // a 1 px hairline at any scale
  return (
    <svg role="img" aria-label={pic.alt} width={width} height={height} viewBox={`0 0 ${width / l.unit} ${height / l.unit}`} className={`block shrink-0 ${className}`}>
      <g transform={`translate(${((width / l.unit - l.w) / 2).toFixed(3)} ${((height / l.unit - l.h) / 2).toFixed(3)})`}>
        {l.placed.map(({ panel, x, y }, i) => (
          <g key={i}>
            {panel.dots.length === 0 && (
              <rect x={x + 0.1} y={y + 0.1} width={panel.w - 0.2} height={panel.h - 0.2} rx={0.4} className="fill-none stroke-line-2" strokeWidth={stroke} strokeDasharray={`${3 * stroke} ${3 * stroke}`} />
            )}
            {(["ghost", "one", "two"] as const).map((k) => {
              const ds = panel.dots.filter((d) => d.kind === k);
              return ds.length ? <path key={k} d={path(ds, x, y)} className={CLASS[k]} strokeWidth={k === "ghost" ? stroke : undefined} /> : null;
            })}
          </g>
        ))}
      </g>
    </svg>
  );
}
