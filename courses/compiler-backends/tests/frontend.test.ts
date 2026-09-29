// The pre-SSA stages shown by the playground: tokens, AST, three-address code
// and the alloca/load/store IR that mem2reg turns into SSA.

import { describe, expect, it } from 'vitest';
import { compile } from '../src/compiler/pipeline';
import { EXAMPLES, exampleById } from '../src/examples';
import { lex } from '../src/compiler/frontend/parser';
import { astText, astTree, tacText, tokenLines, type AstNode } from '../src/compiler/frontend/views';
import { lineText } from '../src/compiler/listing';
import { verifyModule } from '../src/compiler/ir/verify';
import { moduleText } from '../src/compiler/ir/print';
import { runModule } from '../src/compiler/ir/interp';

const SMALL = `fn main() {
  let c = 0;
  while c < 3 {
    c += 1;
  }
  print(-c * 2);
  return 0;
}
`;

describe('tokens', () => {
  it('one listing line per non-blank source line, plus a legend', () => {
    const r = compile(SMALL);
    expect(r.tokens?.length).toBe(lex(SMALL).length);
    const lines = tokenLines(r.tokens!);
    expect(lines.length).toBe(1 + SMALL.trim().split('\n').length);
    expect(lineText(lines[0])).toContain(`${r.tokens!.length - 1} tokens`);
    expect(lines[4].toks.filter((t) => t.info).map((t) => t.t)).toEqual(['c', '+=', '1', ';']);
    expect(lines[4].links).toEqual(['src:4']);
  });
});

describe('AST', () => {
  it('prints the tree for a sample program', () => {
    const r = compile(SMALL);
    expect(astText(r.ast!)).toBe(`Program
  Fn main()
    body:
      Let c
        init: Num 0
      While
        cond: Binary <
          lhs: Var c
          rhs: Num 3
        body:
          Assign
            target: Var c
            value: Binary +
              lhs: Var c
              rhs: Num 1
      ExprStmt
        Call print
          arg0: Binary *
            lhs: Unary -
              Var c
            rhs: Num 2
      Return
        Num 0`);
  });

  it('records source spans (start of the leftmost operand to the end of the last token)', () => {
    const r = compile(exampleById('collatz').src);
    const find = (n: AstNode, label: string): AstNode | undefined =>
      n.label.map((t) => t.t).join('') === label ? n : n.children.map((c) => find(c, label)).find(Boolean);
    const mod = find(astTree(r.ast!), 'Binary %')!;
    expect(mod.span).toEqual({ from: { line: 4, col: 8 }, to: { line: 4, col: 13 } });
    const loop = find(astTree(r.ast!), 'While')!;
    expect(loop.span?.from).toEqual({ line: 3, col: 3 });
    expect(loop.span?.to).toEqual({ line: 10, col: 4 });
    const fn = find(astTree(r.ast!), 'Fn steps(n)')!;
    expect(fn.span).toEqual({ from: { line: 1, col: 1 }, to: { line: 12, col: 2 } });
  });
});

describe('three-address code', () => {
  it('reads the lowered CFG with named variables and no φ', () => {
    const r = compile(exampleById('collatz').src);
    const t = tacText(r.lowered!);
    expect(t).toContain('var n, c');
    expect(t).toContain('if n != 1 goto while.body else goto while.end');
    expect(t).toContain('n = n / 2');
    expect(t).toContain('c = c + 1');
    expect(t).toContain('s = @steps(n)');
    expect(t).not.toMatch(/\bphi\b|\balloca\b|\bload\b|\bstore\b/);
  });

  it('turns short-circuit φs into an assignment on each path', () => {
    const r = compile('fn main() { let a = 3; let b = a > 1 && a < 5; print(b); return 0; }');
    expect(moduleText(r.lowered!)).toMatch(/\bphi\b/);
    const t = tacText(r.lowered!);
    expect(t).not.toMatch(/\bphi\b/);
    expect(t).toMatch(/bool\.true:\n\s+(%\d+) = 1\n\s+goto bool\.end\nbool\.false:\n\s+\1 = 0/);
  });

  it('keeps memory accesses to arrays and globals explicit', () => {
    const t = tacText(compile(exampleById('sieve').src).lowered!);
    expect(t).toMatch(/= &@composite/);
    expect(t).toMatch(/mem\[%\d+\] = 1/);
  });

  for (const ex of EXAMPLES) {
    it(`${ex.id}: every scalar slot becomes a variable`, () => {
      const r = compile(ex.src);
      expect(r.error).toBeUndefined();
      const t = tacText(r.lowered!);
      expect(t).not.toMatch(/\bphi\b/);
      // arrays stay in memory (alloca of n*8 bytes); no 8-byte scalar slot survives
      expect(t).not.toMatch(/= alloca 8$/m);
      expect(t).not.toMatch(/\b(load|store)\b/);
    });
  }
});

describe('pre-SSA IR → SSA', () => {
  it('the pre-SSA IR keeps variables in stack slots, with no φ', () => {
    const r = compile(exampleById('collatz').src, { opt: 2 });
    const ir = moduleText(r.lowered!);
    expect(ir).toMatch(/%n\.addr\d+ = alloca 8/);
    expect(ir).toMatch(/= load %c\.addr\d+/);
    expect(ir).toMatch(/store %\d+, %n\.addr\d+/);
    expect(ir).not.toMatch(/\bphi\b/);
    expect(() => verifyModule(r.lowered!, false)).not.toThrow();
  });

  it('the SSA stage after it verifies, has φs, and computes the same result', () => {
    const r = compile(exampleById('collatz').src, { opt: 2 });
    expect(() => verifyModule(r.ssa!)).not.toThrow();
    const ssa = moduleText(r.ssa!);
    expect(ssa).toMatch(/\bphi\b/);
    expect(ssa).not.toMatch(/%[nc]\.addr/);
    expect(runModule(r.ssa!).output).toBe(runModule(r.lowered!).output);
  });
});
