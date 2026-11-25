import * as THREE from "three";
import { LOOK } from "./look";
import { fmt, type FleetView } from "./systems/fleetView";
import type { Marks } from "./systems/marks";

/**
 * Sector-Lock (SPEC §3): on a multi-digit × multi-digit fleet, crack each Battle Sector's sub-product;
 * the sum is the plasma lock. The cadet picks a sector, types its value, and it locks gold.
 */
export function createSectorLock(fv: FleetView, marks: Marks, hooks: { say: (id: string) => void; cue: (sfx: "blip_ok" | "blip_close") => void }) {
  let on = false, locked = new Map<number, number>(), active: number | null = null, plate: THREE.Object3D | null = null;
  const highlight = () => {
    if (plate) fv.visuals.remove(plate);
    plate = active === null ? null : marks.plate(fv.views.filter((v) => v.ship.sector === active), "lime");
    if (plate) ((plate as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = LOOK.plate.active;
  };
  const sl = {
    get on() { return on; },
    /** The HUD's sector chips and, once every sector is locked, the total. */
    ui() {
      const f = fv.fleet;
      if (!f || !on) return { sectors: null, lockTotal: null };
      const all = f.sectors.every((s) => locked.has(s.i));
      return {
        sectors: f.sectors.map((s) => ({ i: s.i, label: `${fmt(s.rowPart)} × ${fmt(s.colPart)}`, value: locked.get(s.i) ?? null, active: active === s.i })),
        lockTotal: all ? [...locked.values()].reduce((x, y) => x + y, 0) : null,
      };
    },
    enter() {
      on = true;
      locked = new Map();
      active = fv.fleet?.sectors[0]?.i ?? null;
      highlight();
    },
    /** Off (a new wave, another trick or a lesson replaced it); its plates are already gone with the marks. */
    reset() { on = false; locked = new Map(); active = null; plate = null; },
    select(i: number) {
      if (!on || locked.has(i)) return false;
      active = i;
      highlight();
      return true;
    },
    /** Try `value` for the active sector. */
    lock(value: number) {
      const f = fv.fleet;
      if (!f || active === null) return false;
      const s = f.sectors[active];
      if (value !== s.value) { hooks.say("nova_sector_no"); hooks.cue("blip_close"); return false; }
      hooks.cue("blip_ok");
      locked.set(s.i, value);
      const vs = fv.views.filter((v) => v.ship.sector === s.i);
      marks.plate(vs, "gold");
      marks.tag(fmt(value), new THREE.Vector3(marks.meanX(vs), marks.meanY(vs), 0), LOOK.ink.gold);
      const next = f.sectors.find((x) => !locked.has(x.i));
      active = next?.i ?? null;
      highlight();
      hooks.say(next ? "nova_sector_ok" : "nova_all_locked");
      return true;
    },
  };
  return sl;
}
export type SectorLock = ReturnType<typeof createSectorLock>;
