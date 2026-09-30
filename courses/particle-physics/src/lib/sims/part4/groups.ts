/**
 * Chapter 17: U(1), SU(2) and SU(3) as groups of matrices, their generators and commutators, computed numerically.
 * Complex matrices as arrays of [re, im] pairs; small sizes only (1, 2 and 3), so the code is plain loops.
 */
export type Cx = [number, number];
export type CMat = Cx[][];

export const cadd = (a: Cx, b: Cx): Cx => [a[0] + b[0], a[1] + b[1]];
export const cmul = (a: Cx, b: Cx): Cx => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export const cscale = (a: Cx, k: number): Cx => [a[0] * k, a[1] * k];
export const cconj = (a: Cx): Cx => [a[0], -a[1]];

export const zeros = (n: number): CMat => Array.from({ length: n }, () => Array.from({ length: n }, () => [0, 0] as Cx));
export const identity = (n: number): CMat => zeros(n).map((row, i) => row.map((_, j) => (i === j ? ([1, 0] as Cx) : ([0, 0] as Cx))));
export const mat = (rows: (number | Cx)[][]): CMat => rows.map((r) => r.map((x) => (typeof x === 'number' ? ([x, 0] as Cx) : x)));

export function mul(a: CMat, b: CMat): CMat {
  const n = a.length;
  const out = zeros(n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) out[i]![j] = cadd(out[i]![j]!, cmul(a[i]![k]!, b[k]![j]!));
  return out;
}
export const add = (a: CMat, b: CMat): CMat => a.map((r, i) => r.map((x, j) => cadd(x, b[i]![j]!)));
export const sub = (a: CMat, b: CMat): CMat => a.map((r, i) => r.map((x, j) => [x[0] - b[i]![j]![0], x[1] - b[i]![j]![1]] as Cx));
export const scale = (a: CMat, k: Cx | number): CMat => a.map((r) => r.map((x) => cmul(x, typeof k === 'number' ? [k, 0] : k)));
export const dagger = (a: CMat): CMat => a.map((_, i) => a.map((__, j) => cconj(a[j]![i]!)));
export const trace = (a: CMat): Cx => a.reduce((acc, r, i) => cadd(acc, r[i]!), [0, 0] as Cx);
export const commutator = (a: CMat, b: CMat): CMat => sub(mul(a, b), mul(b, a));
export const normF = (a: CMat): number => Math.sqrt(a.reduce((s, r) => s + r.reduce((t, x) => t + x[0] * x[0] + x[1] * x[1], 0), 0));

/** exp(A) by scaling and squaring with a Taylor series. */
export function expm(a: CMat): CMat {
  const n = a.length;
  const nrm = normF(a);
  const s = Math.max(0, Math.ceil(Math.log2(Math.max(nrm, 1e-16) / 0.5)));
  const small = scale(a, 1 / 2 ** s);
  let term = identity(n);
  let sum = identity(n);
  for (let k = 1; k < 24; k++) {
    term = scale(mul(term, small), 1 / k);
    sum = add(sum, term);
  }
  for (let i = 0; i < s; i++) sum = mul(sum, sum);
  return sum;
}

/** The determinant, for 1×1, 2×2 and 3×3 matrices. */
export function det(a: CMat): Cx {
  const n = a.length;
  if (n === 1) return a[0]![0]!;
  if (n === 2) return cadd(cmul(a[0]![0]!, a[1]![1]!), cscale(cmul(a[0]![1]!, a[1]![0]!), -1));
  const m = (i: number, j: number) => a[i]![j]!;
  const c = (i: number, j: number, k: number, l: number) => cadd(cmul(m(i, j), m(k, l)), cscale(cmul(m(i, l), m(k, j)), -1));
  let d: Cx = [0, 0];
  d = cadd(d, cmul(m(0, 0), c(1, 1, 2, 2)));
  d = cadd(d, cscale(cmul(m(0, 1), c(1, 0, 2, 2)), -1));
  d = cadd(d, cmul(m(0, 2), c(1, 0, 2, 1)));
  return d;
}

const i1: Cx = [0, 1];
const mi: Cx = [0, -1];

/** Pauli matrices σ₁, σ₂, σ₃. */
export const PAULI: CMat[] = [mat([[0, 1], [1, 0]]), mat([[0, mi], [i1, 0]]), mat([[1, 0], [0, -1]])];

/** Gell-Mann matrices λ₁ … λ₈. */
export const GELL_MANN: CMat[] = [
  mat([[0, 1, 0], [1, 0, 0], [0, 0, 0]]),
  mat([[0, mi, 0], [i1, 0, 0], [0, 0, 0]]),
  mat([[1, 0, 0], [0, -1, 0], [0, 0, 0]]),
  mat([[0, 0, 1], [0, 0, 0], [1, 0, 0]]),
  mat([[0, 0, mi], [0, 0, 0], [i1, 0, 0]]),
  mat([[0, 0, 0], [0, 0, 1], [0, 1, 0]]),
  mat([[0, 0, 0], [0, 0, mi], [0, i1, 0]]),
  scale(mat([[1, 0, 0], [0, 1, 0], [0, 0, -2]]), 1 / Math.sqrt(3)),
];

export type GroupName = 'U1' | 'SU2' | 'SU3';

/** The generators T_a in the fundamental representation, normalised to Tr(T_a T_b) = δ_ab/2 (for U(1): the charge 1). */
export function generators(g: GroupName): CMat[] {
  if (g === 'U1') return [mat([[1]])];
  if (g === 'SU2') return PAULI.map((s) => scale(s, 0.5));
  return GELL_MANN.map((l) => scale(l, 0.5));
}

/** A group element exp(i Σ θ_a T_a). */
export function element(g: GroupName, theta: number[]): CMat {
  const T = generators(g);
  let h = zeros(T[0]!.length);
  T.forEach((t, a) => (h = add(h, scale(t, theta[a] ?? 0))));
  return expm(scale(h, [0, 1]));
}

/** Structure constants f_abc from [T_a, T_b] = i f_abc T_c, using Tr(T_c T_d) = δ_cd/2: f_abc = −2i Tr([T_a, T_b] T_c). */
export function structureConstants(g: GroupName): number[][][] {
  const T = generators(g);
  const N = T.length;
  const f = Array.from({ length: N }, () => Array.from({ length: N }, () => new Array<number>(N).fill(0)));
  for (let a = 0; a < N; a++)
    for (let b = 0; b < N; b++) {
      const comm = commutator(T[a]!, T[b]!);
      for (let c = 0; c < N; c++) {
        const tr = trace(mul(comm, T[c]!));
        // f = −2i tr → real part of (−2i)(x + iy) = 2y
        f[a]![b]![c] = 2 * tr[1];
      }
    }
  return f;
}

/** The decomposition of [T_a, T_b] as i Σ f_abc T_c: the non-zero (c, f) pairs. */
export function commutatorTerms(g: GroupName, a: number, b: number): { c: number; f: number }[] {
  const f = structureConstants(g)[a]![b]!;
  return f.map((x, c) => ({ c, f: x })).filter((t) => Math.abs(t.f) > 1e-12);
}
