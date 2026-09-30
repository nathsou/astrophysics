import { describe, expect, test } from 'vitest';
import { audibleHz, formatHz, frequencyHz, makeRing, measuredPeriod, predictedPeriod } from './ring';

function run(n: number, d: number, seed = 1, ns = 200) {
  const r = makeRing(n, d, seed);
  const rec = r.engine.watch([r.nodes[0]!]);
  r.engine.advance(ns * 1e-9);
  const out = { period: measuredPeriod(rec.times(), rec.values()[0]!), levels: r.nodes.map((x) => r.engine.logic(x)), msgs: r.engine.messages };
  rec.close();
  return out;
}

describe('a ring of inverters', () => {
  test('an odd ring oscillates with period 2 × n × delay', () => {
    for (const [n, d] of [[3, 1], [5, 1], [7, 1], [3, 2], [9, 0.5], [3, 0.5]] as const) {
      expect(run(n, d).period, `${n} × ${d} ns`).toBeCloseTo(2 * n * d, 2);
      expect(predictedPeriod(n, d)).toBe(2 * n * d);
    }
  });

  test('an even ring holds: every wire is the opposite of its neighbour, and nothing changes', () => {
    for (const n of [2, 4, 6]) {
      for (const seed of [1, 2, 3, 4]) {
        const r = run(n, 1, seed);
        expect(Number.isNaN(r.period)).toBe(true);
        for (let k = 0; k < n; k++) expect(r.levels[k]).not.toBe(r.levels[(k + 1) % n]);
        expect(r.levels.every((v) => v <= 1)).toBe(true);
      }
    }
  });

  test('an even ring powers up in either state, depending on the seed, and the state is repeatable', () => {
    const states = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) states.add(run(2, 1, seed).levels.join(''));
    expect([...states].sort()).toEqual(['01', '10']);
    expect(run(2, 1, 5).levels.join('')).toBe(run(2, 1, 5).levels.join(''));
  });

  test('an odd ring with no delay cannot settle: the engine says so and the wires go to X', () => {
    const r = run(3, 0, 1, 10);
    expect(r.msgs.some((m) => m.level === 'error' && /does not settle/.test(m.text))).toBe(true);
    expect(r.levels.every((v) => v === 2)).toBe(true);
  });

  test('an even ring with no delay is fine', () => {
    const r = run(2, 0);
    expect(r.msgs.filter((m) => m.level === 'error')).toEqual([]);
  });

  test('predictedPeriod is NaN where there is no oscillation', () => {
    expect(predictedPeriod(4, 1)).toBeNaN();
    expect(predictedPeriod(3, 0)).toBeNaN();
  });
});

describe('the tone', () => {
  test('scaled down by 125,000: 100 MHz is 800 Hz, and an octave up in frequency is an octave up in pitch', () => {
    expect(audibleHz(100e6)).toBeCloseTo(800, 6);
    expect(audibleHz(200e6) / audibleHz(100e6)).toBeCloseTo(2, 6);
    expect(audibleHz(frequencyHz(6))).toBeCloseTo(1333.33, 1);
  });
  test('and it stays within what a laptop speaker can play', () => {
    expect(audibleHz(1)).toBe(40);
    expect(audibleHz(1e12)).toBe(4000);
  });
  test('the slowest and fastest rings the widget offers are inside the range', () => {
    for (const [n, d] of [[3, 0.5], [9, 5], [11, 5]] as const) {
      const hz = audibleHz(frequencyHz(2 * n * d));
      expect(hz).toBeGreaterThan(40);
      expect(hz).toBeLessThan(4000);
    }
  });
  test('formatting', () => {
    expect(formatHz(166.7e6)).toBe('167 MHz');
    expect(formatHz(2.5e3)).toBe('2.5 kHz');
    expect(formatHz(NaN)).toBe('—');
  });
});

import { ringGeometry } from './ring';
describe('the drawing', () => {
  test('n inverters, n wires, all on the circle, the first at the top', () => {
    for (const n of [2, 3, 5, 9]) {
      const g = ringGeometry(n);
      expect(g.gates).toHaveLength(n);
      expect(g.arcs).toHaveLength(n);
      for (const p of g.gates) expect(Math.hypot(p.x - 110, p.y - 110)).toBeCloseTo(84, 6);
      expect(g.gates[0]!.y).toBeLessThan(110 - 80);
    }
  });
});
