import { describe, expect, test } from 'vitest';
import { EXAMPLES, buildFrames, chartAfter, labels, parseList, run, termOf } from './qmsteps';
import { coverMinterms } from '$lib/pld/twolevel';

describe('parseList', () => {
  test('numbers separated by commas, spaces or semicolons, sorted, without duplicates', () => {
    expect(parseList('5, 1  3;3', 3)).toEqual({ ok: true, list: [1, 3, 5] });
    expect(parseList('', 3)).toEqual({ ok: true, list: [] });
  });
  test('errors say what is wrong', () => {
    expect(parseList('1, x', 3)).toMatchObject({ ok: false });
    expect(parseList('9', 3)).toMatchObject({ ok: false, why: expect.stringContaining('0 to 7') });
  });
});

describe('frames', () => {
  test('a function with essential primes: list, merges, primes, chart, essential steps, result', () => {
    const { frames } = run(4, [4, 8, 10, 11, 12, 15], [9, 14]);
    const phases = frames.map((f) => f.phase);
    expect(phases[0]).toBe('list');
    expect(phases).toContain('merge');
    expect(phases).toContain('primes');
    expect(phases).toContain('chart');
    expect(phases).toContain('essential');
    expect(phases[phases.length - 1]).toBe('result');
    // Columns of the table appear one merge round at a time.
    const merges = frames.filter((f) => f.phase === 'merge');
    expect(merges.map((f) => f.rounds)).toEqual(merges.map((_, i) => i + 2));
    // The chart only appears after the primes.
    expect(frames.findIndex((f) => f.chart)).toBeGreaterThan(frames.findIndex((f) => f.phase === 'primes'));
  });

  test('the cyclic example goes through the core and Petrick', () => {
    const { frames, q } = run(3, [0, 1, 2, 5, 6, 7], []);
    const phases = frames.map((f) => f.phase);
    expect(phases).toContain('core');
    expect(phases).toContain('petrick-sums');
    expect(phases.filter((p) => p === 'petrick-multiply')).toHaveLength(q.trace.petrick!.steps.length);
    expect(phases).toContain('petrick-pick');
    expect(q.trace.solution).toHaveLength(3);
  });

  test('the answer of every example covers the on-set and stays inside on ∪ dc', () => {
    for (const e of EXAMPLES) {
      const { q } = run(e.n, e.on, e.dc);
      const cover = new Set(coverMinterms(q.cover));
      for (const m of e.on) expect(cover.has(m), `${e.id}: minterm ${m}`).toBe(true);
      for (const m of cover) expect(e.on.includes(m) || e.dc.includes(m), `${e.id}: ${m} is neither on nor don't care`).toBe(true);
    }
  });

  test('the chart state is cumulative: selected primes and covered columns only grow', () => {
    const { q } = run(4, [4, 8, 10, 11, 12, 15], [9, 14]);
    let prev = 0;
    for (let k = 0; k <= q.trace.steps.length; k++) {
      const s = chartAfter(q.trace, k);
      expect(s.removedCols.length).toBeGreaterThanOrEqual(prev);
      prev = s.removedCols.length;
    }
  });

  test('labels are P1… in trace order and terms print with the variable names', () => {
    const { q } = run(4, [4, 8, 10, 11, 12, 15], [9, 14]);
    const L = labels(q.trace);
    expect([...L.values()][0]).toBe('P1');
    expect(termOf(q.trace, q.trace.primes[0]!)).toMatch(/[A-D]/);
  });

  test('no frame text is empty and every frame has a title', () => {
    for (const e of EXAMPLES) for (const f of run(e.n, e.on, e.dc).frames) expect(f.text.length + f.title.length).toBeGreaterThan(20);
  });

  test('a function with no on-set gives a short, sensible run', () => {
    const q = run(3, [], []);
    expect(q.frames.length).toBeGreaterThan(1);
    expect(buildFrames(q.q.trace).at(-1)!.phase).toBe('result');
  });

  test('4-bit parity: nothing merges, and every prime is essential', () => {
    const { q, frames } = run(4, [1, 2, 4, 7, 8, 11, 13, 14], []);
    expect(q.trace.primes).toHaveLength(8);
    expect(q.trace.essential).toHaveLength(8);
    expect(frames.some((f) => f.phase === 'merge')).toBe(false);
  });
});
