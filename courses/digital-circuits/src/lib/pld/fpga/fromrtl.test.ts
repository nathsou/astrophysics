import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { check } from '../../hdl/check';
import { elaborate } from '../../hdl/elaborate';
import { createRtlSim } from '../../hdl/rtlsim';
import { createDigitalEngine } from '../../sim/digital';
import { mulberry32 } from '../twolevel/random';
import { sinkLiterals } from './design';
import { attachTestbench, decodeBitstream } from './decode';
import { runFlow, type FlowResult } from './flow';
import { fromRtl } from './fromrtl';
import { synthesise } from './synth';

// Whole-flow tests are heavy when other test files run at the same time.
vi.setConfig({ testTimeout: 180_000 });

const DESIGNS = new URL('../../../../content/designs/', import.meta.url);
const source = (f: string) => readFileSync(new URL(f, DESIGNS), 'utf8');

function rtl(src: string, top?: string) {
  const r = check(src, { file: 't.dcl' });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return elaborate(r.program, top);
}

/** A configured fabric with a switch on every input pad of the design. */
function fabricOf(res: FlowResult) {
  const fab = decodeBitstream(res.device, res.bitgen.bits);
  const pad = new Map<string, string>();
  const inputs: string[] = [];
  res.netlist.ports.forEach((p, i) => {
    const name = res.device.pads[res.placement.unitPad[res.packed.portUnit[i]!]!]!.name;
    pad.set(p.name, name);
    if (p.dir === 'in' && fab.fabric.padNets.has(name)) inputs.push(name);
  });
  attachTestbench(fab, inputs);
  const eng = createDigitalEngine(fab);
  return {
    set: (port: string, v: boolean | number) => {
      const p = pad.get(port);
      if (p && fab.fabric.padNets.has(p)) eng.setParam(`TB:${p}`, 'on', !!v);
    },
    get: (port: string): number => eng.logic(fab.fabric.padNets.get(pad.get(port)!)!),
    advance: (ns: number) => eng.advance(ns * 1e-9),
  };
}

describe('DCL RTL through the FPGA flow', () => {
  test('the counter: enable and synchronous clear become the flip-flops’ enable and reset, and it matches the RTL simulator', () => {
    const design = rtl(source('counter.dcl'), 'Counter');
    const res = runFlow(fromRtl(design), { device: 'S' });
    const ffs = res.netlist.lcs.filter((l) => l.ff);
    expect(ffs.length).toBe(4);
    expect(ffs.every((l) => l.ff!.ce >= 0 && l.ff!.sr >= 0 && !l.ff!.srAsync)).toBe(true);
    const sim = createRtlSim(design, 'Counter');
    const fab = fabricOf(res);
    const rng = mulberry32(5);
    let wraps = 0;
    for (let cycle = 0; cycle < 120; cycle++) {
      const enable = rng.chance(0.85) ? 1 : 0;
      const clear = rng.chance(0.05) ? 1 : 0;
      sim.set('enable', enable);
      sim.set('clear', clear);
      fab.set('enable', enable);
      fab.set('clear', clear);
      fab.advance(50);
      // Combinational outputs before the edge.
      expect([0, 1, 2, 3].map((i) => fab.get(`count[${i}]`))).toEqual([0, 1, 2, 3].map((i) => (sim.get('count') >> i) & 1));
      expect(fab.get('wrapped')).toBe(sim.get('wrapped'));
      wraps += sim.get('wrapped');
      sim.tick();
      fab.set('clk', 1);
      fab.advance(50);
      fab.set('clk', 0);
      fab.advance(50);
    }
    expect(wraps).toBeGreaterThan(0);
  });

  test('the traffic light (an enum state machine) follows the RTL simulator', () => {
    const design = rtl(source('traffic-light.dcl'), 'TrafficLight');
    const res = runFlow(fromRtl(design), { device: 'S' });
    const sim = createRtlSim(design, 'TrafficLight');
    const fab = fabricOf(res);
    const rng = mulberry32(9);
    for (let cycle = 0; cycle < 100; cycle++) {
      const tick = rng.chance(0.6) ? 1 : 0;
      sim.set('tick', tick);
      fab.set('tick', tick);
      fab.advance(50);
      expect(['red', 'amber', 'green'].map((n) => fab.get(n))).toEqual(['red', 'amber', 'green'].map((n) => sim.get(n)));
      sim.tick();
      fab.set('clk', 1);
      fab.advance(50);
      fab.set('clk', 0);
      fab.advance(50);
    }
  });

  test('the RV32I ALU: the AIG agrees with the RTL simulator on random operands, before and after synthesis', () => {
    const design = rtl(source('alu.dcl'), 'Alu');
    const sim = createRtlSim(design, 'Alu');
    const d0 = fromRtl(design);
    const { design: d1, trace } = synthesise(d0);
    expect(trace.passes[trace.passes.length - 1]!.ands).toBeLessThanOrEqual(trace.passes[0]!.ands);
    const rng = mulberry32(17);
    for (const d of [d0, d1]) {
      const ins = d.ports.filter((p) => p.dir === 'in');
      const outs = d.ports.filter((p) => p.dir === 'out');
      const roots = outs.map((p) => p.lit);
      for (let n = 0; n < 200; n++) {
        const vals: Record<string, number> = {
          rs1_value: (rng.next() * 2 ** 32) >>> 0,
          b: (rng.next() * 2 ** 32) >>> 0,
          f3: rng.int(8),
          is_reg: rng.int(2),
          ir30: rng.int(2),
        };
        if (n % 5 === 0) vals.b = rng.int(40);
        for (const [k, v] of Object.entries(vals)) sim.set(k, v);
        const piValue = new Map<number, number>();
        for (const p of ins) {
          const m = /^(\w+)(?:\[(\d+)\])?$/.exec(p.name)!;
          const bit = m[2] === undefined ? 0 : Number(m[2]);
          piValue.set(p.lit >> 1, Math.floor(vals[m[1]!]! / 2 ** bit) % 2);
        }
        const got = d.aig.evaluate(roots, (node) => piValue.get(node) ?? 0);
        const want = sim.get('result') >>> 0;
        expect(got.reduce((s, b, i) => s + b * 2 ** i, 0)).toBe(want);
      }
    }
  });

  test('the ALU fits vFPGA-M and its configured fabric computes the same results', () => {
    const design = rtl(source('alu.dcl'), 'Alu');
    const res = runFlow(fromRtl(design), { device: 'M' });
    expect(res.report.utilisation.cells.used).toBeLessThan(res.device.counts.lcs * 0.6);
    expect(res.carry.chains.length).toBeGreaterThan(0);
    const sim = createRtlSim(design, 'Alu');
    const fab = fabricOf(res);
    const rng = mulberry32(3);
    for (let n = 0; n < 40; n++) {
      const vals: Record<string, number> = { rs1_value: (rng.next() * 2 ** 32) >>> 0, b: n % 3 === 0 ? rng.int(40) : (rng.next() * 2 ** 32) >>> 0, f3: n % 8, is_reg: rng.int(2), ir30: rng.int(2) };
      for (const [k, v] of Object.entries(vals)) {
        sim.set(k, v);
        const w = k === 'rs1_value' || k === 'b' ? 32 : k === 'f3' ? 3 : 1;
        for (let i = 0; i < w; i++) fab.set(w === 1 ? k : `${k}[${i}]`, Math.floor(v / 2 ** i) % 2);
      }
      fab.advance(200);
      let got = 0;
      for (let i = 0; i < 32; i++) got += fab.get(`result[${i}]`) * 2 ** i;
      expect(got).toBe(sim.get('result') >>> 0);
    }
  });

  test('a memory with synchronous reads becomes a block RAM', () => {
    const src = 'module M(clk: clock, a: bits<3>, d: bits<8>, we: bit, ra: bits<3>) -> (q: bits<8>) {\n  mem m: [bits<8>; 8] = [7; 8]\n  m.write(a, d, we)\n  q = m.read(ra)\n}';
    const design = rtl(src, 'M');
    const res = runFlow(fromRtl(design), { device: 'M' });
    expect(res.netlist.rams.length).toBe(1);
    expect(res.netlist.rams[0]!.asyncRead).toBe(false);
    const sim = createRtlSim(design, 'M');
    const fab = fabricOf(res);
    const rng = mulberry32(13);
    const setAll = (name: string, w: number, v: number) => {
      sim.set(name, v);
      for (let i = 0; i < w; i++) fab.set(`${name}[${i}]`, (v >> i) & 1);
    };
    for (let cycle = 0; cycle < 150; cycle++) {
      setAll('a', 3, rng.int(8));
      setAll('d', 8, rng.int(256));
      setAll('ra', 3, rng.int(8));
      const we = rng.chance(0.5) ? 1 : 0;
      sim.set('we', we);
      fab.set('we', we);
      fab.advance(50);
      sim.tick();
      fab.set('clk', 1);
      fab.advance(50);
      fab.set('clk', 0);
      fab.advance(50);
      let got = 0;
      for (let i = 0; i < 8; i++) got += fab.get(`q[${i}]`) << i;
      expect(got).toBe(sim.get('q'));
    }
  });

  test('every source element is traceable to the hierarchical path and line it came from', () => {
    const design = rtl(source('alu.dcl'), 'Alu');
    const d = fromRtl(design);
    expect(d.sources.some((s) => s.type === 'add' && s.line !== undefined)).toBe(true);
    expect(d.sources.every((s) => s.path !== undefined)).toBe(true);
    expect(sinkLiterals(d).length).toBeGreaterThan(0);
    const res = runFlow(d, { device: 'M' });
    const add = d.sources.find((s) => s.type === 'add')!;
    expect(res.probe.bySource[add.id]!.cells.length).toBeGreaterThan(8);
  });
});
