import type { Metadata } from "next";
import { TourReview } from "./TourReview";

export const metadata: Metadata = { title: "Tour review · Math World", robots: { index: false, follow: false } };

/**
 * /dev/teach/tour: the spotlight tour on mock targets. Each side, a long line, a target at each edge
 * and corner, a missing anchor, nothing there at all, a target that moves, and one far down the page.
 */
export default function TourReviewPage() {
  return <TourReview />;
}
