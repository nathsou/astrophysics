/**
 * Compiles every chapter and appendix, so that Markdown, directive and YAML errors in content fail
 * the test suite rather than a page at run time.
 */
import { describe, expect, test } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { compileMarkdown } from './compile';

const root = path.resolve(import.meta.dirname, '../../content');
const files = ['chapters', 'appendices'].flatMap((dir) => {
  const d = path.join(root, dir);
  if (!existsSync(d)) return [];
  return readdirSync(d)
    .map((c) => path.join(d, c, 'index.md'))
    .filter((f) => existsSync(f));
});

describe('content compiles', () => {
  for (const file of files) {
    test(path.relative(root, file), async () => {
      const { code } = await compileMarkdown(readFileSync(file, 'utf8'), file);
      expect(code).toContain('export const metadata');
    }, 30000);
  }
});
