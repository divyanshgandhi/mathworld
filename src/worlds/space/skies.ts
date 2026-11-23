import * as THREE from "three";
import { add, canvasTexture } from "@/engine/materials";
import type { Stage } from "@/engine/stage";
import { seeded, type Rng } from "@/engine/util";
import type { PlanetId } from "@/rig/pools";
import { buildEarth } from "./earth";

/**
 * Where each battle happens: the planet hangs behind and below the fleet so the formation reads
 * against dark space. One clay sphere with a painted map per planet, plus a ring, rocks or nebula.
 */
interface Look { bands: string[]; blotch?: string; radius: number; at: [number, number, number]; ring?: [string, number, number]; tilt?: number; rocks?: boolean; nebula?: boolean; moonOf?: boolean }
const LOOKS: Record<Exclude<PlanetId, "earth">, Look> = {
  moon: { bands: ["#cfc9d6", "#bdb6c6", "#d8d2de"], blotch: "#a49dae", radius: 70, at: [0, -86, -40], moonOf: true },
  mars: { bands: ["#d0714a", "#c4643e", "#d98a5e"], blotch: "#9c4a2e", radius: 70, at: [-10, -84, -50] },
  "asteroid-belt": { bands: ["#8f7b6a", "#a08b78"], blotch: "#6e5d50", radius: 9, at: [-70, 40, -200], rocks: true },
  jupiter: { bands: ["#e8c9a0", "#c98d5a", "#f1dcc0", "#b9774a", "#e6c29a", "#d4a070"], radius: 64, at: [-240, 120, -380], tilt: 0.12 },
  saturn: { bands: ["#efdcb2", "#e2c58e", "#f4e6c4", "#d8b77c"], radius: 34, at: [-190, 95, -320], ring: ["#f3e2bf", 44, 70], tilt: 0.3 },
  uranus: { bands: ["#a8ecef", "#9be2e8", "#b6f1f2"], radius: 30, at: [-185, 92, -320], ring: ["#d6f6f8", 40, 46], tilt: 1.2 },
  "deep-space": { bands: ["#3b2f6b", "#2a2350"], radius: 12, at: [56, 22, -220], nebula: true },
};

function paint(rnd: Rng, look: Look) {
  const { texture, ctx } = canvasTexture(512, 256);
  const h = 256 / look.bands.length;
  look.bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * h, 512, h + 1); });
  for (let y = 0; y < 256; y += 3) { ctx.fillStyle = `rgba(255,255,255,${(Math.sin(y * 0.21) * 0.5 + 0.5) * 0.07})`; ctx.fillRect(0, y, 512, 2); }
  if (look.blotch) {
    ctx.fillStyle = look.blotch;
    for (let i = 0; i < 90; i++) { ctx.globalAlpha = 0.25 + rnd() * 0.4; ctx.beginPath(); ctx.arc(rnd() * 512, rnd() * 256, 2 + rnd() * 14, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  texture.needsUpdate = true;
  return texture;
}

export function mountSky(stage: Stage, planet: PlanetId, origin: THREE.Vector3) {
  const { scene, mats: M } = stage, rnd = seeded(23), root = new THREE.Group();
  scene.add(root);
  const off = { cast: false, recv: false };
  let spin: THREE.Object3D | null = null, earth: ReturnType<typeof buildEarth> | null = null;
  const rocks: { m: THREE.Mesh; v: THREE.Vector3 }[] = [];

  if (planet === "earth") {
    earth = buildEarth(scene, M, rnd, origin.clone().add(new THREE.Vector3(6, -42, -46)));
    earth.sun.intensity = 1.2;
  } else {
    const look = LOOKS[planet], at = origin.clone().add(new THREE.Vector3(...look.at));
    const map = paint(rnd, look);
    // a little self-light from its own map, so the planet always reads (well under the bloom threshold)
    const body = add(root, new THREE.SphereGeometry(look.radius, 96, 48), M.clay(0xffffff, { map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.32, roughness: 0.9 }), at.x, at.y, at.z, off);
    body.rotation.z = look.tilt ?? 0.2;
    spin = body;
    if (look.ring) {
      const [c, r0, r1] = look.ring, ring = add(body, new THREE.RingGeometry(r0, r1, 128), M.clay(new THREE.Color(c).getHex(), { side: THREE.DoubleSide, transparent: true, opacity: 0.75 }), 0, 0, 0, off);
      ring.rotation.x = Math.PI / 2 - 0.25;
    }
    if (look.moonOf) add(root, new THREE.SphereGeometry(5, 48, 24), M.clay(0x6fa7e0, { roughness: 0.8 }), origin.x + 48, origin.y + 26, origin.z - 160, off); // Earth, far behind
    if (look.rocks) {
      const rock = M.clay(0x8a7868, { roughness: 0.95 });
      for (let i = 0; i < 70; i++) {
        const m = add(root, new THREE.DodecahedronGeometry(0.6 + rnd() * 3, 0), rock, origin.x + (rnd() - 0.5) * 220, origin.y - 10 + (rnd() - 0.5) * 60, origin.z - 90 - rnd() * 160, off);
        m.scale.set(1, 0.6 + rnd() * 0.6, 0.8 + rnd() * 0.5);
        rocks.push({ m, v: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.4) });
      }
    }
    if (look.nebula) {
      for (const [c, x, y, s] of [["#6d3bd6", -60, 30, 160], ["#1f8fb0", 40, -10, 140], ["#c0397a", 10, 50, 110]] as const) {
        const { texture, ctx } = canvasTexture(128, 128), g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
        g.addColorStop(0, c); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); texture.needsUpdate = true;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.35, depthWrite: false }));
        sp.position.set(origin.x + x, origin.y + y, origin.z - 260);
        sp.scale.setScalar(s);
        root.add(sp);
      }
    }
    const sp: number[] = [];
    for (let i = 0; i < 2000; i++) { const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(900).add(origin); sp.push(v.x, v.y, v.z); }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    root.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false })));
  }

  return {
    update(dt: number) {
      earth?.update(dt);
      if (spin) spin.rotation.y += dt * 0.02;
      for (const r of rocks) { r.m.rotation.x += r.v.x * dt; r.m.rotation.y += r.v.y * dt; }
    },
    dispose() { scene.remove(root); },
  };
}
