import { describe, expect, it } from 'vitest';
import { tokenize } from './highlight';

function kinds(src: string): string[] {
  return tokenize(src).map((t) => `${src.slice(t.from, t.to)}:${t.kind}`);
}

describe('tokenize (highlighting)', () => {
  it('classifies every token of a module', () => {
    const src = '/// Doc\ntop module Counter<N: int>(clk: clock, a: bits<N>) -> (y: bits<4>) {\n  inst f: Fifo<8, 4>(clk: clk)\n  y = concat(a, 0x1) >> 2 // c\n}';
    expect(kinds(src)).toEqual([
      '/// Doc:doc', 'top:keyword', 'module:keyword', 'Counter:module', '<:punctuation', 'N:identifier', '::punctuation',
      'int:type', '>:punctuation', '(:punctuation', 'clk:identifier', '::punctuation', 'clock:type', ',:punctuation',
      'a:identifier', '::punctuation', 'bits:type', '<:punctuation', 'N:identifier', '>:punctuation', '):punctuation',
      '->:operator', '(:punctuation', 'y:identifier', '::punctuation', 'bits:type', '<:punctuation', '4:number',
      '>:punctuation', '):punctuation', '{:punctuation', 'inst:keyword', 'f:identifier', '::punctuation', 'Fifo:module',
      '<:punctuation', '8:number', ',:punctuation', '4:number', '>:punctuation', '(:punctuation', 'clk:identifier',
      '::punctuation', 'clk:identifier', '):punctuation', 'y:identifier', '=:operator', 'concat:function', '(:punctuation',
      'a:identifier', ',:punctuation', '0x1:number', '):punctuation', '>>:operator', '2:number', '// c:comment', '}:punctuation',
    ]);
  });

  it('tells comparisons from generic brackets, and types from constants', () => {
    expect(kinds('y = a < b && WIDTH > 3')).toEqual([
      'y:identifier', '=:operator', 'a:identifier', '<:operator', 'b:identifier', '&&:operator', 'WIDTH:identifier',
      '>:operator', '3:number',
    ]);
    expect(kinds('reg s: Light = Light.Red')).toEqual([
      'reg:keyword', 's:identifier', '::punctuation', 'Light:type', '=:operator', 'Light:type', '.:punctuation', 'Red:type',
    ]);
    expect(kinds('let c = sim Counter(a: 1)').slice(3, 5)).toEqual(['sim:keyword', 'Counter:module']);
    expect(kinds('test "t" {}')).toEqual(['test:keyword', '"t":string', '{:punctuation', '}:punctuation']);
  });

  it('never fails, and covers the text in order without overlaps', () => {
    const src = 'module M( $ "open\n/* never';
    const toks = tokenize(src);
    for (let i = 1; i < toks.length; i++) expect(toks[i]!.from).toBeGreaterThanOrEqual(toks[i - 1]!.to);
    expect(toks.at(-1)).toEqual({ from: 18, to: 26, kind: 'comment' });
  });
});
