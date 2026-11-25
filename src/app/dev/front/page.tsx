import type { Metadata } from "next";
import { FrontReview } from "./FrontReview";

export const metadata: Metadata = { title: "Front review · Math World", robots: { index: false } };

/** /dev/front: the app shell's states on demand (a broken screen, the loading state), for review. */
export default function FrontReviewPage() {
  return <FrontReview />;
}
