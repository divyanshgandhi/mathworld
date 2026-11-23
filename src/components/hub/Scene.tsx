"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { Stage } from "@/engine/stage";

/** A hub scene: anything the stage renders, with named points the HUD can pin buttons to. */
export interface HubScene { anchor?(id: string): THREE.Vector3 | null; dispose(): void }

/**
 * Mount a full-screen stage in `box` and a scene on it (loaded on the client only). The game owns
 * the whole screen: React draws the HUD over it. Returns the scene once it is up.
 */
export function useScene<S extends HubScene>(mount: (stage: Stage) => S | Promise<S>, deps: unknown[] = []) {
  const box = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<{ stage: Stage; scene: S } | null>(null);
  useEffect(() => {
    let gone = false, cleanup = () => {};
    (async () => {
      const { createStage } = await import("@/engine/stage");
      if (gone || !box.current) return;
      const stage = createStage(box.current, { fill: true });
      const s = await mount(stage);
      if (gone) { s.dispose(); stage.dispose(); return; }
      window.__mw = { stage, scene: s };
      setScene({ stage, scene: s });
      cleanup = () => { s.dispose(); stage.dispose(); };
    })();
    return () => { gone = true; cleanup(); setScene(null); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { box, stage: scene?.stage ?? null, scene: scene?.scene ?? null };
}

/**
 * Pins its children to a point in the 3D scene (a door, a poster, a planet), following the camera
 * every frame. Hidden while the point is behind the camera or off screen.
 */
export function Anchor({ stage, scene, id, children, className = "" }: { stage: Stage | null; scene: HubScene | null; id: string; children: ReactNode; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!stage || !scene?.anchor) return;
    let raf = 0;
    const v = new THREE.Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = scene.anchor!(id), d = el.current;
      if (!d) return;
      if (!p) { d.style.visibility = "hidden"; return; }
      v.copy(p).project(stage.camera);
      const w = stage.container.clientWidth, h = stage.container.clientHeight;
      const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h, on = v.z < 1 && x > -80 && x < w + 80 && y > -80 && y < h + 80;
      d.style.visibility = on ? "visible" : "hidden";
      d.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [stage, scene, id]);
  return <div ref={el} className={`absolute left-0 top-0 z-10 ${className}`} style={{ visibility: "hidden" }}>{children}</div>;
}
