import type { Metadata } from "next";
import { ShipsReview } from "./ShipsReview";

export const metadata: Metadata = { title: "Ships review · Math World", robots: { index: false } };

/**
 * /dev/ships: every ship on the void at battle scale, and two fleets laid out exactly as a battle
 * lays them out, at desktop and at phone size, so countability and grouping can be judged at a glance.
 */
export default function ShipsReviewPage() {
  return <ShipsReview />;
}
