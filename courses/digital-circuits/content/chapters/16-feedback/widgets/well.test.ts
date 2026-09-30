import { describe, expect, test } from 'vitest';
import { TILT_LIMIT, landscape, potential, release, rest, step, wobble, type Ball, type Pushes } from './well';

const none: Pushes = { s: false, r: false };
const run = (b: Ball, p: Pushes, seconds: number, metastable = false, t0 = 0) => {
  for (let t = 0; t < seconds; t += 1 / 60) step(b, p, 1 / 60, { metastable, t: t0 + t });
};

describe('the landscape', () => {
  test('two valleys at ±1 and a hump at 0', () => {
    expect(potential(1, 1, 0)).toBeCloseTo(-0.25, 9);
    expect(potential(-1, 1, 0)).toBeCloseTo(-0.25, 9);
    expect(potential(0, 1, 0)).toBe(0);
    expect(potential(0.5, 1, 0)).toBeGreaterThan(potential(1, 1, 0));
  });
  test('the tilt of a held button is beyond the limit at which a valley disappears', () => {
    expect(landscape({ s: true, r: false }).h).toBeGreaterThan(TILT_LIMIT);
    expect(landscape({ s: false, r: true }).h).toBeLessThan(-TILT_LIMIT);
    expect(TILT_LIMIT).toBeCloseTo(0.3849, 3);
  });
  test('both buttons make one bowl on the hump', () => {
    const l = landscape({ s: true, r: true });
    expect(l.a).toBeLessThan(0);
    expect(l.h).toBe(0);
  });
});

describe('the ball', () => {
  test('sits in the valley it is in, and stays there', () => {
    for (const x0 of [1, -1, 0.7, -0.7, 1.4]) {
      const b = { x: x0, v: 0 };
      run(b, none, 6);
      expect(Math.abs(b.x)).toBeCloseTo(1, 1);
      expect(Math.sign(b.x)).toBe(Math.sign(x0));
    }
  });
  test('S rolls it to the right valley from anywhere, R to the left', () => {
    const b = { x: -1, v: 0 };
    run(b, { s: true, r: false }, 4);
    expect(b.x).toBeGreaterThan(1);
    run(b, none, 4);
    expect(b.x).toBeCloseTo(1, 1);
    run(b, { s: false, r: true }, 4);
    expect(b.x).toBeLessThan(-1);
    run(b, none, 4);
    expect(b.x).toBeCloseTo(-1, 1);
  });
  test('S and R together bring it to the middle', () => {
    const b = { x: 1, v: 0 };
    run(b, { s: true, r: true }, 5);
    expect(Math.abs(b.x)).toBeLessThan(0.02);
  });
  test('released from the middle with nothing to push it, it stays balanced exactly', () => {
    const b = { x: 0, v: 0 };
    run(b, none, 20);
    expect(b.x).toBe(0);
  });
  test('while metastable it is held near the top, shaken a little', () => {
    const b = { x: 0.15, v: 0 };
    run(b, none, 10, true);
    expect(Math.abs(b.x)).toBeLessThan(0.03);
    let max = 0;
    for (let i = 0; i < 600; i++) {
      step(b, none, 1 / 60, { metastable: true, t: 10 + i / 60 });
      max = Math.max(max, Math.abs(b.x));
    }
    expect(max).toBeGreaterThan(0.001);
    expect(max).toBeLessThan(0.05);
    expect(Math.abs(wobble(3.3))).toBeLessThan(0.025);
  });
  test('when the latch decides, the ball falls to the side it chose, in a few seconds', () => {
    for (const q of [0, 1] as const) {
      const b = { x: 0.004, v: 0 };
      release(b, q);
      run(b, none, 4);
      expect(Math.sign(b.x)).toBe(q ? 1 : -1);
      expect(Math.abs(b.x)).toBeGreaterThan(0.9);
    }
  });
  test('the fall takes between half a second and three seconds, not an instant', () => {
    const b = { x: 0.004, v: 0 };
    release(b, 1);
    let t = 0;
    while (b.x < 0.8 && t < 10) {
      step(b, none, 1 / 60, { metastable: false, t });
      t += 1 / 60;
    }
    expect(t).toBeGreaterThan(0.5);
    expect(t).toBeLessThan(3);
  });
  test('the resting places', () => {
    expect(rest({ s: true, r: false }, -1)).toBeGreaterThan(1);
    expect(rest(none, -1)).toBe(-1);
    expect(rest({ s: true, r: true }, 1)).toBe(0);
  });
});
