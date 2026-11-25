import { COLOR } from "@/design/tokens";

/**
 * The texture set of every body in Math World, painted procedurally and deterministically (pure: no DOM,
 * no three.js, so it is testable and could move to a worker). Each map is equirectangular: row 0 is the
 * south pole, column 0 is longitude -180 degrees. Noise is sampled on the unit sphere, so maps tile
 * seamlessly and the poles never pinch.
 *
 * The colours below are each body's natural albedo (what the surface is made of, before any light).
 * They are art data for the planet factory only; the light that falls on them comes from the look
 * (src/worlds/looks.ts) and the UI never uses them.
 */
export type MapBodyId = "sun" | "mercury" | "venus" | "earth" | "moon" | "mars" | "rock" | "jupiter" | "saturn" | "uranus" | "neptune" | "deep-space";

export interface BodyMaps {
  w: number;
  h: number;
  /** RGBA, sRGB. */
  albedo: Uint8ClampedArray;
  /** One channel, 0..255, for a bump map (rocky bodies only). */
  height?: Uint8ClampedArray;
  /** RGBA, sRGB, white with alpha: Earth's separate cloud layer. */
  clouds?: Uint8ClampedArray;
}

type RGB = [number, number, number];
const rgb = (hexStr: string): RGB => { const n = parseInt(hexStr.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Body albedo, sampled from each body. */
const ALBEDO = {
  mercury: { base: rgb("#8c847c"), dark: rgb("#5f5953"), light: rgb("#b5aea6") },
  venus: { a: rgb("#ead6a8"), b: rgb("#d4b27a"), c: rgb("#f3e6c6"), d: rgb("#c09a62") },
  earth: {
    deep: rgb("#0e2f63"), ocean: rgb("#1d4f8f"), shallow: rgb("#3a7fb8"),
    forest: rgb("#2f5a32"), green: rgb("#5d8a45"), savanna: rgb("#9a9a5a"), desert: rgb("#cfae76"), dune: rgb("#e0c391"),
    rock: rgb("#7a6a58"), tundra: rgb("#7f8676"), ice: rgb("#eef3f7"),
  },
  moon: { high: rgb("#bab8b3"), mid: rgb("#9c9a95"), mare: rgb("#67645f"), fresh: rgb("#dedad2") },
  mars: { base: rgb("#c0663d"), dark: rgb("#6f3a25"), light: rgb("#dc9466"), cap: rgb("#f1ebe3") },
  rock: { base: rgb("#8a7a6a"), dark: rgb("#5a4e44"), light: rgb("#a8998a") },
  jupiter: { zone: rgb("#efe3cd"), belt: rgb("#b9835a"), deep: rgb("#94603f"), cream: rgb("#dcc19b"), spot: rgb("#c0603a"), pole: rgb("#9c8a78") },
  saturn: { a: rgb("#ecdcb3"), b: rgb("#d7bd88"), c: rgb("#c4a46d"), pole: rgb("#b7a789") },
  uranus: { a: rgb("#b4e2e6"), b: rgb("#9fd3db"), c: rgb("#c6ecee") },
  neptune: { a: rgb("#3f6fd0"), b: rgb("#2f56b0"), c: rgb("#6f9be8"), spot: rgb("#1f3a80") },
  sun: { hot: rgb("#fff1c4"), base: rgb(COLOR.gold), lane: rgb("#f08a2c"), spot: rgb("#6a2a10") },
  deepSpace: { base: rgb(COLOR.shadow), mid: rgb(COLOR.disk), ice: rgb(COLOR.sky), white: rgb(COLOR.approach) },
} as const;

/* ---------- noise: seeded 3D gradient noise and fBm ---------- */

function permutation(seed: number) {
  const p = new Uint8Array(512), base = new Uint8Array(256);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); const t = base[i]; base[i] = base[j]; base[j] = t; }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  return p;
}
const G = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];

export function makeNoise(seed: number) {
  const p = permutation(seed);
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h: number, x: number, y: number, z: number) => { const g = (h % 12) * 3; return G[g] * x + G[g + 1] * y + G[g + 2] * z; };
  /** Gradient noise in about -1..1. */
  const noise = (x: number, y: number, z: number) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    x -= X; y -= Y; z -= Z;
    const xi = X & 255, yi = Y & 255, zi = Z & 255;
    const u = fade(x), v = fade(y), w = fade(z);
    const a = p[xi] + yi, aa = p[a] + zi, ab = p[a + 1] + zi, b = p[xi + 1] + yi, ba = p[b] + zi, bb = p[b + 1] + zi;
    const l = (t: number, a0: number, a1: number) => a0 + t * (a1 - a0);
    return l(w,
      l(v, l(u, grad(p[aa], x, y, z), grad(p[ba], x - 1, y, z)), l(u, grad(p[ab], x, y - 1, z), grad(p[bb], x - 1, y - 1, z))),
      l(v, l(u, grad(p[aa + 1], x, y, z - 1), grad(p[ba + 1], x - 1, y, z - 1)), l(u, grad(p[ab + 1], x, y - 1, z - 1), grad(p[bb + 1], x - 1, y - 1, z - 1))),
    );
  };
  /** Fractal sum, normalised to about -1..1. */
  const fbm = (x: number, y: number, z: number, oct: number, lac = 2.03, gain = 0.5) => {
    let sum = 0, amp = 1, norm = 0;
    for (let i = 0; i < oct; i++) { sum += amp * noise(x, y, z); norm += amp; amp *= gain; x *= lac; y *= lac; z *= lac; }
    return sum / norm;
  };
  return { noise, fbm };
}

/* ---------- the sphere walk: one callback per pixel with its direction ---------- */

type Pixel = (lat: number, lon: number, x: number, y: number, z: number, i: number) => void;
function eachPixel(w: number, h: number, fn: Pixel) {
  const cosLon = new Float32Array(w), sinLon = new Float32Array(w), lons = new Float32Array(w);
  for (let i = 0; i < w; i++) { const lon = ((i + 0.5) / w) * Math.PI * 2 - Math.PI; lons[i] = lon; cosLon[i] = Math.cos(lon); sinLon[i] = Math.sin(lon); }
  for (let j = 0; j < h; j++) {
    const lat = ((j + 0.5) / h) * Math.PI - Math.PI / 2, cl = Math.cos(lat), sl = Math.sin(lat), row = j * w;
    // the same frame as three's SphereGeometry with u = 0.5 at +x: lon 0 faces +x, lon -90 faces +z
    for (let i = 0; i < w; i++) fn(lat, lons[i], cl * cosLon[i], sl, -cl * sinLon[i], row + i);
  }
}

const put = (out: Uint8ClampedArray, i: number, c: RGB, a = 255) => { const k = i * 4; out[k] = c[0]; out[k + 1] = c[1]; out[k + 2] = c[2]; out[k + 3] = a; };

/* ---------- craters: stamped into a height field and an albedo shade ---------- */

interface Crater { lat: number; lon: number; r: number; depth: number; fresh: number }
function craters(n: number, seed: number, minR: number, maxR: number): Crater[] {
  let s = seed >>> 0 || 7;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const out: Crater[] = [];
  for (let k = 0; k < n; k++) {
    const u = rnd() * 2 - 1, lon = rnd() * Math.PI * 2 - Math.PI, lat = Math.asin(u);
    // a power law: many small craters, a few big ones
    const r = minR * Math.pow(maxR / minR, Math.pow(rnd(), 2.6));
    out.push({ lat, lon, r, depth: 0.6 + rnd() * 0.5, fresh: rnd() < 0.12 ? 1 : 0 });
  }
  return out;
}

/** Adds crater relief to `height` (float, about -1..1) and a shade to `shade` (-1 dark floor .. +1 bright rim/rays). */
function stampCraters(list: Crater[], w: number, h: number, height: Float32Array, shade: Float32Array) {
  for (const c of list) {
    const reach = c.r * 1.6, j0 = Math.max(0, Math.floor(((c.lat - reach + Math.PI / 2) / Math.PI) * h)), j1 = Math.min(h - 1, Math.ceil(((c.lat + reach + Math.PI / 2) / Math.PI) * h));
    const cx = Math.cos(c.lat) * Math.cos(c.lon), cy = Math.sin(c.lat), cz = -Math.cos(c.lat) * Math.sin(c.lon);
    for (let j = j0; j <= j1; j++) {
      const lat = ((j + 0.5) / h) * Math.PI - Math.PI / 2, cl = Math.cos(lat);
      const dLon = cl > 0.02 ? Math.min(Math.PI, reach / cl) : Math.PI;
      const i0 = Math.floor(((c.lon - dLon + Math.PI) / (Math.PI * 2)) * w), i1 = Math.ceil(((c.lon + dLon + Math.PI) / (Math.PI * 2)) * w);
      for (let ii = i0; ii <= i1; ii++) {
        const i = ((ii % w) + w) % w, lon = ((i + 0.5) / w) * Math.PI * 2 - Math.PI;
        const x = cl * Math.cos(lon), y = Math.sin(lat), z = -cl * Math.sin(lon);
        const d = Math.acos(Math.max(-1, Math.min(1, x * cx + y * cy + z * cz))) / c.r;
        if (d > 1.6) continue;
        const k = j * w + i;
        // bowl, raised rim, soft ejecta skirt
        const bowl = d < 1 ? (d * d - 1) * c.depth : 0;
        const rim = Math.exp(-((d - 1) * (d - 1)) / 0.02) * 0.35 * c.depth;
        const skirt = d > 1 ? Math.exp(-(d - 1) * 4) * 0.08 : 0;
        height[k] += (bowl + rim + skirt) * Math.min(1, c.r * 40);
        shade[k] += (d < 0.85 ? -0.14 : 0) + rim * 0.6 + c.fresh * Math.max(0, 1 - Math.abs(d - 1.15) * 2) * 0.55;
      }
    }
  }
}

function heightBytes(height: Float32Array) {
  let lo = Infinity, hi = -Infinity;
  for (const v of height) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const out = new Uint8ClampedArray(height.length), k = 255 / (hi - lo || 1);
  for (let i = 0; i < height.length; i++) out[i] = (height[i] - lo) * k;
  return out;
}

/* ---------- Earth's land: real continents, rasterised from coarse outlines, then given fractal coasts ---------- */

/** Continents as [longitude, latitude] outlines (coarse, hand-placed); the coastline detail is noise. */
const LAND: [number, number][][] = [
  // North America
  [[-166, 66], [-160, 71], [-140, 70], [-125, 70], [-110, 73], [-95, 72], [-88, 68], [-82, 66], [-90, 63], [-94, 59], [-88, 56], [-82, 53], [-79, 57], [-77, 62], [-70, 61], [-64, 60], [-60, 55], [-56, 52], [-60, 47], [-66, 45], [-70, 42], [-74, 40], [-76, 35], [-81, 31], [-80, 26], [-81, 25], [-83, 29], [-86, 30], [-90, 29], [-95, 29], [-97, 26], [-97, 22], [-94, 18.5], [-91, 19], [-90, 21], [-87, 21.5], [-88, 16], [-84, 15], [-83, 10], [-79, 9], [-77, 8], [-80, 7.5], [-83, 8], [-86, 11], [-88, 13], [-92, 14.5], [-96, 15.7], [-100, 17], [-105, 19.5], [-106, 23], [-110, 24], [-112, 28], [-114.5, 31], [-113, 29], [-110, 23], [-114, 27], [-117, 32], [-120, 34.5], [-122, 37], [-124, 40], [-124, 46], [-123, 49], [-127, 51], [-131, 55], [-136, 58], [-142, 60], [-148, 60.5], [-153, 59], [-156, 57], [-162, 55], [-158, 58], [-162, 59], [-166, 61], [-165, 64]],
  // Greenland
  [[-73, 78], [-62, 82], [-35, 83.5], [-20, 82], [-18, 77], [-20, 72], [-24, 69], [-32, 68], [-40, 65], [-43, 60], [-48, 61], [-51, 64], [-54, 67], [-55, 71], [-60, 76], [-68, 77]],
  // Iceland
  [[-24, 65], [-22, 66.5], [-15, 66.5], [-13.5, 65], [-18, 63.4]],
  // South America
  [[-80, 9], [-77, 8.5], [-75, 11], [-72, 12], [-68, 11], [-62, 10.5], [-58, 7], [-54, 5.5], [-51, 4], [-50, 0], [-48, -1], [-44, -2.5], [-39, -4], [-35, -6], [-35, -9], [-37, -12], [-39, -16], [-40, -21], [-43, -23], [-48, -26], [-49, -29], [-53, -34], [-57, -36], [-58, -38.5], [-62, -39], [-65, -42], [-65, -46], [-68, -50], [-69, -53], [-71, -55], [-74, -53], [-75, -48], [-74, -43], [-73.5, -37], [-71.5, -30], [-70.5, -23], [-70.5, -18], [-76, -14], [-78, -10], [-81, -6], [-80.5, -2.5], [-80, 1], [-78.5, 3], [-77.5, 6]],
  // Africa
  [[-17, 21], [-16.5, 15], [-17, 12.5], [-13.5, 9], [-11, 6.5], [-7.5, 4.5], [-3, 5], [2, 6.2], [6, 4.4], [9, 4], [9.5, 1], [10, -2], [12, -5], [13, -9], [12.5, -13], [11.8, -17], [14, -22], [15, -27], [17, -30], [18.4, -34], [20, -34.8], [25, -34], [28, -32.6], [31, -29], [32.5, -27], [33, -25.5], [35.5, -24], [35, -20], [37, -17.5], [40.5, -15], [40.5, -10.5], [39.3, -6], [40, -3], [42, -0.5], [44, 2], [47.5, 5], [50, 8.5], [51.3, 11.8], [48, 11.3], [44, 10.5], [43.2, 12.6], [42, 15], [39.5, 18], [37.5, 21], [36.5, 24], [34.5, 27], [32.5, 30], [32, 31.2], [29, 30.9], [25, 31.6], [20, 30.5], [19.5, 32], [15.5, 31.5], [11.5, 33], [10.5, 36.5], [8, 37], [3, 36.8], [-1, 35.5], [-5.5, 35.8], [-9, 32.5], [-9.8, 29.5], [-13, 27.5], [-15, 24.5]],
  // Madagascar
  [[44, -25], [47, -25.2], [49.5, -17], [50.4, -15], [49.3, -12], [46.5, -15.5], [44, -17], [43.3, -22]],
  // Eurasia (with Arabia, India and South-East Asia)
  [[-9.3, 37], [-9, 43], [-1.8, 43.4], [-1.2, 46], [-4.5, 47.8], [-1.5, 49.5], [1.5, 50.5], [4, 51.5], [5, 53.2], [8.5, 53.7], [8.3, 57], [10.5, 57.7], [10.8, 56], [12.5, 55.5], [10.5, 54.3], [14, 54], [18.5, 54.7], [21, 55.5], [21, 57.5], [24, 58.5], [28, 59.5], [24, 60], [21.5, 61.5], [21.5, 63.5], [25, 65.5], [22, 65.8], [17, 61], [18.5, 59.5], [16.5, 56.5], [12.7, 56], [11, 58.8], [8, 58], [5, 59], [5, 62], [10, 64], [13, 67.5], [17, 69.5], [22, 70.5], [28, 71], [33, 69.5], [41, 67.5], [44, 68.5], [54, 68.5], [60, 69.8], [68, 69], [72, 72.5], [80, 73.5], [87, 75], [100, 77.5], [106, 77], [113, 74], [122, 73], [130, 71], [140, 72.5], [150, 71.5], [160, 69.8], [170, 70], [180, 68.8], [180, 65], [178, 64.5], [175, 62], [170, 60], [164, 59.8], [163, 57], [162, 54.5], [156.5, 51], [155.5, 55], [156, 57.5], [152, 59], [146, 59.3], [142, 59], [137, 54.2], [140.5, 52], [141, 48.5], [138, 46], [135, 43.3], [132, 43], [129.5, 41], [129.5, 36], [126.5, 34.5], [126.4, 37.5], [124.6, 39.7], [122, 40.5], [121.5, 39], [119, 37.2], [122.5, 36.9], [120.5, 34], [122, 31], [121.5, 28], [119, 25], [116, 22.7], [113.5, 22.2], [110.5, 20.3], [109, 21.6], [106.5, 20], [105.8, 18.5], [108.8, 15.5], [109.3, 12], [107, 10.4], [105, 8.7], [104.8, 10.5], [102.5, 12], [100.5, 13.5], [99.2, 10], [100.3, 6.5], [103.4, 4], [104.2, 1.4], [101.3, 2.8], [98.7, 7.9], [98.3, 12], [97.7, 16.5], [94.3, 16], [94.2, 19], [92.3, 20.7], [90.5, 22], [86.8, 21.4], [86, 20], [82.3, 16.6], [80.2, 13.5], [80, 10.3], [77.5, 8], [76.3, 9.5], [74.8, 12.8], [73, 17.5], [72.8, 21], [70.5, 20.8], [68.6, 23.5], [66.5, 25.4], [61.5, 25.2], [57.3, 25.8], [56.4, 27], [52, 27.8], [50.6, 29.5], [48, 30], [48.5, 28.5], [50.2, 26], [51.5, 24.3], [54, 24.1], [56.2, 26], [56.4, 24], [59.8, 22.4], [57.8, 19], [55, 17], [52, 16], [48.7, 14], [45, 12.8], [43.5, 12.7], [42.8, 15.5], [41.2, 18.8], [39, 22], [37.5, 25], [35, 28.3], [34.5, 29.5], [34, 31.2], [35.5, 33.8], [36, 36.6], [32.5, 36.2], [29, 36.6], [27, 38], [26.3, 40], [29, 41.2], [31.5, 41.2], [35, 42], [38.5, 41], [41.5, 41.5], [39.5, 44], [37.5, 44.7], [36.5, 45.3], [34.5, 46], [31.5, 46.6], [30, 45.5], [29, 44.5], [28, 43], [27.5, 41.5], [26, 40.8], [23, 40.3], [24, 38], [22.5, 36.5], [21, 38.3], [19.5, 41.5], [19, 42.5], [16, 43.5], [13.5, 45.6], [12.3, 44.7], [14, 42.5], [16.2, 41.3], [18.5, 40.2], [16.5, 39], [15.6, 38], [16, 40], [15, 40.2], [12.5, 41.8], [10.5, 43], [8.7, 44.4], [6.5, 43.1], [4, 43.5], [3.1, 42], [3.2, 41.8], [0.8, 40.8], [-0.3, 39.5], [0.2, 38.7], [-0.7, 37.6], [-2.1, 36.7], [-5.6, 36], [-6.5, 36.9], [-7.5, 37.2]],
  // Britain and Ireland
  [[-5.7, 50], [1.4, 51.2], [1.7, 52.7], [0.2, 53.5], [-1.6, 55.5], [-2, 57.6], [-3.3, 58.6], [-5, 58.6], [-5.8, 57.5], [-5.5, 55.8], [-4.8, 54.8], [-3, 54], [-4.5, 53.3], [-4.2, 52.2], [-5.2, 51.7], [-3.4, 51.4]],
  [[-10.3, 51.8], [-6, 52.2], [-5.5, 54.5], [-7.3, 55.3], [-10, 54.2], [-9.5, 53]],
  // Japan
  [[130.2, 31.3], [131.5, 33.8], [133.5, 33.6], [135.2, 34], [136.8, 34.4], [139, 34.7], [140.8, 35.7], [141.1, 38.2], [142, 39.6], [141.4, 41.4], [140.2, 41.6], [141.5, 43.3], [143.3, 42], [145.5, 43.3], [144.3, 44], [141.9, 45.5], [141.4, 43.3], [139.9, 40.6], [139.8, 38.2], [137.4, 36.8], [136.5, 37.2], [135.8, 35.6], [133, 35.5], [130.8, 34.2], [129.6, 33.2]],
  // Sumatra, Java, Borneo, Sulawesi, New Guinea, the Philippines
  [[95.3, 5.6], [98, 4.2], [100.5, 1], [103.8, -1.5], [106, -3.5], [105.8, -5.8], [104.5, -5.8], [102.3, -4], [100.4, -1.5], [98.7, 1.7], [97, 3.4]],
  [[105.5, -6.8], [108.5, -6.6], [111, -6.5], [114.5, -7.7], [114.4, -8.7], [111, -8.3], [108, -7.8], [105.3, -7]],
  [[109.2, 1.6], [110.2, -1.7], [111.8, -3.3], [114.6, -3.9], [116.2, -3.6], [116.5, -1.4], [117.9, 0.9], [118.9, 1.6], [119, 4.9], [117.2, 7], [115.5, 5.2], [113.8, 4.2], [111.2, 2.3]],
  [[119.5, -5.5], [120.4, -2.5], [121, 1.3], [124.8, 1.5], [121.8, 0.5], [121.3, -2], [122.5, -4.5], [121, -3]],
  [[131, -1.3], [135, -3.3], [138, -1.7], [141, -2.6], [145.7, -4.9], [147.5, -6.8], [150.6, -10.5], [147, -10.1], [144, -7.8], [141.2, -9.2], [138.5, -8.3], [137.8, -5.3], [133.4, -4.1], [132, -2.8]],
  [[120.6, 18.5], [122.2, 18.4], [122, 16.6], [121.6, 15.6], [124, 13.8], [126, 9.3], [125.5, 6.3], [122, 7], [123.5, 10.5], [120.6, 14.4], [120, 16.3]],
  // Sri Lanka, Taiwan, Cuba, Hispaniola
  [[79.8, 9.6], [81.8, 7.5], [81.3, 6.2], [80, 6.2]],
  [[120.7, 22.3], [121.9, 25], [121.2, 24.9], [120.1, 23]],
  [[-85, 21.9], [-82, 23.1], [-77.5, 22.2], [-74.2, 20.2], [-77.6, 19.9], [-82, 21.6]],
  [[-74.5, 19.8], [-70, 19.8], [-68.4, 18.6], [-71.4, 17.6], [-74.4, 18.4]],
  // Australia, Tasmania, New Zealand
  [[113.5, -22], [113.6, -26.5], [115, -30], [115, -34.3], [118, -35], [121.5, -33.9], [124, -33], [126.5, -32.3], [131, -31.5], [134.2, -32.8], [135.8, -34.9], [137.8, -33], [138, -35.6], [139.6, -37.2], [140.5, -38], [143.5, -38.8], [146.3, -39], [148, -37.8], [150, -37.3], [150.8, -34.5], [152.5, -32.2], [153.6, -28.5], [153.1, -25.5], [151, -23.4], [149.3, -21.2], [146.3, -19], [145.4, -16], [145.3, -14.8], [143.5, -14], [142.5, -10.7], [141.6, -12.8], [141.5, -16.8], [140.5, -17.7], [139.2, -17.3], [135.8, -15], [136.9, -12.3], [134.5, -11.9], [132.6, -11.4], [131, -12.2], [129.5, -14.8], [128, -15], [126.5, -13.8], [124.8, -15.6], [122.2, -17.5], [121.5, -19.3], [118.5, -20.3], [116.7, -20.6], [114.6, -21.7]],
  [[144.7, -40.6], [148.3, -40.9], [148, -43.2], [146.5, -43.6], [145.2, -42.3]],
  [[172.7, -34.4], [174.5, -36.2], [176, -37.6], [178.5, -37.7], [177.9, -39.2], [176.8, -39.6], [175.2, -41.6], [174.6, -41.2], [174.8, -39.9], [173.8, -39.2], [174.5, -38.1], [174.2, -36.3]],
  [[172.6, -40.5], [174.2, -41.3], [173.9, -42.4], [172.8, -43.6], [171.2, -44.5], [169.3, -46.6], [166.5, -46], [167, -45], [168.3, -44], [170.8, -42.8], [171.8, -41.3]],
  // the Antarctic Peninsula (the rest of Antarctica is the polar cap)
  [[-57, -63.2], [-60, -64], [-62.5, -65.5], [-64.5, -68], [-67, -71], [-71, -73.5], [-76, -73], [-68, -68], [-63, -64.5]],
];

/** Scanline-fills every outline into a coarse 0/1 mask, then blurs it into a smooth "how far inland" field. */
function landField(mw: number, mh: number) {
  const mask = new Float32Array(mw * mh);
  for (const poly of LAND) {
    for (let j = 0; j < mh; j++) {
      const lat = 90 - ((j + 0.5) / mh) * 180, xs: number[] = [];
      for (let k = 0; k < poly.length; k++) {
        const [x0, y0] = poly[k], [x1, y1] = poly[(k + 1) % poly.length];
        if ((y0 <= lat && y1 > lat) || (y1 <= lat && y0 > lat)) xs.push(x0 + ((lat - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.round(((xs[k] + 180) / 360) * mw), i1 = Math.round(((xs[k + 1] + 180) / 360) * mw);
        for (let i = Math.max(0, i0); i < Math.min(mw, i1); i++) mask[j * mw + i] = 1;
      }
    }
  }
  // Antarctica: a cap below about 70 degrees south, frayed by noise later
  for (let j = 0; j < mh; j++) { const lat = 90 - ((j + 0.5) / mh) * 180; if (lat < -69) for (let i = 0; i < mw; i++) mask[j * mw + i] = 1; }
  // three box blurs approximate a Gaussian: the field rises smoothly from the coast inland
  const tmp = new Float32Array(mask.length), r = Math.max(1, Math.round(mw / 340));
  for (let pass = 0; pass < 3; pass++) {
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) { let s = 0; for (let d = -r; d <= r; d++) s += mask[j * mw + (((i + d) % mw) + mw) % mw]; tmp[j * mw + i] = s / (2 * r + 1); }
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) { let s = 0; for (let d = -r; d <= r; d++) s += tmp[Math.min(mh - 1, Math.max(0, j + d)) * mw + i]; mask[j * mw + i] = s / (2 * r + 1); }
  }
  return (lat: number, lon: number) => {
    // bilinear sample; the mask's row 0 is the north
    const fx = ((lon / (Math.PI * 2) + 0.5) * mw - 0.5 + mw) % mw, fy = Math.min(mh - 1.001, Math.max(0, (0.5 - lat / Math.PI) * mh - 0.5));
    const i0 = Math.floor(fx), j0 = Math.floor(fy), i1 = (i0 + 1) % mw, tx = fx - i0, ty = fy - j0;
    const a = mask[j0 * mw + i0], b = mask[j0 * mw + i1], c = mask[(j0 + 1) * mw + i0], d = mask[(j0 + 1) * mw + i1];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };
}

/* ---------- the painters ---------- */

function paintEarth(w: number, h: number): BodyMaps {
  const albedo = new Uint8ClampedArray(w * h * 4), clouds = new Uint8ClampedArray(w * h * 4);
  const { fbm, noise } = makeNoise(11), C = ALBEDO.earth;
  const land = landField(Math.min(1024, w / 2), Math.min(512, h / 2));
  // clouds are soft: paint them at half resolution and repeat each texel
  eachPixel(w, h, (lat, lon, x, y, z, i) => {
    const coast = fbm(x * 6 + 3, y * 6, z * 6, 5) * 0.32 + noise(x * 40, y * 40, z * 40) * 0.05;
    const f = land(lat, lon) + coast * 0.55, alat = Math.abs(lat) * 57.3;
    let c: RGB;
    if (f < 0.5) {
      // a narrow shelf of shallow water along the coasts, then the open ocean deepening away from land
      const shelf = smooth(0.42, 0.5, f) * 0.7, depth = smooth(0.42, 0.05, f);
      c = mixc(C.ocean, C.deep, depth * 0.85);
      c = mixc(c, C.shallow, shelf);
    } else {
      const inland = smooth(0.5, 1.1, f), moist = fbm(x * 3 - 7, y * 3, z * 3, 4) * 0.5 + 0.5;
      // dry belts near 25 degrees and deep inland; wet near the equator
      const dry = clamp01(smooth(12, 24, alat) * smooth(38, 28, alat) * (0.55 + inland * 0.9) - (moist - 0.5) * 0.9);
      const wet = smooth(22, 4, alat) * 0.7 + moist * 0.4;
      c = mixc(C.green, C.forest, clamp01(wet));
      c = mixc(c, C.savanna, clamp01(dry * 1.6) * 0.8);
      c = mixc(c, C.desert, smooth(0.35, 0.75, dry));
      c = mixc(c, C.dune, smooth(0.7, 0.95, dry) * 0.6);
      const ridge = 1 - Math.abs(fbm(x * 9 + 1, y * 9, z * 9, 4));
      c = mixc(c, C.rock, smooth(0.78, 0.95, ridge) * inland * 0.55);
      c = mixc(c, C.tundra, smooth(52, 62, alat) * 0.75);
      const grain = noise(x * 90, y * 90, z * 90) * 0.06;
      c = [c[0] * (1 + grain), c[1] * (1 + grain), c[2] * (1 + grain)];
    }
    // ice: the polar caps, Greenland's sheet, and Antarctica
    const ice = smooth(0.0, 0.25, (alat - (lat > 0 ? 74 : 66) + fbm(x * 5, y * 5 + 9, z * 5, 4) * 9) / 8) + (f > 0.5 && lat > 0.95 ? smooth(0.55, 0.8, f) : 0);
    c = mixc(c, C.ice, clamp01(ice));
    put(albedo, i, c);

    // clouds: warped fbm, banded by latitude (the tropics' storm belt, clear subtropics, stormy mid-latitudes)
    const wx = fbm(x * 2.5 + 5, y * 2.5, z * 2.5, 3) * 0.45, wy = fbm(x * 2.5, y * 2.5 + 5, z * 2.5, 3) * 0.45;
    const n = fbm(x * 5 + wx, y * 8 + wy, z * 5 + wx, 6) * 0.5 + 0.5;
    const belt = 0.5 + smooth(14, 0, alat) * 0.12 - smooth(12, 26, alat) * smooth(36, 26, alat) * 0.12 + smooth(38, 58, alat) * 0.1;
    const a = smooth(1.0 - belt, 1.2 - belt, n);
    const k = i * 4;
    clouds[k] = 255; clouds[k + 1] = 255; clouds[k + 2] = 255; clouds[k + 3] = a * 235;
  });
  return { w, h, albedo, clouds };
}

function paintRocky(w: number, h: number, kind: "moon" | "mercury" | "mars" | "rock"): BodyMaps {
  const seed = { moon: 5, mercury: 9, mars: 17, rock: 23 }[kind];
  const { fbm, noise } = makeNoise(seed);
  const height = new Float32Array(w * h), shade = new Float32Array(w * h), base = new Float32Array(w * h);
  eachPixel(w, h, (_lat, _lon, x, y, z, i) => { const n = fbm(x * 4, y * 4, z * 4, 6); height[i] = n * 0.35; base[i] = n; });
  const count = { moon: 1400, mercury: 1800, mars: 300, rock: 500 }[kind] * Math.min(1, (w / 1024) ** 1.2 + 0.25);
  stampCraters(craters(Math.round(count), seed * 31, 0.004, kind === "mars" ? 0.06 : 0.085), w, h, height, shade);
  const albedo = new Uint8ClampedArray(w * h * 4);
  // the Moon's dark seas (maria), placed where they really are on the near side
  const MARIA: [number, number, number][] = [[-16, 33, 19], [17, 28, 11], [31, 8, 14], [59, 17, 8], [51, -8, 10], [-15, -18, 13], [-50, 12, 24], [-58, 32, 14], [-39, -24, 7], [0, 55, 7], [22, 56, 7], [35, -15, 8], [-2, 10, 8], [-30, 0, 14]];
  eachPixel(w, h, (lat, lon, x, y, z, i) => {
    const n = base[i] * 0.5 + 0.5, g = noise(x * 70, y * 70, z * 70) * 0.05;
    let c: RGB;
    if (kind === "moon") {
      const C = ALBEDO.moon;
      let m = 0;
      const warp = fbm(x * 3 + 2, y * 3, z * 3, 5) * 0.55 + fbm(x * 12, y * 12, z * 12, 3) * 0.12;
      for (const [mlon, mlat, r] of MARIA) {
        const ml = mlat / 57.3, mo = mlon / 57.3;
        const d = Math.acos(Math.max(-1, Math.min(1, Math.cos(ml) * Math.cos(mo) * x + Math.sin(ml) * y - Math.cos(ml) * Math.sin(mo) * z))) * 57.3 / r;
        m = Math.max(m, smooth(1.05, 0.75, d + warp));
      }
      c = mixc(C.high, C.mid, smooth(0.35, 0.65, n));
      c = mixc(c, C.mare, m * 0.78 * (0.75 + n * 0.5));
      if (m > 0.3) height[i] *= 0.4; // seas are smooth
    } else if (kind === "mercury") {
      const C = ALBEDO.mercury;
      c = mixc(C.dark, C.base, smooth(0.3, 0.55, n));
      c = mixc(c, C.light, smooth(0.6, 0.85, n));
    } else if (kind === "mars") {
      const C = ALBEDO.mars, dark = fbm(x * 2.2 + 4, y * 2.2, z * 2.2, 5) * 0.5 + 0.5, alat = Math.abs(lat) * 57.3;
      c = mixc(C.base, C.light, smooth(0.45, 0.75, n) * 0.6);
      c = mixc(c, C.dark, smooth(0.52, 0.72, dark) * 0.75);
      const cap = smooth(0, 1, (alat - (lat > 0 ? 76 : 72) + fbm(x * 6, y * 6, z * 6, 3) * 6) / 4);
      c = mixc(c, C.cap, cap);
    } else {
      const C = ALBEDO.rock;
      c = mixc(C.dark, C.base, smooth(0.3, 0.55, n));
      c = mixc(c, C.light, smooth(0.65, 0.9, n));
    }
    const s = shade[i] * (kind === "mars" ? 0.2 : 0.28) + g;
    put(albedo, i, [c[0] * (1 + s), c[1] * (1 + s), c[2] * (1 + s)]);
  });
  return { w, h, albedo, height: heightBytes(height) };
}

/** Gas giants and ice giants: latitude bands, stretched turbulence along them, and a storm. */
function paintGiant(w: number, h: number, kind: "jupiter" | "saturn" | "uranus" | "neptune"): BodyMaps {
  const seed = { jupiter: 3, saturn: 13, uranus: 29, neptune: 37 }[kind];
  const { fbm } = makeNoise(seed), albedo = new Uint8ClampedArray(w * h * 4);
  eachPixel(w, h, (lat, lon, x, y, z, i) => {
    const turb = fbm(x * 3, y * 18, z * 3, 5) * (kind === "uranus" ? 0.02 : 0.09);
    const swirl = fbm(x * 6 + 3, y * 6, z * 6, 4) * (kind === "jupiter" ? 0.05 : 0.02);
    const t = Math.sin(lat) + turb + swirl, alat = Math.abs(lat);
    let c: RGB;
    if (kind === "jupiter") {
      const C = ALBEDO.jupiter;
      const band = Math.sin(t * 15.5) * 0.5 + 0.5, fine = Math.sin(t * 41 + 1) * 0.5 + 0.5;
      c = mixc(C.zone, C.belt, smooth(0.45, 0.8, band) * smooth(1.05, 0.2, alat) );
      c = mixc(c, C.cream, smooth(0.3, 0.9, fine) * 0.25);
      c = mixc(c, C.deep, smooth(0.8, 0.98, band) * 0.5 * smooth(0.9, 0.1, alat));
      c = mixc(c, C.pole, smooth(0.95, 1.35, alat));
      // the Great Red Spot, with a swirl
      const dl = (lat * 57.3 + 22) / 6.5, dn = (((lon * 57.3 - 40 + 540) % 360) - 180) / 12;
      const d = Math.sqrt(dl * dl + dn * dn) + fbm(x * 14, y * 14, z * 14, 3) * 0.25;
      c = mixc(c, C.spot, smooth(1, 0.45, d) * 0.85);
      c = mixc(c, C.zone, smooth(1.25, 1.0, d) * smooth(0.8, 1.0, d) * 0.5);
    } else if (kind === "saturn") {
      const C = ALBEDO.saturn, band = Math.sin(t * 11) * 0.5 + 0.5, fine = Math.sin(t * 33) * 0.5 + 0.5;
      c = mixc(C.a, C.b, smooth(0.35, 0.85, band) * 0.8);
      c = mixc(c, C.c, smooth(0.6, 0.95, fine) * 0.25);
      c = mixc(c, C.pole, smooth(1.0, 1.4, alat));
    } else if (kind === "uranus") {
      const C = ALBEDO.uranus, band = Math.sin(t * 9) * 0.5 + 0.5;
      c = mixc(C.a, C.b, band * 0.45);
      c = mixc(c, C.c, smooth(1.1, 1.5, alat) * 0.6);
    } else {
      const C = ALBEDO.neptune, band = Math.sin(t * 9) * 0.5 + 0.5;
      c = mixc(C.b, C.a, band * 0.6);
      c = mixc(c, C.c, smooth(0.8, 0.95, Math.sin(t * 23) * 0.5 + 0.5) * 0.3);
      const dl = (lat * 57.3 + 20) / 6, dn = lon * 57.3 / 10, d = Math.sqrt(dl * dl + dn * dn);
      c = mixc(c, C.spot, smooth(1, 0.4, d) * 0.7);
    }
    put(albedo, i, c);
  });
  return { w, h, albedo };
}

function paintVenus(w: number, h: number): BodyMaps {
  const { fbm } = makeNoise(7), C = ALBEDO.venus, albedo = new Uint8ClampedArray(w * h * 4);
  eachPixel(w, h, (lat, _lon, x, y, z, i) => {
    // thick, slow cloud: a soft chevron flow, low contrast
    const wx = fbm(x * 2, y * 2, z * 2, 4) * 0.7;
    const n = fbm(x * 2.5 + wx, y * 7 + Math.abs(lat) * 2, z * 2.5 + wx, 6) * 0.5 + 0.5;
    let c = mixc(C.b, C.a, smooth(0.25, 0.75, n));
    c = mixc(c, C.c, smooth(0.65, 0.9, n) * 0.5);
    c = mixc(c, C.d, smooth(0.35, 0.15, n) * 0.5);
    put(albedo, i, c);
  });
  return { w, h, albedo };
}

function paintSun(w: number, h: number): BodyMaps {
  const { fbm, noise } = makeNoise(1), C = ALBEDO.sun, albedo = new Uint8ClampedArray(w * h * 4);
  eachPixel(w, h, (lat, lon, x, y, z, i) => {
    // granulation: bright cells and dark lanes, with a larger mottle and a few sunspots in the royal belts
    const cell = 1 - Math.abs(noise(x * 34, y * 34, z * 34)) * 1.6;
    const mottle = fbm(x * 5, y * 5, z * 5, 4) * 0.5 + 0.5;
    let c = mixc(C.lane, C.base, smooth(0.0, 0.7, cell));
    c = mixc(c, C.hot, smooth(0.55, 0.95, cell) * 0.45 + smooth(0.6, 0.9, mottle) * 0.25);
    const spot = fbm(x * 9 + 4, y * 9, z * 9, 3), alat = Math.abs(lat) * 57.3;
    c = mixc(c, C.spot, smooth(0.42, 0.56, spot) * smooth(4, 12, alat) * smooth(32, 22, alat) * 0.85);
    void lon;
    put(albedo, i, c);
  });
  return { w, h, albedo };
}

function paintDeepSpace(w: number, h: number): BodyMaps {
  const { fbm } = makeNoise(41), C = ALBEDO.deepSpace, albedo = new Uint8ClampedArray(w * h * 4);
  eachPixel(w, h, (_lat, _lon, x, y, z, i) => {
    // a far ice world: dark blue plains crossed by pale fractures
    const n = fbm(x * 3, y * 3, z * 3, 5) * 0.5 + 0.5, crack = 1 - Math.abs(fbm(x * 7 + 2, y * 7, z * 7, 4));
    let c = mixc(C.base, C.mid, smooth(0.3, 0.8, n) * 0.7);
    c = mixc(c, C.ice, smooth(0.95, 0.99, crack) * 0.6);
    c = mixc(c, C.white, smooth(0.985, 0.998, crack) * 0.35);
    put(albedo, i, c);
  });
  return { w, h, albedo };
}

/** Paints the texture set of a body at width `w` (height is `w / 2`). Deterministic. */
export function paintBody(id: MapBodyId, w: number): BodyMaps {
  const h = Math.max(2, Math.round(w / 2));
  switch (id) {
    case "earth": return paintEarth(w, h);
    case "moon": case "mercury": case "mars": case "rock": return paintRocky(w, h, id);
    case "jupiter": case "saturn": case "uranus": case "neptune": return paintGiant(w, h, id);
    case "venus": return paintVenus(w, h);
    case "sun": return paintSun(w, h);
    case "deep-space": return paintDeepSpace(w, h);
  }
}

/** Saturn's and Uranus's rings: a radial strip, inner edge first. RGBA with alpha. */
export function paintRing(kind: "saturn" | "uranus", w = 512): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * 4), { noise } = makeNoise(kind === "saturn" ? 19 : 31);
  const base = kind === "saturn" ? ALBEDO.saturn.a : ALBEDO.uranus.c;
  for (let i = 0; i < w; i++) {
    const t = i / (w - 1), fine = noise(t * 120, 0.5, 0.5) * 0.5 + 0.5;
    let a: number;
    if (kind === "saturn") {
      // the faint C ring, the bright B ring, the Cassini division, the A ring with the Encke gap
      a = t < 0.22 ? 0.25 : t < 0.58 ? 0.92 : t < 0.64 ? 0.06 : t < 0.93 ? 0.7 : 0.25;
      if (t > 0.86 && t < 0.875) a = 0.1;
      a *= 0.75 + fine * 0.35;
      a *= smooth(0, 0.02, t) * smooth(1, 0.97, t);
    } else {
      a = (Math.exp(-((t - 0.85) ** 2) / 0.0008) * 0.9 + Math.exp(-((t - 0.35) ** 2) / 0.0004) * 0.4) * (0.8 + fine * 0.3);
    }
    const shade = 0.82 + fine * 0.25 - (kind === "saturn" && t < 0.22 ? 0.2 : 0);
    out[i * 4] = base[0] * shade; out[i * 4 + 1] = base[1] * shade; out[i * 4 + 2] = base[2] * shade; out[i * 4 + 3] = clamp01(a) * 255;
  }
  return out;
}
