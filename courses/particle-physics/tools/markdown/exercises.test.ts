/**
 * Every `code` exercise in every chapter: its reference solution passes all its tests, and its starter code does
 * not (so no test is vacuous). Every `numeric`/`fermi` exercise has a numeric answer.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import YAML from 'yaml';
import { runTests } from '../../src/lib/code/run';

const root = path.resolve(import.meta.dirname, '../../content');

function markdownFiles(): string[] {
  const out: string[] = [];
  for (const kind of ['chapters', 'appendices']) {
    const dir = path.join(root, kind);
    if (!existsSync(dir)) continue;
    for (const d of readdirSync(dir)) {
      const f = path.join(dir, d, 'index.md');
      if (existsSync(f)) out.push(f);
    }
  }
  return out;
}

function blocks(src: string, lang: string): string[] {
  const re = new RegExp('^```' + lang + '\\s*\\n([\\s\\S]*?)^```\\s*$', 'gm');
  return [...src.matchAll(re)].map((m) => m[1]!);
}

const files = markdownFiles();
const ids = new Set<string>();

for (const file of files) {
  const rel = path.relative(root, file);
  const src = readFileSync(file, 'utf8');
  const codes = blocks(src, 'code').map((b) => YAML.parse(b) as Record<string, string>);
  const nums = [...blocks(src, 'numeric'), ...blocks(src, 'fermi')].map((b) => YAML.parse(b) as Record<string, unknown>);
  if (!codes.length && !nums.length) continue;
  describe(rel, () => {
    for (const ex of codes) {
      test(`code exercise ${ex.id}: reference passes, starter fails`, async () => {
        expect(ex.id, 'exercise needs an id').toBeTruthy();
        expect(ids.has(ex.id!), `duplicate exercise id ${ex.id}`).toBe(false);
        ids.add(ex.id!);
        for (const k of ['starter', 'tests', 'solution']) expect(ex[k], `${ex.id} needs ${k}`).toBeTruthy();
        const good = await runTests(ex.id!, ex.solution!, ex.tests!);
        expect(good.error, `reference solution of ${ex.id}`).toBeUndefined();
        expect(good.results.length, 'has tests').toBeGreaterThan(0);
        expect(good.results.filter((r) => !r.passed).map((r) => `${r.name}: ${r.error}`), `reference of ${ex.id} must pass`).toEqual([]);
        const bad = await runTests(ex.id!, ex.starter!, ex.tests!);
        const starterPasses = bad.ok && bad.results.length > 0 && bad.results.every((r) => r.passed);
        expect(starterPasses, `the starter code of ${ex.id} already passes every test`).toBe(false);
      });
    }
    for (const ex of nums) {
      test(`numeric exercise ${ex.id} has a finite answer`, () => {
        expect(ex.id).toBeTruthy();
        expect(ids.has(String(ex.id))).toBe(false);
        ids.add(String(ex.id));
        expect(Number.isFinite(Number(ex.answer))).toBe(true);
      });
    }
  });
}

test('at least the reference chapter is covered', () => {
  expect(files.length).toBeGreaterThan(0);
});
