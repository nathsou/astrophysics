import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from '../vouch/syntax/parser';
import { check } from '../vouch/check/checker';
import { solveProblem } from './encode';

const run = (src: string, name: string, limit = 1000) => {
  const c = check(parse(src).program);
  const errs = c.diagnostics.filter((d) => d.severity === 'error');
  if (errs.length) throw new Error(errs.map((e) => e.message).join('\n'));
  return solveProblem(c, name, { limit });
};

describe('problem encoder', () => {
  it('solves the 4×4 Sudoku with exactly one solution', () => {
    const r = run(readFileSync(new URL('../vouch/examples/sudoku.vouch', import.meta.url), 'utf8'), 'Sudoku4');
    expect(r.count).toBe(1);
    expect(r.solutions[0]!.checked).toBe(true);
  });
  it('counts solutions exactly', () => {
    // Three distinct digits from 1..=3: 3! = 6.
    const r = run(`problem P {
  var a: 1..=3
  var b: 1..=3
  var c: 1..=3
  constraint distinct: a != b && b != c && a != c
  count
}`, 'P');
    expect(r.count).toBe(6);
    expect(r.solutions.every((s) => s.checked)).toBe(true);
  });
  it('arithmetic and cardinality', () => {
    const r = run(`problem Q {
  var x: 0..10
  var y: 0..10
  constraint sum: x + y == 10 && x * 2 > y
  count
}`, 'Q');
    // x + y = 10 with x, y in 0..9 and 2x > y: x from 4 to 9 → 6 solutions.
    expect(r.count).toBe(6);
    const q = run(`problem Queens {
  type Col = 0..4
  var row: Col -> 0..4
  constraint distinct_rows: forall i: Col, j: Col :: i != j ==> row[i] != row[j]
  constraint diagonals: forall i: Col, j: Col :: i < j ==> row[i] - row[j] != j - i && row[j] - row[i] != j - i
  count
}`, 'Queens');
    expect(q.count).toBe(2);
    const card = run(`problem Card {
  type Item = 0..5
  var pick: Item -> bool
  constraint two: #{ i: Item | pick[i] } == 2
  count
}`, 'Card');
    expect(card.count).toBe(10);
  });
});
