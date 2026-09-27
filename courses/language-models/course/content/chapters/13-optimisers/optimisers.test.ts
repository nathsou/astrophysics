import { describe, expect, it } from 'vitest';
import { SURFACES, adam, momentum, rmsprop, sgd, trajectory } from './optimisers.ts';

describe('2-D optimisers', () => {
  it('each reaches the valley minimum with its default learning rate', () => {
    const s = SURFACES.valley!;
    for (const make of [sgd, momentum, rmsprop, adam]) {
      const opt = make();
      const path = trajectory(s, opt, s.lr[opt.name]!, 400);
      const [x, y] = path.at(-1)!;
      expect(Math.hypot(x, y)).toBeLessThan(0.05);
    }
  });

  it('SGD diverges on the valley when lr exceeds 2/λmax = 0.08', () => {
    const s = SURFACES.valley!;
    const path = trajectory(s, sgd(), 0.085, 200);
    expect(Math.abs(path.at(-1)![1])).toBeGreaterThan(1);
  });

  it('Adam’s first step moves every coordinate by about lr, whatever its gradient', () => {
    const p: [number, number] = [0, 0];
    adam().step(p, [1000, 0.001], 0.1);
    expect(p[0]).toBeCloseTo(-0.1, 3);
    expect(p[1]).toBeCloseTo(-0.1, 3);
  });
});
