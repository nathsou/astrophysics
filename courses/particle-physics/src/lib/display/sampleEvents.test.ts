import { describe, expect, it } from 'vitest';
import { eta, mass, pt, phi, sum, type P4 } from '../hep/kinematics/index.ts';
import { particle } from '../hep/particles/index.ts';
import type { FullEvent } from '../hep/event/index.ts';
import { defaultGeometry } from './geometry.ts';
import { helixFromMomentum, pathToRadius, pointAt } from './helix.ts';
import { gunEvent, resolveSampleName, sampleEvent, sampleEvents, SAMPLE_NAMES } from './sampleEvents.ts';

const close = (a: P4, b: P4, tol = 1e-6) => {
  for (const k of ['E', 'px', 'py', 'pz'] as const) expect(Math.abs(a[k] - b[k])).toBeLessThan(tol * Math.max(1, Math.abs(b[k])));
};
const charge = (pdg: number) => particle(pdg).charge3 / 3;
const finals = (e: FullEvent) => e.truth!.particles.filter((p) => p.status === 'final');

describe('sample events: determinism and structure', () => {
  it('the same name and seed give the same event; a different seed differs', () => {
    const a = sampleEvent('zmumu', { seed: 4 });
    const b = sampleEvent('zmumu', { seed: 4 });
    const c = sampleEvent('zmumu', { seed: 5 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });
  it('spellings of the names resolve', () => {
    expect(resolveSampleName('weν')).toBe('wenu');
    expect(resolveSampleName('W->eν')).toBe('wenu');
    expect(resolveSampleName('H4e')).toBe('h4e');
    expect(resolveSampleName(undefined)).toBe('zmumu');
    expect(resolveSampleName('pileup')).toBe('pileup');
  });
  it('sampleEvents gives consecutive seeds', () => {
    const l = sampleEvents('dijet', 3, 10);
    expect(l.map((e) => e.truth!.number)).toEqual([10, 11, 12]);
  });
  for (const name of SAMPLE_NAMES) {
    if (name === 'stress') continue;
    it(`${name}: indices are consistent`, () => {
      const e = sampleEvent(name, { seed: 2 });
      const t = e.truth!, d = e.detector!, r = e.reco;
      t.particles.forEach((p, i) => {
        expect(p.id).toBe(i);
        for (const m of p.mothers) expect(t.particles[m]!.daughters).toContain(i);
        for (const k of p.daughters) expect(t.particles[k]!.mothers).toContain(i);
      });
      for (const h of d.hits) expect(h.truth).toBeGreaterThanOrEqual(-1);
      for (const h of d.hits) expect(h.truth).toBeLessThan(t.particles.length);
      for (const c of d.cells) for (const k of c.truth) expect(t.particles[k]).toBeDefined();
      for (const tr of r.tracks) {
        for (const h of tr.hits) expect(d.hits[h]).toBeDefined();
        expect(t.particles[tr.truth]).toBeDefined();
      }
      for (const c of r.clusters) for (const k of c.cells) expect(d.cells[k]).toBeDefined();
      for (const o of r.objects) {
        for (const k of o.tracks ?? []) expect(r.tracks[k]).toBeDefined();
        for (const k of o.clusters ?? []) expect(r.clusters[k]).toBeDefined();
      }
      expect(t.primaryVertices.length).toBe(1 + (d.pileup ?? 0));
      expect(r.vertices.length).toBe(t.primaryVertices.length);
      expect(r.vertices[0]!.kind).toBe('primary');
    });
  }
});

describe('sample events: momentum and charge', () => {
  it('Z → μμ: the muons add up to the Z, which has the Z mass; charge is conserved', () => {
    for (const seed of [1, 2, 3]) {
      const e = sampleEvent('zmumu', { seed });
      const z = e.truth!.particles.find((p) => p.pdg === 23)!;
      const mus = z.daughters.map((i) => e.truth!.particles[i]!);
      expect(mus.map((m) => m.pdg).sort()).toEqual([-13, 13]);
      close(sum(mus.map((m) => m.p)), z.p);
      expect(mass(z.p)).toBeGreaterThan(60);
      expect(mass(z.p)).toBeLessThan(120);
      expect(mus.reduce((a, m) => a + charge(m.pdg), 0)).toBe(charge(23));
      for (const m of mus) expect(mass(m.p)).toBeCloseTo(particle(13).mass, 6);
    }
  });
  it('H → 4e: two Z decays add up to the Higgs; the four electrons sum to m_H', () => {
    const e = sampleEvent('h4e', { seed: 1 });
    const h = e.truth!.particles.find((p) => p.pdg === 25)!;
    const zs = h.daughters.map((i) => e.truth!.particles[i]!);
    expect(zs).toHaveLength(2);
    close(sum(zs.map((z) => z.p)), h.p);
    const els = zs.flatMap((z) => z.daughters.map((i) => e.truth!.particles[i]!));
    expect(els).toHaveLength(4);
    close(sum(els.map((x) => x.p)), h.p);
    expect(mass(h.p)).toBeCloseTo(125.2, 6);
    expect(els.reduce((a, x) => a + charge(x.pdg), 0)).toBe(0);
  });
  it('W → eν: charge and momentum conserved; the neutrino is the missing pT', () => {
    const e = sampleEvent('wenu', { seed: 2 });
    const w = e.truth!.particles.find((p) => Math.abs(p.pdg) === 24)!;
    const d = w.daughters.map((i) => e.truth!.particles[i]!);
    close(sum(d.map((x) => x.p)), w.p);
    expect(d.reduce((a, x) => a + charge(x.pdg), 0)).toBe(charge(w.pdg));
    const nu = d.find((x) => [12, 14, 16].includes(Math.abs(x.pdg)))!;
    const met = Math.hypot(e.reco.met.x, e.reco.met.y);
    expect(Math.abs(met - pt(nu.p))).toBeLessThan(25);
    expect(met).toBeGreaterThan(15);
  });
  it('H → γγ has two photons that add up to 125 GeV', () => {
    const e = sampleEvent('hgg', { seed: 1 });
    const h = e.truth!.particles.find((p) => p.pdg === 25)!;
    const g = h.daughters.map((i) => e.truth!.particles[i]!);
    expect(g.map((x) => x.pdg)).toEqual([22, 22]);
    expect(mass(sum(g.map((x) => x.p)))).toBeCloseTo(125.2, 5);
  });
  it('dijet: hadrons add up to their parton; π⁰ add up to their photons; the partons are back to back', () => {
    const e = sampleEvent('dijet', { seed: 1 });
    const t = e.truth!;
    const partons = t.particles.filter((p) => p.status === 'decayed' && (Math.abs(p.pdg) <= 4 || p.pdg === 21));
    expect(partons).toHaveLength(2);
    for (const pa of partons) {
      close(sum(pa.daughters.map((i) => t.particles[i]!.p)), pa.p);
      expect(pa.daughters.length).toBeGreaterThan(3);
    }
    for (const pi0 of t.particles.filter((p) => p.pdg === 111)) close(sum(pi0.daughters.map((i) => t.particles[i]!.p)), pi0.p, 1e-5);
    expect(Math.abs(Math.abs(phi(partons[0]!.p) - phi(partons[1]!.p)) - Math.PI)).toBeLessThan(0.2);
  });
  it('the hard-scatter visible transverse momentum balances the neutrinos (W → eν)', () => {
    const e = sampleEvent('wenu', { seed: 3 });
    const vis = sum(finals(e).filter((p) => p.collision === 0 && ![12, 14, 16].includes(Math.abs(p.pdg)) && Math.abs(eta(p.p)) < 10).map((p) => p.p));
    const nu = sum(finals(e).filter((p) => [12, 14, 16].includes(Math.abs(p.pdg))).map((p) => p.p));
    // not exactly zero (the underlying event is not balanced), but the same order as the neutrino
    expect(Math.hypot(vis.px + nu.px, vis.py + nu.py)).toBeLessThan(40);
  });
});

describe('sample events: detector response', () => {
  it('tracker hits lie on the layer cylinders and on the truth helix', () => {
    const e = sampleEvent('zmumu', { seed: 3 });
    const g = defaultGeometry;
    for (const h of e.detector!.hits) {
      if (h.truth < 0) continue;
      expect(Math.hypot(h.x, h.y)).toBeGreaterThan(g.tracker[h.layer]!.r - 0.3);
      expect(Math.hypot(h.x, h.y)).toBeLessThan(g.tracker[h.layer]!.r + 0.3);
      const p = e.truth!.particles[h.truth]!;
      const hx = helixFromMomentum(charge(p.pdg), p.p.px, p.p.py, p.p.pz, p.vertex, g.bField);
      const s = pathToRadius(hx, g.tracker[h.layer]!.r)!;
      const q = pointAt(hx, s);
      expect(Math.hypot(h.x - q[0], h.y - q[1], h.z - q[2])).toBeLessThan(1);
    }
  });
  it('reco tracks have the truth charge and a pT within a few per cent', () => {
    const e = sampleEvent('pileup', { seed: 1 });
    expect(e.reco.tracks.length).toBeGreaterThan(50);
    for (const t of e.reco.tracks) {
      const p = e.truth!.particles[t.truth]!;
      expect(t.charge).toBe(Math.sign(charge(p.pdg)));
      expect(Math.abs(t.pt / pt(p.p) - 1)).toBeLessThan(0.08);
      expect(Math.abs(t.eta - eta(p.p))).toBeLessThan(0.01);
      expect(t.pt).toBeGreaterThan(0.5);
      expect(Math.abs(t.eta)).toBeLessThan(2.5);
      expect(t.hits.length).toBeGreaterThanOrEqual(4);
    }
  });
  it('the reconstructed muons of a Z are the truth muons, with the right charge', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const e = sampleEvent('zmumu', { seed });
      const mus = e.reco.objects.filter((o) => o.kind === 'muon');
      expect(mus).toHaveLength(2);
      for (const m of mus) {
        const tp = e.truth!.particles[m.truth]!;
        expect(Math.abs(tp.pdg)).toBe(13);
        expect(Math.sign(m.charge!)).toBe(Math.sign(charge(tp.pdg)));
        expect(Math.abs(pt(m.p) / pt(tp.p) - 1)).toBeLessThan(0.08);
      }
      expect(e.detector!.muonHits.length).toBeGreaterThanOrEqual(2 * defaultGeometry.muon.length - 2);
      expect(e.trigger).toContain('HLT_IsoMu24');
    }
  });
  it('H → 4e gives four reconstructed electrons (most of the time) with energy from the ECAL', () => {
    let n = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const e = sampleEvent('h4e', { seed });
      const el = e.reco.objects.filter((o) => o.kind === 'electron');
      n += el.length;
      for (const o of el) {
        expect(o.clusters).toHaveLength(1);
        const tp = e.truth!.particles[o.truth]!;
        expect(Math.abs(pt(o.p) / pt(tp.p) - 1)).toBeLessThan(0.15);
      }
    }
    expect(n).toBeGreaterThanOrEqual(20);
  });
  it('H → γγ gives two photons without tracks', () => {
    const e = sampleEvent('hgg', { seed: 2 });
    const g = e.reco.objects.filter((o) => o.kind === 'photon');
    expect(g).toHaveLength(2);
    for (const o of g) expect(o.tracks).toEqual([]);
  });
  it('the dijet has two jets, back to back, with energy close to the partons', () => {
    const e = sampleEvent('dijet', { seed: 1 });
    const jets = e.reco.objects.filter((o) => o.kind === 'jet');
    expect(jets.length).toBeGreaterThanOrEqual(2);
    const partons = e.truth!.particles.filter((p) => p.status === 'decayed' && (Math.abs(p.pdg) <= 4 || p.pdg === 21));
    for (const pa of partons) {
      const j = jets.find((x) => x.truth === pa.id);
      expect(j).toBeDefined();
      expect(pt(j!.p) / pt(pa.p)).toBeGreaterThan(0.6);
      expect(pt(j!.p) / pt(pa.p)).toBeLessThan(1.3);
    }
  });
  it('calorimeter energy is conserved to a reasonable factor', () => {
    const e = sampleEvent('dijet', { seed: 2 });
    const inCalo = finals(e).filter((p) => Math.abs(eta(p.p)) < 2.4 && ![12, 14, 16, 13].includes(Math.abs(p.pdg)) && (charge(p.pdg) === 0 || pt(p.p) > 1));
    const eTruth = inCalo.reduce((a, p) => a + p.p.E, 0);
    const eCells = e.detector!.cells.reduce((a, c) => a + c.energy, 0);
    expect(eCells / eTruth).toBeGreaterThan(0.6);
    expect(eCells / eTruth).toBeLessThan(1.4);
  });
  it('a pile-up event has tens of vertices; hard-scatter tracks have small z0', () => {
    const e = sampleEvent('pileup', { seed: 1 });
    expect(e.detector!.pileup).toBe(35);
    expect(e.reco.vertices).toHaveLength(36);
    const hard = e.reco.tracks.filter((t) => (e.truth!.particles[t.truth]!.collision ?? 0) === 0);
    for (const t of hard) expect(Math.abs(t.z0)).toBeLessThan(0.5);
    const pu = e.reco.tracks.filter((t) => (e.truth!.particles[t.truth]!.collision ?? 0) > 0);
    expect(pu.length).toBeGreaterThan(20);
    expect(Math.max(...pu.map((t) => Math.abs(t.z0)))).toBeGreaterThan(20);
  });
  it('the stress event has about a thousand tracks and more than 20,000 hits', () => {
    const e = sampleEvent('stress', { seed: 1 });
    expect(e.reco.tracks.length).toBeGreaterThan(700);
    expect(e.detector!.hits.length).toBeGreaterThan(20000);
  });
});

describe('particle gun', () => {
  const fire = (pdg: number, ptv = 20) => gunEvent({ pdg, pt: ptv, eta: 0.3, phi: 0.5, seed: 1 });
  const sumE = (e: FullEvent, calo: 'ecal' | 'hcal') => e.detector!.cells.filter((c) => c.calo === calo).reduce((a, c) => a + c.energy, 0);
  it('a muon leaves tracker hits, little calorimeter energy and muon-chamber hits', () => {
    const e = fire(13);
    expect(e.detector!.hits.length).toBeGreaterThanOrEqual(8);
    expect(e.detector!.muonHits.length).toBeGreaterThanOrEqual(6);
    expect(sumE(e, 'ecal') + sumE(e, 'hcal')).toBeLessThan(10);
    expect(e.reco.objects[0]?.kind).toBe('muon');
  });
  it('an electron showers in the ECAL and is reconstructed as an electron', () => {
    const e = fire(11);
    expect(sumE(e, 'ecal')).toBeGreaterThan(0.9 * 20 * Math.cosh(0.3));
    expect(sumE(e, 'hcal')).toBeLessThan(1);
    expect(e.detector!.muonHits).toHaveLength(0);
    expect(e.reco.objects[0]?.kind).toBe('electron');
  });
  it('a photon has no hits and no track but an ECAL shower', () => {
    const e = fire(22);
    expect(e.detector!.hits).toHaveLength(0);
    expect(e.reco.tracks).toHaveLength(0);
    expect(sumE(e, 'ecal')).toBeGreaterThan(0.9 * 20 * Math.cosh(0.3));
    expect(e.reco.objects[0]?.kind).toBe('photon');
  });
  it('a pion has a track and most of its energy in the HCAL', () => {
    const e = fire(211, 40);
    expect(e.reco.tracks).toHaveLength(1);
    expect(sumE(e, 'hcal')).toBeGreaterThan(sumE(e, 'ecal'));
  });
  it('a neutrino leaves nothing', () => {
    const e = fire(14, 30);
    expect(e.detector!.hits).toHaveLength(0);
    expect(e.detector!.cells).toHaveLength(0);
    expect(e.reco.tracks).toHaveLength(0);
  });
  it('the field bends a particle: a stronger field gives a smaller radius', () => {
    const a = gunEvent({ pdg: 211, pt: 5, eta: 0, phi: 0, seed: 1, bField: 1 });
    const b = gunEvent({ pdg: 211, pt: 5, eta: 0, phi: 0, seed: 1, bField: 4 });
    const pa = a.detector!.cells.filter((c) => c.calo === 'ecal' || c.calo === 'hcal').sort((x, y) => y.energy - x.energy)[0]!;
    const pb = b.detector!.cells.filter((c) => c.calo === 'ecal' || c.calo === 'hcal').sort((x, y) => y.energy - x.energy)[0]!;
    expect(Math.abs(pb.phi)).toBeGreaterThan(Math.abs(pa.phi));
  });
});
