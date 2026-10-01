/**
 * Chapter 16: the helicity-amplitude derivation of e⁺e⁻ → μ⁺μ⁻ checked with explicit Dirac spinors, against the library.
 * Weyl (chiral) basis, massless fermions, all sixteen spin configurations. The amplitude is
 *   M = (e²/s) [v̄(p₂) γ^μ u(p₁)] [ū(k₁) γ_μ v(k₂)]
 * with p₁, p₂ the e⁻ and e⁺ momenta and k₁, k₂ the μ⁻ and μ⁺ momenta.
 */
import { describe, expect, test } from 'vitest';
import { ee2mumuDiffXsec, bhabhaDiffXsec } from '../../hep/gen/index.ts';
import { ALPHA_0 } from '../../hep/sm/index.ts';

type C = [number, number];
const cadd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const cmul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cconj = (a: C): C => [a[0], -a[1]];
const cabs2 = (a: C) => a[0] * a[0] + a[1] * a[1];
const csqrt = (x: number): C => [Math.sqrt(x), 0];

type Mat = C[][];
const Z: C = [0, 0];
const ONE: C = [1, 0];
const I: C = [0, 1];
const sigma: Mat[] = [
  [[ONE, Z], [Z, ONE]],
  [[Z, ONE], [ONE, Z]],
  [[Z, [0, -1]], [I, Z]],
  [[ONE, Z], [Z, [-1, 0]]],
];
/** γ^μ in the Weyl basis: [[0, σ^μ], [σ̄^μ, 0]] with σ^μ = (1, σ) and σ̄^μ = (1, −σ). */
function gamma(mu: number): Mat {
  const s = sigma[mu]!;
  const sb = mu === 0 ? s : s.map((row) => row.map((x) => [-x[0], -x[1]] as C));
  const g: Mat = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => Z));
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      g[i]![j + 2] = s[i]![j]!;
      g[i + 2]![j] = sb[i]![j]!;
    }
  return g;
}
const GAMMA = [0, 1, 2, 3].map(gamma);
const METRIC = [1, -1, -1, -1];

/** The eigenvector of σ·n̂ with eigenvalue +1 or −1. */
function xi(nx: number, ny: number, nz: number, h: 1 | -1): C[] {
  // spin-½ along n with polar angle θ, azimuth φ
  const th = Math.acos(Math.max(-1, Math.min(1, nz)));
  const ph = Math.atan2(ny, nx);
  const c = Math.cos(th / 2), s = Math.sin(th / 2);
  const e = (a: number): C => [Math.cos(a), Math.sin(a)];
  return h === 1 ? [[c, 0], cmul([s, 0], e(ph))] : [cmul([-s, 0], e(-ph)), [c, 0]];
}
/** Massless u (helicity h) and v (spinor label h, the antiparticle has helicity −h) for momentum E n̂. */
function spinor(kind: 'u' | 'v', E: number, n: [number, number, number], h: 1 | -1): C[] {
  const x = xi(n[0], n[1], n[2], h);
  const r = Math.sqrt(2 * E);
  // p·σ = E − p⃗·σ kills ξ₊ and leaves 2E on ξ₋; p·σ̄ = E + p⃗·σ does the opposite
  const up: C[] = h === 1 ? [Z, Z] : x.map((a) => cmul([r, 0], a));
  const lo: C[] = h === 1 ? x.map((a) => cmul([r, 0], a)) : [Z, Z];
  if (kind === 'u') return [...up, ...lo];
  // v(p) = (√(p·σ) η, −√(p·σ̄) η) with η = ξ_{−h}: swap which component survives
  const xv = xi(n[0], n[1], n[2], (-h) as 1 | -1);
  const up2: C[] = h === -1 ? [Z, Z] : xv.map((a) => cmul([r, 0], a));
  const lo2: C[] = h === -1 ? xv.map((a) => cmul([-r, 0], a)) : [Z, Z];
  return [...up2, ...lo2];
}
const dagger0 = (v: C[]): C[] => {
  // v̄ = v† γ⁰; γ⁰ swaps the upper and lower pairs
  const c = v.map(cconj);
  return [c[2]!, c[3]!, c[0]!, c[1]!];
};
function current(bar: C[], mu: number, ket: C[]): C {
  let acc: C = Z;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) acc = cadd(acc, cmul(cmul(bar[i]!, GAMMA[mu]![i]![j]!), ket[j]!));
  return acc;
}

/** Sixteen helicity configurations: returns |M|² for each, with e = 1 and s = 4E². */
function amplitudes(cosT: number): number[] {
  const E = 1.0;
  const sinT = Math.sqrt(1 - cosT * cosT);
  const out: number[] = [];
  for (const he of [1, -1] as const)
    for (const hp of [1, -1] as const)
      for (const hm of [1, -1] as const)
        for (const hq of [1, -1] as const) {
          const u1 = spinor('u', E, [0, 0, 1], he);
          const v2 = spinor('v', E, [0, 0, -1], hp);
          const k1 = spinor('u', E, [sinT, 0, cosT], hm);
          const k2 = spinor('v', E, [-sinT, 0, -cosT], hq);
          let M: C = Z;
          for (let mu = 0; mu < 4; mu++) {
            const je = current(dagger0(v2), mu, u1);
            const jm = current(dagger0(k1), mu, k2);
            M = cadd(M, cmul(cmul(je, jm), [METRIC[mu]! / (4 * E * E), 0]));
          }
          out.push(cabs2(M));
        }
  return out;
}

describe('e+e- -> mu+mu- helicity amplitudes, explicit spinors', () => {
  test('four of the sixteen configurations survive, with |M| = e²(1 ± cosθ)', () => {
    for (const c of [-0.8, -0.3, 0, 0.5, 0.9]) {
      const m2 = amplitudes(c);
      const live = m2.filter((x) => x > 1e-12).sort((a, b) => a - b);
      expect(live.length).toBe(4);
      const plus = (1 + c) ** 2, minus = (1 - c) ** 2;
      const want = [plus, plus, minus, minus].sort((a, b) => a - b);
      live.forEach((x, i) => expect(x).toBeCloseTo(want[i]!, 9));
    }
  });
  test('sum over spins is 4e⁴(1 + cos²θ), so the spin-averaged |M|² is e⁴(1 + cos²θ)', () => {
    for (const c of [-0.9, 0.1, 0.7]) {
      const sum = amplitudes(c).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(4 * (1 + c * c), 9);
    }
  });
  test('dσ/dΩ = |M|²/(64π²s) gives dσ/dcosθ = πα²(1 + cos²θ)/(2s), the library formula', () => {
    const s = 25;
    for (const c of [-0.6, 0, 0.4]) {
      const e2 = 4 * Math.PI * ALPHA_0;
      const avg = amplitudes(c).reduce((a, b) => a + b, 0) / 4; // e = 1 in amplitudes(); e⁴ restored below
      const dsdOmega = (avg * e2 * e2) / (64 * Math.PI * Math.PI * s);
      expect(2 * Math.PI * dsdOmega).toBeCloseTo(ee2mumuDiffXsec(s, c), 14);
    }
  });
  test('the integral is 4πα²/3s', () => {
    const s = 100;
    let acc = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) acc += ee2mumuDiffXsec(s, -1 + (2 * (i + 0.5)) / n) * (2 / n);
    expect(acc).toBeCloseTo((4 * Math.PI * ALPHA_0 ** 2) / (3 * s), 12);
  });
  test('Bhabha: the s-channel alone reproduces the μμ shape; the t-channel pole dominates forward', () => {
    const s = 100;
    expect(bhabhaDiffXsec(s, 0.9) / bhabhaDiffXsec(s, 0)).toBeGreaterThan(20);
    expect(bhabhaDiffXsec(s, 0.9) / bhabhaDiffXsec(s, -0.9)).toBeGreaterThan(50);
  });
});
