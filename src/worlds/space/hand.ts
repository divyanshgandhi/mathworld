import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { COLOR } from "@/design/tokens";
import { add, type Materials } from "@/engine/materials";
import { mix } from "./cast";

/**
 * The cadet's own right hand for the first-person yawn, in the same language as the cast: matte,
 * rounded, with four chunky fingers and a thumb and no fine anatomy. Local axes: fingers point +y,
 * the palm faces +z, the back of the hand faces −z, and the thumb is on the +x side. The sleeve is
 * the cadet's own hoodie sleeve, with its cuff.
 */
export function makeHand(M: Materials, skinColor: number, sleeveColor: number) {
  const g = new THREE.Group(), nc = { cast: false };
  const skin = M.clay(skinColor, { roughness: 0.78 });
  const seg = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 8, 16);

  // palm: a rounded slab that narrows toward the wrist
  const palmGeo = new RoundedBoxGeometry(0.066, 0.068, 0.026, 5, 0.012);
  const pos = palmGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = THREE.MathUtils.clamp((0.034 - pos.getY(i)) / 0.068, 0, 1);
    pos.setX(i, pos.getX(i) * (1 - 0.14 * k));
  }
  palmGeo.computeVertexNormals();
  add(g, palmGeo, skin, 0, 0, 0, nc);

  // fingers, index (+x) to little (−x): two soft segments each, close together
  const spec = [
    { x: 0.0235, len: [0.026, 0.02], r: 0.0092, tilt: -0.05, y: 0.032 },
    { x: 0.0078, len: [0.029, 0.022], r: 0.0096, tilt: -0.01, y: 0.034 },
    { x: -0.008, len: [0.027, 0.021], r: 0.0092, tilt: 0.04, y: 0.033 },
    { x: -0.0232, len: [0.021, 0.017], r: 0.0082, tilt: 0.1, y: 0.029 },
  ];
  const fingers: THREE.Group[][] = [];
  for (const f of spec) {
    const root = new THREE.Group();
    root.position.set(f.x, f.y, 0.001);
    root.rotation.z = f.tilt;
    g.add(root);
    let parent: THREE.Object3D = root;
    const joints: THREE.Group[] = [];
    f.len.forEach((len, i) => {
      const j = new THREE.Group(), r = f.r * (1 - i * 0.06);
      if (i > 0) j.position.y = f.len[i - 1];
      parent.add(j);
      add(j, seg(r, len), skin, 0, len / 2, 0, nc);
      joints.push(j);
      parent = j;
    });
    fingers.push(joints);
  }

  // thumb: rooted on the +x side of the palm, angled up and in
  const thumb = new THREE.Group();
  thumb.position.set(0.028, -0.014, 0.008);
  thumb.rotation.set(0.5, -0.35, -0.62);
  g.add(thumb);
  add(thumb, seg(0.0112, 0.022), skin, 0, 0.011, 0, nc);
  const t1 = new THREE.Group();
  t1.position.y = 0.024;
  thumb.add(t1);
  add(t1, seg(0.0102, 0.018), skin, 0, 0.009, 0, nc);

  // wrist, then the sleeve with its cuff, running down and out of frame
  add(g, new THREE.CylinderGeometry(0.023, 0.022, 0.05, 24), skin, 0, -0.052, 0, nc).scale.set(1.2, 1, 0.72);
  add(g, new THREE.CylinderGeometry(0.038, 0.046, 0.3, 28), M.clay(sleeveColor, { roughness: 0.9 }), 0, -0.225, -0.002, nc).scale.set(1.1, 1, 0.88);
  add(g, new THREE.CylinderGeometry(0.037, 0.037, 0.032, 28), M.clay(mix(sleeveColor, COLOR.void, 0.22), { roughness: 0.9 }), 0, -0.084, -0.002, nc).scale.set(1.12, 1, 0.9);

  /** 0 = relaxed, slightly bent; 1 = loosely curled, as when covering a yawn. */
  const curl = (k: number) => {
    fingers.forEach((joints, i) => joints.forEach((j, n) => (j.rotation.x = 0.1 + n * 0.1 + i * 0.03 + k * (0.24 + n * 0.22 + i * 0.05))));
    t1.rotation.x = 0.2 + k * 0.3;
  };
  curl(0);
  return { group: g, curl };
}
