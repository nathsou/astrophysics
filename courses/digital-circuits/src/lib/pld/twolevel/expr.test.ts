import { describe, expect, test } from 'vitest';
import { coverToStrings, coverTruthTable } from './cube';
import {
  ExprError,
  STYLES,
  coverToText,
  evalExpr,
  exprToCover,
  exprVars,
  formatPla,
  formatTruthTable,
  functionFromEquations,
  parseEquations,
  parseExpr,
  parsePla,
  parseSop,
  parseTruthTable,
} from './expr';
import { equivalent } from './unate';

function tableOf(text: string, vars: string[]) {
  const e = parseExpr(text);
  const n = vars.length;
  return Array.from({ length: 2 ** n }, (_, m) => evalExpr(e, (name) => (m >>> (n - 1 - vars.indexOf(name))) & 1));
}

describe('expressions', () => {
  test('operators and precedence', () => {
    const vars = ['A', 'B', 'C'];
    expect(tableOf('A & !B | C', vars)).toEqual(tableOf('(A & (!B)) | C', vars));
    expect(tableOf('A * /B + C', vars)).toEqual(tableOf('A & !B | C', vars));
    expect(tableOf("A·B' + C", vars)).toEqual(tableOf('A & !B | C', vars));
    expect(tableOf('A ^ B & C', vars)).toEqual(tableOf('A ^ (B & C)', vars));
    expect(tableOf('A | B ^ C', vars)).toEqual(tableOf('A | (B ^ C)', vars));
    expect(tableOf('!!A', vars)).toEqual(tableOf('A', vars));
    expect(tableOf('1 & A | 0', vars)).toEqual(tableOf('A', vars));
    expect(exprVars(parseExpr('C & A | !B & A'))).toEqual(['C', 'A', 'B']);
  });

  test('errors carry an offset', () => {
    expect(() => parseExpr('A & ')).toThrow(ExprError);
    try {
      parseExpr('A & $');
    } catch (e) {
      expect((e as ExprError).offset).toBe(4);
    }
    expect(() => parseExpr('(A | B')).toThrow(/Expected '\)'/);
  });

  test('expressions to covers agree with evaluation', () => {
    const vars = ['A', 'B', 'C', 'D'];
    for (const text of ['A ^ B ^ C ^ D', '!(A & B | C & !D)', '(A | B) & (C | !D) & !(A ^ C)', '0', '1', 'A | !A']) {
      const cover = exprToCover(parseExpr(text), vars);
      const t = coverTruthTable(cover);
      expect([...t]).toEqual(tableOf(text, vars));
    }
  });

  test('printing', () => {
    const { vars, cover } = parseSop('A & !B | C');
    expect(coverToText(cover, vars)).toBe('A & !B | C');
    expect(coverToText(cover, vars, STYLES.galette)).toBe('A * /B + C');
    expect(coverToText(cover, vars, STYLES.prime)).toBe("AB' + C");
    expect(coverToText({ n: 2, cubes: [] }, ['A', 'B'])).toBe('0');
    expect(coverToText(parseSop('A | !A').cover, ['A'])).toBe('A | !A'); // printing does not minimise
    expect(coverToText(parseSop('1').cover, [])).toBe('1');
  });

  test('equations', () => {
    const eqs = parseEquations('Y = A & B // and\nZ = A | B; W = !A\n# comment');
    expect(eqs.map((e) => e.name)).toEqual(['Y', 'Z', 'W']);
    const f = functionFromEquations('S = A ^ B ^ Cin\nCout = A & B | Cin & (A ^ B)');
    expect(f.inputs).toEqual(['A', 'B', 'Cin']);
    expect(f.outputs).toEqual(['S', 'Cout']);
    expect(f.on[1]!.cubes.length).toBeGreaterThan(0);
  });
});

describe('truth tables', () => {
  test('parse with cubes and don’t cares', () => {
    const f = parseTruthTable(`
      A B C | Y Z
      0 0 - | 1 0
      1 1 1 | - 1
      0 1 0 | 0 1
    `);
    expect(f.inputs).toEqual(['A', 'B', 'C']);
    expect(f.outputs).toEqual(['Y', 'Z']);
    expect(coverToStrings(f.on[0]!)).toEqual(['00-']);
    expect(coverToStrings(f.dc[0]!)).toEqual(['111']);
    expect(coverToStrings(f.on[1]!)).toEqual(['111', '010']);
  });

  test('format', () => {
    const text = formatTruthTable(['A', 'B'], ['Y'], (m) => [m === 3 ? '1' : '0']);
    expect(text.split('\n')).toEqual(['A B | Y', '0 0 | 0', '0 1 | 0', '1 0 | 0', '1 1 | 1']);
    const back = parseTruthTable(text);
    expect(coverToStrings(back.on[0]!)).toEqual(['11']);
  });

  test('Berkeley PLA round trip', () => {
    const f = parsePla(`.i 3\n.o 2\n.ilb a b c\n.ob f g\n.p 3\n1-0 10\n011 -1\n11- 01\n.e\n`);
    expect(f.inputs).toEqual(['a', 'b', 'c']);
    expect(coverToStrings(f.on[0]!)).toEqual(['1-0']);
    expect(coverToStrings(f.dc[0]!)).toEqual(['011']);
    expect(coverToStrings(f.on[1]!)).toEqual(['011', '11-']);
    const g = parsePla(formatPla(f));
    for (let o = 0; o < 2; o++) {
      expect(equivalent(g.on[o]!, f.on[o]!)).toBe(true);
      expect(equivalent(g.dc[o]!, f.dc[o]!)).toBe(true);
    }
  });
});
