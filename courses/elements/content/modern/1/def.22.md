---
title: Quadrilaterals
---
A *square* is equilateral and right-angled; an *oblong* (rectangle) is right-angled but not equilateral; a *rhombus* is equilateral but not right-angled; a *rhomboid* (parallelogram) has opposite sides and angles equal but is neither; other quadrilaterals are *trapezia*.

:::code Sum types versus subtypes
Euclid's classification is a sum type: every quadrilateral is exactly one of five disjoint cases. The modern one is a subtype hierarchy: a square *is a* rectangle and *is a* rhombus, and both are parallelograms. The inclusive version is what theorems need; a theorem about parallelograms, like [[1.34]], should apply to squares without a separate proof.
:::

The definition says nothing about existence. That squares exist is proved in [[1.46]], and the proof needs Postulate 5. In hyperbolic geometry there are no squares, and no rectangles at all: a quadrilateral with four right angles would have an angle sum of four right angles, which hyperbolic quadrilaterals never reach.
