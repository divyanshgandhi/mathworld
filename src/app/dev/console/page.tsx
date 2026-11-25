import type { Metadata } from "next";
import { ConsoleReview } from "./ConsoleReview";

export const metadata: Metadata = { title: "Cockpit review · Math World", robots: { index: false } };

/**
 * /dev/console: the battle cockpit without a battle. The console and the mission strip in every state
 * (empty, loaded, a miss, a lesson, Your turn, Sector-Lock), and every card, one at a time.
 */
export default function ConsoleReviewPage() {
  return <ConsoleReview />;
}
