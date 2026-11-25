"use client";
import { useEffect, useState } from "react";
import { LINE, MOTION } from "@/design/tokens";
import { BODY_NAME, type BodyId } from "@/worlds/space/bodies";

/**
 * A planet, drawn by the same planet factory as the 3D worlds (see src/worlds/sprites.ts), for 2D screens.
 * While it renders, a hairline circle holds its place at the same size, so nothing on the screen moves.
 *
 *   <PlanetSprite id="earth" size={96} />
 *   <PlanetSprite id="moon" size={48} alt="" />   // decorative: hidden from screen readers
 *
 * `alt` defaults to the body's name. Pass `alt=""` when the name is already written next to it.
 */
export function PlanetSprite({ id, size, alt, className = "" }: { id: BodyId; size: number; alt?: string; className?: string }) {
  const [shot, setShot] = useState<{ key: string; url: string | null } | null>(null);
  const key = `${id}:${size}`;
  useEffect(() => {
    let live = true;
    import("@/worlds/sprites")
      .then(({ planetSprite }) => planetSprite(id, size))
      .then((url) => { if (live) setShot({ key, url }); })
      .catch(() => { if (live) setShot({ key, url: null }); });
    return () => { live = false; };
  }, [id, size, key]);
  const url = shot?.key === key ? shot.url : undefined, label = alt ?? BODY_NAME[id], decorative = label === "";
  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      aria-busy={url === undefined || undefined}
    >
      {/* the placeholder: a hairline circle where the body will be */}
      <span
        className="absolute rounded-full motion-safe:transition-opacity"
        style={{ inset: "14%", border: `1px solid ${LINE[1]}`, opacity: url ? 0 : 1, transitionDuration: `${MOTION.quick}ms` }}
      />
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- a generated data URL; next/image adds nothing here
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          draggable={false}
          className="absolute inset-0 h-full w-full select-none motion-safe:animate-[mw-sprite-in_var(--mw-in)_both]"
          style={{ ["--mw-in" as string]: `${MOTION.route}ms ${MOTION.ease}` }}
        />
      )}
      <style>{"@keyframes mw-sprite-in{from{opacity:0}to{opacity:1}}"}</style>
    </span>
  );
}
