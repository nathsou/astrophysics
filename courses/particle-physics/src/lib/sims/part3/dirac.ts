/**
 * Dirac's equation in matrices (Chapter 9): the 4×4 Hamiltonian H = α·p + β m, built from the Pauli matrices, for checking that
 * H² = (p² + m²)·1 and that the spectrum is ±E, each twice. Complex numbers are pairs [re, im].
 */
export type C = [number, number];
export type M4 = C[][];

const z: C = [0, 0];
const one: C = [1, 0];
const cm = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const ca = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const cs = (a: C, k: number): C => [a[0] * k, a[1] * k];

/** The three Pauli matrices. */
export const PAULI: C[][][] = [
  [[z, one], [one, z]],
  [[z, [0, -1]], [[0, 1], z]],
  [[one, z], [z, [-1, 0]]],
];

function block(a: C[][], b: C[][], c: C[][], d: C[][]): M4 {
  return [
    [a[0]![0]!, a[0]![1]!, b[0]![0]!, b[0]![1]!],
    [a[1]![0]!, a[1]![1]!, b[1]![0]!, b[1]![1]!],
    [c[0]![0]!, c[0]![1]!, d[0]![0]!, d[0]![1]!],
    [c[1]![0]!, c[1]![1]!, d[1]![0]!, d[1]![1]!],
  ];
}
const I2: C[][] = [[one, z], [z, one]];
const O2: C[][] = [[z, z], [z, z]];
const neg = (m: C[][]): C[][] => m.map((r) => r.map((x) => cs(x, -1)));

/** α_i = [[0, σ_i], [σ_i, 0]] */
export const alpha = (i: 0 | 1 | 2): M4 => block(O2, PAULI[i]!, PAULI[i]!, O2);
/** β = [[1, 0], [0, −1]] in 2×2 blocks */
export const beta = (): M4 => block(I2, O2, O2, neg(I2));

export function mul(a: M4, b: M4): M4 {
  return a.map((row, i) => b[0]!.map((_, j) => row.reduce<C>((s, _x, k) => ca(s, cm(a[i]![k]!, b[k]![j]!)), z)));
}
export const add = (a: M4, b: M4): M4 => a.map((r, i) => r.map((x, j) => ca(x, b[i]![j]!)));
export const scale = (a: M4, k: number): M4 => a.map((r) => r.map((x) => cs(x, k)));
export const identity = (): M4 => [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j): C => (i === j ? one : z)));
export const trace = (a: M4): C => a.reduce<C>((s, r, i) => ca(s, r[i]!), z);
export const maxDiff = (a: M4, b: M4): number => Math.max(...a.flatMap((r, i) => r.map((x, j) => Math.hypot(x[0] - b[i]![j]![0], x[1] - b[i]![j]![1]))));

/** H = α·p + β m */
export function hamiltonian(p: [number, number, number], m: number): M4 {
  let h = scale(beta(), m);
  for (let i = 0; i < 3; i++) h = add(h, scale(alpha(i as 0 | 1 | 2), p[i]!));
  return h;
}
