import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { connect } from '$lib/sim/netlist/connect';
import { createDigitalEngine } from '$lib/sim/digital';
import { evalDag, inputId, layoutDag, outputId, type Dag, type GateKind } from './layout';

/** A small seeded generator, so the tests are deterministic. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const KINDS: GateKind[] = ['and', 'or', 'nand', 'nor', 'xor', 'xnor', 'not', 'buffer'];

function randomDag(r: () => number): Dag {
  const n = 2 + Math.floor(r() * 4);
  const inputs = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
  const signals = [...inputs];
  const gates: Dag['gates'] = [];
  const count = 1 + Math.floor(r() * 11);
  for (let i = 0; i < count; i++) {
    const kind = KINDS[Math.floor(r() * KINDS.length)]!;
    const k = kind === 'not' || kind === 'buffer' ? 1 : 2 + Math.floor(r() * 3);
    const pool = r() < 0.05 ? [...signals, '1', '0'] : signals;
    const ins = Array.from({ length: k }, () => pool[Math.floor(r() * pool.length)]!);
    const id = `t${i}`;
    gates.push({ id, kind, inputs: ins });
    signals.push(id);
  }
  const outputs = [{ name: 'Y', signal: signals[signals.length - 1]! }];
  if (r() < 0.4) outputs.push({ name: 'Z', signal: signals[Math.floor(r() * signals.length)]! });
  return { inputs, gates, outputs };
}

function simulate(dag: Dag): { got: Record<string, number>[]; expected: Record<string, number>[]; unconnected: string[] } {
  const circuit = layoutDag(dag);
  const flat = flatten(circuit);
  const engine = createDigitalEngine(flat);
  const sinks = Object.fromEntries(dag.outputs.map((o) => [o.name, flat.elements.find((e) => e.id === outputId(o.name))!.pins[0]!]));
  const used = new Set(circuit.components.map((c) => c.id));
  const got: Record<string, number>[] = [];
  const expected: Record<string, number>[] = [];
  for (let m = 0; m < 2 ** dag.inputs.length; m++) {
    const values: Record<string, number> = {};
    dag.inputs.forEach((name, i) => {
      const v = (m >> i) & 1;
      values[name] = v;
      if (used.has(inputId(name))) engine.setParam(inputId(name), 'on', !!v);
    });
    engine.advance(200e-9);
    got.push(Object.fromEntries(Object.entries(sinks).map(([name, net]) => [name, engine.logic(net)])));
    expected.push(evalDag(dag, values));
  }
  return { got, expected, unconnected: connect(circuit).unconnected };
}

describe('layoutDag', () => {
  test('a single AND gate', () => {
    const dag: Dag = { inputs: ['A', 'B'], gates: [{ id: 'g', kind: 'and', inputs: ['A', 'B'] }], outputs: [{ name: 'Y', signal: 'g' }] };
    const c = layoutDag(dag);
    expect(c.components.map((x) => x.type).sort()).toEqual(['and', 'indicator', 'toggle', 'toggle']);
    const { got, expected, unconnected } = simulate(dag);
    expect(got).toEqual(expected);
    expect(unconnected).toEqual([]);
  });

  test('an output that is an input, and a constant', () => {
    const dag: Dag = { inputs: ['A'], gates: [], outputs: [{ name: 'Y', signal: 'A' }, { name: 'Z', signal: '1' }] };
    const { got, expected } = simulate(dag);
    expect(got).toEqual(expected);
  });

  test('a signal that skips levels is carried across the columns between', () => {
    const dag: Dag = {
      inputs: ['A', 'B', 'C'],
      gates: [
        { id: 'n', kind: 'not', inputs: ['A'] },
        { id: 'a', kind: 'and', inputs: ['n', 'B'] },
        { id: 'o', kind: 'or', inputs: ['a', 'C'] },
        { id: 'x', kind: 'xor', inputs: ['o', 'A'] },
      ],
      outputs: [{ name: 'Y', signal: 'x' }],
    };
    const { got, expected, unconnected } = simulate(dag);
    expect(got).toEqual(expected);
    expect(unconnected).toEqual([]);
  });

  test('random networks simulate exactly as they evaluate', () => {
    const r = rng(20260929);
    for (let i = 0; i < 300; i++) {
      const dag = randomDag(r);
      const { got, expected, unconnected } = simulate(dag);
      expect(got, `network ${i}: ${JSON.stringify(dag)}`).toEqual(expected);
      // The only open pins allowed are inputs that nothing reads (not drawn) — so none at all.
      expect(unconnected, `network ${i}`).toEqual([]);
    }
  });

  test('gates are not drawn on top of each other', () => {
    const r = rng(7);
    for (let i = 0; i < 100; i++) {
      const c = layoutDag(randomDag(r));
      const boxes = c.components
        .filter((x) => x.type !== 'toggle' && x.type !== 'const' && x.type !== 'indicator')
        .map((g) => {
          const single = g.type === 'not' || g.type === 'buffer';
          return { x0: g.x, x1: g.x + (single ? 5 : 6), y0: g.y - 1, y1: single ? g.y + 1 : g.y + 2 * Number(g.params?.inputs ?? 2) - 1 };
        });
      for (let a = 0; a < boxes.length; a++)
        for (let b = a + 1; b < boxes.length; b++) {
          const p = boxes[a]!;
          const q = boxes[b]!;
          const overlap = p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1;
          expect(overlap, `network ${i}: gates ${a} and ${b} overlap`).toBe(false);
        }
    }
  });
});
