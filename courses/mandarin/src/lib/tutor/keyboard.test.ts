import { it, expect } from 'vitest';
import { characterCandidates, insertAt } from './keyboard';
import { allWords } from '$lib/zh/lexicon';

it('finds characters from plain, marked and numbered pinyin', () => {
  for (const query of ['ni hao', 'nǐ hǎo', 'ni3hao3']) expect(characterCandidates(query, allWords())[0]!.w).toBe('你好');
  expect(characterCandidates('lv', allWords()).some(w => w.w === '绿')).toBe(true);
  expect(characterCandidates('', allWords())).toEqual([]);
  expect(characterCandidates('a', allWords()).length).toBeLessThanOrEqual(12);
});
it('inserts into the current selection and returns the new cursor', () => {
  expect(insertAt('ni hao', 'ǐ', 1, 2)).toEqual({ text: 'nǐ hao', cursor: 2 });
  expect(insertAt('你好', '！', 2, 2)).toEqual({ text: '你好！', cursor: 3 });
});
