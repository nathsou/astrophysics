import { describe, expect, test } from 'vitest';
import { crossSection, luminosity, type Process } from '../gen/index.ts';
import { invariantMass, pt as ptOf } from '../kinematics/index.ts';
import { rng } from '../random/index.ts';
import { G_F, GAMMA_Z, M_Z, zCouplings } from '../sm/index.ts';
import { HBARC2_GEV2_PB } from '../units/index.ts';
import { sumSquaredLeftHanded } from './dirac.ts';
import { dsigmaDcos, zMassDensity, zzForm, zzStarProcess } from './zz.ts';

describe('the ZZ* matrix element', () => {
  test('F equals the explicit Dirac trace (Σ|M|² = 4 g⁴ F for a left-handed vertex) for equal and unequal masses', () => {
    for (const [rs, m1, m2, c] of [[300, 91.19, 91.19, 0.3], [150, 91.19, 20, -0.5], [200, 60, 30, 0.8], [130, 91, 30, 0.1], [125, 70, 40, -0.9]] as const) {
      const s = rs * rs;
      const p1 = [rs / 2, 0, 0, rs / 2], p2 = [rs / 2, 0, 0, -rs / 2];
      const E1 = (s + m1 * m1 - m2 * m2) / (2 * rs);
      const k = Math.sqrt(E1 * E1 - m1 * m1);
      const sn = Math.sqrt(1 - c * c);
      const k1 = [E1, k * sn, 0, k * c];
      const k2 = [rs - E1, -k * sn, 0, -k * c];
      const t = m1 * m1 - (s + m1 * m1 - m2 * m2) / 2 + ((2 * rs * k) / 2) * c;
      const u = m2 * m2 - (s + m2 * m2 - m1 * m1) / 2 - ((2 * rs * k) / 2) * c;
      const F = zzForm(s, t, u, m1 * m1, m2 * m2);
      expect(sumSquaredLeftHanded(p1, p2, k1, k2) / (4 * F)).toBeCloseTo(1, 10);
    }
  });

  test('the Z mass density integrates to the branching fraction of Z → e⁺e⁻ + μ⁺μ⁻ (6.7 %)', () => {
    // ∫ over a very wide range by the tangent substitution m² = M² + MΓ tan θ
    const a = Math.atan((1 - M_Z * M_Z) / (M_Z * GAMMA_Z)), b = Math.atan((1e8 - M_Z * M_Z) / (M_Z * GAMMA_Z));
    let s = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const th = a + ((b - a) * (i + 0.5)) / n;
      const m2 = M_Z * M_Z + M_Z * GAMMA_Z * Math.tan(th);
      s += zMassDensity(m2) * ((M_Z * GAMMA_Z) / Math.cos(th) ** 2) * ((b - a) / n);
    }
    expect(s).toBeGreaterThan(0.066);
    expect(s).toBeLessThan(0.0675);
  });
});

describe('the ZZ* process', () => {
  const proc: Process = zzStarProcess({ lo: 100, hi: 160 });

  test('events are four leptons with invariant mass inside the window, two Z’s of the right mass distribution, and the momentum is conserved', () => {
    const r = rng(11);
    const heavy: number[] = [];
    for (let i = 0; i < 400; i++) {
      const { event } = proc.generate(r, { sqrtS: 13600 });
      const leptons = event.particles.filter((p) => p.status === 'final');
      expect(leptons).toHaveLength(4);
      const total = leptons.reduce((t, p) => ({ E: t.E + p.p.E, px: t.px + p.p.px, py: t.py + p.p.py, pz: t.pz + p.p.pz }), { E: 0, px: 0, py: 0, pz: 0 });
      const m = Math.sqrt(total.E ** 2 - total.px ** 2 - total.py ** 2 - total.pz ** 2);
      expect(m).toBeGreaterThan(99.9);
      expect(m).toBeLessThan(160.1);
      // the two partons carry the momentum: the transverse part cancels
      expect(Math.hypot(total.px, total.py)).toBeLessThan(1e-6);
      const z = event.particles.filter((p) => p.pdg === 23).map((p) => invariantMass([p.p]));
      heavy.push(Math.max(...z));
      // flavour: e or μ, opposite charges in each pair
      const flav = leptons.map((p) => p.pdg);
      expect(flav.every((f) => Math.abs(f) === 11 || Math.abs(f) === 13)).toBe(true);
      expect(flav.reduce((s, f) => s + Math.sign(f), 0)).toBe(0);
    }
    heavy.sort((a, b) => a - b);
    // below 2 m_Z one boson is nearly on shell and the other off shell: the heavier one sits near 91 GeV
    expect(heavy[200]!).toBeGreaterThan(85);
    expect(heavy[200]!).toBeLessThan(94);
    void ptOf;
  });

  test('narrow-width check: above 2 m_Z the cross-section is within 25 % of Σ_q ∫ dτ dL/dτ σ̂(ZZ) × BR², with the parton luminosity from hep/gen', () => {
    const sqrtS = 13000;
    const lo = 200, hi = 800;
    const p = zzStarProcess({ lo, hi });
    const mc = crossSection(p, sqrtS, 40000, rng(3)).sigma; // pb
    // on-shell estimate: σ = Σ_q ∫ dτ (dL/dτ) · ½ ∫ dcosθ dσ̂/dcosθ(ŝ = τ s; m₁ = m₂ = M) × BR²
    const BR2 = (0.0336 * 2) ** 2;
    let total = 0;
    const nTau = 400;
    const tauLo = (lo / sqrtS) ** 2, tauHi = (hi / sqrtS) ** 2;
    for (let i = 0; i < nTau; i++) {
      // integrate in ln τ
      const lnTau = Math.log(tauLo) + ((Math.log(tauHi) - Math.log(tauLo)) * (i + 0.5)) / nTau;
      const tau = Math.exp(lnTau);
      const dlnTau = (Math.log(tauHi) - Math.log(tauLo)) / nTau;
      const s = tau * sqrtS * sqrtS;
      let sigmaHat = 0;
      for (const q of [1, 2, 3, 4, 5]) {
        let ang = 0;
        const nC = 200;
        for (let j = 0; j < nC; j++) ang += (dsigmaDcos(q, s, M_Z * M_Z, M_Z * M_Z, -1 + (2 * (j + 0.5)) / nC) * 2) / nC;
        const lum = luminosity(tau, Math.sqrt(s), [[q, -q], [-q, q]]);
        sigmaHat += 0.5 * ang * lum;
      }
      total += sigmaHat * HBARC2_GEV2_PB * tau * dlnTau;
    }
    const nw = total * BR2;
    expect(mc / nw).toBeGreaterThan(0.75);
    expect(mc / nw).toBeLessThan(1.25);
  });

  test('the leading-order total σ(pp → ZZ) is of the order of ten picobarns at 13 TeV (on-shell Z’s: the window above 2 m_Z divided by BR², plus the off-shell tail)', () => {
    const p = zzStarProcess({ lo: 183, hi: 6500 });
    const sigma = crossSection(p, 13000, 40000, rng(4)).sigma;
    const total = sigma / (0.0336 * 2) ** 2;
    expect(total).toBeGreaterThan(6);
    expect(total).toBeLessThan(16);
    void zCouplings;
    void G_F;
  });
});
