import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { add, type Materials } from "@/engine/materials";

/**
 * The cadet's own right hand for first-person close-ups, with a child's proportions (palm about
 * 6 cm wide, middle finger about 6 cm long). Local axes: fingers point +y, the palm faces +z,
 * the back of the hand (knuckles, nails) faces −z, and the thumb is on the +x side. Fingers sit
 * side by side and every joint overlaps its neighbour so the silhouette never shows gaps.
 */
export function makeHand(M: Materials, skinColor: number, sleeveColor: number) {
  const g = new THREE.Group(), nc = { cast: false };
  const base = new THREE.Color(skinColor);
  const skin = M.skin(skinColor), knuckle = M.skin(base.clone().lerp(new THREE.Color(0xd98b7a), 0.18).getHex());
  const nail = M.clay(base.clone().lerp(new THREE.Color(0xfff0ec), 0.55).getHex(), { roughness: 0.22 });
  const seg = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 10, 20);

  // palm: a rounded slab that narrows toward the wrist
  const palmGeo = new RoundedBoxGeometry(0.062, 0.068, 0.022, 5, 0.0095);
  const pos = palmGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), k = THREE.MathUtils.clamp((0.034 - y) / 0.068, 0, 1);
    pos.setX(i, pos.getX(i) * (1 - 0.16 * k));
    pos.setZ(i, pos.getZ(i) * (1 + 0.15 * Math.sin(Math.PI * (1 - k)))); // fuller across the middle
  }
  palmGeo.computeVertexNormals();
  add(g, palmGeo, skin, 0, 0, 0, nc);
  // the soft pads of the palm: the thumb's mound and the heel under the little finger
  add(g, new THREE.SphereGeometry(0.019, 28, 20), skin, 0.017, -0.014, 0.006, nc).scale.set(0.95, 1.25, 0.62);
  add(g, new THREE.SphereGeometry(0.016, 24, 18), skin, -0.017, -0.017, 0.005, nc).scale.set(0.9, 1.3, 0.55);

  // fingers, index (+x) to little (−x): three segments each, fanned very slightly
  const spec = [
    { x: 0.0215, len: [0.024, 0.015, 0.012], r: 0.0078, tilt: -0.05, y: 0.033 },
    { x: 0.0072, len: [0.026, 0.017, 0.013], r: 0.0081, tilt: -0.01, y: 0.035 },
    { x: -0.0075, len: [0.025, 0.016, 0.0125], r: 0.0077, tilt: 0.04, y: 0.034 },
    { x: -0.0215, len: [0.02, 0.0125, 0.011], r: 0.0068, tilt: 0.1, y: 0.029 },
  ];
  const fingers: THREE.Group[][] = [];
  for (const f of spec) {
    const root = new THREE.Group();
    root.position.set(f.x, f.y, 0.001);
    root.rotation.z = f.tilt;
    g.add(root);
    add(root, new THREE.SphereGeometry(f.r * 1.08, 18, 14), knuckle, 0, -0.002, -0.006, nc).scale.set(1, 0.85, 0.6); // knuckle on the back
    let parent: THREE.Object3D = root;
    const joints: THREE.Group[] = [];
    f.len.forEach((len, i) => {
      const j = new THREE.Group(), r = f.r * (1 - i * 0.07);
      if (i > 0) j.position.y = f.len[i - 1];
      parent.add(j);
      add(j, seg(r, len), skin, 0, len / 2, 0, nc);
      if (i > 0) add(j, new THREE.SphereGeometry(r * 0.75, 12, 10), knuckle, 0, 0, -r * 0.55, nc).scale.set(1, 0.7, 0.45); // knuckle crease
      if (i === 2) add(j, new THREE.SphereGeometry(r * 0.8, 16, 12), nail, 0, len * 0.62, -r * 0.62, nc).scale.set(0.92, 1.25, 0.32);
      joints.push(j);
      parent = j;
    });
    fingers.push(joints);
  }

  // thumb: rooted in its mound on the +x side, angled up and in toward the palm
  const thumb = new THREE.Group();
  thumb.position.set(0.026, -0.016, 0.007);
  thumb.rotation.set(0.55, -0.35, -0.62);
  g.add(thumb);
  add(thumb, seg(0.0098, 0.02), skin, 0, 0.01, 0, nc);
  const t1 = new THREE.Group();
  t1.position.y = 0.022;
  thumb.add(t1);
  add(t1, seg(0.0092, 0.014), skin, 0, 0.007, 0, nc);
  const t2 = new THREE.Group();
  t2.position.y = 0.016;
  t1.add(t2);
  add(t2, seg(0.0086, 0.011), skin, 0, 0.0055, 0, nc);
  add(t2, new THREE.SphereGeometry(0.0072, 16, 12), nail, 0, 0.009, -0.0055, nc).scale.set(0.92, 1.2, 0.32);

  // wrist, then the sleeve with a ribbed cuff, running down and out of frame
  add(g, new THREE.CylinderGeometry(0.022, 0.021, 0.05, 28), skin, 0, -0.052, 0.0, nc).scale.set(1.2, 1, 0.68);
  const sleeve = M.fabric(sleeveColor), rib = M.fabric(new THREE.Color(sleeveColor).multiplyScalar(0.82).getHex());
  add(g, new THREE.CylinderGeometry(0.036, 0.044, 0.26, 32), sleeve, 0, -0.205, -0.002, nc).scale.set(1.1, 1, 0.86);
  for (let i = 0; i < 5; i++) add(g, new THREE.TorusGeometry(0.031, 0.0042, 10, 36), rib, 0, -0.076 - i * 0.0075, -0.002, nc).rotation.x = Math.PI / 2;

  /** 0 = relaxed, slightly bent; 1 = loosely curled, as when covering a yawn. */
  const curl = (k: number) => {
    fingers.forEach((joints, i) => joints.forEach((j, n) => (j.rotation.x = 0.1 + n * 0.08 + i * 0.03 + k * (0.18 + n * 0.16 + i * 0.05))));
    t1.rotation.x = 0.15 + k * 0.2;
    t2.rotation.x = 0.2 + k * 0.25;
  };
  curl(0);
  return { group: g, curl };
}
