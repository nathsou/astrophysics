import { describe, expect, it } from 'vitest';
import { check, format, runTests } from '$lib/hdl';
import { SNIPPETS } from './snippets';

const errors = (source: string) => check(source, { file: 'snippet.dcl' }).diagnostics.filter((d) => d.severity === 'error');

describe('the playground programs of Chapter 17', () => {
  it('compile, except the latch, which the language refuses', () => {
    for (const [id, s] of Object.entries(SNIPPETS)) {
      if (id === 'latch') continue;
      expect(errors(s.code), id).toEqual([]);
    }
  });

  it('are in the standard format', () => {
    for (const [id, s] of Object.entries(SNIPPETS)) expect(format(s.code).trim(), id).toBe(s.code.trim());
  });

  it('the latch is a combinational loop, and the error says to use a register', () => {
    const e = errors(SNIPPETS.latch!.code);
    expect(e.length).toBeGreaterThan(0);
    expect(e[0]!.message).toMatch(/combinational loop/);
    expect(JSON.stringify(e)).toMatch(/reg/);
  });

  it('every test in every program passes', () => {
    for (const [id, s] of Object.entries(SNIPPETS)) {
      if (id === 'latch') continue;
      const r = runTests(s.code, { file: `${id}.dcl` });
      expect(r.results.length, id).toBeGreaterThan(0);
      expect(r.results.filter((t) => !t.passed).map((t) => t.name), id).toEqual([]);
    }
  });
});
