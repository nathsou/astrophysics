import { describe, expect, it } from 'vitest';
import { connect } from '../sim/netlist/connect';
import { flatten } from '../sim/netlist/flatten';
import { createDigitalEngine, type DigitalEngine } from '../sim/digital';
import type { Circuit } from '../sim/netlist/types';
import { listAdapters } from './adapters';
import { assignTracks, buildLogicView, highlightIds, type LogicView } from './logic-view';
import type { DeviceFit, Network, RunState, Runner } from './types';

/** A tiny deterministic generator. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

class Bench {
  readonly engine: DigitalEngine;
  readonly conn;
  constructor(readonly view: LogicView) {
    this.engine = createDigitalEngine(flatten(view.circuit));
    this.engine.settle();
    this.conn = connect(view.circuit);
    this.engine.advance(1e-6);
  }
  set(name: string, v: number) {
    const id = this.view.inputComp.get(name);
    if (id) this.engine.setParam(id, 'on', !!v);
  }
  step(t = 1e-6) {
    this.engine.advance(t);
  }
  pulse() {
    const id = this.view.clockComp!;
    this.engine.setParam(id, 'pressed', true);
    this.engine.advance(50e-9);
    this.engine.setParam(id, 'pressed', false);
    this.engine.advance(1e-6);
  }
  level(output: string): 0 | 1 | 'z' | 'x' {
    const id = this.view.led.get(output)!;
    const n = this.conn.pinNet.get(`${id}.A`)!;
    const alias = this.engine.netlist.alias?.[n] ?? n;
    const l = this.engine.logic(alias);
    return l === 0 ? 0 : l === 1 ? 1 : l === 3 ? 'z' : 'x';
  }
}

function compare(bench: Bench, state: RunState, net: Network, ctx: string) {
  for (const o of net.outputs) {
    const want = state.signals[o.name];
    expect(bench.level(o.name), `${ctx}: ${o.name}`).toBe(want);
  }
}

function drive(fit: DeviceFit, seed: number, steps: number) {
  const net = fit.network;
  const view = buildLogicView(net);
  const bench = new Bench(view);
  const runner: Runner = fit.runner();
  const rand = rng(seed);
  let inputs: Record<string, number> = {};
  for (const n of runner.inputs) inputs[n] = 0;
  let state = runner.powerUp();
  bench.step();
  compare(bench, state, net, 'power-up');
  const exhaustive = !runner.hasClock && runner.inputs.length <= 6;
  const total = exhaustive ? 2 ** runner.inputs.length : steps;
  for (let i = 0; i < total; i++) {
    if (exhaustive) inputs = Object.fromEntries(runner.inputs.map((n, k) => [n, (i >> (runner.inputs.length - 1 - k)) & 1]));
    else if (rand() < 0.6) {
      const n = runner.inputs[Math.floor(rand() * runner.inputs.length)];
      if (n !== undefined) inputs[n] = 1 - (inputs[n] ?? 0);
    }
    for (const [n, v] of Object.entries(inputs)) bench.set(n, v);
    bench.step();
    state = runner.evaluate(inputs);
    compare(bench, state, net, `step ${i} inputs ${JSON.stringify(inputs)}`);
    if (runner.hasClock && rand() < 0.7) {
      bench.pulse();
      state = runner.clock(inputs);
      compare(bench, state, net, `after clock ${i} inputs ${JSON.stringify(inputs)}`);
    }
  }
  return { view, bench };
}

describe('assignTracks', () => {
  it('shares a track only between disjoint spans', () => {
    const r = assignTracks([
      { lo: 0, hi: 5 },
      { lo: 3, hi: 9 },
      { lo: 8, hi: 12 },
      { lo: 20, hi: 22 },
    ]);
    expect(r.count).toBe(2);
    expect(r.track[0]).not.toBe(r.track[1]);
    expect(r.track[2]).toBe(r.track[0]);
    expect(r.track[3]).toBe(r.track[0]);
  });
});

describe('the logic view runs on the digital engine like the device', () => {
  for (const a of listAdapters())
    for (const ex of a.examples)
      it(`${a.id}/${ex.id}`, () => {
        const r = a.program(ex.source);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const { view } = drive(r.fit, 7 + ex.id.length, 40);
        expect(view.stats.gates).toBeGreaterThan(2);
      });
});

describe('structure', () => {
  it('names components for hovering and selection', () => {
    const r = listAdapters().find((a) => a.id === 'gal22v10')!.program(listAdapters().find((a) => a.id === 'gal22v10')!.examples[0]!.source);
    if (!r.ok) throw new Error('fit');
    const view = buildLogicView(r.fit.network);
    expect(view.led.has('MG')).toBe(true);
    expect(view.inputComp.has('CAR')).toBe(true);
    expect(view.clockComp).toBeDefined();
    const probe = r.fit.resolve({ kind: 'output', name: 'Q1' });
    const hl = highlightIds(view, probe);
    expect(hl.has('Q1')).toBe(true);
    expect([...hl].some((id) => id.includes('flip-flop'))).toBe(true);
    // Every component id is unique and every wire is axis-aligned.
    const ids = view.circuit.components.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const w of view.circuit.wires) for (let i = 1; i < w.points.length; i++) expect(w.points[i]![0] === w.points[i - 1]![0] || w.points[i]![1] === w.points[i - 1]![1]).toBe(true);
  });

  it('splits gates wider than eight inputs into trees', () => {
    const lits = Array.from({ length: 12 }, (_, i) => ({ signal: `X${i}`, neg: i % 2 === 1 }));
    const net: Network = {
      inputs: lits.map((l) => l.signal),
      terms: [
        { id: 'a', kind: 'product', lits },
        ...Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, kind: 'product' as const, lits: [{ signal: `X${i}`, neg: false }, { signal: 'X11', neg: true }] })),
      ],
      outputs: [{ name: 'Y', terms: ['a', ...Array.from({ length: 10 }, (_, i) => `t${i}`)], ff: 'comb', invert: 'none' }],
    };
    const view = buildLogicView(net);
    const bench = new Bench(view);
    const rand = rng(3);
    for (let n = 0; n < 60; n++) {
      const v: Record<string, number> = {};
      for (const s of net.inputs) v[s] = rand() < 0.5 ? 1 : 0;
      if (n === 0) net.inputs.forEach((s, i) => (v[s] = i % 2 === 1 ? 0 : 1));
      for (const [k, x] of Object.entries(v)) bench.set(k, x);
      bench.step();
      let want = ((): number => {
        const all = lits.every((l) => (v[l.signal] ? 1 : 0) === (l.neg ? 0 : 1));
        const some = Array.from({ length: 10 }, (_, i) => v[`X${i}`] === 1 && v.X11 === 0).some(Boolean);
        return all || some ? 1 : 0;
      })();
      expect(bench.level('Y'), JSON.stringify(v)).toBe(want);
      want = 0;
    }
  });
});

const _circuit: Circuit | undefined = undefined;
void _circuit;
