/**
 * Every ```dcl block of the chapter is real DCL: it type-checks, it is in the standard format, and its tests
 * pass. Blocks that are meant to fail carry `error` in the fence info (```dcl error title="A") and must
 * produce at least one error. (The Markdown compiler keeps the text after the language as `meta` and reads
 * only key="value" pairs from it, so the extra word is harmless.)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { check, format, runTests } from '$lib/hdl';
import { fencedBlocks } from './fences';
import { SNIPPETS } from './widgets/snippets';

const md = readFileSync(new URL('./index.md', import.meta.url), 'utf8');

const blocks = fencedBlocks(md, 'dcl');

describe('the DCL blocks of the chapter', () => {
  it('has a good number of them', () => {
    expect(blocks.length).toBeGreaterThanOrEqual(10);
    expect(blocks.filter((b) => /\berror\b/.test(b.meta)).length).toBe(3);
  });

  for (const b of blocks) {
    const broken = /\berror\b/.test(b.meta);
    it(`line ${b.line}: ${broken ? 'is rejected by the checker' : 'compiles, is formatted and passes its tests'}`, () => {
      const file = `chapter-${b.line}.dcl`;
      const { diagnostics } = check(b.code, { file });
      const errors = diagnostics.filter((d) => d.severity === 'error');
      if (broken) {
        expect(errors.length).toBeGreaterThan(0);
        return;
      }
      expect(errors.map((d) => d.message)).toEqual([]);
      expect(diagnostics.filter((d) => d.severity === 'warning').map((d) => d.message)).toEqual([]);
      expect(format(b.code, file).trim()).toBe(b.code.trim());
      const failed = runTests(b.code, { file }).results.filter((r) => !r.passed && !r.skipped);
      expect(failed.map((r) => r.name)).toEqual([]);
    });
  }

  it('shows the solutions that the playground exercises are checked against', () => {
    const solutions = blocks.filter((b) => !/\berror\b/.test(b.meta)).map((b) => b.code.trim());
    // The solutions in the text are the ones in snippets.ts, minus the tests that the playground adds.
    for (const id of ['fix-the-test', 'tick-gen']) {
      const solution = SNIPPETS[id]!.solution!;
      const module = solution.slice(0, solution.indexOf('\ntest ')).trim();
      expect(solutions.some((s) => s === module), id).toBe(true);
    }
  });
});
