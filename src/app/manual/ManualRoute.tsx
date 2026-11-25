"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { FieldManual } from "@/components/teach/FieldManual";
import { MANUAL_TOPICS, type ManualTopic } from "@/teach/manual";

/** The manual, open over the void. Close: back if this tab came from the game, else the Resting Bay. */
export function ManualRoute() {
  const router = useRouter();
  const q = useSearchParams().get("topic");
  const topic = MANUAL_TOPICS.includes(q as ManualTopic) ? (q as ManualTopic) : null;
  const [open, setOpen] = useState(true);
  const close = () => {
    setOpen(false);
    // came here inside the game (a soft navigation, or a link from one of our pages): go back there
    const first = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.name ?? location.href;
    const soft = new URL(first).pathname !== location.pathname;
    const ours = !!document.referrer && new URL(document.referrer).origin === location.origin;
    if ((soft || ours) && history.length > 1) router.back();
    else router.replace("/bay");
  };
  return <FieldManual open={open} onClose={close} topic={topic} />;
}
