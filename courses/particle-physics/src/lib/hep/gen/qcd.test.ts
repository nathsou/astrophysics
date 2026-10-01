import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { charge } from '../particles/index.ts';
import { crossSection } from './integrate.ts';
import { boxSumSquared, dijets, diphoton, qcdMatrixElements as me } from './qcd.ts';
import { colourFlowValid, conservation } from './process.ts';

/** Random massless 2 → 2 kinematics: s, t, u with s + t + u = 0. */
function kin(r: () => number): [number, number, number] {
  const s = 1 + 100 * r();
  const c = 2 * r() - 1;
  const t = (-s * (1 - c)) / 2;
  return [s, t, -s - t];
}

describe('QCD 2 → 2 matrix elements', () => {
  test('crossing: gg → qq̄ and qq̄ → gg are related by the colour and spin averaging factors, 9/64', () => {
    const r = rng(1);
    for (let i = 0; i < 50; i++) {
      const [s, t, u] = kin(r);
      expect(me.ggQqbar(s, t, u) / me.qqbarGG(s, t, u)).toBeCloseTo(9 / 64, 10);
    }
  });
  test('crossing: qg → qg from qq̄ → gg by s ↔ t, with the factor −36/96 from averaging and the fermion crossing', () => {
    const r = rng(2);
    for (let i = 0; i < 50; i++) {
      const [s, t, u] = kin(r);
      // qg: t < 0, u < 0 and s > 0. Use the qq̄ → gg amplitude with s ↔ t (its "s" is then negative: a crossed fermion line, factor −1).
      expect(me.qg(s, t, u)).toBeCloseTo((-36 / 96) * me.qqbarGG(t, s, u), 9);
    }
  });
  test('qq → qq from qq′ → qq′: the direct (t) term is the same and the identical-quark exchange adds the u term and the interference', () => {
    const r = rng(3);
    for (let i = 0; i < 50; i++) {
      const [s, t, u] = kin(r);
      const direct = me.qqp(s, t, u), exchange = me.qqp(s, u, t);
      expect(me.qq(s, t, u)).toBeCloseTo(direct + exchange - (8 / 27) * (s * s) / (u * t), 10);
    }
  });
  test('qq̄ → qq̄ from qq′ → qq′ by crossing s ↔ u: (4/9)(...)', () => {
    const r = rng(4);
    for (let i = 0; i < 50; i++) {
      const [s, t, u] = kin(r);
      // qq → qq (t, u channels) crossed to qq̄ → qq̄ (s, t channels): s ↔ u, no sign (two fermion lines flip)
      expect(me.qqbarSame(s, t, u)).toBeCloseTo(me.qq(u, t, s), 9);
    }
  });
  test('gg → gg is symmetric under all permutations of s, t, u and positive', () => {
    const r = rng(5);
    for (let i = 0; i < 50; i++) {
      const [s, t, u] = kin(r);
      const a = me.gg(s, t, u);
      expect(a).toBeGreaterThan(0);
      expect(me.gg(t, s, u)).toBeCloseTo(a, 9);
      expect(me.gg(u, t, s)).toBeCloseTo(a, 9);
    }
  });
  test('at 90° the values are the textbook ones: gg → gg 30.4, qg → qg 6.11 (per g⁴, this table), qq′ → qq′ 2.22', () => {
    const s = 1, t = -0.5, u = -0.5;
    expect(me.gg(s, t, u)).toBeCloseTo(30.375, 6);
    expect(me.qqp(s, t, u)).toBeCloseTo((4 / 9) * 1.25 / 0.25, 10);
    expect(me.qg(s, t, u)).toBeCloseTo(5 + (4 / 9) * 2.5, 10);
  });
});

describe('dijets', () => {
  test('cross-section falls steeply with pTmin and grows with √s', () => {
    const a = dijets({ ptMin: 50 }), b = dijets({ ptMin: 100 }), c = dijets({ ptMin: 200 });
    expect(a.sigma(13000)).toBeGreaterThan(10 * b.sigma(13000));
    expect(b.sigma(13000)).toBeGreaterThan(10 * c.sigma(13000));
    expect(c.sigma(13000)).toBeGreaterThan(c.sigma(7000));
  });
  test('Monte Carlo reproduces the VEGAS-trained estimate and is stable (χ²-like: two independent seeds agree within 4σ)', () => {
    const p = dijets({ ptMin: 100 });
    const a = crossSection(p, 13000, 30000, rng(1));
    const b = crossSection(p, 13000, 30000, rng(2));
    expect(Math.abs(a.sigma - b.sigma)).toBeLessThan(4 * Math.hypot(a.error, b.error));
    expect(Math.abs(p.sigma(13000) / a.sigma - 1)).toBeLessThan(0.04);
  });
  test('events: two outgoing partons, balanced in pT, both above the cut, conserving energy and momentum, colour flow valid', () => {
    const p = dijets({ ptMin: 40 });
    const r = rng(6);
    const seen = new Set<string>();
    for (let i = 0; i < 1500; i++) {
      const { event } = p.generate(r, { sqrtS: 13000 });
      const out = event.particles.filter((q) => q.status === 'final');
      expect(out.length).toBe(2);
      for (const q of out) expect(Math.hypot(q.p.px, q.p.py)).toBeGreaterThanOrEqual(40 - 1e-9);
      const c = conservation(event, charge);
      expect(Math.abs(c.dE)).toBeLessThan(1e-9 * 13000);
      expect(Math.abs(c.dpx)).toBeLessThan(1e-9 * 13000);
      expect(Math.abs(c.dpy)).toBeLessThan(1e-9 * 13000);
      expect(Math.abs(c.dpz)).toBeLessThan(1e-9 * 13000);
      expect(c.dCharge).toBe(0);
      expect(colourFlowValid(event)).toBe(true);
      seen.add(event.particles.filter((q) => q.status === 'hard').map((q) => q.pdg === 21 ? 'g' : 'q').join('') + '>' + out.map((q) => (q.pdg === 21 ? 'g' : 'q')).join(''));
    }
    // all the topologies of the table appear
    for (const k of ['gg>gg', 'gq>gq', 'qg>qg', 'qq>qq', 'gg>qq']) expect(seen.has(k)).toBe(true);
  });
  test('at low pT the gluon-initiated channels dominate; at high pT the quark-initiated ones take over', () => {
    const frac = (pt: number) => {
      const p = dijets({ ptMin: pt });
      const r = rng(7);
      let gg = 0;
      const n = 1500;
      for (let i = 0; i < n; i++) {
        const ev = p.generate(r, { sqrtS: 13000 }).event;
        if (ev.particles.filter((q) => q.status === 'hard').every((q) => q.pdg === 21)) gg++;
      }
      return gg / n;
    };
    expect(frac(20)).toBeGreaterThan(frac(1500));
  });
  test('p p̄ dijets: an incoming antiquark is far more frequent than in pp (valence antiquarks of the antiproton)', () => {
    const anti = (beams: 'pp' | 'ppbar') => {
      const p = dijets({ ptMin: 150, beams });
      const r = rng(9);
      let k = 0;
      const n = 1500;
      for (let i = 0; i < n; i++) if (p.generate(r, { sqrtS: 1960 }).event.particles.some((q) => q.status === 'hard' && q.pdg < 0 && q.pdg !== 21)) k++;
      return k / n;
    };
    expect(anti('ppbar')).toBeGreaterThan(1.6 * anti('pp'));
  });
});

describe('γγ', () => {
  const q = diphoton({ ptMin: 25, box: false });
  const both = diphoton({ ptMin: 25 });
  test('the box adds to the Born cross-section; both are positive and the gg box is of the same order as qq̄ (approximate box, see the docs)', () => {
    expect(q.sigma(13000)).toBeGreaterThan(0);
    const ratio = both.sigma(13000) / q.sigma(13000) - 1;
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(4);
  });
  test('the box helicity sum is positive, symmetric in t ↔ u and approaches the value 10 + … at small angle, i.e. no singularity at t → 0 faster than logs', () => {
    const s = 1;
    expect(boxSumSquared(s, -0.5, -0.5)).toBeGreaterThan(10);
    expect(boxSumSquared(s, -0.3, -0.7)).toBeCloseTo(boxSumSquared(s, -0.7, -0.3), 9);
    expect(boxSumSquared(s, -1e-3, -1 + 1e-3)).toBeLessThan(1e4); // grows only like ln²
  });
  test('events: two photons back-to-back in the transverse plane with pT above the cut; conservation', () => {
    const r = rng(8);
    for (let i = 0; i < 800; i++) {
      const { event } = both.generate(r, { sqrtS: 13000 });
      const out = event.particles.filter((p) => p.status === 'final');
      expect(out.map((p) => p.pdg)).toEqual([22, 22]);
      expect(out[0]!.p.E).toBeCloseTo(Math.hypot(out[0]!.p.px, out[0]!.p.py, out[0]!.p.pz), 9);
      expect(Math.hypot(out[0]!.p.px, out[0]!.p.py)).toBeGreaterThanOrEqual(25 - 1e-9);
      expect(out[0]!.p.px + out[1]!.p.px).toBeCloseTo(0, 9);
      const c = conservation(event, charge);
      expect(Math.abs(c.dE)).toBeLessThan(1e-9 * 13000);
      expect(Math.abs(c.dpz)).toBeLessThan(1e-9 * 13000);
      expect(c.dCharge).toBe(0);
      expect(colourFlowValid(event)).toBe(true);
    }
  });
  test('Monte Carlo reproduces the trained estimate', () => {
    const a = crossSection(both, 13000, 30000, rng(3));
    expect(Math.abs(both.sigma(13000) / a.sigma - 1)).toBeLessThan(0.05);
  });
});
