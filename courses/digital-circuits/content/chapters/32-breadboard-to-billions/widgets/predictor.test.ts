import { describe, expect, test } from 'vitest';
import { LENGTH, PATTERNS, cpi, loop, nextSaturating, nextTwoBit, randomBits, simulate } from './predictor';

const pattern = (id: string) => PATTERNS.find((p) => p.id === id)!.outcomes;
const misses = (kind: Parameters<typeof simulate>[0], id: string) => simulate(kind, pattern(id)).misses;

describe('the two-bit counter', () => {
  test('the majority-gate equations of the circuit are a saturating counter, for all 8 (state, outcome) pairs', () => {
    for (let s = 0; s < 4; s++) for (const t of [false, true]) expect(nextTwoBit(s, t), `${s} ${t}`).toBe(nextSaturating(s, t));
  });
  test('it takes two surprises to change its mind', () => {
    // from strongly taken (3): one not-taken leaves it still guessing taken
    expect(nextTwoBit(3, false)).toBe(2);
    expect(nextTwoBit(2, false)).toBe(1);
    const r = simulate('two-bit', [true, true, true, false, true]);
    expect(r.guesses).toEqual([false, false, true, true, true]);
  });
});

describe('predictors on the patterns', () => {
  test('all patterns are the same length', () => {
    for (const p of PATTERNS) expect(p.outcomes, p.id).toHaveLength(LENGTH);
  });
  test('loop of 8: the one-bit predictor misses twice per loop, the two-bit counter once', () => {
    const entries = LENGTH / 8;
    // one bit: at each exit, and at the first branch of the next entry (except the first entry starts from "not taken": miss too)
    expect(misses('one-bit', 'loop8')).toBe(2 * entries - 0);
    // two bit after warm-up: only the exit; the first two branches of the first entry are guessed "not taken"
    expect(misses('two-bit', 'loop8')).toBe(entries + 2);
    expect(misses('static', 'loop8')).toBe(entries);
  });
  test('loop of 3: the counter keeps guessing "taken" and misses only the exit', () => {
    const entries = LENGTH / 3;
    expect(misses('two-bit', 'loop3')).toBeLessThanOrEqual(entries + 3);
    expect(misses('one-bit', 'loop3')).toBeGreaterThan(misses('two-bit', 'loop3'));
  });
  test('alternating: one bit is wrong every time; the counter, starting from "not taken", is wrong half the time', () => {
    expect(misses('one-bit', 'alt')).toBe(LENGTH);
    expect(misses('two-bit', 'alt')).toBe(LENGTH / 2);
    expect(misses('static', 'alt')).toBe(LENGTH / 2);
  });
  test('a 90 % branch is easy for the counter and a coin toss is hopeless for everyone', () => {
    expect(misses('two-bit', 'biased') / LENGTH).toBeLessThan(0.25);
    for (const k of ['static', 'one-bit', 'two-bit'] as const) {
      const rate = misses(k, 'coin') / LENGTH;
      expect(rate).toBeGreaterThan(0.3);
      expect(rate).toBeLessThan(0.7);
    }
  });
  test('a branch that is rarely taken ruins “always taken” and is easy for the others', () => {
    expect(misses('static', 'rare') / LENGTH).toBeGreaterThan(0.75);
    expect(misses('two-bit', 'rare') / LENGTH).toBeLessThan(0.2);
    expect(misses('one-bit', 'rare')).toBeGreaterThan(misses('two-bit', 'rare'));
  });
  test('on the loop of 8 always guessing “taken” does as well as the counter in the long run: 1 in 8', () => {
    expect(misses('static', 'loop8') / LENGTH).toBeCloseTo(1 / 8, 5);
    expect(misses('two-bit', 'loop8')).toBe(LENGTH / 8 + 2);
  });
  test('states follow the outcomes', () => {
    const r = simulate('two-bit', pattern('loop8'));
    expect(r.states[0]).toBe(0);
    expect(Math.max(...r.states)).toBe(3);
    expect(r.hits.filter((h) => !h)).toHaveLength(r.misses);
  });
});

describe('helpers', () => {
  test('loop(n, k) is k copies of n − 1 taken and one not taken', () => {
    expect(loop(3, 2)).toEqual([true, true, false, true, true, false]);
  });
  test('random bits are reproducible and have about the requested bias', () => {
    expect(randomBits(20, 0.5, 3)).toEqual(randomBits(20, 0.5, 3));
    const taken = randomBits(4000, 0.9, 5).filter(Boolean).length / 4000;
    expect(taken).toBeGreaterThan(0.87);
    expect(taken).toBeLessThan(0.93);
  });
  test('CPI: a 15-stage pipeline with 5 % of branches wrong runs at 1.15', () => {
    expect(cpi(0.05, 15)).toBeCloseTo(1.15, 10);
    expect(cpi(0, 15)).toBe(1);
    expect(cpi(0.5, 15)).toBeCloseTo(2.5, 10);
  });
});
