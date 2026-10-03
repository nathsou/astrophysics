import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { lex } from './lexer';
import { parse, parseExpr } from './parser';
import { printExpr, printProgram } from './printer';
import type * as A from './ast';

const examplesDir = path.resolve(import.meta.dirname, '../examples');
const examples = readdirSync(examplesDir).filter((f) => f.endsWith('.vouch'));

/** Strip spans so trees can be compared structurally. */
function strip(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(strip);
  if (x && typeof x === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x)) if (!['span', 'nameSpan', 'calleeSpan', 'labelSpan', 'vSpan', 'doc'].includes(k)) out[k] = strip(v);
    return out;
  }
  return x;
}

describe('lexer', () => {
  it('reads Unicode and ASCII operators as the same tokens', () => {
    const a = lex('∀ i :: 0 ≤ i ⟹ a[i] ≠ 0').map((t) => t.value);
    const b = lex('forall i :: 0 <= i ==> a[i] != 0').map((t) => t.value);
    expect(a).toEqual(b);
  });
  it('ends statements at newlines, but not after an operator or inside brackets', () => {
    const kinds = (s: string) => lex(s).map((t) => (t.kind === 'newline' ? '⏎' : t.value)).join(' ');
    expect(kinds('x = 1\ny = 2')).toBe('x = 1 ⏎ y = 2 ⏎ ');
    expect(kinds('x = 1 +\n 2')).toBe('x = 1 + 2 ⏎ ');
    expect(kinds('f(1,\n 2)')).toBe('f ( 1 , 2 ) ⏎ ');
    expect(kinds('a\n  && b')).toBe('a && b ⏎ ');
  });
  it('reads numbers in decimal, hex and binary with separators', () => {
    const ints = lex('1_000 0xff 0b1010').filter((t) => t.kind === 'int').map((t) => t.int);
    expect(ints).toEqual([1000n, 255n, 10n]);
  });
  it('does not split identifiers that start with "in" after "!"', () => {
    expect(lex('!inside').map((t) => t.value).slice(0, 2)).toEqual(['!', 'inside']);
  });
});

describe('expressions', () => {
  const p = (s: string) => {
    const r = parseExpr(s);
    expect(r.diagnostics).toEqual([]);
    return printExpr(r.expr!);
  };
  it('respects precedence and associativity', () => {
    expect(p('a ==> b ==> c')).toBe('a ==> b ==> c');
    expect(p('(a ==> b) ==> c')).toBe('(a ==> b) ==> c');
    expect(p('a && b || c && d')).toBe('a && b || c && d');
    expect(p('a && (b || c)')).toBe('a && (b || c)');
    expect(p('1 + 2 * 3 - 4')).toBe('1 + 2 * 3 - 4');
    expect(p('(1 + 2) * 3')).toBe('(1 + 2) * 3');
    expect(p('-x * y')).toBe('-x * y');
  });
  it('parses chained comparisons', () => {
    const r = parseExpr('0 <= i < j <= n');
    expect(r.expr?.k).toBe('chain');
    expect(p('0 <= i < j <= n')).toBe('0 <= i < j <= n');
  });
  it('parses quantifiers with binders, ranges and triggers', () => {
    expect(p('forall i, j :: 0 <= i < j < len(a) ==> a[i] <= a[j]')).toBe('forall i, j :: 0 <= i < j < len(a) ==> a[i] <= a[j]');
    expect(p('exists k in 0..n :: a[k] == x')).toBe('exists k in 0..n :: a[k] == x');
    expect(p('forall x: int {f(x)} :: f(x) > 0')).toBe('forall x: int {f(x)} :: f(x) > 0');
  });
  it('parses slices, updates, fields, casts, old and process locations', () => {
    expect(p('a[..i] ++ a[i := v][j..]')).toBe('a[..i] ++ a[i := v][j..]');
    expect(p('old(q.size) + 1 as i32')).toBe('old(q.size) + 1 as i32');
    expect(p('P(0) at critical && P(1) at critical')).toBe('P(0) at critical && P(1) at critical');
  });
  it('parses temporal and separation-logic operators', () => {
    expect(p('always (p ==> eventually q)')).toBe('always (p ==> eventually q)');
    expect(p('x.next |-> y ** list(y, xs)')).toBe('x.next |-> y ** list(y, xs)');
    expect(p('a ~> b')).toBe('a ~> b');
  });
  it('parses comprehensions and literals', () => {
    expect(p('[q.buf[k] | k in 0..n]')).toBe('[q.buf[k] | k in 0..n]');
    expect(p('{ d: Dir | f in d.contents }')).toBe('{ d: Dir | f in d.contents }');
    expect(p('Msg { kind: msg1, to: B }')).toBe('Msg { kind: msg1, to: B }');
    expect(p('{1, 2} + {3}')).toBe('{1, 2} + {3}');
  });
  it('reports a helpful error for a missing operand', () => {
    const r = parseExpr('a &&');
    expect(r.diagnostics[0]?.message).toMatch(/Expected an expression/);
  });
});

describe('the canonical examples', () => {
  for (const f of examples) {
    it(`${f} parses without errors and round-trips through the printer`, () => {
      const src = readFileSync(path.join(examplesDir, f), 'utf8');
      const r = parse(src);
      expect(r.diagnostics, JSON.stringify(r.diagnostics)).toEqual([]);
      const printed = printProgram(r.program);
      const again = parse(printed);
      expect(again.diagnostics, printed).toEqual([]);
      expect(strip(again.program.decls)).toEqual(strip(r.program.decls));
      expect(printProgram(again.program)).toBe(printed);
    });
  }
});

describe('error recovery', () => {
  it('keeps parsing after a broken statement and a broken declaration', () => {
    const r = parse(`fn f(x: int) -> int {
  let y = x +
  return y
}

fn g( {
}

fn h() -> int { return 1 }
`);
    expect(r.diagnostics.length).toBeGreaterThan(0);
    const names = r.program.decls.map((d) => (d as A.FnDecl).name);
    expect(names).toContain('f');
    expect(names).toContain('h');
  });
});
