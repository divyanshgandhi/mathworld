import type { Metadata } from "next";
import { KitShowcase } from "./Showcase";

export const metadata: Metadata = { title: "Kit · Math World", robots: { index: false, follow: false } };

/** The design system showcase: every kit component in every state. Not linked from the game. */
export default function KitPage() {
  return <KitShowcase />;
}
