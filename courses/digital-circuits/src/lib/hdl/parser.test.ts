import { describe, expect, it } from 'vitest';
import type { Expr, ModuleDecl, ModuleItem } from './ast';
import { parse } from './parser';

/** An expression with explicit parentheses around every operation. */
function paren(e: Expr): string {
  switch (e.kind) {
    case 'number':
      return e.text;
    case 'name':
      return e.name;
    case 'binary':
      return `(${paren(e.left)} ${e.op} ${paren(e.right)})`;
    case 'unary':
      return `(${e.op}${paren(e.operand)})`;
    case 'paren':
      return paren(e.inner);
    case 'block':
      return `{${paren(e.inner)}}`;
    case 'if':
      return `if ${paren(e.cond)} {${paren(e.then)}} else {${paren(e.else)}}`;
    case 'match':
      return `match ${paren(e.scrutinee)} {${e.arms.map((a) => `${[...(a.wildcard ? ['_'] : []), ...a.patterns.map(paren)].join('|')} => ${paren(a.body)}`).join(', ')}}`;
    case 'call':
      return `${e.callee.name}(${e.args.map(paren).join(', ')})`;
    case 'method':
      return `${paren(e.target)}.${e.method.name}(${e.args.map(paren).join(', ')})`;
    case 'field':
      return `${paren(e.target)}.${e.field.name}`;
    case 'index':
      return `${paren(e.target)}[${paren(e.index)}]`;
    case 'slice':
      return `${paren(e.target)}[${paren(e.hi)}:${paren(e.lo)}]`;
    case 'typed':
      return `${e.type.kind === 'named' ? e.type.name.name : '[]'}<${e.type.kind === 'named' ? e.type.args.map(paren).join(', ') : ''}>(${paren(e.arg)})`;
    case 'array':
      return `[${e.elems.map(paren).join(', ')}]`;
    case 'repeat':
      return `[${paren(e.value)}; ${paren(e.count)}]`;
    case 'struct':
      return `${e.name.name} {${e.fields.map((f) => `${f.name.name}: ${paren(f.value)}`).join(', ')}}`;
    default:
      return `<${e.kind}>`;
  }
}

function expr(src: string): string {
  const r = parse(`module M() -> (y: bit) {\n  y = ${src}\n}`);
  expect(r.diagnostics).toEqual([]);
  const m = r.program.items[0] as ModuleDecl;
  const a = m.body[0] as Extract<ModuleItem, { kind: 'assign' }>;
  return paren(a.value);
}

function errors(src: string): string[] {
  return parse(src).diagnostics.map((d) => `${d.span.line}:${d.span.col} ${d.message}`);
}

describe('parser: expressions', () => {
  it("uses Rust's precedence, where & binds tighter than ==", () => {
    expect(expr('a + b * c')).toBe('(a + (b * c))');
    expect(expr('a & b == c')).toBe('((a & b) == c)');
    expect(expr('a | b ^ c & d')).toBe('(a | (b ^ (c & d)))');
    expect(expr('a << 1 + b')).toBe('(a << (1 + b))');
    expect(expr('a == b && c != d || e')).toBe('(((a == b) && (c != d)) || e)');
    expect(expr('a >> s | b')).toBe('((a >> s) | b)');
    expect(expr('rs1_value + imm_i & 0xfffffffe')).toBe('((rs1_value + imm_i) & 0xfffffffe)');
  });

  it('is left-associative', () => {
    expect(expr('a - b - c')).toBe('((a - b) - c)');
    expect(expr('a || b || c')).toBe('((a || b) || c)');
  });

  it('parses unary operators tighter than binary ones', () => {
    expect(expr('!a && ~b == -c')).toBe('((!a) && ((~b) == (-c)))');
    expect(expr('~(a >> s)')).toBe('(~(a >> s))');
  });

  it('parses postfix forms', () => {
    expect(expr('x[3:0]')).toBe('x[3:0]');
    expect(expr('u.port[i]')).toBe('u.port[i]');
    expect(expr('m.read(a + 1)')).toBe('m.read((a + 1))');
    expect(expr('regs[i].valid')).toBe('regs[i].valid');
    expect(expr('Light.Red')).toBe('Light.Red');
  });

  it('parses calls, typed literals, arrays and struct literals', () => {
    expect(expr('concat(a, b[3:0], c,)')).toBe('concat(a, b[3:0], c)');
    expect(expr('bits<12>(0)')).toBe('bits<12>(0)');
    expect(expr('signed<N + 1>(x)')).toBe('signed<(N + 1)>(x)');
    expect(expr('[1, 2, 3]')).toBe('[1, 2, 3]');
    expect(expr('[0; 32]')).toBe('[0; 32]');
    expect(expr('Pixel { r: 1, g: 2 }')).toBe('Pixel {r: 1, g: 2}');
  });

  it('parses if chains and match arms with alternatives and `_`', () => {
    expect(expr('if a { 1 } else if b { 2 } else { 3 }')).toBe('if a {1} else {if b {2} else {3}}');
    expect(expr('match x { _ => 0, 1 | 2 => a, 3 => b }')).toBe('match x {_ => 0, 1|2 => a, 3 => b}');
    expect(expr('match f3 {\n  0 => a\n  1 => b,\n}')).toBe('match f3 {0 => a, 1 => b}');
  });

  it('does not take `{` after an if condition as a struct literal', () => {
    expect(expr('if Ready { a } else { b }')).toBe('if Ready {a} else {b}');
  });
});

describe('parser: items', () => {
  it('parses a module with generics, ports, docs and every kind of item', () => {
    const src = `/// A module.
top module Fifo<WIDTH: int, DEPTH: int>(
  /// The clock.
  clk: clock,
  data: bits<WIDTH>,
) -> (out: bits<WIDTH>) {
  const LAST: int = DEPTH - 1
  reg slots: [bits<WIDTH>; DEPTH] = [0; DEPTH]
  reg other: bit = 0 on clk
  mem ram: [bits<8>; 16] = [0; 16]
  let x = data
  next slots[0] = data
  inst sub: Child<4>(a: x, b: 1,)
  ram.write(0, 1, 1)
  for i in 1..DEPTH { next slots[i] = slots[i - 1] }
  out = slots[LAST]
}`;
    const r = parse(src, 'fifo.dcl');
    expect(r.diagnostics).toEqual([]);
    const m = r.program.items[0] as ModuleDecl;
    expect(m.top).toBe(true);
    expect(m.doc).toBe('A module.');
    expect(m.inputs[0]!.doc).toBe('The clock.');
    expect(m.generics.map((g) => g.name.name)).toEqual(['WIDTH', 'DEPTH']);
    expect(m.body.map((i) => i.kind)).toEqual(['const', 'reg', 'reg', 'mem', 'let', 'next', 'inst', 'write', 'for', 'assign']);
    const reg = m.body[2] as Extract<ModuleItem, { kind: 'reg' }>;
    expect(reg.clock?.name).toBe('clk');
    expect(m.span).toMatchObject({ file: 'fifo.dcl', line: 2, col: 1 });
  });

  it('parses structs, enums with encodings, aliases, constants, functions and tests', () => {
    const r = parse(`struct P { a: bit, b: bits<2> }
@onehot enum S { A, B, C }
enum T {
  X
  Y
}
type Word = bits<32>
const K: bits<4> = 3
fn inc<N: int>(x: bits<N>) -> bits<N> { x + 1 }
test "name" {
  let c = sim M<2>(a: 1)
  c.a = 0
  step 3 on clk
  step
  expect c.y == 1
  print "y", c.y
  for i in 0..4 { step }
}`);
    expect(r.diagnostics).toEqual([]);
    expect(r.program.items.map((i) => i.kind)).toEqual(['struct', 'enum', 'enum', 'type', 'const', 'fn', 'test']);
    const s = r.program.items[1]!;
    expect(s.kind === 'enum' && s.encoding).toBe('onehot');
    const t = r.program.items[2]!;
    expect(t.kind === 'enum' && t.variants.map((v) => v.name)).toEqual(['X', 'Y']);
    const test = r.program.items[6]!;
    expect(test.kind === 'test' && test.body.map((x) => x.kind)).toEqual(['let', 'set', 'step', 'step', 'expect', 'print', 'for']);
  });

  it('accepts semicolons as separators and the RV32I one-line style', () => {
    const r = parse('module M(a: bit) -> (x: bit, y: bit) { let t: bit = a; x = t; y = !t; }');
    expect(r.diagnostics).toEqual([]);
    expect((r.program.items[0] as ModuleDecl).body).toHaveLength(3);
  });

  it('accepts a type alias ending with `>` before the next item', () => {
    const r = parse('type Word = bits<32>\nmodule M() -> (y: Word) {\n  y = 0\n}');
    expect(r.diagnostics).toEqual([]);
    expect(r.program.items.map((i) => i.kind)).toEqual(['type', 'module']);
  });
});

describe('parser: errors and recovery', () => {
  it('requires `else`', () => {
    expect(errors('module M(c: bit) -> (y: bit) {\n  y = if c { 1 }\n}')).toEqual(['2:7 `if` needs an `else`']);
  });

  it('reports several independent errors in one file', () => {
    const src = `module A(a: bit) -> (y: bit) {
  let = a
  y = a +
}
module B() -> (y: bit) {
  y = 1 2
  reg r = 0
}
let x = 1
module C(a: bit -> (y: bit) {
  y = (a
}
module D() -> (y: bit) {
  y = 1
}`;
    const r = parse(src);
    expect(r.diagnostics.map((d) => `${d.span.line}:${d.span.col} ${d.message}`)).toEqual([
      '2:7 expected a name, found `=`',
      '4:1 expected an expression, found `}`',
      '6:9 expected the end of the statement, found number `2`',
      '7:9 a register needs a type',
      '9:1 expected an item (`module`, `fn`, `struct`, `enum`, `type`, `const` or `test`), found keyword `let`',
      '10:17 expected `,` or `)` in the port list, found `->`',
      '12:1 expected `)` to close the parenthesis, found `}`',
    ]);
    // The modules after the errors are still parsed.
    expect(r.program.items.map((i) => (i.kind === 'module' ? i.name.name : i.kind))).toEqual(['A', 'B', 'C', 'D']);
  });

  it('keeps a statement whose value has an error, as an error expression', () => {
    const r = parse('module M(a: bit) -> (y: bit) {\n  y = a +\n  let z: bit = a\n}');
    const body = (r.program.items[0] as ModuleDecl).body;
    expect(body.map((i) => i.kind)).toEqual(['assign', 'let']);
    expect((body[0] as Extract<ModuleItem, { kind: 'assign' }>).value.kind).toBe('error');
  });

  it('reports chained comparisons', () => {
    expect(errors('module M() -> (y: bit) {\n  y = a < b < c\n}')).toEqual(['2:13 comparisons cannot be chained']);
  });

  it('never throws on arbitrary input, and every error has a span inside the text', () => {
    const pieces = ['module', 'M', '(', ')', '{', '}', '->', 'let', '=', 'x', '1', '+', ':', 'bits', '<', '>', ',', '\n', 'if', 'else', 'match', '=>', '_', '[', ']', ';', 'reg', 'next', 'test', '"t"', 'step', 'expect', '.', 'for', 'in', '..'];
    let seed = 7;
    const rnd = (n: number) => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return (seed >>> 8) % n;
    };
    for (let k = 0; k < 400; k++) {
      const src = Array.from({ length: 1 + rnd(40) }, () => pieces[rnd(pieces.length)]).join(' ');
      const r = parse(src);
      for (const d of r.diagnostics) {
        expect(d.span.start).toBeGreaterThanOrEqual(0);
        expect(d.span.end).toBeLessThanOrEqual(src.length);
      }
    }
  });
});
