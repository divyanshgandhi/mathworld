"use client";
import { Button } from "@ui-sdk/react/button";
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@ui-sdk/react/dialog";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { TRICKS } from "@/db/events";
import { posters as postersOf, type Poster } from "@/director/hub";
import { CARD, type TrickId } from "@/rig/tricks";
import { BAND_COLOURS, type RestingBay } from "@/worlds/space/restingBay";
import { backdrop, dialogBox, ghost, glass, lime } from "./battle/ui";
import { Flashcards } from "./hub/Flashcards";
import { Anchor, useScene } from "./hub/Scene";
import { useCadet } from "./hub/useCadet";

const BAND_NAME = { unseen: "Not met yet", practicing: "Practising", understood: "Understood", gold: "Gold: instant" } as const;
const DOORS = [
  { id: "hangar", to: "/hangar", label: "The Hangar", sub: "Spend Orbs on your ship" },
  { id: "launch", to: "/map", label: "Launch to Space", sub: "The Solar System map" },
  { id: "academy", to: "/academy", label: "The Academy", sub: "Watch any Trick Film" },
] as const;

/**
 * The Resting Bay (/bay): the cadet's cabin hub. Everything is in the room: doors, wall posters,
 * the desk. React pins named buttons to the 3D scene, so the room stays the interface.
 */
export function RestingBayScreen() {
  const router = useRouter();
  const { cadet, state, emit } = useCadet();
  const ps = useMemo(() => (state ? postersOf(state) : null), [state]);
  const cards = useMemo(() => (state ? TRICKS.filter((t) => (state.seenTricks[t] ?? 0) > 0) : []), [state]);
  const { box, stage, scene } = useScene<RestingBay>(async (s) => {
    const { mountRestingBay } = await import("@/worlds/space/restingBay");
    return mountRestingBay(s, { posters: [], cards: [] });
  });
  const [poster, setPoster] = useState<Poster | null>(null);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [deck, setDeck] = useState(false);

  useEffect(() => { if (scene && ps) scene.setPosters(ps); }, [scene, ps]);
  useEffect(() => { if (scene && state) scene.setCards(cards.map((t) => CARD[t])); }, [scene, state, cards]);
  useEffect(() => { void import("@/engine/audio").then(({ audio }) => audio.mood("hangar")); }, []);
  useEffect(() => { for (const d of DOORS) router.prefetch(d.to); }, [router]);

  const switchCadet = async () => { await fetch("/api/player", { method: "DELETE" }); router.push("/"); };
  const ready = !!(scene && state);

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#05070f] text-white">
      <div ref={box} className="absolute inset-0" />

      {ready && (
        <>
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2">
            <span className={`${glass} px-4 py-2 font-mono text-xs tracking-[0.25em] text-lime-200`}>RESTING BAY</span>
            {cadet && <span className="rounded-full bg-black/45 px-3 py-1 text-sm text-white/80">Cadet <b className="text-white">{cadet.name}</b></span>}
          </div>
          <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-black/45 px-3 py-1.5 font-mono text-sm text-amber-200">✦ {state.orbs} orbs</div>

          {DOORS.map((d) => (
            <Anchor key={d.id} stage={stage} scene={scene} id={`door:${d.id}`} className="hidden md:block">
              <Button aria-label={d.label} onClick={() => router.push(d.to)}
                className={`${d.id === "launch" ? lime : `${ghost} bg-[#0b0d1a]/70 backdrop-blur`} flex flex-col items-center rounded-2xl px-4 py-2.5 text-center shadow-lg md:px-5 md:py-3`}>
                <span className="text-sm font-semibold md:text-base">{d.id === "launch" ? "🚀 " : ""}{d.label}</span>
                <span className={`hidden text-[11px] md:block ${d.id === "launch" ? "text-[#1a2a06]/80" : "text-white/55"}`}>{d.sub}</span>
              </Button>
            </Anchor>
          ))}

          {ps?.map((p) => (
            <Anchor key={p.table} stage={stage} scene={scene} id={`poster:${p.table}`} className="hidden md:block">
              <Button aria-label={`Poster ×${p.table}: ${BAND_NAME[p.band]}`} onClick={() => setPoster(p)}
                className="group grid h-14 w-11 place-items-center rounded-lg border-2 border-transparent font-mono text-sm font-bold outline-none transition hover:border-(--c) focus-visible:border-(--c) focus-visible:ring-2 focus-visible:ring-lime-300"
                style={{ "--c": BAND_COLOURS[p.band].edge, color: BAND_COLOURS[p.band].edge } as CSSProperties}>
                <span className="rounded bg-black/70 px-1 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">×{p.table}</span>
              </Button>
            </Anchor>
          ))}

          <Anchor stage={stage} scene={scene} id="desk:cards" className="hidden md:block">
            <Button aria-label={`Trick Cards: ${cards.length} collected`} onClick={() => setCardsOpen(true)} className="rounded-full border border-amber-300/70 bg-[#1a1406]/85 px-3 py-1.5 text-xs font-semibold text-amber-100 shadow-lg hover:bg-[#2a2008]">
              ⚡ Trick Cards · {cards.length}
            </Button>
          </Anchor>
          <Anchor stage={stage} scene={scene} id="desk:deck" className="hidden md:block">
            <Button aria-label="Quick Flashcards" onClick={() => setDeck(true)} className="mt-12 rounded-full border border-sky-300/70 bg-[#06202b]/85 px-3 py-1.5 text-xs font-semibold text-sky-100 shadow-lg hover:bg-[#0a3040]">
              🃏 Quick Flashcards
            </Button>
          </Anchor>

          {/* phones: the room is too small to tap, so the same places sit in a cockpit dock */}
          <nav aria-label="Resting Bay" className={`${glass} absolute inset-x-2 bottom-10 z-10 flex flex-col gap-2 p-3 md:hidden`}>
            <Button className={`${lime} py-3 text-base`} onClick={() => router.push("/map")}>🚀 Launch to Space</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button className={`${ghost} py-2.5`} onClick={() => router.push("/hangar")}>The Hangar</Button>
              <Button className={`${ghost} py-2.5`} onClick={() => router.push("/academy")}>The Academy</Button>
              <Button className="rounded-xl border border-amber-300/60 bg-[#1a1406]/70 py-2.5 text-sm text-amber-100" onClick={() => setCardsOpen(true)}>⚡ Trick Cards · {cards.length}</Button>
              <Button className="rounded-xl border border-sky-300/60 bg-[#06202b]/70 py-2.5 text-sm text-sky-100" onClick={() => setDeck(true)}>🃏 Flashcards</Button>
            </div>
            <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Times-table posters">
              {ps?.map((p) => (
                <Button key={p.table} aria-label={`Poster ×${p.table}: ${BAND_NAME[p.band]}`} onClick={() => setPoster(p)} className="rounded-lg border-2 py-1.5 font-mono text-sm font-bold"
                  style={{ borderColor: BAND_COLOURS[p.band].edge, background: BAND_COLOURS[p.band].bg, color: BAND_COLOURS[p.band].ink }}>×{p.table}</Button>
              ))}
            </div>
          </nav>

          <Button onClick={() => void switchCadet()} className="absolute bottom-3 left-3 z-10 rounded-full px-3 py-1 text-xs text-white/40 outline-none hover:text-white/80 focus-visible:ring-2 focus-visible:ring-lime-300">Switch Cadet</Button>
        </>
      )}

      <Dialog open={!!poster} onOpenChange={(o) => { if (!o) setPoster(null); }}>
        <DialogBackdrop className={backdrop} />
        <DialogContent className={`${dialogBox} w-[min(92vw,380px)] p-5`}>
          {poster && (
            <>
              <DialogTitle className="font-mono text-3xl font-bold" style={{ color: BAND_COLOURS[poster.band].edge }}>×{poster.table} table</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-white/65">{BAND_NAME[poster.band]} · {poster.gold}/10 Gold</DialogDescription>
              <ol className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-sm tabular-nums">
                {poster.cells.map((c) => (
                  <li key={c.n} className="rounded-lg px-3 py-1.5" style={{ background: BAND_COLOURS[c.band].bg, color: BAND_COLOURS[c.band].ink }}>{poster.table} × {c.n} = {poster.table * c.n}</li>
                ))}
              </ol>
              <ul className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/70" aria-label="Colour key">
                {(["unseen", "practicing", "understood", "gold"] as const).map((b) => <li key={b} className="flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ background: BAND_COLOURS[b].edge }} />{BAND_NAME[b]}</li>)}
              </ul>
              <DialogClose className={`${lime} mt-4 w-full py-2.5`}>Done</DialogClose>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={cardsOpen} onOpenChange={setCardsOpen}>
        <DialogBackdrop className={backdrop} />
        <DialogContent className={`${dialogBox} w-[min(92vw,440px)] p-5`}>
          <DialogTitle className="font-mono text-xs tracking-[0.3em] text-amber-300">YOUR TRICK CARDS</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-white/65">{cards.length ? "Tap a card to watch its film in the Academy." : "Win a Show Me How in battle to collect your first card."}</DialogDescription>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {cards.map((t: TrickId) => (
              <Button key={t} aria-label={`Watch ${CARD[t]}`} onClick={() => router.push(`/academy?trick=${t}`)} className="rounded-xl bg-amber-200 px-3 py-3 text-left text-sm font-bold text-[#1a1406] outline-none hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-lime-300">⚡ {CARD[t]}</Button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button className={`${ghost} flex-1 py-2.5`} onClick={() => router.push("/academy")}>The Academy</Button>
            <DialogClose className={`${lime} flex-1 py-2.5`}>Done</DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {deck && state && <Flashcards state={state} emit={emit} onClose={() => setDeck(false)} />}
    </div>
  );
}
