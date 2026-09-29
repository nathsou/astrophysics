import { describe, expect, it } from 'vitest';
import { definitionLines, isTruthTable, lintEquations, locateError, matchesPattern, parsePragmas } from './source';

describe('pragmas', () => {
  it('reads the comment directives', () => {
    const p = parsePragmas(`# @title My design
# @pins A=2 Y=19
# @polarity Y=low Z=auto
# @buried C1 C2
# @clock CK
# @ff Q0=T
# @init Q0=1
# @dc S* : D & (C | B)
# @inputs A B
Y = A`);
    expect(p.title).toBe('My design');
    expect(p.pins).toEqual({ A: 2, Y: 19 });
    expect(p.polarity).toEqual({ Y: 'low', Z: 'auto' });
    expect(p.buried).toEqual(['C1', 'C2']);
    expect(p.clock).toBe('CK');
    expect(p.ff).toEqual({ Q0: 'T' });
    expect(p.init).toEqual({ Q0: 1 });
    expect(p.dc).toEqual([{ patterns: ['S*'], expr: 'D & (C | B)' }]);
    expect(p.inputs).toEqual(['A', 'B']);
    expect(parsePragmas('# @polarity auto').polarityAll).toBe('auto');
  });
  it('matches patterns', () => {
    expect(matchesPattern('Sa', 'S*')).toBe(true);
    expect(matchesPattern('Q0', 'S*')).toBe(false);
    expect(matchesPattern('Q0', '*')).toBe(true);
    expect(matchesPattern('Q0', 'Q0')).toBe(true);
  });
});

describe('source structure', () => {
  it('finds definition lines', () => {
    const src = '# title\nA = B\n\nQ.R = A ; note\nQ.E = C';
    expect(definitionLines(src)).toEqual({ A: 2, Q: 4 });
  });
  it('finds truth-table headers', () => {
    const src = '# c\nA B | Y Z\n0 0 | 1 0';
    expect(isTruthTable(src)).toBe(true);
    expect(definitionLines(src)).toEqual({ Y: 2, Z: 2 });
    expect(isTruthTable('Y = A | B')).toBe(false);
  });
  it('lints syntax errors with lines', () => {
    const errs = lintEquations('A = B\nC = (D &\nnot an equation\n// fine\n');
    expect(errs.map((e) => e.line)).toEqual([2, 3]);
  });
  it('locates fitter messages', () => {
    const src = 'A = B\nY = C & D';
    expect(locateError(src, 'Line 2: expected "name = expression"').line).toBe(2);
    expect(locateError(src, 'Equation for Y: unknown signal "Q"').line).toBe(2);
    expect(locateError(src, 'Output A needs 9 product terms').line).toBe(1);
    expect(locateError(src, 'something unrelated').line).toBe(0);
  });
});
