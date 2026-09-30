/**
 * The cheap numbers of Chapter 31 (the ones that need no fit): sizes of the source, the drawn Octet of Chapters 21 and 22
 * in elements, and the same jobs on both CPUs. The numbers that come from fits are in octet-fpga.test.ts and rv32-fpga.test.ts.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { OctetMachine, assembleOrThrow, octetProgram, OCTET_INSTRUCTIONS } from '$lib/sim/cpu/octet';
import { Rv32Machine, assembleOrThrow as assemble32, rv32Program } from '$lib/sim/cpu/rv32i';
import { buildCpu } from '../22-control/hardware/cpu';
import { referenceParts } from '../21-datapath/hardware/rig';
import { octetSource } from './widgets/octet-dcl';
import { rv32iSource } from './widgets/rv32-board';

const code = (src: string) => src.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).length;
const moduleText = (name: string) => {
  const i = octetSource.indexOf(name);
  return octetSource.slice(i, octetSource.indexOf('\n}\n', i) + 3);
};

describe('the size of the description', () => {
  test('Octet in DCL is about 280 lines of design and 45 of tests; the RV32I core about 175', () => {
    const design = octetSource.slice(0, octetSource.indexOf('\ntest '));
    const tests = octetSource.slice(octetSource.indexOf('\ntest '), octetSource.indexOf('\n/// The program'));
    expect(code(design)).toBe(282);
    expect(code(tests)).toBe(44);
    expect(code(moduleText('module Alu'))).toBe(18);
    expect(code(moduleText('module Control'))).toBe(102);
    expect(code(rv32iSource.split('\ntest ')[0]!)).toBe(175);
  });

  test('the control module is Chapter 22’s, line for line (only its header is laid out differently)', () => {
    const body = (s: string) => s.slice(s.indexOf('  let op: bits<4> = ir[7:4]'));
    const ch22 = readFileSync(new URL('../22-control/designs/octet-decode.dcl', import.meta.url), 'utf8');
    const own = body(moduleText('module Control'));
    const theirs = body(ch22.slice(ch22.indexOf('module OctetDecode'), ch22.indexOf('/// The step counter')));
    // Chapter 22's version has blank lines and comments between groups; the code lines are the same.
    const lines = (s: string) => s.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).map((l) => l.trimEnd());
    expect(lines(own).length).toBeGreaterThan(70);
    expect(lines(own)).toEqual(lines(theirs).slice(0, lines(own).length));
  });
});

describe('the drawn Octet, in elements', () => {
  test('3,604 elements with the parts bin’s gates (hardwired), 334 with the simulator’s blocks', () => {
    const size = (level: 'blocks' | 'parts', control: 'hardwired' | 'microcoded') =>
      flatten(buildCpu({ control, level, memory: 'ram' }).circuit, referenceParts).elements.length;
    expect(size('parts', 'hardwired')).toBe(3604);
    expect(size('parts', 'microcoded')).toBe(3496);
    expect(size('blocks', 'hardwired')).toBe(334);
    expect(size('blocks', 'microcoded')).toBe(226);
  });
});

describe('the same jobs on the two CPUs', () => {
  /** [Octet bytes, Octet instructions, Octet cycles, RV32I bytes, RV32I instructions]. */
  const job = (id: string) => {
    const p = assembleOrThrow(octetProgram(id).source, id);
    const m = new OctetMachine().load(p);
    m.run();
    const q = assemble32(rv32Program(id).source, id);
    const r = new Rv32Machine();
    r.load(q);
    r.run();
    return { octet: { bytes: p.size, steps: m.steps, cycles: m.cycles }, rv32: { bytes: q.size, steps: r.steps, cycles: 2 * r.steps } };
  };

  test('multiply, Fibonacci and sort: fewer, wider instructions on RV32I, and 2 cycles each on the DCL core', () => {
    const mul = job('multiply');
    expect(mul.octet).toEqual({ bytes: 49, steps: 60, cycles: 329 });
    expect(mul.rv32).toEqual({ bytes: 64, steps: 29, cycles: 58 });
    const fib = job('fibonacci');
    expect(fib.octet).toEqual({ bytes: 29, steps: 95, cycles: 474 });
    expect(fib.rv32).toEqual({ bytes: 104, steps: 96, cycles: 192 });
    const sort = job('sort');
    expect(sort.octet).toEqual({ bytes: 38, steps: 581, cycles: 2941 });
    expect(sort.rv32).toEqual({ bytes: 68, steps: 317, cycles: 634 });
  });

  test('at the fits’ clock rates, 13 × 11 takes 7.6 µs on Octet (43.3 MHz), and 4.5 µs on RV32I (12.9 MHz)', () => {
    const mul = job('multiply');
    expect(((mul.octet.cycles / 43.3) * 1).toFixed(1)).toBe('7.6');
    expect(((mul.rv32.cycles / 12.9) * 1).toFixed(1)).toBe('4.5');
    expect(((mul.rv32.cycles / 20.0) * 1).toFixed(1)).toBe('2.9');
  });

  test('Octet takes 4 to 8 cycles an instruction, 5 on average in these programs', () => {
    expect(Math.min(...OCTET_INSTRUCTIONS.map((i) => i.cycles))).toBe(4);
    expect(Math.max(...OCTET_INSTRUCTIONS.map((i) => i.cycles))).toBe(8);
    for (const id of ['multiply', 'fibonacci', 'sort']) {
      const { octet } = job(id);
      expect(octet.cycles / octet.steps).toBeGreaterThan(4.9);
      expect(octet.cycles / octet.steps).toBeLessThan(5.6);
    }
  });
});
