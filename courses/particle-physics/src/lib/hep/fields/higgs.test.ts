import { describe, expect, test } from 'vitest';
import { particle } from '../particles/index.ts';
import { goldstoneMass2, hatDepth, hatU, HatBall, higgsMass, lambdaFromMass, M_HIGGS_GEV, massFromYukawa, muSquared, potential, radialMass2, V_EW_GEV, vevFromMu, yukawaCoupling } from './higgs.ts';
import { neutrinoBand, spectrumEntries, withYukawa, NEUTRINO_LIMIT_EV } from './spectrum.ts';

describe('the Mexican hat', () => {
  test('v from the Fermi constant is 246.22 GeV and the Higgs mass matches the particle table', () => {
    expect(V_EW_GEV).toBeCloseTo(246.22, 2);
    expect(M_HIGGS_GEV).toBe(particle(25).mass);
  });
  test('λ = m_H²/(2v²) ≈ 0.129 and μ = m_H/√2', () => {
    const lam = lambdaFromMass(125.2);
    expect(lam).toBeCloseTo(0.1291, 3);
    expect(lambdaFromMass(125.2, 246)).toBeCloseTo(0.1295, 3);
    expect(higgsMass(lam)).toBeCloseTo(125.2, 10);
    expect(Math.sqrt(muSquared(lam))).toBeCloseTo(125.2 / Math.SQRT2, 8);
    expect(Math.sqrt(muSquared(lam))).toBeCloseTo(88.5, 1);
  });
  test('the minimum is at |φ| = v/√2 and the curvatures are 2λv² radially, 0 round the brim', () => {
    const lam = 0.129;
    const mu2 = lam * V_EW_GEV ** 2;
    const rMin = V_EW_GEV / Math.SQRT2;
    const V = (x: number, y: number) => potential(x, y, mu2, lam);
    // minimum: derivative zero, value −μ⁴/(4λ)
    const h = 1e-3;
    expect(Math.abs((V(rMin + h, 0) - V(rMin - h, 0)) / (2 * h)) / (mu2 * rMin)).toBeLessThan(1e-8);
    expect(V(rMin, 0) / (-(mu2 * mu2) / (4 * lam))).toBeCloseTo(1, 12);
    // radial curvature in terms of the canonically normalised field h (φ = (v + h)/√2): d²V/dh² = 2λv²
    const Vh = (hh: number) => V((V_EW_GEV + hh) / Math.SQRT2, 0);
    const d2 = (Vh(h) - 2 * Vh(0) + Vh(-h)) / (h * h);
    expect(d2 / (2 * lam * V_EW_GEV ** 2)).toBeCloseTo(1, 4);
    expect(radialMass2(mu2, lam) / (2 * lam * V_EW_GEV ** 2)).toBeCloseTo(1, 10);
    // round the brim V does not change: the Goldstone mode is massless
    for (const ang of [0.3, 1, 2.5]) expect(V(rMin * Math.cos(ang), rMin * Math.sin(ang))).toBeCloseTo(V(rMin, 0), 6);
    expect(goldstoneMass2()).toBe(0);
    // the origin is a maximum
    expect(V(0, 0)).toBe(0);
    expect(V(0.1, 0)).toBeLessThan(0);
    expect(vevFromMu(mu2, lam)).toBeCloseTo(V_EW_GEV, 8);
    expect(vevFromMu(-1, lam)).toBe(0);
    expect(hatDepth(125.2) ** 0.25).toBeCloseTo(104.4, 0);
  });
  test('Yukawa coupling of the top is about 1, the electron about 3e−6', () => {
    expect(yukawaCoupling(particle(6).mass)).toBeCloseTo(0.9910, 3);
    expect(yukawaCoupling(particle(11).mass)).toBeCloseTo(2.935e-6, 9);
    expect(massFromYukawa(yukawaCoupling(1.7))).toBeCloseTo(1.7, 12);
  });
});

describe('the ball on the hat', () => {
  test('released near the top it rolls to the brim and settles at radius √s; the angle is where it happened to roll', () => {
    const b = new HatBall(0.02, 0.01, 1, 0.3);
    const a0 = b.angle;
    for (let i = 0; i < 40000; i++) b.step(0.01);
    expect(b.radius).toBeCloseTo(1, 3);
    expect(Math.hypot(b.vre, b.vim)).toBeLessThan(1e-6);
    expect(Math.abs(b.angle - a0)).toBeLessThan(0.05); // it rolled straight down from where it started
  });
  test('radial oscillations have frequency m_H (1 in these units), angular motion has none (Goldstone)', () => {
    const b = new HatBall(1, 0, 1, 0);
    b.kick(true, 0.02);
    let crossings = 0;
    let prev = b.radius - 1;
    let tFirst = 0;
    let tLast = 0;
    for (let i = 0; i < 20000; i++) {
      b.step(0.005);
      const d = b.radius - 1;
      if (prev < 0 && d >= 0) {
        crossings++;
        if (crossings === 1) tFirst = b.t;
        tLast = b.t;
      }
      prev = d;
    }
    const period = (tLast - tFirst) / (crossings - 1);
    expect(2 * Math.PI / period).toBeCloseTo(1, 2);
    // with s = 4 the mass is √s = 2 times larger
    const c = new HatBall(2, 0, 4, 0);
    c.kick(true, 0.02);
    let cross = 0, p2 = c.radius - 2, t1 = 0, t2 = 0;
    for (let i = 0; i < 20000; i++) {
      c.step(0.005);
      const d = c.radius - 2;
      if (p2 < 0 && d >= 0) { cross++; if (cross === 1) t1 = c.t; t2 = c.t; }
      p2 = d;
    }
    expect(2 * Math.PI / ((t2 - t1) / (cross - 1))).toBeCloseTo(2, 2);
    // a tangential kick: no restoring force, the ball just keeps going round at constant angular speed and radius
    const g = new HatBall(1, 0, 1, 0);
    g.kick(false, 0.05);
    for (let i = 0; i < 4000; i++) g.step(0.005);
    expect(g.radius).toBeCloseTo(1, 2);
    expect(g.angle).not.toBeCloseTo(0, 1);
  });
  test('the energy is conserved without friction', () => {
    const b = new HatBall(0.3, 0.2, 1, 0);
    const e0 = b.energy();
    for (let i = 0; i < 20000; i++) b.step(0.005);
    expect(Math.abs(b.energy() / e0 - 1)).toBeLessThan(1e-4);
  });
  test('with s < 0 the hat is a bowl: the ball settles at the centre', () => {
    const b = new HatBall(1.2, -0.4, -0.5, 0.3);
    for (let i = 0; i < 40000; i++) b.step(0.01);
    expect(b.radius).toBeLessThan(1e-4);
    expect(hatU(1, 0, -0.5)).toBeGreaterThan(hatU(0, 0, -0.5));
  });
});

describe('the mass spectrum', () => {
  test('entries come from the particle table, sorted, and span about 6 decades without neutrinos', () => {
    const e = spectrumEntries();
    expect(e.length).toBe(12);
    for (let i = 1; i < e.length; i++) expect(e[i]!.mass).toBeGreaterThanOrEqual(e[i - 1]!.mass);
    expect(e[0]!.id).toBe('e-');
    expect(e.at(-1)!.id).toBe('t');
    expect(e.find((x) => x.id === 'e-')!.mass).toBe(particle(11).mass);
    const y = withYukawa(e);
    expect(y.find((x) => x.id === 't')!.y).toBeCloseTo(0.991, 3);
  });
  test('the neutrino band lies far below the electron', () => {
    const n = neutrinoBand();
    expect(n.upper).toBeCloseTo(NEUTRINO_LIMIT_EV * 1e-9, 20);
    expect(n.lower).toBeLessThan(n.upper);
    expect(n.upper).toBeLessThan(particle(11).mass / 1e5);
  });
});
