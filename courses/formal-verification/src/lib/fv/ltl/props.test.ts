import { describe, expect, it } from 'vitest';
import { parseProp } from './props';
import { evalAll, evalLasso } from './ltl';

const holds = (f: string, states: string[][], loop: number) => {
  const p = parseProp(f);
  if ('error' in p) throw new Error(p.error);
  return evalLasso(p.ltl, states.length, loop, (i, a) => states[i]!.includes(p.props[a]!));
};

describe('LTL over propositions', () => {
  it('evaluates on lassos', () => {
    // p, then q forever
    expect(holds('eventually q', [['p'], ['q']], 1)).toBe(true);
    expect(holds('always p', [['p'], ['q']], 1)).toBe(false);
    expect(holds('p until q', [['p'], ['q']], 1)).toBe(true);
    expect(holds('eventually always q', [['p'], ['q']], 1)).toBe(true);
    // p and q alternate forever
    expect(holds('always eventually q', [['p'], ['q']], 0)).toBe(true);
    expect(holds('eventually always q', [['p'], ['q']], 0)).toBe(false);
    expect(holds('req ~> grant', [['req'], [], ['grant']], 0)).toBe(true);
    expect(holds('req ~> grant', [['grant'], ['req'], []], 1)).toBe(false);
    expect(holds('next p', [[], ['p']], 1)).toBe(true);
  });
  it('per-position values', () => {
    const p = parseProp('eventually q');
    if ('error' in p) throw new Error(p.error);
    expect(evalAll(p.ltl, 3, 2, (i, a) => [[], ['q'], []][i]!.includes(p.props[a]!))).toEqual([true, true, false]);
  });
  it('reports unknown propositions', () => {
    expect('error' in parseProp('always x', ['p'])).toBe(true);
  });
});
