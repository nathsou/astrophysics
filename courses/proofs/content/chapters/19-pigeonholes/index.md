---
number: 19
title: Pigeonholes
summary: If there are more pigeons than holes, some hole holds two. From this triviality come Dirichlet’s theorem on approximating irrationals by fractions, the Erdős–Szekeres theorem on monotone subsequences, and the birth of Ramsey theory at a party of six.
duration: About 2 hours
prerequisites: [infinitely-many-primes]
theorems: [Dirichlet’s approximation theorem (1842), The Erdős–Szekeres theorem (1935), R(3, 3) = 6]
techniques: [pigeonhole principle, choosing the right holes, counting]
---

At any moment there are two people in London with exactly the same number of hairs on their heads. You don't need to count anyone's hair to be sure: a head has at most about 150,000 hairs, and London has about nine million people. Nine million people, 150,001 possible hair counts — someone must share.

:::theorem{name="The pigeonhole principle" who="Dirichlet" year=1834}
If more than $n$ objects are placed in $n$ boxes, some box contains at least two objects. More generally, if more than $kn$ objects are placed in $n$ boxes, some box contains at least $k + 1$.
:::

:::proof
If every box contained at most $k$ objects, there would be at most $kn$ objects in total.
:::

That is the whole proof. The principle is so obvious that it seems useless — Peter Gustav Lejeune Dirichlet, who used it systematically, called it the *Schubfachprinzip*, the drawer principle. Its power lies entirely in the choice of objects and boxes. Every proof in this chapter is a two-line argument once you have found the right boxes, and finding them is the art.

## A problem for a twelve-year-old

Paul Erdős liked to test young mathematicians with this problem. Around 1959 he put it to Lajos Pósa, then about twelve, over dinner. Pósa solved it before finishing his soup.

:::theorem
Among any $n + 1$ numbers chosen from $1, 2, \ldots, 2n$, one divides another.
:::

Try it for $n = 5$: choose six numbers from $1, \ldots, 10$ with none dividing another. You can't. The trick is to find $n$ boxes.

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Write every number as a power of $2$ times an odd number. There are only $n$ odd numbers up to $2n$ — so two of the chosen numbers have the same odd part, and then the smaller divides the larger.
:::
:::level[Proof]
Every positive integer can be written uniquely as $m = 2^k \cdot r$ with $r$ odd (Chapter 6). If $m \le 2n$, then $r$ is one of the $n$ odd numbers $1, 3, \ldots, 2n - 1$. So the $n + 1$ chosen numbers fall into $n$ boxes labelled by their odd parts, and two of them, say $2^j r$ and $2^k r$ with $j < k$, share a box. Then $2^j r$ divides $2^k r$.
:::
::::

## Approximating irrationals

Since the Babylonians, people have approximated $\pi$ by fractions: $\frac{22}{7}$ (Archimedes), and $\frac{355}{113}$, which Zu Chongzhi found in fifth-century China and which is correct to six decimal places. How good can such approximations be? For any denominator $q$, the nearest fraction $\frac pq$ is within $\frac1{2q}$ of $\alpha$. Dirichlet showed that, for well-chosen $q$, one can do much better.

:::theorem{name="Dirichlet’s approximation theorem" who="Peter Gustav Lejeune Dirichlet" year=1842}
For every real number $\alpha$ and every positive integer $N$, there are integers $p$ and $q$ with $1 \le q \le N$ and
$$|q\alpha - p| < \frac1N, \qquad\text{so}\qquad \left|\alpha - \frac pq\right| < \frac{1}{qN} \le \frac{1}{q^2} .$$
:::

::dirichlet-boxes

:::proof
Consider the $N + 1$ numbers $\{0 \cdot \alpha\}, \{1 \cdot \alpha\}, \ldots, \{N\alpha\}$, where $\{x\} = x - \lfloor x \rfloor$ is the fractional part, and the $N$ boxes $[0, \frac1N), [\frac1N, \frac2N), \ldots, [\frac{N-1}{N}, 1)$. Two of the numbers, $\{i\alpha\}$ and $\{j\alpha\}$ with $i < j$, lie in the same box, so they differ by less than $\frac1N$. Let $q = j - i$ and $p = \lfloor j\alpha \rfloor - \lfloor i\alpha \rfloor$. Then
$$|q\alpha - p| = \big|(j\alpha - \lfloor j\alpha\rfloor) - (i\alpha - \lfloor i\alpha\rfloor)\big| = \big|\{j\alpha\} - \{i\alpha\}\big| < \frac1N,$$
and $1 \le q \le N$. Dividing by $q$ gives the second inequality.
:::

:::corollary
If $\alpha$ is irrational, there are infinitely many fractions $\frac pq$ with $\left|\alpha - \frac pq\right| < \frac1{q^2}$.
:::

:::proof
Suppose there were only finitely many. Since $\alpha$ is irrational, each of them has $|\alpha - \frac pq| > 0$; choose $N$ so large that $\frac1N$ is smaller than all these differences. Dirichlet's theorem gives a fraction with $|\alpha - \frac pq| < \frac1{qN} \le \frac1N$, which must be a new one — a contradiction.
:::

Compare with Liouville (Chapter 17): an algebraic number of degree $d$ can't be approximated *better* than about $\frac1{q^d}$. For $\sqrt 2$ (degree $2$) the two results meet: $\frac1{q^2}$ is, up to a constant, exactly the right rate — and Theon's ladder of Chapter 3 produces the approximations. In 1891 Adolf Hurwitz sharpened the constant: infinitely many fractions satisfy $|\alpha - \frac pq| < \frac1{\sqrt5\,q^2}$, and $\sqrt 5$ cannot be improved — the golden ratio is the “most irrational” number.

## Monotone subsequences

In 1933 a young Hungarian, Esther Klein, noticed that any five points in the plane, no three on a line, include four that form a convex quadrilateral. Her friends George Szekeres and Paul Erdős generalised the question, and on the way proved this.:cite[erdos-szekeres]

:::theorem{name="The Erdős–Szekeres theorem" who="Paul Erdős and George Szekeres" year=1935}
Every sequence of $n^2 + 1$ distinct real numbers contains an increasing subsequence of length $n + 1$ or a decreasing subsequence of length $n + 1$.
:::

::erdos-szekeres

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Label each term with a pair $(i, d)$: the lengths of the longest increasing and longest decreasing subsequences ending at it. No two terms get the same pair. If every label were at most $n$ in both coordinates, there would be only $n^2$ possible pairs for $n^2 + 1$ terms — pigeonhole.
:::
:::level[Proof]
Let the sequence be $a_1, \ldots, a_{n^2+1}$, and for each $k$ let $i_k$ and $d_k$ be the lengths of the longest increasing and decreasing subsequences ending at $a_k$.

*The pairs $(i_k, d_k)$ are all different.* Take $j < k$. If $a_j < a_k$, then any increasing subsequence ending at $a_j$ can be extended by $a_k$, so $i_k \ge i_j + 1$. If $a_j > a_k$, similarly $d_k \ge d_j + 1$. Either way $(i_j, d_j) \ne (i_k, d_k)$.

*Pigeonhole.* If all $i_k \le n$ and $d_k \le n$, the pairs would lie in $\{1, \ldots, n\}^2$, which has only $n^2$ elements — but there are $n^2 + 1$ different pairs. So some $i_k$ or $d_k$ is at least $n + 1$.
:::
::::

The bound is sharp: the sequence $3, 2, 1, 6, 5, 4, 9, 8, 7$ has $n^2 = 9$ terms and no monotone subsequence of length $4$. Klein's problem became known as the *happy ending problem*, because she and Szekeres married. Whether every set of $2^{k-2} + 1$ points in general position contains a convex $k$-gon, as Erdős and Szekeres conjectured, is still open.

## A party of six

At any party of six people, there are three who all know each other or three who are all strangers. To see it, draw six points, one per person, and join every pair with a line: red if they know each other, blue if not. The claim is that every such colouring contains a triangle of a single colour. Play the game below — Gustavus Simmons's game of *Sim* — and you will find that the last few moves are always forced into a triangle.

::ramsey-game

:::theorem{name="R(3, 3) = 6"}
If the fifteen lines joining six points are each coloured red or blue, there is a triangle with all three sides the same colour. This is false for five points.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Pick one point. Five lines leave it, so (pigeonhole) at least three are the same colour — say red — going to $B, C, D$. If any line among $B, C, D$ is red, it closes a red triangle; if none is, $BCD$ is a blue triangle.
:::
:::level[Proof]
Let $A$ be one of the six points. Of the five lines from $A$, at least $\lceil 5/2 \rceil = 3$ have the same colour; say $AB$, $AC$, $AD$ are red (the blue case is symmetric). If one of $BC$, $CD$, $BD$ is red, say $BC$, then $ABC$ is a red triangle. Otherwise all three are blue, and $BCD$ is a blue triangle.

For five points, colour the sides of a regular pentagon red and its diagonals (a pentagram) blue. The red lines form a 5-cycle and the blue lines another, and neither contains a triangle.
:::
::::

This is the simplest case of a theorem proved by the young Cambridge philosopher Frank Ramsey in 1930, in a paper about logic: for every $k$, any large enough party contains $k$ mutual acquaintances or $k$ mutual strangers. The smallest such party size is the **Ramsey number** $R(k, k)$. We know $R(3,3) = 6$ and $R(4, 4) = 18$ (found by Greenwood and Gleason in 1955). For $R(5, 5)$ we know only that it lies between $43$ and $46$.

:::aside
Erdős told a story about this. Suppose aliens invade and threaten to destroy the Earth unless we tell them $R(5, 5)$. We should marshal all our computers and mathematicians and attempt to find it. But if they ask for $R(6, 6)$, we should try to destroy the aliens. The difficulty is the pigeonhole of all pigeonholes: there are $2^{\binom{43}{2}} = 2^{903}$ colourings of the lines between 43 points to check, far too many for any conceivable computer, and no one has found a cleverer way.
:::

```bug
title: Three strangers
prompt: 'A student “proves” something stronger: at every party of six there are three mutual strangers. Which step is wrong?'
lines:
  - Pick any person A. Five other people remain.
  - By pigeonhole, at least three of them are strangers to A.
  - If two of those three are strangers to each other, they and A are three mutual strangers.
  - If not, those three all know each other — but we wanted strangers, so apply the argument again to them.
wrong: 1
why: |
  Pigeonhole says that at least three of the five are **all friends of A or all strangers to A** — it does not say which. If A knows everyone, there are no strangers to A at all. The stronger claim is false: at a party where everyone knows everyone, there are no three mutual strangers. The real theorem needs both colours.
notes:
  '0': Fine.
```

:::bio{name="Paul Erdős" born=1913 died=1996 place="Budapest, and everywhere"}
Erdős had no home, no job for most of his life, and few possessions beyond a suitcase. He travelled from one mathematician's house to the next, announcing “my brain is open”, working with his hosts for a few days or weeks, and moving on. He wrote about 1,500 papers with over 500 co-authors; mathematicians measure their distance from him by their *Erdős number*. He spoke of “The Book” in which God keeps the most elegant proofs — the inspiration for *Proofs from THE BOOK* — and offered cash prizes for problems he could not solve, from \$10 to \$10,000. He founded the probabilistic method, proving that certain objects exist by showing that a random object has a positive chance of being one, and much of extremal combinatorics.
:::

## Exercises

```prove
title: Five points in a square
prompt: 'Prove that among any five points in a square of side $1$, there are two at distance at most $\frac{\sqrt 2}{2}$ from each other.'
hints:
  - Four boxes. Cut the square into four smaller squares.
  - What is the largest distance between two points in a square of side $\frac12$?
rubric:
  - You divided the square into four squares of side $\frac12$ (the pigeonholes).
  - You argued that two of the five points lie in the same small square (including its boundary).
  - 'You bounded their distance by the diagonal $\frac{\sqrt2}{2}$ of the small square.'
solution: |
  Divide the unit square into four closed squares of side $\frac12$. Every point lies in at least one of them, so by pigeonhole two of the five points lie in the same small square. Any two points of a square of side $\frac12$ are at most a diagonal apart, $\sqrt{\left(\frac12\right)^2 + \left(\frac12\right)^2} = \frac{\sqrt2}{2}$.
```

```blanks
title: Counting pigeons
text: |
  1. To be sure of two socks of the same colour from a drawer of black, white and grey socks, you must take [[a]] socks.

  2. In any group of $367$ people, at least [[b]] share a birthday (counting 29 February).

  3. Any set of $10$ integers contains two whose difference is divisible by $9$, because there are only [[c]] possible remainders modulo $9$.
blanks:
  a: { answer: '4' }
  b: { answer: '2' }
  c: { answer: '9' }
```

:::challenge
**A sum divisible by n.** Prove that from any $n$ integers you can choose some (at least one) whose sum is divisible by $n$. (Hint: look at the $n$ partial sums $a_1$, $a_1 + a_2$, …, $a_1 + \cdots + a_n$ modulo $n$. If none is $0$, how many boxes are left?)
:::

## Further reading

- Ronald Graham, Bruce Rothschild and Joel Spencer, *Ramsey Theory* — the whole subject that grew from the party of six.:cite[grs-ramsey]
- Paul Hoffman, *The Man Who Loved Only Numbers* — a biography of Erdős.:cite[hoffman-erdos]
