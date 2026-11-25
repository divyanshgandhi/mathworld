import type { Metadata } from "next";
import { CastReview } from "./CastReview";

export const metadata: Metadata = { title: "Cast review · Math World" };

/** A review sheet for the design lead: every character on the void, three views and five faces each. */
export default function CastPage() {
  return <CastReview />;
}
