import * as THREE from "three";
import { canvasTexture, fitText } from "@/engine/materials";
import { LOOK, type Tone } from "../look";

/**
 * Holo: the one component for everything the battle writes or highlights in the world. A label is a
 * text pill that faces the straight-on battle camera; a plate is a tinted panel behind a group of
 * ships. Every label variant (axis, tag, badge) and every plate goes through here, so the battle's
 * world type and highlight style change in this one file.
 *
 * Today's look (wave 1 changes no visuals): system sans, bold, on a dark pill. The restyle switches
 * the font to Saira here, after `document.fonts.load('400 16px Saira')`.
 */
export type HoloVariant = "axis" | "tag" | "badge";

/** Height in world units (tags and badges are divided by the formation scale), depth, and behaviour. */
const VARIANTS: Record<HoloVariant, { height: number; z: number; perScale: boolean; upright: boolean; pop: boolean; ink: string }> = {
  /** "3 squads", "8 each": the fleet's axes. Positioned by the caller. */
  axis: { height: 0.5, z: 0.4, perScale: false, upright: false, pop: false, ink: LOOK.holo.ink },
  /** A Power-Up's part label ("5", "half of 10"); stays upright when the fleet turns. */
  tag: { height: 0.55, z: 0.6, perScale: true, upright: true, pop: false, ink: LOOK.ink.gold },
  /** A Show Me How value: bigger than a tag, and it pops in. */
  badge: { height: 1.1, z: 0.75, perScale: true, upright: true, pop: true, ink: LOOK.ink.gold },
};

/** The text pill itself, `height` world units tall. */
export function holoText(text: string, height: number, color: string = LOOK.holo.ink, bg: string = LOOK.holo.bg) {
  const { pxH, font, weight } = LOOK.holo, { texture, ctx } = canvasTexture(16, 16), c = ctx.canvas;
  ctx.font = `${weight} ${pxH * 0.62}px ${font}`;
  const w = Math.ceil(ctx.measureText(text).width + pxH * 0.7);
  c.width = w; c.height = pxH;
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(0, 0, w, pxH, pxH / 2); ctx.fill();
  ctx.fillStyle = color;
  fitText(ctx, text, w / 2, pxH / 2 + 2, w - pxH * 0.4, pxH * 0.62, weight, font);
  texture.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry((height * w) / pxH, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
  m.renderOrder = 5;
  m.userData.text = text; // the playfield review reads it
  return m;
}
export const holoWidth = (o: THREE.Object3D) => ((o as THREE.Mesh).geometry as THREE.PlaneGeometry).parameters.width;

export interface HoloLabelOpts {
  /** Where (in formation space); z comes from the variant. Axis labels are placed by the caller. */
  at?: THREE.Vector3;
  /** The formation scale, so tags and badges read the same size on any fleet. */
  scale?: number;
  color?: string;
  /** The label starts at `at` instead of centring on it (labels right of the fleet never overlap it). */
  right?: boolean;
  /** Stage time, for the badge pop. */
  time?: number;
}
export function holoLabel(text: string, variant: HoloVariant, o: HoloLabelOpts = {}) {
  const v = VARIANTS[variant];
  const t = holoText(text, v.perScale ? v.height / (o.scale ?? 1) : v.height, o.color ?? v.ink);
  if (o.at) t.position.copy(o.at).setZ(v.z);
  if (o.right) t.position.x += holoWidth(t) / 2;
  if (v.upright) t.userData.upright = true;
  if (v.pop) t.userData.pop = o.time ?? 0;
  return t;
}

/** A rectangle in formation space: centre and half size. */
export interface HoloRect { x: number; y: number; hx: number; hy: number }
/** A translucent plate with a bright edge behind `rects` (padded by 0.15 on every side). */
export function holoPlate(rects: HoloRect[], tone: Tone) {
  const box = new THREE.Box2();
  for (const r of rects) { box.expandByPoint(new THREE.Vector2(r.x - r.hx, r.y - r.hy)); box.expandByPoint(new THREE.Vector2(r.x + r.hx, r.y + r.hy)); }
  const size = box.getSize(new THREE.Vector2()).addScalar(0.3), c = box.getCenter(new THREE.Vector2());
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), new THREE.MeshBasicMaterial({ color: LOOK.tone[tone], transparent: true, opacity: LOOK.plate.opacity, depthWrite: false }));
  m.position.set(c.x, c.y, -0.55);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: LOOK.tone[tone], transparent: true, opacity: LOOK.plate.edge }));
  m.add(edge);
  return m;
}
