---
title: Greater ratio
---
**Definition.** $a : b > c : d$ when there are positive integers $m, n$ with
$$ma > nb \qquad\text{but}\qquad mc \le nd.$$

In terms of fractions: some $n/m$ lies below $a/b$ but not below $c/d$. With the cuts of [[5.def.5]], $L(c:d) \subsetneq L(a:b)$. One witness $(m, n)$ is enough; the widget in Def. 5 finds the first one.

:::gap Is this an order?
Euclid uses, without proof, that this relation behaves like $>$: that $a : b > c : d$ and $a : b = c : d$ cannot both hold, and that $a : b > c : d$ excludes $c : d > a : b$. Both follow from the definitions (a witness for one is a counterexample to the other, since $L$ is closed downwards), but Euclid never says so. Trichotomy, that one of $>, =, <$ always holds, is also used silently; it follows from the negation of Def. 5.
:::
