import { describe, expect, test } from 'vitest';
import { rng, type Rng } from '../random/index.ts';
import type { TruthEvent, TruthParticle } from '../event/index.ts';
import { allParticles, particle } from '../particles/index.ts';
import { decayAll } from '../decay/index.ts';
import { fromMass, mass, sum, type P4 } from '../kinematics/index.ts';
import {
  hadronise, lundStringSnapshot, sampleLundZ, samplePeterson, simulateString, stringBreaking, stringTension, candidates, hadronFor, defaultFlavour, lightestMass, type HadroniseReport,
} from './index.ts';

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Net number of each quark flavour (quarks minus antiquarks) of a parton or of a hadron, from the quark content, not from the table's quantum numbers. */
function flavourNumbers(pdg: number): Record<string, number> {
  const net: Record<string, number> = { d: 0, u: 0, s: 0, c: 0, b: 0 };
  const names = ['', 'd', 'u', 's', 'c', 'b'];
  if (Math.abs(pdg) >= 1 && Math.abs(pdg) <= 5) {
    net[names[Math.abs(pdg)]!]! += Math.sign(pdg);
    return net;
  }
  const info = particle(pdg);
  const content = particle(Math.abs(pdg)).quarks;
  if (/[+-]/.test(content)) return net; // flavour-diagonal mixtures (π⁰, η, ω …): net zero
  const sgn = pdg < 0 && !particle(Math.abs(pdg)).selfConjugate ? -1 : 1;
  void info;
  for (const m of content.match(/[udscb]~?/g) ?? []) {
    const f = m[0]!;
    net[f]! += (m.length > 1 ? -1 : 1) * sgn;
  }
  return net;
}

function partonSum(ps: TruthParticle[]): Record<string, number> {
  const tot: Record<string, number> = { d: 0, u: 0, s: 0, c: 0, b: 0 };
  for (const p of ps) for (const [k, v] of Object.entries(flavourNumbers(p.pdg))) tot[k]! += v;
  return tot;
}

function mkEvent(parts: { pdg: number; p: P4; col: [number, number] }[]): TruthEvent {
  const particles: TruthParticle[] = parts.map((q, i) => ({ id: i, pdg: q.pdg, p: q.p, vertex: [0, 0, 0], status: 'final', mothers: [], daughters: [], colour: q.col }));
  return { number: 0, weight: 1, process: 'test', sqrtS: 0, particles, primaryVertices: [[0, 0, 0]] };
}

/** A back-to-back q q̄ system of mass W in a random direction and with a random boost. */
function randomQQ(r: Rng, W: number, flav: number, boostP = 0): TruthEvent {
  const c = 2 * r() - 1, s = Math.sqrt(1 - c * c), ph = 2 * Math.PI * r();
  const m = particle(flav).mass;
  const k = Math.sqrt(Math.max(0, (W / 2) ** 2 - m * m));
  const u = [s * Math.cos(ph), s * Math.sin(ph), c] as const;
  const a = fromMass(m, k * u[0], k * u[1], k * u[2]);
  const b = fromMass(m, -k * u[0], -k * u[1], -k * u[2]);
  // boost along a random axis
  const bx = boostP / Math.sqrt(boostP * boostP + W * W);
  const boosted = (p: P4): P4 => {
    const g = 1 / Math.sqrt(1 - bx * bx);
    return { E: g * (p.E + bx * p.pz), px: p.px, py: p.py, pz: g * (p.pz + bx * p.E) };
  };
  return mkEvent([
    { pdg: flav, p: boosted(a), col: [1, 0] },
    { pdg: -flav, p: boosted(b), col: [0, 1] },
  ]);
}

const hadrons = (ev: TruthEvent): TruthParticle[] => ev.particles.filter((p) => p.status === 'final');

function check(ev: TruthEvent, partons: TruthParticle[], before: P4, rep: HadroniseReport, label: string): void {
  const hs = hadrons(ev);
  expect(hs.length, label).toBeGreaterThan(0);
  for (const h of hs) expect(() => particle(h.pdg)).not.toThrow();
  // flavour, exactly
  expect(partonSum(hs), label).toEqual(partonSum(partons));
  // and the table's own charge, baryon number, strangeness, charm
  const qn = (ps: TruthParticle[]) => {
    const t = { c: 0, b: 0, s: 0, ch: 0 };
    for (const p of ps) {
      const i = particle(p.pdg);
      t.c += i.charge3;
      t.b += i.baryon3;
      t.s += i.strangeness;
      t.ch += i.charm;
    }
    return t;
  };
  expect(qn(hs), label).toEqual(qn(partons));
  // momentum
  const tot = sum(hs.map((h) => h.p));
  const scale = Math.max(1e-3, before.E);
  expect(Math.abs(tot.E - before.E - rep.borrowedEnergy) / scale, label + ' E').toBeLessThan(1e-9);
  expect(Math.abs(tot.px - before.px) / scale, label + ' px').toBeLessThan(1e-9);
  expect(Math.abs(tot.py - before.py) / scale).toBeLessThan(1e-9);
  expect(Math.abs(tot.pz - before.pz) / scale).toBeLessThan(1e-9);
  // bookkeeping
  for (const p of partons) expect(ev.particles[p.id]!.status).toBe('intermediate');
  for (const h of hs) {
    expect(h.mothers.length).toBeGreaterThan(0);
    for (const m of h.mothers) expect(ev.particles[m]!.daughters).toContain(h.id);
  }
}

// ── tests ───────────────────────────────────────────────────────────────────────────────────────────────────────

describe('hadronisation conserves four-momentum and flavour', () => {
  test('thousands of q q̄ systems from 0.3 GeV to 1 TeV, every quark flavour, with random boosts', () => {
    const r = rng(101);
    const flavs = [1, 2, 3, 4, 5];
    let borrowedSystems = 0;
    let n = 0;
    for (let i = 0; i < 3000; i++) {
      const flav = flavs[Math.floor(r() * 5)]!;
      const logW = Math.log(0.3) + r() * (Math.log(1000) - Math.log(0.3));
      const W = Math.exp(logW);
      if (W < 2 * particle(flav).mass + 1e-3) continue;
      const ev = randomQQ(r, W, flav, r() < 0.5 ? 0 : W * 3 * r());
      const partons = ev.particles.map((p) => ({ ...p }));
      const before = sum(ev.particles.map((p) => p.p));
      let rep!: HadroniseReport;
      hadronise(ev, r, { onReport: (x) => (rep = x) });
      check(ev, partons, before, rep, `W=${W.toFixed(3)} flav=${flav}`);
      if (rep.borrowedEnergy > 0) {
        borrowedSystems++;
        // only systems lighter than the lightest two-hadron split of their flavour need borrowed energy
        const twoMin = Math.min(...[1, 2, 3].map((x) => lightestMass([flav, -x]) + lightestMass([x, -flav])));
        expect(W, `flav ${flav}`).toBeLessThan(twoMin + 0.05);
        expect(rep.borrowedEnergy).toBeLessThan(10);
      }
      n++;
    }
    expect(n).toBeGreaterThan(2000);
    expect(borrowedSystems).toBeLessThan(0.1 * n);
  });

  test('low-mass systems terminate: one or two hadrons, and no borrowing above the lightest two-hadron mass', () => {
    const r = rng(102);
    let single = 0, two = 0, n = 0;
    for (let i = 0; i < 4000; i++) {
      const flav = [1, 2, 3][Math.floor(r() * 3)]!;
      const W = 0.3 + r() * 1.7;
      const ev = randomQQ(r, W, flav);
      const partons = ev.particles.map((p) => ({ ...p }));
      const before = sum(ev.particles.map((p) => p.p));
      let rep!: HadroniseReport;
      hadronise(ev, r, { onReport: (x) => (rep = x) });
      check(ev, partons, before, rep, `W=${W.toFixed(3)}`);
      const nh = hadrons(ev).length;
      if (nh === 1) single++;
      if (nh === 2) two++;
      if (W > 1.2) expect(rep.borrowedEnergy).toBe(0);
      n++;
    }
    expect(single + two).toBeGreaterThan(0.5 * n);
    expect(single).toBeGreaterThan(0);
    expect(two).toBeGreaterThan(0);
  });

  test('strings with gluons (q g … g q̄), gluon rings (H → gg), and several systems in one event', () => {
    const r = rng(103);
    for (let i = 0; i < 1500; i++) {
      const kind = i % 3;
      const parts: { pdg: number; p: P4; col: [number, number] }[] = [];
      const rndMom = (E: number): P4 => {
        const c = 2 * r() - 1, s = Math.sqrt(1 - c * c), ph = 2 * Math.PI * r();
        return { E, px: E * s * Math.cos(ph), py: E * s * Math.sin(ph), pz: E * c };
      };
      const ng = 1 + Math.floor(r() * 6);
      if (kind === 0) {
        // q g … g q̄ with random directions and energies between 1 and 50 GeV
        parts.push({ pdg: 2, p: rndMom(1 + r() * 50), col: [1, 0] });
        for (let k = 0; k < ng; k++) parts.push({ pdg: 21, p: rndMom(1 + r() * 50), col: [k + 2, k + 1] });
        parts.push({ pdg: -2, p: rndMom(1 + r() * 50), col: [0, ng + 1] });
      } else if (kind === 1) {
        // a ring of gluons
        const n = 2 + Math.floor(r() * 4);
        for (let k = 0; k < n; k++) parts.push({ pdg: 21, p: rndMom(2 + r() * 40), col: [k + 1, ((k + n - 1) % n) + 1] });
      } else {
        // a c c̄ pair and a u ū pair, two separate colour systems
        parts.push({ pdg: 4, p: { ...fromMass(1.27, 0, 0, 30) }, col: [1, 0] });
        parts.push({ pdg: -4, p: { ...fromMass(1.27, 1, 0, -25) }, col: [0, 1] });
        parts.push({ pdg: 2, p: rndMom(20), col: [2, 0] });
        parts.push({ pdg: -2, p: rndMom(15), col: [0, 2] });
      }
      const ev = mkEvent(parts);
      const partons = ev.particles.map((p) => ({ ...p }));
      const before = sum(ev.particles.map((p) => p.p));
      let rep!: HadroniseReport;
      hadronise(ev, r, { onReport: (x) => (rep = x) });
      if (kind === 1 && parts.length === 2) continue;
      check(ev, partons, before, rep, `kind ${kind} #${i}`);
      expect(rep.remnants).toBe(0);
    }
  });

  test('open colour lines (partons connected to the beams) hadronise, conserve three-momentum and flavour pairs, and add at most the remnant energy', () => {
    const r = rng(104);
    for (let i = 0; i < 500; i++) {
      // a lone ISR-like gluon, a quark with its colour partner in the beam, a gluon pair
      const rndMom = (E: number): P4 => {
        const c = 2 * r() - 1, s = Math.sqrt(1 - c * c), ph = 2 * Math.PI * r();
        return { E, px: E * s * Math.cos(ph), py: E * s * Math.sin(ph), pz: E * c };
      };
      const ev = mkEvent([
        { pdg: 21, p: rndMom(5 + 30 * r()), col: [10, 11] },
        { pdg: 2, p: rndMom(20 + 50 * r()), col: [12, 0] },
        { pdg: 21, p: rndMom(20 + 50 * r()), col: [13, 12] },
      ]);
      const before = sum(ev.particles.map((p) => p.p));
      let rep!: HadroniseReport;
      hadronise(ev, r, { remnantEnergy: 0.25, onReport: (x) => (rep = x) });
      const hs = hadrons(ev);
      expect(rep.remnants).toBeGreaterThanOrEqual(2);
      const tot = sum(hs.map((h) => h.p));
      // the remnants put in energy along the beam: pT is conserved exactly, E and pz change by at most 0.25 GeV per remnant
      expect(Math.abs(tot.px - before.px)).toBeLessThan(1e-9);
      expect(Math.abs(tot.py - before.py)).toBeLessThan(1e-9);
      expect(Math.abs(tot.E - before.E)).toBeLessThan(0.25 * rep.remnants + 1e-6);
      expect(Math.abs(tot.pz - before.pz)).toBeLessThan(0.25 * rep.remnants + 1e-6);
      for (const p of ev.particles.filter((q) => q.pdg === 21 || Math.abs(q.pdg) < 6)) expect(p.status).toBe('intermediate');
    }
  });

  test('the same seed gives the same event', () => {
    const run = () => {
      const r = rng(77);
      const ev = randomQQ(r, 50, 3);
      hadronise(ev, r);
      return hadrons(ev).map((h) => `${h.pdg}:${h.p.E.toFixed(9)}`).join(' ');
    };
    expect(run()).toBe(run());
  });

  test('partons with no colour labels get a sensible colour flow', () => {
    const r = rng(105);
    const ev = mkEvent([
      { pdg: 1, p: fromMass(0.3, 0, 0, 20), col: [0, 0] },
      { pdg: 21, p: { E: 10, px: 10, py: 0, pz: 0 }, col: [0, 0] },
      { pdg: -1, p: fromMass(0.3, -10, 0, -20), col: [0, 0] },
    ]);
    for (const p of ev.particles) delete p.colour;
    const partons = ev.particles.map((p) => ({ ...p }));
    const before = sum(ev.particles.map((p) => p.p));
    let rep!: HadroniseReport;
    hadronise(ev, r, { onReport: (x) => (rep = x) });
    check(ev, partons, before, rep, 'no colour');
  });
});

describe('fragmentation functions', () => {
  test('the Lund symmetric function is sampled correctly (χ² against the numerical density)', () => {
    const r = rng(106);
    const a = 0.68, b = 0.98;
    for (const mT2 of [0.1, 0.4, 1.2]) {
      const c = b * mT2;
      const f = (z: number) => Math.pow(1 - z, a) * Math.exp(-c / z) / z;
      const nb = 20;
      const edges = Array.from({ length: nb + 1 }, (_, i) => (i / nb) ** 1.5);
      const exp: number[] = [];
      let total = 0;
      for (let i = 0; i < nb; i++) {
        // Simpson with substitution u = ln z to tame the 1/z
        const lo = Math.max(edges[i]!, 1e-9), hi = edges[i + 1]!;
        const m = 400;
        let s = 0;
        for (let k = 0; k < m; k++) {
          const u = Math.log(lo) + ((k + 0.5) / m) * (Math.log(hi) - Math.log(lo));
          const z = Math.exp(u);
          s += f(z) * z * ((Math.log(hi) - Math.log(lo)) / m);
        }
        exp.push(s);
        total += s;
      }
      const N = 60000;
      const obs = new Array(nb).fill(0);
      for (let i = 0; i < N; i++) {
        const z = sampleLundZ(r, mT2, a, b);
        expect(z).toBeGreaterThan(0);
        expect(z).toBeLessThan(1);
        let k = 0;
        while (k < nb - 1 && z >= edges[k + 1]!) k++;
        obs[k]++;
      }
      let chi2 = 0, dof = 0;
      for (let i = 0; i < nb; i++) {
        const e = (exp[i]! / total) * N;
        if (e < 5) continue;
        chi2 += (obs[i] - e) ** 2 / e;
        dof++;
      }
      expect(chi2 / dof, `mT²=${mT2}`).toBeLessThan(2.2);
    }
  });

  test('Peterson fragmentation is hard for heavy quarks: mean z ≈ 0.6–0.7 for ε = 0.05 and ≈ 0.8 for ε = 0.005', () => {
    const r = rng(107);
    const mean = (eps: number) => {
      let s = 0;
      const N = 20000;
      for (let i = 0; i < N; i++) s += samplePeterson(r, eps);
      return s / N;
    };
    const mc = mean(0.05), mb = mean(0.005);
    expect(mc).toBeGreaterThan(0.55);
    expect(mc).toBeLessThan(0.75);
    expect(mb).toBeGreaterThan(mc + 0.05);
    expect(mb).toBeLessThan(0.9);
  });
});

describe('the physics of the toy model', () => {
  test('mean multiplicity grows with the string energy and is in a realistic range at 91 GeV', () => {
    const r = rng(108);
    const mult = (W: number) => {
      let s = 0;
      const N = 200;
      for (let i = 0; i < N; i++) {
        const ev = randomQQ(r, W, 2);
        hadronise(ev, r);
        s += hadrons(ev).length;
      }
      return s / N;
    };
    const m10 = mult(10), m30 = mult(30), m91 = mult(91.2), m300 = mult(300);
    expect(m10).toBeLessThan(m30);
    expect(m30).toBeLessThan(m91);
    expect(m91).toBeLessThan(m300);
    // a bare string (no shower) makes fewer hadrons than a full event at LEP (about 30 before decays), but the same order
    expect(m91).toBeGreaterThan(8);
    expect(m91).toBeLessThan(28);
  });

  test('hadron pT relative to the string axis is a few hundred MeV', () => {
    const r = rng(109);
    let s = 0, n = 0;
    for (let i = 0; i < 300; i++) {
      const ev = new Object() as TruthEvent;
      Object.assign(ev, mkEvent([
        { pdg: 2, p: fromMass(0, 0, 0, 45.6), col: [1, 0] },
        { pdg: -2, p: fromMass(0, 0, 0, -45.6), col: [0, 1] },
      ]));
      hadronise(ev, r);
      for (const h of hadrons(ev)) {
        s += Math.hypot(h.p.px, h.p.py);
        n++;
      }
    }
    expect(s / n).toBeGreaterThan(0.25);
    expect(s / n).toBeLessThan(0.65);
  });

  test('the leading hadron of a heavy quark is harder than that of a light quark (Peterson)', () => {
    const r = rng(110);
    const lead = (flav: number) => {
      let s = 0;
      const N = 300;
      for (let i = 0; i < N; i++) {
        const W = 91.2;
        const ev = randomQQ(r, W, flav);
        hadronise(ev, r);
        // the hadron that carries the flavour of the quark and has the largest energy
        let best = 0;
        for (const h of hadrons(ev)) {
          const f = flavourNumbers(h.pdg);
          const name = ['', 'd', 'u', 's', 'c', 'b'][flav]!;
          if (f[name]! !== 0 && h.p.E > best) best = h.p.E;
        }
        s += best / (W / 2);
      }
      return s / N;
    };
    const xl = lead(2), xc = lead(4), xb = lead(5);
    expect(xc).toBeGreaterThan(0.5);
    expect(xc).toBeGreaterThan(xl + 0.1);
    expect(xb).toBeGreaterThan(xc);
  });

  test('strangeness suppression: K±/π± ratio between 0.07 and 0.25 after the decays of ρ, ω, η …', () => {
    const r = rng(111);
    let k = 0, pi = 0;
    for (let i = 0; i < 300; i++) {
      const ev = randomQQ(r, 91.2, 2);
      hadronise(ev, r);
      decayAll(ev, r);
      for (const h of hadrons(ev)) {
        const a = Math.abs(h.pdg);
        if (a === 321) k++;
        if (a === 211) pi++;
      }
    }
    expect(k / pi).toBeGreaterThan(0.07);
    expect(k / pi).toBeLessThan(0.25);
  });

  test('baryon production is at the level of ten per cent of the hadrons', () => {
    const r = rng(112);
    let b = 0, n = 0;
    for (let i = 0; i < 300; i++) {
      const ev = randomQQ(r, 91.2, 2);
      hadronise(ev, r);
      for (const h of hadrons(ev)) {
        n++;
        if (particle(h.pdg).kind === 'baryon') b++;
      }
    }
    expect(b / n).toBeGreaterThan(0.03);
    expect(b / n).toBeLessThan(0.2);
  });

  test('species come from the particle table and only produce what the table has', () => {
    const r = rng(113);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const ev = randomQQ(r, [20, 91, 300][i % 3]!, [1, 2, 3, 4, 5][i % 5]!);
      hadronise(ev, r);
      for (const h of hadrons(ev)) seen.add(Math.abs(h.pdg));
    }
    for (const pdg of [211, 111, 321, 113, 223, 2212, 2112]) expect(seen.has(pdg), particle(pdg).name).toBe(true);
    // every mesonic/baryonic content the model draws maps to a table entry or to nothing (never to an unknown id)
    for (const x of [1, 2, 3, 4, 5]) for (const y of [1, 2, 3, 4, 5]) {
      for (const pdg of candidates([x, -y])) expect(() => particle(pdg)).not.toThrow();
    }
    expect(hadronFor([4, -5], rng(1), defaultFlavour)).toBe(0); // no B_c in the table: handled by a two-hadron split
    expect(allParticles().length).toBeGreaterThan(50);
  });
});

describe('the string picture', () => {
  test('potential energy is κr with κ = 0.2 GeV² ≈ 1 GeV/fm; breaking is impossible below threshold and more likely when stretched', () => {
    expect(stringTension).toBe(0.2);
    const one = stringBreaking(1);
    expect(one.potentialGeV).toBeCloseTo(1.0136, 3);
    expect(one.probability).toBeLessThan(0.05);
    expect(stringBreaking(3).potentialGeV).toBeCloseTo(3 * one.potentialGeV, 9);
    let prev = 0;
    for (const d of [0, 0.5, 1, 2, 3, 4, 6, 10]) {
      const s = stringBreaking(d);
      expect(s.probability).toBeGreaterThanOrEqual(prev);
      expect(s.probability).toBeLessThanOrEqual(1);
      prev = s.probability;
      expect(s.probabilityStrange).toBeLessThanOrEqual(s.probability + 1e-12);
    }
    const thr = one.thresholdFm;
    expect(thr).toBeCloseTo((2 * 0.4) / 1.0136, 1);
    expect(stringBreaking(thr * 0.99).probability).toBe(0);
    expect(stringBreaking(10).probability).toBeGreaterThan(0.9);
    expect(stringBreaking(4).probability).toBeGreaterThan(0.3);
    expect(stringBreaking(4).probability).toBeLessThan(0.9);
  });

  test('lundStringSnapshot gives break points and created pairs for a q q̄ string, consistent with the hadron momenta', () => {
    const r = rng(114);
    for (let i = 0; i < 50; i++) {
      const W = 20 + 80 * r();
      const ev = randomQQ(r, W, 2);
      hadronise(ev, r);
      const strs = lundStringSnapshot(ev);
      expect(strs.length).toBe(1);
      expect(strs[0]!.partons).toEqual([0, 1]);
      const seg = strs[0]!.segments[0]!;
      expect(strs[0]!.segments.length).toBe(1);
      expect(seg.hadrons.length).toBe(hadrons(ev).length);
      expect(seg.breaks.length).toBe(seg.hadrons.length - 1);
      expect(seg.truth.length).toBe(seg.hadrons.length);
      for (const t of seg.truth) expect(ev.particles[t]!.status).toBe('final');
      expect(seg.W).toBeCloseTo(W, 6);
      const sp = seg.pPlus.reduce((a, b) => a + b, 0), sm = seg.pMinus.reduce((a, b) => a + b, 0);
      // Σp⁺ = Σp⁻ = W, except when the last step makes a single hadron whose energy is not the remnant's (off by about the remnant mass)
      expect(Math.abs(sp - W)).toBeLessThan(1.5);
      expect(Math.abs(sm - W)).toBeLessThan(1.5);
      let xp = Infinity, xm = -Infinity;
      for (const bp of seg.breaks) {
        expect(bp.xPlus).toBeLessThanOrEqual(xp);
        expect(bp.xMinus).toBeGreaterThanOrEqual(xm);
        xp = bp.xPlus;
        xm = bp.xMinus;
        expect(bp.t).toBeCloseTo((bp.xPlus + bp.xMinus) / 2, 12);
        expect(bp.z).toBeCloseTo((bp.xPlus - bp.xMinus) / 2, 12);
        expect(bp.pair).toBeGreaterThanOrEqual(1);
        expect(bp.pair === 1 || bp.pair === 2 || bp.pair === 3 || bp.pair >= 11).toBe(true);
      }
    }
    // a stand-alone string, for a widget
    const snap = simulateString(rng(9), 30, 3);
    expect(snap.hadrons.length).toBeGreaterThan(2);
    expect(snap.breaks.length).toBe(snap.hadrons.length - 1);
    // the leading hadron contains the strange quark (η′ has no quark string in the table)
    const lead = Math.abs(snap.hadrons[0]!);
    expect(lead === 331 || particle(lead).quarks.includes('s')).toBe(true);
  });

  test('a copy of the event has no string records (they are kept per object)', () => {
    const r = rng(115);
    const ev = randomQQ(r, 40, 2);
    hadronise(ev, r);
    expect(lundStringSnapshot(ev).length).toBe(1);
    expect(lundStringSnapshot(structuredClone(ev)).length).toBe(0);
    expect(mass(sum(hadrons(ev).map((h) => h.p)))).toBeCloseTo(40, 6);
  });
});
