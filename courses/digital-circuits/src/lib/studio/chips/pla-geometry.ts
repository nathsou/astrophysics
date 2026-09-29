/** Layout of the PLA chip view: the AND plane, the OR plane, and where every fuse is. Pure. */
export interface PlaGeom {
  I: number;
  T: number;
  O: number;
  colW: number;
  orW: number;
  rowH: number;
  /** Left of the AND plane, right of it, left and right of the OR plane. */
  xA0: number;
  xA1: number;
  xO0: number;
  xO1: number;
  yArr: number;
  yBottom: number;
  W: number;
  H: number;
  rowY(t: number): number;
  /** x of literal column `k` (2 per input: 2i true, 2i + 1 complement). */
  andX(k: number): number;
  orX(o: number): number;
  /** y of the polarity fuse. */
  yPol: number;
}

export function plaGeom(I: number, T: number, O: number): PlaGeom {
  const colW = 22;
  const orW = 32;
  const rowH = 26;
  const xA0 = 64;
  const xA1 = xA0 + 2 * I * colW;
  const xO0 = xA1 + 70;
  const xO1 = xO0 + O * orW;
  const yArr = 172;
  const yBottom = yArr + T * rowH;
  return {
    I,
    T,
    O,
    colW,
    orW,
    rowH,
    xA0,
    xA1,
    xO0,
    xO1,
    yArr,
    yBottom,
    W: xO1 + 60,
    H: yBottom + 182,
    rowY: (t) => yArr + rowH * (t + 0.5),
    andX: (k) => xA0 + colW * (k + 0.5),
    orX: (o) => xO0 + orW * (o + 0.5),
    yPol: yBottom + 92,
  };
}

export type PlaCell = { plane: 'and'; term: number; input: number; literal: 'true' | 'complement' } | { plane: 'or'; term: number; output: number } | { plane: 'polarity'; output: number };

/** The fuse under a point (content pixels), or null. */
export function plaHit(g: PlaGeom, x: number, y: number): PlaCell | null {
  const row = Math.floor((y - g.yArr) / g.rowH);
  if (row >= 0 && row < g.T) {
    if (x >= g.xA0 && x < g.xA1) {
      const k = Math.floor((x - g.xA0) / g.colW);
      return { plane: 'and', term: row, input: k >> 1, literal: k & 1 ? 'complement' : 'true' };
    }
    if (x >= g.xO0 && x < g.xO1) return { plane: 'or', term: row, output: Math.floor((x - g.xO0) / g.orW) };
    return null;
  }
  if (Math.abs(y - g.yPol) <= 12 && x >= g.xO0 && x < g.xO1) return { plane: 'polarity', output: Math.floor((x - g.xO0) / g.orW) };
  return null;
}
