import { describe, expect, test } from 'vitest';
import { H, R, W, clampPt, defaultPositions, edges, fitView, heightFor } from './layout';
import { DETECTOR, PRESETS, TRAFFIC_LIGHT, VENDING } from './presets';

const names = (f: { states: { name: string }[] }) => f.states.map((s) => s.name);

describe('positions', () => {
  test('the reset state is at the top and all bubbles fit in the canvas without touching', () => {
    for (const p of PRESETS) {
      const pos = defaultPositions(names(p.fsm));
      const list = Object.values(pos);
      const top = Math.min(...list.map((q) => q.y));
      if (list.length > 2) expect(pos[p.fsm.states[0]!.name]!.y).toBe(top);
      for (const q of list) {
        expect(q.x).toBeGreaterThan(R);
        expect(q.x).toBeLessThan(W - R);
        expect(q.y).toBeGreaterThan(R);
        expect(q.y).toBeLessThan(heightFor(list.length) - R);
      }
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) expect(Math.hypot(list[i]!.x - list[j]!.x, list[i]!.y - list[j]!.y)).toBeGreaterThan(2 * R + 8);
    }
    const twelve = defaultPositions(Array.from({ length: 12 }, (_, i) => 's' + i));
    const l = Object.values(twelve);
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) expect(Math.hypot(l[i]!.x - l[j]!.x, l[i]!.y - l[j]!.y)).toBeGreaterThan(2 * R);
  });
  test('clamp keeps a dragged bubble on the canvas', () => {
    expect(clampPt({ x: -50, y: 9999 })).toEqual({ x: R + 6, y: H - R - 6 });
  });
});

describe('edges', () => {
  test('one edge per pair of states, with a label line per arrow', () => {
    const e = edges(DETECTOR, defaultPositions(names(DETECTOR)));
    const idle = e.find((x) => x.from === 'Idle' && x.to === 'Idle')!;
    expect(idle.self).toBe(true);
    expect(idle.lines).toEqual(['!x/0']);
    expect(e.reduce((n, x) => n + x.arrows.length, 0)).toBe(DETECTOR.transitions.length);
    const vend = edges(VENDING, defaultPositions(names(VENDING)));
    const back = vend.filter((x) => x.to === 'Empty');
    expect(back.map((x) => x.from).sort()).toEqual(['Has10', 'Has5']);
    expect(vend.find((x) => x.from === 'Has10' && x.to === 'Empty')!.lines).toEqual(['10/1', '01/1']);
  });
  test('Moore arrows are labelled with the guard alone', () => {
    const e = edges(TRAFFIC_LIGHT, defaultPositions(names(TRAFFIC_LIGHT)));
    expect(e.map((x) => x.lines[0])).toEqual(['tick', 'tick', 'tick', 'tick']);
  });
  test('every path and label position is finite; arrows in both directions bend apart', () => {
    for (const p of PRESETS) {
      const pos = defaultPositions(names(p.fsm));
      for (const e of edges(p.fsm, pos)) {
        expect(e.d).not.toMatch(/NaN|Infinity/);
        expect(Number.isFinite(e.label.x + e.label.y)).toBe(true);
      }
    }
    const pos = { A: { x: 100, y: 100 }, B: { x: 300, y: 100 } };
    const f = { ...TRAFFIC_LIGHT, states: [{ name: 'A', out: '000' }, { name: 'B', out: '000' }], transitions: [{ from: 'A', to: 'B', when: '1' }, { from: 'B', to: 'A', when: '1' }] };
    const [ab, ba] = edges(f, pos);
    expect(ab!.label.y).not.toBeCloseTo(ba!.label.y, 0);
  });
  test('a self-loop points away from the middle', () => {
    const pos = defaultPositions(names(DETECTOR));
    const e = edges(DETECTOR, pos).find((x) => x.self && x.from === 'Idle')!;
    // Idle is at the top: its loop is above it.
    expect(e.label.y).toBeLessThan(pos.Idle!.y);
  });
});

describe('the view box', () => {
  test('it fits the drawing, inside the canvas, and contains every bubble', () => {
    for (const p of PRESETS) {
      const pos = defaultPositions(names(p.fsm));
      const es = edges(p.fsm, pos);
      const h = heightFor(p.fsm.states.length);
      const v = fitView(pos, es, h);
      expect(v.x).toBeGreaterThanOrEqual(0);
      expect(v.y).toBeGreaterThanOrEqual(0);
      expect(v.x + v.w).toBeLessThanOrEqual(W + 1e-9);
      expect(v.y + v.h).toBeLessThanOrEqual(h + 1e-9);
      for (const q of Object.values(pos)) {
        expect(q.x - R).toBeGreaterThanOrEqual(v.x);
        expect(q.x + R).toBeLessThanOrEqual(v.x + v.w);
        expect(q.y - R).toBeGreaterThanOrEqual(v.y);
        expect(q.y + R).toBeLessThanOrEqual(v.y + v.h);
      }
    }
  });
  test('a small machine is drawn larger than the whole canvas would be', () => {
    const pos = defaultPositions(names(VENDING));
    expect(fitView(pos, edges(VENDING, pos)).w).toBeLessThan(W);
  });
});
