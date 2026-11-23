import { placeParts } from "./tricks";

/**
 * The Base-10 fleet for a × b (SPEC §3): rows (squads) and columns (ships per squad) are split by
 * place value, every row band × column band is a Battle Sector, and a sector is drawn with the
 * biggest ship class that tiles it exactly. 6 × 24 → 12 Squadron Pods (6 × 20) + 24 Fighters (6 × 4);
 * 16 × 24 → 2 Carriers, 4 Pods, 12 Pods and 24 Fighters. Pure: the stage only draws what this says.
 */
export interface Sector {
  i: number;
  /** Index of the row band (place-value part of a, biggest first) and column band (of b). */
  rowBand: number; colBand: number;
  rowPart: number; colPart: number;
  /** Ships in this sector: `rows` × `cols` ships, each worth 10^k. */
  rows: number; cols: number; k: number;
  value: number;
  /** Squadron Pods and bigger lie along the columns ("h") unless the tens come from the rows ("v"). */
  orient: "h" | "v";
}
export interface Ship { id: number; sector: number; row: number; col: number; k: number; value: number }
export interface Fleet { a: number; b: number; rowParts: number[]; colParts: number[]; sectors: Sector[]; ships: Ship[]; total: number }

const exp10 = (p: number) => String(p).length - 1;

export function fleetOf(a: number, b: number): Fleet {
  const rowParts = a > 0 ? placeParts(a) : [], colParts = b > 0 ? placeParts(b) : [];
  const sectors: Sector[] = [], ships: Ship[] = [];
  rowParts.forEach((r, rowBand) => colParts.forEach((c, colBand) => {
    const kr = exp10(r), kc = exp10(c), rows = r / 10 ** kr, cols = c / 10 ** kc, k = kr + kc, i = sectors.length;
    sectors.push({ i, rowBand, colBand, rowPart: r, colPart: c, rows, cols, k, value: r * c, orient: kc === 0 && kr > 0 ? "v" : "h" });
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) ships.push({ id: ships.length, sector: i, row, col, k, value: 10 ** k });
  }));
  return { a, b, rowParts, colParts, sectors, ships, total: a * b };
}

/** The order ships fall under a volley: biggest class first, then reading order (SPEC: 105 into 6 × 24 → 10 Pods + 5 micro-fighters). */
export function fireOrder(f: Fleet): Ship[] {
  return f.ships.slice().sort((x, y) => y.k - x.k || x.sector - y.sector || x.row - y.row || x.col - y.col);
}

export interface Hit { ship: number; amount: number; full: boolean }
export interface VolleyPlan { hits: Hit[]; remaining: number; extra: number }

/** What `n` plasma balls do to a full fleet: which ships fall (one may be partly hit), what is left, what flies past. */
export function volley(f: Fleet, n: number): VolleyPlan {
  let left = Math.max(0, n);
  const hits: Hit[] = [];
  for (const s of fireOrder(f)) {
    if (left <= 0) break;
    const amount = Math.min(s.value, left);
    hits.push({ ship: s.id, amount, full: amount === s.value });
    left -= amount;
  }
  return { hits, remaining: Math.max(0, f.total - n), extra: Math.max(0, n - f.total) };
}

/** Short label for a ship class: 1, 10, 100, 1K, 10K, 100K, 1M… */
export function unitLabel(k: number) {
  if (k < 3) return String(10 ** k);
  const units = ["K", "M", "B", "T"], u = Math.min(units.length - 1, Math.floor(k / 3) - 1);
  return `${10 ** (k - 3 * (u + 1))}${units[u]}`;
}
