---
title: Joining two points
---
Any two points can be joined by a straight line (segment).

In modern form: for any points $A \ne B$ there is a line through both, and, as Euclid assumes without saying, only one. The uniqueness is used in [[1.4]] ("two straight lines cannot enclose a space"). Hilbert splits this into two incidence axioms: existence and uniqueness of the line through two distinct points.

:::code A total function
Read as an API, the postulate is `join(a: Point, b: Point): Segment` with the precondition `a !== b`. Uniqueness says it is a function, not a relation: calling it twice gives the same segment. On a sphere, with great circles as lines, the precondition is not enough: antipodal points are joined by infinitely many great circles.
:::
