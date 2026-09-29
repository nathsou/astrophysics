// Helpers for Book II. Every figure of the book is built on a given straight line AB, with its
// squares and rectangles hanging below it as in Heath's diagrams. `frame(A, B)` gives coordinates
// in that picture: x measured along AB from A, y measured downwards (to the right of A→B), so
// that the figures follow the line when A or B is dragged.

import { add, mul, perp, sub, unit, type V } from '../../geometry/vec';

export type Frame = (x: number, y: number) => V;

export function frame(A: V, B: V): Frame {
  const u = unit(sub(B, A));
  const down = mul(perp(u), -1);
  return (x, y) => add(A, add(mul(u, x), mul(down, y)));
}

/** The downward unit normal of AB (the side on which Book II draws its squares). */
export const below = (A: V, B: V): V => mul(perp(unit(sub(B, A))), -1);
