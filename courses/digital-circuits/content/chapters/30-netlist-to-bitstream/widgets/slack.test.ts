import { describe, expect, test } from 'vitest';
import { NETS, buildGraph, defaultDelays, timing } from './slack';

describe('slack and the critical path (Figure 30.5)', () => {
  const d = defaultDelays();

  test('the graph is acyclic, has nine nets, and starts and ends at flip-flops', () => {
    const g = buildGraph();
    expect(g.cyclic).toBe(false);
    expect(NETS).toHaveLength(9);
    expect(g.connections).toHaveLength(9);
  });

  test('with the default delays the critical path is FF2 → L2 → L3 → L4 → FF4 and takes 4.4 ns: 227 MHz', () => {
    const t = timing(d, 5);
    // 0.3 launch + 0.4 (n2) + 0.5 + 1.1 (n4) + 0.5 + 0.5 (n7) + 0.5 + 0.4 (n8) + 0.2 set-up
    expect(t.period).toBeCloseTo(4.4, 9);
    expect(t.critical).toEqual(['n2', 'n4', 'n7', 'n8']);
    expect(t.fmax).toBeCloseTo(227.27, 2);
    expect(t.arrivals.map((a) => +a.arrival.toFixed(2))).toEqual([3.1, 4.4]);
  });

  test('slack is zero along the critical path, positive elsewhere, and the target moves it all by the same amount', () => {
    const t = timing(d, 5);
    expect(t.onCritical.filter(Boolean)).toHaveLength(4);
    NETS.forEach((n, i) => {
      if (!t.critical.includes(n.id)) expect(t.slackWorst[i]!).toBeGreaterThan(0);
      expect(t.slack[i]!).toBeCloseTo(t.slackWorst[i]! + 0.6, 9);
    });
    expect(t.slackWorst[1]).toBeCloseTo(0.2, 9); // n1: the second path is only 0.2 ns behind
    expect(t.met).toBe(true);
    expect(timing(d, 4).met).toBe(false);
    expect(Math.min(...timing(d, 4).slack)).toBeCloseTo(-0.4, 9);
  });

  test('speeding up a net that is not critical does nothing', () => {
    const fast = d.slice();
    fast[5] = 0.1; // n5, L2 → L4
    fast[6] = 0.1;
    expect(timing(fast, 5).period).toBeCloseTo(4.4, 9);
  });

  test('slowing a net that is not critical until it is moves the critical path', () => {
    const slow = d.slice();
    slow[1] = 1.3; // n1: FF2 → L1 becomes the slower way to L3
    const t = timing(slow, 5);
    expect(t.period).toBeGreaterThan(4.4);
    expect(t.critical).toContain('n1');
  });

  test('speeding up a critical net helps only until another path takes over: n4 from 1.1 to 0.1 gains 0.2 ns, not 1.0', () => {
    const e = d.slice();
    e[4] = 0.1;
    const t = timing(e, 5);
    expect(t.period).toBeCloseTo(4.2, 9);
    expect(t.critical).toEqual(['n1', 'n3', 'n7', 'n8']);
  });

  test('two paths of equal length are both critical', () => {
    const e = d.slice();
    e[4] = 0.9; // FF2 → L2 → L3 now takes as long as FF2 → L1 → L3
    const t = timing(e, 5);
    expect(t.onCritical.filter(Boolean).length).toBeGreaterThanOrEqual(6);
    expect(t.period).toBeCloseTo(4.2, 9);
  });
});
