"use client";
import { Button } from "@ui-sdk/react/button";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UPGRADE_SLOTS } from "@/db/events";
import { CATALOG, priceFor, purchase, SLOT_NAMES, STARTER, type Slot } from "@/director/hangar";
import type { HangarBay, ShipStyle } from "@/worlds/space/hangarBay";
import { ghost, glass } from "./battle/ui";
import { Icon } from "./kit/Icon";
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
    <div className="fixed inset-0 select-none overflow-hidden bg-void text-approach">
      <div ref={box} className="absolute inset-0" />
      {state && scene && (
        <>
          <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
            <Button aria-label="Resting Bay" title="Resting Bay" onClick={() => router.push("/bay")} className="mw-btn mw-icon bg-void"><Icon name="home" size={20} /></Button>
            <span className="pointer-events-none flex h-11 items-center rounded-pill bg-void px-3 type-label text-[13px] tracking-[0.1em] text-ink-2 sm:px-4 sm:text-[15px] sm:tracking-[0.18em]">Hangar</span>
          </div>
          {flash && <div role="status" className="absolute left-1/2 top-16 z-20 flex -translate-x-1/2 items-center gap-2 rounded-pill border border-gold bg-void px-5 py-1.5 type-name text-[15px] text-gold"><Icon name="check" size={18} />{flash}</div>}

          <div className={`${glass} absolute bottom-2 left-1/2 z-10 w-[min(96vw,380px)] -translate-x-1/2 p-3 md:bottom-auto md:left-auto md:right-5 md:top-1/2 md:w-[360px] md:-translate-y-1/2 md:translate-x-0 md:p-4`}>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="type-label-sm text-ink-2">Ship upgrades</p>
              <p className="flex items-center gap-2 type-name type-number text-lg" aria-label={`${state.orbs} orbs`}><Icon name="orb" size={20} className="text-gold" />{state.orbs}</p>
            </div>
            <Tabs value={slot} onValueChange={(v) => v && setSlot(v as Slot)}>
              <TabsList aria-label="Upgrade slots" className="mb-3 grid grid-cols-3 gap-1 rounded-chip border border-line-1 p-1">
                {UPGRADE_SLOTS.map((s) => (
                  <TabsTab key={s} value={s} className="min-h-11 rounded-[10px] px-1.5 type-name text-[15px] leading-tight text-ink-2 transition hover:text-approach data-selected:bg-raised data-selected:text-approach data-selected:ring-1 data-selected:ring-approach">{SLOT_NAMES[s]}</TabsTab>
                ))}
              </TabsList>
              {UPGRADE_SLOTS.map((s) => (
                <TabsPanel key={s} value={s} className="flex flex-col gap-1.5">
                  {CATALOG[s].map((item) => {
                    const price = priceFor(s, item.id, state.owned) ?? item.cost, on = equipped(s) === item.id, looking = shown(s) === item.id;
                    const afford = price <= state.orbs;
                    return (
                      <div key={item.id} className={`flex items-center gap-2 rounded-chip border px-3 py-2 transition ${looking ? "border-line-3 bg-raised" : "border-line-1"}`}>
                        <Button aria-label={`Preview ${item.name}`} aria-pressed={looking} onClick={() => setPreview((p) => ({ ...p, [s]: item.id }))} className="min-h-11 min-w-0 flex-1 rounded-[8px] text-left">
                          <span className="block truncate type-name text-[16px]">{item.name}</span>
                          <span className="block truncate text-xs text-ink-2">{item.blurb}</span>
                        </Button>
                        {on ? <span className="flex shrink-0 items-center gap-1 rounded-pill border border-line-2 px-2.5 py-1 type-label-sm text-approach"><Icon name="check" size={14} />On</span>
                          : price === 0 ? <Button aria-label={`Equip ${item.name}`} onClick={() => buy(s, item.id)} className={`${ghost} shrink-0 px-3 py-1 text-xs`}>Equip</Button>
                            : <Button aria-label={`Buy ${item.name} for ${price} orbs`} disabled={!afford} onClick={() => buy(s, item.id)} className={`${ghost} shrink-0 px-3 py-1 type-number text-[15px]`}><Icon name="orb" size={16} className={afford ? "text-gold" : ""} />{price}</Button>}
                      </div>
                    );
                  })}
                </TabsPanel>
              ))}
            </Tabs>
            <p className="mt-3 text-center text-xs text-ink-3">Earn Orbs by clearing waves. They are never lost.</p>
          </div>
        </>
      )}
    </div>
  );
}
