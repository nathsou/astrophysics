import { describe, expect, it } from 'vitest';
import { annotate, pinyinOf, plain } from './annotate';

const py = (t: string) => annotate(t).flatMap((x) => x.s?.map((s) => s.py) ?? []);

describe('annotate', () => {
  it('segments into dictionary words', () => {
    expect(annotate('我喜欢喝咖啡').filter((t) => t.s).map((t) => t.t)).toEqual(['我', '喜欢', '喝', '咖啡']);
  });
  it('keeps neutral tones from the dictionary', () => {
    expect(py('谢谢')).toEqual(['xiè', 'xie']);
    expect(py('东西')).toEqual(['dōng', 'xi']);
  });
  it('applies the 不 change', () => {
    expect(py('不是')).toEqual(['bú', 'shì']);
    expect(py('不好')).toEqual(['bù', 'hǎo']);
  });
  it('applies the 一 changes', () => {
    expect(py('一个')).toEqual(['yí', 'gè']);
    expect(py('一起')).toEqual(['yì', 'qǐ']);
    expect(py('第一')).toEqual(['dì', 'yī']);
    expect(py('十一')).toEqual(['shí', 'yī']);
    expect(py('一月')).toEqual(['yī', 'yuè']);
    expect(py('星期一')).toEqual(['xīng', 'qī', 'yī']);
    expect(py('看一看')).toEqual(['kàn', 'yi', 'kàn']);
    expect(py('一')).toEqual(['yī']);
  });
  it('honours forced readings', () => {
    expect(py('长[zhǎng]大')).toEqual(['zhǎng', 'dà']);
    expect(plain('长[zhǎng]大')).toBe('长大');
  });
  it('passes punctuation through', () => {
    expect(pinyinOf('你好！我叫小明。')).toBe('nǐhǎo! wǒ jiào xiǎomíng.');
  });
});
