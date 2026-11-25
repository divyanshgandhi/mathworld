"use client";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, ViewTransition, type ReactNode } from "react";

/**
 * The browser skips a view transition when the tab is hidden or the new screen takes too long to
 * commit (a first 3D mount on a slow device). The route change itself still happens, as a plain cut;
 * only the transition's promises reject, and nothing awaits them. Those rejections are expected and
 * are not errors, so they are kept out of the console. Any other rejection passes through untouched.
 */
const isSkippedTransition = (r: unknown) =>
  r instanceof DOMException && ["InvalidStateError", "TimeoutError", "AbortError"].includes(r.name) && /transition/i.test(r.message);

function Fade({ children }: { children: ReactNode }) {
  const path = usePathname();
  useEffect(() => {
    const quiet = (e: PromiseRejectionEvent) => { if (isSkippedTransition(e.reason)) e.preventDefault(); };
    window.addEventListener("unhandledrejection", quiet);
    return () => window.removeEventListener("unhandledrejection", quiet);
  }, []);
  // keyed by route: a new screen exits the old one and enters itself, both with the `mw-route`
  // class (globals.css). Updates inside one screen never animate (`default="none"`).
  return <ViewTransition key={path} enter="mw-route" exit="mw-route" default="none">{children}</ViewTransition>;
}

/**
 * The shared route fade: the old screen dips to void and the new one rises from it in
 * MOTION.route (240 ms), so no route change is a hard cut and the background is always void.
 * Uses the browser's View Transitions through React's <ViewTransition>; reduced motion turns it off.
 * The Suspense boundary lets a route with an unknown dynamic param prerender (it renders plainly).
 */
export function RouteFade({ children }: { children: ReactNode }) {
  return <Suspense fallback={children}><Fade>{children}</Fade></Suspense>;
}
