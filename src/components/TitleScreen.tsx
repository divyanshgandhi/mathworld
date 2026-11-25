"use client";
import { Button } from "@ui-sdk/react/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { COLOR, EDGE, INK, LINE, MOTION, RADIUS, TYPE } from "@/design/tokens";
import type { TitleScene } from "@/worlds/space/title";
import { CadetSignUp, type Cadet } from "./battle/ui";
import { useScene } from "./hub/Scene";

/** Dev only (?dev): every planet and a few exact drills. */
const PLANETS = ["mercury", "venus", "earth", "moon", "mars", "asteroid-belt", "jupiter", "saturn", "uranus", "deep-space"] as const;
const DRILLS = [
  ["earth", 0, 7], ["earth", 1, 10], ["moon", 3, 4], ["moon", 7, 10], ["moon", 10, 8], ["mars", 3, 8], ["mars", 8, 3], ["mars", 4, 9], ["asteroid-belt", 7, 8],
  ["jupiter", 6, 24], ["jupiter", 4, 19], ["saturn", 16, 24], ["saturn", 24, 16], ["uranus", 7, 345], ["deep-space", 343, 4536],
] as const;

/** If the 3D scene never reports that it settled (no WebGL, a slow device), the words still arrive. */
/**
 * The words never wait longer than this for the fly-in: Start game, the screen's only action, must be
 * there within about a second even on a slow device (the fly-in keeps playing behind the words).
 */
const REVEAL_FALLBACK_MS = 700;

/**
 * The Title Screen (design/title.html): the Solar System flies in from deep space, then the wordmark, one
 * plain line, Start game and the welcome back arrive. The 3D system is framed around the words
 * (`frameAround`), so no planet ever passes behind them.
 * Start unlocks sound and warms the Phonon voice worker, then routes by cookie + log:
 * a returning cadet goes straight to the Resting Bay, a new one signs up and watches the intro.
 *
 * Styles come from src/design/tokens.ts directly; the kit's shared buttons replace the local pill once merged.
 */
export function TitleScreen() {
  const router = useRouter();
  const { box, scene } = useScene<TitleScene>(async (stage) => (await import("@/worlds/space/title")).mountTitle(stage));
  const [me, setMe] = useState<{ player: Cadet | null; introCompleted: boolean } | null>(null);
  const [signUp, setSignUp] = useState(false);
  const [settled, setSettled] = useState(false);
  const words = useRef<HTMLDivElement>(null);
  const dev = useSyncExternalStore(() => () => {}, () => new URLSearchParams(location.search).has("dev"), () => false);

  useEffect(() => {
    fetch("/api/player").then((r) => r.json()).then((j) => setMe({ player: j.player ?? null, introCompleted: !!j.introCompleted })).catch(() => setMe({ player: null, introCompleted: false }));
    router.prefetch("/bay");
    router.prefetch("/intro");
  }, [router]);

  // the words wait for the fly-in to settle
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), REVEAL_FALLBACK_MS);
    const off = scene?.onSettled(() => setSettled(true));
    return () => { window.clearTimeout(t); off?.(); };
  }, [scene]);

  // keep the system clear of the words: hand the scene the words' box whenever the layout changes
  useLayoutEffect(() => {
    const el = words.current;
    if (!scene || !el) return;
    const send = () => {
      const r = el.getBoundingClientRect();
      scene.frameAround({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    };
    send();
    const ro = new ResizeObserver(send);
    ro.observe(el);
    window.addEventListener("resize", send);
    return () => { ro.disconnect(); window.removeEventListener("resize", send); };
  }, [scene, signUp]);

  const start = async () => {
    const [{ audio }, { warmVoice }] = await Promise.all([import("@/engine/audio"), import("@/engine/voice")]);
    audio.unlock();
    audio.sfx("chime");
    void warmVoice(["Hadley", "Zoey"]); // the live voices load in the background while the cadet signs up or flies
    if (!me?.player) return setSignUp(true);
    router.push(me.introCompleted ? "/bay" : "/intro");
  };

  const shown = settled, canStart = settled && !!me;
  const reveal = (on: boolean, delay: number): CSSProperties => ({
    opacity: on ? 1 : 0,
    transform: on ? "none" : "translateY(14px)",
    transition: `opacity ${MOTION.moment * 0.8}ms ease-out ${delay}ms, transform ${MOTION.moment}ms ${MOTION.ease} ${delay}ms`,
  });
  const vars = {
    "--mw-void": COLOR.void, "--mw-press": COLOR.panel, "--mw-edge": EDGE.rest, "--mw-edge-hot": EDGE.hot, "--mw-ease": MOTION.ease,
    fontFamily: `"${TYPE.family}", sans-serif`, color: INK[1], background: COLOR.void,
  } as CSSProperties;

  return (
    <div className="fixed inset-0 select-none overflow-hidden" style={vars}>
      <div ref={box} className="absolute inset-0" aria-hidden="true" />
      {!signUp && (
        <main className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end px-6 pb-[10vh] min-[821px]:justify-center min-[821px]:px-[clamp(24px,6vw,104px)] min-[821px]:pb-0">
          <div ref={words} className="flex flex-col min-[821px]:w-fit min-[821px]:max-w-[760px]">
            <div className="flex items-center gap-[clamp(14px,2vw,28px)] motion-reduce:!transition-none" style={reveal(shown, 0)}>
              <RingMark />
              <h1
                className="m-0 whitespace-nowrap text-[clamp(26px,8.2vw,40px)] leading-none tracking-[0.08em] min-[821px]:text-[clamp(38px,5.2vw,80px)] min-[821px]:tracking-[0.14em]"
                style={{ fontWeight: TYPE.display.weight, fontStretch: `${TYPE.display.stretch}%`, textTransform: "uppercase" }}
              >
                Math World
              </h1>
            </div>
            <p className="m-0 mt-7 max-w-[30ch] text-[clamp(18px,1.6vw,22px)] leading-normal motion-reduce:!transition-none" style={{ color: INK[2], ...reveal(shown, 150) }}>
              Answer with your shots. Clear the planets, one times table at a time.
            </p>
            <div className="mt-11 flex min-[821px]:block" style={reveal(canStart, 200)}>
              <Button
                className="mw-start pointer-events-auto inline-flex h-[76px] w-full cursor-pointer items-center justify-between gap-[22px] border-2 border-transparent pl-[42px] pr-4 text-[19px] uppercase outline-none min-[821px]:w-auto min-[821px]:justify-start"
                style={{ borderRadius: RADIUS.pill, color: INK[1], fontStretch: "118%", fontWeight: 600, letterSpacing: "0.2em", visibility: canStart ? "visible" : "hidden" }}
                disabled={!canStart}
                onClick={() => void start()}
              >
                Start game
                <RocketGlyph />
              </Button>
            </div>
            <p className="m-0 mt-[18px] min-h-6 text-base motion-reduce:!transition-none" style={{ color: INK[3], ...reveal(shown && !!me?.player, 550) }}>
              {me?.player && <>Welcome back, Cadet <b style={{ fontWeight: 500, color: INK[1] }}>{me.player.name}</b></>}
            </p>
          </div>
        </main>
      )}
      {signUp && <CadetSignUp cta="Begin" onDone={() => router.push("/intro")} />}
      {dev && (
        <nav aria-label="Dev links" className="absolute bottom-3 left-3 z-20 max-w-[min(96vw,560px)] p-3 text-xs" style={{ background: COLOR.panel, border: `1px solid ${LINE[1]}`, borderRadius: RADIUS.panel }}>
          <p className="mb-1" style={{ color: INK[3] }}>Dev: planets</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PLANETS.map((p) => <Link key={p} href={`/play/${p}?dev`} className="mw-dev rounded px-2 py-0.5">{p}</Link>)}
            {["intro", "bay", "map", "hangar", "academy", "dev/planets"].map((p) => <Link key={p} href={`/${p}?dev`} className="mw-dev rounded px-2 py-0.5">/{p}</Link>)}
          </div>
          <p className="mb-1" style={{ color: INK[3] }}>Dev: drills (every Power-Up, shot timings)</p>
          <div className="flex flex-wrap gap-1.5">
            {DRILLS.map(([p, a, b]) => <Link key={`${p}${a}x${b}`} href={`/play/${p}?dev&a=${a}&b=${b}`} className="mw-dev rounded px-2 py-0.5">{a}×{b}</Link>)}
          </div>
        </nav>
      )}
      <style>{`
        .mw-start{background:linear-gradient(var(--mw-void),var(--mw-void)) padding-box,var(--mw-edge) border-box;transition:background ${MOTION.route}ms var(--mw-ease)}
        .mw-start:hover,.mw-start:focus-visible{background:linear-gradient(var(--mw-press),var(--mw-press)) padding-box,var(--mw-edge-hot) border-box}
        .mw-start:focus-visible{outline:2px solid ${COLOR.gold};outline-offset:4px}
        .mw-start svg{transition:transform ${MOTION.moment}ms var(--mw-ease)}
        .mw-start:hover svg{transform:translateY(-4px)}
        .mw-dev{border:1px solid ${LINE[1]};color:${INK[2]}}
        .mw-dev:hover,.mw-dev:focus-visible{border-color:${COLOR.gold};color:${INK[1]}}
        @media (prefers-reduced-motion:reduce){.mw-start svg{transition:none}}
      `}</style>
    </div>
  );
}

/** The ring logo: a hairline world, the gold orbit and a small moon. */
function RingMark() {
  return (
    <svg viewBox="0 0 34 34" aria-hidden="true" className="h-auto w-10 flex-none min-[821px]:w-[clamp(48px,6vw,84px)]">
      <circle cx="17" cy="17" r="15.5" fill="none" stroke={COLOR.approach} strokeWidth=".9" />
      <circle cx="17" cy="17" r="7.5" fill="none" stroke={COLOR.gold} strokeWidth=".9" />
      <circle cx="29.8" cy="8.6" r="1.7" fill={COLOR.approach} />
    </svg>
  );
}

/** The primary action's glyph: a rocket in a dashed gold ring. */
function RocketGlyph() {
  return (
    <svg viewBox="0 0 44 44" aria-hidden="true" className="h-[46px] w-[46px] flex-none">
      <circle cx="22" cy="22" r="20" fill="none" stroke={COLOR.gold} strokeWidth="1.3" strokeDasharray="2 3.4" />
      <path d="M22 10c4.5 3.6 6.4 9 5.4 15.5h-10.8C15.6 19 17.5 13.6 22 10z" fill={COLOR.approach} />
      <circle cx="22" cy="18.5" r="2.2" fill={COLOR.void} />
      <path d="M18.5 25.5l-3 4.5M25.5 25.5l3 4.5" stroke={COLOR.approach} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M22 27v6" stroke={COLOR.ember} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
