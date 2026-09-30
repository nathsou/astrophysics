/**
 * The standard-cell block of the fifth level, generated from a fixed seed so that the picture is the
 * same on the server and in the browser: rows of cells 19.2 px (0.9 µm) tall, one NAND cell at a known
 * place (the zoom's next focus), and some metal wires.
 */
import { seeded } from './random';

export const ROW_H = 19.2;
export const ROWS = 20;
export const X0 = 8;
export const X1 = 632;
export const TOP = 8;
/** One poly pitch (117 nm at 21.3 px per µm), in pixels. */
export const POLY = 2.5;
export const NAND_ROW = 9;
export const NAND = { x: 320, w: 9.6 };
const WIDTHS = [3, 4, 4, 5, 6, 6, 8, 10, 14, 20, 28];

export interface Cell {
  x: number;
  w: number;
  tint: number;
  nand?: boolean;
}
export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function buildBlock(seed = 20260929): { rows: Cell[][]; hs: Seg[]; vs: Seg[] } {
  const rand = seeded(seed);
  const rows: Cell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const cells: Cell[] = [];
    let x = X0;
    while (x < X1 - 0.01) {
      if (r === NAND_ROW && Math.abs(x - NAND.x) < 0.01) {
        cells.push({ x, w: NAND.w, tint: 3, nand: true });
        x += NAND.w;
        continue;
      }
      let w = WIDTHS[Math.floor(rand() * WIDTHS.length)]! * POLY;
      if (r === NAND_ROW && x < NAND.x && x + w > NAND.x - 1) w = NAND.x - x; // land exactly on the NAND cell
      if (r === NAND_ROW && x < NAND.x && NAND.x - x < 1.5) {
        // too little room for a cell: widen the previous one instead
        const last = cells[cells.length - 1]!;
        last.w += NAND.x - x;
        x = NAND.x;
        continue;
      }
      if (x + w > X1) w = X1 - x;
      cells.push({ x, w, tint: Math.floor(rand() * 3) });
      x += w;
    }
    rows.push(cells);
  }
  const hs: Seg[] = [];
  const vs: Seg[] = [];
  for (let i = 0; i < 90; i++) {
    const r = Math.floor(rand() * ROWS);
    const y = TOP + r * ROW_H + 3 + Math.floor(rand() * 4) * 3.6;
    const x = X0 + rand() * 560;
    hs.push({ x1: x, y1: y, x2: x + 12 + rand() * 60, y2: y });
  }
  for (let i = 0; i < 70; i++) {
    const x = X0 + 4 + rand() * 610;
    const r = Math.floor(rand() * (ROWS - 3));
    vs.push({ x1: x, y1: TOP + r * ROW_H + 4, x2: x, y2: TOP + (r + 2 + Math.floor(rand() * 3)) * ROW_H - 4 });
  }
  return { rows, hs, vs };
}
