import { describe, expect, test } from 'vitest';
import { setOverride } from '../hooks.ts';
import {
  IDENTITY, apply, chromaticity, det, drift, emittanceFromParticles, fft, fodoBetaMax, fodoBetaMin, fodoCell, fodoPhaseAdvance, fodoThin, isStable,
  matrixOf, mul, multiplyInOrder, oneTurnMatrix, opticsAlong, periodicTwiss, phaseSpaceEllipse, quad, repeat, resonanceDistance, resonanceLines,
  sectorDipole, thinLens, thinQuad, trace, trackThroughLattice, tuneFromTurns, tuneOf, beamSigma, geometricEmittance, rfKick, slipDrift, type Element, type Mat2,
} from './optics.ts';
import { LHC, fieldFromMomentum, gradientFromStrength, lhcDipoleAngle, quadStrength } from './fields.ts';
import { lhcArcCellDesign } from './lhcCell.ts';
import { rng, normal } from '../random/index.ts';

describe('transfer matrices', () => {
  test('every element is symplectic (det = 1)', () => {
    const els: Element[] = [
      { kind: 'drift', length: 3.2 }, { kind: 'quad', length: 0.8, k: 0.6 }, { kind: 'quad', length: 0.8, k: -0.6 },
      { kind: 'thinQuad', kl: 0.3 }, { kind: 'dipole', length: 2, angle: 0.1 }, { kind: 'dipole', length: 2, angle: 0.1, n: 0.5 }, { kind: 'sextupole', k2l: 3 },
    ];
    for (const e of els) for (const plane of ['x', 'y'] as const) expect(det(matrixOf(e, plane))).toBeCloseTo(1, 12);
    expect(det(rfKick(0.3))).toBeCloseTo(1, 12);
    expect(det(slipDrift(10, 0.1))).toBeCloseTo(1, 12);
  });
  test('a thick quadrupole tends to a thin lens when it is short', () => {
    const k = 0.5;
    const L = 1e-4;
    const t = quad(k, L);
    const thin = thinQuad(k * L);
    for (let i = 0; i < 4; i++) expect(t[i]).toBeCloseTo(thin[i]!, 3);
  });
  test('a quadrupole focuses in x and defocuses in y', () => {
    expect(quad(0.4, 1, 'x')[2]).toBeLessThan(0);
    expect(quad(0.4, 1, 'y')[2]).toBeGreaterThan(0);
    const [, , cx] = matrixOf({ kind: 'thinQuad', kl: 0.2 }, 'x');
    const [, , cy] = matrixOf({ kind: 'thinQuad', kl: 0.2 }, 'y');
    expect(cx).toBeCloseTo(-cy, 14);
  });
  test('a sector dipole has weak focusing in x and none in y', () => {
    const L = 14.3;
    const rho = 2803.95;
    const M = sectorDipole(L, rho);
    expect(M[0]).toBeCloseTo(Math.cos(L / rho), 12);
    expect(M[1]).toBeCloseTo(rho * Math.sin(L / rho), 9);
    const My = sectorDipole(L, rho, 0, 'y');
    expect(My[0]).toBe(1);
    expect(My[1]).toBeCloseTo(L, 12);
  });
  test('matrix products: the first element acts first', () => {
    const D = drift(2);
    const Q = thinLens(1);
    const both = multiplyInOrder([D, Q]);
    expect(both).toEqual(mul(Q, D));
    const [x, xp] = apply(both, 1, 0);
    expect(x).toBeCloseTo(1, 12);
    expect(xp).toBeCloseTo(-1, 12);
    expect(mul(IDENTITY, D)).toEqual(D);
  });
  test('the longitudinal one-turn matrix reproduces the synchrotron tune', () => {
    // (z, δ): RF kick then slip drift. Tr = 2 − η L slope, so cos μ = 1 − η L slope/2 ≈ 1 − μ²/2.
    const eta = 3e-4, L = 26658.9, slope = 2e-9;
    const M = multiplyInOrder([rfKick(slope), slipDrift(L, eta)]);
    const mu = Math.acos(trace(M) / 2);
    expect(mu).toBeCloseTo(Math.sqrt(eta * L * slope), 4);
  });
});

describe('stability and Twiss parameters', () => {
  test('thin FODO: Tr M = 2 − L²/f², stable for f > L/2', () => {
    const L = 5;
    for (const f of [2.6, 3, 4, 10]) {
      const M = oneTurnMatrix(fodoThin(f, L));
      expect(trace(M)).toBeCloseTo(2 - (L * L) / (f * f), 12);
      expect(isStable(M)).toBe(true);
    }
    expect(isStable(oneTurnMatrix(fodoThin(2.4, L)))).toBe(false);
    expect(isStable(oneTurnMatrix(fodoThin(2.5, L)))).toBe(false); // boundary: Tr = −2
    expect(isStable(oneTurnMatrix(fodoThin(2.6, L)))).toBe(true);
  });
  test('thin FODO: sin(μ/2) = L/2f, β± = L_cell(1 ± sin(μ/2))/sin μ, verified numerically', () => {
    const L = 5;
    const f = 4;
    const cell = fodoThin(f, L);
    const sol = periodicTwiss(oneTurnMatrix(cell));
    expect(sol.stable).toBe(true);
    expect(Math.sin(sol.mu / 2)).toBeCloseTo(L / (2 * f), 12);
    expect(sol.mu).toBeCloseTo(fodoPhaseAdvance(f, L), 12);
    // β at the focusing lens (start of the cell) is the maximum; after the first drift, at the defocusing lens, the minimum.
    expect(sol.beta).toBeCloseTo(fodoBetaMax(f, L), 9);
    const table = opticsAlong(cell, 'x', { maxStep: 0.05 });
    const betaAtQD = table.beta[table.element.lastIndexOf(1)]!; // end of the first drift = at the defocusing lens
    expect(betaAtQD).toBeCloseTo(fodoBetaMin(f, L), 9);
    expect(Math.max(...table.beta)).toBeCloseTo(fodoBetaMax(f, L), 6);
    expect(Math.min(...table.beta)).toBeCloseTo(fodoBetaMin(f, L), 4);
    // γ = (1 + α²)/β and M reproduces the parameters
    expect(sol.gamma).toBeCloseTo((1 + sol.alpha ** 2) / sol.beta, 12);
  });
  test('the periodic Twiss solution survives one more turn', () => {
    const cell = fodoCell({ kF: 0.02, quadLength: 1, gap: 4, nDipoles: 1, dipoleLength: 5, dipoleAngle: 0.05 });
    const M = oneTurnMatrix(cell);
    expect(isStable(M)).toBe(true);
    const t = periodicTwiss(M);
    const [a, b, c, d] = M;
    // M = [[cos μ + α sin μ, β sin μ], [−γ sin μ, cos μ − α sin μ]]
    const sin = Math.sin(t.mu);
    expect(a).toBeCloseTo(Math.cos(t.mu) + t.alpha * sin, 10);
    expect(b).toBeCloseTo(t.beta * sin, 10);
    expect(c).toBeCloseTo(-t.gamma * sin, 10);
    expect(d).toBeCloseTo(Math.cos(t.mu) - t.alpha * sin, 10);
  });
  test('tune of a ring of identical cells, with its integer part', () => {
    const cell = fodoThin(4, 5);
    const ring = repeat(cell, 12);
    const muCell = fodoPhaseAdvance(4, 5);
    expect(tuneOf(ring)).toBeCloseTo((12 * muCell) / (2 * Math.PI), 6);
    expect(tuneOf(ring)).toBeGreaterThan(1);
  });
  test('the LHC arc cell: 106.9 m, 90° phase advance, βmax ≈ 177 m and βmin ≈ 30 m (design report values), gradient about 200 T/m', () => {
    const d = lhcArcCellDesign(90, 7000);
    const len = d.cell.reduce((s, e) => s + ('length' in e ? e.length : 0), 0);
    expect(len).toBeCloseTo(LHC.arcCell.length_m, 6);
    const sol = periodicTwiss(oneTurnMatrix(d.cell));
    expect((sol.mu * 180) / Math.PI).toBeCloseTo(90, 6);
    const table = opticsAlong(d.cell, 'x', { maxStep: 0.5 });
    expect(Math.abs(Math.max(...table.beta) / LHC.arcCell.betaMax_m - 1)).toBeLessThan(0.05);
    expect(Math.abs(Math.min(...table.beta) / LHC.arcCell.betaMin_m - 1)).toBeLessThan(0.08);
    // The gradient that gives exactly 90° in this simplified cell is close to, and below, the 223 T/m quoted as the design peak.
    expect(d.gradient_T_per_m).toBeGreaterThan(180);
    expect(d.gradient_T_per_m).toBeLessThan(LHC.quadGradient7TeV_T_per_m);
    // dipoles in the cell bend by 6 × 5.1 mrad; the arcs close the ring: 1232 dipoles = 2π
    expect(lhcDipoleAngle() * LHC.nDipoles).toBeCloseTo(2 * Math.PI, 12);
  });
  test('an unstable cell reports unstable', () => {
    const M = oneTurnMatrix(fodoThin(1, 5));
    const s = periodicTwiss(M);
    expect(s.stable).toBe(false);
    expect(Number.isNaN(s.beta)).toBe(true);
    expect(Number.isNaN(tuneOf(fodoThin(1, 5)))).toBe(true);
  });
  test('the chromaticity of a FODO ring is negative', () => {
    const ring = repeat(fodoThin(4, 5), 12);
    const xi = chromaticity(ring);
    expect(xi).toBeLessThan(0);
    expect(chromaticity(ring, 'x', 2e-4)).toBeCloseTo(xi, 1);
  });
});

describe('tracking and the tune', () => {
  test('tracking follows the one-turn matrix and conserves the Courant–Snyder invariant', () => {
    const ring = repeat(fodoThin(4, 5), 8);
    const t = periodicTwiss(oneTurnMatrix(ring));
    const { x, xp } = trackThroughLattice(ring, 1e-3, 0, 200);
    expect(x.length).toBe(200);
    expect(x[0]).toBe(1e-3);
    const W = (i: number) => t.gamma * x[i]! ** 2 + 2 * t.alpha * x[i]! * xp[i]! + t.beta * xp[i]! ** 2;
    for (const i of [0, 50, 199]) expect(W(i)).toBeCloseTo(W(0), 14);
  });
  test('tune recovered from turn-by-turn positions (folded) and from x and x′ (full range)', () => {
    for (const f of [3.2, 4, 6]) {
      const ring = repeat(fodoThin(f, 5), 8);
      const Q = tuneOf(ring);
      const qfrac = Q - Math.floor(Q);
      const { x, xp } = trackThroughLattice(ring, 1e-3, 2e-5, 512);
      const folded = qfrac > 0.5 ? 1 - qfrac : qfrac;
      expect(tuneFromTurns(x)).toBeCloseTo(folded, 3);
      expect(tuneFromTurns(x, xp)).toBeCloseTo(qfrac, 3);
    }
  });
  test('tune from a pure cosine', () => {
    const x = Array.from({ length: 300 }, (_, i) => Math.cos(2 * Math.PI * 0.3171 * i + 0.4));
    expect(tuneFromTurns(x)).toBeCloseTo(0.3171, 3);
  });
  test('a sextupole makes the motion nonlinear: large amplitudes get lost or change tune', () => {
    const ring: Element[] = [...repeat(fodoThin(4, 5), 8), { kind: 'sextupole', k2l: 50 }];
    const small = trackThroughLattice(ring, 1e-5, 0, 256);
    const t0 = tuneFromTurns(small.x, small.xp);
    const lin = trackThroughLattice(repeat(fodoThin(4, 5), 8), 1e-5, 0, 256);
    expect(t0).toBeCloseTo(tuneFromTurns(lin.x, lin.xp), 3);
    const big = trackThroughLattice(ring, 0.02, 0, 500);
    expect(big.x.some((v) => !Number.isFinite(v) || Math.abs(v) > 0.05)).toBe(true);
  });
  test('a reader override of the hook is used', () => {
    setOverride('machine.trackThroughLattice', (() => ({ x: [42], xp: [0] })) as never);
    try {
      expect(trackThroughLattice([], 1, 0, 1).x[0]).toBe(42);
    } finally {
      setOverride('machine.trackThroughLattice', undefined);
    }
    expect(trackThroughLattice([{ kind: 'drift', length: 1 }], 1, 0, 1).x[0]).toBe(1);
  });
  test('FFT of a pure tone peaks at its bin', () => {
    const n = 64;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.cos((2 * Math.PI * 5 * i) / n);
    fft(re, im);
    expect(Math.hypot(re[5]!, im[5]!)).toBeCloseTo(n / 2, 9);
    expect(Math.hypot(re[6]!, im[6]!)).toBeLessThan(1e-9);
  });
});

describe('emittance, beam size, resonances', () => {
  test('LHC beam sizes: ε_n = 3.75 µm gives 0.5 nm at 7 TeV, σ* = 16.6 µm at β* = 0.55 m', () => {
    const eps = geometricEmittance(3.75e-6, 7000 / 0.938272);
    expect(eps).toBeCloseTo(0.503e-9, 11);
    expect(beamSigma(eps, 0.55) * 1e6).toBeCloseTo(16.6, 1);
  });
  test('emittance of a matched Gaussian beam equals ε; particles sit on the ellipse', () => {
    const r = rng(7);
    const ring = repeat(fodoThin(4, 5), 8);
    const t = periodicTwiss(oneTurnMatrix(ring));
    const eps = 2e-8;
    const x: number[] = [], xp: number[] = [];
    for (let i = 0; i < 20000; i++) {
      const a = normal(r), b = normal(r);
      const sx = Math.sqrt(eps * t.beta);
      x.push(sx * a);
      xp.push(-(t.alpha / t.beta) * sx * a + Math.sqrt(eps / t.beta) * b);
    }
    expect(emittanceFromParticles(x, xp)).toBeCloseTo(eps, 9 + 0); // within ~1%
    expect(Math.abs(emittanceFromParticles(x, xp) / eps - 1)).toBeLessThan(0.02);
    for (const p of phaseSpaceEllipse(t, eps, 16)) expect(t.gamma * p.x ** 2 + 2 * t.alpha * p.x * p.xp + t.beta * p.xp ** 2).toBeCloseTo(eps, 15);
  });
  test('resonance lines', () => {
    const lines = resonanceLines(3);
    expect(lines.some((l) => l.n === 3 && l.m === 0 && l.p === 1)).toBe(true); // third-integer 3Qx = 1
    expect(lines.some((l) => Math.abs(l.n) === 1 && l.m === 1 && l.p === 0)).toBe(true); // coupling Qx = Qy
    const near = resonanceDistance(0.334, 0.12, 3);
    expect(near.distance).toBeLessThan(0.005);
    const far = resonanceDistance(0.31, 0.32, 1);
    expect(far.distance).toBeGreaterThan(0.29);
  });
  test('rigidity: p = 0.29979 B ρ and the LHC dipole field', () => {
    expect(fieldFromMomentum(7000, LHC.bendingRadius_m)).toBeCloseTo(8.33, 2);
    expect(gradientFromStrength(quadStrength(223, 7000), 7000)).toBeCloseTo(223, 9);
  });
});
