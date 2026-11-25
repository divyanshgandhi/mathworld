"use client";
import { useEffect, useState } from "react";
import { NovaLine } from "@/components/kit/Brand";
import { MOTION } from "@/design/tokens";
import { GREETINGS, type GreetScreen } from "@/teach/greetings";
import { useSeen, type SeenSource } from "@/teach/seen";
import { readMs } from "@/teach/words";

/**
 * Nova's first-visit greeting for a screen: one short line, once ever (seen key `greet:<screen>`).
 * It never blocks input (it takes no pointer events and no focus) and it leaves on the player's
 * first action (a tap, a click or a key) or after its reading time, whichever comes first.
 *
 *   <Greeting screen="bay" seen={{ seen: state?.seen, emit }} />            // floats above the bottom edge
 *   <Greeting screen="map" placement="inline" className="mt-6" />           // sits in the layout
 *
 * - `enabled={false}` holds it back (for example until a film or a card has gone); it shows the first
 *   time it is enabled on a screen the player has not met.
 * - While the seen state is loading it shows nothing, so a returning player is never greeted twice.
 * - `inline` reserves no space once it has gone: put it where a gap closing does not move a control.
 * - `edge="top"` floats it just under the top bar instead (a screen whose bottom holds the words to read, such as the Hangar's dock).
 */
export function Greeting({ screen, seen, enabled = true, placement = "float", edge = "bottom", className = "", onDone }: {
  screen: GreetScreen; seen?: SeenSource; enabled?: boolean; placement?: "float" | "inline"; edge?: "bottom" | "top"; className?: string; onDone?: () => void;
}) {
  const line = GREETINGS[screen];
  const { seen: met, mark } = useSeen(line.key, seen);
  // decided once, on the first render that knows the answer: a greeting never comes back mid-visit
  const [show, setShow] = useState<boolean | null>(null);
  if (show === null && enabled && met !== null) setShow(!met);
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");

  useEffect(() => {
    if (!show) return;
    mark();
    let left = false;
    const leave = () => { if (left) return; left = true; setPhase("out"); };
    const timer = setTimeout(leave, readMs(line.text));
    const opts = { capture: true, passive: true } as const;
    addEventListener("pointerdown", leave, opts);
    addEventListener("keydown", leave, opts);
    return () => { clearTimeout(timer); removeEventListener("pointerdown", leave, opts); removeEventListener("keydown", leave, opts); };
  }, [show, mark, line.text]);

  useEffect(() => {
    if (phase !== "out") return;
    const t = setTimeout(() => { setPhase("gone"); onDone?.(); }, MOTION.route);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  if (!show || phase === "gone") return null;
  const fade = `motion-safe:animate-[mw-greet-in_var(--mw-greet)_both] transition-opacity duration-route ${phase === "out" ? "opacity-0" : "opacity-100"}`;
  const style = { ["--mw-greet" as string]: `${MOTION.route}ms ${MOTION.ease}` };
  const body = (
    <>
      <NovaLine live>{line.text}</NovaLine>
      <style>{"@keyframes mw-greet-in{from{opacity:0;translate:0 8px}to{opacity:1;translate:0 0}}"}</style>
    </>
  );
  if (placement === "inline") return <div data-greeting={screen} className={`pointer-events-none ${fade} ${className}`} style={style}>{body}</div>;
  return (
    <div data-greeting={screen} className={`pointer-events-none fixed inset-x-0 ${edge === "top" ? "top-[max(76px,calc(env(safe-area-inset-top)+64px))]" : "bottom-[max(20px,env(safe-area-inset-bottom))]"} z-30 flex justify-center px-4 ${className}`}>
      <div className={`max-w-[min(100%,520px)] rounded-panel border border-line-1 bg-panel px-4 py-3 ${fade}`} style={style}>{body}</div>
    </div>
  );
}
