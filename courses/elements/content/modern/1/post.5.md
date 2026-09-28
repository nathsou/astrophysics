---
title: The parallel postulate
---
**Statement.** If a line crossing two lines makes the interior angles on one side together less than two right angles, then the two lines, extended far enough, meet on that side.

In symbols: if a transversal meets lines $\ell$ and $m$ with interior angles $\alpha$ and $\beta$ on one side, and $\alpha + \beta < \pi$, then $\ell$ and $m$ meet on that side.

It is unlike the other postulates. They describe things you can do (draw, extend, describe) or a simple fact (right angles are equal). This one is long, has a hypothesis, and asserts that something happens *arbitrarily far away*, which no finite drawing can check. It is the converse of [[1.17]], which Euclid proves. And he holds it back: [[1.1]]–[[1.28]] never use it. Its first use is [[1.29]].

**Equivalent forms.** In neutral geometry (the other axioms, with Postulate 5 left out), each of the following is equivalent to Postulate 5:

- *Playfair's axiom*: through a point not on a line there is at most one parallel to the line. (At least one is a theorem: [[1.31]].)
- The angles of every triangle add up to two right angles ([[1.32]]).
- There is a rectangle.
- There are two triangles that are similar but not congruent (Wallis).
- The points at a fixed distance from a line, on one side, form a line.
- Any three points not on a line lie on a circle.
- Pythagoras' theorem ([[1.47]]).

(For some of these, the Archimedean property is also assumed.) Playfair's form is the one usually quoted today, because it is short and says plainly what is at stake: the uniqueness of parallels.

:::history Two thousand years of attempted proofs
Many geometers tried to prove the postulate from the others: Ptolemy and Proclus in antiquity, then mathematicians of the medieval Islamic world, among them Ibn al-Haytham, Omar Khayyam and Nasir al-Din al-Tusi, then Wallis, Saccheri (1733), Lambert and Legendre. Every attempt turned out to assume an equivalent statement without noticing, such as "parallel lines are equidistant". Saccheri came closest. He assumed the postulate false and derived consequences, hoping for a contradiction; what he actually found, without recognizing it, was the beginning of a consistent new geometry.
:::

**Independence.** Around 1830, Lobachevsky and Bolyai, and privately Gauss, developed *hyperbolic geometry*: all of Euclid's axioms except the fifth, with Playfair's axiom replaced by "through a point not on a line there are at least two parallels". In 1868 Beltrami gave a model of it inside Euclidean geometry, later refined by Klein and Poincaré. In the Poincaré disk, "points" are the points inside a circle and "lines" are arcs of circles meeting the boundary at right angles. All of Euclid's other axioms hold there, and Postulate 5 fails. So if Euclidean geometry is consistent, so is hyperbolic geometry, and Postulate 5 cannot be proved from the others: it is *independent*.

:::code A consistency proof is a program
A model is an interpreter. Beltrami and Poincaré implemented the type `Point`, the function `join` and the congruence relation of hyperbolic geometry on top of Euclidean geometry. Every theorem of neutral geometry is then true of the implementation, since it satisfies the axioms. A proof of Postulate 5 from the other axioms would therefore also be a proof about the implementation, where it is visibly false. Independence proofs in logic, like the independence of the continuum hypothesis, work the same way.
:::

:::leads What changes without it
In hyperbolic geometry the angle sum of a triangle is less than two right angles, and the *defect* (the shortfall) is proportional to the area, so triangles cannot be arbitrarily large. Similar triangles are congruent. There are no rectangles and no squares, so [[1.46]] and [[1.47]] fail; for a right triangle, $\cosh c = \cosh a \cosh b$ replaces Pythagoras. On small scales hyperbolic geometry is almost Euclidean, which is why no measurement Euclid could make would have decided the question. Which geometry describes physical space is an empirical matter; in general relativity, the geometry of spacetime is curved by matter. The [explorations](#/explore/geometries) show the same constructions in both geometries.
:::
