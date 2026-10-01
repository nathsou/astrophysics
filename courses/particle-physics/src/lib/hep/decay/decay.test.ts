import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import type { TruthEvent, TruthParticle } from '../event/index.ts';
import { allParticles, particle, quantumNumbers } from '../particles/index.ts';
import { fromMass, invariantMass, mass, phaseSpace, pmag, sum, type P4 } from '../kinematics/index.ts';
import {
  decayAll, decayHeavy, decayParticle, DEFAULT_MAX_PROPER_CTAU_MM, isResonance, meanDecayLengthMm, minMass, properCtauMm, sampleMass, uniformPhaseSpace, wouldDecay,
} from './index.ts';

function single(pdg: number, px = 0, py = 0, pz = 0, m?: number): TruthEvent {
  const mm = m ?? particle(pdg).mass;
  const p = fromMass(mm, px, py, pz);
  const t: TruthParticle = { id: 0, pdg, p, vertex: [0, 0, 0], status: 'final', mothers: [], daughters: [] };
  return { number: 0, weight: 1, process: 'test', sqrtS: 0, particles: [t], primaryVertices: [[0, 0, 0]] };
}
const finals = (ev: TruthEvent): TruthParticle[] => ev.particles.filter((p) => p.status === 'final');
const totalP = (ps: TruthParticle[]): P4 => sum(ps.map((p) => p.p));

describe('the particle table itself', () => {
  test('every decay mode conserves charge, baryon number and lepton numbers', () => {
    for (const p0 of allParticles()) {
      for (const s of [1, -1]) {
        if (s < 0 && p0.selfConjugate) continue;
        const p = particle(s * p0.pdg);
        const q0 = quantumNumbers([p.pdg]);
        for (const d of p.decays) {
          const q = quantumNumbers(d.products);
          expect(q.charge3, `${p.name} → ${d.products}`).toBe(q0.charge3);
          expect(q.baryon3, `${p.name} → ${d.products}`).toBe(q0.baryon3);
          expect(q.lepton, `${p.name} → ${d.products}`).toEqual(q0.lepton);
        }
      }
    }
  });
});

describe('decayAll conserves four-momentum, charge, baryon number and lepton number', () => {
  test('every particle with a decay, at rest and in flight, with everything forced to decay', () => {
    const r = rng(11);
    for (const p0 of allParticles()) {
      if (p0.decays.length === 0) continue;
      for (const s of [1, -1]) {
        if (s < 0 && p0.selfConjugate) continue;
        const pdg = s * p0.pdg;
        for (const boostP of [0, 7.3]) {
          const ev = single(pdg, boostP * 0.6, boostP * 0.3, boostP * 0.74);
          const p0v = { ...ev.particles[0]!.p };
          decayAll(ev, r, { maxCtauMm: Infinity, partons: 'leave' });
          const fin = finals(ev);
          expect(fin.length, particle(pdg).name).toBeGreaterThanOrEqual(1);
          const tot = totalP(fin);
          const scale = Math.max(1, p0v.E);
          expect(Math.abs(tot.E - p0v.E) / scale, `${particle(pdg).name} E`).toBeLessThan(1e-9);
          expect(Math.abs(tot.px - p0v.px) / scale).toBeLessThan(1e-9);
          expect(Math.abs(tot.py - p0v.py) / scale).toBeLessThan(1e-9);
          expect(Math.abs(tot.pz - p0v.pz) / scale).toBeLessThan(1e-9);
          const q0 = quantumNumbers([pdg]);
          const q = quantumNumbers(fin.map((p) => p.pdg));
          expect(q.charge3, particle(pdg).name).toBe(q0.charge3);
          expect(q.baryon3, particle(pdg).name).toBe(q0.baryon3);
          expect(q.lepton, particle(pdg).name).toEqual(q0.lepton);
        }
      }
    }
  });

  test('the decay tree is a proper record: mothers, daughters, status, vertices', () => {
    const r = rng(2);
    const ev = single(511, 3, -2, 20); // B0
    decayAll(ev, r);
    for (const p of ev.particles) {
      for (const d of p.daughters) expect(ev.particles[d]!.mothers).toContain(p.id);
      if (p.status === 'decayed') {
        expect(p.endVertex).toBeDefined();
        expect(p.daughters.length).toBeGreaterThan(0);
        for (const d of p.daughters) expect(ev.particles[d]!.vertex).toEqual(p.endVertex);
      } else expect(p.daughters.length).toBe(0);
      expect(p.id).toBe(ev.particles.indexOf(p));
    }
    // a B meson decays through D mesons to something the default policy leaves alone (K±, π±, μ±, e±, γ, ν …)
    for (const p of finals(ev)) expect(wouldDecay(p)).toBe(false);
  });
});

describe('decay policy', () => {
  test('by default μ, π±, K±, K_L, n, p are left for the detector; π⁰, K_S, Λ, Ξ, Ω, D, B, ρ decay', () => {
    const r = rng(3);
    for (const pdg of [13, -13, 211, -211, 321, -321, 130, 2112, 2212]) {
      const ev = single(pdg, 0, 0, 5);
      decayAll(ev, r);
      expect(ev.particles.length, particle(pdg).name).toBe(1);
      expect(ev.particles[0]!.status).toBe('final');
    }
    for (const pdg of [111, 310, 3122, 3312, 3334, 3222, 421, 521, 5122, 113, 223, 333, 2214]) {
      const ev = single(pdg, 0, 0, 5);
      decayAll(ev, r);
      expect(ev.particles[0]!.status, particle(pdg).name).toBe('decayed');
    }
    expect(DEFAULT_MAX_PROPER_CTAU_MM).toBe(100);
    expect(properCtauMm(310)).toBeGreaterThan(26);
    expect(properCtauMm(310)).toBeLessThan(28);
  });

  test('maxCtauMm compares the lab decay length βγcτ', () => {
    const r = rng(4);
    // K± with cτ = 3.7 m at p = 1 GeV: βγ ≈ 2, lab length ≈ 7.4 m
    const slow = single(321, 0, 0, 1);
    expect(meanDecayLengthMm(321, slow.particles[0]!.p)).toBeGreaterThan(6000);
    decayAll(slow, r, { maxCtauMm: 1000 });
    expect(slow.particles[0]!.status).toBe('final');
    decayAll(slow, r, { maxCtauMm: 1e5 });
    expect(slow.particles[0]!.status).toBe('decayed');
    // and a fast K_S is left alone when the limit is below its lab decay length
    const ks = single(310, 0, 0, 100);
    decayAll(ks, r, { maxCtauMm: 1000 });
    expect(ks.particles[0]!.status).toBe('final');
    // Infinity decays everything that has a decay in the table, including neutrons
    const n = single(2112, 0, 0, 1);
    decayAll(n, r, { maxCtauMm: Infinity });
    expect(n.particles[0]!.status).toBe('decayed');
    expect(finals(n).map((p) => p.pdg).sort()).toEqual([-12, 11, 2212].sort());
  });

  test('decayParticle decays on demand at a chosen point (how the detector decays a muon in flight)', () => {
    const r = rng(5);
    const ev = single(13, 0, 0, 10);
    expect(decayParticle(ev, 0, r, [1, 2, 3000])).toBe(true);
    expect(ev.particles[0]!.endVertex).toEqual([1, 2, 3000]);
    expect(finals(ev).map((p) => p.pdg).sort((a, b) => a - b)).toEqual([-12, 11, 14]);
    expect(decayParticle(ev, 0, r)).toBe(false); // already decayed
    expect(decayParticle(single(11), 0, r)).toBe(false); // stable
  });
});

describe('vertices', () => {
  test('decay lengths follow the exponential law with mean βγcτ', () => {
    const r = rng(6);
    const p = 10;
    const m = particle(310).mass;
    let s = 0;
    const N = 6000;
    for (let i = 0; i < N; i++) {
      const ev = single(310, 0, 0, p);
      decayAll(ev, r);
      const e = ev.particles[0]!.endVertex!;
      expect(e[0]).toBe(0);
      s += e[2];
    }
    const expected = (p / m) * properCtauMm(310);
    expect(s / N / expected).toBeGreaterThan(0.95);
    expect(s / N / expected).toBeLessThan(1.05);
  });

  test('daughters start at the parent\'s end vertex, which is along its flight direction', () => {
    const r = rng(7);
    const ev = single(3122, 3, 4, 12);
    ev.particles[0]!.vertex = [1, 1, 1];
    decayAll(ev, r);
    const e = ev.particles[0]!.endVertex!;
    const d = [e[0] - 1, e[1] - 1, e[2] - 1];
    const p = ev.particles[0]!.p;
    expect(d[0]! / p.px).toBeCloseTo(d[2]! / p.pz, 9);
    expect(d[1]! / p.py).toBeCloseTo(d[2]! / p.pz, 9);
    expect(d[2]!).toBeGreaterThan(0);
  });
});

describe('dynamics', () => {
  test('π⁰ → γγ is isotropic and has the table branching fraction', () => {
    const r = rng(8);
    let gg = 0;
    let c1 = 0, c2 = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const ev = single(111);
      decayAll(ev, r);
      const f = finals(ev);
      if (f.length === 2 && f.every((p) => p.pdg === 22)) {
        gg++;
        const c = f[0]!.p.pz / f[0]!.p.E;
        c1 += c;
        c2 += c * c;
        expect(invariantMass(f.map((p) => p.p))).toBeCloseTo(particle(111).mass, 6);
      }
    }
    expect(gg / N).toBeGreaterThan(0.9882 - 0.004);
    expect(gg / N).toBeLessThan(0.9882 + 0.004);
    expect(Math.abs(c1 / gg)).toBeLessThan(0.02);
    expect(c2 / gg).toBeGreaterThan(1 / 3 - 0.01);
    expect(c2 / gg).toBeLessThan(1 / 3 + 0.01);
  });

  test('branching fractions of τ⁻ and K⁺ are reproduced', () => {
    const r = rng(9);
    for (const pdg of [15, 321]) {
      const info = particle(pdg);
      const counts = new Map<string, number>();
      const N = 20000;
      for (let i = 0; i < N; i++) {
        const ev = single(pdg);
        decayParticle(ev, 0, r);
        const key = finals(ev).map((p) => p.pdg).sort((a, b) => a - b).join(',');
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      let tot = 0;
      for (const d of info.decays) tot += d.br;
      for (const d of info.decays) {
        const key = d.products.slice().sort((a, b) => a - b).join(',');
        const expected = d.br / tot;
        const got = (counts.get(key) ?? 0) / N;
        expect(Math.abs(got - expected), `${info.name} ${key}`).toBeLessThan(5 * Math.sqrt((expected * (1 - expected)) / N) + 1e-3);
      }
    }
  });

  test('uniform phase space (GENBOD, unweighted) agrees with the weighted RAMBO of the kinematics module', () => {
    const r = rng(10);
    const M = 4.0;
    const masses = [0.14, 0.14, 0.5, 0];
    const total = fromMass(M, 0, 0, 0);
    const N = 40000;
    let gm = 0, gm2 = 0, gp = 0;
    for (let i = 0; i < N; i++) {
      const p = uniformPhaseSpace(r, total, masses);
      const m12 = invariantMass([p[0]!, p[1]!]);
      gm += m12;
      gm2 += m12 * m12;
      gp += pmag(p[3]!);
      const s = sum(p);
      expect(Math.abs(s.E - M)).toBeLessThan(1e-9);
      expect(Math.abs(s.px) + Math.abs(s.py) + Math.abs(s.pz)).toBeLessThan(1e-9);
      for (let k = 0; k < 4; k++) expect(Math.abs(mass(p[k]!) - masses[k]!)).toBeLessThan(1e-6);
    }
    let wsum = 0, wm = 0, wm2 = 0, wp = 0;
    for (let i = 0; i < N; i++) {
      const { p, weight } = phaseSpace(r, total, masses);
      const m12 = invariantMass([p[0]!, p[1]!]);
      wsum += weight;
      wm += weight * m12;
      wm2 += weight * m12 * m12;
      wp += weight * pmag(p[3]!);
    }
    expect(Math.abs(gm / N / (wm / wsum) - 1)).toBeLessThan(0.01);
    expect(Math.abs(gm2 / N / (wm2 / wsum) - 1)).toBeLessThan(0.015);
    expect(Math.abs(gp / N / (wp / wsum) - 1)).toBeLessThan(0.01);
  });
});

describe('Breit–Wigner masses', () => {
  test('resonances are recognised from the table', () => {
    for (const pdg of [23, 24, 6, 25, 113, 223, 333, 2214]) expect(isResonance(pdg), particle(pdg).name).toBe(true);
    for (const pdg of [13, 211, 111, 221, 443, 310, 11, 22]) expect(isResonance(pdg), particle(pdg).name).toBe(false);
  });

  test('the Z mass distribution is a Breit–Wigner of width 2.4955 GeV', () => {
    const r = rng(12);
    const N = 40000;
    let inside = 0;
    const G = particle(23).width;
    const vals: number[] = [];
    for (let i = 0; i < N; i++) {
      const m = sampleMass(23, r);
      vals.push(m);
      expect(Math.abs(m - 91.188)).toBeLessThanOrEqual(5 * G + 1e-9);
      if (Math.abs(m - 91.188) < G / 2) inside++;
    }
    // P(|x| < Γ/2) = (2/π) atan(1) = 0.5 for the full Cauchy, renormalised to the ±5Γ window: 0.5/0.9365
    const expected = 0.5 / ((2 / Math.PI) * Math.atan(10));
    expect(Math.abs(inside / N - expected)).toBeLessThan(0.01);
    vals.sort((a, b) => a - b);
    expect(Math.abs(vals[N >> 1]! - 91.188)).toBeLessThan(0.05);
  });

  test('narrow particles have their nominal mass, limits are respected, the ρ never falls below 2mπ', () => {
    const r = rng(13);
    expect(sampleMass(111, r)).toBe(particle(111).mass);
    expect(minMass(113)).toBeCloseTo(2 * particle(211).mass, 9);
    for (let i = 0; i < 2000; i++) {
      const m = sampleMass(113, r);
      expect(m).toBeGreaterThanOrEqual(2 * particle(211).mass - 1e-12);
      const w = sampleMass(24, r, { max: 50 });
      expect(w).toBeLessThanOrEqual(50);
    }
  });

  test('the ρ mass of a decayed ρ⁰ is used as its parent mass', () => {
    const r = rng(14);
    const ev = single(113, 0, 0, 3, 0.6);
    decayAll(ev, r);
    const f = finals(ev);
    expect(f.length).toBe(2);
    expect(invariantMass(f.map((p) => p.p))).toBeCloseTo(mass(ev.particles[0]!.p), 8);
    expect(invariantMass(f.map((p) => p.p))).toBeCloseTo(0.6, 8);
  });
});

describe('heavy particles', () => {
  test('t → W b → ℓ ν b or q q̄ b: the b carries the top\'s colour, W → qq̄ is a colour singlet, nothing is left undecayed', () => {
    const r = rng(15);
    let hadW = 0;
    for (let i = 0; i < 200; i++) {
      const ev = single(6, 10, -20, 30);
      ev.particles[0]!.colour = [5, 0];
      decayHeavy(ev, r);
      const fin = finals(ev);
      expect(fin.some((p) => Math.abs(p.pdg) === 5)).toBe(true);
      const b = fin.find((p) => p.pdg === 5)!;
      expect(b.colour).toEqual([5, 0]);
      const qs = fin.filter((p) => Math.abs(p.pdg) <= 4 && p.pdg !== 0 && Math.abs(p.pdg) >= 1);
      if (qs.length > 0) {
        hadW++;
        expect(qs.length).toBe(2);
        const [a, c] = qs.sort((x, y) => y.pdg - x.pdg) as [TruthParticle, TruthParticle];
        expect(a.colour![0]).toBe(c.colour![1]);
        expect(a.colour![0]).toBeGreaterThan(0);
        expect(a.colour![1]).toBe(0);
        expect(c.colour![0]).toBe(0);
      }
      const tot = totalP(fin);
      expect(Math.abs(tot.E - ev.particles[0]!.p.E)).toBeLessThan(1e-8);
      // the W was made with a mass below m_t − m_b
      const w = ev.particles.find((p) => Math.abs(p.pdg) === 24)!;
      expect(mass(w.p)).toBeLessThan(particle(6).mass - particle(5).mass);
    }
    expect(hadW).toBeGreaterThan(80); // 67 % of W decays are hadronic
  });

  test('decayAll also showers and hadronises the quarks of a Z → qq̄ or H → bb̄ and conserves four-momentum', () => {
    const r = rng(16);
    for (const pdg of [23, 25, 24]) {
      for (let i = 0; i < 20; i++) {
        const ev = single(pdg, 0, 0, 10, sampleMass(pdg, r));
        const p0 = { ...ev.particles[0]!.p };
        decayAll(ev, r);
        expect(ev.particles.filter((p) => p.status === 'final' && (Math.abs(p.pdg) <= 5 || p.pdg === 21 || Math.abs(p.pdg) === 6)).length).toBe(0);
        const tot = totalP(finals(ev));
        // events with open colour lines do not occur here, so conservation is exact
        expect(Math.abs(tot.E - p0.E)).toBeLessThan(1e-6 * p0.E);
        expect(Math.abs(tot.pz - p0.pz)).toBeLessThan(1e-6 * p0.E);
      }
    }
  });

  test('H → W W* has a W* below threshold mass and the decay conserves four-momentum', () => {
    const r = rng(17);
    const H = particle(25);
    let seen = 0;
    for (let i = 0; i < 400; i++) {
      const ev = single(25, 0, 0, 0, H.mass);
      if (!decayParticle(ev, 0, r)) continue;
      const ds = ev.particles[0]!.daughters.map((d) => ev.particles[d]!);
      if (ds.length === 2 && ds.every((d) => Math.abs(d.pdg) === 24)) {
        seen++;
        expect(mass(ds[0]!.p) + mass(ds[1]!.p)).toBeLessThan(H.mass + 1e-9);
        expect(Math.min(...ds.map((d) => mass(d.p)))).toBeLessThan(H.mass - 80);
      }
    }
    expect(seen).toBeGreaterThan(40);
  });
});
