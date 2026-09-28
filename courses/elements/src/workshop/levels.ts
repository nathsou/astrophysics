// The workshop's levels: constructions from the Elements, in the book's order. Each one lists its
// givens, what must be constructed (as requirements checked on random configurations), Euclid's
// own solution as a program (the "par"), and the tool it unlocks.

import { angle, dist, dot, sub, unit, v, type V } from '../geometry/vec';
import { near, onLine, samePt, type Level, type Obj, type Requirement } from './engine';

const pointReq = (text: string, f: (p: V, g: Obj[]) => boolean): Requirement => ({ text, test: (o, g) => o.kind === 'point' && f(o.p, g) });
const lineReq = (text: string, f: (a: V, b: V, g: Obj[]) => boolean): Requirement => ({ text, test: (o, g) => o.kind === 'line' && f(o.a, o.b, g) });
const circleReq = (text: string, f: (c: V, r: number, g: Obj[]) => boolean): Requirement => ({ text, test: (o, g) => o.kind === 'circle' && f(o.c, o.r, g) });
const gp = (g: Obj[], i: number): V => {
  const o = g[i];
  if (o.kind === 'point') return o.p;
  if (o.kind === 'circle') return o.c;
  return o.a;
};
const gc = (g: Obj[], i: number) => g[i] as Extract<Obj, { kind: 'circle' }>;
const perpTo = (a: V, b: V, c: V, d: V) => Math.abs(dot(unit(sub(b, a)), unit(sub(d, c)))) < 1e-6;
const parallelTo = (a: V, b: V, c: V, d: V) => Math.abs(Math.abs(dot(unit(sub(b, a)), unit(sub(d, c)))) - 1) < 1e-9;
const distToLine = (p: V, a: V, b: V) => Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / dist(a, b);
const rotAbout = (p: V, c: V, t: number) => v(c.x + (p.x - c.x) * Math.cos(t) - (p.y - c.y) * Math.sin(t), c.y + (p.x - c.x) * Math.sin(t) + (p.y - c.y) * Math.cos(t));
/** The vertex k steps (of n) from A around the circle centred at E (given 0), counter-clockwise; negative k goes clockwise. */
const vertexAt = (k: number, n: number) => (p: V, g: Obj[]) => samePt(p, rotAbout(gp(g, 2), gp(g, 0), (2 * Math.PI * k) / n));
const corners = (n: number, ks: number[]) =>
  ks.map((k) => pointReq(Math.abs(k) * 2 === n ? 'The corner opposite A' : `The corner ${Math.abs(k) === 1 ? 'next to' : Math.abs(k) + ' steps from'} A, ${k > 0 ? 'counter-clockwise' : 'clockwise'}`, vertexAt(k, n)));

export const LEVELS: Level[] = [
  {
    id: 'equilateral',
    prop: '1.1',
    title: 'An equilateral triangle',
    brief: 'Construct a point C such that the triangle ABC is equilateral.',
    givens: [
      { name: 'A', kind: 'point', at: [v(-1, 0)] },
      { name: 'B', kind: 'point', at: [v(1, 0)] },
    ],
    requirements: [pointReq('A point C with CA = CB = AB', (p, g) => near(dist(p, gp(g, 0)), dist(gp(g, 0), gp(g, 1))) && near(dist(p, gp(g, 1)), dist(gp(g, 0), gp(g, 1))))],
    reference: [
      { op: 'circle', c: 0, p: 1 },
      { op: 'circle', c: 1, p: 0 },
      { op: 'intersect', x: 2, y: 3, which: 0 },
    ],
    unlocks: 'equilateral',
    hint: 'Every point of the circle with centre A through B is as far from A as B is.',
  },
  {
    id: 'copy-length',
    prop: '1.2',
    title: 'Carry a length',
    brief: 'The compass collapses when lifted. Still, find a point L with AL equal to BC.',
    givens: [
      { name: 'A', kind: 'point', at: [v(-1.6, 0.6)] },
      { name: 'B', kind: 'point', at: [v(0.2, -0.4)] },
      { name: 'C', kind: 'point', at: [v(1.5, 0.3)] },
    ],
    requirements: [
      {
        text: 'A point L with AL = BC (or a circle with centre A and radius BC)',
        test: (o, g) => {
          const bc = dist(gp(g, 1), gp(g, 2));
          if (o.kind === 'point') return near(dist(o.p, gp(g, 0)), bc) && dist(o.p, gp(g, 0)) > 1e-9;
          if (o.kind === 'circle') return samePt(o.c, gp(g, 0)) && near(o.r, bc);
          return false;
        },
      },
    ],
    reference: [
      { op: 'tool', tool: 'equilateral', args: [0, 1] },
      { op: 'circle', c: 1, p: 2 },
      { op: 'line', a: 3, b: 1 },
      { op: 'intersect', x: 5, y: 4, which: 1 },
      { op: 'circle', c: 3, p: 6 },
      { op: 'line', a: 3, b: 0 },
      { op: 'intersect', x: 8, y: 7, which: 1 },
    ],
    unlocks: 'compass',
    hint: 'Build an equilateral triangle on AB. Its apex is equally far from A and B, and a circle about it can carry a length from B to A.',
  },
  {
    id: 'bisect-angle',
    prop: '1.9',
    title: 'Bisect an angle',
    brief: 'Construct the line that bisects the angle ABC.',
    givens: [
      { name: 'A', kind: 'point', at: [v(-0.4, 1.1)] },
      { name: 'B', kind: 'point', at: [v(-1, -0.5)] },
      { name: 'C', kind: 'point', at: [v(1.2, -0.5)] },
    ],
    requirements: [
      lineReq('The line through B bisecting the angle ABC', (a, b, g) => {
        const B = gp(g, 1);
        if (!onLine(B, a, b)) return false;
        const d = unit(sub(b, a));
        const bis = unit(v(unit(sub(gp(g, 0), B)).x + unit(sub(gp(g, 2), B)).x, unit(sub(gp(g, 0), B)).y + unit(sub(gp(g, 2), B)).y));
        return Math.abs(Math.abs(dot(d, bis)) - 1) < 1e-9;
      }),
    ],
    reference: [
      { op: 'circle', c: 1, p: 0 },
      { op: 'line', a: 1, b: 2 },
      { op: 'intersect', x: 4, y: 3, which: 1 },
      { op: 'tool', tool: 'equilateral', args: [0, 5] },
      { op: 'line', a: 1, b: 6 },
    ],
    unlocks: 'bisectAngle',
    hint: 'Cut off equal lengths on both arms, and build an equilateral triangle on the segment joining them.',
  },
  {
    id: 'midpoint',
    prop: '1.10',
    title: 'Bisect a segment',
    brief: 'Construct the midpoint of AB.',
    givens: [
      { name: 'A', kind: 'point', at: [v(-1.2, -0.2)] },
      { name: 'B', kind: 'point', at: [v(1.1, 0.3)] },
    ],
    requirements: [pointReq('The midpoint of AB', (p, g) => samePt(p, v((gp(g, 0).x + gp(g, 1).x) / 2, (gp(g, 0).y + gp(g, 1).y) / 2)))],
    reference: [
      { op: 'circle', c: 0, p: 1 },
      { op: 'circle', c: 1, p: 0 },
      { op: 'intersect', x: 2, y: 3, which: 0 },
      { op: 'intersect', x: 2, y: 3, which: 1 },
      { op: 'line', a: 4, b: 5 },
      { op: 'line', a: 0, b: 1 },
      { op: 'intersect', x: 6, y: 7, which: 0 },
    ],
    unlocks: 'midpoint',
    hint: 'The two points where the circles of I.1 meet are both equidistant from A and B.',
  },
  {
    id: 'perpendicular',
    prop: '1.11',
    title: 'A perpendicular',
    brief: 'Construct the line through C at right angles to AB.',
    givens: [
      { name: 'A', kind: 'point', at: [v(-2, -0.3)] },
      { name: 'B', kind: 'point', at: [v(2, 0.2)] },
      { name: 'AB', kind: 'line', through: [0, 1], hidden: true },
      { name: 'C', kind: 'point', between: { a: 0, b: 1, t: 0.45 } },
    ],
    requirements: [lineReq('The line through C perpendicular to AB', (a, b, g) => onLine(gp(g, 3), a, b) && perpTo(a, b, gp(g, 0), gp(g, 1)))],
    reference: [
      { op: 'on', o: 2, t: 0.25 },
      { op: 'circle', c: 3, p: 4 },
      { op: 'intersect', x: 2, y: 5, which: 1 },
      { op: 'tool', tool: 'equilateral', args: [4, 6] },
      { op: 'line', a: 3, b: 7 },
    ],
    unlocks: 'perpendicular',
    hint: 'Take any point D on the line, cut off CE equal to CD on the other side, and build an equilateral triangle on DE.',
  },
  {
    id: 'copy-angle',
    prop: '1.23',
    title: 'Copy an angle',
    brief: 'At A, on the line AB, construct an angle equal to the angle DCE.',
    givens: [
      { name: 'D', kind: 'point', at: [v(-1.4, 1.2)] },
      { name: 'C', kind: 'point', at: [v(-2.1, 0.3)] },
      { name: 'E', kind: 'point', at: [v(-0.7, 0.2)] },
      { name: 'A', kind: 'point', at: [v(0.2, -0.8)] },
      { name: 'B', kind: 'point', at: [v(2.2, -0.6)] },
    ],
    requirements: [
      lineReq('A line through A making with AB an angle equal to DCE', (a, b, g) => {
        const A = gp(g, 3);
        if (!onLine(A, a, b)) return false;
        const target = Math.cos(angle(gp(g, 0), gp(g, 1), gp(g, 2)));
        const c = dot(unit(sub(b, a)), unit(sub(gp(g, 4), A)));
        return Math.abs(Math.abs(c) - Math.abs(target)) < 1e-9;
      }),
    ],
    reference: [
      { op: 'line', a: 3, b: 4 },
      { op: 'line', a: 1, b: 2 },
      { op: 'circle', c: 1, p: 0 },
      { op: 'intersect', x: 6, y: 7, which: 1 },
      { op: 'tool', tool: 'compass', args: [3, 1, 0] },
      { op: 'intersect', x: 5, y: 9, which: 1 },
      { op: 'tool', tool: 'compass', args: [10, 0, 8] },
      { op: 'intersect', x: 9, y: 11, which: 0 },
      { op: 'line', a: 3, b: 12 },
    ],
    unlocks: 'copyAngle',
    hint: 'Turn the angle into a triangle by cutting off equal lengths on its arms, then rebuild that triangle at A (I.22).',
  },
  {
    id: 'parallel',
    prop: '1.31',
    title: 'A parallel',
    brief: 'Construct the line through A parallel to BC.',
    givens: [
      { name: 'B', kind: 'point', at: [v(-2, -0.6)] },
      { name: 'C', kind: 'point', at: [v(2, -0.4)] },
      { name: 'BC', kind: 'line', through: [0, 1], hidden: true },
      { name: 'A', kind: 'point', at: [v(-0.4, 0.9)] },
    ],
    requirements: [lineReq('The line through A parallel to BC', (a, b, g) => onLine(gp(g, 3), a, b) && parallelTo(a, b, gp(g, 0), gp(g, 1)))],
    reference: [
      { op: 'on', o: 2, t: 0.6 },
      { op: 'line', a: 3, b: 4 },
      { op: 'tool', tool: 'copyAngle', args: [3, 4, 1, 3, 4] },
    ],
    unlocks: 'parallel',
    hint: 'Join A to a point D on BC, and copy the angle ADC to A so that the two angles are alternate (I.27).',
  },
  {
    id: 'square',
    prop: '1.46',
    title: 'A square',
    brief: 'Construct the square on AB: its two other corners.',
    givens: [
      { name: 'A', kind: 'point', at: [v(-0.8, -0.8)] },
      { name: 'B', kind: 'point', at: [v(0.9, -0.6)] },
    ],
    requirements: [
      pointReq('A corner D with DA = AB and DA ⟂ AB', (p, g) => near(dist(p, gp(g, 0)), dist(gp(g, 0), gp(g, 1))) && perpTo(gp(g, 0), p, gp(g, 0), gp(g, 1))),
      pointReq('A corner E with EB = AB and EB ⟂ AB', (p, g) => near(dist(p, gp(g, 1)), dist(gp(g, 0), gp(g, 1))) && perpTo(gp(g, 1), p, gp(g, 0), gp(g, 1))),
    ],
    reference: [
      { op: 'line', a: 0, b: 1 },
      { op: 'tool', tool: 'perpendicular', args: [0, 2] },
      { op: 'circle', c: 0, p: 1 },
      { op: 'intersect', x: 3, y: 4, which: 1 },
      { op: 'tool', tool: 'parallel', args: [5, 2] },
      { op: 'line', a: 0, b: 5 },
      { op: 'tool', tool: 'parallel', args: [1, 7] },
      { op: 'intersect', x: 6, y: 8, which: 0 },
    ],
    unlocks: 'square',
    hint: 'Raise a perpendicular at A, cut off AD equal to AB, then draw two parallels.',
  },
  {
    id: 'golden',
    prop: '2.11',
    title: 'The golden section',
    brief: 'Cut AB at H so that the rectangle AB·HB equals the square on AH.',
    givens: [
      { name: 'A', kind: 'point', at: [v(-1, -0.9)] },
      { name: 'B', kind: 'point', at: [v(1, -0.9)] },
    ],
    requirements: [
      pointReq('H on AB with AB·HB = AH²', (p, g) => {
        const A = gp(g, 0);
        const B = gp(g, 1);
        return onLine(p, A, B) && dist(p, A) < dist(A, B) && dist(p, B) < dist(A, B) && near(dist(A, B) * dist(p, B), dist(A, p) ** 2);
      }),
    ],
    reference: [
      { op: 'tool', tool: 'square', args: [0, 1] },
      { op: 'tool', tool: 'midpoint', args: [0, 3] },
      { op: 'line', a: 0, b: 3 },
      { op: 'circle', c: 4, p: 1 },
      { op: 'intersect', x: 5, y: 6, which: 0 },
      { op: 'circle', c: 0, p: 7 },
      { op: 'line', a: 0, b: 1 },
      { op: 'intersect', x: 9, y: 8, which: 1 },
    ],
    hint: 'Build the square on AB, bisect the side AC at E, and swing EB down onto the line CA.',
  },
  {
    id: 'centre',
    prop: '3.1',
    title: 'Find the centre',
    brief: 'The centre of this circle is lost. Find it.',
    givens: [{ name: 'circle', kind: 'circle', at: [v(0.1, 0.05)], r: 1.3, hidden: true }],
    requirements: [pointReq('The centre of the circle', (p, g) => samePt(p, gc(g, 0).c))],
    reference: [
      { op: 'on', o: 0, t: 0.3 },
      { op: 'on', o: 0, t: 2.2 },
      { op: 'line', a: 1, b: 2 },
      { op: 'tool', tool: 'midpoint', args: [1, 2] },
      { op: 'tool', tool: 'perpendicular', args: [4, 3] },
      { op: 'intersect', x: 5, y: 0, which: 0 },
      { op: 'intersect', x: 5, y: 0, which: 1 },
      { op: 'tool', tool: 'midpoint', args: [6, 7] },
    ],
    unlocks: 'centre',
    hint: 'The perpendicular bisector of any chord is a diameter.',
  },
  {
    id: 'tangent',
    prop: '3.17',
    title: 'A tangent',
    brief: 'Draw a line through A touching the circle.',
    givens: [
      { name: 'E', kind: 'point', at: [v(-0.6, 0)] },
      { name: 'circle', kind: 'circle', centre: 0, r: 1, hidden: true },
      { name: 'A', kind: 'point', at: [v(1.8, 0.5)] },
    ],
    requirements: [lineReq('A line through A touching the circle', (a, b, g) => onLine(gp(g, 2), a, b) && near(distToLine(gc(g, 1).c, a, b), gc(g, 1).r))],
    reference: [
      { op: 'line', a: 0, b: 2 },
      { op: 'circle', c: 0, p: 2 },
      { op: 'intersect', x: 3, y: 1, which: 1 },
      { op: 'tool', tool: 'perpendicular', args: [5, 3] },
      { op: 'intersect', x: 6, y: 4, which: 0 },
      { op: 'line', a: 0, b: 7 },
      { op: 'intersect', x: 8, y: 1, which: 1 },
      { op: 'line', a: 2, b: 9 },
    ],
    unlocks: 'tangent',
    hint: 'Euclid draws a second circle about E through A, and uses the perpendicular at D, where EA meets the given circle.',
  },
  {
    id: 'incircle',
    prop: '4.4',
    title: 'Inscribe a circle',
    brief: 'Construct the circle touching all three sides of the triangle ABC.',
    givens: [
      { name: 'A', kind: 'point', at: [v(-0.3, 1.2)] },
      { name: 'B', kind: 'point', at: [v(-1.5, -0.8)] },
      { name: 'C', kind: 'point', at: [v(1.6, -0.7)] },
    ],
    requirements: [
      circleReq('A circle touching AB, BC and CA', (c, r, g) => {
        const [A, B, C] = [gp(g, 0), gp(g, 1), gp(g, 2)];
        return near(distToLine(c, A, B), r) && near(distToLine(c, B, C), r) && near(distToLine(c, C, A), r) && r < Math.min(dist(A, B), dist(B, C)) / 2;
      }),
    ],
    reference: [
      { op: 'tool', tool: 'bisectAngle', args: [0, 1, 2] },
      { op: 'tool', tool: 'bisectAngle', args: [0, 2, 1] },
      { op: 'intersect', x: 3, y: 4, which: 0 },
      { op: 'line', a: 1, b: 2 },
      { op: 'tool', tool: 'perpendicular', args: [5, 6] },
      { op: 'intersect', x: 7, y: 6, which: 0 },
      { op: 'circle', c: 5, p: 8 },
    ],
    hint: 'The centre is equidistant from all three sides.',
  },
  {
    id: 'circumcircle',
    prop: '4.5',
    title: 'Circumscribe a circle',
    brief: 'Construct the circle through A, B and C.',
    givens: [
      { name: 'A', kind: 'point', at: [v(-0.4, 1)] },
      { name: 'B', kind: 'point', at: [v(-1.4, -0.6)] },
      { name: 'C', kind: 'point', at: [v(1.3, -0.7)] },
    ],
    requirements: [circleReq('The circle through A, B and C', (c, r, g) => [0, 1, 2].every((i) => near(dist(c, gp(g, i)), r)))],
    reference: [
      { op: 'line', a: 0, b: 1 },
      { op: 'tool', tool: 'midpoint', args: [0, 1] },
      { op: 'tool', tool: 'perpendicular', args: [4, 3] },
      { op: 'line', a: 0, b: 2 },
      { op: 'tool', tool: 'midpoint', args: [0, 2] },
      { op: 'tool', tool: 'perpendicular', args: [7, 6] },
      { op: 'intersect', x: 5, y: 8, which: 0 },
      { op: 'circle', c: 9, p: 0 },
    ],
    unlocks: 'circumcircle',
    hint: 'Every point of the perpendicular bisector of AB is as far from A as from B.',
  },
  {
    id: 'square-in-circle',
    prop: '4.6',
    title: 'A square in a circle',
    brief: 'Inscribe a square in the circle, with one corner at A.',
    givens: [
      { name: 'E', kind: 'point', at: [v(0, 0)] },
      { name: 'circle', kind: 'circle', centre: 0, r: 1.2, hidden: true },
      { name: 'A', kind: 'point', onCircle: { circle: 1, t: 1.3 } },
    ],
    requirements: corners(4, [1, -1, 2]),
    reference: [
      { op: 'line', a: 2, b: 0 },
      { op: 'intersect', x: 3, y: 1, which: 1 },
      { op: 'tool', tool: 'perpendicular', args: [0, 3] },
      { op: 'intersect', x: 5, y: 1, which: 0 },
      { op: 'intersect', x: 5, y: 1, which: 1 },
    ],
    hint: 'Two diameters at right angles.',
  },
  {
    id: 'hexagon',
    prop: '4.15',
    title: 'A regular hexagon',
    brief: 'Inscribe a regular hexagon in the circle, with one corner at A: construct the other five corners.',
    givens: [
      { name: 'E', kind: 'point', at: [v(0, 0)] },
      { name: 'circle', kind: 'circle', centre: 0, r: 1.2, hidden: true },
      { name: 'A', kind: 'point', onCircle: { circle: 1, t: 1.9 } },
    ],
    requirements: corners(6, [1, -1, 2, -2, 3]),
    reference: [
      { op: 'circle', c: 2, p: 0 },
      { op: 'intersect', x: 1, y: 3, which: 0 },
      { op: 'intersect', x: 1, y: 3, which: 1 },
      { op: 'line', a: 2, b: 0 },
      { op: 'intersect', x: 6, y: 1, which: 1 },
      { op: 'circle', c: 7, p: 0 },
      { op: 'intersect', x: 1, y: 8, which: 0 },
      { op: 'intersect', x: 1, y: 8, which: 1 },
    ],
    hint: 'The side of the hexagon equals the radius (IV.15, porism).',
  },
  {
    id: 'pentagon',
    prop: '4.11',
    title: 'A regular pentagon',
    brief: 'Inscribe a regular pentagon in the circle, with one corner at A: construct the corners next to A and the two others.',
    givens: [
      { name: 'E', kind: 'point', at: [v(0, 0)] },
      { name: 'circle', kind: 'circle', centre: 0, r: 1.2, hidden: true },
      { name: 'A', kind: 'point', onCircle: { circle: 1, t: Math.PI / 2 } },
    ],
    requirements: corners(5, [1, -1, 2, -2]),
    reference: [
      // diameter through A, perpendicular diameter PQ, M midpoint of EP; circle about M through A meets PQ at N; AN is the side.
      { op: 'line', a: 2, b: 0 },
      { op: 'tool', tool: 'perpendicular', args: [0, 3] },
      { op: 'intersect', x: 4, y: 1, which: 0 },
      { op: 'tool', tool: 'midpoint', args: [0, 5] },
      { op: 'circle', c: 6, p: 2 },
      { op: 'intersect', x: 4, y: 7, which: 1 },
      { op: 'circle', c: 2, p: 8 },
      { op: 'intersect', x: 1, y: 9, which: 0 },
      { op: 'intersect', x: 1, y: 9, which: 1 },
      { op: 'circle', c: 10, p: 2 },
      { op: 'intersect', x: 1, y: 12, which: 0 },
      { op: 'circle', c: 11, p: 2 },
      { op: 'intersect', x: 1, y: 14, which: 0 },
      { op: 'intersect', x: 1, y: 14, which: 1 },
    ],
    hint: 'The side of the pentagon and the radius are linked by the golden section (IV.10–11, XIII.9–10). Try: bisect a radius perpendicular to EA at M, and swing MA down onto that diameter.',
  },
  {
    id: 'mean',
    prop: '6.13',
    title: 'A square root',
    brief: 'Find D on the perpendicular to AC at B with BD² = AB·BC: the mean proportional.',
    givens: [
      { name: 'A', kind: 'point', at: [v(-1.6, -0.6)] },
      { name: 'C', kind: 'point', at: [v(1.6, -0.6)] },
      { name: 'B', kind: 'point', between: { a: 0, b: 1, t: 0.3 } },
    ],
    requirements: [
      pointReq('D with BD ⟂ AC and BD² = AB·BC', (p, g) => {
        const [A, C, B] = [gp(g, 0), gp(g, 1), gp(g, 2)];
        return perpTo(B, p, A, C) && near(dist(B, p) ** 2, dist(A, B) * dist(B, C));
      }),
    ],
    reference: [
      { op: 'tool', tool: 'midpoint', args: [0, 1] },
      { op: 'circle', c: 3, p: 0 },
      { op: 'line', a: 0, b: 1 },
      { op: 'tool', tool: 'perpendicular', args: [2, 5] },
      { op: 'intersect', x: 6, y: 4, which: 1 },
    ],
    unlocks: 'meanProportional',
    hint: 'The angle in a semicircle is right (III.31); then use similar triangles (VI.8).',
  },
];

export const levelById = new Map(LEVELS.map((l) => [l.id, l]));

/** The tools available when playing a level: the primitives, and those unlocked so far. */
export function toolsFor(unlocked: Set<string>): string[] {
  const order = ['line', 'circle', 'equilateral', 'compass', 'bisectAngle', 'midpoint', 'perpendicular', 'copyAngle', 'parallel', 'square', 'centre', 'tangent', 'circumcircle', 'meanProportional'];
  return order.filter((t) => t === 'line' || t === 'circle' || unlocked.has(t));
}

/** The tools the reference solution of a level may use: everything unlocked by earlier levels. */
export function toolsBefore(levelId: string): Set<string> {
  const s = new Set<string>();
  for (const l of LEVELS) {
    if (l.id === levelId) break;
    if (l.unlocks) s.add(l.unlocks);
  }
  return s;
}
