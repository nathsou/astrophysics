---
title: Number
---
A number is a collection of units: $2, 3, 4, \dots$ In modern terms, Euclid's numbers are the integers $n \ge 2$.

A number is a count, not a point on a line. Euclid draws numbers as line segments, and the figures here draw them as rods marked off in units, but the arguments never use geometry. They use only comparing ("greater", "less"), adding, subtracting, and measuring one number by another.

:::code A type
```ts
type Num = number; // an integer ≥ 2; the unit 1 is a separate thing, and 0 does not exist
```
Many of Euclid's case distinctions come from this type being smaller than $\mathbb{N}$: "the greatest common measure" of two coprime numbers would be $1$, which is not a `Num`.
:::
