/**
 * Layout of the GAL22V10 chip view: a DIP-24 package around the 44-column, 132-row AND array grouped by
 * output macrocell, with the macrocells to the right and the pins down both sides. Pure, for the view and
 * its tests.
 *
 * Coordinates are content pixels. Rows are 8 px apart with a 12 px gap between macrocell groups; columns
 * 10 px apart.
 */
import { AR_ROW, COLUMNS, OLMC_PINS, ROWS, SP_ROW, columnSignal, olmcRows } from '../../pld/devices/gal22v10';

export const COL_W = 10;
export const ROW_H = 8;
export const GROUP_GAP = 12;

export interface GalPad {
  pin: number;
  /** Lead rectangle (outside the body) and the point where the wire enters the body. */
  x: number;
  y: number;
  w: number;
  h: number;
  side: 'left' | 'right';
  /** Centre of the lead, the y the wire leaves at. */
  cy: number;
}

export interface GalRoute {
  /** The signal's pin. */
  pin: number;
  kind: 'input' | 'feedback';
  d: string;
}

export interface GalGeom {
  W: number;
  H: number;
  xBody0: number;
  xBody1: number;
  yBody0: number;
  yBody1: number;
  xArr: number;
  xArrEnd: number;
  yArr0: number;
  yArrEnd: number;
  /** y of the input buffers. */
  yBuf: number;
  colX(c: number): number;
  rowY(r: number): number;
  /** First and last row y of each OLMC group (index 0 = pin 23), including the gap around it. */
  group: { top: number; bottom: number; cy: number }[];
  /** Macrocell block. */
  xBlock0: number;
  xBlock1: number;
  pads: GalPad[];
  routes: GalRoute[];
  /** The curve from a macrocell's output to its pin. */
  outCurves: { pin: number; d: string }[];
}

let cached: GalGeom | undefined;

export function galGeom(): GalGeom {
  if (cached) return cached;
  const xBody0 = 96;
  const xArr = 214;
  const xArrEnd = xArr + COLUMNS * COL_W;
  const xBlock0 = xArrEnd + 18;
  const xBlock1 = xBlock0 + 262;
  const xBody1 = xBlock1 + 122;
  const yBuf = 214;
  const yArr0 = 236;

  // Row positions: AR, then the ten macrocell groups (OE row + product terms), then SP.
  const rowYs: number[] = new Array(ROWS).fill(0);
  let y = yArr0 + 4;
  rowYs[AR_ROW] = y;
  y += ROW_H + GROUP_GAP;
  const group: GalGeom['group'] = [];
  for (const pin of OLMC_PINS) {
    const r = olmcRows(pin);
    const top = y - ROW_H / 2 - GROUP_GAP / 2;
    for (let i = 0; i <= r.terms; i++) {
      rowYs[r.oeRow + i] = y;
      y += ROW_H;
    }
    const bottom = y - ROW_H / 2 + GROUP_GAP / 2;
    group.push({ top, bottom, cy: (rowYs[r.firstTermRow]! + rowYs[r.firstTermRow + r.terms - 1]!) / 2 });
    y += GROUP_GAP;
  }
  rowYs[SP_ROW] = y;
  const yArrEnd = y + ROW_H / 2 + 6;
  const yBody0 = 64;
  const yBody1 = yArrEnd + 46;
  const H = yBody1 + 30;
  const W = xBody1 + 92;

  // Pins: 1–12 down the left, 24–13 down the right.
  const yPin0 = yArr0 + 30;
  const pitch = (yArrEnd - yPin0 - 40) / 11;
  const pads: GalPad[] = [];
  for (let p = 1; p <= 12; p++) {
    const cy = yPin0 + (p - 1) * pitch;
    pads.push({ pin: p, x: xBody0 - 60, y: cy - 10, w: 60, h: 20, side: 'left', cy });
  }
  for (let p = 24; p >= 13; p--) {
    const cy = yPin0 + (24 - p) * pitch;
    pads.push({ pin: p, x: xBody1, y: cy - 10, w: 60, h: 20, side: 'right', cy });
  }
  const pad = (pin: number) => pads.find((q) => q.pin === pin)!;

  const colX = (c: number) => xArr + COL_W * (c + 0.5);
  const routes: GalRoute[] = [];
  const yBus0 = 92;
  // Dedicated inputs on the left: larger pin → outer channel and higher bus row, so the staircase does not cross itself.
  for (let p = 1; p <= 11; p++) {
    const k = 2 * (p - 1);
    const xm = (colX(2 * k) + colX(2 * k + 1)) / 2;
    const p0 = pad(p);
    const xc = xBody0 + 16 + (11 - p) * 7;
    const yb = yBus0 + (11 - p) * 6;
    routes.push({ pin: p, kind: 'input', d: `M${xBody0} ${p0.cy}H${xc}V${yb}H${xm}V${yBuf - 8}` });
  }
  // Right side: feedback from each macrocell and pin 13, ordered by source height.
  const xFb = xBlock1 + 10;
  const rightSources: { pin: number; y: number; x: number; kind: 'input' | 'feedback' }[] = OLMC_PINS.map((pin, k) => ({ pin, y: group[k]!.cy, x: xFb, kind: 'feedback' as const }));
  rightSources.push({ pin: 13, y: pad(13).cy, x: xBody1, kind: 'input' });
  rightSources.forEach((s, j) => {
    const sig = s.pin === 13 ? 21 : 2 * ((23 - s.pin) * 1) + 1;
    const k = s.pin === 13 ? 21 : 1 + 2 * (23 - s.pin);
    void sig;
    const xm = (colX(2 * k) + colX(2 * k + 1)) / 2;
    const xc = xBlock1 + 30 + j * 7;
    const yb = yBus0 + 90 + (10 - j) * 6;
    routes.push({ pin: s.pin, kind: s.kind, d: `M${s.x} ${s.y}H${xc}V${yb}H${xm}V${yBuf - 8}` });
  });

  // Macrocell outputs to their pins: monotone curves that cannot cross.
  const outCurves = OLMC_PINS.map((pin, k) => {
    const x0 = xBlock1 - 2;
    const y0 = group[k]!.cy;
    const p = pad(pin);
    const x1 = xBody1;
    const mx = (x0 + x1) / 2;
    return { pin, d: `M${x0} ${y0}C${mx} ${y0} ${mx} ${p.cy} ${x1} ${p.cy}` };
  });

  cached = {
    W,
    H,
    xBody0,
    xBody1,
    yBody0,
    yBody1,
    xArr,
    xArrEnd,
    yArr0,
    yArrEnd,
    yBuf,
    colX,
    rowY: (r) => rowYs[r]!,
    group,
    xBlock0,
    xBlock1,
    pads,
    routes,
    outCurves,
  };
  return cached;
}

export type GalHit = { kind: 'fuse'; row: number; col: number } | { kind: 'olmc'; index: number } | { kind: 'pin'; pin: number } | null;

/** What is under a point (content pixels). */
export function galHit(g: GalGeom, x: number, y: number): GalHit {
  for (const p of g.pads) if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return { kind: 'pin', pin: p.pin };
  if (x >= g.xArr && x < g.xArrEnd) {
    // The nearest row line.
    let best = -1;
    let bd = ROW_H / 2 + 0.01;
    // Rows are ordered by y, so scan with early exit.
    for (let r = 0; r < ROWS; r++) {
      const d = Math.abs(g.rowY(r) - y);
      if (d < bd) {
        bd = d;
        best = r;
      }
    }
    if (best >= 0) return { kind: 'fuse', row: best, col: Math.floor((x - g.xArr) / COL_W) };
    return null;
  }
  if (x >= g.xBlock0 && x <= g.xBlock1) {
    const i = g.group.findIndex((q) => y >= q.top && y <= q.bottom);
    if (i >= 0) return { kind: 'olmc', index: i };
  }
  return null;
}

/** The array column pair (true, complement) of a signal pin. */
export function pinColumns(pin: number): [number, number] | null {
  for (let c = 0; c < COLUMNS; c += 2) if (columnSignal(c).pin === pin) return [c, c + 1];
  return null;
}
