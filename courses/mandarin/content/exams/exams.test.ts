import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HSK1 } from './hsk1';
import { HSK2 } from './hsk2';
import { annotate } from '$lib/zh/annotate';

const font = new Set(readFileSync(join(__dirname, '../../src/lib/assets/fonts/wenkai-chars.txt'), 'utf8'));

describe('mock exams', () => {
  for (const p of [HSK1, HSK2]) {
    it(`${p.id} is well formed`, () => {
      for (const s of p.sections)
        for (const q of s.questions) {
          if (q.type === 'pictures') expect(q.answer).toBeLessThan(q.pictures.length);
          if (q.type === 'choose' || q.type === 'fill') expect(q.answer).toBeLessThan(q.options.length);
          if (q.type === 'fill') expect(q.zh).toContain('___');
          const text = [q.zh, ...(q.type === 'choose' || q.type === 'fill' ? q.options : []), q.type === 'choose' ? (q.question ?? '') : ''].join('');
          for (const t of annotate(text)) for (const x of t.s ?? []) {
            expect(x.py, `reading for ${x.ch}`).not.toBe('?');
            expect(font.has(x.ch), `glyph for ${x.ch}`).toBe(true);
          }
        }
    });
  }
});
