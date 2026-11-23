"use client";
import { Button } from "@ui-sdk/react/button";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UPGRADE_SLOTS } from "@/db/events";
import { CATALOG, priceFor, purchase, SLOT_NAMES, STARTER, type Slot } from "@/director/hangar";
import type { HangarBay, ShipStyle } from "@/worlds/space/hangarBay";
import { ghost, glass, lime } from "./battle/ui";
import { useScene } from "./hub/Scene";
import { useCadet } from "./hub/useCadet";

/**
 * The Hangar (/hangar): three upgrade slots. Tap an item to see it on the rocket at once (the
 * blaster test-fires), then buy it with Orbs or equip one you own. Purchases are events; the fold
 * charges the catalogue price, and the next battle builds the rocket from what is equipped.
 */
export function HangarScreen() {
  const router = useRouter();
  const { state, emit } = useCadet();
  const { box, scene } = useScene<HangarBay>(async (s) => (await import("@/worlds/space/hangarBay")).mountHangarBay(s, {}));
  const [slot, setSlot] = useState<Slot>("hull");
  const [preview, setPreview] = useState<Partial<Record<Slot, string>>>({});
  const [flash, setFlash] = useState<string | null>(null);

  const equipped = (s: Slot) => state?.equipped[s] ?? STARTER[s];
  const shown = (s: Slot) => preview[s] ?? equipped(s);
  const style: ShipStyle | null = state ? { hull: shown("hull"), thruster: shown("thruster"), blaster: shown("blaster") } : null;
  useEffect(() => { if (scene && style) scene.setStyle(style); }, [scene, style?.hull, style?.thruster, style?.blaster]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void import("@/engine/audio").then(({ audio }) => audio.mood("hangar")); }, []);

  const buy = (s: Slot, id: string) => {
    if (!state) return;
    const e = purchase(state, s, id);
    if (!e) return;
    emit(e);
    void import("@/engine/audio").then(({ audio }) => audio.sfx(e.payload.cost ? "fanfare" : "blip_ok"));
    setPreview((p) => ({ ...p, [s]: undefined }));
    setFlash(e.payload.cost ? `Bought ${CATALOG[s].find((i) => i.id === id)?.name} · it flies in your next battle` : "Equipped");
    window.setTimeout(() => setFlash(null), 2600);
  };

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#060a16] text-white">
      <div ref={box} className="absolute inset-0" />
      {state && scene && (
        <>
          <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
            <Button aria-label="Resting Bay" onClick={() => router.push("/bay")} className={`${ghost} grid size-10 place-items-center bg-black/45 p-0 text-lg`}>⌂</Button>
            <span className={`${glass} pointer-events-none px-4 py-2 font-mono text-xs tracking-[0.25em] text-lime-200`}>THE HANGAR</span>
          </div>
          {flash && <div role="status" className="absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded-full bg-lime-300 px-5 py-1.5 font-mono text-sm font-semibold text-[#0d0e1a] shadow-lg">✓ {flash}</div>}

          <div className={`${glass} absolute bottom-2 left-1/2 z-10 w-[min(96vw,380px)] -translate-x-1/2 p-3 md:bottom-auto md:left-auto md:right-5 md:top-1/2 md:w-[360px] md:-translate-y-1/2 md:translate-x-0 md:p-4`}>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="font-mono text-[11px] tracking-[0.25em] text-white/55">SHIP UPGRADES</p>
              <p className="font-mono text-lg text-amber-200" aria-label={`${state.orbs} orbs`}>✦ {state.orbs}</p>
            </div>
            <Tabs value={slot} onValueChange={(v) => v && setSlot(v as Slot)}>
              <TabsList aria-label="Upgrade slots" className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-black/35 p-1">
                {UPGRADE_SLOTS.map((s) => (
                  <TabsTab key={s} value={s} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-white/70 outline-none data-selected:bg-lime-300 data-selected:text-[#0d0e1a] focus-visible:ring-2 focus-visible:ring-lime-300">{SLOT_NAMES[s]}</TabsTab>
                ))}
              </TabsList>
              {UPGRADE_SLOTS.map((s) => (
                <TabsPanel key={s} value={s} className="flex flex-col gap-1.5">
                  {CATALOG[s].map((item) => {
                    const price = priceFor(s, item.id, state.owned) ?? item.cost, on = equipped(s) === item.id, looking = shown(s) === item.id;
                    const afford = price <= state.orbs;
                    return (
                      <div key={item.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${looking ? "border-lime-300/70 bg-lime-300/10" : "border-white/10 bg-white/[.03]"}`}>
                        <Button aria-label={`Preview ${item.name}`} aria-pressed={looking} onClick={() => setPreview((p) => ({ ...p, [s]: item.id }))} className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-lime-300">
                          <span className="block truncate text-sm font-semibold">{item.name}</span>
                          <span className="block truncate text-[11px] text-white/55">{item.blurb}</span>
                        </Button>
                        {on ? <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 font-mono text-[11px] text-lime-200">ON</span>
                          : price === 0 ? <Button aria-label={`Equip ${item.name}`} onClick={() => buy(s, item.id)} className={`${ghost} shrink-0 px-3 py-1 text-xs`}>Equip</Button>
                            : <Button aria-label={`Buy ${item.name} for ${price} orbs`} disabled={!afford} onClick={() => buy(s, item.id)} className={`${lime} shrink-0 px-3 py-1 text-xs`}>✦ {price}</Button>}
                      </div>
                    );
                  })}
                </TabsPanel>
              ))}
            </Tabs>
            <p className="mt-3 text-center text-[11px] text-white/45">Earn Orbs by clearing waves. They are never lost.</p>
          </div>
        </>
      )}
    </div>
  );
}
