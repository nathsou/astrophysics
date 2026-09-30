import { describe, expect, test } from 'vitest';
import { PRESETS, analyse, andChain, andTree, falsePath, levels, measure, rippleAdder, topological, twoPaths, type Network } from './timing';

describe('longest and shortest paths', () => {
  test('a chain of seven ANDs: 14 ns, and the last input is only one gate from the output', () => {
    const a = analyse(andChain());
    expect(a.tpd).toBe(14);
    expect(a.tcd).toBe(2);
    expect(a.critical).toEqual(['x0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7']);
    expect(a.shortest).toEqual(['x7', 'a7']);
    expect(a.paths).toBe(8);
  });

  test('the same AND as a balanced tree: three levels, 6 ns, every path the same length', () => {
    const a = analyse(andTree());
    expect(a.tpd).toBe(6);
    expect(a.tcd).toBe(6);
    expect(a.critical).toHaveLength(4);
    expect(Object.values(a.slack).every((s) => s === 0)).toBe(true);
  });

  test('two paths of different lengths: contamination 1.5 ns, propagation 4.5 ns', () => {
    const a = analyse(twoPaths());
    expect(a.tcd).toBe(1.5);
    expect(a.tpd).toBe(4.5);
    expect(a.critical).toEqual(['a', 'n1', 'n2', 'n3', 'y']);
    expect(a.shortest).toEqual(['b', 'y']);
    expect(a.slack.b).toBe(3);
    expect(a.slack.n2).toBe(0);
  });

  test('a four-bit ripple-carry adder: the carry chain from a0 to c4 sets 19 ns', () => {
    const a = analyse(rippleAdder(4));
    expect(a.tpd).toBe(19);
    expect(a.critical).toEqual(['a0', 'p0', 't0', 'c1', 't1', 'c2', 't2', 'c3', 't3', 'c4']);
    expect(a.tcd).toBe(3);
  });

  test('each extra bit of a ripple adder costs two AND–OR stages of the carry: 4 ns', () => {
    const d = analyse(rippleAdder(8)).tpd - analyse(rippleAdder(4)).tpd;
    expect(d).toBe(16);
  });

  test('a longer delay on a gate that is not critical does not change t_pd until its slack is used up', () => {
    const net = twoPaths();
    net.nodes.find((n) => n.id === 'y')!.inputs = ['n3', 'b'];
    const b = net.nodes.find((n) => n.id === 'n1')!;
    expect(analyse(net).tpd).toBe(4.5);
    b.delay = 3;
    expect(analyse(net).tpd).toBe(6.5);
  });

  test('the number of paths grows with the reconvergence, not with the gate count', () => {
    expect(analyse(rippleAdder(4)).paths).toBeGreaterThan(analyse(rippleAdder(2)).paths * 2);
  });
});

describe('structure', () => {
  test('topological order puts every node after its inputs', () => {
    for (const p of PRESETS) {
      const net = p.make();
      const order = topological(net);
      const pos = new Map(order.map((id, i) => [id, i]));
      for (const n of net.nodes) for (const i of n.inputs) expect(pos.get(i)!).toBeLessThan(pos.get(n.id)!);
    }
  });
  test('a loop is reported', () => {
    const loop: Network = {
      name: 'loop',
      nodes: [
        { id: 'a', type: 'not', delay: 1, inputs: ['b'] },
        { id: 'b', type: 'not', delay: 1, inputs: ['a'] },
      ],
      outputs: ['b'],
    };
    expect(() => topological(loop)).toThrow(/loop/);
  });
  test('levels count gates from the inputs', () => {
    const lv = levels(andTree());
    expect(Math.max(...Object.values(lv))).toBe(3);
    expect(Math.max(...Object.values(levels(andChain())))).toBe(7);
  });
});

describe('the analysis agrees with the digital engine', () => {
  test('the chain, the tree and the two-path circuit settle exactly when the longest path says', () => {
    for (const net of [andChain(), andTree(), twoPaths()]) {
      const m = measure(net);
      expect(m.worst, net.name).toBeCloseTo(analyse(net).tpd, 6);
    }
  });
  test('the first output change of the two-path circuit comes after the contamination delay', () => {
    const m = measure(twoPaths());
    expect(m.first).toBeCloseTo(analyse(twoPaths()).tcd, 6);
  });
  test('the ripple-carry adder settles at 19 ns after a0 flips with b0 = 0 and carry-in = 1', () => {
    const net = rippleAdder(4);
    const m = measure(net, 512);
    expect(m.worst).toBeCloseTo(19, 6);
  });
});

describe('a false path', () => {
  test('the critical path of two muxes with one select is longer than anything the simulator can provoke', () => {
    const net = falsePath();
    const a = analyse(net);
    expect(a.critical).toEqual(['x', 'd1', 'd2', 'd3', 'g2', 'm1', 'g3', 'y']);
    expect(a.tpd).toBe(3 + 2 + 2 + 2 + 2);
    const m = measure(net);
    console.log('false path measured', m.worst, 'input', m.input);
    expect(m.worst).toBeLessThan(a.tpd);
  });
});

describe('layout', () => {
  test('no two nodes overlap, and every gate is to the right of its inputs', async () => {
    const { layout, NODE_H, NODE_W } = await import('./timing');
    for (const p of PRESETS) {
      const net = p.make();
      const { pos } = layout(net);
      const ids = net.nodes.map((n) => n.id);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = pos[ids[i]!]!;
          const b = pos[ids[j]!]!;
          const overlap = Math.abs(a.x - b.x) < NODE_W && Math.abs(a.y - b.y) < NODE_H;
          expect(overlap, `${ids[i]} and ${ids[j]} in ${net.name}`).toBe(false);
        }
      }
      for (const n of net.nodes) for (const s of n.inputs) expect(pos[s]!.x).toBeLessThan(pos[n.id]!.x);
    }
  });
});
