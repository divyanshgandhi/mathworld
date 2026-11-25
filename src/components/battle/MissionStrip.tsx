"use client";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { OrbCount, WaveDots } from "@/components/kit";
import { topBars } from "@/components/kit/chrome";
import { MOTION } from "@/design/tokens";
import { SoundButton } from "@/components/SoundToggle";
import type { ConsoleLayout } from "./layout";
import { fmtN } from "./Console";
import { css } from "./cockpit";

/**
 * The mission strip along the top: the menu and the mission's progress on the left, the question in
 * the display voice in the middle (the largest words on screen, the one thing to read), orbs and sound
 * on the right, and two reserved message lines under the question (the outcome, a hint, a lesson).
 * Its height never changes: an empty line keeps its place.
 */
export function MissionStrip({ layout, menu, question, dots, lines, orbs, orbsRef, stripRef, right }: {
  layout: ConsoleLayout;
  menu?: ReactNode;
  question: { a: number; b: number; op?: "×" | "+" | "−" } | null;
  dots?: { total: number; won: number; current: boolean } | null;
  lines: [ReactNode, ReactNode];
  orbs: number | null;
  orbsRef?: Ref<HTMLDivElement>;
  stripRef?: Ref<HTMLDivElement>;
  /** Beside the column console the strip covers only the free area. */
  right?: number;
}) {
  // while the strip is up it owns the sound button (the floating one hides)
  useEffect(() => topBars.mount(), []);
  const len = question ? fmtN(question.a).length + fmtN(question.b).length : 0;
  const op = question?.op ?? "×";
  return (
    <div ref={stripRef} className={css.strip} data-layout={layout} style={right ? { right } : undefined}>
      <div className={css.lead}>
        {menu}
        {dots && dots.total > 0 && <WaveDots total={dots.total} won={dots.won} current={dots.current} words={layout !== "column"} className={css.dotWords} />}
      </div>
      <h1 className={css.question} data-guide="question" data-long={len > 8 ? 2 : len > 5 ? 1 : undefined}
        aria-label={question ? `${fmtN(question.a)} ${op === "×" ? "times" : op === "+" ? "plus" : "take away"} ${fmtN(question.b)}` : undefined}>
        {question && <>{fmtN(question.a)}<span className={css.times} aria-hidden>{op}</span>{fmtN(question.b)}</>}
      </h1>
      <div className={css.trail}>
        {orbs !== null && <div ref={orbsRef} data-guide="orbs"><OrbCount n={orbs} /></div>}
        <SoundButton />
      </div>
      <div className={css.msg} aria-live="polite">
        <p className={`m-0 ${css.line}`}>{lines[0]}</p>
        <p className={`m-0 ${css.line}`}>{lines[1]}</p>
      </div>
    </div>
  );
}

/**
 * The reward: when the orb count goes up, a few orbs fly from the middle of the world to the counter
 * (about 600 ms) and the counter ticks up as they land. With reduced motion, or while a card covers
 * the screen, it just ticks. Returns the number the counter should show.
 */
export function useOrbReward(orbs: number, target: React.RefObject<HTMLElement | null>, from: () => { x: number; y: number }, opts: { reduced: boolean; still: boolean }) {
  const [shown, setShown] = useState(orbs);
  const shownRef = useRef(orbs);
  const optsRef = useRef(opts), fromRef = useRef(from);
  useEffect(() => { optsRef.current = opts; fromRef.current = from; });
  useEffect(() => {
    const start = shownRef.current;
    if (orbs === start) return;
    let raf = 0, gone = false;
    const flyers: HTMLElement[] = [];
    const set = (v: number) => { shownRef.current = v; setShown(v); };
    const tick = (to: number) => {
      const t0 = performance.now(), dur = MOTION.quick * 2;
      const step = () => {
        if (gone) return;
        const k = Math.min(1, (performance.now() - t0) / dur);
        set(Math.round(start + (to - start) * k));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      step();
    };
    const el = target.current;
    const { reduced, still } = optsRef.current;
    if (orbs < start || reduced || still || !el) { set(orbs); return; }
    const end = el.querySelector("svg")?.getBoundingClientRect() ?? el.getBoundingClientRect();
    const p = fromRef.current(), ex = end.left + end.width / 2, ey = end.top + end.height / 2;
    const n = Math.min(5, orbs - start), fly = 600;
    let landed = 0;
    for (let i = 0; i < n; i++) {
      const f = document.createElement("div");
      f.className = css.flyer;
      f.setAttribute("aria-hidden", "true");
      f.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none"/></svg>`;
      document.body.appendChild(f);
      flyers.push(f);
      const dx = (i - (n - 1) / 2) * 26, sx = p.x - 11 + dx, sy = p.y - 11;
      const anim = f.animate([
        { transform: `translate(${sx}px, ${sy}px) scale(0.6)`, opacity: 0 },
        { transform: `translate(${sx}px, ${sy - 24}px) scale(1)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${ex - 11}px, ${ey - 11}px) scale(0.8)`, opacity: 1 },
      ], { duration: fly, delay: i * 45, easing: MOTION.ease, fill: "both" });
      anim.onfinish = () => {
        f.remove();
        if (++landed === n && !gone) tick(orbs);
      };
    }
    return () => { gone = true; cancelAnimationFrame(raf); flyers.forEach((f) => f.remove()); set(orbs); };
  }, [orbs, target]);
  return shown;
}

