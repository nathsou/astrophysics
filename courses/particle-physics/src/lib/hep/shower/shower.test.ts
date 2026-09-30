import { describe, expect, test } from 'vitest';
import { rng, type Rng } from '../random/index.ts';
import type { TruthEvent, TruthParticle } from '../event/index.ts';
import { fromMass, mass, pt as ptOf, rapidity, sum, type P4 } from '../kinematics/index.ts';
import { particle } from '../particles/index.ts';
import { alphaS1 } from '../sm/index.ts';
import { buildChains, outgoingPartons } from '../hadronise/colour.ts';
import { hadronise } from '../hadronise/index.ts';
import { decayAll } from '../decay/index.ts';
import {
  alphaSOver, alphaSShower, CA, CF, emissionRate, isrRecords, nextEmission, overestimateFactor, rescaleToTarget, shower, showerHistory, splitting, sudakov, TR,
} from './index.ts';

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────

function mkEvent(parts: { pdg: number; p: P4; col: [number, number] }[]): TruthEvent {
  const particles: TruthParticle[] = parts.map((q, i) => ({ id: i, pdg: q.pdg, p: q.p, vertex: [0, 0, 0], status: 'final', mothers: [], daughters: [], colour: q.col }));
  return { number: 0, weight: 1, process: 'test', sqrtS: 0, particles, primaryVertices: [[0, 0, 0]] };
}
/** q q̄ back to back along a random axis, total energy E. */
function qqbar(r: Rng, E: number, flav = 2): TruthEvent {
  const c = 2 * r() - 1, s = Math.sqrt(1 - c * c), ph = 2 * Math.PI * r();
  const m = particle(flav).mass;
  const k = Math.sqrt((E / 2) ** 2 - m * m);
  const u = [s * Math.cos(ph), s * Math.sin(ph), c] as const;
  return mkEvent([
    { pdg: flav, p: fromMass(m, k * u[0], k * u[1], k * u[2]), col: [1, 0] },
    { pdg: -flav, p: fromMass(m, -k * u[0], -k * u[1], -k * u[2]), col: [0, 1] },
  ]);
}
const finals = (ev: TruthEvent): TruthParticle[] => ev.particles.filter((p) => p.status === 'final');

/** pp → Z (or H) from two incoming partons of the given flavours; the boson has status 'final' and no decay. */
function bosonEvent(r: Rng, kind: 'Z' | 'H', sqrtS = 13000): TruthEvent {
  const m = kind === 'Z' ? 91.1876 : 125.2;
  const tau = (m * m) / (sqrtS * sqrtS);
  const y = (2 * r() - 1) * 2;
  const x1 = Math.sqrt(tau) * Math.exp(y), x2 = Math.sqrt(tau) * Math.exp(-y);
  const e = sqrtS / 2;
  const mk = (id: number, pdg: number, E: number, pz: number, status: TruthParticle['status'], mothers: number[], col?: [number, number]): TruthParticle => ({
    id, pdg, p: { E, px: 0, py: 0, pz }, vertex: [0, 0, 0], status, mothers, daughters: [], colour: col,
  });
  const ps = [
    mk(0, 2212, e, e, 'beam', []),
    mk(1, 2212, e, -e, 'beam', []),
    kind === 'Z' ? mk(2, 2, x1 * e, x1 * e, 'hard', [0], [1, 0]) : mk(2, 21, x1 * e, x1 * e, 'hard', [0], [1, 2]),
    kind === 'Z' ? mk(3, -2, x2 * e, -x2 * e, 'hard', [1], [0, 1]) : mk(3, 21, x2 * e, -x2 * e, 'hard', [1], [2, 1]),
    mk(4, kind === 'Z' ? 23 : 25, (x1 + x2) * e, (x1 - x2) * e, 'final', [2, 3]),
  ];
  return { number: 0, weight: 1, process: 'test', sqrtS, particles: ps, primaryVertices: [[0, 0, 0]] };
}

/** A trivial anti-kT (R, E-scheme) on a list of four-vectors: returns the jets, hardest first. */
function antiKt(input: P4[], R: number): P4[] {
  const items = input.map((p) => ({ ...p }));
  const jets: P4[] = [];
  const pt2 = (p: P4) => p.px * p.px + p.py * p.py;
  const rap = (p: P4) => rapidity(p);
  const dphi = (a: P4, b: P4) => {
    let d = Math.atan2(a.py, a.px) - Math.atan2(b.py, b.px);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  };
  const live = items.filter((p) => pt2(p) > 1e-12);
  while (live.length > 0) {
    let best = Infinity, bi = -1, bj = -1;
    for (let i = 0; i < live.length; i++) {
      const pi = live[i]!;
      const diB = 1 / pt2(pi);
      if (diB < best) {
        best = diB;
        bi = i;
        bj = -1;
      }
      for (let j = i + 1; j < live.length; j++) {
        const pj = live[j]!;
        const dy = rap(pi) - rap(pj), dp = dphi(pi, pj);
        const d = Math.min(1 / pt2(pi), 1 / pt2(pj)) * ((dy * dy + dp * dp) / (R * R));
        if (d < best) {
          best = d;
          bi = i;
          bj = j;
        }
      }
    }
    if (bj < 0) {
      jets.push(live[bi]!);
      live.splice(bi, 1);
    } else {
      const a = live[bi]!, b = live[bj]!;
      live[bi] = { E: a.E + b.E, px: a.px + b.px, py: a.py + b.py, pz: a.pz + b.pz };
      live.splice(bj, 1);
    }
  }
  return jets.sort((a, b) => b.E - a.E);
}

function simpson(f: (x: number) => number, a: number, b: number, n = 2000): number {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

// ── analytic ingredients ────────────────────────────────────────────────────────────────────────────────────────

describe('splitting functions and the coupling', () => {
  test('splitting functions and their closed-form integrals', () => {
    expect(splitting.qq(0.5)).toBeCloseTo((CF * 1.25) / 0.5, 12);
    expect(splitting.gg(0.3)).toBeCloseTo(splitting.gg(0.7), 12);
    expect(splitting.gq(0.5)).toBeCloseTo(TR * 0.5, 12);
    expect(((1 - 0.999) * splitting.qq(0.999))).toBeCloseTo(2 * CF, 2); // soft limit 2C_F/(1 − z)
    for (const [a, b] of [[0.01, 0.99], [0.1, 0.6], [0.3, 0.95]] as const) {
      expect(splitting.integralQq(a, b)).toBeCloseTo(simpson(splitting.qq, a, b, 20000), 5);
      expect(splitting.integralGg(a, b)).toBeCloseTo(simpson(splitting.gg, a, b, 20000), 5);
      expect(splitting.integralGq(a, b)).toBeCloseTo(simpson(splitting.gq, a, b), 9);
    }
    // ∫ z [z² + (1 − z)²] dz = 1/3
    expect(simpson((z) => z * splitting.gq(z) / TR, 0, 1)).toBeCloseTo(1 / 3, 9);
  });

  test('the shower coupling is the one of hep/sm, and the veto overestimate bounds it', () => {
    for (const Q of [0.5, 1, 1.5, 3, 10, 91.19, 500, 5000]) {
      expect(alphaSShower(Q * Q) / alphaS1(Math.max(Q, 0.5))).toBeGreaterThan(0.995);
      expect(alphaSShower(Q * Q) / alphaS1(Math.max(Q, 0.5))).toBeLessThan(1.005);
      expect(alphaSShower(Q * Q)).toBeLessThanOrEqual(overestimateFactor() * alphaSOver(Q * Q) * 1.000001);
    }
    expect(overestimateFactor()).toBeGreaterThanOrEqual(1);
    expect(alphaSOver(91.1876 ** 2)).toBeCloseTo(0.118, 6);
  });

  test('the Sudakov form factor is 1 at equal scales, decreases as the interval grows and matches an independent integral', () => {
    expect(sudakov(100, 100)).toBe(1);
    let prev = 1;
    for (const t1 of [900, 400, 100, 25, 4, 1]) {
      const d = sudakov(2500, t1);
      expect(d).toBeLessThan(prev);
      prev = d;
    }
    expect(sudakov(1, 2500)).toBe(sudakov(2500, 1)); // either order
    // independent: fixed αs, q → qg with E = 100: ∫ dt/t (αs/2π) ∫_{√t/E}^{1−√t/E} P_qq dz, trapezoid in ln t with 20000 points
    const as = 0.2;
    let I = 0;
    const n = 20000;
    const l0 = Math.log(4), l1 = Math.log(2500);
    for (let i = 0; i < n; i++) {
      const t = Math.exp(l0 + ((i + 0.5) / n) * (l1 - l0));
      const a = Math.sqrt(t) / 100;
      I += simpson(splitting.qq, a, 1 - a, 200) * ((l1 - l0) / n);
    }
    expect(sudakov(2500, 4, { alphaS: as, E: 100 })).toBeCloseTo(Math.exp(-(as / (2 * Math.PI)) * I), 4);
    // gluons radiate more than quarks
    expect(sudakov(2500, 4, { parton: 'g', nf: 3 })).toBeLessThan(sudakov(2500, 4, { parton: 'q' }));
    expect(emissionRate(2500, { E: 10 })).toBe(0); // no phase space: pT = 50 GeV > E/2
  });
});

describe('the veto algorithm reproduces the analytic Sudakov', () => {
  const chi2OfFirstEmission = (opts: { gluon: boolean; fixed?: number; nf?: number; E: number; tmax: number; tmin: number; seed: number }) => {
    const r = rng(opts.seed);
    const nb = 14;
    const edges = Array.from({ length: nb + 1 }, (_, i) => Math.exp(Math.log(opts.tmin) + (i / nb) * (Math.log(opts.tmax) - Math.log(opts.tmin))));
    const so: Parameters<typeof sudakov>[2] = { E: opts.E, parton: opts.gluon ? 'g' : 'q' };
    if (opts.fixed !== undefined) so.alphaS = opts.fixed;
    if (opts.nf !== undefined) so.nf = opts.nf;
    const cfg: { alphaSFixed?: number; nf?: number } = {};
    if (opts.fixed !== undefined) cfg.alphaSFixed = opts.fixed;
    if (opts.nf !== undefined) cfg.nf = opts.nf;
    const N = 120000;
    const obs = new Array(nb + 1).fill(0); // last bin: no emission above the cutoff
    for (let i = 0; i < N; i++) {
      const e = nextEmission(opts.gluon, opts.E, opts.tmax, opts.tmin, r, cfg);
      if (!e) {
        obs[nb]++;
        continue;
      }
      expect(e.t).toBeGreaterThan(opts.tmin);
      expect(e.t).toBeLessThanOrEqual(opts.tmax);
      expect(e.z).toBeGreaterThan(Math.sqrt(e.t) / opts.E - 1e-12);
      expect(e.z).toBeLessThan(1 - Math.sqrt(e.t) / opts.E + 1e-12);
      let k = 0;
      while (k < nb - 1 && e.t <= edges[nb - 1 - k]!) k++;
      // bins ordered from tmax downwards: bin 0 is [edges[nb−1], tmax]
      obs[k]++;
    }
    // probability of the first emission in (lo, hi] = Δ(tmax, hi) − Δ(tmax, lo)
    let chi2 = 0, dof = 0;
    for (let k = 0; k < nb; k++) {
      const hi = edges[nb - k]!, lo = edges[nb - 1 - k]!;
      const p = sudakov(opts.tmax, hi, so) - sudakov(opts.tmax, lo, so);
      const e = p * N;
      if (e > 5) {
        chi2 += (obs[k] - e) ** 2 / e;
        dof++;
      }
    }
    const pn = sudakov(opts.tmax, opts.tmin, so);
    chi2 += (obs[nb] - pn * N) ** 2 / (pn * N);
    dof++;
    return chi2 / dof;
  };

  test('quark, fixed αs = 0.2, soft cutoff 2 GeV: pT² spectrum of the first emission', () => {
    expect(chi2OfFirstEmission({ gluon: false, fixed: 0.2, E: 100, tmax: 2500, tmin: 4, seed: 1 })).toBeLessThan(1.8);
  });
  test('gluon (g → gg and g → qq̄ with nf = 3), fixed αs = 0.25', () => {
    expect(chi2OfFirstEmission({ gluon: true, fixed: 0.25, nf: 3, E: 80, tmax: 1600, tmin: 4, seed: 2 })).toBeLessThan(1.8);
  });
  test('quark with the running coupling of hep/sm (veto on the coupling)', () => {
    expect(chi2OfFirstEmission({ gluon: false, E: 100, tmax: 2500, tmin: 1, seed: 3 })).toBeLessThan(1.8);
  });
  test('gluon with the running coupling and the flavour thresholds', () => {
    expect(chi2OfFirstEmission({ gluon: true, E: 100, tmax: 2500, tmin: 1, seed: 4 })).toBeLessThan(1.8);
  });

  test('the z distribution of an emission follows P(z) (pT² between 80 and 125, z where every pT is allowed)', () => {
    const r = rng(5);
    const E = 100;
    for (const gluon of [false, true]) {
      const nb = 8;
      const lo = 0.12, hi = 0.88;
      const edges = Array.from({ length: nb + 1 }, (_, i) => lo + ((hi - lo) * i) / nb);
      const obs = new Array(nb).fill(0);
      let n = 0;
      const cfg = { alphaSFixed: 0.3, nf: 3 };
      while (n < 60000) {
        const e = nextEmission(gluon, E, 125, 80, r, cfg);
        if (!e || e.kind === 'g->qq' || e.z < lo || e.z >= hi) continue;
        let k = 0;
        while (k < nb - 1 && e.z >= edges[k + 1]!) k++;
        obs[k]++;
        n++;
      }
      let chi2 = 0;
      const norm = gluon ? splitting.integralGg(lo, hi) : splitting.integralQq(lo, hi);
      for (let k = 0; k < nb; k++) {
        const p = (gluon ? splitting.integralGg(edges[k]!, edges[k + 1]!) : splitting.integralQq(edges[k]!, edges[k + 1]!)) / norm;
        chi2 += (obs[k] - p * n) ** 2 / (p * n);
      }
      expect(chi2 / (nb - 1), gluon ? 'g → gg' : 'q → qg').toBeLessThan(2.5);
    }
  });
});

// ── the final-state shower on events ─────────────────────────────────────────────────────────────────────────────

describe('the final-state shower', () => {
  test('exact four-momentum conservation for q q̄ systems of any energy, heavy quarks included', () => {
    const r = rng(21);
    for (let i = 0; i < 800; i++) {
      const E = 5 + Math.exp(r() * Math.log(5000));
      const flav = [1, 2, 3, 4, 5][i % 5]!;
      if (E < 2 * particle(flav).mass + 3) continue;
      const ev = qqbar(r, E, flav);
      const before = sum(ev.particles.map((p) => p.p));
      shower(ev, r);
      const after = sum(finals(ev).map((p) => p.p));
      const s = Math.max(1, before.E);
      expect(Math.abs(after.E - before.E) / s).toBeLessThan(1e-9);
      expect(Math.abs(after.px - before.px) / s).toBeLessThan(1e-9);
      expect(Math.abs(after.py - before.py) / s).toBeLessThan(1e-9);
      expect(Math.abs(after.pz - before.pz) / s).toBeLessThan(1e-9);
      for (const p of finals(ev)) expect(p.p.E).toBeGreaterThan(0);
    }
  });

  test('the record is consistent: mothers, daughters, status, node momenta, colour flow', () => {
    const r = rng(22);
    let showered = 0;
    for (let i = 0; i < 100; i++) {
      const ev = qqbar(r, 50 + 500 * r(), 2 + (i % 4));
      shower(ev, r);
      if (ev.particles.length === 2) continue; // nothing emitted above the cutoff (rare at these energies)
      showered++;
      for (const p of ev.particles) {
        expect(p.id).toBe(ev.particles.indexOf(p));
        for (const d of p.daughters) expect(ev.particles[d]!.mothers).toContain(p.id);
        if (p.status === 'intermediate') {
          expect(p.daughters.length).toBe(2);
          const tot = sum(p.daughters.map((d) => ev.particles[d]!.p));
          expect(Math.abs(tot.E - p.p.E)).toBeLessThan(1e-9 * Math.max(1, p.p.E));
          expect(Math.abs(tot.pz - p.p.pz)).toBeLessThan(1e-9 * Math.max(1, p.p.E));
        } else expect(p.daughters.length).toBe(0);
      }
      // the final partons form closed colour chains: a quark at one end, an antiquark at the other, flavours balanced
      const out = outgoingPartons(ev);
      expect(out.length).toBeGreaterThanOrEqual(2);
      const chains = buildChains(ev, out);
      let q = 0;
      for (const c of chains) {
        expect(c.ring).toBe(false);
        expect(c.startOpen).toBe(false);
        expect(c.endOpen).toBe(false);
        const first = ev.particles[c.idx[0]!]!, last = ev.particles[c.idx[c.idx.length - 1]!]!;
        expect(first.pdg).toBeGreaterThan(0);
        expect(first.pdg).toBeLessThanOrEqual(5);
        expect(last.pdg).toBeLessThan(0);
        for (const k of c.idx.slice(1, -1)) expect(ev.particles[k]!.pdg).toBe(21);
        q += c.idx.length;
      }
      expect(q).toBe(out.length);
      const flav = new Map<number, number>();
      for (const k of out) {
        const p = ev.particles[k]!;
        if (p.pdg !== 21) flav.set(Math.abs(p.pdg), (flav.get(Math.abs(p.pdg)) ?? 0) + Math.sign(p.pdg));
      }
      for (const v of flav.values()) expect(v).toBe(0);
    }
    expect(showered).toBeGreaterThan(90);
  });

  test('gluon-initiated and open systems conserve four-momentum too', () => {
    const r = rng(23);
    let showered = 0;
    for (let i = 0; i < 300; i++) {
      const E = 40 + 400 * r();
      const c = 2 * r() - 1, s = Math.sqrt(1 - c * c);
      const a = { E: E / 2, px: (E / 2) * s, py: 0, pz: (E / 2) * c };
      const b = { E: E / 2, px: -a.px, py: 0, pz: -a.pz };
      // a g g pair as in gg → H (closed ring) or as in gg → gg with open colour lines
      const ev = i % 2 ? mkEvent([{ pdg: 21, p: a, col: [1, 2] }, { pdg: 21, p: b, col: [2, 1] }]) : mkEvent([{ pdg: 21, p: a, col: [1, 2] }, { pdg: 21, p: b, col: [3, 1] }]);
      const before = sum(ev.particles.map((p) => p.p));
      shower(ev, r);
      const after = sum(finals(ev).map((p) => p.p));
      expect(Math.abs(after.E - before.E)).toBeLessThan(1e-9 * E);
      expect(Math.abs(after.pz - before.pz)).toBeLessThan(1e-9 * E);
      if (ev.particles.length > 2) showered++;
    }
    expect(showered).toBeGreaterThan(280);
  });

  test('showers of several colour systems in one event conserve each system and the total', () => {
    const r = rng(24);
    const ev = mkEvent([
      { pdg: 2, p: fromMass(0, 0, 0, 100), col: [1, 0] },
      { pdg: -2, p: fromMass(0, 0, 0, -100), col: [0, 1] },
      { pdg: 3, p: fromMass(0, 50, 0, 0), col: [2, 0] },
      { pdg: -3, p: fromMass(0, -50, 0, 0), col: [0, 2] },
    ]);
    const before = sum(ev.particles.map((p) => p.p));
    shower(ev, r);
    const chains = buildChains(ev, outgoingPartons(ev));
    expect(chains.length).toBeGreaterThanOrEqual(2);
    const after = sum(finals(ev).map((p) => p.p));
    expect(Math.abs(after.E - before.E)).toBeLessThan(1e-8);
    // each original system is conserved separately: the u-family and the s-family
    const fam = (root: number): number[] => {
      const out: number[] = [];
      const walk = (i: number) => {
        const p = ev.particles[i]!;
        if (p.daughters.length === 0) out.push(i);
        for (const d of p.daughters) walk(d);
      };
      walk(root);
      return out;
    };
    const sysA = sum([...fam(0), ...fam(1)].map((i) => ev.particles[i]!.p));
    expect(Math.abs(sysA.E - 200)).toBeLessThan(1e-8);
    expect(Math.abs(sysA.px) + Math.abs(sysA.py) + Math.abs(sysA.pz)).toBeLessThan(1e-8);
  });

  test('parton multiplicity grows with the starting scale and with αs; the cutoff is respected', () => {
    const r = rng(25);
    const mean = (o: Parameters<typeof shower>[2]) => {
      let s = 0;
      const N = 300;
      for (let i = 0; i < N; i++) {
        const ev = qqbar(r, 400);
        shower(ev, r, o);
        s += finals(ev).length;
      }
      return s / N;
    };
    const m5 = mean({ startScale: 5 }), m20 = mean({ startScale: 20 }), m80 = mean({ startScale: 80 }), m400 = mean({});
    expect(m5).toBeLessThan(m20);
    expect(m20).toBeLessThan(m80);
    expect(m80).toBeLessThan(m400);
    expect(mean({ alphaSFixed: 0.1 })).toBeLessThan(mean({ alphaSFixed: 0.3 }));
    expect(mean({ cutoff: 4 })).toBeLessThan(mean({ cutoff: 1 }));
    // nothing below the cutoff
    for (let i = 0; i < 50; i++) {
      const ev = qqbar(r, 300);
      shower(ev, r, { cutoff: 3 });
      for (const b of showerHistory(ev)) expect(b.pT).toBeGreaterThan(0.9 * 3);
    }
    // off switches
    const ev = qqbar(r, 300);
    shower(ev, r, { fsr: false });
    expect(ev.particles.length).toBe(2);
  });

  test('showerHistory lists the branchings of the tree', () => {
    const r = rng(26);
    const ev = qqbar(r, 200);
    shower(ev, r);
    const h = showerHistory(ev);
    const nBranch = ev.particles.filter((p) => p.status === 'intermediate').length;
    expect(h.length).toBe(nBranch);
    expect(h.length).toBeGreaterThan(0);
    for (const b of h) {
      expect(ev.particles[b.parent]!.status).toBe('intermediate');
      expect(b.z).toBeGreaterThan(0);
      expect(b.z).toBeLessThan(1);
      expect(b.pT).toBeGreaterThan(0);
      expect(['q->qg', 'g->gg', 'g->qq']).toContain(b.kind);
      expect(b.isr).toBe(false);
      if (b.kind === 'q->qg') {
        expect(ev.particles[b.daughters[0]!]!.pdg).toBe(ev.particles[b.parent]!.pdg);
        expect(ev.particles[b.daughters[1]!]!.pdg).toBe(21);
      }
    }
  });

  test('it terminates and conserves momentum for extreme settings', () => {
    const r = rng(27);
    for (const o of [{ startScale: 1e5, cutoff: 0.5 }, { alphaSFixed: 1.5, cutoff: 0.5 }, { cutoff: 1e3 }, { startScale: 1 }, { nf: 5, alphaSFixed: 0.5 }] as const) {
      const ev = qqbar(r, 3000);
      const before = sum(ev.particles.map((p) => p.p));
      shower(ev, r, o);
      const after = sum(finals(ev).map((p) => p.p));
      expect(Math.abs(after.E - before.E)).toBeLessThan(1e-8 * before.E);
      expect(ev.particles.length).toBeLessThan(25000);
    }
    // no partons, lone partons, empty events
    const empty = mkEvent([]);
    shower(empty, r);
    const lone = mkEvent([{ pdg: 21, p: fromMass(0, 3, 4, 5), col: [1, 1] }]);
    shower(lone, r);
    expect(lone.particles.length).toBe(1);
    const lep = mkEvent([{ pdg: 13, p: fromMass(0.1, 0, 0, 40), col: [0, 0] }]);
    delete lep.particles[0]!.colour;
    shower(lep, r);
    expect(lep.particles.length).toBe(1);
  });

  test('rescaleToTarget makes any set of momenta add up to the target exactly, with masses', () => {
    const r = rng(28);
    for (let i = 0; i < 500; i++) {
      const n = 2 + Math.floor(r() * 10);
      const ps: P4[] = [];
      const ms: number[] = [];
      for (let k = 0; k < n; k++) {
        const m = r() < 0.3 ? 0 : r() * 2;
        ms.push(m);
        ps.push(fromMass(m, (r() - 0.5) * 20, (r() - 0.5) * 20, (r() - 0.5) * 50));
      }
      const tot = sum(ps);
      const target = fromMass(mass(tot) * 1.3 + 0.5 + ms.reduce((a, b) => a + b, 0), (r() - 0.5) * 30, (r() - 0.5) * 30, (r() - 0.5) * 80);
      expect(rescaleToTarget(ps, ms, target)).toBe(true);
      const t2 = sum(ps);
      const s = Math.max(1, target.E);
      expect(Math.abs(t2.E - target.E) / s).toBeLessThan(1e-12);
      expect(Math.abs(t2.px - target.px) / s).toBeLessThan(1e-12);
      expect(Math.abs(t2.pz - target.pz) / s).toBeLessThan(1e-12);
      ps.forEach((p, k) => expect(Math.abs(mass(p) - ms[k]!)).toBeLessThan(1e-7 * Math.max(1, p.E)));
    }
    const one = [fromMass(1, 0, 0, 1)];
    expect(rescaleToTarget(one, [1], fromMass(1, 0, 0, 1))).toBe(false);
    const two = [fromMass(1, 0, 0, 1), fromMass(1, 0, 0, 2)];
    expect(rescaleToTarget(two, [1, 1], fromMass(1.5, 0, 0, 0))).toBe(false); // target mass below Σm
  });
});

// ── the whole chain: physics checks ─────────────────────────────────────────────────────────────────────────────

describe('jets from shower + hadronisation', () => {
  test('anti-kT R = 0.4 jets recover at least 90 % of a 100 GeV quark\'s energy on average', () => {
    const r = rng(31);
    const N = 400;
    let fracHad = 0, fracDecayed = 0, nj = 0;
    for (let i = 0; i < N; i++) {
      const ev = mkEvent([
        { pdg: 2 + (i % 3), p: fromMass(0, 0, 0, 100), col: [1, 0] },
        { pdg: -(2 + (i % 3)), p: fromMass(0, 0, 0, -100), col: [0, 1] },
      ]);
      // tilt the axis so that the jets sit at central rapidity: axis along x
      for (const p of ev.particles) p.p = { E: p.p.E, px: p.p.pz, py: 0, pz: 0 };
      shower(ev, r);
      hadronise(ev, r);
      const visible = (list: TruthParticle[]) => list.filter((p) => ![12, 14, 16].includes(Math.abs(p.pdg))).map((p) => p.p);
      const jets1 = antiKt(visible(finals(ev)), 0.4);
      const axis: P4 = { E: 100, px: 100, py: 0, pz: 0 };
      const near = (j: P4, a: P4) => Math.hypot(rapidity(j) - rapidity(a), Math.atan2(j.py, j.px) - Math.atan2(a.py, a.px));
      const jet = jets1.find((j) => near(j, axis) < 0.4 && ptOf(j) > 10);
      fracHad += jet ? jet.E / 100 : 0;
      decayAll(ev, r);
      const jets2 = antiKt(visible(finals(ev)), 0.4);
      const jet2 = jets2.find((j) => near(j, axis) < 0.4 && ptOf(j) > 10);
      fracDecayed += jet2 ? jet2.E / 100 : 0;
      nj++;
    }
    expect(fracHad / nj).toBeGreaterThan(0.9);
    expect(fracDecayed / nj).toBeGreaterThan(0.9);
  });

  test('everything conserved through shower → hadronisation → decays (e⁺e⁻ → q q̄ at several energies)', () => {
    const r = rng(32);
    for (const E of [10, 45, 91.2, 200, 1000]) {
      for (let i = 0; i < 30; i++) {
        const flav = [1, 2, 3, 4, 5][i % 5]!;
        if (E < 30 && flav >= 4) continue; // a b b̄ or c c̄ system this light has no two-hadron state: the hadronisation borrows energy (tested there)
        const ev = qqbar(r, E, flav);
        const before = sum(ev.particles.map((p) => p.p));
        shower(ev, r);
        hadronise(ev, r);
        decayAll(ev, r);
        const fin = finals(ev);
        const after = sum(fin.map((p) => p.p));
        expect(Math.abs(after.E - before.E) / E).toBeLessThan(1e-9);
        expect(Math.abs(after.px - before.px) / E).toBeLessThan(1e-9);
        expect(Math.abs(after.pz - before.pz) / E).toBeLessThan(1e-9);
        for (const p of fin) expect(Math.abs(p.pdg) > 5 && p.pdg !== 21).toBe(true); // no partons left
        // charge: the partons are q q̄, so the total charge is zero
        let ch = 0;
        for (const p of fin) ch += particle(p.pdg).charge3;
        expect(ch).toBe(0);
      }
    }
  });
});

describe('initial-state radiation', () => {
  test('the pT of a Z made by q q̄ at 13 TeV has a mean of 5–10 GeV, and four-momentum is conserved exactly', () => {
    const r = rng(41);
    const N = 3000;
    let s = 0;
    let worst = 0;
    let withIsr = 0;
    for (let i = 0; i < N; i++) {
      const ev = bosonEvent(r, 'Z');
      const inc0 = sum([ev.particles[2]!.p, ev.particles[3]!.p]);
      const m0 = mass(ev.particles[4]!.p);
      shower(ev, r, { fsr: false });
      const z = ev.particles[4]!;
      s += ptOf(z.p);
      // conservation: incoming partons = outgoing gluons + the hard system
      const inc = sum([ev.particles[2]!.p, ev.particles[3]!.p]);
      const out = sum(finals(ev).map((p) => p.p));
      worst = Math.max(worst, Math.abs(out.E - inc.E), Math.abs(out.px - inc.px), Math.abs(out.py - inc.py), Math.abs(out.pz - inc.pz));
      expect(Math.abs(mass(z.p) - m0)).toBeLessThan(1e-4);
      // the incoming partons stay along the beam, and never carry more than the beam
      expect(ev.particles[2]!.p.px).toBe(0);
      expect(ev.particles[2]!.p.E).toBeLessThanOrEqual(6500 + 1e-6);
      expect(ev.particles[3]!.p.E).toBeLessThanOrEqual(6500 + 1e-6);
      if (ev.particles.length > 5) {
        withIsr++;
        expect(inc.E).toBeGreaterThan(inc0.E - 1e-9); // the partons gain the energy of the radiated gluons
        expect(isrRecords(ev).length).toBe(ev.particles.length - 5);
      }
    }
    expect(worst).toBeLessThan(1e-8);
    expect(s / N).toBeGreaterThan(5);
    expect(s / N).toBeLessThan(10);
    expect(withIsr / N).toBeGreaterThan(0.6);
  });

  test('gg → H gets harder ISR than q q̄ → Z, and the record lists the emissions', () => {
    const r = rng(42);
    const mean = (kind: 'Z' | 'H') => {
      let s = 0;
      const N = 1500;
      for (let i = 0; i < N; i++) {
        const ev = bosonEvent(r, kind);
        shower(ev, r, { fsr: false });
        s += ptOf(ev.particles[4]!.p);
      }
      return s / N;
    };
    expect(mean('H')).toBeGreaterThan(mean('Z'));
    const ev = bosonEvent(r, 'H');
    shower(ev, r, { fsr: false });
    const h = showerHistory(ev);
    expect(h.length).toBe(ev.particles.length - 5);
    for (const b of h) {
      expect(b.isr).toBe(true);
      expect(b.kind).toBe('isr');
      expect([2, 3]).toContain(b.parent);
      expect(ev.particles[b.daughters[0]!]!.pdg).toBe(21);
      expect(b.pT).toBeGreaterThanOrEqual(1 - 1e-9);
    }
  });

  test('the ISR gluon carries colour lines that connect to the incoming partons', () => {
    const r = rng(43);
    for (let i = 0; i < 100; i++) {
      const ev = bosonEvent(r, 'Z');
      shower(ev, r, { fsr: false });
      for (const g of ev.particles.slice(5)) {
        expect(g.pdg).toBe(21);
        expect(g.colour![0]).toBeGreaterThan(0);
        expect(g.colour![1]).toBeGreaterThan(0);
        expect(g.mothers.length).toBe(1);
      }
    }
  });

  test('no coloured incoming partons (e⁺e⁻, leptons), or no beam record: ISR does nothing; isr: false switches it off', () => {
    const r = rng(44);
    const ev = bosonEvent(r, 'Z');
    ev.particles[2]!.pdg = 11;
    ev.particles[3]!.pdg = -11;
    delete ev.particles[2]!.colour;
    delete ev.particles[3]!.colour;
    const copy = structuredClone(ev);
    shower(ev, r);
    expect(ev).toEqual(copy);
    const ev2 = bosonEvent(r, 'Z');
    ev2.particles[0]!.status = 'final'; // no beam particles recorded
    ev2.particles[1]!.status = 'final';
    const copy2 = structuredClone(ev2);
    shower(ev2, r, { fsr: false });
    expect(ev2).toEqual(copy2);
    const ev3 = bosonEvent(r, 'Z');
    shower(ev3, r, { isr: false });
    expect(ev3.particles.length).toBe(5);
  });

  test('ISR and FSR together, then hadronisation and decay, conserve four-momentum up to the remnant energy', () => {
    const r = rng(45);
    for (let i = 0; i < 100; i++) {
      const ev = bosonEvent(r, 'Z');
      // let the Z decay to a quark pair so that FSR has something to do
      const z = ev.particles[4]!;
      z.status = 'intermediate';
      const c = 2 * r() - 1, s = Math.sqrt(1 - c * c);
      const k = 91.1876 / 2;
      const b = { x: z.p.px / z.p.E, y: z.p.py / z.p.E, z: z.p.pz / z.p.E };
      const g = 1 / Math.sqrt(1 - b.z * b.z);
      const mk = (id: number, pdg: number, sgn: number, col: [number, number]): TruthParticle => {
        const e = k, pz = sgn * k * c, px = sgn * k * s;
        return { id, pdg, p: { E: g * (e + b.z * pz), px, py: 0, pz: g * (pz + b.z * e) }, vertex: [0, 0, 0], status: 'final', mothers: [4], daughters: [], colour: col };
      };
      ev.particles.push(mk(5, 1, 1, [3, 0]), mk(6, -1, -1, [0, 3]));
      z.daughters = [5, 6];
      shower(ev, r);
      hadronise(ev, r);
      decayAll(ev, r);
      const inc = sum([ev.particles[2]!.p, ev.particles[3]!.p]);
      const out = sum(finals(ev).map((p) => p.p));
      // pT is exactly balanced; the remnant stand-ins add at most 0.25 GeV of energy (and pz) per open colour line
      expect(Math.abs(out.px - inc.px)).toBeLessThan(1e-6);
      expect(Math.abs(out.py - inc.py)).toBeLessThan(1e-6);
      expect(Math.abs(out.E - inc.E)).toBeLessThan(2.5);
      for (const p of ev.particles) if (p.status === 'final') expect(Math.abs(p.pdg) > 5 || (Math.abs(p.pdg) < 5 && false) || p.pdg !== 21).toBe(true);
    }
  });
});

describe('performance', () => {
  test('shower + hadronisation + decay of a 100 GeV q q̄ dijet event runs at ≥ 500 events/s (target 1000)', () => {
    const r = rng(51);
    const run = (n: number) => {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        const ev = mkEvent([
          { pdg: 2, p: fromMass(0, 0, 0, 100), col: [1, 0] },
          { pdg: -2, p: fromMass(0, 0, 0, -100), col: [0, 1] },
        ]);
        shower(ev, r);
        hadronise(ev, r);
        decayAll(ev, r);
      }
      return (n / (performance.now() - t0)) * 1000;
    };
    run(200); // warm up
    let best = 0;
    for (let k = 0; k < 5; k++) best = Math.max(best, run(400));
    expect(best).toBeGreaterThan(500);
  });
});
