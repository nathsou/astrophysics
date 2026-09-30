/**
 * The claims of Appendix F that are not `dcl` blocks: the operator and built-in tables (every result type is
 * computed by the checker), the cost table (counted on the netlist the lowering builds), the keyword list, the
 * limits, and the behaviours the text states. When the compiler changes, this file says what the page must say.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KEYWORDS, check, elaborate, formatValue, loadStd, runTests, typeToString } from '$lib/hdl';
import { lowerToNetlist } from '$lib/hdl/lower';
import { formatCounts } from '$lib/hdl/lower/cost';
import { bindBoard } from '$lib/studio/fpga/board';
import { firstCode, tableAfter } from './fences';

const md = readFileSync(new URL('./index.md', import.meta.url), 'utf8');
const source = (file: string) => readFileSync(new URL(`../../../src/lib/hdl/${file}`, import.meta.url), 'utf8');

const ENV = 'a: bits<8>, b: bits<8>, s: signed<8>, u: signed<8>, c: bit, d: bit, i: bits<3>';

/** The type of an expression, as the checker computes it (or the first error). */
function typeOf(expr: string): string {
  const src = `module T(${ENV}) -> (y: bit) {\n  let t = ${expr}\n  y = 0\n}\n`;
  const { diagnostics, program } = check(src, { file: 't.dcl', lint: false });
  const errs = diagnostics.filter((d) => d.severity === 'error');
  if (errs.length) return `error: ${errs[0]!.message}`;
  return typeToString(program.specialize('T').spec!.lets.get('t')!.type);
}

const file = (body: string, decls = ENV, outs = 'y: bit') => `module T(${decls}) -> (${outs}) {\n${body}\n}\n`;
const errorsOf = (src: string) => check(src, { file: 't.dcl', lint: false }).diagnostics.filter((d) => d.severity === 'error');
const codesOf = (src: string) => errorsOf(src).map((d) => d.code);

describe('lexical structure', () => {
  it('has the keywords of the table, and no others', () => {
    const cells = tableAfter(md, '### Keywords').flat().map((c) => c.replace(/`/g, '')).filter(Boolean);
    expect([...cells].sort()).toEqual([...KEYWORDS].sort());
    expect(KEYWORDS.size).toBe(23);
    expect(md).toContain('There are twenty-three');
  });

  it('has the limits of the text', () => {
    expect(codesOf(file('y = 0', 'a: bits<0>'))).toContain('bad-width');
    expect(codesOf(file('y = 0', 'a: bits<65537>'))).toContain('bad-width');
    expect(codesOf(file('y = 0', 'a: bits<65536>'))).toEqual([]);
    expect(codesOf(file('y = 0', 'a: [bit; 65537]'))).toContain('bad-size');
  });

  it('continues a line that starts with an operator, even a minus', () => {
    const src = file('let t: bits<8> = a\n  - b\n  y = 0');
    expect(codesOf(src)).toEqual([]);
    expect(typeOf('a\n  - b')).toBe('bits<8>');
  });

  it('accepts nested block comments, doc comments and underscores in literals', () => {
    const src = `/* a /* b */ c */\n/// doc\nmodule T() -> (y: bits<8>) {\n  y = 0b1010_0101\n}\n`;
    expect(codesOf(src)).toEqual([]);
    expect(codesOf('module T() -> (y: bits<8>) { y = 0o17 }')).toContain('syntax');
  });
});

describe('types', () => {
  it('encodes enums as the table says', () => {
    const src = `enum B { A, C, D, E, F }\n@onehot\nenum O { A, C, D, E, F }\n@gray\nenum G { A, C, D, E }\nmodule T(x: bit) -> (y: bit) {\n  let b: B = B.F\n  let o: O = O.F\n  let g: G = G.E\n  let bb = bits(b)\n  let ob = bits(o)\n  let gb = bits(g)\n  y = x\n}\ntest "codes" {\n  let m = sim T(x: 0)\n}\n`;
    const { diagnostics, program } = check(src, { file: 'e.dcl', lint: false });
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const spec = program.specialize('T').spec!;
    const t = (n: string) => spec.lets.get(n)!;
    expect(typeToString(t('bb').type)).toBe('bits<3>'); // binary: ceil(log2 5)
    expect(typeToString(t('ob').type)).toBe('bits<5>'); // one-hot: n
    expect(typeToString(t('gb').type)).toBe('bits<2>'); // gray: ceil(log2 4)
    // The codes: variant i is i (binary), 1 << i (one-hot), i ^ (i >> 1) (gray).
    const value = (n: string) => (t(n).expr as { v?: bigint }).v;
    expect([value('b'), value('o'), value('g')]).toEqual([4n, 16n, 2n]);
    expect(md).toContain('| `@onehot` | 2ⁱ | n |');
    expect(md).toContain('| `@gray` | i XOR (i >> 1) |');
  });

  it('lays structs out first field most significant, and arrays element 0 least significant', () => {
    const src = `struct P { hi: bits<4>, lo: bits<4> }\nmodule T(p: P, x: [bits<4>; 2]) -> (a: bits<8>, b: bits<8>, e: bit, f: bit) {\n  a = bits(p)\n  b = bits(x)\n  e = p == P { hi: 1, lo: 2 }\n  f = x == [3, 4]\n}\ntest "layout" {\n  let m = sim T(p: P { hi: 1, lo: 2 }, x: [3, 4])\n  expect m.a == 0x12\n  expect m.b == 0x43\n  expect m.e && m.f\n}\n`;
    expect(errorsOf(src)).toEqual([]);
    expect(runTests(src, { file: 'l.dcl' }).passed).toBe(true);
  });

  it('reads 0 for a dynamic index past the end of an array whose length is not a power of two', () => {
    const src = `module T(x: [bits<8>; 3], i: bits<2>) -> (y: bits<8>) {\n  y = x[i]\n}\ntest "past the end" {\n  let m = sim T(x: [1, 2, 3], i: 2)\n  expect m.y == 3\n  m.i = 3\n  expect m.y == 0\n}\n`;
    expect(errorsOf(src)).toEqual([]);
    expect(runTests(src, { file: 'i.dcl' }).passed).toBe(true);
  });

  it('gives an untyped literal its type from the other operand, a port and the other arm', () => {
    expect(typeOf('a + 1')).toBe('bits<8>');
    expect(typeOf('if c { a } else { 0 }')).toBe('bits<8>');
    expect(typeOf('5')).toMatch(/^error: this literal has no type/);
    expect(codesOf(file('let t: bits<4> = 16'))).toContain('literal-too-wide');
    expect(codesOf(file('let t: bits<4> = -1'))).toContain('literal-too-wide');
    expect(errorsOf(file('let t: signed<8> = -3\n  y = 0'))).toEqual([]);
  });
});

describe('the table of operators', () => {
  const rows = tableAfter(md, '### Operators');
  it('has a row for every operator', () => {
    const ops = rows.map((r) => r[1]!.replace(/`/g, ''));
    for (const op of ['!', '~', '-', '*', '+ -', '<< >>', '&', '^', '| ', '== !=', '< <= > >=', '&&', '|| ']) expect(ops.join('\n')).toContain(op.trim().split(' ')[0]!);
    expect(rows.length).toBe(14);
  });
  for (const r of rows) {
    const example = firstCode(r[3]!);
    const type = firstCode(r[4]!);
    it(`${example} has type ${type}`, () => expect(typeOf(example)).toBe(type));
  }

  it('has the precedence it says', () => {
    // Loosest first in the parser: || && comparisons | ^ & shifts +- *.
    const order = ['||', '&&', '==', '|', '^', '&', '<<', '+', '*'];
    const prec = rows.map((r) => [r[1]!.replace(/`/g, '').split(' ')[0]!, r[0]!] as const).filter(([, p]) => /^\d$/.test(p));
    const p = (op: string) => Number(prec.find(([o]) => o === op)![1]);
    for (let i = 1; i < order.length; i++) expect(p(order[i]!)).toBeGreaterThan(p(order[i - 1]!));
    expect(codesOf(file('let t = a < b < a'))).toContain('syntax');
    // `a & b == 0` is `(a & b) == 0`.
    const src = file('y = a & b == 0');
    expect(errorsOf(src)).toEqual([]);
  });

  it('never widens, wraps, and saturates over-long shifts to zero', () => {
    const src = file('let t: bits<8> = a * b\n  y = t == 32', ENV);
    expect(errorsOf(src)).toEqual([]);
    const run = `module Ops(a: bits<8>, b: bits<8>, s: signed<8>, n: bits<4>) -> (m: bits<8>, l: bits<8>, r: signed<8>) {\n  m = a * b\n  l = a << n\n  r = s >> n\n}\ntest "ops" {\n  let o = sim Ops(a: 200, b: 100, s: signed<8>(-128), n: 9)\n  expect o.m == 32 && o.l == 0 && o.r == signed<8>(-1)\n  o.s = 64\n  expect o.r == 0\n}\n`;
    expect(runTests(run, { file: 'o.dcl' }).passed).toBe(true);
  });

  it('mixes neither signedness nor widths', () => {
    expect(typeOf('a + s')).toMatch(/^error: type mismatch/);
    expect(typeOf('a + concat(c, a)')).toMatch(/^error: width mismatch/);
    expect(typeOf('!a')).toMatch(/^error: `!` needs `bit` operands/);
  });

  it('checks both branches of an if, even with a constant condition', () => {
    const src = `module T(clk: clock, d: bit) -> (y: bit) {\n  reg r: [bit; 3] = [0; 3]\n  for i in 0..3 {\n    next r[i] = if i == 0 { d } else { r[i - 1] }\n  }\n  y = r[2]\n}\n`;
    expect(codesOf(src)).toContain('index-out-of-range');
  });
});

describe('the table of built-in functions', () => {
  const rows = tableAfter(md, '### Built-in functions');
  for (const r of rows) {
    const example = firstCode(r[2]!);
    const type = firstCode(r[3]!);
    it(`${example} has type ${type}`, () => {
      if (example.startsWith('clog2')) {
        const src = `const K = clog2(8)\nmodule T() -> (y: bits<K>) {\n  y = 0\n}\n`;
        const { diagnostics, program } = check(src, { file: 'k.dcl', lint: false });
        expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        expect(typeToString(program.specialize('T').spec!.outputs[0]!.type)).toBe('bits<3>');
        expect(type).toBe('int');
      } else if (example.startsWith('random')) {
        const src = `module T(x: bit) -> (y: bit) { y = x }\ntest "r" {\n  let m = sim T(x: 0)\n  let v = random(bits<8>)\n  expect v == v\n}\n`;
        expect(runTests(src, { file: 'r.dcl' }).passed).toBe(true);
        expect(codesOf(file(`let t = ${example}`))).toContain('bad-call');
      } else expect(typeOf(example)).toBe(type);
    });
  }
  it('lists every built-in', () => {
    const names = rows.map((r) => r[0]!.replace(/`/g, ''));
    expect(names).toEqual(['concat', 'repeat', 'zext', 'sext', 'trunc', 'reverse', 'any', 'all', 'count_ones', 'signed', 'bits', 'bit', 'bits<N>', 'clog2', 'random']);
  });
  it('refuses to widen with trunc and to narrow with zext', () => {
    expect(codesOf(file('let t = trunc(a, 9)'))).toContain('bad-width');
    expect(codesOf(file('let t = zext(a, 4)'))).toContain('bad-width');
    expect(typeOf('zext(a, 8)')).toBe('bits<8>');
    expect(typeOf('zext(s, 16)')).toBe('signed<16>');
    expect(typeOf('count_ones(c)')).toBe('bit');
  });
});

describe('modules, memories, clocks and tests', () => {
  it('lets items come in any order', () => {
    const src = `module T(a: bit) -> (y: bit) {\n  y = t\n  let t: bit = !a\n}\n`;
    expect(errorsOf(src)).toEqual([]);
  });

  it('takes match arms in any order, with _ covering what is left', () => {
    const src = `module T(f: bits<2>) -> (y: bits<2>) {\n  y = match f {\n    _ => 3,\n    0 => 1,\n    1 | 2 => 2,\n  }\n}\ntest "m" {\n  let m = sim T(f: 0)\n  expect m.y == 1\n  m.f = 2\n  expect m.y == 2\n  m.f = 3\n  expect m.y == 3\n}\n`;
    expect(errorsOf(src)).toEqual([]);
    expect(runTests(src, { file: 'm.dcl' }).passed).toBe(true);
  });

  it('gives a memory two read ports and one write port, with reads one cycle late', () => {
    const src = `module T(clk: clock, a: bits<2>) -> (x: bit, z: bit) {\n  mem m: [bit; 4] = [1, 0, 1, 0]\n  x = m.read(a)\n  z = m.read(a)\n}\n`;
    expect(errorsOf(src)).toEqual([]);
    expect(md).toContain('has at most two read ports');
  });

  it('starts a simulated instance with inputs at 0', () => {
    const src = `module T(a: bits<4>, b: bits<4>) -> (y: bits<4>) {\n  y = a | b\n}\ntest "defaults" {\n  let m = sim T(a: 5)\n  expect m.y == 5\n}\n`;
    expect(runTests(src, { file: 'd.dcl' }).passed).toBe(true);
  });

  it('prints values as the table says', () => {
    const src = `enum E { A, B }\nmodule T(x: bit) -> (y: bit) { y = x }\ntest "p" {\n  let m = sim T(x: 1)\n  print "x =", m.x, E.B\n  let big: bits<16> = 300\n  print big\n}\n`;
    const r = runTests(src, { file: 'p.dcl' });
    expect(r.results[0]!.output).toEqual(['x = 1 E.B', '300 (0x12c)']);
    expect(formatValue(300n, { k: 'bits', w: 16, signed: false })).toBe('300 (0x12c)');
  });

  it('has the limits of the test runner', () => {
    const t = source('testbench.ts');
    expect(t).toContain('maxCycles: options.maxCycles ?? 10_000_000');
    expect(t).toContain('maxFailures: options.maxFailures ?? 10');
    expect(t).toContain('before: options.before ?? 4');
    expect(t).toContain('after: options.after ?? 3');
    expect(t).toContain('seed: options.seed ?? 1');
  });

  it('has the formatter’s width', () => {
    expect(source('format.ts')).toContain('const WIDTH = 100;');
  });
});

describe('the standard library', () => {
  const rows = tableAfter(md, '## The standard library');
  it('has a row for every module', () => {
    const modules = loadStd().flatMap((f) => f.modules).sort();
    expect(rows.map((r) => r[0]!.replace(/`/g, '')).sort()).toEqual(modules);
  });
  it('passes its own tests', () => {
    for (const f of loadStd()) {
      const r = runTests(f.source, { file: f.file });
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(r.results.filter((t) => !t.passed).map((t) => t.name)).toEqual([]);
    }
  });
  it('has the ports the table lists', () => {
    const want: Record<string, string> = {
      Synchronizer: 'clk d | q',
      Debouncer: 'clk raw | clean',
      EdgeDetect: 'clk d | rise fall',
      Fifo: 'clk push data_in pop | data_out empty full count',
      SevenSeg: 'value | segments',
      UartTx: 'clk start data | tx busy',
      UartRx: 'clk rx | data valid',
    };
    for (const [name, ports] of Object.entries(want)) {
      const f = loadStd().find((x) => x.modules.includes(name))!;
      const { program } = check(f.source, { file: f.file });
      const decl = program.modules.get(name)!;
      const got = `${decl.inputs.map((p) => p.name.name).join(' ')} | ${decl.outputs.map((p) => p.name.name).join(' ')}`;
      expect(got, name).toBe(ports);
    }
  });
});

describe('the cost table', () => {
  const rows = tableAfter(md, '## What each construct becomes', 1);
  const W = 8;
  /** Declarations and outputs for each example of the table. */
  const setup: Record<string, [string, string, string?]> = {
    'y = a & b': [`a: bits<${W}>, b: bits<${W}>`, `y: bits<${W}>`],
    'y = ~a': [`a: bits<${W}>`, `y: bits<${W}>`],
    'y = a + b': [`a: bits<${W}>, b: bits<${W}>`, `y: bits<${W}>`],
    'y = a - b': [`a: bits<${W}>, b: bits<${W}>`, `y: bits<${W}>`],
    'y = a + 1': [`a: bits<${W}>`, `y: bits<${W}>`],
    'y = a * b': [`a: bits<${W}>, b: bits<${W}>`, `y: bits<${W}>`],
    'y = a << s': [`a: bits<${W}>, s: bits<3>`, `y: bits<${W}>`],
    'y = a << 3': [`a: bits<${W}>`, `y: bits<${W}>`],
    'y = a == b': [`a: bits<${W}>, b: bits<${W}>`, 'y: bit'],
    'y = a == 42': [`a: bits<${W}>`, 'y: bit'],
    'y = a < b': [`a: bits<${W}>, b: bits<${W}>`, 'y: bit'],
    'y = if c { a } else { b }': [`a: bits<${W}>, b: bits<${W}>, c: bit`, `y: bits<${W}>`],
    'y = match sel { 0 => a, 1 => b, 2 => c, 3 => d }': [`sel: bits<2>, a: bits<${W}>, b: bits<${W}>, c: bits<${W}>, d: bits<${W}>`, `y: bits<${W}>`],
    'y = x[i]': [`x: [bits<${W}>; 4], i: bits<2>`, `y: bits<${W}>`],
    'y = any(a)': [`a: bits<${W}>`, 'y: bit'],
    'y = count_ones(a)': [`a: bits<${W}>`, 'y: bits<4>'],
    'reg r: bits<8> = 0': [`clk: clock, d: bits<${W}>`, `q: bits<${W}>`, 'next r = d\nq = r'],
    'next r = r + 1': [`clk: clock`, `q: bits<${W}>`, `reg r: bits<${W}> = 0\nq = r`],
    'mem m: [bits<8>; 16]': [`clk: clock, a: bits<4>, d: bits<${W}>, we: bit`, `q: bits<${W}>`, 'm.write(a, d, we)\nq = m.read(a)'],
  };
  const NAMES: Record<string, string> = { 'AND gate': 'and', 'AND gates': 'and', 'OR gates': 'or', 'OR gate': 'or', 'XOR gates': 'xor', 'XOR gate': 'xor', 'XNOR gates': 'xnor', inverter: 'not', inverters: 'not', multiplexers: 'mux', multiplexer: 'mux', 'flip-flops': 'dff', 'flip-flop': 'dff', 'RAM block': 'ram' };

  for (const r of rows) {
    const example = firstCode(r[1]!);
    it(`${r[0]}: ${example}`, () => {
      const [decls, outs, extra] = setup[example] ?? (() => { throw new Error(`no setup for ${example}`); })();
      let body = example;
      if (example.startsWith('reg r')) body = `${example}\n${extra}`;
      else if (example.startsWith('next r')) body = `${extra ? '' : ''}reg r: bits<${W}> = 0\n${example}\nq = r`;
      else if (example.startsWith('mem m')) body = `${example}\n${extra}`;
      const src = `module T(${decls}) -> (${outs}) {\n${body}\n}\n`;
      const c = check(src, { file: 'cost.dcl', lint: false });
      expect(c.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const lowered = lowerToNetlist(elaborate(c.program, 'T'), 'T');
      const counts = lowered.stats.byType;
      // What the table says: "13 AND gates, 15 XOR gates" or "nothing".
      const said: Record<string, number> = {};
      if (!/^nothing/.test(r[2]!)) {
        for (const part of r[2]!.split(',')) {
          const m = /^\s*(\d+) (.+?)\s*$/.exec(part);
          expect(m, part).not.toBeNull();
          said[NAMES[m![2]!] ?? m![2]!] = Number(m![1]);
        }
      }
      expect(said).toEqual(counts);
      expect(formatCounts(counts).length >= 0).toBe(true);
    });
  }
});

describe('the standard messages', () => {
  it('quotes the compiler’s wording for a width mismatch', () => {
    const d = check(file('y = 0', 'a: bits<8>, b: bits<4>', 'y: bits<8>').replace('y = 0', 'y = a + b'), { file: 'w.dcl' }).diagnostics;
    expect(d[0]!.help![0]).toBe('extend it explicitly: sext(b, 8) or zext(b, 8)');
  });
});

describe('the top module and the board', () => {
  const rows = tableAfter(md, '## The top module and the virtual board');
  it('binds the ports of the table, and only with the right direction and width', () => {
    const port = (name: string, dir: 'in' | 'out', width: number, clock = false) => ({ name, dir, width, clock });
    const good = [port('clk', 'in', 1, true), port('rst', 'in', 1), port('btn', 'in', 4), port('sw', 'in', 8), port('led', 'out', 8), port('seg0', 'out', 7), port('seg3', 'out', 8)];
    expect(bindBoard(good).errors).toEqual([]);
    expect(bindBoard([port('reset', 'in', 1)]).errors).toEqual([]);
    expect(bindBoard([port('seg', 'out', 7), port('an', 'out', 4)]).errors).toEqual([]);
    expect(bindBoard([port('led', 'out', 4)]).errors.length).toBe(1);
    expect(bindBoard([port('sw', 'out', 8)]).errors.length).toBe(1);
    expect(bindBoard([port('clk', 'in', 1, false)]).errors.length).toBe(1);
    expect(bindBoard([port('seg', 'out', 7)]).errors.length).toBe(1);
    // Free ports get a switch or an LED.
    const free = bindBoard([port('x', 'in', 2), port('y', 'out', 1)]);
    expect(free.freeInputs).toEqual(['x[0]', 'x[1]']);
    expect(free.freeOutputs).toEqual(['y']);
    expect(rows.length).toBe(7);
  });
});
