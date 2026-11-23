import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WarmupDrill } from "@/components/WarmupDrill";
import { WaveArena } from "@/components/WaveArena";
import { PLANETS_BY_TIER, type PlanetId } from "@/rig/pools";

const WARMUPS = ["mercury", "venus"] as const;

/** Every planet is known ahead of time, so each battle shell is prerendered. */
export function generateStaticParams() {
  return [...WARMUPS, ...PLANETS_BY_TIER].map((planet) => ({ planet }));
}

async function Battle({ params }: { params: PageProps<"/play/[planet]">["params"] }) {
  const { planet } = await params;
  if (planet === "mercury" || planet === "venus") return <WarmupDrill planet={planet} />;
  if (!(PLANETS_BY_TIER as readonly string[]).includes(planet)) notFound();
  return <WaveArena planet={planet as PlanetId} />;
}

/** A planet battle, or a Mercury / Venus warm-up. The game owns the whole screen (a dark frame while it loads). */
export default function PlayPage(props: PageProps<"/play/[planet]">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-[#030612]" />}>
      <Battle params={props.params} />
    </Suspense>
  );
}
