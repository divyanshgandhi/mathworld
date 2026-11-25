/** WCAG 2 contrast for the token colours (hex or rgba over an opaque ground). Used by the design tests. */
type RGB = [number, number, number];

export function parseColor(c: string): { rgb: RGB; a: number } {
  const s = c.trim();
  if (s.startsWith("#")) {
    const h = s.length === 4 ? s.slice(1).split("").map((x) => x + x).join("") : s.slice(1, 7);
    return { rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB, a: 1 };
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`not a colour: ${c}`);
  const [r, g, b, a = "1"] = m[1].split(",").map((x) => x.trim());
  return { rgb: [Number(r), Number(g), Number(b)], a: Number(a) };
}

/** `fg` composited over an opaque `bg`. */
export function over(fg: string, bg: string): RGB {
  const f = parseColor(fg), b = parseColor(bg);
  return f.rgb.map((v, i) => v * f.a + b.rgb[i] * (1 - f.a)) as RGB;
}

const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

/** Contrast ratio of text colour `fg` on an opaque ground `bg` (1 to 21). */
export function contrast(fg: string, bg: string) {
  const a = luminance(over(fg, bg)), b = luminance(parseColor(bg).rgb);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
