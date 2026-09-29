import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { check } from './check';
import { renderDiagnostic } from './diagnostics';
import { renderTestResult, runTests } from './testbench';
import { typeToString } from './tir';

/** Checks a source that must have no errors, and runs its tests. */
function passes(src: string): void {
  const r = runTests(src, { file: 'ok.dcl' });
  const errors = r.diagnostics.filter((d) => d.severity === 'error').map((d) => renderDiagnostic(src, d));
  expect(errors).toEqual([]);
  const failed = r.results.filter((t) => !t.passed).map((t) => renderTestResult(r.source, t));
  expect(failed).toEqual([]);
  expect(r.results.length).toBeGreaterThan(0);
}

function codes(src: string): string[] {
  return check(src, { file: 'e.dcl', lint: false }).diagnostics.map((d) => d.code);
}

describe('checker: types and literals', () => {
  it('flows literal types through if, match, arithmetic and bitwise operators', () => {
    passes(`module M(a: bits<32>, shift: bits<5>, c: bit) -> (y: bits<32>, z: bits<8>, w: bits<8>) {
  y = a >> shift | ~(0xffffffff >> shift)
  z = if c { 1 } else { 0xff }
  w = match c { 0 => 3 + 4 * 2, 1 => ~0 }
}
test "values" {
  let m = sim M(a: 0x8000_0000, shift: 4, c: 1)
  expect m.y == 0xf800_0000 && m.z == 1 && m.w == 255
  m.c = 0
  expect m.z == 255 && m.w == 11
}`);
  });

  it('evaluates constant expressions before checking that they fit', () => {
    passes(`module M<N: int>(a: bits<clog2(N)>) -> (y: bits<clog2(N)>, last: bit) {
  const TOP: int = N - 1
  y = if a == TOP { 0 } else { a + 1 }
  last = a == N - 1
}
test "wraps" {
  let m = sim M<8>(a: 7)
  expect m.y == 0 && m.last
}`);
    expect(codes('module M() -> (y: bits<4>) {\n  y = 8 + 8\n}')).toEqual(['literal-too-wide']);
    expect(codes('module M() -> (y: bits<4>) {\n  y = 3 - 4\n}')).toEqual(['literal-too-wide']);
  });

  it('treats bit and bits<1> as the same type', () => {
    passes(`module M(a: bit, b: bits<1>) -> (y: bits<1>, z: bit) {
  y = a
  z = a && b
}
test "t" {
  let m = sim M(a: 1, b: 1)
  expect m.y == 1 && m.z
}`);
  });

  it('requires operands of exactly the same width and signedness', () => {
    expect(codes('module M(a: bits<4>, b: bits<5>) -> (y: bits<4>) {\n  y = a + b\n}')).toEqual(['width-mismatch']);
    expect(codes('module M(a: bits<4>, b: signed<4>) -> (y: bit) {\n  y = a < b\n}')).toEqual(['type-mismatch']);
    expect(codes('module M(a: bits<4>) -> (y: bits<4>) {\n  y = ~a\n}')).toEqual([]);
    expect(codes('enum E { A, B }\nmodule M(e: E) -> (y: E) {\n  y = ~e\n}')).toEqual(['bad-operand']);
  });

  it('allows any width of shift amount', () => {
    expect(codes('module M(a: bits<32>, s: bits<2>, t: bits<40>) -> (y: bits<32>) {\n  y = (a << s) >> t\n}')).toEqual([]);
  });

  it('types signed values: comparison, arithmetic right shift and conversions', () => {
    passes(`module M(a: signed<8>, b: signed<8>) -> (less: bit, half: signed<8>, raw: bits<8>, back: signed<8>) {
  less = a < b
  half = a >> 1
  raw = bits(a)
  back = signed(bits(a))
}
test "t" {
  let m = sim M(a: -6, b: 3)
  expect m.less && m.half == -3 && m.raw == 250 && m.back == -6
}`);
  });

  it('checks arrays, structs, enums and aliases, and indexes arrays by constants or exact-width values', () => {
    passes(`type Byte = bits<8>
struct Pair { hi: Byte, lo: Byte }
@gray enum Phase { A, B, C, D }
module M(xs: [Byte; 4], i: bits<2>, p: Pair, ph: Phase) -> (
  first: Byte, picked: Byte, sum: Byte, bit3: bit, flat: bits<16>, code: bits<2>, c: bit,
) {
  first = xs[0]
  picked = xs[i]
  sum = p.hi + p.lo
  bit3 = p.lo[zext(i, 3)]
  flat = bits(p)
  code = bits(ph)
  c = ph == Phase.C
}
test "t" {
  let m = sim M(xs: [10, 20, 30, 40], i: 2, p: Pair { hi: 1, lo: 0x0c }, ph: Phase.C)
  expect m.first == 10 && m.picked == 30 && m.sum == 13 && m.bit3 == 1 && m.flat == 0x010c
  expect m.code == 3 && m.c
}`);
    expect(codes('module M(xs: [bits<8>; 4], i: bits<3>) -> (y: bits<8>) {\n  y = xs[i]\n}')).toEqual(['index-width']);
    expect(codes('module M(xs: [bits<8>; 4]) -> (y: bits<8>) {\n  y = xs[4]\n}')).toEqual(['index-out-of-range']);
  });

  it('gives enums their encodings', () => {
    const r = check('@onehot enum A { X, Y, Z }\n@gray enum G { P, Q, R }\nenum B { M, N, O, P2, Q2 }\nmodule T(a: A, g: G, b: B) -> (y: bit) {\n  y = 0\n}');
    const spec = r.program.specs.get('T')!;
    expect(spec.inputs.map((p) => [typeToString(p.type), p.type.k === 'enum' ? p.type.w : 0])).toEqual([['A', 3], ['G', 2], ['B', 3]]);
    const g = spec.inputs[1]!.type;
    expect(g.k === 'enum' && g.codes).toEqual([0n, 1n, 3n]);
  });

  it('provides the built-ins', () => {
    passes(`module M(a: bits<8>, s: bits<4>) -> (
  c: bits<12>, r: bits<16>, z: bits<12>, e: bits<12>, t: bits<3>, rev: bits<8>, any_set: bit, all_set: bit, ones: bits<4>,
) {
  c = concat(a, bits<4>(0))
  r = repeat(a, 2)
  z = zext(s, 12)
  e = sext(s, 12)
  t = trunc(a, 3)
  rev = reverse(a)
  any_set = any(s)
  all_set = all(a)
  ones = count_ones(a)
}
test "t" {
  let m = sim M(a: 0b1000_0110, s: 0b1010)
  expect m.c == 0x860 && m.r == 0x8686 && m.z == 0x00a && m.e == 0xffa && m.t == 0b110
  expect m.rev == 0b0110_0001 && m.any_set && !m.all_set && m.ones == 3
}`);
  });

  it('checks the width arguments of the built-ins', () => {
    expect(codes('module M(a: bits<8>) -> (y: bits<4>) {\n  y = zext(a, 4)\n}')).toEqual(['bad-width']);
    expect(codes('module M(a: bits<8>) -> (y: bits<16>) {\n  y = trunc(a, 16)\n}')).toEqual(['bad-width']);
    expect(codes('module M(a: bits<8>, n: bits<4>) -> (y: bits<16>) {\n  y = zext(a, n)\n}')).toEqual(['not-constant']);
  });
});

describe('checker: modules', () => {
  it('orders unordered items by their dataflow', () => {
    passes(`module M(a: bits<4>) -> (y: bits<4>) {
  y = c
  let c: bits<4> = b + 1
  let b: bits<4> = a + 1
}
test "t" {
  let m = sim M(a: 1)
  expect m.y == 3
}`);
  });

  it('accepts `_` anywhere in a match', () => {
    passes(`module M(x: bits<2>) -> (y: bits<4>) {
  y = match x { _ => 9, 0 => 1, 3 => 4 }
}
test "t" {
  let m = sim M(x: 0)
  expect m.y == 1
  m.x = 2
  expect m.y == 9
}`);
  });

  it('warns about a `_` arm that can never match', () => {
    const r = check('module M(x: bit) -> (y: bit) {\n  y = match x { 0 => 1, 1 => 0, _ => 0 }\n}');
    expect(r.diagnostics.map((d) => [d.severity, d.code])).toEqual([['warning', 'unreachable-arm']]);
  });

  it('specialises generic modules for each set of arguments', () => {
    const src = `module Adder<N: int>(a: bits<N>, b: bits<N>) -> (s: bits<N + 1>) {
  s = zext(a, N + 1) + zext(b, N + 1)
}
module Top(x: bits<4>, y: bits<8>) -> (p: bits<5>, q: bits<9>) {
  inst small: Adder<4>(a: x, b: x)
  inst big: Adder<2 * 4>(a: y, b: y)
  p = small.s
  q = big.s
}
test "t" {
  let t = sim Top(x: 15, y: 255)
  expect t.p == 30 && t.q == 510
}`;
    passes(src);
    const r = check(src);
    expect([...r.program.specs.keys()].sort()).toEqual(['Adder<4>', 'Adder<8>', 'Top']);
  });

  it('reports errors in a generic module for the arguments that cause them', () => {
    const r = check(`module G<N: int>(a: bits<N>) -> (y: bits<4>) {\n  y = a\n}\nmodule T(a: bits<4>, b: bits<5>) -> (y: bits<4>, z: bits<4>) {\n  inst ok: G<4>(a: a)\n  inst bad: G<5>(a: b)\n  y = ok.y\n  z = bad.y\n}`);
    expect(r.diagnostics.map((d) => `${d.code} ${d.span.line}`)).toEqual(['width-mismatch 2']);
  });

  it('unrolls for loops, with per-iteration lets and constants', () => {
    passes(`module Shift(clk: clock, d: bit) -> (q: bits<4>) {
  reg stages: [bit; 4] = [0; 4]
  next stages[0] = d
  for i in 1..4 {
    const PREV: int = i - 1
    let from: bit = stages[PREV]
    next stages[i] = from
  }
  q = concat(stages[3], stages[2], stages[1], stages[0])
}
test "t" {
  let s = sim Shift(d: 1)
  step 2
  expect s.q == 0b0011
  s.d = 0
  step 3
  expect s.q == 0b1000
}`);
  });

  it('inlines functions, inferring their generic parameters', () => {
    passes(`fn max<N: int>(a: bits<N>, b: bits<N>) -> bits<N> {
  if a > b { a } else { b }
}
fn parity(x: bits<8>) -> bit { count_ones(x)[0] }
module M(a: bits<8>, b: bits<8>, c: bits<3>, d: bits<3>) -> (m: bits<8>, n: bits<3>, p: bit) {
  m = max(a, b)
  n = max(c, d)
  p = parity(a)
}
test "t" {
  let x = sim M(a: 7, b: 200, c: 6, d: 2)
  expect x.m == 200 && x.n == 6 && x.p == 1
}`);
  });

  it('checks memories: synchronous reads and one write port', () => {
    passes(`module Ram(clk: clock, we: bit, addr: bits<4>, data: bits<8>) -> (q: bits<8>) {
  mem store: [bits<8>; 16] = [5; 16]
  store.write(addr, data, we)
  q = store.read(addr)
}
test "t" {
  let r = sim Ram(we: 1, addr: 3, data: 42)
  expect r.q == 0
  step
  expect r.q == 5
  step
  expect r.q == 42
}`);
  });

  it('lets outputs of instances feed each other without a loop', () => {
    passes(`module Inc(a: bits<4>) -> (y: bits<4>) {
  y = a + 1
}
module M(a: bits<4>) -> (y: bits<4>) {
  inst first: Inc(a: a)
  inst second: Inc(a: first.y)
  y = second.y
}
test "t" {
  let m = sim M(a: 1)
  expect m.y == 3
}`);
  });

  it('finds combinational loops through instances and reports the path', () => {
    const r = check(`module Buf(a: bit) -> (y: bit) {\n  y = a\n}\nmodule M(x: bit) -> (y: bit) {\n  inst b: Buf(a: t)\n  let t: bit = b.y && x\n  y = t\n}`);
    expect(r.diagnostics.map((d) => [d.code, d.label])).toEqual([['comb-loop', 'b.y → t → b.y']]);
  });

  it('does not report a loop through a register', () => {
    expect(codes('module M(clk: clock) -> (y: bit) {\n  reg r: bit = 0\n  let n: bit = !r\n  next r = n\n  y = r\n}')).toEqual([]);
  });

  it('checks registers of an array element by element across loops', () => {
    expect(codes('module M(clk: clock, a: bit) -> (y: bit) {\n  reg r: [bit; 4] = [0; 4]\n  for i in 0..4 {\n    next r[i] = a\n  }\n  y = r[0]\n}')).toEqual([]);
    expect(codes('module M(clk: clock, a: bit, i: bits<2>) -> (y: bit) {\n  reg r: [bit; 4] = [0; 4]\n  next r[i] = a\n  y = r[0]\n}')).toEqual(['missing-next', 'not-constant']);
  });

  it('checks clock domains and allows crossing through a Synchronizer', () => {
    expect(codes(`module M(fast: clock, slow: clock, a: bit) -> (y: bit) {
  reg r: bit = 0 on fast
  next r = a
  inst s: Synchronizer(clk: slow, d: r)
  reg t: bit = 0 on slow
  next t = s.q
  y = t
}`)).toEqual([]);
  });

  it('marks every specialisation that has an error, even when the message repeats', () => {
    const r = check('module G<N: int>(a: bits<N>) -> (y: bits<N>) {\n  y = nope\n}\nmodule T(a: bits<4>, b: bits<5>) -> (x: bits<4>, y: bits<5>) {\n  inst g: G<4>(a: a)\n  inst h: G<5>(a: b)\n  x = g.y\n  y = h.y\n}');
    expect(r.diagnostics.map((d) => d.code)).toEqual(['unknown-name']);
    expect(r.program.specs.get('G<4>')!.hasErrors).toBe(true);
    expect(r.program.specs.get('G<5>')!.hasErrors).toBe(true);
  });

  it('marks a module without an error-free child as having errors', () => {
    const r = check('module C(a: bit) -> (y: bits<2>) {\n  y = a\n}\nmodule P(a: bit) -> (y: bits<2>) {\n  inst c: C(a: a)\n  y = c.y\n}');
    expect(r.program.specs.get('C')!.hasErrors).toBe(true);
    expect(r.program.specs.get('P')!.hasErrors).toBe(false);
  });

  it('uses the standard library unless told not to', () => {
    const src = 'module M(clk: clock, a: bit) -> (y: bit) {\n  inst s: Synchronizer(clk: clk, d: a)\n  y = s.q\n}';
    expect(codes(src)).toEqual([]);
    expect(check(src, { std: false }).diagnostics.map((d) => d.code)).toEqual(['unknown-module']);
  });

  it('reports every error with a span inside the source, and never throws, on mutated designs', () => {
    const base = readFileSync(new URL('../../../content/designs/rv32i.dcl', import.meta.url), 'utf8');
    let seed = 3;
    const rnd = (n: number) => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return (seed >>> 8) % n;
    };
    const junk = ['', ' ', '+', '1', 'x', '{', '}', '(', ')', '\n', 'bits<3>', 'let', '==', ':', ',', '0x7ff'];
    for (let k = 0; k < 60; k++) {
      let src = base;
      for (let m = 0; m < 3; m++) {
        const at = rnd(src.length);
        src = src.slice(0, at) + junk[rnd(junk.length)] + src.slice(at + rnd(4));
      }
      const r = check(src, { file: 'm.dcl' });
      for (const d of r.diagnostics) {
        expect(d.span.file).toBe('m.dcl');
        expect(d.span.start).toBeGreaterThanOrEqual(0);
        expect(d.span.end).toBeLessThanOrEqual(src.length);
        renderDiagnostic(src, d);
      }
    }
  });
});

describe('checker: performance', () => {
  it('checks the RV32I core in under 50 ms when warm', () => {
    const src = readFileSync(new URL('../../../content/designs/rv32i.dcl', import.meta.url), 'utf8');
    for (let i = 0; i < 10; i++) check(src);
    const runs: number[] = [];
    for (let i = 0; i < 10; i++) {
      const t = performance.now();
      check(src);
      runs.push(performance.now() - t);
    }
    runs.sort((a, b) => a - b);
    console.log(`check(rv32i.dcl): median ${runs[5]!.toFixed(2)} ms warm`);
    expect(runs[5]).toBeLessThan(50);
  });
});
