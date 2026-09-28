---
title: Point
---
A point is a location with no size.

"That which has no part" says what a point is *not*, and no proof ever uses it. Euclid's definitions of point, line and surface describe intuitions; the real work is done by the postulates. Modern axiomatics makes this explicit. Hilbert leaves *point*, *line* and *plane* undefined and characterizes them only by the relations between them: incidence, betweenness and congruence. He is said to have remarked that one must be able to say "tables, chairs and beer mugs" instead of points, lines and planes.

:::code An opaque type
In programming terms a point is an opaque type: no fields are visible, and everything you can know about it comes from the operations that take it as an argument. Coordinates $(x, y)$ are one implementation, not the definition.
:::
