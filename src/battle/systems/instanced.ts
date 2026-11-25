import * as THREE from "three";

/**
 * A fleet of identical drones in a handful of draws: every ship keeps its own transform group (the
 * fleet view animates it as before), but nothing is drawn per ship. Each part of each style (body,
 * outline, visor, eyes, feet, antenna, pennant) is one InstancedMesh, and `sync` copies every ship's
 * transform into it once a frame. 10 × 10 full drones go from ~1,000 draws to ~45.
 */
interface Part { mesh: THREE.InstancedMesh; local: THREE.Matrix4 }
export interface InstancedShip { g: THREE.Object3D; style: string; visible: () => boolean }

export function createInstancedFleet(parent: THREE.Object3D, ships: InstancedShip[], build: (style: string) => THREE.Object3D) {
  const groups = new Map<string, { parts: Part[]; ships: InstancedShip[] }>();
  for (const s of ships) { let g = groups.get(s.style); if (!g) groups.set(s.style, (g = { parts: [], ships: [] })); g.ships.push(s); }
  for (const [style, g] of groups) {
    const template = build(style);
    template.updateMatrixWorld(true);
    template.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mesh = new THREE.InstancedMesh(m.geometry, m.material, g.ships.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.renderOrder = m.renderOrder;
      mesh.onBeforeRender = m.onBeforeRender; // the outline keeps its screen-space width
      parent.add(mesh);
      g.parts.push({ mesh, local: m.matrixWorld.clone() });
    });
  }
  const m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  return {
    /** Copy every ship's transform (relative to `parent`) into the instances; hidden ships draw nothing. */
    sync() {
      for (const g of groups.values()) {
        g.ships.forEach((s, i) => {
          const on = s.visible();
          if (on) s.g.updateMatrix();
          for (const p of g.parts) p.mesh.setMatrixAt(i, on ? m4.multiplyMatrices(s.g.matrix, p.local) : zero);
        });
        for (const p of g.parts) p.mesh.instanceMatrix.needsUpdate = true;
      }
    },
    /** Draw calls this fleet costs. */
    get draws() { let n = 0; for (const g of groups.values()) n += g.parts.length; return n; },
    dispose() { for (const g of groups.values()) for (const p of g.parts) { p.mesh.removeFromParent(); p.mesh.dispose(); } },
  };
}
export type InstancedFleet = ReturnType<typeof createInstancedFleet>;
