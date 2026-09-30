import { describe, expect, test } from 'vitest';
import { DEFAULT_HITS, GB, LEVELS, amat, cachedAmat, humanSeconds, levelOf, size, time, words } from './hierarchy';

describe('the levels', () => {
  test('each level is slower and larger than the one above', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i]!.latency).toBeGreaterThan(LEVELS[i - 1]!.latency);
      expect(LEVELS[i]!.capacity).toBeGreaterThan(LEVELS[i - 1]!.capacity);
    }
  });
  test('main memory is about 100 times slower than L1, and a disk 100 000 times slower than memory', () => {
    expect(levelOf('dram').latency / levelOf('l1').latency).toBe(80);
    expect(levelOf('hdd').latency / levelOf('dram').latency).toBe(100000);
  });
});

describe('at human scale, 1 ns is 1 s', () => {
  test('L1 takes a second, memory a minute and twenty, a solid-state drive 22 hours, a hard disk three months', () => {
    expect(humanSeconds(levelOf('l1').latency)).toBeCloseTo(1, 9);
    expect(words(humanSeconds(levelOf('dram').latency))).toBe('1 min 20 s');
    expect(words(humanSeconds(levelOf('ssd').latency))).toBe('22.2 hours');
    expect(words(humanSeconds(levelOf('hdd').latency))).toBe('3 months');
    expect(words(humanSeconds(levelOf('l2').latency))).toBe('4 s');
  });
});

describe('formatting', () => {
  test('times and sizes', () => {
    expect(time(0.3e-9)).toBe('0.3 ns');
    expect(time(80e-9)).toBe('80 ns');
    expect(time(80e-6)).toBe('80 µs');
    expect(time(8e-3)).toBe('8 ms');
    expect(size(48 * 1024)).toBe('48 KB');
    expect(size(32 * GB)).toBe('32 GB');
  });
});

describe('average access time', () => {
  test('one level: its own time; a perfect cache: the fast time; a useless cache: the sum', () => {
    expect(amat([5], [])).toBe(5);
    expect(amat([1, 100], [1])).toBe(1);
    expect(amat([1, 100], [0])).toBe(101);
  });
  test('with 95 %, 80 % and 70 % hit rates the average access time is 1.6 ns, not 80', () => {
    expect(cachedAmat(DEFAULT_HITS) * 1e9).toBeCloseTo(1.59, 2);
    expect(cachedAmat([0.99, 0.8, 0.7]) * 1e9).toBeCloseTo(1.118, 3);
    expect(cachedAmat([0, 0, 0]) * 1e9).toBeCloseTo(1 + 4 + 15 + 80, 6);
  });
});
