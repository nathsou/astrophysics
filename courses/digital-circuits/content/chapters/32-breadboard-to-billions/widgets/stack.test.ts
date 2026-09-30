import { describe, expect, test } from 'vitest';
import { PARTS } from '$content/outline';
import { LAYERS, magnitude } from './stack';

const slugs = new Set(PARTS.flatMap((p) => p.chapters.map((c) => c.slug)));

describe('the whole stack', () => {
  test('every layer links to real chapters, and the chapters run in order up the stack', () => {
    const order = PARTS.flatMap((p) => p.chapters.map((c) => c.slug));
    let last = -1;
    for (const l of LAYERS) {
      expect(l.chapters.length, l.id).toBeGreaterThan(0);
      for (const c of l.chapters) expect(slugs.has(c), `${l.id}: ${c}`).toBe(true);
      // Up to the CPU the layers run in the order of the book; the hardware language (Ch 29) sits above the FPGA it targets.
      if (['battery', 'switch', 'transistor', 'gate', 'adder', 'register', 'datapath', 'cpu'].includes(l.id)) {
        const first = order.indexOf(l.chapters[0]!);
        expect(first, l.id).toBeGreaterThanOrEqual(last);
        last = first;
      }
    }
  });
  test('the layers are those of the brief, bottom to top', () => {
    expect(LAYERS.map((l) => l.id)).toEqual(['battery', 'switch', 'transistor', 'gate', 'adder', 'register', 'datapath', 'cpu', 'hdl', 'fpga', 'chip']);
  });
  test('transistor counts follow the course’s cost model and only ever grow', () => {
    const t = (id: string) => LAYERS.find((l) => l.id === id)!.transistors;
    expect(t('transistor')).toBe(2);
    expect(t('gate')).toBe(4);
    expect(t('adder')).toBe(28);
    expect(t('register')).toBe(208);
    expect(t('cpu')).toBe(24856);
    expect(t('datapath')).toBeLessThan(t('cpu')!);
    let prev = 0;
    for (const l of LAYERS) {
      if (l.transistors === undefined) continue;
      expect(l.transistors, l.id).toBeGreaterThanOrEqual(prev);
      prev = l.transistors;
    }
    expect(Math.log10(134e9 / 24856)).toBeCloseTo(6.73, 1);
  });
  test('magnitude', () => {
    expect(magnitude(LAYERS.find((l) => l.id === 'battery')!)).toBeUndefined();
    expect(magnitude(LAYERS.find((l) => l.id === 'chip')!)).toBeCloseTo(11.13, 1);
  });
});
