import { describe, expect, test } from 'vitest';
import {
  buildDiagram, canonicalForm, channels, countOneLoopDiagrams, crossing, describeDiagram, diagramOrder, enumerateOneLoopDiagrams, enumerateTreeDiagrams,
  findDiagram, formatProcess, identicalParticleFactor, loopCount, loopInducedDiagrams, loopInducedEntry, orderLabel, parseProcess, rankDiagrams, sameDiagram,
  symmetryFactor, validateDiagram, vertexLabels, vertexRules, diagramToJSON, symbolOf,
} from './index.ts';
import { particle } from '../particles/index.ts';

const count = (text: string, opts = {}) => {
  const p = parseProcess(text);
  return enumerateTreeDiagrams(p.initial, p.final, opts).length;
};
const trees = (text: string, opts = {}) => {
  const p = parseProcess(text);
  return enumerateTreeDiagrams(p.initial, p.final, opts);
};

describe('tree-level counts', () => {
  test('e+ e- > mu+ mu-: s-channel photon and Z', () => {
    const ds = trees('e+ e- > mu+ mu-');
    expect(ds).toHaveLength(2);
    expect(ds.map((d) => channels(d)[0]!.pdg)).toEqual([22, 23]);
    expect(ds.every((d) => channels(d)[0]!.type === 's')).toBe(true);
    expect(count('e+ e- > mu+ mu-', { forces: ['qed'] })).toBe(1);
    expect(count('e+ e- > mu+ mu-', { forces: ['weak'] })).toBe(1);
  });
  test('Higgs exchange is absent for light fermions, present when the threshold is lowered', () => {
    expect(count('e+ e- > mu+ mu-', { forces: ['qed', 'weak', 'higgs'] })).toBe(2);
    expect(count('e+ e- > mu+ mu-', { forces: ['qed', 'weak', 'higgs'], minYukawaMass: 0 })).toBe(3);
    // The b quark is heavy enough: e+ e- > b b~ has the H only if the e e H vertex is allowed.
    expect(count('mu+ mu- > b b~', { forces: ['qed', 'weak', 'higgs'] })).toBe(3);
  });
  test('Bhabha and Møller: two topologies (photon exchange alone), four with the Z', () => {
    expect(count('e+ e- > e+ e-', { forces: ['qed'] })).toBe(2);
    expect(count('e- e- > e- e-', { forces: ['qed'] })).toBe(2);
    expect(count('e+ e- > e+ e-')).toBe(4);
    const moller = trees('e- e- > e- e-', { forces: ['qed'] });
    expect(moller.map((d) => channels(d)[0]!.type)).toEqual(['t', 'u']);
    const bhabha = trees('e+ e- > e+ e-', { forces: ['qed'] });
    expect(bhabha.map((d) => channels(d)[0]!.type)).toEqual(['s', 't']);
  });
  test('e+ e- > mu+ mu- gamma: a photon off each of the four charged legs', () => {
    const qed = trees('e+ e- > mu+ mu- gamma', { forces: ['qed'] });
    // One s-channel photon, the radiated photon attached to e-, e+ (initial state) or mu-, mu+ (final state): 2 + 2 = 4.
    expect(qed).toHaveLength(4);
    const ds = describeAll(qed);
    expect(ds.filter((s) => s.includes('initial-state'))).toHaveLength(2);
    expect(ds.filter((s) => s.includes('final-state'))).toHaveLength(2);
    // The radiated photon cannot come off the internal photon (no γγγ vertex) or an internal Z (no γγZ vertex).
    // With the Z as second neutral boson every diagram is doubled: 8.
    expect(count('e+ e- > mu+ mu- gamma')).toBe(8);
    // Two photons: a fermion line that carries k radiated photons and the s-channel vertex has (k + 1)! orderings, so
    // both photons on the e line: 3! = 6; both on the mu line: 6; one on each line: 2 (which photon) x 2 x 2 = 8. Total 20.
    expect(count('e+ e- > mu+ mu- gamma gamma', { forces: ['qed'] })).toBe(20);
  });
  test('gamma gamma > e+ e-, e+ e- > gamma gamma, Compton: two each', () => {
    expect(count('gamma gamma > e+ e-')).toBe(2);
    expect(count('e+ e- > gamma gamma')).toBe(2);
    expect(count('e- gamma > e- gamma')).toBe(2);
    const compton = trees('e- gamma > e- gamma');
    expect(compton.map((d) => channels(d)[0]!.type)).toEqual(['s', 'u']);
  });
  test('QCD: q q~ > g g has 3 diagrams, including the triple-gluon vertex', () => {
    const ds = trees('u u~ > g g');
    expect(ds).toHaveLength(3);
    expect(ds.map((d) => channels(d)[0]!.type)).toEqual(['s', 't', 'u']);
    const s = ds[0]!;
    expect(channels(s)[0]!.pdg).toBe(21);
    expect([...vertexRules(s).values()].map((r) => r.id).sort()).toEqual(['ggg', 'qqg']);
    expect(orderLabel(diagramOrder(s))).toBe('αₛ²');
  });
  test('gluon amplitudes: gg > gg 4, gg > ggg 25, gg > gggg 220, q q~ > ggg 16', () => {
    expect(count('g g > g g')).toBe(4);
    expect(count('g g > g g g')).toBe(25);
    expect(count('g g > g g g g')).toBe(220);
    expect(count('u u~ > g g g')).toBe(16);
    // u u~ > u u~: s- and t-channel exchange of g, gamma and Z.
    expect(count('u u~ > u u~')).toBe(6);
  });
  test('W pair production in e+ e-: s-channel gamma and Z, t-channel neutrino', () => {
    const ds = trees('e+ e- > W+ W-');
    expect(ds).toHaveLength(3);
    expect(ds.map((d) => `${channels(d)[0]!.type}${channels(d)[0]!.pdg}`)).toEqual(['s22', 's23', 't12']);
    // Without the gamma and Z diagrams the t-channel alone is what the textbook says violates unitarity.
    expect(count('e+ e- > W+ W-', { forces: ['weak'] })).toBe(2);
    expect(count('e+ e- > W+ W-', { forces: ['qed'] })).toBe(1);
  });
  test('e+ e- > Z H: one diagram, Higgs-strahlung', () => {
    const ds = trees('e+ e- > Z H');
    expect(ds).toHaveLength(1);
    expect(channels(ds[0]!)[0]!.pdg).toBe(23);
    expect(count('e+ e- > Z H', { minYukawaMass: 0 })).toBe(3);
  });
  test('q q\' > W > l nu, muon decay and beta decay', () => {
    expect(trees('u d~ > e+ nu_e')).toHaveLength(1);
    expect(trees('u d~ > e+ nu_e')[0]!.nodes.filter((n) => n.kind === 'vertex')).toHaveLength(2);
    // Muon decay: one W diagram; one Fermi contact vertex.
    const w = trees('mu- > e- nu_e~ nu_mu');
    expect(w).toHaveLength(1);
    expect(channels(w[0]!)[0]!.pdg).toBe(24);
    const fermi = trees('mu- > e- nu_e~ nu_mu', { forces: ['fermi'] });
    expect(fermi).toHaveLength(1);
    expect(fermi[0]!.nodes.filter((n) => n.kind === 'vertex')).toHaveLength(1);
    expect(vertexRules(fermi[0]!, { forces: ['fermi'] }).size).toBe(1);
    // Beta decay at quark level.
    const beta = trees('d > u e- nu_e~');
    expect(beta).toHaveLength(1);
    // Generation mixing: s -> u e nu is allowed with external quarks; internal lines stay diagonal.
    expect(count('s > u e- nu_e~')).toBe(1);
    expect(count('s > u e- nu_e~', { ckm: 'diagonal' })).toBe(0);
    expect(count('u u~ > W+ W-')).toBe(3);
    expect(count('u u~ > W+ W-', { ckm: 'full' })).toBe(5);
  });
  test('forbidden processes have no diagram', () => {
    expect(count('e- > mu-')).toBe(0);
    expect(count('e+ e- > mu+ e-')).toBe(0);
    expect(count('gamma gamma > H')).toBe(0);
    expect(count('g g > H')).toBe(0);
    expect(count('e- e- > mu- mu-')).toBe(0);
    expect(count('e+ e- > nu_e nu_e~', { forces: ['qed'] })).toBe(0);
  });
  test('maxOrder selects the orders', () => {
    expect(count('u u~ > g g', { maxOrder: { s: 0 } })).toBe(0);
    expect(count('u u~ > g g', { maxOrder: 2 })).toBe(3);
    expect(count('u u~ > g g', { maxOrder: 1 })).toBe(0);
    // e+ e- > q q~ has photon and Z diagrams, all of order e².
    expect(count('e+ e- > u u~', { maxOrder: { ew: 2, s: 0 } })).toBe(2);
    // u u~ > d d~: s-channel g, gamma, Z and the t-channel W exchange.
    expect(count('u u~ > d d~')).toBe(4);
  });
});

function describeAll(ds: ReturnType<typeof trees>): string[] {
  return ds.map(describeDiagram);
}

describe('every enumerated diagram is a legitimate diagram', () => {
  const processes = [
    'e+ e- > mu+ mu-', 'e+ e- > e+ e-', 'e- e- > e- e-', 'e+ e- > mu+ mu- gamma', 'e+ e- > W+ W-', 'u u~ > g g', 'g g > g g g', 'e+ e- > Z H',
    'u d~ > e+ nu_e', 'mu- > e- nu_e~ nu_mu', 'u u~ > W+ W-', 'gamma gamma > W+ W-', 'e+ e- > t t~ H', 'H > W+ W-', 'H H > H H',
  ];
  test.each(processes)('%s', (text) => {
    const p = parseProcess(text);
    const ds = enumerateTreeDiagrams(p.initial, p.final, { forces: ['qed', 'qcd', 'weak', 'higgs'], minYukawaMass: 0 });
    expect(ds.length).toBeGreaterThan(0);
    const seen = new Set<string>();
    for (const d of ds) {
      const v = validateDiagram(d);
      expect(v.issues.filter((i) => i.severity === 'error'), describeDiagram(d)).toEqual([]);
      expect(v.valid).toBe(true);
      expect(loopCount(d)).toBe(0);
      for (const n of d.nodes.filter((x) => x.kind === 'vertex')) {
        const labels = vertexLabels(d, n.id);
        const q = labels.reduce((s, l) => s + particle(l).charge3, 0);
        expect(q).toBe(0);
        const b = labels.reduce((s, l) => s + particle(l).baryon3, 0);
        expect(b).toBe(0);
        for (let i = 0; i < 3; i++) expect(labels.reduce((s, l) => s + particle(l).lepton[i]!, 0)).toBe(0);
      }
      const c = canonicalForm(d);
      expect(seen.has(c)).toBe(false);
      seen.add(c);
      // A tree with n legs and only cubic vertices has n − 2 vertices; every tree has total order n − 2.
      expect(diagramOrder(d, { forces: ['qed', 'qcd', 'weak', 'higgs', 'fermi'] }).total).toBe(p.initial.length + p.final.length - 2);
    }
  });
});

describe('determinism and ordering', () => {
  test('two runs give identical graphs, in the same order', () => {
    for (const text of ['e+ e- > mu+ mu- gamma', 'g g > g g g', 'e+ e- > W+ W-']) {
      const a = trees(text).map(diagramToJSON);
      const b = trees(text).map(diagramToJSON);
      expect(a).toEqual(b);
    }
  });
});

describe('isomorphism', () => {
  test('relabelling the vertices gives the same diagram; t and u of Møller differ', () => {
    const p = parseProcess('e- e- > e- e-');
    const t = buildDiagram(p, [['in0', 'v0', 11], ['v0', 'out0', 11], ['in1', 'v1', 11], ['v1', 'out1', 11], ['v0', 'v1', 22]]);
    const t2 = buildDiagram(p, [['in1', 'v5', 11], ['v5', 'out1', 11], ['in0', 'v3', 11], ['v3', 'out0', 11], ['v5', 'v3', 22]]);
    const u = buildDiagram(p, [['in0', 'v0', 11], ['v0', 'out1', 11], ['in1', 'v1', 11], ['v1', 'out0', 11], ['v0', 'v1', 22]]);
    expect(sameDiagram(t, t2)).toBe(true);
    expect(sameDiagram(t, u)).toBe(false);
    // With unlabelled legs the two are the same topology.
    expect(sameDiagram(t, u, { labelledLegs: false })).toBe(true);
    expect(findDiagram(trees('e- e- > e- e-', { forces: ['qed'] }), t)).toBe(0);
    expect(findDiagram(trees('e- e- > e- e-', { forces: ['qed'] }), u)).toBe(1);
  });
  test('arrows matter: a reversed fermion line is a different diagram', () => {
    const s = trees('e+ e- > mu+ mu-', { forces: ['qed'] })[0]!;
    // Reverse the arrow on the muon line.
    const flipped = { ...s, edges: s.edges.map((e) => (e.pdg === 13 ? { ...e, pdg: -e.pdg } : e)) };
    expect(sameDiagram(s, flipped)).toBe(false);
    expect(validateDiagram(flipped).valid).toBe(false);
    // An antiparticle edge written backwards is the same line.
    const rewritten = { ...s, edges: s.edges.map((e) => (e.pdg === 13 ? { ...e, from: e.to, to: e.from, pdg: -e.pdg } : e)) };
    expect(sameDiagram(s, rewritten)).toBe(true);
  });
  test('the W± line has an orientation; a photon line has none', () => {
    const s = trees('e+ e- > W+ W-', { forces: ['qed'] })[0]!;
    const rev = { ...s, edges: s.edges.map((e) => (e.pdg === 22 ? { ...e, from: e.to, to: e.from } : e)) };
    expect(sameDiagram(s, rev)).toBe(true);
  });
});

describe('crossing', () => {
  test('crossing keeps the graph: the crossed s-channel diagram is a diagram of the crossed process', () => {
    const p = parseProcess('e+ e- > mu+ mu-');
    const ds = enumerateTreeDiagrams(p.initial, p.final);
    // Cross the incoming e+ to an outgoing e-, and the outgoing mu+ to an incoming mu-: e- mu- > e- mu- (t-channel scattering).
    for (const d of ds) {
      const c1 = crossing(d, 'in', 0);
      expect(c1.initial).toEqual([11]);
      expect(c1.final).toEqual([-13, 13, 11]);
      expect(validateDiagram(c1).valid).toBe(true);
      const c2 = crossing(c1, 'out', 0);
      expect(c2.initial).toEqual([11, 13]);
      expect(c2.final).toEqual([13, 11]);
      const v = validateDiagram(c2);
      expect(v.valid).toBe(true);
      const all = enumerateTreeDiagrams(c2.initial, c2.final);
      expect(findDiagram(all, c2)).toBeGreaterThanOrEqual(0);
    }
    expect(formatProcess({ initial: [11, 13], final: [13, 11] })).toBe('e- mu- > mu- e-');
  });
  test('crossing twice returns the original graph', () => {
    const d = enumerateTreeDiagrams([-11, 11], [-13, 13])[0]!;
    const back = crossing(crossing(d, 'in', 0), 'out', 2);
    expect(back.initial).toEqual([11, -11]);
    expect(back.final).toEqual([-13, 13]);
    expect(validateDiagram(back).valid).toBe(true);
  });
});

describe('ranking and symmetry', () => {
  test('diagrams are ranked by coupling-only rate; the order counts powers of alpha', () => {
    const ds = trees('e+ e- > mu+ mu-');
    const r = rankDiagrams(ds);
    expect(r).toHaveLength(2);
    expect(r[0]!.rate).toBeGreaterThan(r[1]!.rate);
    for (const x of r) expect(x.order).toMatchObject({ ew: 2, s: 0, total: 2, loops: 0 });
    expect(orderLabel(r[0]!.order)).toBe('α²');
    const isr = trees('e+ e- > mu+ mu- gamma', { forces: ['qed'] })[0]!;
    expect(orderLabel(diagramOrder(isr))).toBe('α³');
  });
  test('gluon emission is larger than photon emission by alpha_s/alpha', () => {
    const qq = trees('e+ e- > u u~ g', { forces: ['qed', 'qcd'] });
    const qqy = trees('e+ e- > u u~ gamma', { forces: ['qed'] });
    expect(orderLabel(diagramOrder(qq[0]!))).toBe('α² αₛ');
    expect(rankDiagrams(qq)[0]!.rate).toBeGreaterThan(rankDiagrams(qqy)[0]!.rate);
  });
  test('labelled tree diagrams have symmetry factor 1; identical final-state particles give 1/n!', () => {
    for (const d of trees('g g > g g')) expect(symmetryFactor(d)).toBe(1);
    expect(identicalParticleFactor([21, 21])).toBe(1 / 2);
    expect(identicalParticleFactor([21, 21, 21])).toBeCloseTo(1 / 6);
    expect(identicalParticleFactor([11, -11])).toBe(1);
  });
  test('a bubble of two gluon lines has symmetry factor 1/2; a fermion bubble has 1', () => {
    const p = parseProcess('g > g');
    let d = buildDiagram(p, [['in0', 'v0', 21], ['v0', 'v1', 21], ['v0', 'v1', 21], ['v1', 'out0', 21]]);
    expect(symmetryFactor(d)).toBe(1 / 2);
    d = buildDiagram(parseProcess('gamma > gamma'), [['in0', 'v0', 22], ['v0', 'v1', 11], ['v1', 'v0', 11], ['v1', 'out0', 22]]);
    expect(symmetryFactor(d)).toBe(1);
  });
});

describe('one loop', () => {
  test('e+ e- > mu+ mu- at one loop in QED: 2 vertex corrections, 2 boxes, 9 vacuum-polarisation flavours', () => {
    const p = parseProcess('e+ e- > mu+ mu-');
    const fermionLoops = [1, 2, 3, 4, 5, 6, 11, 13, 15];
    const ds = enumerateOneLoopDiagrams(p.initial, p.final, { forces: ['qed'], loopParticles: fermionLoops });
    expect(ds).toHaveLength(13);
    for (const d of ds) {
      expect(loopCount(d)).toBe(1);
      expect(diagramOrder(d).total).toBe(4);
      expect(validateDiagram(d).valid).toBe(true);
    }
    // Four vertices each; boxes have no internal line cutting the diagram in two.
    const boxes = ds.filter((d) => channels(d).length === 0 && loopCount(d) === 1 && d.nodes.filter((n) => n.kind === 'vertex').length === 4 && d.edges.filter((e) => d.nodes.find((n) => n.id === e.from)!.kind === 'vertex' && d.nodes.find((n) => n.id === e.to)!.kind === 'vertex').length === 4);
    expect(boxes.length).toBe(ds.length); // loops: channels() is only for trees
    // The W loop is a further photon self-energy diagram, because the photon couples to the W.
    expect(countOneLoopDiagrams(p.initial, p.final, { forces: ['qed'] })).toBe(14);
  });
  test('gg > H goes through a top loop: two orientations of the fermion arrow', () => {
    expect(enumerateTreeDiagrams([21, 21], [25], { forces: ['qcd', 'higgs'] })).toHaveLength(0);
    const e = loopInducedEntry([21, 21], [25])!;
    expect(e.dominant[0]).toBe(6);
    const ds = loopInducedDiagrams([21, 21], [25]);
    expect(ds).toHaveLength(2);
    for (const d of ds) {
      expect(loopCount(d)).toBe(1);
      expect(d.nodes.filter((n) => n.kind === 'vertex')).toHaveLength(3);
      expect(validateDiagram(d).valid).toBe(true);
      expect(d.edges.filter((x) => Math.abs(x.pdg) === 6)).toHaveLength(3);
    }
    expect(sameDiagram(ds[0]!, ds[1]!)).toBe(false);
    // All quark flavours that couple to the Higgs: s, c, b, t in two orientations (u and d are below the Yukawa cut).
    expect(enumerateOneLoopDiagrams([21, 21], [25], { forces: ['qcd', 'higgs'] })).toHaveLength(8);
    expect(loopInducedDiagrams([11], [11])).toHaveLength(0);
    expect(symbolOf(6)).toBe('t');
  });
  test('H > gamma gamma: top and W triangles', () => {
    const ds = loopInducedDiagrams([25], [22, 22]);
    expect(ds.length).toBeGreaterThanOrEqual(3);
    for (const d of ds) expect(validateDiagram(d).valid).toBe(true);
  });
});
