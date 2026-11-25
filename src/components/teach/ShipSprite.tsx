"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { LINE } from "@/design/tokens";
import { SHIP_ALT, shipSpriteBox, type ShipKind, type ShipTone as InvaderTone } from "@/teach/shipKinds";

/**
 * The baked picture of a ship as a data URL: `undefined` while it bakes, `null` if it could not
 * (no WebGL). For SVG pictures that draw ships as `<image>`s.
 */
export function useShipSprite(kind: ShipKind, size: number, tone?: InvaderTone): string | null | undefined {
  const key = `${kind}:${tone ?? ""}:${size}`;
  const [shot, setShot] = useState<{ key: string; url: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    import("@/worlds/shipSprites")
      .then(({ shipSprite }) => shipSprite(kind, size, { tone }))
      .then((url) => { if (live) setShot({ key, url }); })
      .catch(() => { if (live) setShot({ key, url: null }); });
    return () => { live = false; };
  }, [kind, size, tone, key]);
  return shot?.key === key ? shot.url : undefined;
}

/**
 * A ship from the game's own ship art (src/worlds/shipSprites.ts), for 2D screens. While it bakes,
 * a hairline ring holds its place at exactly the same size, so nothing on the screen moves.
 *
 *   <ShipSprite kind="invader" size={32} tone="apricot" />
 *   <ShipSprite kind="rocket" size={56} alt="" />        // decorative: hidden from screen readers
 *
 * `alt` defaults to a plain name ("A ship"). Pictures of whole fleets should label the picture,
 * not each ship: pass `alt=""` to every ship and name the group once.
 */
export function ShipSprite({ kind, size, tone, alt, className = "", style }: { kind: ShipKind; size: number; tone?: InvaderTone; alt?: string; className?: string; style?: CSSProperties }) {
  const url = useShipSprite(kind, size, tone);
  const { w, h } = shipSpriteBox(kind, size), label = alt ?? SHIP_ALT[kind], decorative = label === "";
  const ring = kind === "ball" ? "32%" : kind === "pod" ? "8%" : "18%";
  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: w, height: h, ...style }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      aria-busy={url === undefined || undefined}
    >
      {!url && <span className={`absolute ${kind === "pod" ? "rounded-chip" : "rounded-full"}`} style={{ inset: ring, border: `1px solid ${LINE[1]}` }} />}
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- a generated data URL; next/image adds nothing here
        <img src={url} alt="" width={w} height={h} draggable={false} className="absolute inset-0 h-full w-full select-none" />
      )}
    </span>
  );
}
