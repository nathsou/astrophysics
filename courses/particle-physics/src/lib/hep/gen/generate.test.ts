import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { charge, particle } from '../particles/index.ts';
import { invariantMass, mass } from '../kinematics/index.ts';
import type { TruthEvent } from '../event/index.ts';
import { HOOKS, generate, getProcess, listProcesses } from './index.ts';
import { colourFlowValid, conservation } from './process.ts';

const colourless = new Set(['minbias', 'minimumbias']);

describe('the registry and the hard processes', () => {
  test('every registered process gives records that conserve energy, momentum and charge to 1e-9 and have a valid colour flow', () => {
    const names = listProcesses().filter((n) => !colourless.has(n));
    expect(names.length).toBeGreaterThan(30);
    const done = new Set<unknown>();
    for (const name of names) {
      const p = getProcess(name);
      if (done.has(p)) continue;
      done.add(p);
      const sqrtS = p.beams === 'ee' ? (name === 'ee->tt' ? 500 : 91.2) : p.beams === 'ppbar' ? 1960 : 13000;
      const r = rng(1);
      for (let i = 0; i < 60; i++) {
        const { event, weight } = p.generate(r, { sqrtS });
        expect(weight).toBe(1);
        expect(event.sqrtS).toBe(sqrtS);
        const c = conservation(event, charge);
        expect(Math.abs(c.dE), name).toBeLessThan(1e-9 * sqrtS);
        expect(Math.abs(c.dpx), name).toBeLessThan(1e-9 * sqrtS);
        expect(Math.abs(c.dpy), name).toBeLessThan(1e-9 * sqrtS);
        expect(Math.abs(c.dpz), name).toBeLessThan(1e-9 * sqrtS);
        expect(c.dCharge, name).toBe(0);
        expect(colourFlowValid(event), name).toBe(true);
        event.particles.forEach((q, k) => {
          expect(q.id).toBe(k);
          for (const m of q.mothers) expect(event.particles[m]!.daughters).toContain(k);
          for (const d of q.daughters) expect(event.particles[d]!.mothers).toContain(k);
        });
      }
    }
  });
  test('unknown names give a helpful error; aliases map to the same process', () => {
    expect(() => getProcess('pp->unicorn')).toThrow(/available:/);
    expect(getProcess('ee->qq')).toBe(getProcess('ee->qq'));
    expect(getProcess('ee->hadrons').name).toBe('ee->qq');
    expect(HOOKS).toEqual(['gen.unweight', 'gen.dsigmaEeMuMu']);
  });
  test('weighted events carry the weight in pb; its mean is the cross-section', () => {
    const p = getProcess('pp->Z->mumu');
    const r = rng(2);
    let s = 0;
    const n = 6000;
    for (let i = 0; i < n; i++) {
      const { event, weight } = p.generate(r, { sqrtS: 13000, weighted: true });
      expect(event.weight).toBe(weight);
      s += weight;
    }
    expect(Math.abs(s / n / p.sigma(13000) - 1)).toBeLessThan(0.03);
  });
});

describe('generate: hard process → shower → hadronisation → decays', () => {
  test('determinism: the same seed gives the same event, another seed a different one', () => {
    const sig = (ev: TruthEvent) => JSON.stringify(ev.particles.map((p) => [p.pdg, p.status, p.p.E, p.p.px, p.vertex[2]]));
    const a = generate('pp->Z->mumu', { sqrtS: 13000, pileup: 3 }, rng(7));
    const b = generate('pp->Z->mumu', { sqrtS: 13000, pileup: 3 }, rng(7));
    const c = generate('pp->Z->mumu', { sqrtS: 13000, pileup: 3 }, rng(8));
    const d = generate('pp->Z->mumu', { sqrtS: 13000, pileup: 3, seed: 7 });
    expect(sig(a)).toBe(sig(b));
    expect(sig(a)).toBe(sig(d));
    expect(sig(a)).not.toBe(sig(c));
  });
  test('pp → Z → μμ: two muons near the Z mass among many hadrons; the hard-scatter record is in collision 0 at the primary vertex', () => {
    const r = rng(3);
    const masses: number[] = [];
    for (let i = 0; i < 100; i++) {
      const ev = generate('pp->Z->mumu', { sqrtS: 13000 }, r);
      expect(ev.process).toContain('Z');
      expect(ev.primaryVertices.length).toBe(1);
      const mu = ev.particles.filter((p) => Math.abs(p.pdg) === 13 && p.status === 'final' && p.mothers.some((m) => ev.particles[m]!.pdg === 23));
      expect(mu.length).toBe(2);
      masses.push(invariantMass(mu.map((p) => p.p)));
      expect(ev.particles.length).toBeGreaterThan(10);
      for (const p of ev.particles) expect(p.collision).toBe(0);
    }
    masses.sort((a, b) => a - b);
    expect(masses[50]).toBeGreaterThan(85);
    expect(masses[50]).toBeLessThan(95);
  });
  test('e⁺e⁻ → qq̄ at the Z: hadrons, total energy and net charge of the final state', () => {
    const r = rng(4);
    for (let i = 0; i < 30; i++) {
      const ev = generate('ee->qq', { sqrtS: 91.2 }, r);
      const fin = ev.particles.filter((p) => p.status === 'final');
      expect(fin.length).toBeGreaterThan(8);
      let q3 = 0;
      for (const p of fin) q3 += particle(p.pdg).charge3;
      expect(q3).toBe(0);
      const E = fin.reduce((s, p) => s + p.p.E, 0);
      expect(Math.abs(E - 91.2)).toBeLessThan(0.05 * 91.2);
    }
  });
  test('switching the stages off leaves the matrix-element record', () => {
    const r = rng(5);
    const ev = generate('pp->Z->mumu', { sqrtS: 13000, shower: false, hadronise: false, decay: false }, r);
    expect(ev.particles.length).toBe(7);
    expect(ev.particles.filter((p) => p.status === 'final').length).toBe(2);
    const dec = generate('pp->H->gammagamma', { sqrtS: 13000, shower: false, hadronise: false, decay: false }, r);
    expect(dec.particles.some((p) => p.status === 'decayed')).toBe(false);
    const none = generate(getProcess('pp->H'), { sqrtS: 13000, shower: false, hadronise: false, decay: true }, r);
    expect(none.particles.some((p) => p.status === 'decayed' && p.pdg === 25)).toBe(true);
  });
  test('the primary vertex is drawn from the luminous region: σz = 50 mm, σx = σy = 15 µm (and is configurable)', () => {
    const r = rng(6);
    const n = 1500;
    let z2 = 0, x2 = 0, y2 = 0;
    for (let i = 0; i < n; i++) {
      const ev = generate('pp->Z->mumu', { sqrtS: 13000, shower: false, hadronise: false, decay: false }, r);
      const [x, y, z] = ev.primaryVertices[0]!;
      x2 += x * x;
      y2 += y * y;
      z2 += z * z;
      for (const p of ev.particles) expect(p.vertex).toEqual(ev.primaryVertices[0]);
    }
    expect(Math.sqrt(z2 / n)).toBeGreaterThan(50 * 0.93);
    expect(Math.sqrt(z2 / n)).toBeLessThan(50 * 1.07);
    expect(Math.sqrt(x2 / n)).toBeGreaterThan(0.015 * 0.92);
    expect(Math.sqrt(x2 / n)).toBeLessThan(0.015 * 1.08);
    expect(Math.sqrt(y2 / n)).toBeGreaterThan(0.015 * 0.92);
    expect(Math.sqrt(y2 / n)).toBeLessThan(0.015 * 1.08);
    const ev = generate('pp->Z->mumu', { sqrtS: 13000, pileup: 300, shower: false, hadronise: false, beamSpot: { sigmaZ: 10, sigmaXY: 0.1 } }, r);
    const zs = ev.primaryVertices.map((v) => v[2]);
    const sd = Math.sqrt(zs.reduce((s, z) => s + z * z, 0) / zs.length);
    expect(sd).toBeGreaterThan(8.5);
    expect(sd).toBeLessThan(11.5);
  });
  test('pile-up: n extra collisions, each with its primary vertex, collision index, and self-contained links; the hard scatter is unchanged by it', () => {
    const r = rng(7);
    const ev = generate('pp->Z->mumu', { sqrtS: 13000, pileup: 25 }, r);
    expect(ev.primaryVertices.length).toBe(26);
    const counts = new Array<number>(26).fill(0);
    ev.particles.forEach((p, k) => {
      expect(p.id).toBe(k);
      expect(p.collision).toBeDefined();
      counts[p.collision!]!++;
      for (const m of p.mothers) expect(ev.particles[m]!.collision).toBe(p.collision);
      for (const d of p.daughters) expect(ev.particles[d]!.collision).toBe(p.collision);
    });
    for (let k = 1; k <= 25; k++) expect(counts[k]).toBeGreaterThan(0);
    expect(counts.slice(1).reduce((a, b) => a + b, 0) / 25).toBeGreaterThan(80); // a minimum-bias collision has of the order of 100 particles after π⁰ decays
    // the first particle of every pile-up collision is produced at that collision's primary vertex
    for (let k = 1; k <= 25; k++) {
      const first = ev.particles.find((p) => p.collision === k && p.mothers.length === 0)!;
      expect(first.vertex).toEqual(ev.primaryVertices[k]);
    }
    // the hard-scatter leptons are the same as without pile-up (same seed, and pile-up is generated afterwards)
    const plain = generate('pp->Z->mumu', { sqrtS: 13000 }, rng(7));
    const muA = ev.particles.filter((p) => p.collision === 0 && Math.abs(p.pdg) === 13 && p.status === 'final');
    const muB = plain.particles.filter((p) => Math.abs(p.pdg) === 13 && p.status === 'final');
    expect(muA.map((p) => p.p.E)).toEqual(muB.map((p) => p.p.E));
    // a Poisson number of collisions with `pileupMean`
    let tot = 0;
    const r2 = rng(8);
    for (let i = 0; i < 60; i++) tot += generate('ee->mumu', { sqrtS: 91.2, pileupMean: 4, shower: false, hadronise: false, decay: false }, r2).primaryVertices.length - 1;
    expect(tot / 60).toBeGreaterThan(3.2);
    expect(tot / 60).toBeLessThan(4.8);
  });
  test('decay products keep their production vertex chain: secondary vertices are displaced from the primary vertex', () => {
    const r = rng(9);
    const ev = generate('pp->ttbar', { sqrtS: 13000 }, r);
    const pv = ev.primaryVertices[0]!;
    const decayed = ev.particles.filter((p) => p.status === 'decayed' && p.endVertex);
    expect(decayed.length).toBeGreaterThan(5);
    const displaced = decayed.filter((p) => Math.hypot(p.endVertex![0] - pv[0], p.endVertex![1] - pv[1], p.endVertex![2] - pv[2]) > 1e-3);
    expect(displaced.length).toBeGreaterThan(0);
    expect(mass(ev.particles.find((p) => p.pdg === 6)!.p)).toBeCloseTo(particle(6).mass, 6);
  });
});
