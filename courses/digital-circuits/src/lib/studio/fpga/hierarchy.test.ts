import { describe, expect, it } from 'vitest';
import { buildHierarchy, flattenTree } from './hierarchy';
import { flowOf } from './fixture.test-util';

const HIER = `
module Adder(a: bits<4>, b: bits<4>) -> (s: bits<4>) {
  s = a + b
}
module Acc(clk: clock, x: bits<4>) -> (total: bits<4>) {
  reg r: bits<4> = 0
  inst add: Adder(a: r, b: x)
  next r = add.s
  total = r
}
`;

describe('hierarchy', () => {
  it('builds modules → cells for a hierarchical design', () => {
    const { index, result } = flowOf('hier', 'Acc', 'S', HIER);
    const roots = buildHierarchy(index);
    expect(roots).toHaveLength(1);
    const top = roots[0]!;
    expect(top.children.map((c) => c.name)).toEqual(['add']);
    expect(top.total).toBe(result.cells.length);
    expect(top.children[0]!.total).toBeGreaterThan(0);
    expect(top.own + 0).toBeGreaterThan(0);
    // Every RTL cell of a module is listed with its line.
    expect(top.cells.some((c) => c.kind === 'reg')).toBe(true);
    expect(top.children[0]!.cells.some((c) => c.kind === 'add' && c.line === 3)).toBe(true);
    expect(flattenTree(roots, new Set()).map((n) => n.path)).toEqual([top.path]);
    expect(flattenTree(roots, new Set([top.path])).map((n) => n.name)).toEqual([top.name, 'add']);
  });

  it('gives a flat design one node holding all its cells', () => {
    const { index, result } = flowOf('counter', 'Counter', 'S');
    const [top] = buildHierarchy(index);
    expect(top!.path).toBe('Counter');
    expect(top!.total).toBe(result.cells.length);
    expect(top!.cells.length).toBeGreaterThan(3);
    expect(top!.cells[0]!.cells).toBeGreaterThanOrEqual(top!.cells.at(-1)!.cells);
  });
});
