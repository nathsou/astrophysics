import { describe, expect, test } from 'vitest';
import { OCTET_PROGRAMS } from '$lib/sim/cpu/octet';
import { PASSES_SOURCE, twoPass } from './passes';

describe('the two passes', () => {
  const t = twoPass(PASSES_SOURCE);
  test('the program assembles and the symbol table is what pass 1 builds', () => {
    expect(t.ok).toBe(true);
    expect(t.symbols).toEqual([
      { name: 'loop', address: 4, line: 4 },
      { name: 'pause', address: 0x0c, line: 9 },
      { name: 'wait', address: 0x0e, line: 10 },
    ]);
  });
  test('only the CALL has a hole after pass 1: it names a label defined further down', () => {
    const holes = t.rows.filter((r) => r.holes.length);
    expect(holes.map((r) => [r.line, r.refs])).toEqual([[5, [{ name: 'pause', address: 0x0c }]]]);
    expect(holes[0]!.bytes).toEqual([0x72, 0x0c]);
  });
  test('addresses are those of the listing, and a label-only line takes the next address', () => {
    expect(t.rows.map((r) => r.address)).toEqual([undefined, 0, 2, 4, 6, 8, 9, 0x0b, 0x0c, 0x0e, 0x0f, 0x11, undefined]);
    expect(t.rows[3]!.labels).toEqual(['loop']);
    expect(t.rows[3]!.address).toBe(4);
  });
  test('forward references in the course programs are found (multiply skips ahead, blink calls delay)', () => {
    const forward = (id: string) => twoPass(OCTET_PROGRAMS.find((p) => p.id === id)!.source).rows.flatMap((r) => r.refs.map((x) => x.name));
    expect(forward('multiply')).toEqual(expect.arrayContaining(['x', 'y', 'skip', 'nocarry', 'more']));
    expect(forward('blink')).toEqual(['delay']);
    expect(forward('hello')).toEqual(expect.arrayContaining(['message', 'done']));
  });
});
