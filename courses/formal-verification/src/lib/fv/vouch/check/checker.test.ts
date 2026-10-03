import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from '../syntax/parser';
import { check } from './checker';
import { showTy } from './types';

const examplesDir = path.resolve(import.meta.dirname, '../examples');

function checkSrc(src: string) {
  const p = parse(src);
  const c = check(p.program);
  return { ...c, all: [...p.diagnostics, ...c.diagnostics] };
}
const errors = (src: string) => checkSrc(src).all.filter((d) => d.severity === 'error');

describe('the canonical examples type-check', () => {
  for (const f of readdirSync(examplesDir).filter((x) => x.endsWith('.vouch'))) {
    it(f, () => {
      const errs = errors(readFileSync(path.join(examplesDir, f), 'utf8'));
      expect(errs.map((d) => `${d.code}: ${d.message}`)).toEqual([]);
    });
  }
});

describe('types', () => {
  it('gives machine arithmetic its machine type in code, and mathematical type in specifications', () => {
    const c = checkSrc(`fn f(a: i32, b: i32) -> (r: i32)
  ensures r == a + b
{
  r = a + b
}`);
    expect(c.all.filter((d) => d.severity === 'error')).toEqual([]);
    const body = c.program.decls[0]!;
    const types = [...c.types.entries()].filter(([e]) => e.k === 'binary').map(([e, t]) => [e.span.start >= (body as { body: { span: { start: number } } }).body.span.start ? 'code' : 'spec', showTy(t)]);
    expect(types).toContainEqual(['code', 'i32']);
    expect(types).toContainEqual(['spec', 'int']);
  });
  it('requires an explicit conversion from int to a machine integer', () => {
    expect(errors('fn f(x: int) -> i32 { return x }')[0]?.code).toBe('type/mismatch');
    expect(errors('fn f(x: int) -> i32 { return x as i32 }')).toEqual([]);
    expect(errors('fn f() -> i8 { return 300 }')[0]?.code).toBe('type/literal-range');
  });
  it('reports unknown names with suggestions', () => {
    const e = errors('fn f(count: int) -> int { return cont + 1 }');
    expect(e[0]?.message).toMatch(/Did you mean “count”/);
  });
  it('rejects assignment to parameters and let-bound names', () => {
    expect(errors('fn f(x: int) { x = 1 }')[0]?.code).toBe('stmt/immutable');
    expect(errors('fn f() { let y = 1\n y = 2 }')[0]?.message).toMatch(/var y/);
  });
  it('only allows executable calls as whole statements', () => {
    expect(errors('fn g() -> int { return 1 }\nfn f() -> int { return g() + 1 }')[0]?.code).toBe('call/exec-nested');
    expect(errors('fn g() -> int { return 1 }\nfn f() -> int { let x = g()\n return x + 1 }')).toEqual([]);
    expect(errors('fn g() -> int { return 1 }\npred p() { g() == 1 }')[0]?.code).toBe('call/exec-in-spec');
  });
  it('checks process labels in `at`', () => {
    const e = errors(`system S {
  process P(me: 0..2) { loop { a: skip
 b: skip } }
  invariant x: !(P(0) at c)
}`);
    expect(e[0]?.code).toBe('system/label');
  });
  it('requires finite action parameters unless the guard draws them from a set', () => {
    expect(errors('system S {\n var x: int = 0\n action a(n: int) { x = n }\n}')[0]?.code).toBe('system/action-param');
    expect(errors('system S {\n var s: set<int> = {}\n var x: int = 0\n action a(n: int) when n in s { x = n }\n}')).toEqual([]);
  });
  it('reports non-exhaustive matches', () => {
    expect(errors('enum C { r, g, b }\npure fn f(c: C) -> int { match c { r => 1, g => 2 } }')[0]?.code).toBe('type/non-exhaustive');
  });
  it('records definitions and uses for the language server', () => {
    const c = checkSrc('fn f(x: int) -> int { let y = x + 1\n return y * x }');
    const x = c.symbols.find((s) => s.name === 'x')!;
    expect(c.uses.get(x.id)!.length).toBe(2);
  });
});
