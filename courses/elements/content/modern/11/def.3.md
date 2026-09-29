---
title: Line perpendicular to a plane
---
A line is perpendicular to a plane when it makes right angles with *every* line in the plane that meets it.

With vectors: a line with direction $n$ through a point $P$ of a plane is perpendicular to the plane when $n \cdot u = 0$ for every direction $u$ in the plane. Then $n$ is a *normal* of the plane, and the plane through $P$ is $\{X : n \cdot (X - P) = 0\}$.

The definition asks for infinitely many right angles. [[11.4]] shows that two are enough: a line perpendicular to two intersecting lines of the plane, at their point of intersection, is perpendicular to all of them. In vector terms, $n \cdot u = n \cdot w = 0$ implies $n \cdot (su + tw) = 0$.
