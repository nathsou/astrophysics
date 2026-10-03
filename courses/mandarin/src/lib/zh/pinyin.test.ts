import { describe, expect, it } from 'vitest';
import { bare, comparePinyin, mark, marksToNumbers, numbersToMarks, splitSyllable, syllables, toneOf } from './pinyin';

describe('pinyin', () => {
  it('reads tones from marks', () => {
    expect(toneOf('mā')).toBe(1);
    expect(toneOf('lǜ')).toBe(4);
    expect(toneOf('ma')).toBe(5);
  });
  it('places marks by the standard rule', () => {
    expect(mark('hao', 3)).toBe('hǎo');
    expect(mark('gou', 3)).toBe('gǒu');
    expect(mark('liu', 2)).toBe('liú');
    expect(mark('gui', 4)).toBe('guì');
    expect(mark('lv', 4)).toBe('lǜ');
    expect(mark('xue', 2)).toBe('xué');
  });
  it('converts numbers and marks both ways', () => {
    expect(numbersToMarks('ni3 hao3')).toBe('nǐ hǎo');
    expect(numbersToMarks('xie4xie5')).toBe('xièxie');
    expect(marksToNumbers('nǐ hǎo')).toBe('ni3 hao3');
    expect(marksToNumbers('lǜ')).toBe('lv4');
    expect(bare('zhōng')).toBe('zhong');
  });
  it('splits syllables', () => {
    expect(splitSyllable('zhuàng')).toEqual({ initial: 'zh', final: 'uang' });
    expect(splitSyllable('ān')).toEqual({ initial: '', final: 'an' });
    expect(syllables('nǐhǎo')).toEqual(['nǐ', 'hǎo']);
    expect(syllables("xī'ān")).toEqual(['xī', 'ān']);
    expect(syllables('zhōngguó rén')).toEqual(['zhōng', 'guó', 'rén']);
  });
  it('compares typed answers', () => {
    expect(comparePinyin('ni3 hao3', 'nǐ hǎo').correct).toBe(true);
    expect(comparePinyin('nǐhǎo', 'nǐ hǎo').correct).toBe(true);
    const r = comparePinyin('ni2 hao3', 'nǐ hǎo');
    expect(r).toEqual({ correct: false, soundsRight: true, tonesWrong: [0] });
    expect(comparePinyin('li3 hao3', 'nǐ hǎo').soundsRight).toBe(false);
  });
});
