// Random configurations of a figure, for the tests and for the workshop's checker: every free point
// is moved by a random amount, gliders slide a little, and parameters take random values in range.

import { evaluate, type FigureDef, type FigureState, type Scene } from './figure';
import { Degenerate, dist } from './vec';

/** A small deterministic PRNG (mulberry32), so failures can be reproduced. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sizeOf(scene: Scene): number {
  const ps = [...scene.points.values()].map((p) => p.p);
  let d = 0;
  for (const a of ps) for (const b of ps) d = Math.max(d, dist(a, b));
  return d || 1;
}

export interface Trial {
  state: FigureState;
  scene: Scene;
}

/** Up to `n` valid random configurations (degenerate ones are skipped). */
export function trials(def: FigureDef, n: number, seed = 1): { ok: Trial[]; degenerate: number } {
  const base = evaluate(def);
  const size = sizeOf(base);
  const r = rng(seed);
  const jitter = (def.jitter ?? 0.08) * size;
  const ok: Trial[] = [];
  let degenerate = 0;
  for (let i = 0; i < n * 4 && ok.length < n; i++) {
    const state: FigureState = { free: {}, glide: {}, param: {} };
    for (const p of base.points.values()) {
      if (p.kind === 'free') state.free[p.name] = { x: p.p.x + (r() * 2 - 1) * jitter, y: p.p.y + (r() * 2 - 1) * jitter, ...(p.p.z === undefined ? {} : { z: p.p.z }) };
    }
    for (const prm of base.params) {
      const steps = Math.round((prm.max - prm.min) / prm.step);
      state.param[prm.name] = prm.min + Math.round(r() * steps) * prm.step;
    }
    // gliders: nudge their parameter around its default by evaluating once with defaults
    const defaults = gliderDefaults(def);
    for (const [name, t] of Object.entries(defaults)) state.glide[name] = t.circle ? t.t + (r() * 2 - 1) * 0.25 : Math.max(0.02, Math.min(0.98, t.t + (r() * 2 - 1) * 0.15));
    try {
      ok.push({ state, scene: evaluate(def, state) });
    } catch (e) {
      if (e instanceof Degenerate) degenerate++;
      else throw e;
    }
  }
  return { ok, degenerate };
}

/** The default parameter of each glider, found by recording the calls of a default evaluation. */
function gliderDefaults(def: FigureDef): Record<string, { t: number; circle: boolean }> {
  const out: Record<string, { t: number; circle: boolean }> = {};
  const probe = {
    ...def,
    build: (g: Parameters<FigureDef['build']>[0]) => {
      const orig = g.glider.bind(g);
      g.glider = ((name, on, t, o) => {
        out[name] = { t, circle: !Array.isArray(on) };
        return orig(name, on, t, o);
      }) as typeof g.glider;
      def.build(g);
    },
  };
  evaluate(probe);
  return out;
}
