import type { Metadata } from "next";
import { PlanetReview } from "@/components/world/PlanetReview";

export const metadata: Metadata = { title: "Planets: review", robots: { index: false } };

/** A review sheet for the planet factory: every body large, and as a 2D sprite at 48, 96 and 200 px. */
export default function PlanetsPage() {
  return <PlanetReview />;
}
