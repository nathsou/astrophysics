/**
 * Every ```dcl block of Appendix F is a whole DCL file: it type-checks without warnings, is in the standard
 * format, and its tests pass. Blocks meant to fail carry `error` in the fence info (```dcl error) and must
 * produce at least one error, and every error message the text quotes in a ```text block after it must occur.
 *
 * Run with FIX_DCL=1 to rewrite the blocks of index.md in the standard format.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { check, format, renderDiagnostics, runTests } from '$lib/hdl';
import { fencedBlocks } from './fences';

const path = new URL('./index.md', import.meta.url);
let md = readFileSync(path, 'utf8');

/** The messages the compiler gives for an erroneous block, as the text that follows the block shows them. */
const messagesOf = (code: string): string => {
  const { diagnostics } = check(code, { file: 'demo.dcl' });
  return renderDiagnostics(code, diagnostics.filter((d) => d.severity === 'error'));
};

if (process.env.FIX_DCL) {
  // Later blocks first, so that the offsets of earlier ones stay valid.
  const all = fencedBlocks(md, 'dcl').reverse();
  for (const b of all) {
    if (/\berror\b/.test(b.meta)) {
      const after = md.slice(b.end + 4);
      const m = /^\n\n```text\n([\s\S]*?)\n```/.exec(after);
      if (m) {
        const at = b.end + 4 + m[0].indexOf(m[1]!, 10);
        md = md.slice(0, at) + messagesOf(b.code) + md.slice(at + m[1]!.length);
      }
      continue;
    }
    md = md.slice(0, b.start) + format(b.code, 'fix.dcl').trimEnd() + md.slice(b.end);
  }
  writeFileSync(path, md);
}

const blocks = fencedBlocks(md, 'dcl');

describe('the DCL blocks of the appendix', () => {
  it('has a good number of them', () => {
    expect(blocks.length).toBeGreaterThanOrEqual(12);
    expect(blocks.filter((b) => /\berror\b/.test(b.meta)).length).toBeGreaterThanOrEqual(5);
  });

  for (const b of blocks) {
    const broken = /\berror\b/.test(b.meta);
    it(`line ${b.line}: ${broken ? 'is rejected by the checker' : 'compiles, is formatted and passes its tests'}`, () => {
      const file = `appendix-f-${b.line}.dcl`;
      const { diagnostics } = check(b.code, { file });
      const errors = diagnostics.filter((d) => d.severity === 'error');
      if (broken) {
        expect(errors.length).toBeGreaterThan(0);
        // The ```text block after it, if any, is what the compiler says.
        const after = md.slice(b.end + 4);
        const m = /^\n\n```text\n([\s\S]*?)\n```/.exec(after);
        if (m) expect(m[1]).toBe(messagesOf(b.code));
        return;
      }
      expect(errors.map((d) => d.message)).toEqual([]);
      expect(diagnostics.filter((d) => d.severity === 'warning').map((d) => d.message)).toEqual([]);
      expect(format(b.code, file).trim()).toBe(b.code.trim());
      const failed = runTests(b.code, { file }).results.filter((r) => !r.passed && !r.skipped);
      expect(failed.map((r) => r.name)).toEqual([]);
    });
  }
});
