"use client";
import { useEffect, useRef, useState } from "react";

/** A Moon wave in the Math World look. Squadrons fly in and the rocket fires one shot per invader. */
export function MoonWave({ rows = 3, perRow = 4 }: { rows?: number; perRow?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [ammo, setAmmo] = useState(rows * perRow);
  const [sound, setSound] = useState<(() => void) | null>(null);

  useEffect(() => {
    let gone = false, cleanup = () => {};
    (async () => {
      const [{ createStage }, { mountWave }] = await Promise.all([import("@/engine/stage"), import("@/worlds/space/wave")]);
      if (gone || !box.current) return;
      const stage = createStage(box.current, { aspect: 0.56 });
      const wave = mountWave(stage, { rows, perRow });
      wave.hud.onAmmo = setAmmo;
      window.__mw = { stage };
      setSound(() => wave.enableSound);
      cleanup = () => stage.dispose();
    })();
    return () => { gone = true; cleanup(); };
  }, [rows, perRow]);

  const hud = "pointer-events-none absolute font-mono text-xs tracking-wider text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]";
  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-xl bg-[#10153a]" onClick={() => sound?.()}>
      <div className={`${hud} left-3 top-2.5`}>WAVE 2 · THE MOON</div>
      <div className={`${hud} right-3 top-2.5`}>{rows} SQUADRONS × {perRow}</div>
      <div className={`${hud} bottom-2.5 left-3`}>CANNONBALLS <span className="text-lg">{ammo}</span></div>
    </div>
  );
}
