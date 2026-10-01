/** Chapter 15: the numbers in the text, computed from hep/diagrams. */
import { describe, expect, test } from 'vitest';
import * as d from '../../hep/diagrams/index.ts';

const E = 11, MU = 13, GAMMA = 22, G = 21;
const count = (ini: number[], fin: number[], forces: d.Force[] = ['qed']) => d.enumerateTreeDiagrams(ini, fin, { forces }).length;

describe('tree-diagram counts quoted in the chapter', () => {
  test('e⁺e⁻ → μ⁺μ⁻: 1 in QED, 2 with the Z', () => {
    expect(count([-E, E], [-MU, MU])).toBe(1);
    expect(count([-E, E], [-MU, MU], ['qed', 'weak'])).toBe(2);
  });
  test('Bhabha: 2 in QED (s and t), 4 with the Z; Møller: 2; Compton and pair annihilation: 2', () => {
    expect(count([-E, E], [-E, E])).toBe(2);
    expect(count([-E, E], [-E, E], ['qed', 'weak'])).toBe(4);
    expect(count([E, E], [E, E])).toBe(2);
    expect(count([E, GAMMA], [E, GAMMA])).toBe(2);
    expect(count([-E, E], [GAMMA, GAMMA])).toBe(2);
    expect(count([GAMMA, GAMMA], [-E, E])).toBe(2);
  });
  test('e⁺e⁻ → μ⁺μ⁻γ: 4 in QED; 8 with the Z; none has the photon on the virtual photon', () => {
    const ds = d.enumerateTreeDiagrams([-E, E], [-MU, MU, GAMMA], { forces: ['qed'] });
    expect(ds.length).toBe(4);
    expect(d.enumerateTreeDiagrams([-E, E], [-MU, MU, GAMMA], { forces: ['qed', 'weak'] }).length).toBe(8);
    // every diagram has exactly three vertices, each a fermion line emitting a photon: no vertex has two photons
    for (const dg of ds) {
      const report = d.validateDiagram(dg);
      expect(report.ok).toBe(true);
      expect(report.order.total).toBe(3);
      for (const n of dg.nodes.filter((x) => x.kind === 'vertex')) {
        const pdgs = dg.edges.filter((e) => e.from === n.id || e.to === n.id).map((e) => Math.abs(e.pdg));
        expect(pdgs.filter((p) => p === GAMMA).length).toBe(1);
      }
    }
  });
  test('e⁺e⁻ → μ⁺μ⁻γγ: 20; gluon counts grow factorially: gg→gg 4, ggg 25, gggg 220', () => {
    expect(count([-E, E], [-MU, MU, GAMMA, GAMMA])).toBe(20);
    const gl = (n: number) => d.enumerateTreeDiagrams([G, G], new Array(n).fill(G), { forces: ['qcd'] }).length;
    expect([gl(2), gl(3), gl(4)]).toEqual([4, 25, 220]);
  });
  test('one loop: e⁺e⁻ → μ⁺μ⁻ has 14 diagrams: 2 vertex corrections, 2 boxes, 10 photon self-energy bubbles (nine fermions and the W)', () => {
    const ds = d.enumerateOneLoopDiagrams([-E, E], [-MU, MU], { forces: ['qed'] });
    expect(ds.length).toBe(14);
    const kinds = ds.map((x) => d.describeDiagram(x));
    expect(kinds.filter((k) => k.startsWith('vertex correction')).length).toBe(2);
    expect(kinds.filter((k) => k.startsWith('box')).length).toBe(2);
    expect(kinds.filter((k) => k.startsWith('self-energy bubble')).length).toBe(10);
  });
});

describe('coupling orders', () => {
  test('the order of a tree diagram is n − 2 and each loop adds two powers: V = n − 2 + 2L', () => {
    for (const [ini, fin] of [[[-E, E], [-MU, MU]], [[-E, E], [-MU, MU, GAMMA]], [[-E, E], [-MU, MU, GAMMA, GAMMA]]] as [number[], number[]][]) {
      for (const dg of d.enumerateTreeDiagrams(ini, fin, { forces: ['qed'] })) {
        const o = d.diagramOrder(dg);
        expect(o.total).toBe(ini.length + fin.length - 2);
        expect(o.loops).toBe(0);
      }
    }
    for (const dg of d.enumerateOneLoopDiagrams([-E, E], [-MU, MU], { forces: ['qed'] })) {
      const o = d.diagramOrder(dg);
      expect(o.loops).toBe(1);
      expect(o.total).toBe(4 - 2 + 2);
    }
  });
  test('α per vertex squared: the rate of e⁺e⁻ → μ⁺μ⁻γ relative to μ⁺μ⁻ is suppressed by one power of α from couplings alone', () => {
    const a = d.diagramOrder(d.enumerateTreeDiagrams([-E, E], [-MU, MU], { forces: ['qed'] })[0]!);
    const b = d.diagramOrder(d.enumerateTreeDiagrams([-E, E], [-MU, MU, GAMMA], { forces: ['qed'] })[0]!);
    expect(b.total - a.total).toBe(1);
    expect(b.alpha - a.alpha).toBeCloseTo(1, 12);
  });
});

describe('perturbation series: how many orders for a part in 10¹²', () => {
  test('(α/π)^n = 1e-12 at n ≈ 4.56', () => {
    const x = 1 / 137.036 / Math.PI;
    expect(Math.log(1e-12) / Math.log(x)).toBeCloseTo(4.556, 2);
  });
});
