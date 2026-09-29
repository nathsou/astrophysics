import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stripSpans } from './ast';
import { check } from './check';
import { format, formatResult } from './format';
import { parse } from './parser';
import { loadStd } from './std/index';

const DESIGNS = new URL('../../../content/designs/', import.meta.url);
const designs = readdirSync(DESIGNS)
  .filter((f) => f.endsWith('.dcl'))
  .map((f) => ({ name: f, source: readFileSync(new URL(f, DESIGNS), 'utf8') }));
const std = loadStd().map((f) => ({ name: f.file, source: f.source }));
const hdlBlocks = [...readFileSync(new URL('../../../docs/HDL.md', import.meta.url), 'utf8').matchAll(/```dcl\n([\s\S]*?)```/g)].map((m, i) => ({
  name: `HDL.md block ${i + 1}`,
  source: m[1]!,
}));

const sameAst = (a: string, b: string) => expect(stripSpans(parse(b).program.items)).toEqual(stripSpans(parse(a).program.items));

describe('formatter: canonical style', () => {
  it('splits statements sharing a line and removes semicolons', () => {
    expect(format('module M(a: bit) -> (x: bit, y: bit) { let t: bit = a; x = t; y = !t; }')).toBe(
      'module M(a: bit) -> (x: bit, y: bit) {\n  let t: bit = a\n  x = t\n  y = !t\n}\n',
    );
  });

  it('indents with two spaces and normalises spacing', () => {
    expect(format('module   M ( a :bits< 4 > )->( y:bits<4> ){\n        y=a+1\n}')).toBe('module M(a: bits<4>) -> (y: bits<4>) {\n  y = a + 1\n}\n');
  });

  it('puts one element per line, with a trailing comma, in lists that were multi-line or are too long', () => {
    expect(format('module M(\n  a: bit, b: bit) -> (y: bit) {\n  y = a\n}')).toBe('module M(\n  a: bit,\n  b: bit,\n) -> (y: bit) {\n  y = a\n}\n');
    const long = `module M(${Array.from({ length: 12 }, (_, i) => `input_${i}: bits<8>`).join(', ')}) -> (y: bit) {\n  y = 0\n}`;
    const f = format(long);
    expect(f.split('\n')[1]).toBe('  input_0: bits<8>,');
    expect(f).toContain('  input_11: bits<8>,\n) -> (y: bit) {');
  });

  it('removes a trailing comma from a list that fits on one line', () => {
    expect(format('module M() -> (y: bits<8>) {\n  y = concat(a, b,)\n}')).toContain('y = concat(a, b)');
  });

  it('writes `} else {` and breaks long if chains', () => {
    const src = 'module M(c: bit, d: bit) -> (y: bits<32>) {\n  y = if c { 0x1234_5678 } else if d { 0x2345_6789 } else if c && d { 0x3456_789a } else { 0x4567_89ab }\n}';
    expect(format(src)).toBe(
      'module M(c: bit, d: bit) -> (y: bits<32>) {\n  y = if c {\n    0x1234_5678\n  } else if d {\n    0x2345_6789\n  } else if c && d {\n    0x3456_789a\n  } else {\n    0x4567_89ab\n  }\n}\n',
    );
  });

  it('breaks long operator chains before the operator, which continues the statement', () => {
    const src = `module M(${'abcdefgh'.split('').map((c) => `${c}${c}${c}${c}${c}${c}${c}: bit`).join(', ')}) -> (y: bit) {\n  y = ${'abcdefgh'.split('').map((c) => c.repeat(7)).join(' && ')} && aaaaaaa && bbbbbbb && ccccccc && ddddddd\n}`;
    const f = format(src);
    const lines = f.split('\n').filter((l) => l.trim().startsWith('&&'));
    expect(lines.length).toBeGreaterThan(0);
    sameAst(src, f);
  });

  it('keeps comments: leading, trailing, between list elements, dangling and in blocks', () => {
    const src = `// header

/// Doc for S
struct S { a: bits<4>, /* inline */ b: bit }
enum E {
  A, // first
  B
}
const   X : bits<8> = 0x1f ;  const Y: int = 3
module M ( clk : clock , // the clock
  a : bits<8> ) -> ( y : bits<8>, z: bit ) {
  // leading
  reg r : bits<8> = 0 ; next r = a   // trailing


  let t : bits<8> = if a[0] { a } else { r }
  y = match a { 0 => 1, 1 | 2 => 3, _ => t }
    /* block
       comment */
  z = a == 0 && r == 1
  // dangling at end
}
`;
    const f = format(src);
    expect(f).toBe(`// header

/// Doc for S
struct S {
  a: bits<4>, /* inline */
  b: bit,
}

enum E {
  A, // first
  B,
}

const X: bits<8> = 0x1f
const Y: int = 3

module M(
  clk: clock, // the clock
  a: bits<8>,
) -> (y: bits<8>, z: bit) {
  // leading
  reg r: bits<8> = 0
  next r = a // trailing

  let t: bits<8> = if a[0] { a } else { r }
  y = match a { 0 => 1, 1 | 2 => 3, _ => t }
  /* block
     comment */
  z = a == 0 && r == 1
  // dangling at end
}
`);
    expect(format(f)).toBe(f);
    sameAst(src, f);
  });

  it('formats tests', () => {
    expect(format('test "t" {\n  let m = sim M(a: 1) ; step 2 ; expect m.y == 3\n  for i in 0..4 { m.a = i\n  step }\n}')).toBe(
      'test "t" {\n  let m = sim M(a: 1)\n  step 2\n  expect m.y == 3\n  for i in 0..4 {\n    m.a = i\n    step\n  }\n}\n',
    );
  });

  it('leaves a source with syntax errors unchanged', () => {
    const r = formatResult('module M( {');
    expect(r.output).toBe('module M( {');
    expect(r.diagnostics.length).toBeGreaterThan(0);
    expect(r.changed).toBe(false);
  });

  it('turns the RV32I planning sample into content/designs/rv32i.dcl', () => {
    const planning = readFileSync(new URL('./testdata/rv32i-planning.dcl', import.meta.url), 'utf8')
      .replace('top module RegFile', 'module RegFile')
      .replace('module riscv32', 'top module riscv32');
    const committed = designs.find((d) => d.name === 'rv32i.dcl')!.source;
    expect(format(planning)).toBe(committed);
  });
});

describe('formatter: idempotence and fidelity', () => {
  for (const { name, source } of [...designs, ...std]) {
    it(`${name} is already formatted`, () => {
      expect(parse(source).diagnostics).toEqual([]);
      expect(format(source)).toBe(source);
    });
  }

  for (const { name, source } of hdlBlocks) {
    it(`${name} formats idempotently to the same AST`, () => {
      const f = format(source);
      expect(format(f)).toBe(f);
      sameAst(source, f);
    });
  }

  it('is idempotent on generated programs and never changes their meaning', () => {
    let seed = 99;
    const rnd = (n: number) => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return (seed >>> 8) % n;
    };
    const names = ['a', 'b', 'c', 'long_signal_name', 'another_long_name'];
    const expr = (d: number): string => {
      const k = d > 3 ? 0 : rnd(7);
      if (k <= 1) return rnd(2) ? names[rnd(names.length)]! : String(rnd(100));
      if (k === 2) return `${expr(d + 1)} ${['+', '&', '|', '==', '&&', '<<', '^'][rnd(7)]} ${expr(d + 1)}`;
      if (k === 3) return `(${expr(d + 1)})`;
      if (k === 4) return `if ${expr(d + 1)} { ${expr(d + 1)} } else { ${expr(d + 1)} }`;
      if (k === 5) return `concat(${expr(d + 1)}, ${expr(d + 1)})`;
      return `match ${expr(d + 1)} { 0 => ${expr(d + 1)}, _ => ${expr(d + 1)} }`;
    };
    let skipped = 0;
    for (let k = 0; k < 80; k++) {
      const lines = Array.from({ length: 1 + rnd(6) }, (_, i) => `${rnd(3) ? '' : '// note\n'}  let v${i}: bits<8> = ${expr(0)}${rnd(2) ? ';' : ''}${rnd(4) ? '' : ' // why'}`);
      const src = `module M(a: bits<8>, b: bits<8>, c: bits<8>) -> (y: bit) {\n${lines.join('\n')}\n  y = 0\n}\n`;
      // Chained comparisons (`a == b == c`) are syntax errors: skip those programs.
      if (parse(src).diagnostics.length) {
        skipped++;
        continue;
      }
      const f = format(src);
      expect(format(f)).toBe(f);
      sameAst(src, f);
      expect(f.split('\n').every((l) => l.length <= 100 || !l.includes(' '))).toBe(true);
    }
    expect(skipped).toBeLessThan(40);
  });

  it('keeps designs valid: formatted designs check like the originals', () => {
    for (const { source } of designs) {
      const a = check(source).diagnostics.map((d) => d.code);
      const b = check(format(source)).diagnostics.map((d) => d.code);
      expect(b).toEqual(a);
    }
  });
});
