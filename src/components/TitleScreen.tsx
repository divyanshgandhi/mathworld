"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { TitleScene } from "@/worlds/space/title";
import { Button } from "./kit/Button";
import { RingLogo } from "./kit/Brand";
import "./hub/title.css";
import { CadetSignUp, SIGNUP_KEY, type Cadet } from "./hub/CadetSignUp";

/** The sign-up was on screen when this tab reloaded (it comes back to the name field, not Start game). */
const onSignUp = () => { try { return sessionStorage.getItem(SIGNUP_KEY) !== null; } catch { return false; } };
import { forgetCadet, knownCadets, rememberCadet, type KnownCadet } from "./hub/cadets";
import { useScene } from "./hub/Scene";

/** Dev only (?dev): every planet and a few exact drills. */
const PLANETS = ["mercury", "venus", "earth", "moon", "mars", "asteroid-belt", "jupiter", "saturn", "uranus", "deep-space"] as const;
const DRILLS = [
  ["earth", 0, 7], ["earth", 1, 10], ["moon", 3, 4], ["moon", 7, 10], ["moon", 10, 8], ["mars", 3, 8], ["mars", 8, 3], ["mars", 4, 9], ["asteroid-belt", 7, 8],
  ["jupiter", 6, 24], ["jupiter", 4, 19], ["saturn", 16, 24], ["saturn", 24, 16], ["uranus", 7, 345], ["deep-space", 343, 4536],
] as const;

/**
 * The words never wait longer than this for the fly-in: Start game, the screen's only action, is on
 * screen within about a second even on a slow device (the fly-in keeps playing behind the words).
 */
const REVEAL_FALLBACK_MS = 700;

/**
 * Where the words sit. "side": the system to the right of them (wide screens, and short landscape
 * phones); "stack": the system above them (phones, tablets and anything up to about 1100 px wide, so
 * the system is never shrunk to a speck beside the words). The CSS below uses the same query.
 */
const SIDE = "(min-width: 1100px), (min-width: 640px) and (min-aspect-ratio: 16/10)";
const sideNow = () => matchMedia(SIDE).matches;
const onMedia = (fn: () => void) => { const m = matchMedia(SIDE); m.addEventListener("change", fn); return () => m.removeEventListener("change", fn); };

type Me = { player: (Cadet & { id?: string }) | null; introCompleted: boolean };
/** What the words block is showing: nothing to press yet, Start game, the sign-up, welcome back, or the switch question. */
type Phase = "wait" | "new" | "signup" | "back" | "switch";

/**
 * The Title (design/title.html): the Solar System flies in from deep space, then the wordmark and the
 * words arrive. The words block is the whole interface, and it changes in place:
 * - a new player: one plain line and Start game, which turns the block into the sign-up (`CadetSignUp`);
 * - a returning player: "Welcome back, Cadet <name>", Continue (to the Resting Bay, or to the film if
 *   it was never finished), and a quiet "Not <name>? Switch cadet" that asks before it forgets anyone.
 * The 3D system is framed around the words (`frameAround`), so no planet ever passes behind them.
 */
export function TitleScreen() {
  const router = useRouter();
  const { box, scene } = useScene<TitleScene>(async (stage) => (await import("@/worlds/space/title")).mountTitle(stage));
  const [me, setMe] = useState<Me | null>(null);
  const [phase, setPhase] = useState<Phase>("wait");
  const [settled, setSettled] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [others, setOthers] = useState<KnownCadet[]>([]);
  const [moved, setMoved] = useState(false); // the first phase arrives quietly; later ones take focus
  const words = useRef<HTMLDivElement>(null);
  const side = useSyncExternalStore(onMedia, sideNow, () => true);
  const dev = useSyncExternalStore(() => () => {}, () => new URLSearchParams(location.search).has("dev"), () => false);

  useEffect(() => {
    let gone = false;
    fetch("/api/player").then((r) => r.json())
      .then((j) => ({ player: j.player ?? null, introCompleted: !!j.introCompleted }))
      .catch(() => ({ player: null, introCompleted: false }))
      .then((m: Me) => {
        if (gone) return;
        setMe(m);
        if (m.player?.id) rememberCadet({ id: m.player.id, name: m.player.name });
        setOthers(knownCadets().filter((c) => c.id !== m.player?.id));
        // after Switch cadet in the Resting Bay (/?switch), go straight to the choice of cadet
        const q = new URLSearchParams(location.search);
        setPhase(m.player ? (q.has("switch") ? "switch" : "back") : q.has("new") || onSignUp() ? "signup" : "new");
      });
    router.prefetch("/bay");
    router.prefetch("/intro");
    return () => { gone = true; };
  }, [router]);

  // the words wait for the fly-in to settle, but never long
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), REVEAL_FALLBACK_MS);
    const off = scene?.onSettled(() => setSettled(true));
    return () => { window.clearTimeout(t); off?.(); };
  }, [scene]);

  // keep the system clear of the words: hand the scene the words' box whenever it changes shape
  useLayoutEffect(() => {
    const el = words.current;
    if (!scene || !el) return;
    const send = () => {
      const r = el.getBoundingClientRect();
      scene.frameAround({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }, side ? "side" : "stack");
    };
    send();
    const ro = new ResizeObserver(send);
    ro.observe(el);
    window.addEventListener("resize", send);
    return () => { ro.disconnect(); window.removeEventListener("resize", send); };
  }, [scene, side]);

  const go = useCallback((p: Phase) => { setMoved(true); setPhase(p); }, []);

  /** A press is a gesture: wake the sound and warm the live voices while the cadet signs up or flies. */
  const wake = async () => {
    const [{ audio }, { warmVoice }] = await Promise.all([import("@/engine/audio"), import("@/engine/voice")]);
    audio.unlock();
    audio.sfx("chime");
    void warmVoice(["Hadley", "Zoey"]);
  };

  const start = () => { void wake(); go("signup"); };
  const resume = () => {
    if (leaving) return;
    setLeaving(true);
    void wake();
    router.push(me?.introCompleted ? "/bay" : "/intro");
  };
  const forget = async () => {
    if (leaving) return;
    setLeaving(true);
    await fetch("/api/player", { method: "DELETE" }).catch(() => null);
    setMe({ player: null, introCompleted: false });
    setLeaving(false);
    go("signup");
  };

  /** Play as a cadet made on this device before. */
  const pick = async (c: KnownCadet) => {
    if (leaving) return;
    setLeaving(true);
    const res = await fetch("/api/player", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: c.id }) }).catch(() => null);
    const j = res?.ok ? await res.json().catch(() => null) : null;
    setLeaving(false);
    if (!j?.player) { forgetCadet(c.id); setOthers((o) => o.filter((k) => k.id !== c.id)); return; }
    rememberCadet({ id: j.player.id, name: j.player.name });
    setMe({ player: j.player, introCompleted: !!j.introCompleted });
    setOthers(knownCadets().filter((k) => k.id !== j.player.id));
    go("back");
  };

  const name = me?.player?.name ?? "";
  const shown = settled && phase !== "wait";

  let body: ReactNode = null;
  if (phase === "wait" || phase === "new") {
    body = (
      <>
        <p className="mw-title-line">Answer with your shots. Clear the planets, one times table at a time.</p>
        <div className="mw-title-act" data-on={phase === "new" || undefined}>
          {phase === "new" && <Button variant="primary" size="lg" autoFocus={moved} onClick={start} className="mw-title-primary">Start game</Button>}
        </div>
      </>
    );
  } else if (phase === "signup") {
    body = <CadetSignUp remember className="mw-title-form" onDone={() => router.push("/intro")} onBack={me?.player ? () => go("back") : () => go("new")} />;
  } else if (phase === "back") {
    body = (
      <>
        <p className="mw-title-line">Welcome back, Cadet <b className="mw-title-name">{name}</b></p>
        <div className="mw-title-act" data-on>
          <Button variant="primary" size="lg" autoFocus={moved} onClick={resume} disabled={leaving} focusableWhenDisabled className="mw-title-primary">Continue</Button>
          <Button variant="quiet" onClick={() => go("switch")} className="mw-title-quiet"><span>Not {name}? Switch cadet</span></Button>
        </div>
      </>
    );
  } else {
    body = (
      <div role="group" aria-labelledby="switch-q" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); go("back"); } }}>
        <p id="switch-q" className="mw-title-ask">Who is playing?</p>
        <p className="mw-title-line !mt-3">Every cadet on this device keeps their orbs and Gold facts.</p>
        <div className="mw-title-act" data-on>
          <Button variant="primary" size="lg" autoFocus onClick={() => go("back")} className="mw-title-primary"><span>Keep playing as <bdi>{name}</bdi></span></Button>
          {others.map((c) => (
            <Button key={c.id} variant="secondary" size="lg" onClick={() => void pick(c)} disabled={leaving} focusableWhenDisabled><span>Play as <bdi>{c.name}</bdi></span></Button>
          ))}
          <Button variant="secondary" size="lg" onClick={() => void forget()} disabled={leaving} focusableWhenDisabled>New cadet</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mw-title fixed inset-0 select-none overflow-hidden bg-void text-approach" data-layout={side ? "side" : "stack"} data-phase={phase}>
      <div ref={box} className="absolute inset-0" aria-hidden="true" />
      <main className="mw-title-main" data-shown={shown || undefined}>
        <div ref={words} className="mw-title-words">
          <h1 className="mw-title-mark"><RingLogo size={84} className="mw-title-ring" /><span>Math World</span></h1>
          {/* each phase arrives in place: the block keeps its spot, its contents change */}
          <div key={phase === "wait" ? "new" : phase} className="mw-title-body">{body}</div>
        </div>
      </main>
      {dev && (
        <nav aria-label="Dev links" className="absolute bottom-3 left-3 z-20 max-w-[min(96vw,560px)] rounded-panel border border-line-1 bg-panel p-3 text-xs">
          <p className="mb-1 text-ink-3">Dev: planets</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PLANETS.map((p) => <Link key={p} href={`/play/${p}?dev`} className="mw-dev">{p}</Link>)}
            {["intro", "bay", "map", "hangar", "academy", "kit", "dev/planets"].map((p) => <Link key={p} href={`/${p}?dev`} className="mw-dev">/{p}</Link>)}
          </div>
          <p className="mb-1 text-ink-3">Dev: drills (every Power-Up, shot timings)</p>
          <div className="flex flex-wrap gap-1.5">
            {DRILLS.map(([p, a, b]) => <Link key={`${p}${a}x${b}`} href={`/play/${p}?dev&a=${a}&b=${b}`} className="mw-dev">{a}×{b}</Link>)}
          </div>
        </nav>
      )}
    </div>
  );
}
