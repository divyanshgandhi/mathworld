"use client";
import { Button } from "@ui-sdk/react/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CadetSignUp, glass, lime, type Cadet } from "./battle/ui";
import { useScene } from "./hub/Scene";

/** Dev only (?dev): every planet and a few exact drills. */
const PLANETS = ["mercury", "venus", "earth", "moon", "mars", "asteroid-belt", "jupiter", "saturn", "uranus", "deep-space"] as const;
const DRILLS = [
  ["earth", 0, 7], ["earth", 1, 10], ["moon", 3, 4], ["moon", 7, 10], ["moon", 10, 8], ["mars", 3, 8], ["mars", 8, 3], ["mars", 4, 9], ["asteroid-belt", 7, 8],
  ["jupiter", 6, 24], ["jupiter", 4, 19], ["saturn", 16, 24], ["saturn", 24, 16], ["uranus", 7, 345], ["deep-space", 343, 4536],
] as const;

/**
 * The Title Screen (SPEC §2.1–2.2): the Solar System fly-through, MATH WORLD, one Start Game.
 * Start unlocks sound and warms the Phonon voice worker, then routes by cookie + log:
 * a returning cadet goes straight to the Resting Bay, a new one signs up and watches the intro.
 */
export function TitleScreen() {
  const router = useRouter();
  const { box } = useScene(async (stage) => (await import("@/worlds/space/title")).mountTitle(stage));
  const [me, setMe] = useState<{ player: Cadet | null; introCompleted: boolean } | null>(null);
  const [signUp, setSignUp] = useState(false);
  const dev = useSyncExternalStore(() => () => {}, () => new URLSearchParams(location.search).has("dev"), () => false);

  useEffect(() => {
    fetch("/api/player").then((r) => r.json()).then((j) => setMe({ player: j.player ?? null, introCompleted: !!j.introCompleted })).catch(() => setMe({ player: null, introCompleted: false }));
    router.prefetch("/bay");
    router.prefetch("/intro");
  }, [router]);

  const start = async () => {
    const [{ audio }, { warmVoice }] = await Promise.all([import("@/engine/audio"), import("@/engine/voice")]);
    audio.unlock();
    audio.sfx("chime");
    void warmVoice(["Hadley", "Zoey"]); // the live voices load in the background while the cadet signs up or flies
    if (!me?.player) return setSignUp(true);
    router.push(me.introCompleted ? "/bay" : "/intro");
  };

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#02030a] text-white">
      <div ref={box} className="absolute inset-0" />
      {!signUp && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-between px-6 pb-[13vh] pt-[16vh] md:justify-center md:gap-10 md:py-0">
          <h1 className="text-center font-mono text-[clamp(44px,11vw,128px)] font-bold leading-none tracking-[0.18em] text-white drop-shadow-[0_6px_30px_rgba(0,0,0,.7)]">
            MATH<span className="text-lime-300"> WORLD</span>
          </h1>
          <div className="pointer-events-auto flex flex-col items-center gap-3">
            <Button className={`${lime} px-10 py-4 text-xl shadow-[0_0_0_6px_rgba(3,6,18,.55),0_0_40px_rgba(190,242,100,.35)]`} disabled={!me} onClick={() => void start()}>Start Game</Button>
            {me?.player && <p className="rounded-full bg-black/40 px-4 py-1 text-sm text-white/70">Cadet <b className="text-white">{me.player.name}</b></p>}
          </div>
        </div>
      )}
      {signUp && <CadetSignUp cta="▶ Begin" onDone={() => router.push("/intro")} />}
      {dev && (
        <nav aria-label="Dev links" className={`${glass} absolute bottom-3 left-3 z-20 max-w-[min(96vw,560px)] p-3 font-mono text-xs`}>
          <p className="mb-1 text-white/50">DEV · planets</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PLANETS.map((p) => <Link key={p} href={`/play/${p}?dev`} className="rounded border border-white/15 px-2 py-0.5 hover:border-lime-300">{p}</Link>)}
            {["intro", "bay", "map", "hangar", "academy"].map((p) => <Link key={p} href={`/${p}?dev`} className="rounded border border-lime-300/40 px-2 py-0.5 hover:border-lime-300">/{p}</Link>)}
          </div>
          <p className="mb-1 text-white/50">DEV · drills (every Power-Up, shot timings)</p>
          <div className="flex flex-wrap gap-1.5">
            {DRILLS.map(([p, a, b]) => <Link key={`${p}${a}x${b}`} href={`/play/${p}?dev&a=${a}&b=${b}`} className="rounded border border-white/15 px-2 py-0.5 hover:border-lime-300">{a}×{b}</Link>)}
          </div>
        </nav>
      )}
    </div>
  );
}
