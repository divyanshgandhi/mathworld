"use client";
import { useSyncExternalStore } from "react";

/**
 * Where the console sits. One anatomy (Power-Ups, keypad, Fire, help) in three arrangements:
 * - `pad`: portrait (phones, tablets held upright): a band along the bottom, keypad in thumb reach.
 * - `column`: a short landscape screen (a phone on its side): a column on the right, so the world keeps the height.
 * - `strip`: landscape with room (laptops, desktops, tablets on their side): a slim strip along the bottom.
 * The arrangement only changes when the screen does (a resize or a rotation), never during play.
 */
export type ConsoleLayout = "pad" | "column" | "strip";

export function layoutFor(w: number, h: number): ConsoleLayout {
  if (h >= w) return "pad";
  return h < 540 ? "column" : "strip";
}

const read = () => layoutFor(window.innerWidth, window.innerHeight);
function subscribe(f: () => void) {
  window.addEventListener("resize", f);
  window.addEventListener("orientationchange", f);
  return () => { window.removeEventListener("resize", f); window.removeEventListener("orientationchange", f); };
}

export function useConsoleLayout(): ConsoleLayout {
  return useSyncExternalStore(subscribe, read, () => "strip");
}

/** The user asked for less motion: the reward ticks instead of flying, nothing pulses. */
export function useReducedMotion() {
  return useSyncExternalStore(
    (f) => { const m = matchMedia("(prefers-reduced-motion: reduce)"); m.addEventListener("change", f); return () => m.removeEventListener("change", f); },
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
