import { describe, expect, it } from 'vitest';
import { Tensor, noGrad } from './tensor.ts';
import { broadcastShapes } from './shape.ts';
import { Linear, SGD, crossEntropy } from './nn.ts';
import { mulberry32 } from '../util/random.ts';

describe('storage, strides and views', () => {
  const t = Tensor.arange(12).reshape(3, 4);

  it('computes row-major strides', () => {
    expect(t.strides).toEqual([4, 1]);
    expect(t.get(2, 1)).toBe(9);
  });

  it('transposes without copying', () => {
    const tt = t.T;
    expect(tt.storage).toBe(t.storage);
    expect(tt.strides).toEqual([1, 4]);
    expect(tt.isContiguous()).toBe(false);
    expect(tt.get(1, 2)).toBe(9);
  });

  it('slices are views that share storage', () => {
    const s = t.slice(1, 1, 3);
    expect(s.shape).toEqual([3, 2]);
    s.set(100, 0, 0);
    expect(t.get(0, 1)).toBe(100);
    t.set(1, 0, 1);
  });

  it('expand uses stride 0', () => {
    const e = Tensor.from([1, 2, 3], [1, 3]).expand(4, 3);
    expect(e.strides).toEqual([0, 1]);
    expect(e.toArray()).toEqual([[1, 2, 3], [1, 2, 3], [1, 2, 3], [1, 2, 3]]);
  });

  it('reshape of a non-contiguous tensor copies correctly', () => {
    expect(t.T.reshape(12).toArray()).toEqual([0, 4, 8, 1, 5, 9, 2, 6, 10, 3, 7, 11]);
  });

  it('broadcasts shapes like NumPy', () => {
    expect(broadcastShapes([3, 1, 4], [2, 4])).toEqual([3, 2, 4]);
    expect(() => broadcastShapes([3], [4])).toThrow('cannot be broadcast');
  });

  it('builds tensors from nested arrays and rejects ragged ones', () => {
    expect(Tensor.from([[1, 2], [3, 4]]).shape).toEqual([2, 2]);
    expect(() => Tensor.from([[1, 2], [3]])).toThrow();
  });
});

describe('autograd mechanics', () => {
  it('accumulates gradients when a tensor is used twice', () => {
    const x = Tensor.from([3], [1], { requiresGrad: true });
    x.mul(x).add(x).sum().backward(); // d/dx (x² + x) = 2x + 1
    expect(x.grad!.item()).toBeCloseTo(7);
  });

  it('accumulates across backward calls until zeroGrad', () => {
    const x = Tensor.from([2], [1], { requiresGrad: true });
    x.mul(3).sum().backward();
    x.mul(3).sum().backward();
    expect(x.grad!.item()).toBeCloseTo(6);
    x.zeroGrad();
    expect(x.grad).toBeNull();
  });

  it('records nothing under noGrad', () => {
    const x = Tensor.from([1, 2], [2], { requiresGrad: true });
    const y = noGrad(() => x.mul(2));
    expect(y.requiresGrad).toBe(false);
    expect(y.node).toBeNull();
  });

  it('retains intermediate gradients on request', () => {
    const x = Tensor.from([1, 2], [2], { requiresGrad: true });
    const h = x.mul(2).retainGrad();
    h.pow(2).sum().backward();
    expect(h.grad!.toArray()).toEqual([4, 8]);
  });

  it('agrees with finite differences on a composite function', () => {
    const rng = mulberry32(3);
    const x = Tensor.randn([4, 3], { rng, requiresGrad: true });
    const w = Tensor.randn([3, 5], { rng, requiresGrad: true });
    const f = () => x.matmul(w).tanh().softmax(-1).mul(Tensor.arange(5)).sum().log();
    f().backward();
    const eps = 1e-2;
    for (const p of [x, w]) {
      for (let i = 0; i < p.size; i++) {
        const orig = p.storage[i]!;
        p.storage[i] = orig + eps;
        const up = noGrad(f).item();
        p.storage[i] = orig - eps;
        const down = noGrad(f).item();
        p.storage[i] = orig;
        expect(p.grad!.storage[i]!).toBeCloseTo((up - down) / (2 * eps), 3);
      }
    }
  });
});

describe('training', () => {
  it('fits a tiny classification problem with SGD', () => {
    const rng = mulberry32(9);
    const layer = new Linear(2, 2, { rng });
    const opt = new SGD(layer.parameters(), { lr: 0.5 });
    const X = Tensor.from([[1, 0], [0, 1], [1, 1], [0, 0]]);
    const y = [0, 1, 0, 1];
    let first = 0, last = 0;
    for (let step = 0; step < 200; step++) {
      opt.zeroGrad();
      const loss = crossEntropy(layer.forward(X), y);
      loss.backward();
      opt.step();
      if (step === 0) first = loss.item();
      last = loss.item();
    }
    expect(last).toBeLessThan(first / 5);
  });
});

describe('cat and stack', () => {
  it('concatenates along a dimension and routes gradients back', async () => {
    const { cat, stack } = await import('./tensor.ts');
    const a = Tensor.from([[1, 2], [3, 4]], undefined, { requiresGrad: true });
    const b = Tensor.from([[5, 6]], undefined, { requiresGrad: true });
    const c = cat([a, b], 0);
    expect(c.shape).toEqual([3, 2]);
    expect(c.toArray()).toEqual([[1, 2], [3, 4], [5, 6]]);
    c.mul(Tensor.from([[1, 2], [3, 4], [5, 6]])).sum().backward();
    expect(a.grad!.toArray()).toEqual([[1, 2], [3, 4]]);
    expect(b.grad!.toArray()).toEqual([[5, 6]]);
    expect(cat([a.T, a.T], 1).toArray()).toEqual([[1, 3, 1, 3], [2, 4, 2, 4]]);
    expect(stack([Tensor.from([1, 2]), Tensor.from([3, 4])], 1).toArray()).toEqual([[1, 3], [2, 4]]);
  });
});
