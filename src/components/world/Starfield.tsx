"use client";
import { useEffect, useRef } from "react";
import { COLOR } from "@/design/tokens";

/**
 * A quiet, static field of stars on the void behind a 2D screen: drawn once per resize, never animated,
 * so nothing in the sky competes with the page. Mostly cool white, a few sky blue. Fixed to the viewport.
 */
export function Starfield({ count = 220, seed = 11 }: { count?: number; seed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const stars = Array.from({ length: count }, () => ({ x: rnd(), y: rnd(), r: rnd() < 0.1 ? 1.3 : 0.75, a: 0.12 + rnd() * 0.5, sky: rnd() < 0.14 }));
    const draw = () => {
      const dpr = Math.min(2, devicePixelRatio || 1), g = c.getContext("2d");
      const w = innerWidth, h = innerHeight;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const st of stars) {
        g.globalAlpha = st.a;
        g.fillStyle = st.sky ? COLOR.sky : COLOR.approach;
        g.fillRect(st.x * w, st.y * h, st.r, st.r);
      }
    };
    draw();
    addEventListener("resize", draw);
    return () => removeEventListener("resize", draw);
  }, [count, seed]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 size-full" />;
}
