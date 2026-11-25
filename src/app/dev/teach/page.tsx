import type { Metadata } from "next";
import { TeachReview } from "./TeachReview";

export const metadata: Metadata = { title: "Teaching review · Math World", robots: { index: false, follow: false } };

/**
 * /dev/teach: the teaching kit for review. The Field Manual (every page, and as a sheet), every
 * greeting, the ship sprites, and the guided first shot on a mock console at desktop and phone width.
 */
export default function TeachReviewPage() {
  return <TeachReview />;
}
