import { describe, expect, test } from 'vitest';
import { eeToFermions } from '$lib/hep/gen';
import { M_Z, zWidths } from '$lib/hep/sm';
import {
  GAMMA_NU, SCAN, expectedCounts, fitAtFixedN, fitLineshape, neutrinoNumber, poleCrossSectionNb, pseudoData, sigmaHad, visiblePeakNb, zWidthFor, zWidthSummary,
} from './lineshape';
import { build, GRID } from './makeLineshapeTable';
import { TABLE } from './lineshapeTable';

describe('the lineshape table', () => {
  test('the stored table is what the generator gives (spot checks)', () => {
    const rows = build();
    for (const [r, c] of [[2, 20], [4, 20], [6, 5], [3, 30]] as const) expect(TABLE[r]![c]).toBeCloseTo(rows[r]![c]!, 4);
    expect(TABLE.length).toBe(GRID.nn);
  });
  test('interpolation reproduces a direct calculation at off-grid points to 1 part in 10³', () => {
    for (const [E, N] of [[91.37, 2.3], [90.11, 3.0], [92.83, 3.7], [88.9, 4.2]] as const) {
      const p = eeToFermions({ final: 'hadrons', qcd: true, zWidth: zWidthFor(N) });
      const direct = p.sigmaISR(E) / 1000;
      expect(Math.abs(sigmaHad(E, N) / direct - 1)).toBeLessThan(1e-3);
    }
  });
  test('initial-state radiation LOWERS the peak: about 30 nb visible, 41 nb without it', () => {
    const peak = visiblePeakNb(3);
    expect(peak).toBeGreaterThan(29.5);
    expect(peak).toBeLessThan(31);
    const born = eeToFermions({ final: 'hadrons', qcd: true }).sigma(M_Z) / 1000;
    expect(born).toBeGreaterThan(40);
    expect(peak / born).toBeGreaterThan(0.72);
    expect(peak / born).toBeLessThan(0.76);
  });
  test('each extra species lowers and broadens the peak', () => {
    const p2 = visiblePeakNb(2), p3 = visiblePeakNb(3), p4 = visiblePeakNb(4);
    expect(p2).toBeGreaterThan(p3);
    expect(p3).toBeGreaterThan(p4);
    expect(p2 / p3).toBeGreaterThan(1.1);
    expect(p2 / p3).toBeLessThan(1.16);
  });
});

describe('the widths', () => {
  test('Γ_νν is 165.9 MeV at leading order and Γ_inv = 3 Γ_νν', () => {
    expect(GAMMA_NU * 1000).toBeCloseTo(165.88, 1);
    expect(zWidths().invisible).toBeCloseTo(3 * GAMMA_NU, 10);
  });
  test('width of the Z for N species: one species is 0.166 GeV', () => {
    expect(zWidthFor(4) - zWidthFor(3)).toBeCloseTo(0.16588, 4);
    expect(zWidthFor(3)).toBeCloseTo(2.4955, 6);
  });
  test('the LO summary: Γ_Z = 2.48 GeV with the QCD factor, R_ℓ = 20.8', () => {
    const s = zWidthSummary();
    expect(s.total).toBeCloseTo(2.4807, 3);
    expect(s.hadronic / s.perLepton).toBeGreaterThan(20.7);
    expect(s.hadronic / s.perLepton).toBeLessThan(20.9);
  });
  test('the published pole numbers give N_ν = 2.98 to 2.99 by the textbook formula', () => {
    const N = neutrinoNumber(41.541, 20.767);
    expect(N).toBeGreaterThan(2.97);
    expect(N).toBeLessThan(2.995);
  });
  test('σ⁰_had from LO widths is 41.4 nb (no radiation)', () => {
    const w = zWidths({ qcd: true });
    expect(poleCrossSectionNb(w.byFlavour.e!, w.hadronic, w.total)).toBeCloseTo(41.46, 1);
  });
});

describe('pseudo-data and the fit', () => {
  test('the seven scan points and a peak of millions of events', () => {
    expect(SCAN.length).toBe(7);
    const mu = expectedCounts(3);
    expect(mu[3]!).toBeGreaterThan(9e6);
    expect(mu.reduce((a, b) => a + b, 0)).toBeGreaterThan(1.4e7);
    expect(mu.reduce((a, b) => a + b, 0)).toBeLessThan(1.8e7);
  });
  test('pseudo-data are reproducible', () => {
    expect(pseudoData(3).counts).toEqual(pseudoData(3).counts);
    expect(pseudoData(3).counts).not.toEqual(pseudoData(4).counts);
  });
  test('the fit finds N_ν = 3 within its error with a known luminosity, and with the normalisation free', () => {
    const d = pseudoData(21);
    const f = fitLineshape(d.counts);
    expect(f.converged).toBe(true);
    expect(Math.abs(f.N - 3)).toBeLessThan(4 * f.dN);
    expect(f.dN).toBeLessThan(0.01);
    expect(f.chi2 / f.ndf).toBeLessThan(3);
    const g = fitLineshape(d.counts, { freeNorm: true });
    expect(Math.abs(g.N - 3)).toBeLessThan(4 * g.dN);
    expect(g.dN).toBeGreaterThan(f.dN);
  });
  test('N = 2 and N = 4 are excluded by hundreds of standard deviations in χ²', () => {
    const d = pseudoData(22);
    const best = fitAtFixedN(d.counts, 3).chi2;
    for (const N of [2, 4]) expect(fitAtFixedN(d.counts, N).chi2 - best).toBeGreaterThan(1e4);
  });
  test('a 0.1 % luminosity error moves N_ν by about 0.007, as large as the quoted total uncertainty', () => {
    // a luminosity that is 0.1 % too small: fixed g so the shift is deterministic
    const mu = expectedCounts(3, 0, 1.001);
    const f = fitLineshape(mu.map((m) => Math.round(m)));
    expect(f.N - 3).toBeGreaterThan(-0.011);
    expect(f.N - 3).toBeLessThan(-0.004);
  });
});
