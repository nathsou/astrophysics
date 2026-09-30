import { describe, expect, it } from 'vitest';
import { check, format, runTests } from '$lib/hdl';
import { SNIPPETS } from './widgets/snippets';

const failing = (source: string) => runTests(source, { file: 'snippet.dcl' }).results.filter((r) => !r.passed && !r.skipped).map((r) => r.name);

describe('the playground programs', () => {
  it('all compile', () => {
    for (const [id, s] of Object.entries(SNIPPETS)) {
      for (const code of [s.code, s.solution].filter(Boolean) as string[]) {
        const errors = check(code, { file: `${id}.dcl` }).diagnostics.filter((d) => d.severity === 'error');
        expect(errors, id).toEqual([]);
      }
    }
  });

  it('are in the standard format', () => {
    for (const [id, s] of Object.entries(SNIPPETS)) {
      for (const code of [s.code, s.solution].filter(Boolean) as string[]) expect(format(code).trim(), id).toBe(code.trim());
    }
  });

  it('the swap swaps', () => {
    expect(failing(SNIPPETS.swap!.code)).toEqual([]);
  });

  it('the decade counter starts with two bugs, and the solution fixes both', () => {
    const s = SNIPPETS['fix-the-test']!;
    // The off-by-one breaks the wrap, and the carry that ignores `enable` breaks the second test.
    expect(failing(s.code)).toEqual(['counts to nine and wraps to zero', 'holds, and does not carry, while disabled']);
    const half = s.code.replace('value == 10', 'value == 9');
    expect(failing(half)).toEqual(['holds, and does not carry, while disabled']);
    expect(failing(s.solution!)).toEqual([]);
  });

  it('the tick generator starts failing, and its solution passes', () => {
    const s = SNIPPETS['tick-gen']!;
    expect(failing(s.code).length).toBeGreaterThan(0);
    expect(failing(s.solution!)).toEqual([]);
  });
});
