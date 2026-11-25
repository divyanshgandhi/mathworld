"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EventInput } from "@/db/events";
import { fold, type LoggedEvent } from "@/director/fold";
import { history, post } from "@/engine/outbox";
import type { Cadet } from "./CadetSignUp";

/**
 * The current cadet for a hub screen (Bay, Map, Hangar, Academy): their name, their event log and
 * the state folded from it. No cadet on this device, or one who has not finished the intro, goes
 * back to the Title. `emit` appends to /api/events and to the local log, so the screen updates at once;
 * if the server rejects the event for good, it leaves the local log again (the orbs shown come back to
 * what is saved, quietly). With `{ afterSave: true }` the event joins the local log only once it is
 * stored (a patrol's pay is never shown before the server has it). Either way it returns the outbox's
 * promise: true once stored, false if rejected.
 */
export function useCadet({ needIntro = true } = {}) {
  const [cadet, setCadet] = useState<Cadet | null>(null);
  const [log, setLog] = useState<LoggedEvent[] | null>(null);

  useEffect(() => {
    let gone = false;
    (async () => {
      const j = await fetch("/api/player").then((r) => r.json()).catch(() => ({ player: null }));
      if (gone) return;
      // A hard replace, not router.replace: a soft one from inside this effect could stall and leave
      // the screen on its loading line for ever (a cadet who left the first mission and came back).
      if (!j.player) return location.replace("/");
      if (needIntro && !j.introCompleted && !new URLSearchParams(location.search).has("dev")) return location.replace("/intro");
      const events = await history();
      if (gone) return;
      setCadet(j.player);
      setLog(events);
    })();
    return () => { gone = true; };
  }, [needIntro]);

  const state = useMemo(() => (log ? fold(log) : null), [log]);
  const emit = useCallback((e: EventInput, { afterSave = false } = {}) => {
    const entry: LoggedEvent = { ...e, at: Date.now() } as LoggedEvent;
    const stored = post(e);
    if (afterSave) void stored.then((ok) => { if (ok) setLog((l) => [...(l ?? []), entry]); });
    else {
      setLog((l) => [...(l ?? []), entry]);
      void stored.then((ok) => { if (!ok) setLog((l) => l && l.filter((x) => x !== entry)); });
    }
    return stored;
  }, []);
  return { cadet, log, state, emit };
}
