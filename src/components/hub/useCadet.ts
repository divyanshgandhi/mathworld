"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EventInput } from "@/db/events";
import { fold, type LoggedEvent } from "@/director/fold";
import { history, post } from "@/engine/outbox";
import type { Cadet } from "../battle/ui";

/**
 * The current cadet for a hub screen (Bay, Map, Hangar, Academy): their name, their event log and
 * the state folded from it. No cadet on this device, or one who has not finished the intro, goes
 * back to the Title. `emit` appends to /api/events and to the local log, so the screen updates at once.
 */
export function useCadet({ needIntro = true } = {}) {
  const router = useRouter();
  const [cadet, setCadet] = useState<Cadet | null>(null);
  const [log, setLog] = useState<LoggedEvent[] | null>(null);

  useEffect(() => {
    let gone = false;
    (async () => {
      const j = await fetch("/api/player").then((r) => r.json()).catch(() => ({ player: null }));
      if (gone) return;
      if (!j.player) return router.replace("/");
      if (needIntro && !j.introCompleted && !new URLSearchParams(location.search).has("dev")) return router.replace("/intro");
      const events = await history();
      if (gone) return;
      setCadet(j.player);
      setLog(events);
    })();
    return () => { gone = true; };
  }, [router, needIntro]);

  const state = useMemo(() => (log ? fold(log) : null), [log]);
  const emit = useCallback((e: EventInput) => { post(e); setLog((l) => [...(l ?? []), { ...e, at: Date.now() }]); }, []);
  return { cadet, log, state, emit };
}
