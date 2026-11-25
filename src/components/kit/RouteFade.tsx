"use client";
import { usePathname } from "next/navigation";
import { Suspense, ViewTransition, type ReactNode } from "react";

function Fade({ children }: { children: ReactNode }) {
  const path = usePathname();
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
