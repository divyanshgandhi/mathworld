"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import { COLOR, INK, LINE, RADIUS, TYPE } from "@/design/tokens";
import type { Stage } from "@/engine/stage";
import { LINEUP, SAFE, type Safe } from "./review";

type Mount = (stage: Stage, review: typeof import("./review")) => { dispose(): void };

/** One stage in a fixed-size box. Each panel is its own canvas, so each frame is exactly its CSS size. */
function Panel({ id, mount, style, label }: { id: string; mount: Mount; style: CSSProperties; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let gone = false, cleanup = () => {};
    (async () => {
      const [{ createStage }, review] = await Promise.all([import("@/engine/stage"), import("./review")]);
      if (gone || !box.current) return;
      const stage = createStage(box.current, { fill: true });
      const scene = mount(stage, review);
      const all = (window.__mw ??= { stage } as NonNullable<Window["__mw"]>);
      all[id] = stage;
      cleanup = () => { scene.dispose(); stage.dispose(); delete all[id]; };
    })();
    return () => { gone = true; cleanup(); };
  }, [id, mount]);
  return (
    <figure style={{ margin: 0, minWidth: 0 }}>
      <div ref={box} data-panel={id} style={{ position: "relative", overflow: "hidden", borderRadius: RADIUS.panel, border: `1px solid ${LINE[1]}`, ...style }} />
      <figcaption style={{ marginTop: 10, fontSize: TYPE.min.body, color: INK[2] }}>{label}</figcaption>
    </figure>
  );
}

const fleet = (a: number, b: number, safe: Safe): Mount => (stage, r) => r.mountFleet(stage, a, b, safe);
const DESK: CSSProperties = { width: "min(100%, 960px)", aspectRatio: "1440 / 900" };
const PHONE: CSSProperties = { width: "min(375px, calc(100vw - 32px))", height: 740 };
// stable mounts, so the panels never remount on a re-render
const M = {
  lineup: ((stage, r) => r.mountLineup(stage)) as Mount,
  d68: fleet(6, 8, SAFE.desktop), d310: fleet(3, 10, SAFE.desktop),
  p68: fleet(6, 8, SAFE.phone), p310: fleet(3, 10, SAFE.phone),
};

/** The ships review page: the void, Saira, hairline frames. */
export function ShipsReview() {
  const h2: CSSProperties = { margin: "48px 0 16px", fontWeight: TYPE.label.weight, fontStretch: `${TYPE.label.stretch}%`, fontSize: 15, letterSpacing: TYPE.label.tracking, textTransform: "uppercase", color: INK[2] };
  return (
    <main style={{ minHeight: "100vh", background: COLOR.void, color: INK[1], fontFamily: `${TYPE.family}, sans-serif`, padding: "32px clamp(16px, 4vw, 56px) 64px" }}>
      <h1 style={{ margin: 0, fontWeight: TYPE.display.weight, fontStretch: `${TYPE.display.stretch}%`, letterSpacing: TYPE.display.tracking, textTransform: "uppercase", fontSize: "clamp(32px, 5vw, 56px)" }}>Ships</h1>
      <p style={{ margin: "12px 0 0", fontSize: 18, color: INK[2], maxWidth: "60ch" }}>
        Every ship on the void at battle scale, then fleets laid out exactly as a battle lays them out. Squads alternate ember and apricot; each squad&apos;s first ship is its leader, with a gold pennant.
      </p>

      <h2 style={h2}>Every ship</h2>
      <Panel id="lineup" mount={M.lineup} style={DESK} label={LINEUP.join(" / ")} />

      <h2 style={h2}>Phone, 375 px wide</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 32 }}>
        <Panel id="p68" mount={M.p68} style={PHONE} label="6 × 8: six squads of eight. The bottom 42% is the keypad." />
        <Panel id="p310" mount={M.p310} style={PHONE} label="3 × 10: three squads, one 10 pod each." />
      </div>

      <h2 style={h2}>Desktop, 1440 × 900</h2>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 32 }}>
        <Panel id="d68" mount={M.d68} style={DESK} label="6 × 8" />
        <Panel id="d310" mount={M.d310} style={DESK} label="3 × 10" />
      </div>
    </main>
  );
}
