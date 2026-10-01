import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { defaultKG, fitVelocity, groupVelocityLattice, KGChain, KGSheet, measureDispersion, omegaContinuum, omegaLattice, omegaNumerical, particleVelocity } from './lattice.ts';

describe('leapfrog energy conservation', () => {
  test('free field: energy oscillates at O(dt²) and does not drift over 100,000 steps', () => {
    const ch = new KGChain(defaultKG({ m: 0.4, dt: 0.1 }));
    ch.addPacket(60, 6, 0.8, 1);
    ch.pluck(180, 3, 0.5);
    const E0 = ch.energy();
    let maxDev = 0;
    let firstHalf = 0, secondHalf = 0;
    const N = 100_000;
    for (let s = 0; s < N; s++) {
      ch.step();
      if (s % 50 === 0) {
        const d = Math.abs(ch.energy() / E0 - 1);
        maxDev = Math.max(maxDev, d);
        if (s < N / 2) firstHalf = Math.max(firstHalf, d);
        else secondHalf = Math.max(secondHalf, d);
      }
    }
    expect(maxDev).toBeLessThan(2e-3);
    // no secular growth: the second half wobbles no more than the first (+ a small margin)
    expect(secondHalf).toBeLessThan(firstHalf * 1.2 + 1e-6);
  });
  test('nonlinear (φ⁴) field: still no drift', () => {
    const ch = new KGChain(defaultKG({ m: 0.2, lambda: 1, dt: 0.05 }));
    ch.addPacket(70, 6, 0.6, 1);
    ch.addPacket(190, 6, -0.6, 1);
    const E0 = ch.energy();
    let maxDev = 0;
    for (let s = 0; s < 60_000; s++) {
      ch.step();
      if (s % 100 === 0) maxDev = Math.max(maxDev, Math.abs(ch.energy() / E0 - 1));
    }
    expect(maxDev).toBeLessThan(2e-3);
  });
  test('halving dt reduces the energy error by about four (second order)', () => {
    const dev = (dt: number) => {
      const ch = new KGChain(defaultKG({ m: 0.3, dt }));
      ch.addPacket(100, 5, 0.3, 1);
      const E0 = ch.energy();
      let worst = 0;
      const T = 200;
      for (let s = 0; s < T / dt; s++) {
        ch.step();
        worst = Math.max(worst, Math.abs(ch.energy() / E0 - 1));
      }
      return worst;
    };
    const r = dev(0.2) / dev(0.1);
    expect(r).toBeGreaterThan(3);
    expect(r).toBeLessThan(5);
  });
});

describe('dispersion relation', () => {
  test('theory curves: massless lattice field has ω = 2 sin(k/2), continuum ω = k', () => {
    expect(omegaLattice(0.1, 0)).toBeCloseTo(0.1, 3);
    expect(omegaLattice(Math.PI, 0)).toBeCloseTo(2, 12);
    expect(omegaContinuum(3, 4)).toBe(5);
    expect(particleVelocity(3, 4)).toBeCloseTo(0.6, 12);
  });
  for (const m of [0, 0.3, 1]) {
    test(`measured ω(k) recovers the theory for m = ${m}`, () => {
      const p = defaultKG({ m, dt: 0.25 });
      const d = measureDispersion(p, rng(7), 512, 4);
      let checked = 0;
      let worst = 0;
      for (let j = 4; j < d.nk - 1; j++) {
        const th = omegaNumerical(d.k[j]!, p);
        const err = Math.abs(d.omega[j]! - th);
        worst = Math.max(worst, err);
        checked++;
      }
      expect(checked).toBeGreaterThan(100);
      // frequency resolution is 2π/(512·1) = 0.0123
      expect(worst).toBeLessThan(0.02);
    });
  }
  test('with m > 0 the measured ω(k→0) is m (a gap), with m = 0 it goes to 0', () => {
    const d1 = measureDispersion(defaultKG({ m: 0.8, dt: 0.25 }), rng(3), 512, 4);
    expect(d1.omega[1]).toBeGreaterThan(0.75);
    expect(d1.omega[1]).toBeLessThan(0.85);
    const d0 = measureDispersion(defaultKG({ m: 0, dt: 0.25 }), rng(3), 512, 4);
    expect(d0.omega[2]).toBeLessThan(0.1);
  });
});

describe('packets are relativistic particles', () => {
  for (const [m, k] of [[0, 0.5], [0.5, 0.5], [0.5, 1.0], [1.0, 0.3]] as const) {
    test(`group velocity of a packet with m = ${m}, p = ${k} is p/E (lattice-corrected)`, () => {
      const ch = new KGChain(defaultKG({ m, dt: 0.1 }));
      ch.addPacket(50, 10, k, 0.3);
      const ts: number[] = [];
      const xs: number[] = [];
      for (let s = 0; s < 1000; s++) {
        ch.step();
        if (s % 10 === 0) {
          ts.push(ch.t);
          xs.push(ch.centroid().x);
        }
      }
      const v = fitVelocity(ts, xs, ch.n, 100);
      const vLat = groupVelocityLattice(k, m);
      expect(v).toBeGreaterThan(0);
      expect(Math.abs(v - vLat)).toBeLessThan(0.02);
      // and the continuum particle formula v = p/E is close for k well below the lattice scale 2π/a
      if (k <= 0.5) expect(Math.abs(v - particleVelocity(k, m))).toBeLessThan(0.04);
    });
  }
  test('a packet moves to the left for negative k', () => {
    const ch = new KGChain(defaultKG({ m: 0.3 }));
    ch.addPacket(128, 8, -0.7, 0.3);
    const x0 = ch.centroid().x;
    ch.run(300);
    expect(ch.centroid().x).toBeLessThan(x0 - 10);
  });
});

describe('modes and the free field', () => {
  test('each mode energy is conserved for λ = 0 and the sum is the total energy', () => {
    const ch = new KGChain(defaultKG({ m: 0.5, dt: 0.1 }));
    ch.addNoise(rng(5), 0.05, 0.05);
    const a = ch.modeEnergies();
    const sum = (e: Float64Array) => e.reduce((s, v) => s + v, 0);
    expect(sum(a.E) / ch.energy()).toBeCloseTo(1, 2); // the lattice energy, with the gradient term, to leading order
    ch.run(2000);
    const b = ch.modeEnergies();
    for (let j = 1; j < 100; j += 9) expect(Math.abs(b.E[j]! / a.E[j]! - 1)).toBeLessThan(0.02);
  });
  test('with λ > 0 the modes exchange energy', () => {
    const ch = new KGChain(defaultKG({ m: 0.5, lambda: 2, dt: 0.1 }));
    ch.addPacket(128, 10, 0.8, 1);
    const a = ch.modeEnergies();
    ch.run(3000);
    const b = ch.modeEnergies();
    let moved = 0;
    let tot = 0;
    for (let j = 0; j < a.E.length; j++) {
      moved += Math.abs(b.E[j]! - a.E[j]!);
      tot += a.E[j]!;
    }
    expect(moved / tot).toBeGreaterThan(0.05);
  });
  test('2D sheet conserves energy', () => {
    const s = new KGSheet(64, 0.3, 1, 0, 0.2);
    s.pluck(32, 32, 3, 1);
    const E0 = s.energy();
    let dev = 0;
    for (let i = 0; i < 2000; i++) {
      s.step();
      if (i % 20 === 0) dev = Math.max(dev, Math.abs(s.energy() / E0 - 1));
    }
    expect(dev).toBeLessThan(5e-3);
  });
  test('an unstable time step is refused', () => {
    expect(() => new KGChain(defaultKG({ dt: 2.5 }))).toThrow();
  });
});
