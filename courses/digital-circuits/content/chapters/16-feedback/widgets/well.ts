/**
 * The ball in the double well: the picture of a latch.
 *
 * The potential is U(x) = x⁴/4 − a·x²/2 − h·x. With a = 1 and h = 0 it has two valleys, at x = ±1 (the two stable
 * states of the latch: Q = 0 on the left, Q = 1 on the right) and a hump between them at x = 0, which is the
 * metastable point. Pressing S tilts the landscape to the right (h > 0), pressing R to the left; a tilt greater than
 * about 0.385 removes the valley on the far side altogether, so the ball rolls to the near one. Pressing both S and R
 * squashes the two valleys into one bowl centred on the hump (a < 0): both outputs of a NOR latch are 0, and the
 * ball sits at x = 0. Release both together and the bowl becomes a hump again, under a ball that is perched on top.
 *
 * The ball obeys a damped equation of motion, ẍ = −γẋ − U′(x), with time scaled so that a roll from the top of the hump
 * to the bottom of a valley takes about a second. The *when* and the *which way* of a fall from the hump are not
 * decided here: the digital engine draws them from an exponential distribution and a fair coin (see the
 * `srlatch` model), and the ball is held on the hump while the engine says the latch is metastable and is given a
 * nudge toward the side the engine picks when it lets go.
 */
export interface Ball {
  x: number;
  v: number;
}

export interface Pushes {
  s: boolean;
  r: boolean;
}

/** Tilt above which one valley disappears: h = 2 / (3√3). */
export const TILT_LIMIT = 2 / (3 * Math.sqrt(3));

/** Shape of the landscape for the buttons that are held. */
export function landscape(p: Pushes): { a: number; h: number } {
  if (p.s && p.r) return { a: -1, h: 0 };
  return { a: 1, h: p.s ? 0.9 : p.r ? -0.9 : 0 };
}

export const potential = (x: number, a: number, h: number): number => (x ** 4) / 4 - (a * x * x) / 2 - h * x;
const slope = (x: number, a: number, h: number): number => x ** 3 - a * x - h;

/** Time scale (equation-of-motion units per second) and friction. */
const TIME = 5;
const GAMMA = 2.2;

/** A slow, tiny, irregular shake for a ball balanced on the hump (drawn, not physical). */
export const wobble = (t: number): number => 0.012 * Math.sin(2.3 * t) + 0.007 * Math.sin(5.1 * t + 1) + 0.004 * Math.sin(9.7 * t + 2);

/**
 * Advance the ball by `dt` real seconds. While `metastable` it is drawn toward the hump (the engine says the latch has
 * not decided) and shaken a little; otherwise it rolls.
 */
export function step(ball: Ball, p: Pushes, dt: number, opts: { metastable: boolean; t: number }): void {
  const { a, h } = landscape(p);
  const n = Math.max(1, Math.ceil(dt * 240));
  const d = (dt * TIME) / n;
  for (let i = 0; i < n; i++) {
    let f: number;
    if (opts.metastable) {
      const aim = wobble(opts.t);
      f = -80 * (ball.x - aim) - 14 * ball.v;
    } else f = -GAMMA * ball.v - slope(ball.x, a, h);
    ball.v += f * d;
    ball.x += ball.v * d;
    if (ball.x > 2.4) ball.x = 2.4;
    if (ball.x < -2.4) ball.x = -2.4;
  }
}

/** The latch has decided: give the ball a nudge toward the valley it chose (1: right, Q = 1). */
export function release(ball: Ball, q: 0 | 1): void {
  ball.v = (q ? 1 : -1) * 0.06;
  if (Math.abs(ball.x) < 0.02) ball.x = (q ? 1 : -1) * 0.02;
}

/** Where a ball comes to rest for these pushes, if started from the given side (−1, 0 or 1). */
export function rest(p: Pushes, side: number): number {
  const { a, h } = landscape(p);
  if (a < 0) return 0;
  if (h > TILT_LIMIT) return 1.2;
  if (h < -TILT_LIMIT) return -1.2;
  return side >= 0 ? 1 : -1;
}
