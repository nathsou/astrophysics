/**
 * Every word of the 2025 syllabus for HSK 1 and 2 is taught somewhere in the course (in a
 * ```words block or a lesson's `words:` list), so the review deck can cover the whole exam.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileLesson } from '$tools/markdown/compile';
import { hskWords } from '$lib/zh/lexicon';

const dir = join(__dirname, 'lessons');
const taught = new Map<string, string>();
for (const f of readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
  const out = compileLesson(readFileSync(join(dir, f), 'utf8'), join(dir, f));
  const words = JSON.parse(/export const metadata = (.*);/.exec(out)![1]!).words as string[];
  for (const w of words) if (!taught.has(w)) taught.set(w, f);
}

export function untaught(level: number): string[] {
  return hskWords('n', level)
    .map((w) => w.w)
    .filter((w) => !taught.has(w));
}

describe('HSK coverage', () => {
  it('teaches every HSK 1 word', () => {
    expect(untaught(1)).toEqual([]);
  });
  it('teaches every HSK 2 word', () => {
    expect(untaught(2)).toEqual([]);
  });
});
