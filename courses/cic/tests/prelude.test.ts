import { describe, expect, it } from 'vitest';
import { coreSrc, run } from './util.ts';
import { pp } from '../src/kernel/core/pretty.ts';

describe('prelude', () => {
  it('checks without errors', () => {
    const r = run(coreSrc, 'cic', false);
    if (r.errors.length) console.log(r.errors.join('\n'));
    expect(r.errors.length).toBe(0);
    for (const n of ['Nat.add', 'Eq.symm', 'List.append', 'Nat.rec', 'Eq.rec', 'And.left', 'Quot.lift', 'Prod', 'Eq.refl', 'List.rec']) {
      const d = r.env.get(n);
      expect(d, n).toBeDefined();
      console.log(n, ':', pp(r.env, d!.type));
    }
  });
});
