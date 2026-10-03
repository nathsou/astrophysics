/**
 * Checks over all lesson content: every lesson compiles, every exercise is well formed, every
 * Chinese character has a reading and a glyph in the bundled font, and every taught word is in
 * the dictionary (so it can go to the review deck).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import YAML from 'yaml';
import type { Code } from 'mdast';
import { compileLesson, lessonStrings } from '$tools/markdown/compile';
import { EXERCISE_KINDS } from '$lib/exercises/kinds';
import { validateExercise } from '$lib/exercises/validate';
import { annotate, plain } from '$lib/zh/annotate';
import { lookup } from '$lib/zh/lexicon';
import { LESSONS } from './outline';

const dir = join(__dirname, 'lessons');
const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
const fontChars = new Set(readFileSync(join(__dirname, '../src/lib/assets/fonts/wenkai-chars.txt'), 'utf8'));
const strokes = join(__dirname, '../static/strokes');

describe('lessons', () => {
  it('match the outline', () => {
    const slugs = new Set(LESSONS.map((l) => l.slug));
    for (const f of files) expect(slugs.has(f.replace('.md', '')), f).toBe(true);
  });

  for (const f of files) {
    describe(f, () => {
      const src = readFileSync(join(dir, f), 'utf8');
      it('compiles', () => {
        expect(() => compileLesson(src, join(dir, f))).not.toThrow();
      });
      it('has well-formed exercises', () => {
        const tree = unified().use(remarkParse).use(remarkGfm).parse(src.replace(/^---\n[\s\S]*?\n---\n/, ''));
        const errors: string[] = [];
        visit(tree, 'code', (c: Code) => {
          if (!c.lang || !EXERCISE_KINDS.includes(c.lang)) return;
          errors.push(...validateExercise(c.lang, YAML.parse(c.value), `${f}:${c.position?.start.line} ${c.lang}`));
        });
        expect(errors).toEqual([]);
      });
      it('has a reading, a glyph and stroke data for every character', () => {
        const noReading = new Set<string>();
        const noGlyph = new Set<string>();
        const noStrokes = new Set<string>();
        for (const s of lessonStrings(src)) {
          for (const t of annotate(s)) for (const x of t.s ?? []) if (!x.py || x.py === '?') noReading.add(x.ch);
          for (const ch of plain(s)) {
            if (!/\p{Script=Han}/u.test(ch)) continue;
            if (!fontChars.has(ch)) noGlyph.add(ch);
            if (!existsSync(join(strokes, `${ch}.json`))) noStrokes.add(ch);
          }
        }
        expect([...noReading].join(''), 'no reading (add to content/data/extra.ts)').toBe('');
        expect([...noGlyph].join(''), 'missing from the font subset (run scripts/subset-font.py)').toBe('');
        expect([...noStrokes].join(''), 'no stroke data (run npm run strokes)').toBe('');
      });
      it('teaches only dictionary words', () => {
        const meta = compileLesson(src, join(dir, f));
        const words = JSON.parse(/export const metadata = (.*);/.exec(meta)![1]!).words as string[];
        expect(words.filter((w) => !lookup(w))).toEqual([]);
      });
    });
  }
});
