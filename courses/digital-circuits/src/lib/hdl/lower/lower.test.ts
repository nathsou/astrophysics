import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { check, createRtlSim, elaborate, type RtlModule } from '../index';
import { lowerToNetlist, type LowerOptions } from './index';
import { createGateSim } from './sim';
import { randomModule, rng } from './random';

const DESIGNS = new URL('../../../../content/designs/', import.meta.url);
const load = (f: string) => readFileSync(new URL(f, DESIGNS), 'utf8');

/** Drives the RTL simulator and the gate-level netlist with the same stimulus and compares every port and named signal. */
function compare(mod: RtlModule, options: LowerOptions, seed: number, cycles: number) {
  const lowered = lowerToNetlist(mod, undefined, options);
  const rtl = createRtlSim(mod);
  const gates = createGateSim(lowered);
  const r = rng(seed * 7919 + 1);
  const bad: string[] = [];
  const check = (when: string) => {
    for (const p of lowered.ports) {
      if (p.dir !== 'out') continue;
      const a = rtl.getBig(p.name);
      const b = gates.get(p.name);
      if (a !== b) bad.push(`${when}: port ${p.name}: rtl ${a} gates ${b}`);
    }
    for (const [name, bits] of Object.entries(lowered.signals)) {
      if (!rtl.names().includes(name)) continue;
      let v = 0n;
      let unknown = false;
      bits.forEach((n, i) => {
        const l = n === -1 ? 0 : n === -2 ? 1 : gates.engine.logic(n);
        if (l > 1) unknown = true;
        else if (l === 1) v |= 1n << BigInt(i);
      });
      const a = rtl.peek(name);
      if (unknown || a !== v) bad.push(`${when}: signal ${name}: rtl ${a} gates ${unknown ? 'X' : v}`);
    }
  };
  check('power-up');
  for (let cycle = 0; cycle < cycles; cycle++) {
    for (const p of mod.inputs) {
      if (p.clock) continue;
      const v = r.big(p.width);
      rtl.set(p.name, v);
      gates.set(p.name, v);
    }
    check(`cycle ${cycle} before edge`);
    rtl.step();
    gates.step();
    check(`cycle ${cycle} after edge`);
    if (bad.length) break;
  }
  expect(bad.slice(0, 5)).toEqual([]);
  return lowered;
}

describe('lowering agrees with the RTL simulator', () => {
  for (let seed = 1; seed <= 24; seed++) {
    it(`random design ${seed}`, () => {
      compare(randomModule(seed), {}, seed, 8);
    }, 60000);
  }
  for (let seed = 101; seed <= 108; seed++) {
    it(`random design ${seed} with adder blocks and gate multiplexers`, () => {
      compare(randomModule(seed), { adders: 'blocks', muxes: 'gates', maxFanIn: 2 }, seed, 6);
    }, 60000);
  }
  for (let seed = 201; seed <= 206; seed++) {
    it(`random design ${seed} without pruning, with 8-input gates`, () => {
      compare(randomModule(seed), { prune: false, maxFanIn: 8 }, seed, 5);
    }, 60000);
  }
});

function lowerSource(file: string, top: string, options: LowerOptions = {}, source = load(file)) {
  const { program, diagnostics } = check(source, { file, tests: false });
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const design = elaborate(program, top);
  return { design, lowered: lowerToNetlist(design, undefined, options) };
}

describe('reference designs', () => {
  it('counter', () => {
    const { lowered } = lowerSource('counter.dcl', 'Counter');
    const sim = createGateSim(lowered);
    sim.set('enable', 1);
    sim.step(15);
    expect(sim.get('count')).toBe(15n);
    expect(sim.get('wrapped')).toBe(1n);
    sim.step();
    expect(sim.get('count')).toBe(0n);
    sim.set('clear', 1);
    sim.step(3);
    expect(sim.get('count')).toBe(0n);
  });

  it('traffic light steps through the British sequence', () => {
    const { lowered } = lowerSource('traffic-light.dcl', 'TrafficLight');
    const sim = createGateSim(lowered);
    sim.set('tick', 1);
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      seen.push(`${sim.get('red')}${sim.get('amber')}${sim.get('green')}`);
      sim.step();
    }
    expect(seen).toEqual(['100', '110', '001', '010', '100']);
  });

  it('ALU: random vectors at 32 bits', () => {
    const { design, lowered } = lowerSource('alu.dcl', 'Alu');
    const rtl = createRtlSim(design);
    const sim = createGateSim(lowered);
    const r = rng(42);
    const edge = [0n, 1n, 0xffffffffn, 0x80000000n, 0x7fffffffn, 31n, 32n];
    for (let k = 0; k < 400; k++) {
      const pick = () => (r.int(4) === 0 ? r.pick(edge) : r.big(32));
      const v = { rs1_value: pick(), b: pick(), f3: r.big(3), is_reg: r.big(1), ir30: r.big(1) };
      for (const [n, x] of Object.entries(v)) {
        rtl.set(n, x);
        sim.set(n, x);
      }
      expect([JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x)), sim.get('result')]).toEqual([JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x)), rtl.getBig('result')]);
    }
  }, 60000);

  it('ALU: exhaustive at 4 bits', () => {
    const src = load('alu.dcl')
      .replace(/bits<32>/g, 'bits<4>')
      .replace('bits<5> = b[4:0]', 'bits<2> = b[1:0]')
      .replace('0xffffffff', '0xf')
      .replace(/rs1_value\[31\]/g, 'rs1_value[3]')
      .replace(/b\[31\]/g, 'b[3]');
    const { design, lowered } = lowerSource('alu.dcl', 'Alu', {}, src);
    const rtl = createRtlSim(design);
    const sim = createGateSim(lowered);
    let n = 0;
    for (let f3 = 0; f3 < 8; f3++)
      for (let flags = 0; flags < 4; flags++)
        for (let a = 0; a < 16; a++)
          for (let b = 0; b < 16; b++) {
            const v = { rs1_value: a, b, f3, is_reg: flags & 1, ir30: flags >> 1 };
            for (const [k, x] of Object.entries(v)) {
              rtl.set(k, x);
              sim.set(k, x);
            }
            const want = rtl.getBig('result');
            const got = sim.get('result');
            if (want !== got) throw new Error(`${JSON.stringify(v)}: rtl ${want}, gates ${got}`);
            n++;
          }
    expect(n).toBe(8192);
  }, 120000);

  it('register file: 32 x 32 flip-flops with two read ports', () => {
    const { design, lowered } = lowerSource('regfile.dcl', 'RegFile');
    expect(lowered.stats.flipFlops).toBe(31 * 32);
    const rtl = createRtlSim(design);
    const sim = createGateSim(lowered);
    const r = rng(7);
    for (let cycle = 0; cycle < 60; cycle++) {
      const v = { rs1_address: r.big(5), rs2_address: r.big(5), rd_address: r.big(5), rd_write: r.big(1), rd_value: r.big(32) };
      for (const [k, x] of Object.entries(v)) {
        rtl.set(k, x);
        sim.set(k, x);
      }
      expect([cycle, sim.get('rs1_value'), sim.get('rs2_value')]).toEqual([cycle, rtl.getBig('rs1_value'), rtl.getBig('rs2_value')]);
      rtl.step();
      sim.step();
    }
  }, 120000);
});
