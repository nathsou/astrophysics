import { describe, expect, test } from 'vitest';
import { PAULI, GELL_MANN, generators, element, dagger, mul, identity, sub, normF, det, structureConstants, commutator, trace, scale, add } from './groups.ts';

const close = (a: number, b: number, tol = 1e-12) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe('generators', () => {
  test('numbers of generators are n² − 1 (and 1 for U(1))', () => {
    expect(generators('U1').length).toBe(1);
    expect(generators('SU2').length).toBe(3);
    expect(generators('SU3').length).toBe(8);
  });
  test('Tr(T_a T_b) = δ_ab / 2, traceless, Hermitian', () => {
    for (const g of ['SU2', 'SU3'] as const) {
      const T = generators(g);
      T.forEach((ta, a) => {
        expect(normF(sub(ta, dagger(ta)))).toBeLessThan(1e-14);
        close(trace(ta)[0], 0);
        T.forEach((tb, b) => {
          const tr = trace(mul(ta, tb));
          close(tr[0], a === b ? 0.5 : 0);
          close(tr[1], 0);
        });
      });
    }
  });
});

describe('group elements', () => {
  test('exp(iθ·T) is unitary with determinant one for SU(2) and SU(3); U(1) has unit modulus', () => {
    const th = [0.3, -1.1, 2.0, 0.7, -0.4, 1.3, 0.2, -0.9];
    for (const g of ['SU2', 'SU3'] as const) {
      const U = element(g, th);
      expect(normF(sub(mul(dagger(U), U), identity(U.length)))).toBeLessThan(1e-12);
      const d = det(U);
      close(d[0], 1, 1e-12);
      close(d[1], 0, 1e-12);
    }
    const u = element('U1', [1.234])[0]![0]!;
    close(Math.hypot(u[0], u[1]), 1);
    close(u[0], Math.cos(1.234));
  });
  test('SU(2) elements do not commute; U(1) elements do', () => {
    const a = element('SU2', [1, 0, 0]);
    const b = element('SU2', [0, 1, 0]);
    expect(normF(sub(mul(a, b), mul(b, a)))).toBeGreaterThan(0.1);
    const c = element('U1', [0.5]), d = element('U1', [1.5]);
    expect(normF(sub(mul(c, d), mul(d, c)))).toBeLessThan(1e-15);
  });
  test('a 2π rotation about one axis is −1 in SU(2) (the spinor sign) in the fundamental representation', () => {
    const U = element('SU2', [0, 0, 4 * Math.PI]);
    expect(normF(sub(U, identity(2)))).toBeLessThan(1e-10);
    const V = element('SU2', [0, 0, 2 * Math.PI]);
    expect(normF(sub(V, scale(identity(2), -1)))).toBeLessThan(1e-10);
  });
});

describe('structure constants', () => {
  test('SU(2): f_abc is the Levi-Civita symbol', () => {
    const f = structureConstants('SU2');
    close(f[0]![1]![2]!, 1);
    close(f[1]![2]![0]!, 1);
    close(f[1]![0]![2]!, -1);
    close(f[0]![0]![1]!, 0);
  });
  test('SU(3): the standard non-zero values (Gell-Mann, 1962)', () => {
    const f = structureConstants('SU3');
    close(f[0]![1]![2]!, 1);
    close(f[0]![3]![6]!, 0.5);
    close(f[0]![4]![5]!, -0.5);
    close(f[1]![3]![5]!, 0.5);
    close(f[1]![4]![6]!, 0.5);
    close(f[2]![3]![4]!, 0.5);
    close(f[2]![5]![6]!, -0.5);
    close(f[3]![4]![7]!, Math.sqrt(3) / 2);
    close(f[5]![6]![7]!, Math.sqrt(3) / 2);
    // totally antisymmetric
    close(f[3]![4]![7]!, -f[4]![3]![7]!);
  });
  test('Jacobi identity for SU(3)', () => {
    const T = generators('SU3');
    const j = add(add(commutator(T[0]!, commutator(T[3]!, T[5]!)), commutator(T[3]!, commutator(T[5]!, T[0]!))), commutator(T[5]!, commutator(T[0]!, T[3]!)));
    expect(normF(j)).toBeLessThan(1e-12);
  });
  test('Pauli and Gell-Mann sets have the right sizes', () => {
    expect(PAULI.length).toBe(3);
    expect(GELL_MANN.length).toBe(8);
  });
});
