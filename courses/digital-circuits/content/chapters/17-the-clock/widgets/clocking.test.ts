import { describe, expect, test } from 'vitest';
import { DEFAULT_PATH, analyse, simulate, type PathParams } from './clocking';

const path = (over: Partial<PathParams>): PathParams => ({ ...DEFAULT_PATH, ...over });

describe('the slack formulas', () => {
  test('the default path: 1.5 ns clock-to-Q, eight 1.2 ns gates, 1 ns set-up', () => {
    const a = analyse(DEFAULT_PATH);
    expect(a.tpath).toBeCloseTo(9.6, 6);
    expect(a.arrival).toBeCloseTo(11.1, 6);
    expect(a.tmin).toBeCloseTo(12.1, 6);
    expect(a.fmax).toBeCloseTo(82.6, 1);
    expect(a.setupSlack).toBeCloseTo(7.9, 6);
    expect(a.holdSlack).toBeCloseTo(10.3, 6);
  });
  test('skew moves both slacks in opposite directions, and their sum does not depend on it', () => {
    const a = analyse(path({ skew: 0 }));
    const b = analyse(path({ skew: 2 }));
    expect(b.setupSlack - a.setupSlack).toBeCloseTo(2, 6);
    expect(b.holdSlack - a.holdSlack).toBeCloseTo(-2, 6);
    expect(a.setupSlack + a.holdSlack).toBeCloseTo(b.setupSlack + b.holdSlack, 6);
  });
  test('a bare wire between two flip-flops meets hold with no skew: the clock-to-Q is longer than the hold time', () => {
    const a = analyse(path({ gates: 0 }));
    expect(a.holdSlack).toBeCloseTo(0.7, 6);
    expect(a.holdOk).toBe(true);
  });
});

describe('the engine agrees with the formulas', () => {
  test('with plenty of slack every capture is right and no warning is posted', () => {
    const r = simulate(path({ period: 20 }));
    expect(r.captures.length).toBeGreaterThanOrEqual(4);
    expect(r.captures.map((c) => c.verdict)).toEqual(r.captures.map(() => 'ok'));
    expect(r.warnings).toEqual([]);
    expect(r.works).toBe(true);
  });

  test('set-up: passes just above the minimum period, fails just below it', () => {
    const a = analyse(DEFAULT_PATH);
    expect(simulate(path({ period: a.tmin + 0.4 })).works).toBe(true);
    const below = simulate(path({ period: a.tmin - 0.5 }));
    expect(below.works).toBe(false);
    expect(below.warnings.some((w) => /set-up time violated/.test(w))).toBe(true);
  });

  test('a path longer than one period does not warn: it silently delivers stale data', () => {
    const r = simulate(path({ period: 7 }), 8);
    expect(r.works).toBe(false);
    expect(r.captures.slice(2).some((c) => c.verdict === 'wrong')).toBe(true);
  });

  test('hold: too much skew on a short path fails at any period, and a slower clock does not help', () => {
    const p = path({ gates: 0, skew: 2 });
    expect(analyse(p).holdOk).toBe(false);
    for (const period of [10, 40]) {
      const r = simulate({ ...p, period });
      expect(r.works, `period ${period}`).toBe(false);
    }
    expect(simulate(path({ gates: 0, skew: 0, period: 10 })).works).toBe(true);
  });

  test('positive skew buys speed on a long path: it passes at a period that fails with none', () => {
    const p = path({ period: 10.5 });
    expect(analyse(p).setupOk).toBe(false);
    expect(simulate(p).works).toBe(false);
    const s = { ...p, skew: 2 };
    expect(analyse(s).setupOk).toBe(true);
    expect(analyse(s).holdOk).toBe(true);
    expect(simulate(s).works).toBe(true);
  });

  test('negative skew is the same trade the other way round', () => {
    const p = path({ period: 14, skew: -3 });
    expect(analyse(p).setupOk).toBe(false);
    expect(simulate(p).works).toBe(false);
    expect(simulate(path({ period: 14, skew: 0 })).works).toBe(true);
  });

  test('the analytic verdict matches the engine over a grid of periods, skews and lengths', () => {
    let checked = 0;
    for (const gates of [0, 3, 8]) {
      for (const skew of [-2, 0, 1.5]) {
        for (const period of [7, 9, 13, 16, 25]) {
          const p = path({ gates, skew, period });
          const a = analyse(p);
          // Leave a margin around the boundary and stay out of the multi-cycle regime (path longer than a period).
          if (Math.abs(a.setupSlack) < 0.3 || Math.abs(a.holdSlack) < 0.3 || a.arrival + p.setup > p.period + 1.5 * p.period) continue;
          const ok = a.setupOk && a.holdOk;
          expect(simulate(p).works, JSON.stringify(p)).toBe(ok);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
});
