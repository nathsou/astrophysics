/**
 * The optimisers of Chapter 13 on two-parameter problems, written out plainly so the widgets can
 * show their trajectories. Each keeps its own state and updates p in place from a gradient g.
 */
export type Vec = [number, number];

export interface Optimiser {
  name: string;
  step(p: Vec, g: Vec, lr: number): void;
}

export const sgd = (): Optimiser => ({
  name: 'SGD',
  step(p, g, lr) {
    p[0] -= lr * g[0];
    p[1] -= lr * g[1];
  },
});

/** Heavy-ball momentum: v ← βv + g; p ← p − lr·v. */
export const momentum = (beta = 0.9): Optimiser => {
  const v: Vec = [0, 0];
  return {
    name: 'Momentum',
    step(p, g, lr) {
      for (let i = 0; i < 2; i++) {
        v[i] = beta * v[i]! + g[i]!;
        p[i]! -= lr * v[i]!;
      }
    },
  };
};

/** RMSProp: divide each coordinate by a running root-mean-square of its gradients. */
export const rmsprop = (beta = 0.99, eps = 1e-8): Optimiser => {
  const s: Vec = [0, 0];
  return {
    name: 'RMSProp',
    step(p, g, lr) {
      for (let i = 0; i < 2; i++) {
        s[i] = beta * s[i]! + (1 - beta) * g[i]! ** 2;
        p[i]! -= (lr * g[i]!) / (Math.sqrt(s[i]!) + eps);
      }
    },
  };
};

/** Adam: momentum on the gradient, RMSProp on its scale, both bias-corrected. */
export const adam = (b1 = 0.9, b2 = 0.999, eps = 1e-8): Optimiser => {
  const m: Vec = [0, 0], v: Vec = [0, 0];
  let t = 0;
  return {
    name: 'Adam',
    step(p, g, lr) {
      t++;
      for (let i = 0; i < 2; i++) {
        m[i] = b1 * m[i]! + (1 - b1) * g[i]!;
        v[i] = b2 * v[i]! + (1 - b2) * g[i]! ** 2;
        const mh = m[i]! / (1 - b1 ** t), vh = v[i]! / (1 - b2 ** t);
        p[i]! -= (lr * mh) / (Math.sqrt(vh) + eps);
      }
    },
  };
};

export interface Surface {
  label: string;
  f: (x: number, y: number) => number;
  grad: (x: number, y: number) => Vec;
  start: Vec;
  view: { x: [number, number]; y: [number, number] };
  minimum: Vec;
  /** A sensible default learning rate for each optimiser on this surface. */
  lr: Record<string, number>;
}

export const SURFACES: Record<string, Surface> = {
  valley: {
    label: 'Narrow valley (ill-conditioned)',
    f: (x, y) => 0.5 * (x * x + 25 * y * y),
    grad: (x, y) => [x, 25 * y],
    start: [-4.5, 1.2],
    view: { x: [-5, 5], y: [-2, 2] },
    minimum: [0, 0],
    lr: { SGD: 0.07, Momentum: 0.006, RMSProp: 0.05, Adam: 0.15 },
  },
  rosenbrock: {
    label: 'Rosenbrock banana',
    f: (x, y) => (1 - x) ** 2 + 10 * (y - x * x) ** 2,
    grad: (x, y) => [-2 * (1 - x) - 40 * x * (y - x * x), 20 * (y - x * x)],
    start: [-1.5, 2],
    view: { x: [-2, 2], y: [-1, 3] },
    minimum: [1, 1],
    lr: { SGD: 0.008, Momentum: 0.002, RMSProp: 0.01, Adam: 0.05 },
  },
  saddle: {
    label: 'Saddle point',
    f: (x, y) => x * x - y * y + 0.1 * y ** 4,
    grad: (x, y) => [2 * x, -2 * y + 0.4 * y ** 3],
    start: [-2.5, 0.01],
    view: { x: [-3, 3], y: [-3, 3] },
    minimum: [0, Math.sqrt(5)],
    lr: { SGD: 0.05, Momentum: 0.02, RMSProp: 0.02, Adam: 0.05 },
  },
};

/** Run an optimiser for `steps` steps from the surface's start; returns the path. */
export function trajectory(surface: Surface, opt: Optimiser, lr: number, steps: number, noise = 0, rng: () => number = Math.random): Vec[] {
  const p: Vec = [...surface.start];
  const path: Vec[] = [[p[0], p[1]]];
  for (let i = 0; i < steps; i++) {
    const g = surface.grad(p[0], p[1]);
    if (noise) {
      g[0] += noise * (rng() * 2 - 1);
      g[1] += noise * (rng() * 2 - 1);
    }
    opt.step(p, g, lr);
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 1e6) break;
    path.push([p[0], p[1]]);
  }
  return path;
}
