import { describe, expect, test } from 'vitest';
import { antiprotonThreshold, thresholdKineticFixedTarget, sqrtSFixedTarget, pairThresholdNucleus, pairThresholdElectron, thresholdKineticCollider, REACTIONS } from './threshold.ts';
import { hamiltonian, mul, scale, identity, maxDiff, trace, alpha, beta, add } from './dirac.ts';
import { simulatePet, reconstruct, truthImage, GRID, PHANTOM_DEFAULT } from './pet.ts';
import { rng } from '../../hep/random/index.ts';
import { particle } from '../../hep/particles/index.ts';

describe('thresholds', () => {
  test('p p → p p p p̄ needs a beam kinetic energy of 6 m_p = 5.63 GeV on a fixed target', () => {
    const t = antiprotonThreshold();
    expect(t.fixedTargetKinetic).toBeCloseTo(6 * particle(2212).mass, 12);
    expect(t.fixedTargetKinetic).toBeCloseTo(5.6296, 3);
    // √s at that energy is exactly four proton masses, from four-vectors
    expect(sqrtSFixedTarget(t.mp, t.mp, t.fixedTargetKinetic)).toBeCloseTo(4 * t.mp, 10);
    // a collider needs each beam at 1 m_p of kinetic energy: total 2.14 GeV... no: √s = 4 m_p means E = 2 m_p each, T = m_p each
    expect(t.colliderKineticEach).toBeCloseTo(t.mp, 12);
    expect(t.colliderKineticTotal).toBeCloseTo(1.8765, 3);
  });
  test('pair production: 1.022 MeV on a heavy nucleus, 4 m_e on an electron', () => {
    expect(pairThresholdNucleus(1e9)).toBeCloseTo(2 * 0.51099895e-3, 9);
    expect(pairThresholdNucleus(207.2 * 0.9314941)).toBeGreaterThan(1.0219e-3);
    expect(pairThresholdNucleus(207.2 * 0.9314941)).toBeLessThan(1.0221e-3);
    expect(pairThresholdElectron()).toBeCloseTo(4 * 0.51099895e-3, 12);
    // consistency with the general formula for a massless beam: E_γ = (Σm)² − M²)/(2M)
    const M = 207.2 * 0.9314941, me = particle(11).mass;
    expect(thresholdKineticFixedTarget(0, M, M + 2 * me)).toBeCloseTo(pairThresholdNucleus(M), 12);
  });
  test('every listed reaction has a threshold and √s there equals the final mass', () => {
    for (const r of REACTIONS) {
      const Tft = thresholdKineticFixedTarget(r.beam, r.target, r.finals.reduce((a, b) => a + b, 0));
      expect(Tft).toBeGreaterThan(0);
      const sq = r.beam > 0 ? sqrtSFixedTarget(r.beam, r.target, Tft) : Math.sqrt(r.target * r.target + 2 * r.target * Tft);
      expect(sq).toBeCloseTo(r.finals.reduce((a, b) => a + b, 0), 9);
    }
    expect(thresholdKineticCollider(particle(11).mass, 2 * particle(13).mass)).toBeCloseTo(particle(13).mass - particle(11).mass, 12);
  });
});

describe('Dirac matrices', () => {
  test('H² = (p² + m²)·1 and tr H = 0, so the spectrum is +E twice and −E twice', () => {
    for (const [p, m] of [[[0, 0, 0], 1], [[0.3, -0.4, 1.2], 0.511], [[5, 0, 0], 0]] as [[number, number, number], number][]) {
      const H = hamiltonian(p, m);
      const E2 = p[0] ** 2 + p[1] ** 2 + p[2] ** 2 + m * m;
      expect(maxDiff(mul(H, H), scale(identity(), E2))).toBeLessThan(1e-12);
      expect(Math.hypot(...trace(H))).toBeLessThan(1e-12);
    }
  });
  test('the anticommutation relations', () => {
    const a = [0, 1, 2].map((i) => alpha(i as 0 | 1 | 2));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const ac = add(mul(a[i]!, a[j]!), mul(a[j]!, a[i]!));
      expect(maxDiff(ac, scale(identity(), i === j ? 2 : 0))).toBeLessThan(1e-12);
    }
    for (let i = 0; i < 3; i++) expect(maxDiff(add(mul(a[i]!, beta()), mul(beta(), a[i]!)), scale(identity(), 0))).toBeLessThan(1e-12);
    expect(maxDiff(mul(beta(), beta()), identity())).toBeLessThan(1e-12);
  });
});

describe('the PET toy', () => {
  test('coincidences are detected and the reconstruction finds the hot spots', () => {
    const res = simulatePet({ emitted: 40000 }, rng(3));
    expect(res.coincidences.length).toBeGreaterThan(8000);
    expect(res.coincidences.length).toBeLessThan(40000);
    const truth = truthImage();
    const img = reconstruct(res, 8);
    // the big hot region is at least twice as bright as the background, in the reconstruction
    const pix = 24 / GRID;
    const mean = (pred: (x: number, y: number) => boolean) => {
      let s = 0, n = 0;
      for (let k = 0; k < img.length; k++) {
        const x = -12 + ((k % GRID) + 0.5) * pix, y = -12 + (Math.floor(k / GRID) + 0.5) * pix;
        if (pred(x, y)) { s += img[k]!; n++; }
      }
      return s / n;
    };
    const h = PHANTOM_DEFAULT[0]!;
    const hotMean = mean((x, y) => Math.hypot(x - h.x, y - h.y) < h.r * 0.7);
    const bgMean = mean((x, y) => Math.hypot(x, y) < 9 && PHANTOM_DEFAULT.every((q) => Math.hypot(x - q.x, y - q.y) > q.r + 1.5));
    expect(hotMean / bgMean).toBeGreaterThan(2);
    expect(truth.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
  test('attenuation removes some coincidences', () => {
    const a = simulatePet({ emitted: 5000, attenuation: true }, rng(1));
    const b = simulatePet({ emitted: 5000, attenuation: false }, rng(1));
    expect(a.coincidences.length).toBeLessThan(b.coincidences.length);
  });
});
