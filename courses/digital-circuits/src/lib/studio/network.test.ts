import { describe, expect, it } from 'vitest';
import { outputEquation, reachableTerms, termText, usedSignals } from './network';
import { makeResolver } from './probe';
import type { Network } from './types';

const net: Network = {
  inputs: ['A', 'B', 'C'],
  clock: 'CLK',
  terms: [
    { id: 't0', kind: 'product', lits: [{ signal: 'A', neg: false }, { signal: 'B', neg: true }] },
    { id: 't1', kind: 'product', lits: [{ signal: 'Q', neg: true }] },
    { id: 't2', kind: 'true', lits: [] },
    { id: 'orphan', kind: 'product', lits: [{ signal: 'C', neg: false }] },
  ],
  outputs: [
    { name: 'Y', terms: ['t0', 't2'], ff: 'comb', invert: 'none' },
    { name: 'Q', terms: ['t1'], ff: 'D', invert: 'before' },
  ],
};

describe('network helpers', () => {
  it('prints terms and equations', () => {
    expect(termText(net.terms[0]!)).toBe('A & !B');
    expect(termText(net.terms[2]!)).toBe('1');
    expect(outputEquation(net, net.outputs[0]!)).toBe('Y = A & !B | 1');
    expect(outputEquation(net, net.outputs[1]!)).toBe('Q.R = !!Q');
  });
  it('orders signals: inputs, then feedbacks', () => {
    expect(usedSignals({ ...net, terms: reachableTerms(net) })).toEqual(['A', 'B', 'Q']);
  });
  it('drops terms no output uses', () => {
    expect(reachableTerms(net).map((t) => t.id)).toEqual(['t0', 't1', 't2']);
  });
});

describe('the probe resolver', () => {
  const resolve = makeResolver({
    outputs: ['Y', 'Z'],
    outputLine: { Y: 3, Z: 4 },
    terms: [
      { id: 'a', outputs: ['Y', 'Z'], bits: [1, 2], bitsVia: (o) => (o === 'Y' ? [1] : [2]), signals: ['A'] },
      { id: 'b', outputs: ['Z'], bits: [3], signals: ['B'] },
    ],
    outputBits: { Y: [10], Z: [11] },
    bitOwner: (i) => (i === 10 ? { output: 'Y' } : i <= 3 ? { term: i === 3 ? 'b' : 'a' } : undefined),
  });
  it('expands an output to its terms, bits and line', () => {
    const p = resolve({ kind: 'output', name: 'Y' });
    expect([...p.terms]).toEqual(['a']);
    expect([...p.bits].sort((x, y) => x - y)).toEqual([1, 10]);
    expect([...p.lines]).toEqual([3]);
  });
  it('expands a shared term to every output it feeds', () => {
    const p = resolve({ kind: 'term', id: 'a' });
    expect([...p.outputs].sort()).toEqual(['Y', 'Z']);
    expect([...p.lines].sort()).toEqual([3, 4]);
    expect([...p.bits].sort((x, y) => x - y)).toEqual([1, 2, 10, 11]);
  });
  it('resolves bits, lines and input signals', () => {
    expect([...resolve({ kind: 'bit', index: 3 }).terms]).toEqual(['b']);
    expect([...resolve({ kind: 'line', line: 4 }).outputs]).toEqual(['Z']);
    expect([...resolve({ kind: 'signal', name: 'A' }).terms]).toEqual(['a']);
    expect(resolve({ kind: 'output', name: 'nope' }).outputs.size).toBe(0);
  });
});
