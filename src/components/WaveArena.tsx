"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushed, history, post } from "@/engine/outbox";
import type { Stage } from "@/engine/stage";
import type { PlanetId } from "@/rig/pools";
import type { Arena, ArenaUi } from "@/worlds/space/arena";
import { fold } from "@/director/fold";
import { canLaunch } from "@/director/hub";
import { BattleHud } from "./battle/BattleHud";
import { PauseMenu } from "./battle/PauseMenu";
import { CadetSignUp, type Cadet } from "./hub/CadetSignUp";
import { css } from "./battle/cockpit";
import { Sheet } from "@/components/kit";
import { FirstShotGuide } from "@/components/teach/FirstShotGuide";

declare global { interface Window { __mw?: { stage: Stage; arena?: Arena; [k: string]: unknown } } }

const readQuery = () => {
  const q = new URLSearchParams(location.search), a = Number(q.get("a")), b = Number(q.get("b"));
  const dev = q.has("dev");
  return JSON.stringify({ dev, force: dev && q.has("a") && q.has("b") && Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 ? { a, b } : null });
};

/**
 * A planet battle as a full-screen game: the stage fills the viewport, the cockpit sits on its edges
 * (BattleHud: the mission strip on top, the console at the bottom or right). Fleets start with their
 * structure hidden (the arena's default, `structure: "discover"`; `?dev&labels` turns the labels back on):
 * the hint ladder reveals squads and ships each.
 * Waves come from the cadet's folded event log; every action is appended to /api/events.
 * `?dev` shows shot timings and unlocks every Power-Up; `?dev&a=6&b=24` drills one exact fleet.
 */
export function WaveArena({ planet }: { planet: PlanetId }) {
  const box = useRef<HTMLDivElement>(null);
  const [arena, setArena] = useState<Arena | null>(null);
  const [ui, setUi] = useState<ArenaUi | null>(null);
  const [cadet, setCadet] = useState<Cadet | null | undefined>(undefined);
  const query = useSyncExternalStore(() => () => {}, readQuery, () => JSON.stringify({ dev: false, force: null }));
  const { dev, force } = JSON.parse(query) as { dev: boolean; force: { a: number; b: number } | null };

  const router = useRouter();
  useEffect(() => {
    fetch("/api/player").then((r) => r.json()).then((j) => {
      // no cadet on this device: the Title signs them up (dev drills sign up right here)
      if (!j.player && !new URLSearchParams(location.search).has("dev")) return router.replace("/");
      setCadet(j.player);
    }).catch(() => setCadet(null));
  }, [router]);

  useEffect(() => {
    if (!cadet) return;
    let gone = false, cleanup = () => {};
    (async () => {
      const [{ createStage }, { mountArena }, log] = await Promise.all([import("@/engine/stage"), import("@/worlds/space/arena"), history()]);
      if (gone || !box.current) return;
      // a locked planet is a silhouette on the map, not a battle (dev drills may go anywhere)
      if (!dev && !canLaunch(fold(log), planet)) return router.replace("/map");
      const stage = createStage(box.current, { fill: true });
      const a = mountArena(stage, { planet, history: log, onUi: setUi, onEvent: post, dev, force });
      const { audio } = await import("@/engine/audio");
      window.__mw = { stage, arena: a, audio };
      setArena(a);
      // flown in from another battle: sound is already unlocked, so launch straight away
      if (audio.context?.state === "running") a.start();
      cleanup = () => { a.dispose(); stage.dispose(); };
    })();
    return () => { gone = true; cleanup(); };
  }, [cadet, planet, dev, force?.a, force?.b]); // eslint-disable-line react-hooks/exhaustive-deps

  const fly = async (to: PlanetId) => { await flushed(); router.push(`/play/${to}${dev ? "?dev" : ""}`); };

  return (
    // the game root: focused on mount so the keyboard works without a click; no text selection, no zoom
    <div className={css.root} data-cockpit tabIndex={-1} inputMode="none" autoFocus>
      <div ref={box} className="absolute inset-0" />
      {cadet === null && (
        <Sheet className="absolute inset-0 z-30 m-auto h-fit max-h-[92dvh] w-[min(92%,520px)] overflow-y-auto p-6 md:p-8">
          <CadetSignUp onDone={setCadet} />
        </Sheet>
      )}
      <BattleHud arena={arena} ui={ui} onFly={(to) => void fly(to)} dev={dev} drone={planet === "earth"} menu={<PauseMenu />} />
      {/* a player whose very first shot is here (a refresh, a drill): the guided first shot, once ever */}
      {arena && <FirstShotGuide ui={ui} bus={arena.bus} fleetRect={arena.fleetRect} rocketRect={arena.rocketRect} />}
    </div>
  );
}
