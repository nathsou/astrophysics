import { describe, expect, it } from 'vitest';
import { isRight, makeQuestion } from './numbergen';
import { rng } from '$lib/exercises/shuffle';

describe('number game', () => {
  it('generates every kind', () => {
    const r = rng(7);
    for (const k of ['number', 'price', 'time', 'date', 'phone', 'age'] as const) {
      for (let i = 0; i < 50; i++) {
        const q = makeQuestion(k, r, 9999);
        expect(q.zh.length).toBeGreaterThan(0);
        expect(isRight(q, q.answer)).toBe(true);
      }
    }
  });
  it('accepts reasonable spellings', () => {
    const q = { kind: 'time' as const, answer: '8:30', shown: '8:30', zh: '八点半' };
    expect(isRight(q, '830')).toBe(true);
    expect(isRight(q, '8.30')).toBe(true);
    expect(isRight(q, '8:15')).toBe(false);
    const p = { kind: 'price' as const, answer: '12.5', shown: '', zh: '' };
    expect(isRight(p, '12.50')).toBe(true);
    expect(isRight(p, '¥12.5')).toBe(true);
    const d = { kind: 'date' as const, answer: '3/12', shown: '', zh: '' };
    expect(isRight(d, '3-12')).toBe(true);
    expect(isRight(d, '12/3')).toBe(false);
  });
});
