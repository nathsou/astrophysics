import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { check } from './check';
import { elaborate, ElaborationError } from './elaborate';
import { cellInputs, flattenRtl, printRtl, type RtlCell, type RtlModule } from './rtl';
import { createRtlSim } from './rtlsim';

function rtl(src: string, top?: string) {
  const r = check(src, { file: 'e.dcl' });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return elaborate(r.program, top);
}

const kinds = (m: RtlModule) => m.cells.map((c) => c.kind).sort();
const textOf = (src: string, c: RtlCell) => src.slice(c.src.start, c.src.end);

describe('elaboration to word-level RTL', () => {
  it('turns each operator into a cell tagged with its source span and path', () => {
    const src = 'module M(a: bits<8>, b: bits<8>, s: signed<8>) -> (x: bits<8>, y: bit, z: bit, w: signed<8>) {\n  x = (a + b) & ~a\n  y = a < b\n  z = s < signed<8>(0)\n  w = s >> 1\n}';
    const d = rtl(src, 'M');
    const m = d.modules.M!;
    expect(kinds(m)).toEqual(['add', 'and', 'const', 'const', 'lt', 'lt', 'not', 'shr']);
    const add = m.cells.find((c) => c.kind === 'add')!;
    expect(textOf(src, add)).toBe('a + b');
    expect(add.src).toMatchObject({ file: 'e.dcl', line: 2 });
    expect(add.path).toBe('M');
    const lts = m.cells.filter((c): c is Extract<RtlCell, { kind: 'lt' | 'le' | 'gt' | 'ge' }> => c.kind === 'lt');
    expect(lts.map((c) => c.signed)).toEqual([false, true]);
    const shr = m.cells.find((c): c is Extract<RtlCell, { kind: 'shr' }> => c.kind === 'shr')!;
    expect(shr.signed).toBe(true);
  });

  it('turns if into mux and match into one parallel pmux', () => {
    const src = 'module M(c: bit, k: bits<2>, a: bits<4>) -> (x: bits<4>, y: bits<4>) {\n  x = if c { a } else { 0 }\n  y = match k { 0 => a, 1 | 2 => 5, _ => 9 }\n}';
    const m = rtl(src, 'M').modules.M!;
    const mux = m.cells.find((c): c is Extract<RtlCell, { kind: 'mux' }> => c.kind === 'mux')!;
    // `a` is selected when c = 1.
    expect(mux.b).toBe(m.names.a);
    const pmux = m.cells.find((c): c is Extract<RtlCell, { kind: 'pmux' }> => c.kind === 'pmux')!;
    expect(pmux.cases.map((x) => x.match)).toEqual([[0n], [1n, 2n]]);
    expect(textOf(src, pmux)).toMatch(/^match k/);
  });

  it('lowers slices, concatenation, repetition, extension and truncation', () => {
    const m = rtl('module M(a: bits<8>) -> (x: bits<4>, y: bits<16>, z: bits<12>, w: bits<12>, t: bits<2>) {\n  x = a[5:2]\n  y = concat(a, a)\n  z = sext(a, 12)\n  w = zext(a, 12)\n  t = trunc(a, 2) ^ repeat(a[0], 2)\n}', 'M').modules.M!;
    expect(kinds(m)).toEqual(['concat', 'repeat', 'sext', 'slice', 'slice', 'slice', 'xor', 'zext']);
    const slice = m.cells.find((c): c is Extract<RtlCell, { kind: 'slice' }> => c.kind === 'slice' && m.signals[c.y]!.width === 4)!;
    expect(slice.lo).toBe(2);
  });

  it('makes one register per element of a register array, with its initial value and clock', () => {
    const m = rtl('module M(clk: clock, d: bits<4>, i: bits<2>) -> (q: bits<4>) {\n  reg r: [bits<4>; 4] = [1, 2, 3, 4]\n  for k in 0..4 {\n    next r[k] = if i == k { d } else { r[k] }\n  }\n  q = r[i]\n}', 'M').modules.M!;
    const regs = m.cells.filter((c): c is Extract<RtlCell, { kind: 'reg' }> => c.kind === 'reg');
    expect(regs.map((r) => r.init)).toEqual([1n, 2n, 3n, 4n]);
    expect(regs.every((r) => r.clk === m.names.clk)).toBe(true);
    expect(Object.keys(m.names)).toContain('r[3]');
    // The dynamic read is one parallel multiplexer over the four elements.
    const pmux = m.cells.filter((c) => c.kind === 'pmux');
    expect(pmux).toHaveLength(1);
  });

  it('makes a memory cell with its read and write ports', () => {
    const m = rtl('module M(clk: clock, a: bits<3>, d: bits<8>, we: bit) -> (q: bits<8>) {\n  mem m: [bits<8>; 8] = [7; 8]\n  m.write(a, d, we)\n  q = m.read(a)\n}', 'M').modules.M!;
    const mem = m.cells.find((c): c is Extract<RtlCell, { kind: 'mem' }> => c.kind === 'mem')!;
    expect(mem).toMatchObject({ width: 8, depth: 8, name: 'm' });
    expect(mem.init).toEqual(new Array(8).fill(7n));
    expect(mem.reads).toHaveLength(1);
    expect(mem.writes[0]).toEqual({ addr: m.names.a, data: m.names.d, en: m.names.we });
    expect(m.names['m.read0']).toBe(mem.reads[0]!.data);
  });

  it('keeps the hierarchy, and flattens it with hierarchical names and paths', () => {
    const src = readFileSync(new URL('../../../content/designs/rv32i.dcl', import.meta.url), 'utf8');
    const d = elaborate(check(src).program);
    expect(d.top).toBe('riscv32');
    const top = d.modules.riscv32!;
    expect(top.instances.map((i) => [i.name, i.module, i.path])).toEqual([
      ['register_file', 'RegFile', 'riscv32.register_file'],
      ['arithmetic', 'Alu', 'riscv32.arithmetic'],
    ]);
    const flat = flattenRtl(d);
    expect(flat.instances).toEqual([]);
    expect(Object.keys(flat.names)).toEqual(expect.arrayContaining(['pc', 'register_file.x[31]', 'arithmetic.sum']));
    expect(new Set(flat.cells.map((c) => c.path))).toEqual(new Set(['riscv32', 'riscv32.register_file', 'riscv32.arithmetic']));
    // Every cell reads only signals that exist, and every signal has at most one driver.
    const drivers = new Map<number, number>();
    for (const c of flat.cells) {
      for (const s of cellInputs(c)) expect(flat.signals[s]).toBeDefined();
      for (const y of c.kind === 'mem' ? c.reads.map((r) => r.data) : [c.y]) drivers.set(y, (drivers.get(y) ?? 0) + 1);
    }
    expect([...drivers.values()].every((n) => n === 1)).toBe(true);
    // The ALU's cells point into the Alu module's source.
    const aluAdd = flat.cells.find((c) => c.path === 'riscv32.arithmetic' && c.kind === 'add')!;
    expect(src.slice(aluAdd.src.start, aluAdd.src.end)).toMatch(/rs1_value \+ addend/);
    expect(printRtl(top)).toMatch(/inst register_file: RegFile\(clk: %0\(clk\)/);
  });

  it('elaborates generic specialisations as separate modules', () => {
    const d = rtl('module G<N: int>(a: bits<N>) -> (y: bits<N>) {\n  y = ~a\n}\nmodule T(a: bits<4>, b: bits<6>) -> (x: bits<4>, y: bits<6>) {\n  inst g4: G<4>(a: a)\n  inst g6: G<6>(a: b)\n  x = g4.y\n  y = g6.y\n}', 'T');
    expect(Object.keys(d.modules).sort()).toEqual(['G<4>', 'G<6>', 'T']);
    const sim = createRtlSim(d);
    sim.set('a', 5);
    sim.set('b', 5);
    expect([sim.get('x'), sim.get('y')]).toEqual([10, 58]);
  });

  it('refuses a design with errors, and a missing top', () => {
    const bad = check('module M(a: bit) -> (y: bits<2>) {\n  y = a\n}');
    expect(() => elaborate(bad.program, 'M')).toThrow(ElaborationError);
    expect(() => elaborate(check('module M(a: bit) -> (y: bit) {\n  y = a\n}').program)).toThrow(/no top module/);
  });
});
