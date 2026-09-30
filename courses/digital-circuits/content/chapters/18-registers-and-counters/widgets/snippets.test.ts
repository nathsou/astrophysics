import { describe, expect, it } from 'vitest';
import { check, format, runTests } from '$lib/hdl';
import { SNIPPETS } from './snippets';

const errors = (source: string) => check(source, { file: 'snippet.dcl' }).diagnostics.filter((d) => d.severity === 'error');

describe('the playground programs of Chapter 18', () => {
  it('compile, except the ripple counter, which the language refuses', () => {
    for (const [id, s] of Object.entries(SNIPPETS)) {
      if (id === 'ripple') continue;
      expect(errors(s.code), id).toEqual([]);
    }
  });

  it('are in the standard format', () => {
    for (const [id, s] of Object.entries(SNIPPETS)) expect(format(s.code).trim(), id).toBe(s.code.trim());
  });

  it('a register clocked by another register is an error: a clock can only come from a port', () => {
    const e = errors(SNIPPETS.ripple!.code);
    expect(e.length).toBeGreaterThan(0);
    expect(e[0]!.message).toMatch(/clock/i);
  });

  it('every test in every program passes', () => {
    for (const [id, s] of Object.entries(SNIPPETS)) {
      if (id === 'ripple') continue;
      const r = runTests(s.code, { file: `${id}.dcl` });
      expect(r.diagnostics.filter((d) => d.severity === 'error'), id).toEqual([]);
      expect(r.results.filter((t) => !t.passed).map((t) => t.name), id).toEqual([]);
    }
  });
});
