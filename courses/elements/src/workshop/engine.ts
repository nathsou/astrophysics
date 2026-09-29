// The workshop's construction engine. A construction is a program: a list of steps, each applying
// a tool to earlier objects. Running the program on the level's given points yields the objects;
// running it on randomly perturbed givens is how a solution is checked — a construction is correct
// only if it works for every configuration, not just the one on the screen.

import { Degenerate, add, angle, cc, dist, lc, ll, mul, perp, sub, unit, v, type V } from '../geometry/vec';
import { rng } from '../geometry/jitter';

export type Obj =
  | { kind: 'point'; p: V }
  | { kind: 'line'; a: V; b: V }
  | { kind: 'circle'; c: V; r: number };

export type Step =
  | { op: 'line'; a: number; b: number }
  | { op: 'circle'; c: number; p: number }
  | { op: 'intersect'; x: number; y: number; which: number }
  | { op: 'on'; o: number; t: number }
  | { op: 'tool'; tool: string; args: number[] };

export interface Given {
  name: string;
  kind: 'point' | 'line' | 'circle';
  /** Free positions: a point's position, or a circle's centre (with `r`). */
  at?: V[];
  r?: number;
  /** A line through two earlier given points (indices). */
  through?: [number, number];
  /** A point on the segment between two earlier given points, at parameter t. */
  between?: { a: number; b: number; t: number };
  /** A point on an earlier given circle, at angle t. */
  onCircle?: { circle: number; t: number };
  /** A circle with its centre at an earlier given point (with `r`). */
  centre?: number;
  /** Whether the reader sees this given's name (a circle whose centre is unknown hides it). */
  hidden?: boolean;
}

export type ArgKind = 'point' | 'line' | 'circle';

export interface ToolDef {
  id: string;
  label: string;
  /** What the reader picks, in order. */
  args: ArgKind[];
  /** Prompts shown while picking. */
  prompts: string[];
  /** Number of primitive steps (lines and circles) the tool stands for, when inlined. */
  cost: number;
  run: (args: Obj[]) => Obj[];
  /** The proposition that unlocks this tool (none for the postulates). */
  unlockedBy?: string;
  help: string;
}

const P = (o: Obj): V => {
  if (o.kind !== 'point') throw new Degenerate('expected a point');
  return o.p;
};
const lineOf = (o: Obj): [V, V] => {
  if (o.kind !== 'line') throw new Degenerate('expected a line');
  return [o.a, o.b];
};
const circleOf = (o: Obj) => {
  if (o.kind !== 'circle') throw new Degenerate('expected a circle');
  return o;
};

/** All intersections of two objects, in a stable order. */
export function intersections(x: Obj, y: Obj): V[] {
  try {
    if (x.kind === 'line' && y.kind === 'line') return [ll(x.a, x.b, y.a, y.b)];
    if (x.kind === 'line' && y.kind === 'circle') return lc(x.a, x.b, y);
    if (x.kind === 'circle' && y.kind === 'line') return lc(y.a, y.b, x);
    if (x.kind === 'circle' && y.kind === 'circle') return cc(x, y);
  } catch (e) {
    if (e instanceof Degenerate) return [];
    throw e;
  }
  return [];
}

export const TOOLS: Record<string, ToolDef> = {
  line: {
    id: 'line',
    label: 'Line',
    args: ['point', 'point'],
    prompts: ['First point', 'Second point'],
    cost: 1,
    run: ([a, b]) => [{ kind: 'line', a: P(a), b: P(b) }],
    help: 'Postulates 1 and 2: the straight line through two points, produced as far as needed.',
  },
  circle: {
    id: 'circle',
    label: 'Circle',
    args: ['point', 'point'],
    prompts: ['Centre', 'A point on the circle'],
    cost: 1,
    run: ([c, p]) => [{ kind: 'circle', c: P(c), r: dist(P(c), P(p)) }],
    help: 'Postulate 3: the circle with a given centre through a given point. The compass collapses when lifted: it cannot carry a distance elsewhere.',
  },
  equilateral: {
    id: 'equilateral',
    label: 'Equilateral △',
    args: ['point', 'point'],
    prompts: ['First point', 'Second point'],
    cost: 2,
    unlockedBy: '1.1',
    run: ([a, b]) => {
      const A = P(a);
      const B = P(b);
      const [C] = cc({ c: A, r: dist(A, B) }, { c: B, r: dist(A, B) });
      return [{ kind: 'point', p: C }];
    },
    help: 'I.1: the apex of the equilateral triangle on AB, on the left of A→B.',
  },
  compass: {
    id: 'compass',
    label: 'Compass',
    args: ['point', 'point', 'point'],
    prompts: ['Centre', 'One end of the distance', 'Other end of the distance'],
    cost: 5,
    unlockedBy: '1.2',
    run: ([c, a, b]) => [{ kind: 'circle', c: P(c), r: dist(P(a), P(b)) }],
    help: 'I.2–3: a compass that keeps its opening. Euclid shows that the collapsing compass can do everything this one does.',
  },
  bisectAngle: {
    id: 'bisectAngle',
    label: 'Bisect angle',
    args: ['point', 'point', 'point'],
    prompts: ['A point on one arm', 'The vertex', 'A point on the other arm'],
    cost: 4,
    unlockedBy: '1.9',
    run: ([a, b, c]) => {
      const A = P(a);
      const B = P(b);
      const C = P(c);
      const d = add(unit(sub(A, B)), unit(sub(C, B)));
      if (Math.hypot(d.x, d.y) < 1e-9) throw new Degenerate('straight angle');
      return [{ kind: 'line', a: B, b: add(B, d) }];
    },
    help: 'I.9: the line bisecting the angle ABC.',
  },
  midpoint: {
    id: 'midpoint',
    label: 'Midpoint',
    args: ['point', 'point'],
    prompts: ['First point', 'Second point'],
    cost: 3,
    unlockedBy: '1.10',
    run: ([a, b]) => [{ kind: 'point', p: mul(add(P(a), P(b)), 0.5) }],
    help: 'I.10: the point bisecting a segment.',
  },
  perpendicular: {
    id: 'perpendicular',
    label: 'Perpendicular',
    args: ['point', 'line'],
    prompts: ['Through which point', 'To which line'],
    cost: 3,
    unlockedBy: '1.11',
    run: ([p, l]) => {
      const [A, B] = lineOf(l);
      const X = P(p);
      return [{ kind: 'line', a: X, b: add(X, perp(sub(B, A))) }];
    },
    help: 'I.11–12: the perpendicular to a line through a point, on the line or off it.',
  },
  copyAngle: {
    id: 'copyAngle',
    label: 'Copy angle',
    args: ['point', 'point', 'point', 'point', 'point'],
    prompts: ['Angle: point on one arm', 'Angle: vertex', 'Angle: point on the other arm', 'New vertex', 'A point on the new arm'],
    cost: 5,
    unlockedBy: '1.23',
    run: ([a, b, c, d, e]) => {
      const A = P(a);
      const B = P(b);
      const C = P(c);
      const D = P(d);
      const E = P(e);
      const ang = angle(A, B, C);
      const s = Math.sign((A.x - B.x) * (C.y - B.y) - (A.y - B.y) * (C.x - B.x)) || 1;
      const u = unit(sub(E, D));
      const w = v(u.x * Math.cos(s * ang) - u.y * Math.sin(s * ang), u.x * Math.sin(s * ang) + u.y * Math.cos(s * ang));
      return [{ kind: 'line', a: D, b: add(D, w) }];
    },
    help: 'I.23: at a point on a line, an angle equal to a given angle (turning the same way).',
  },
  parallel: {
    id: 'parallel',
    label: 'Parallel',
    args: ['point', 'line'],
    prompts: ['Through which point', 'Parallel to which line'],
    cost: 3,
    unlockedBy: '1.31',
    run: ([p, l]) => {
      const [A, B] = lineOf(l);
      const X = P(p);
      return [{ kind: 'line', a: X, b: add(X, sub(B, A)) }];
    },
    help: 'I.31: the parallel to a line through a point. From here on, the theory depends on Postulate 5.',
  },
  square: {
    id: 'square',
    label: 'Square',
    args: ['point', 'point'],
    prompts: ['First corner', 'Second corner'],
    cost: 6,
    unlockedBy: '1.46',
    run: ([a, b]) => {
      const A = P(a);
      const B = P(b);
      const n = perp(sub(B, A));
      return [
        { kind: 'point', p: add(B, n) },
        { kind: 'point', p: add(A, n) },
      ];
    },
    help: 'I.46: the other two corners of the square on AB (on the left of A→B).',
  },
  centre: {
    id: 'centre',
    label: 'Centre',
    args: ['circle'],
    prompts: ['Which circle'],
    cost: 6,
    unlockedBy: '3.1',
    run: ([k]) => [{ kind: 'point', p: circleOf(k).c }],
    help: 'III.1: the centre of a given circle.',
  },
  tangent: {
    id: 'tangent',
    label: 'Tangent',
    args: ['point', 'circle'],
    prompts: ['From which point', 'To which circle'],
    cost: 4,
    unlockedBy: '3.17',
    run: ([p, k]) => {
      const X = P(p);
      const K = circleOf(k);
      const d = dist(X, K.c);
      if (d < K.r - 1e-9) throw new Degenerate('point inside the circle');
      if (d < K.r + 1e-9) return [{ kind: 'line', a: X, b: add(X, perp(sub(X, K.c))) }];
      const [T1, T2] = cc(K, { c: mul(add(X, K.c), 0.5), r: d / 2 });
      return [
        { kind: 'line', a: X, b: T1 },
        { kind: 'line', a: X, b: T2 },
      ];
    },
    help: 'III.17: the tangents to a circle from a point outside it.',
  },
  circumcircle: {
    id: 'circumcircle',
    label: 'Circumcircle',
    args: ['point', 'point', 'point'],
    prompts: ['First vertex', 'Second vertex', 'Third vertex'],
    cost: 5,
    unlockedBy: '4.5',
    run: ([a, b, c]) => {
      const A = P(a);
      const B = P(b);
      const C = P(c);
      const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
      if (Math.abs(d) < 1e-12) throw new Degenerate('collinear');
      const a2 = A.x * A.x + A.y * A.y;
      const b2 = B.x * B.x + B.y * B.y;
      const c2 = C.x * C.x + C.y * C.y;
      const O = v((a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / d, (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / d);
      return [{ kind: 'circle', c: O, r: dist(O, A) }];
    },
    help: 'IV.5: the circle through three points.',
  },
  meanProportional: {
    id: 'meanProportional',
    label: 'Mean proportional',
    args: ['point', 'point', 'point'],
    prompts: ['A', 'B (between)', 'C'],
    cost: 4,
    unlockedBy: '6.13',
    run: ([a, b, c]) => {
      const A = P(a);
      const B = P(b);
      const C = P(c);
      const h = Math.sqrt(dist(A, B) * dist(B, C));
      const n = unit(perp(sub(C, A)));
      return [{ kind: 'point', p: add(B, mul(n, h)) }];
    },
    help: 'VI.13: on the perpendicular at B, the point D with BD² = AB·BC, i.e. a square root.',
  },
};

export const PRIMITIVES = ['line', 'circle'];

export interface Program {
  steps: Step[];
}

/** The objects the givens stand for. */
export function givenObjects(givens: Given[]): Obj[] {
  const objs: Obj[] = [];
  for (const g of givens) {
    const pt = (i: number) => {
      const o = objs[i];
      if (o.kind !== 'point') throw new Error(`given ${i} is not a point`);
      return o.p;
    };
    if (g.kind === 'point') {
      if (g.between) objs.push({ kind: 'point', p: add(pt(g.between.a), mul(sub(pt(g.between.b), pt(g.between.a)), g.between.t)) });
      else if (g.onCircle) {
        const k = objs[g.onCircle.circle];
        if (k.kind !== 'circle') throw new Error('onCircle needs a circle');
        objs.push({ kind: 'point', p: v(k.c.x + k.r * Math.cos(g.onCircle.t), k.c.y + k.r * Math.sin(g.onCircle.t)) });
      } else objs.push({ kind: 'point', p: g.at![0] });
    } else if (g.kind === 'line') {
      if (g.through) objs.push({ kind: 'line', a: pt(g.through[0]), b: pt(g.through[1]) });
      else objs.push({ kind: 'line', a: g.at![0], b: g.at![1] });
    } else {
      objs.push({ kind: 'circle', c: g.centre !== undefined ? pt(g.centre) : g.at![0], r: g.r! });
    }
  }
  return objs;
}

/** Runs a program on the givens. Returns the objects (givens first) or throws Degenerate. */
export function run(givens: Given[], steps: Step[]): Obj[] {
  const objs: Obj[] = givenObjects(givens);
  for (const s of steps) {
    switch (s.op) {
      case 'line':
        objs.push(...TOOLS.line.run([objs[s.a], objs[s.b]]));
        break;
      case 'circle':
        objs.push(...TOOLS.circle.run([objs[s.c], objs[s.p]]));
        break;
      case 'intersect': {
        const pts = intersections(objs[s.x], objs[s.y]);
        if (s.which >= pts.length) throw new Degenerate('the objects no longer meet');
        objs.push({ kind: 'point', p: pts[s.which] });
        break;
      }
      case 'on': {
        const o = objs[s.o];
        if (o.kind === 'line') objs.push({ kind: 'point', p: add(o.a, mul(sub(o.b, o.a), s.t)) });
        else if (o.kind === 'circle') objs.push({ kind: 'point', p: v(o.c.x + o.r * Math.cos(s.t), o.c.y + o.r * Math.sin(s.t)) });
        else throw new Degenerate('point on a point');
        break;
      }
      case 'tool':
        objs.push(...TOOLS[s.tool].run(s.args.map((i) => objs[i])));
        break;
    }
  }
  for (const o of objs) {
    const ps = o.kind === 'point' ? [o.p] : o.kind === 'line' ? [o.a, o.b] : [o.c];
    if (ps.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Degenerate('not finite');
  }
  return objs;
}

/** How many objects each step produces, so step indices can be mapped to object indices. */
export function outputsOf(givens: Given[], steps: Step[]): number[] {
  const objs = run(givens, []);
  let n = objs.length;
  const counts: number[] = [];
  for (let i = 0; i < steps.length; i++) {
    const after = run(givens, steps.slice(0, i + 1)).length;
    counts.push(after - n);
    n = after;
  }
  return counts;
}

/** A requirement is met by one object of the construction. */
export interface Requirement {
  text: string;
  test: (o: Obj, givens: Obj[]) => boolean;
}

export interface Level {
  id: string;
  /** The proposition this level is. */
  prop: string;
  title: string;
  brief: string;
  givens: Given[];
  requirements: Requirement[];
  /** Euclid's solution, as a program (used for "par" and by the tests). */
  reference: Step[];
  /** The tool the level unlocks. */
  unlocks?: string;
  /** A nudge, shown on request. */
  hint?: string;
}

const TOL = 1e-6;
export const near = (a: number, b: number) => Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a), Math.abs(b));
export const samePt = (a: V, b: V) => dist(a, b) <= TOL * Math.max(1, Math.hypot(a.x, a.y));
export const onLine = (p: V, a: V, b: V) => Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) <= TOL * Math.max(1, dist(a, b) * Math.max(1, dist(a, p)));
export const sameLine = (l: Obj, a: V, b: V) => l.kind === 'line' && onLine(l.a, a, b) && onLine(l.b, a, b);

/** Perturbs the free data of the givens. */
export function perturb(givens: Given[], r: () => number, amount: number): Given[] {
  return givens.map((g) => ({
    ...g,
    ...(g.at ? { at: g.at.map((p) => v(p.x + (r() * 2 - 1) * amount, p.y + (r() * 2 - 1) * amount)) } : {}),
    ...(g.r !== undefined ? { r: g.r * (1 + (r() * 2 - 1) * 0.1) } : {}),
    ...(g.between ? { between: { ...g.between, t: g.between.t + (r() * 2 - 1) * 0.05 } } : {}),
    ...(g.onCircle ? { onCircle: { ...g.onCircle, t: g.onCircle.t + (r() * 2 - 1) * 0.3 } } : {}),
  }));
}

/** Points of the givens, for sizing the view. */
export const givenPoints = (givens: Given[]): V[] =>
  givenObjects(givens).flatMap((o) => (o.kind === 'point' ? [o.p] : o.kind === 'line' ? [o.a, o.b] : [v(o.c.x - o.r, o.c.y - o.r), v(o.c.x + o.r, o.c.y + o.r)]));

export interface CheckResult {
  /** For each requirement, the index of an object meeting it in every trial, or -1. */
  met: number[];
  trials: number;
  /** Requirements met in the current configuration but not in some other one: the construction only looks right. */
  coincidental: number[];
}

/**
 * Checks a construction: the requirements must be met by the same objects in the current
 * configuration and in `n` random ones. Points placed "on" an object move to random places too.
 */
export function check(level: Level, steps: Step[], n = 24, seed = 7): CheckResult {
  const base = run(level.givens, steps);
  const r = rng(seed);
  const gp = givenPoints(level.givens);
  const size = Math.max(1, ...gp.flatMap((p) => gp.map((q) => dist(p, q))));
  const configs: Obj[][] = [base];
  for (let i = 0; i < n * 3 && configs.length < n + 1; i++) {
    const gs = perturb(level.givens, r, 0.12 * size);
    const st = steps.map((s) => (s.op === 'on' ? { ...s, t: s.t + (r() * 2 - 1) * 0.08 } : s));
    try {
      configs.push(run(gs, st));
    } catch (e) {
      if (!(e instanceof Degenerate)) throw e;
    }
  }
  const met: number[] = [];
  const coincidental: number[] = [];
  const safe = (req: Requirement, o: Obj, g: Obj[]) => {
    try {
      return req.test(o, g);
    } catch (e) {
      if (e instanceof Degenerate) return false;
      throw e;
    }
  };
  level.requirements.forEach((req, ri) => {
    let found = -1;
    let looksRight = false;
    for (let i = 0; i < base.length && found < 0; i++) {
      if (!safe(req, base[i], configs[0].slice(0, level.givens.length))) continue;
      looksRight = true;
      if (configs.every((c) => c.length === base.length && safe(req, c[i], c.slice(0, level.givens.length)))) found = i;
    }
    met.push(found);
    if (found < 0 && looksRight) coincidental.push(ri);
  });
  return { met, trials: configs.length, coincidental };
}

/** Primitive steps (lines and circles) when every tool is inlined. */
export function primitiveCost(steps: Step[]): number {
  return steps.reduce((s, st) => s + (st.op === 'line' || st.op === 'circle' ? 1 : st.op === 'tool' ? TOOLS[st.tool].cost : 0), 0);
}
/** Tool uses (lines, circles and unlocked tools; intersections and points are free). */
export function toolUses(steps: Step[]): number {
  return steps.filter((s) => s.op !== 'intersect' && s.op !== 'on').length;
}
