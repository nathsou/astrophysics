/**
 * A tiny explicit Dirac-algebra calculator (4 × 4 complex matrices) used only by the tests to check the matrix element of `zz.ts` against a
 * trace computed numerically, without any closed-form simplification. Metric (+, −, −, −), Dirac representation.
 */
export type C = [number, number];
export type M4 = C[][];

const cadd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const cmul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const zero = (): M4 => Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => [0, 0] as C));
const ident = (): M4 => {
  const m = zero();
  for (let i = 0; i < 4; i++) m[i]![i] = [1, 0];
  return m;
};

export function mul(a: M4, b: M4): M4 {
  const o = zero();
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s: C = [0, 0];
    for (let k = 0; k < 4; k++) s = cadd(s, cmul(a[i]![k]!, b[k]![j]!));
    o[i]![j] = s;
  }
  return o;
}
export const add = (a: M4, b: M4): M4 => a.map((row, i) => row.map((x, j) => cadd(x, b[i]![j]!)));
export const scale = (a: M4, k: number): M4 => a.map((row) => row.map((x) => [x[0] * k, x[1] * k] as C));
/** Hermitian conjugate. */
export const dagger = (a: M4): M4 => a[0]!.map((_, j) => a.map((row) => [row[j]![0], -row[j]![1]] as C));
export const trace = (a: M4): C => a.reduce((s, row, i) => cadd(s, row[i]!), [0, 0] as C);

/** γ^0 … γ^3 and γ^5 in the Dirac representation. */
const sigma = [
  [[[0, 0], [1, 0]], [[1, 0], [0, 0]]],
  [[[0, 0], [0, -1]], [[0, 1], [0, 0]]],
  [[[1, 0], [0, 0]], [[0, 0], [-1, 0]]],
] as unknown as C[][][];
function block(tl: C[][] | null, tr: C[][] | null, bl: C[][] | null, br: C[][] | null): M4 {
  const m = zero();
  const put = (b: C[][] | null, r0: number, c0: number) => {
    if (!b) return;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) m[r0 + i]![c0 + j] = b[i]![j]!;
  };
  put(tl, 0, 0); put(tr, 0, 2); put(bl, 2, 0); put(br, 2, 2);
  return m;
}
const I2: C[][] = [[[1, 0], [0, 0]], [[0, 0], [1, 0]]];
const neg = (b: C[][]): C[][] => b.map((r) => r.map((x) => [-x[0], -x[1]] as C));
export const GAMMA: M4[] = [
  block(I2, null, null, neg(I2)),
  ...sigma.map((s) => block(null, s, neg(s), null)),
];
/** γ⁵ = iγ⁰γ¹γ²γ³. */
export const GAMMA5: M4 = (() => {
  let m = mul(mul(GAMMA[0]!, GAMMA[1]!), mul(GAMMA[2]!, GAMMA[3]!));
  m = m.map((row) => row.map((x) => [-x[1], x[0]] as C)); // × i
  return m;
})();
export const P_L: M4 = scale(add(ident(), scale(GAMMA5, -1)), 0.5);
export const P_R: M4 = scale(add(ident(), GAMMA5), 0.5);
export const METRIC = [1, -1, -1, -1];

/** p-slash = γ^μ p_μ = γ⁰E − γ·p for a four-vector p = (E, px, py, pz). */
export function slash(p: readonly number[]): M4 {
  let m = zero();
  for (let mu = 0; mu < 4; mu++) m = add(m, scale(GAMMA[mu]!, METRIC[mu]! * p[mu]!));
  return m;
}

/**
 * Σ over spins of the quark and antiquark and over the polarisations of the two massive vector bosons of |M|² for
 * q(p1) q̄(p2) → V(k1, m1) V(k2, m2) through t- and u-channel quark exchange, with left-handed vertices γ^μ P_L of unit strength:
 *     M^{μν} = v̄(p₂) [ γ^ν (p̸₁ − k̸₁) γ^μ / t + γ^μ (p̸₁ − k̸₂) γ^ν / u ] P_L u(p₁).
 */
export function sumSquaredLeftHanded(p1: number[], p2: number[], k1: number[], k2: number[]): number {
  const minus = (a: number[], b: number[]) => a.map((x, i) => x - b[i]!);
  const sq = (p: number[]) => p[0]! * p[0]! - p[1]! * p[1]! - p[2]! * p[2]! - p[3]! * p[3]!;
  const q1 = minus(p1, k1), q2 = minus(p1, k2);
  const t = sq(q1), u = sq(q2);
  const m1sq = sq(k1), m2sq = sq(k2);
  const Q1 = slash(q1), Q2 = slash(q2);
  // A[μ][ν]
  const A: M4[][] = [];
  for (let mu = 0; mu < 4; mu++) {
    A.push([]);
    for (let nu = 0; nu < 4; nu++) {
      const a = mul(mul(GAMMA[nu]!, Q1), GAMMA[mu]!);
      const b = mul(mul(GAMMA[mu]!, Q2), GAMMA[nu]!);
      A[mu]!.push(add(scale(a, 1 / t), scale(b, 1 / u)));
    }
  }
  // Ā = γ⁰ A† γ⁰ of the whole vertex structure including the projector: Γ = A P_L, Γ̄ = γ⁰ Γ† γ⁰
  const bar = (m: M4): M4 => mul(mul(GAMMA[0]!, dagger(m)), GAMMA[0]!);
  const P1 = slash(p1), P2 = slash(p2);
  const low = (k: number[]) => k.map((x, i) => METRIC[i]! * x);
  const k1l = low(k1), k2l = low(k2);
  const pol = (kl: number[], msq: number, mu: number, mup: number) => -(mu === mup ? METRIC[mu]! : 0) + (kl[mu]! * kl[mup]!) / msq;
  // the contraction is Tr[p̸₂ Γ^{μν} p̸₁ Γ̄^{μ'ν'}] P_{μμ'}(k1) P_{νν'}(k2)
  const G: M4[][] = A.map((row) => row.map((a) => mul(a, P_L)));
  const Gb: M4[][] = G.map((row) => row.map((g) => bar(g)));
  let total = 0;
  for (let mu = 0; mu < 4; mu++) for (let mup = 0; mup < 4; mup++) {
    const pm = pol(k1l, m1sq, mu, mup);
    if (pm === 0) continue;
    for (let nu = 0; nu < 4; nu++) for (let nup = 0; nup < 4; nup++) {
      const pn = pol(k2l, m2sq, nu, nup);
      if (pn === 0) continue;
      const tr = trace(mul(mul(P2, G[mu]![nu]!), mul(P1, Gb[mup]![nup]!)));
      total += pm * pn * tr[0];
    }
  }
  return total;
}
