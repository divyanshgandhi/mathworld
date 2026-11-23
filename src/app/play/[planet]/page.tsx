import { notFound } from "next/navigation";
import { WarmupDrill } from "@/components/WarmupDrill";
import { WaveArena } from "@/components/WaveArena";
import { PLANETS_BY_TIER, type PlanetId } from "@/rig/pools";

const WARMUPS = ["mercury", "venus"] as const;

/** Every planet is known ahead of time, so each battle shell is prerendered. */
export function generateStaticParams() {
  return [...WARMUPS, ...PLANETS_BY_TIER].map((planet) => ({ planet }));
}

/**
 * Every real planet is prerendered above, so awaiting `params` up front costs nothing for them; it is
 * what lets an unknown planet answer with a real 404. Instant-navigation validation is off for that.
 */
export const instant = false;

/**
 * A planet battle, or a Mercury / Venus warm-up. The game owns the whole screen. `params` is awaited
 * outside any Suspense boundary, so an unknown planet is a real 404 (not a 200 with a not-found body).
 */
export default async function PlayPage({ params }: PageProps<"/play/[planet]">) {
  const { planet } = await params;
  if (planet === "mercury" || planet === "venus") return <WarmupDrill planet={planet} />;
  if (!(PLANETS_BY_TIER as readonly string[]).includes(planet)) notFound();
  return <WaveArena planet={planet as PlanetId} />;
}
