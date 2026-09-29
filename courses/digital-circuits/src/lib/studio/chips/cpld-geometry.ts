/**
 * Layout of the vCPLD-32 chip view: four function blocks (each a 48 × 40 AND array with its eight
 * macrocells and pads) around a global interconnect matrix drawn as a crossbar: 64 horizontal source lines
 * (32 pins, 32 macrocell feedbacks) and, for every block input, a vertical line with a dot where its
 * multiplexer selects a source. FB0 and FB1 sit above the matrix (their inputs enter at the bottom), FB2 and
 * FB3 below it; the left blocks have their macrocells and pads on the left, the right ones on the right.
 * Pure, for the view and its tests.
 */
import { FB_INPUTS, FUNCTION_BLOCKS, LITERAL_COLUMNS, MACROCELLS_PER_FB, SOURCE_COUNT, TERMS_PER_FB, TERMS_PER_MC } from '../../pld/devices/vcpld32-arch';

export const CW = 8;
export const RH = 9;
export const LINE_GAP = 2.6;

export interface FbGeom {
  fb: number;
  /** Macrocells and pads on the right of the array. */
  right: boolean;
  /** The block is above the matrix (inputs enter at the bottom). */
  top: boolean;
  /** Direction from the array towards the macrocells: +1 right, −1 left. */
  dir: 1 | -1;
  arrX0: number;
  arrX1: number;
  arrY0: number;
  arrY1: number;
  /** The array edge the term rows leave by, and the macrocell block's edge nearest the array. */
  edgeX: number;
  mcIn: number;
  padX: number;
  padW: number;
  bufY: number;
  colX(c: number): number;
  rowY(t: number): number;
  /** Centre line of macrocell m. */
  mcY(m: number): number;
  /** x of the buffer of block input k. */
  inputX(k: number): number;
  /** x in flow coordinates: `u` px from the macrocell block's edge towards the pad. */
  mcU(u: number): number;
}

export interface CpldGeom {
  W: number;
  H: number;
  fbs: FbGeom[];
  band: { x0: number; x1: number; y0: number; y1: number; lineTop: number };
  /** y of source line s (0–31 pins, 32–63 macrocells). */
  lineY(s: number): number;
}

const ARR_W = CW * LITERAL_COLUMNS;
const ARR_H = RH * TERMS_PER_FB;
const STEER = 66;
const MC_W = 190;
const PAD_W = 64;

let cached: CpldGeom | undefined;

export function cpldGeom(): CpldGeom {
  if (cached) return cached;
  const margin = 22;
  const gap = 28;
  const xLeft = margin;
  const leftArrX0 = xLeft + PAD_W + 8 + MC_W + STEER;
  const leftArrX1 = leftArrX0 + ARR_W;
  const rightArrX0 = leftArrX1 + gap;
  const rightArrX1 = rightArrX0 + ARR_W;
  const W = rightArrX1 + STEER + MC_W + 8 + PAD_W + margin;

  const yTop0 = 92;
  const topBuf = yTop0 + ARR_H + 14;
  const bandY0 = topBuf + 28;
  const lineTop = bandY0 + 30;
  const bandY1 = lineTop + SOURCE_COUNT * LINE_GAP + 24;
  const botBuf = bandY1 + 14;
  const yBot0 = botBuf + 28;
  const H = yBot0 + ARR_H + 46;

  const mk = (fb: number): FbGeom => {
    const right = (fb & 1) === 1;
    const top = fb < 2;
    const arrX0 = right ? rightArrX0 : leftArrX0;
    const arrX1 = arrX0 + ARR_W;
    const arrY0 = top ? yTop0 : yBot0;
    const dir: 1 | -1 = right ? 1 : -1;
    const edgeX = right ? arrX1 : arrX0;
    const mcIn = edgeX + dir * STEER;
    const padX = right ? mcIn + MC_W + 8 : mcIn - MC_W - 8 - PAD_W;
    return {
      fb,
      right,
      top,
      dir,
      arrX0,
      arrX1,
      arrY0,
      arrY1: arrY0 + ARR_H,
      edgeX,
      mcIn,
      padX,
      padW: PAD_W,
      bufY: top ? topBuf : botBuf,
      colX: (c) => arrX0 + CW * (c + 0.5),
      rowY: (t) => arrY0 + RH * (t + 0.5),
      mcY: (m) => arrY0 + RH * TERMS_PER_MC * (m + 0.5),
      inputX: (k) => arrX0 + CW * (2 * k + 1),
      mcU: (u) => mcIn + dir * u,
    };
  };
  const fbs = Array.from({ length: FUNCTION_BLOCKS }, (_, f) => mk(f));
  cached = {
    W,
    H,
    fbs,
    band: { x0: leftArrX0 - 40, x1: rightArrX1 + 40, y0: bandY0, y1: bandY1, lineTop },
    lineY: (s) => lineTop + (s + 0.5) * LINE_GAP,
  };
  return cached;
}

export type CpldHit =
  | { kind: 'fuse'; fb: number; term: number; col: number }
  | { kind: 'mc'; fb: number; mc: number }
  | { kind: 'pad'; io: number }
  | { kind: 'mux'; fb: number; input: number }
  | { kind: 'source'; source: number }
  | null;

/**
 * What is under a point. `selectedSource(fb, k)` gives the source chosen by a block input, for hitting the
 * crossbar dots.
 */
export function cpldHit(g: CpldGeom, x: number, y: number, selectedSource: (fb: number, k: number) => number): CpldHit {
  for (const f of g.fbs) {
    if (x >= f.padX && x <= f.padX + f.padW) {
      const m = Math.floor((y - f.arrY0) / (RH * TERMS_PER_MC));
      if (m >= 0 && m < MACROCELLS_PER_FB && Math.abs(y - f.mcY(m)) <= 10) return { kind: 'pad', io: f.fb * MACROCELLS_PER_FB + m };
    }
    if (x >= f.arrX0 && x < f.arrX1 && y >= f.arrY0 && y < f.arrY1) return { kind: 'fuse', fb: f.fb, term: Math.floor((y - f.arrY0) / RH), col: Math.floor((x - f.arrX0) / CW) };
    const lo = Math.min(f.mcIn, f.mcIn + f.dir * MC_W);
    const hi = Math.max(f.mcIn, f.mcIn + f.dir * MC_W);
    if (x >= lo && x <= hi && y >= f.arrY0 && y < f.arrY1) return { kind: 'mc', fb: f.fb, mc: Math.min(MACROCELLS_PER_FB - 1, Math.floor((y - f.arrY0) / (RH * TERMS_PER_MC))) };
  }
  if (y >= g.band.y0 && y <= g.band.y1) {
    for (const f of g.fbs)
      for (let k = 0; k < FB_INPUTS; k++) {
        if (Math.abs(x - f.inputX(k)) <= CW / 2 + 1) {
          const s = selectedSource(f.fb, k);
          if (Math.abs(y - g.lineY(s)) <= 3.5) return { kind: 'mux', fb: f.fb, input: k };
        }
      }
    const s = Math.round((y - g.band.lineTop) / LINE_GAP - 0.5);
    if (s >= 0 && s < SOURCE_COUNT && Math.abs(y - g.lineY(s)) <= 1.4) return { kind: 'source', source: s };
  }
  return null;
}
