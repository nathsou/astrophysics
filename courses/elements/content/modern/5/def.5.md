---
title: Same ratio (Eudoxus)
---
**Definition.** Let $a, b$ be magnitudes of one kind and $c, d$ magnitudes of one kind (the two kinds may differ: $a, b$ can be lines while $c, d$ are areas). Then $a : b = c : d$ means that for **all** positive integers $m, n$,
$$ma > nb \iff mc > nd, \qquad ma = nb \iff mc = nd, \qquad ma < nb \iff mc < nd.$$
In one line: $\operatorname{sign}(ma - nb) = \operatorname{sign}(mc - nd)$ for every pair $(m, n)$. Euclid's "equimultiples of the first and third" are $ma$ and $mc$ (the same $m$), and "equimultiples of the second and fourth" are $nb$ and $nd$ (the same $n$).

**What it really says.** Divide by $mb$: $ma > nb$ means $\frac{a}{b} > \frac{n}{m}$. So the definition compares the ratio with every fraction $n/m$, and declares two ratios equal when no fraction can tell them apart: every fraction below one is below the other, and every fraction above one is above the other. Nothing here requires $a/b$ to *be* a number. It only uses operations Euclid can perform on magnitudes: add a magnitude to itself $m$ times, and compare two magnitudes of the same kind.

**Why this was needed.** The older theory, which Euclid keeps for numbers in Book VII ([[7.def.20]]), calls $a, b, c, d$ proportional when $a$ is the same part or parts of $b$ that $c$ is of $d$. That presupposes a common unit: $a = p u$ and $b = q u$, so the ratio is $p : q$. The diagonal and the side of a square have no common measure ([[10.def1.1]]): if they had, $2q^2 = p^2$ for whole numbers $p, q$, which is impossible. So the old definition says nothing at all about the ratio of the diagonal to the side, and any theorem of similar figures that uses it is unproved for most triangles.

Eudoxus' definition does not care. For the diagonal $a$ and the side $b$, the comparison $ma \gtrless nb$ is never an equality, and it is "greater" exactly when $n^2 < 2m^2$. Take a second, larger square with diagonal $c$ and side $d$: the same comparisons come out the same way for every $(m, n)$, so $a : b = c : d$, even though neither ratio is a ratio of numbers.

::eudoxus-grid{left="sqrt2" right="1.4142"}

In the grids above, each cell is a pair $(m, n)$. Choose the same ratio on both sides (try $3 : 2$ and $6 : 4$) and the grids are identical. Choose $\sqrt2 : 1$ and $1.4142 : 1$ and they agree on every cell you can show, yet they are different ratios: the first disagreement is at $m = 169$, $n = 239$. A finite check can prove two ratios different, never equal. That is why the definition quantifies over *all* $m, n$, and why Euclid's proofs never check cases: they show that the comparisons agree for an arbitrary pair.

**The cut.** The red cells of a grid are the fractions $n/m$ with $n/m < a/b$. Write
$$L(a : b) = \{\, n/m \in \mathbb{Q}_{>0} : nb < ma \,\}.$$
Def. 5 says exactly that $a : b = c : d$ if and only if $L(a:b) = L(c:d)$. (The "equal" clause adds nothing: if $a : b$ equals the fraction $n/m$, then it is the least fraction not in $L$.) Def. 7 says that $a : b > c : d$ when some fraction lies in $L(a:b)$ but not in $L(c:d)$. So a ratio *is* determined by, and determines, a set of rationals closed downwards: the black staircase in the widget is its boundary. In 1872 Richard Dedekind took such sets as the *definition* of the real numbers. Dedekind's cuts are Eudoxus' test turned into objects.

:::gap What Def. 5 does not provide
Def. 5 says when two ratios are equal. It does not say that a ratio exists for every cut, or that for given $a, b, c$ there is a $d$ with $a : b = c : d$. Euclid assumes the latter (the *fourth proportional*) in the proof of [[5.18]], and proves it only for straight lines, in [[6.12]]. The definition is also useless unless multiples of a magnitude eventually exceed any other magnitude of its kind: that is [[5.def.4]], the Archimedean property, which Euclid uses in [[5.8]] without stating it as an axiom.
:::

:::code Equality you can refute but not confirm
```ts
// sign(m·a − n·b) for magnitudes given as exact values (here: numbers)
const cmp = (x: number, y: number) => Math.sign(x - y);

// Def. 5 as a predicate. It is Π₁: a counterexample is a finite witness,
// but no finite run can return true for all (m, n).
function sameRatioUpTo(a: number, b: number, c: number, d: number, N: number) {
  for (let m = 1; m <= N; m++)
    for (let n = 1; n <= N; n++)
      if (cmp(m * a, n * b) !== cmp(m * c, n * d)) return { differ: [m, n] };
  return { differ: null }; // "no difference found yet", not "equal"
}
```
Equality of real numbers is undecidable in general for the same reason: it is a statement about infinitely many rational approximations.
:::

:::leads Where it leads
With Def. 5 the rest of Book V proves the algebra of ratios ([[5.16]], [[5.18]], [[5.22]]) without numbers. Book VI then uses it for similar figures: [[6.1]] compares triangles with their bases, and [[6.2]] is the proportionality theorem for parallels, now valid for incommensurable segments. In modern terms, the ratios of an Archimedean ordered kind of magnitudes embed in the positive reals (Hölder, 1901), and Def. 5 is the definition of that embedding.
:::
