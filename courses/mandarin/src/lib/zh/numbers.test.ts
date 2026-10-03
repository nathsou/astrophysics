import { describe, expect, it } from 'vitest';
import { countToChinese, dateToChinese, numberToChinese, phoneToChinese, priceToChinese, timeToChinese, yearToChinese } from './numbers';

describe('numbers', () => {
  it('says numbers', () => {
    const cases: [number, string][] = [
      [0, '零'], [7, '七'], [10, '十'], [11, '十一'], [20, '二十'], [99, '九十九'], [100, '一百'],
      [101, '一百零一'], [110, '一百一十'], [115, '一百一十五'], [1001, '一千零一'], [1010, '一千零一十'],
      [10000, '一万'], [10500, '一万零五百'], [12345, '一万两千三百四十五'.replace('两', '二')], [100000, '十万'],
    ];
    for (const [n, s] of cases) expect(numberToChinese(n)).toBe(s);
    expect(numberToChinese(200, { liang: true })).toBe('两百');
    expect(numberToChinese(20000, { liang: true })).toBe('两万');
    expect(numberToChinese(2222, { liang: true })).toBe('两千二百二十二');
  });
  it('counts things', () => {
    expect(countToChinese(2)).toBe('两');
    expect(countToChinese(12)).toBe('十二');
  });
  it('says prices', () => {
    expect(priceToChinese(3)).toBe('三块');
    expect(priceToChinese(2)).toBe('两块');
    expect(priceToChinese(12.5)).toBe('十二块五');
    expect(priceToChinese(0.8)).toBe('八毛');
    expect(priceToChinese(0.2)).toBe('两毛');
    expect(priceToChinese(2.05)).toBe('两块零五分');
    expect(priceToChinese(25.35)).toBe('二十五块三毛五分');
  });
  it('tells the time', () => {
    expect(timeToChinese(2, 0)).toBe('两点');
    expect(timeToChinese(8, 30)).toBe('八点半');
    expect(timeToChinese(9, 15)).toBe('九点十五分');
    expect(timeToChinese(7, 5)).toBe('七点零五分');
    expect(timeToChinese(12, 45)).toBe('十二点四十五分');
  });
  it('says dates, years and phone numbers', () => {
    expect(dateToChinese(3, 12)).toBe('三月十二号');
    expect(dateToChinese(10, 1, 4)).toBe('十月一号星期四');
    expect(yearToChinese(2026)).toBe('二零二六年');
    expect(phoneToChinese('110')).toBe('幺幺零');
  });
});
