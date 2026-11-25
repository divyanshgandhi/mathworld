import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PatrolReview } from "./PatrolReview";

export const metadata: Metadata = { title: "Patrol review · Math World", robots: { index: false } };

/** /dev/patrol: the bay's three patrol slot states, and a real patrol on facts made due by shifting the clock. Dev only. */
export default function PatrolReviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PatrolReview />;
}
