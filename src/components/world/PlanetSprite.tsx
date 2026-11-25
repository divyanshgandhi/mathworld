"use client";
import { useEffect, useState, useSyncExternalStore, type CSSProperties, type SyntheticEvent } from "react";
import { MOTION } from "@/design/tokens";
import { BODY_NAME, spriteDisc, type BodyId } from "@/worlds/space/bodies";
import { getSprite, HIGH_LOD_PX, previewSize, spriteNow, spritePx, subscribeSprites } from "./spriteStore";

const none = () => null;

/** The first picture fades up over the placeholder (once per element; never under reduced motion). */
function fadeInOnce(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.dataset.in || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  img.dataset.in = "1";
  img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOTION.route, easing: MOTION.ease });
}

/**
 * A planet, drawn by the same planet factory as the 3D worlds (see src/worlds/sprites.ts), for 2D screens.
 *
 *   <PlanetSprite id="earth" size={96} />
 *   <PlanetSprite id="moon" size={48} alt="" />   // decorative: hidden from screen readers
 *
 * - A sprite already drawn this session (or stored from an earlier visit) shows at once, with no fade.
 * - Until then a hairline circle the exact size of the body holds its place, so nothing moves when it lands.
 * - A large sprite (over 240 device px) first shows a quick low-detail picture, then sharpens in place.
 *
 * `alt` defaults to the body's name. Pass `alt=""` when the name is already written next to it.
 * `size` is the square's CSS size; a className may scale it down (max-width), the placeholder scales with it.
 */
export function PlanetSprite({ id, size, alt, className = "", style }: { id: BodyId; size: number; alt?: string; className?: string; style?: CSSProperties }) {
  const url = useSyncExternalStore(subscribeSprites, () => spriteNow(id, size), none);
  const big = spritePx(size) > HIGH_LOD_PX;
  const preview = useSyncExternalStore(subscribeSprites, () => (big ? spriteNow(id, previewSize()) : null), none);
  // a sprite that was ready when this mounted shows without a fade (a revisit, a second screen)
  const [instant] = useState(() => typeof window !== "undefined" && spriteNow(id, size) !== null);

  useEffect(() => {
    if (url) return;
    if (big) void getSprite(id, previewSize()).catch(() => {});
    void getSprite(id, size).catch(() => {});
  }, [id, size, url, big]);

  const shown = url ?? preview, label = alt ?? BODY_NAME[id], decorative = label === "";
  const disc = `${(spriteDisc(id) * 100).toFixed(2)}%`;
  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      aria-busy={!url || undefined}
      data-sprite={url ? "sharp" : preview ? "preview" : "waiting"}
    >
      {/* the placeholder: a hairline circle exactly where the body's disc will be */}
      <span
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line-1 transition-opacity duration-quick"
        style={{ width: disc, height: disc, opacity: shown ? 0 : 1 }}
      />
      {shown && (
        // eslint-disable-next-line @next/next/no-img-element -- a generated image; next/image adds nothing here
        <img
          src={shown}
          alt=""
          width={size}
          height={size}
          draggable={false}
          className="absolute inset-0 h-full w-full select-none"
          onLoad={instant ? undefined : fadeInOnce}
        />
      )}
    </span>
  );
}
