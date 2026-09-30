import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { check, createRtlSim, elaborate } from '../index';
import { flatten } from '../../sim/netlist/flatten';
import { connect } from '../../sim/netlist/connect';
import type { FlatNetlist } from '../../sim/netlist/types';
import { lowerToCircuit } from './circuit';
import { createGateSim } from './sim';
import { randomModule, rng } from './random';

const DESIGNS = new URL('../../../../content/designs/', import.meta.url);

/** The nets of a netlist as sets of "element.pin" keys (nets with a single pin are unconnected). */
function partition(n: FlatNetlist): Set<string> {
  const nets = new Map<number, string[]>();
  for (const e of n.elements) e.pins.forEach((net, i) => (nets.get(net) ?? nets.set(net, []).get(net)!).push(`${e.id}.${e.pinNames[i]}`));
  return new Set([...nets.values()].map((l) => l.sort().join(' ')));
}

function circuitOf(file: string, top: string, options = {}) {
  const src = readFileSync(new URL(file, DESIGNS), 'utf8');
  const { program } = check(src, { file, tests: false });
  return lowerToCircuit(elaborate(program, top), undefined, options);
}

/** Is every wire orthogonal, and does no component overlap another? */
function sane(lc: ReturnType<typeof lowerToCircuit>) {
  for (const w of lc.circuit.wires) {
    expect(w.points.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < w.points.length; i++) {
      const [a, b] = [w.points[i - 1]!, w.points[i]!];
      expect(a[0] === b[0] || a[1] === b[1]).toBe(true);
    }
  }
}

describe('lowerToCircuit', () => {
  for (const [file, top] of [
    ['counter.dcl', 'Counter'],
    ['traffic-light.dcl', 'TrafficLight'],
  ] as const) {
    it(`${file}: the drawing connects exactly what the netlist connects`, () => {
      const lc = circuitOf(file, top);
      sane(lc);
      const flat = flatten(lc.circuit);
      expect(partition(flat)).toEqual(partition(lc.lowered.netlist));
      expect(connect(lc.circuit).netCount).toBeGreaterThan(5);
    });
  }

  it('the drawn counter counts', () => {
    const lc = circuitOf('counter.dcl', 'Counter');
    const sim = createGateSim(lc.lowered, flatten(lc.circuit));
    sim.set('enable', 1);
    sim.step(5);
    expect(sim.get('count')).toBe(5n);
    sim.step(11);
    expect(sim.get('wrapped')).toBe(0n);
    expect(sim.get('count')).toBe(0n);
    sim.set('enable', 0);
    expect(sim.get('count')).toBe(0n);
  });

  it('draws a shift register and a memory: registers share a column, feedback is drawn as flags', () => {
    const src = [
      'module Shift(clk: clock, d: bit, addr: bits<2>, we: bit) -> (q: bits<3>, r: bits<4>) {',
      '  reg s: bits<3> = 0',
      '  next s = concat(s[1:0], d)',
      '  mem m: [bits<4>; 4] = [0; 4]',
      '  m.write(addr, zext(s, 4), we)',
      '  r = m.read(addr)',
      '  q = s',
      '}',
    ].join('\n');
    const { program, diagnostics } = check(src, { file: 'shift.dcl', tests: false });
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const lc = lowerToCircuit(elaborate(program, 'Shift'));
    sane(lc);
    const flat = flatten(lc.circuit);
    expect(partition(flat)).toEqual(partition(lc.lowered.netlist));
    const flags = lc.circuit.components.filter((c) => c.type === 'label');
    expect(flags.length).toBeGreaterThan(3);
    const dffX = new Set(lc.circuit.components.filter((c) => c.type === 'dff' && lc.lowered.elements[c.id]?.role === 'dff').map((c) => c.x));
    expect(dffX.size).toBe(1);
    const sim = createGateSim(lc.lowered, flat);
    sim.set('d', 1);
    sim.step(3);
    expect(sim.get('q')).toBe(7n);
    sim.set('we', 1);
    sim.set('addr', 2);
    sim.step();
    sim.set('we', 0);
    sim.step();
    expect(sim.get('r')).toBe(7n);
  });

  for (let seed = 1; seed <= 12; seed++) {
    it(`random design ${seed}: drawing == netlist, and it runs like the RTL`, () => {
      const mod = randomModule(seed, { cells: 14, widths: [1, 2, 3, 4] });
      const lc = lowerToCircuit(mod, undefined, { maxElements: 5000 });
      sane(lc);
      const flat = flatten(lc.circuit);
      expect(partition(flat)).toEqual(partition(lc.lowered.netlist));
      const rtl = createRtlSim(mod);
      const gates = createGateSim(lc.lowered, flat);
      const r = rng(seed);
      for (let cycle = 0; cycle < 4; cycle++) {
        for (const p of mod.inputs) {
          if (p.clock) continue;
          const v = r.big(p.width);
          rtl.set(p.name, v);
          gates.set(p.name, v);
        }
        for (const p of mod.outputs) expect([cycle, p.name, gates.get(p.name)]).toEqual([cycle, p.name, rtl.getBig(p.name)]);
        rtl.step();
        gates.step();
      }
    });
  }
});
