import * as THREE from "three";
import type { Marks } from "../systems/marks";

/** Double It!: the side to halve, 2 or 4 (never against a 5, 9 or 10 the other trick owns). */
export function doubleSide(a: number, b: number) {
  const has = (n: number) => a === n || b === n;
  return [2, 4].find((x) => has(x) && ![5, 9, 10].includes(x === a ? b : a)) ?? (has(2) ? 2 : 4);
}

/** Split & Add: cut the long side after 5, and label both parts. */
export function splitFive(marks: Marks, a: number, b: number) {
  const axis = b >= a ? "col" : "row", big = Math.max(a, b);
  const r = marks.split(axis, 5);
  if (axis === "col") { marks.tag("5", new THREE.Vector3(marks.meanX(r.first), marks.axisTop(), 0)); marks.tag(String(big - 5), new THREE.Vector3(marks.meanX(r.rest), marks.axisTop(), 0)); }
  else { marks.tag("5", new THREE.Vector3(marks.axisLeft(), marks.meanY(r.first), 0), undefined, true); marks.tag(String(big - 5), new THREE.Vector3(marks.axisLeft(), marks.meanY(r.rest), 0), undefined, true); }
  return r;
}

/** Jump One More: the facts next to a square, or a 3 / 6 seen as one squad less plus one. */
export function jumpSplit(marks: Marks, a: number, b: number) {
  const has = (n: number) => a === n || b === n;
  if (Math.abs(a - b) === 1 && Math.min(a, b) >= 6) return marks.split(a > b ? "row" : "col", Math.min(a, b));
  const k = has(3) ? 3 : 6;
  return marks.split(a === k ? "row" : "col", k - 1);
}
