/**
 * The keyboard drawn on the first level of the zoom: a full-size (104-key) layout in a 640 × 400
 * frame at 25 px per key unit (a real key pitch is 19 mm, so the frame is 45 cm across).
 */

export interface KeyRect {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const UNIT = 25;
export const GAP = 3;
export const ORIGIN = { x: 28, y: 100 };
/** Row tops, in pixels: function row, number row, Q row, A row, Z row, space row. */
export const ROW_Y = [100, 132, 158, 184, 210, 236] as const;

interface Spec {
  label: string;
  w: number;
}
const k = (label: string, w = 1): Spec => ({ label, w });
const gap = (w: number): Spec => ({ label: '', w: -w });

const MAIN: Spec[][] = [
  [k('Esc'), gap(1), ...['F1', 'F2', 'F3', 'F4'].map((l) => k(l)), gap(0.5), ...['F5', 'F6', 'F7', 'F8'].map((l) => k(l)), gap(0.5), ...['F9', 'F10', 'F11', 'F12'].map((l) => k(l))],
  [...['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='].map((l) => k(l)), k('⌫', 2)],
  [k('Tab', 1.5), ...['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'].map((l) => k(l)), k('\\', 1.5)],
  [k('Caps', 1.75), ...['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', '’'].map((l) => k(l)), k('Enter', 2.25)],
  [k('Shift', 2.25), ...['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'].map((l) => k(l)), k('Shift', 2.75)],
  [k('Ctrl', 1.25), k('', 1.25), k('Alt', 1.25), k('', 6.25), k('Alt', 1.25), k('', 1.25), k('', 1.25), k('Ctrl', 1.25)],
];

/** Every key of the main block, in pixels. */
export function mainKeys(): KeyRect[] {
  const out: KeyRect[] = [];
  MAIN.forEach((row, r) => {
    let x = ORIGIN.x;
    for (const s of row) {
      if (s.w < 0) {
        x += -s.w * UNIT;
        continue;
      }
      out.push({ label: s.label, x, y: ROW_Y[r]!, w: s.w * UNIT - GAP, h: 22 });
      x += s.w * UNIT;
    }
  });
  return out;
}

/** The navigation cluster (six keys and the arrows) and the numeric keypad. */
export function extraKeys(): KeyRect[] {
  const out: KeyRect[] = [];
  const nx = ORIGIN.x + 15.5 * UNIT;
  const cell = (col: number, row: number, x0: number, label = ''): KeyRect => ({ label, x: x0 + col * UNIT, y: ROW_Y[row]!, w: UNIT - GAP, h: 22 });
  for (let c = 0; c < 3; c++) {
    out.push(cell(c, 1, nx));
    out.push(cell(c, 2, nx));
  }
  out.push(cell(1, 4, nx, '↑'));
  for (let c = 0; c < 3; c++) out.push(cell(c, 5, nx, ['←', '↓', '→'][c]!));
  const px = nx + 3.5 * UNIT;
  for (let r = 1; r <= 5; r++) for (let c = 0; c < 4; c++) out.push(cell(c, r, px));
  return out;
}

/** The A key. */
export function keyA(): KeyRect {
  return mainKeys().find((key) => key.label === 'A')!;
}

export const keyCentre = (key: KeyRect): { x: number; y: number } => ({ x: key.x + key.w / 2, y: key.y + key.h / 2 });

/** The keyboard's body (case) rectangle. */
export const BODY = { x: 12, y: 84, w: 616, h: 196 };
