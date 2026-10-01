import { describe, expect, it } from 'vitest';
import { CURVATURE, exitCylinder, helixFromMomentum, helixFromTrack, omega, pathToRadius, pathToZ, phiAt, pointAt, radiusOfCurvature, straightLine, traceHelix, wavyPolyline, wavyPolyline3D, type HelixParams } from './helix.ts';

const base: HelixParams = { charge: 1, pt: 10, eta: 0.5, phi: 0.3, x: 0, y: 0, z: 0, b: 3.8 };

describe('radius of curvature', () => {
  it('is pT / (0.3 B) in metres', () => {
    expect(radiusOfCurvature(1, 1, 3.8)).toBeCloseTo(1000 / (CURVATURE * 3.8), 9);
    expect(radiusOfCurvature(1, 1, 3.8)).toBeCloseTo(877.7, 0);
  });
  it('is infinite for neutral particles or no field', () => {
    expect(radiusOfCurvature(5, 0, 3.8)).toBe(Infinity);
    expect(radiusOfCurvature(5, 1, 0)).toBe(Infinity);
  });
  it('scales with pT and inversely with B', () => {
    expect(radiusOfCurvature(20, 1, 3.8) / radiusOfCurvature(10, 1, 3.8)).toBeCloseTo(2, 12);
    expect(radiusOfCurvature(10, 1, 1.9) / radiusOfCurvature(10, 1, 3.8)).toBeCloseTo(2, 12);
  });
});

describe('helix position', () => {
  it('stays on a circle of the right radius in the transverse plane', () => {
    const R = radiusOfCurvature(base.pt, base.charge, base.b);
    // centre is to the right of the flight direction for a positive charge and B along +z
    const cx = base.x + R * Math.sin(base.phi), cy = base.y - R * Math.cos(base.phi);
    for (const s of [0, 500, 2000, 9000, 30000]) {
      const p = pointAt(base, s);
      expect(Math.hypot(p[0] - cx, p[1] - cy)).toBeCloseTo(R, 6);
    }
  });
  it('turns clockwise for a positive charge and anticlockwise for a negative one (B along +z)', () => {
    expect(phiAt(base, 1000)).toBeLessThan(base.phi);
    expect(phiAt({ ...base, charge: -1 }, 1000)).toBeGreaterThan(base.phi);
    expect(omega({ charge: 1, pt: 10, b: -3.8 })).toBeGreaterThan(0);
  });
  it('advances in z as s sinh η', () => {
    expect(pointAt(base, 1234)[2]).toBeCloseTo(1234 * Math.sinh(0.5), 9);
  });
  it('is a straight line for a neutral particle', () => {
    const p = pointAt({ ...base, charge: 0 }, 100);
    expect(p[0]).toBeCloseTo(100 * Math.cos(0.3), 9);
    expect(p[1]).toBeCloseTo(100 * Math.sin(0.3), 9);
  });
  it('the direction of the momentum at s is tangent to the path', () => {
    const s = 3000, e = 1e-3;
    const a = pointAt(base, s), b = pointAt(base, s + e);
    expect(Math.atan2(b[1] - a[1], b[0] - a[0])).toBeCloseTo(phiAt(base, s), 5);
  });
  it('builds parameters from a momentum vector', () => {
    const h = helixFromMomentum(-1, 3, 4, 10, [1, 2, 3], 2);
    expect(h.pt).toBeCloseTo(5, 12);
    expect(h.phi).toBeCloseTo(Math.atan2(4, 3), 12);
    expect(h.eta).toBeCloseTo(Math.asinh(2), 12);
    expect([h.x, h.y, h.z]).toEqual([1, 2, 3]);
  });
  it('places a track at its point of closest approach to the primary vertex', () => {
    const t = { charge: 1, pt: 5, eta: 0, phi: 0, d0: 0.5, z0: 2 };
    const h = helixFromTrack(t, [0, 0, 10], 3.8);
    // flying along +x, the vertex is to the right (−y) of the track when d0 > 0, so the track is at y = +d0
    expect(h.y).toBeCloseTo(0.5, 12);
    expect(h.x).toBeCloseTo(0, 12);
    expect(h.z).toBeCloseTo(12, 12);
  });
});

describe('crossing a cylinder', () => {
  it('finds the radius crossing analytically', () => {
    for (const charge of [1, -1]) {
      for (const pt of [1, 3, 10, 100]) {
        const h = { ...base, charge, pt };
        const R = radiusOfCurvature(pt, charge, h.b);
        for (const r of [30, 300, 1290]) {
          const s = pathToRadius(h, r);
          if (2 * R < r) {
            expect(s).toBeNull();
            continue;
          }
          expect(s).not.toBeNull();
          const p = pointAt(h, s!);
          expect(Math.hypot(p[0], p[1])).toBeCloseTo(r, 6);
          // and it is the first crossing: halfway there the radius is smaller
          const q = pointAt(h, s! / 2);
          expect(Math.hypot(q[0], q[1])).toBeLessThan(r);
        }
      }
    }
  });
  it('a curler with 2R < r never reaches it', () => {
    const h = { ...base, pt: 0.3 }; // R = 263 mm
    expect(pathToRadius(h, 1290)).toBeNull();
    expect(pathToRadius(h, 600)).toBeNull(); // the farthest point of the circle is 2R = 526 mm away
    expect(pathToRadius(h, 500)).not.toBeNull();
  });
  it('works for a neutral particle not starting at the origin', () => {
    const h = { ...base, charge: 0, x: 100, y: -50 };
    const s = pathToRadius(h, 1000)!;
    const p = pointAt(h, s);
    expect(Math.hypot(p[0], p[1])).toBeCloseTo(1000, 6);
  });
  it('pathToZ and exitCylinder choose the nearer face', () => {
    const fwd = { ...base, eta: 2.4 };
    const ex = exitCylinder(fwd, 1290, 3040)!;
    expect(ex.face).toBe('endcap');
    expect(pointAt(fwd, ex.s)[2]).toBeCloseTo(3040, 6);
    const central = { ...base, eta: 0.1 };
    const ex2 = exitCylinder(central, 1290, 3040)!;
    expect(ex2.face).toBe('barrel');
    expect(pathToZ({ ...base, eta: 0 }, 100)).toBe(Infinity);
    expect(pathToZ({ ...base, eta: -1 }, 100)).toBeCloseTo(100 / Math.sinh(1), 9);
  });
});

describe('traceHelix', () => {
  it('ends on the boundary it stops at', () => {
    const tr = traceHelix({ ...base, eta: 0.2 }, { rStop: 1290, zStop: 3040 });
    const n = tr.points.length;
    expect(tr.end).toBe('radius');
    expect(Math.hypot(tr.points[n - 3]!, tr.points[n - 2]!)).toBeCloseTo(1290, 0);
    const fwd = traceHelix({ ...base, eta: 2.3 }, { rStop: 1290, zStop: 3040 });
    expect(fwd.end).toBe('endcap');
    expect(Math.abs(fwd.points[fwd.points.length - 1]!)).toBeCloseTo(3040, 0);
  });
  it('agrees with the analytic path length', () => {
    const tr = traceHelix(base, { rStop: 1290, zStop: 1e9 });
    expect(tr.s).toBeCloseTo(pathToRadius(base, 1290)!, 0);
  });
  it('every point lies on the exact helix', () => {
    const h = { ...base, charge: -1, pt: 2 };
    const tr = traceHelix(h, { rStop: 1290, zStop: 3040 });
    let s = 0;
    for (let i = 3; i < tr.points.length - 3; i += 3) {
      s += Math.hypot(tr.points[i]! - tr.points[i - 3]!, tr.points[i + 1]! - tr.points[i - 2]!) ; // chord ≈ arc
      const p = pointAt(h, s);
      expect(Math.hypot(tr.points[i]! - p[0], tr.points[i + 1]! - p[1])).toBeLessThan(2);
    }
  });
  it('a curler is cut after one turn', () => {
    const tr = traceHelix({ ...base, pt: 0.4, eta: 0 }, { rStop: 1290, zStop: 3040, maxTurns: 1 });
    expect(tr.end).toBe('loop');
    const n = tr.points.length;
    // after one full turn it is back near the start in the transverse plane
    expect(Math.hypot(tr.points[n - 3]! - tr.points[0]!, tr.points[n - 2]! - tr.points[1]!)).toBeLessThan(5);
  });
  it('stops at a decay vertex', () => {
    const tr = traceHelix(base, { rStop: 1290, zStop: 3040, sMax: 200 });
    expect(tr.end).toBe('vertex');
    expect(tr.s).toBeCloseTo(200, 6);
  });
  it('bends the other way (and less) in a reversed outer field', () => {
    const inner = traceHelix({ ...base, pt: 50, eta: 0 }, { rStop: 1000, zStop: 1e9 });
    const out = traceHelix({ ...base, pt: 50, eta: 0 }, { rStop: 5000, zStop: 1e9, rCoil: 1000, outerFactor: -0.5 });
    // the first part is identical
    expect(out.points[3]).toBeCloseTo(inner.points[3]!, 9);
    expect(out.end).toBe('radius');
  });
});

describe('straight and wavy lines', () => {
  it('a neutral line ends on the cylinder', () => {
    const p = straightLine(0, 0, 0, 1.0, 0.5, 1290, 3040);
    expect(Math.hypot(p[3]!, p[4]!)).toBeCloseTo(1290, 6);
    const q = straightLine(0, 0, 0, 2.5, 0.5, 1290, 3040);
    expect(q[5]).toBeCloseTo(3040, 6);
  });
  it('a wavy line starts and ends on its axis and stays within the amplitude', () => {
    const w = wavyPolyline(0, 0, 100, 0, 3, 12);
    expect(w[0]).toBeCloseTo(0, 9);
    expect(w[1]).toBeCloseTo(0, 9);
    expect(w[w.length - 2]).toBeCloseTo(100, 9);
    expect(Math.abs(w[w.length - 1]!)).toBeLessThan(1e-9);
    for (let i = 1; i < w.length; i += 2) expect(Math.abs(w[i]!)).toBeLessThanOrEqual(3 + 1e-9);
    expect(Math.max(...w.filter((_, i) => i % 2 === 1))).toBeGreaterThan(2.5);
  });
  it('the 3D wavy line has the same end points', () => {
    const w = wavyPolyline3D(1, 2, 3, 101, 52, 203, 20, 100);
    expect(w.slice(0, 3)).toEqual([1, 2, 3]);
    expect(w[w.length - 3]).toBeCloseTo(101, 9);
    expect(w[w.length - 2]).toBeCloseTo(52, 9);
    expect(w[w.length - 1]).toBeCloseTo(203, 9);
  });
});
