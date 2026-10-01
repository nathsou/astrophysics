/**
 * Small dense matrices as arrays of rows (`number[][]`), enough for Kalman filters and vertex fits.
 * Nothing here is clever: sizes are at most 5 × 5, and clarity is worth more than speed.
 */
export type Mat = number[][];
export type Vec = number[];

export function zeros(n: number, m: number): Mat {
  const a: Mat = new Array(n);
  for (let i = 0; i < n; i++) a[i] = new Array<number>(m).fill(0);
  return a;
}
export function identity(n: number): Mat {
  const a = zeros(n, n);
  for (let i = 0; i < n; i++) a[i]![i] = 1;
  return a;
}
export function diag(d: readonly number[]): Mat {
  const a = zeros(d.length, d.length);
  for (let i = 0; i < d.length; i++) a[i]![i] = d[i]!;
  return a;
}
export function transpose(a: Mat): Mat {
  const n = a.length;
  const m = a[0]?.length ?? 0;
  const t = zeros(m, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) t[j]![i] = a[i]![j]!;
  return t;
}
export function matMul(a: Mat, b: Mat): Mat {
  const n = a.length;
  const k = b.length;
  const m = b[0]?.length ?? 0;
  const c = zeros(n, m);
  for (let i = 0; i < n; i++) {
    const ai = a[i]!;
    const ci = c[i]!;
    for (let l = 0; l < k; l++) {
      const v = ai[l]!;
      if (v === 0) continue;
      const bl = b[l]!;
      for (let j = 0; j < m; j++) ci[j]! += v * bl[j]!;
    }
  }
  return c;
}
export function matVec(a: Mat, x: Vec): Vec {
  return a.map((row) => {
    let s = 0;
    for (let j = 0; j < row.length; j++) s += row[j]! * x[j]!;
    return s;
  });
}
export function matAdd(a: Mat, b: Mat): Mat {
  return a.map((row, i) => row.map((v, j) => v + b[i]![j]!));
}
export function matSub(a: Mat, b: Mat): Mat {
  return a.map((row, i) => row.map((v, j) => v - b[i]![j]!));
}
export function vecAdd(a: Vec, b: Vec): Vec {
  return a.map((v, i) => v + b[i]!);
}
export function vecSub(a: Vec, b: Vec): Vec {
  return a.map((v, i) => v - b[i]!);
}
export function dotVec(a: Vec, b: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}
export function copyMat(a: Mat): Mat {
  return a.map((r) => r.slice());
}

/** Inverse by Gauss–Jordan elimination with partial pivoting. Throws on a singular matrix. */
export function inverse(a: Mat): Mat {
  const n = a.length;
  const m = copyMat(a);
  const inv = identity(n);
  for (let c = 0; c < n; c++) {
    let p = c;
    let best = Math.abs(m[c]![c]!);
    for (let r = c + 1; r < n; r++) {
      const v = Math.abs(m[r]![c]!);
      if (v > best) {
        best = v;
        p = r;
      }
    }
    if (!(best > 1e-300)) throw new Error('inverse: singular matrix');
    if (p !== c) {
      [m[p], m[c]] = [m[c]!, m[p]!];
      [inv[p], inv[c]] = [inv[c]!, inv[p]!];
    }
    const d = 1 / m[c]![c]!;
    const mc = m[c]!;
    const ic = inv[c]!;
    for (let j = 0; j < n; j++) {
      mc[j]! *= d;
      ic[j]! *= d;
    }
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r]![c]!;
      if (f === 0) continue;
      const mr = m[r]!;
      const ir = inv[r]!;
      for (let j = 0; j < n; j++) {
        mr[j]! -= f * mc[j]!;
        ir[j]! -= f * ic[j]!;
      }
    }
  }
  return inv;
}

/** Solve A x = b (A square). Throws on a singular matrix. */
export function solve(a: Mat, b: Vec): Vec {
  return matVec(inverse(a), b);
}
