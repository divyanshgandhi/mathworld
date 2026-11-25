import * as THREE from "three";
import { canvasTexture } from "@/engine/materials";
import type { Box } from "../formation";
import { LOOK, sairaReady } from "../look";

/**
 * The battle's own ink in the world: plain Saira words and numbers with no pill behind them (scan
 * counts, "12 left", the number on the rocket's nose), and the hairline lock-on bracket. Both face
 * the straight-on battle camera and never glow (MeshBasic, under the bloom threshold).
 */
const PX = 128;
const plane = new THREE.PlaneGeometry(1, 1);

export interface InkText {
  mesh: THREE.Mesh;
  /** Redraw with new words (cheap: one small canvas). */
  set(text: string): void;
  /** World height of the text's cap box. */
  height(h: number): void;
  text: string;
  /** Width over height of the drawn text. */
  aspect: number;
  dispose(): void;
}

/**
 * Text in Saira. `weight` "200" with `stretch` is the display voice (the number on the nose); "500"
 * or "600" is a label. Draws at once and again when Saira has loaded, so it never stays in a fallback face.
 */
export function inkText(text: string, o: { color?: string; weight?: string; stretch?: boolean; align?: "left" | "centre" } = {}): InkText {
  const { texture, ctx } = canvasTexture(16, 16), c = ctx.canvas;
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(plane, mat);
  mesh.renderOrder = 6;
  let h = 1;
  const draw = (t: string) => {
    const font = `${o.weight ?? "600"} ${PX}px ${LOOK.holo.font}`;
    ctx.font = font;
    if (o.stretch && "fontStretch" in ctx) (ctx as CanvasRenderingContext2D & { fontStretch: string }).fontStretch = "expanded";
    const w = Math.max(8, Math.ceil(ctx.measureText(t).width + PX * 0.2)), ch = Math.ceil(PX * 1.2);
    // the GPU keeps a texture's size: a canvas that changes size needs a fresh upload
    if (c.width !== w || c.height !== ch) { c.width = w; c.height = ch; texture.dispose(); }
    else ctx.clearRect(0, 0, w, ch);
    ctx.font = font;
    if (o.stretch && "fontStretch" in ctx) (ctx as CanvasRenderingContext2D & { fontStretch: string }).fontStretch = "expanded";
    ctx.fillStyle = o.color ?? LOOK.ink.white;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(t, w / 2, c.height / 2 + PX * 0.04);
    texture.needsUpdate = true;
    ink.aspect = w / c.height;
    ink.text = t;
    mesh.scale.set(h * ink.aspect, h, 1);
  };
  const ink: InkText = {
    mesh, text, aspect: 1,
    set(t: string) { if (t !== ink.text || !mesh.userData.drawn) { mesh.userData.drawn = true; draw(t); } },
    height(nh: number) { h = nh; mesh.scale.set(h * ink.aspect, h, 1); },
    dispose() { mesh.removeFromParent(); texture.dispose(); mat.dispose(); },
  };
  ink.set(text);
  void sairaReady().then(() => draw(ink.text));
  return ink;
}

/** A lock-on bracket: four hairline corners round a box. `opacity` dims it for a soft scan. */
export function createBracket(color: number = LOOK.scan.color) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, toneMapped: false });
  const group = new THREE.Group();
  const arms = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(plane, mat); m.renderOrder = 6; group.add(m); return m; });
  group.renderOrder = 6;
  return {
    group, mat,
    /** Frame `box` (padded by `pad`), with lines `t` thick (all in the parent's units). */
    set(box: Box, t: number, pad = 0.12) {
      const hx = box.hx + pad, hy = box.hy + pad, arm = Math.min(0.42, Math.max(0.14, Math.min(hx, hy) * 0.7));
      group.position.set(box.x, box.y, 0.7);
      let i = 0;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const hz = arms[i++], vt = arms[i++];
        hz.position.set(sx * (hx - arm / 2), sy * hy, 0); hz.scale.set(arm, t, 1);
        vt.position.set(sx * hx, sy * (hy - arm / 2), 0); vt.scale.set(t, arm, 1);
      }
    },
    dispose() { group.removeFromParent(); mat.dispose(); },
  };
}
export type Bracket = ReturnType<typeof createBracket>;
