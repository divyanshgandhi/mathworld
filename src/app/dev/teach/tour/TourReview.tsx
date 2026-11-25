"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/kit/Button";
import { Tour } from "@/components/teach/Tour";
import { memorySource } from "@/teach/seen";
import type { TourStep } from "@/teach/tour";

const SCENES: Record<string, { name: string; steps: TourStep[] }> = {
  sides: {
    name: "Each side",
    steps: [
      { anchor: "t-top", line: "Below: this one sits at the top." },
      { anchor: "t-bottom", line: "Above: this one sits at the bottom." },
      { anchor: "t-left", line: "Right: a tall one on the left." },
      { anchor: "t-right", line: "Left: a tall one on the right." },
    ],
  },
  long: { name: "A long line", steps: [{ anchor: "t-mid", line: "Remember, every squad has the same number of ships inside." }] },
  edges: {
    name: "Edges and corners",
    steps: ["tl", "tc", "tr", "mr", "br", "bc", "bl", "ml"].map((k) => ({ anchor: `t-${k}`, line: `The ${k} corner or edge.` })),
  },
  missing: {
    name: "A missing anchor",
    steps: [
      { anchor: "t-mid", line: "First step. The next one is missing." },
      { anchor: "t-nowhere", line: "You should never read this." },
      { anchor: "t-hidden", line: "Hidden, so never shown either." },
      { anchor: "t-top", line: "Last step, after the missing ones." },
    ],
  },
  none: { name: "Nothing there", steps: [{ anchor: "t-nowhere", line: "Never shown, and not marked seen." }] },
  moving: { name: "A moving target", steps: [{ anchor: "t-move", line: "I follow it as it moves." }, { anchor: "t-mid", line: "Back to the middle." }] },
  far: { name: "Far down the page", steps: [{ anchor: "t-far", line: "Scrolled into view first." }] },
};

const spot = "absolute grid min-h-11 min-w-11 place-items-center rounded-chip border border-line-2 px-3 type-label text-ink-2";
const EDGE: Record<string, string> = {
  tl: "left-2 top-2", tc: "left-1/2 top-2 -translate-x-1/2", tr: "right-2 top-2", mr: "right-2 top-1/2 -translate-y-1/2",
  br: "bottom-2 right-2", bc: "bottom-2 left-1/2 -translate-x-1/2", bl: "bottom-2 left-2", ml: "left-2 top-1/2 -translate-y-1/2",
};

/** The tour on mock targets: pick a scene, and it runs (again) at once. */
export function TourReview() {
  const [scene, setScene] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState("");
  const [x, setX] = useState(10);
  const [source] = useState(() => memorySource());

  useEffect(() => {
    if (scene !== "moving") return;
    const iv = setInterval(() => setX((v) => (v >= 70 ? 10 : v + 2)), 120);
    return () => clearInterval(iv);
  }, [scene]);

  const start = (id: string) => { setScene(id); setRun((n) => n + 1); setResult(""); };

  return (
    <div className="min-h-dvh bg-void text-approach">
      <div className="relative h-dvh overflow-hidden">
        <div className="absolute inset-x-0 top-1/2 mx-auto flex max-w-[640px] -translate-y-1/2 flex-col items-center gap-4 px-16 text-center">
          <h1 className="m-0 type-display text-[28px]">Tour review</h1>
          <div className="flex flex-wrap justify-center gap-2">
            {Object.entries(SCENES).map(([id, s]) => <Button key={id} size="sm" onClick={() => start(id)}>{s.name}</Button>)}
          </div>
          <p className="m-0 min-h-6 type-body text-ink-2" aria-live="polite">{result && `Ended: ${result}`}</p>
          <span data-guide="t-mid" className="grid min-h-11 place-items-center rounded-chip border border-line-2 px-4 type-label text-ink-2">Middle</span>
          <span data-guide="t-hidden" hidden>Hidden</span>
        </div>
        <span data-guide="t-top" className={`${spot} left-1/2 top-4 -translate-x-1/2`}>Top</span>
        <span data-guide="t-bottom" className={`${spot} bottom-4 left-1/2 -translate-x-1/2`}>Bottom</span>
        <span data-guide="t-left" className={`${spot} left-4 top-1/4 h-1/2`}>Left</span>
        <span data-guide="t-right" className={`${spot} right-4 top-1/4 h-1/2`}>Right</span>
        {scene === "edges" && Object.entries(EDGE).map(([k, c]) => <span key={k} data-guide={`t-${k}`} className={`${spot} ${c}`}>{k}</span>)}
        {scene === "moving" && <span data-guide="t-move" className={`${spot} top-[30%]`} style={{ left: `${x}%` }}>Moving</span>}
      </div>
      <div className="h-[120dvh]" />
      <div className="flex justify-center pb-16"><span data-guide="t-far" className="grid min-h-11 place-items-center rounded-chip border border-line-2 px-4 type-label text-ink-2">Far down</span></div>
      {scene && <Tour key={run} id={`dev-${scene}`} steps={SCENES[scene].steps} seen={source} force onDone={(how) => setResult(how)} />}
    </div>
  );
}
