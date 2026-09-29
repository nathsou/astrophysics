/** Layout of the PROM chip view: rows are words, columns are outputs. Pure, for the view and its tests. */
export interface PromGeom {
  words: number;
  width: number;
  rowH: number;
  colW: number;
  /** Left edge of the fuse array and top of the first row. */
  xArr: number;
  yArr: number;
  /** Decoder block. */
  xDec: number;
  wDec: number;
  W: number;
  H: number;
  /** Centre row (y) of word `w`. */
  wordY(w: number): number;
  /** x of the fuse of column `c`, and of its bit line. */
  fuseX(c: number): number;
  bitX(c: number): number;
  yBottom: number;
}

export function promGeom(words: number, width: number, addressBits: number): PromGeom {
  const rowH = words <= 16 ? 26 : words <= 32 ? 20 : 14;
  const colW = width <= 8 ? 46 : 40;
  const xDec = 58;
  const wDec = 104;
  const xArr = xDec + wDec + 64;
  const yArr = 112;
  const yBottom = yArr + words * rowH;
  return {
    words,
    width,
    rowH,
    colW,
    xArr,
    yArr,
    xDec,
    wDec,
    W: xArr + colW * width + 40,
    H: yBottom + 96,
    wordY: (w) => yArr + rowH * (w + 0.5),
    fuseX: (c) => xArr + colW * c + colW * 0.32,
    bitX: (c) => xArr + colW * c + colW * 0.78,
    yBottom,
  };
}

/** The (word, column) under a point in content pixels, or null. */
export function promHit(g: PromGeom, x: number, y: number): { word: number; column: number } | null {
  if (x < g.xArr || y < g.yArr) return null;
  const column = Math.floor((x - g.xArr) / g.colW);
  const word = Math.floor((y - g.yArr) / g.rowH);
  if (column < 0 || column >= g.width || word < 0 || word >= g.words) return null;
  return { word, column };
}
