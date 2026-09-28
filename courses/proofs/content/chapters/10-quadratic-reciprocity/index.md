---
number: 10
title: Quadratic reciprocity
summary: When is a number a perfect square modulo a prime? Euler guessed a law linking the questions “is p a square mod q?” and “is q a square mod p?”. Gauss proved it at nineteen and called it the golden theorem. We prove it by counting points in a rectangle.
duration: About 3 hours
prerequisites: [fermats-little-theorem, two-squares]
theorems: [Euler’s criterion, Gauss’s lemma, The law of quadratic reciprocity]
techniques: [pairing, counting modulo 2, lattice-point counting, chains of lemmas]
---

In Chapter 9 we met the question *is $-1$ a square modulo $p$?* — that is, does $x^2 \equiv -1 \pmod p$ have a solution? The answer was: exactly when $p = 2$ or $p \equiv 1 \pmod 4$. What about $2$? Or $3$, or $5$? For each fixed $a$, which primes $p$ make $a$ a square modulo $p$?

This chapter is our number-theory capstone. The answer, the **law of quadratic reciprocity**, is one of the deepest simple statements in mathematics, and its proof is a chain of four short lemmas. None of them is hard; the art is in how they fit together.

## Squares modulo a prime

Fix an odd prime $p$. A number $a$ not divisible by $p$ is a **quadratic residue** modulo $p$ if $a \equiv x^2 \pmod p$ for some $x$, and a **non-residue** otherwise. Modulo $7$, the squares of $1, \ldots, 6$ are $1, 4, 2, 2, 4, 1$: the residues are $1, 2, 4$ and the non-residues $3, 5, 6$. Exactly half are residues, which is always true: $x$ and $-x$ have the same square, and no other pairs do.

Legendre introduced a compact notation:
$$\left(\frac ap\right) = \begin{cases} +1 & \text{if } a \text{ is a quadratic residue mod } p,\\ -1 & \text{if } a \text{ is a non-residue},\\ 0 & \text{if } p \mid a. \end{cases}$$

Now look at the whole table of symbols $\left(\frac pq\right)$ for pairs of odd primes.

::reciprocity-table

Something remarkable is going on. The table is almost symmetric: $p$ is a square modulo $q$ exactly when $q$ is a square modulo $p$ — *unless* both are $\equiv 3 \pmod 4$, in which case exactly one of them is. Turn on the outlines to see it.

:::theorem{name="The law of quadratic reciprocity" who="Euler (conjecture); Gauss (proof)" year="1783; 1796"}
For distinct odd primes $p$ and $q$,
$$\left(\frac pq\right)\left(\frac qp\right) = (-1)^{\frac{p-1}{2}\cdot\frac{q-1}{2}} .$$
So $\left(\frac pq\right) = \left(\frac qp\right)$, unless $p \equiv q \equiv 3 \pmod 4$, in which case $\left(\frac pq\right) = -\left(\frac qp\right)$.
:::

The exponent $\frac{p-1}{2}\cdot\frac{q-1}{2}$ is odd exactly when both $\frac{p-1}{2}$ and $\frac{q-1}{2}$ are odd, that is, when $p \equiv q \equiv 3 \pmod 4$.

Why is this surprising? The question “is $p$ a square modulo $q$?” is about arithmetic modulo $q$; the question “is $q$ a square modulo $p$?” is about arithmetic modulo $p$. There is no obvious reason they should be related at all.

:::history{year=1796 title="The golden theorem" people="Leonhard Euler, Adrien-Marie Legendre, Carl Friedrich Gauss, Gotthold Eisenstein"}
Euler found the law by experiment and stated it in several forms between 1744 and 1783, without proof. Legendre gave it its modern form and a proof in 1785, but his proof assumed an unproven fact — that there are infinitely many primes in certain arithmetic progressions, a special case of Dirichlet's theorem of 1837. On 8 April 1796, a month before his nineteenth birthday, Gauss found the first complete proof, after a year of effort. He called it the *theorema aureum*, the golden theorem, published it in the *Disquisitiones Arithmeticae* in 1801, and over his life found eight different proofs. Today there are more than 300. The one we give, by counting lattice points, is due to Gotthold Eisenstein in 1844 and builds on Gauss's third proof.:cite[lemmermeyer]
:::

## Lemma 1: Euler's criterion

First we need a way to *compute* the Legendre symbol. Fermat's little theorem says $a^{p-1} \equiv 1 \pmod p$, so $a^{(p-1)/2}$ is a number whose square is $1$: it is $\pm 1$. Which sign?

:::theorem{name="Euler’s criterion" who="Leonhard Euler" year=1748}
For an odd prime $p$ and $p \nmid a$: $\displaystyle a^{\frac{p-1}{2}} \equiv \left(\frac ap\right) \pmod p$.
:::

We prove it with a pairing argument, like the involutions of Chapter 9. First, a classical warm-up.

:::lemma{name="Wilson’s theorem"}
For every prime $p$, $(p - 1)! \equiv -1 \pmod p$.
:::

:::proof
Each $x$ in $1, \ldots, p - 1$ has an inverse $x'$ modulo $p$ (with $xx' \equiv 1$), by Bézout. Pair each $x$ with its inverse. Only $x \equiv \pm 1$ are their own inverses, since $x^2 \equiv 1$ means $p \mid (x-1)(x+1)$. The other numbers form pairs with product $1$. So $(p-1)! \equiv 1 \cdot (-1) = -1$.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Pair each $x$ with the $y$ such that $xy \equiv a$. If $a$ is a non-residue, nobody is paired with themselves, so $(p-1)!$ is $a$ to the power of the number of pairs. If $a$ is a residue, exactly two numbers ($\pm\sqrt a$) are left alone, and they change the sign. Compare with Wilson's theorem.
:::
:::level[Proof]
For each $x \in \{1, \ldots, p-1\}$ there is exactly one $y$ in the same range with $xy \equiv a \pmod p$, namely $y \equiv a x'$.

*If $a$ is a non-residue*, then $y \ne x$ always (else $x^2 \equiv a$). So the $p - 1$ numbers split into $\frac{p-1}{2}$ pairs, each with product $\equiv a$, and $(p-1)! \equiv a^{\frac{p-1}{2}}$. By Wilson, $a^{\frac{p-1}{2}} \equiv -1$.

*If $a$ is a residue*, say $a \equiv s^2$, then the $x$ paired with themselves are the solutions of $x^2 \equiv s^2$, i.e. $p \mid (x - s)(x + s)$: exactly $x \equiv \pm s$. The other $p - 3$ numbers form $\frac{p-3}{2}$ pairs with product $a$, while $s \cdot (-s) = -a$. So $(p - 1)! \equiv -a \cdot a^{\frac{p-3}{2}} = -a^{\frac{p-1}{2}}$, and by Wilson $a^{\frac{p-1}{2}} \equiv 1$.
:::
::::

With $a = -1$ this gives $\left(\frac{-1}{p}\right) = (-1)^{\frac{p-1}{2}}$ — the result of Chapter 9, from a different direction. It also shows that the symbol is multiplicative: $\left(\frac{ab}p\right) = \left(\frac ap\right)\left(\frac bp\right)$, because $(ab)^{\frac{p-1}{2}} = a^{\frac{p-1}{2}} b^{\frac{p-1}{2}}$.

## Lemma 2: Gauss's lemma

Euler's criterion is a formula, but $a^{(p-1)/2}$ is still hard to reason about. Gauss found a way to read off the sign by *counting*.

:::theorem{name="Gauss’s lemma" who="Carl Friedrich Gauss" year=1808}
Let $p$ be an odd prime, $p \nmid a$, and $h = \frac{p-1}{2}$. Reduce $a, 2a, \ldots, ha$ modulo $p$ to numbers in $\{1, \ldots, p-1\}$, and let $\mu$ be how many of them are greater than $\frac p2$. Then $\left(\frac ap\right) = (-1)^\mu$.
:::

::gauss-lemma

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Replace each remainder $r > \frac p2$ by $p - r \equiv -r$. The $h$ numbers you get are exactly $1, \ldots, h$ in some order. So the product $a \cdot 2a \cdots ha = a^h h!$ equals $h!$ up to $\mu$ minus signs.
:::
:::level[Proof]
Let $r_k$ be the remainder of $ka$, for $1 \le k \le h$, and let $t_k = r_k$ if $r_k < \frac p2$ and $t_k = p - r_k$ otherwise. Then $t_k \in \{1, \ldots, h\}$ and $ka \equiv \pm t_k$, with a minus sign exactly $\mu$ times.

The $t_k$ are all different. If $t_i = t_j$ with $i \ne j$, then $ia \equiv \pm ja$, so $p \mid (i \mp j)a$, so $p \mid i \mp j$. But $0 < |i - j| < p$ and $0 < i + j < p$. So the $t_k$ are $h$ different numbers in $\{1, \ldots, h\}$: all of them.

Multiplying the congruences $ka \equiv \pm t_k$ for $k = 1, \ldots, h$:
$$a^h \cdot h! \equiv (-1)^\mu \cdot h! \pmod p .$$
Cancel $h!$ (it is coprime to $p$) to get $a^h \equiv (-1)^\mu$, and Euler's criterion finishes the proof.
:::
::::

Notice that this is the shuffling argument of Chapter 8 again, with a twist: the multiples of $a$ are a rearrangement of $1, \ldots, h$ *up to sign*, and the signs are what we count.

## Lemma 3: from signs to floors

Eisenstein's idea was to turn $\mu$ into something that can be counted geometrically.

:::lemma{name="Eisenstein’s lemma" who="Gotthold Eisenstein" year=1844}
If $a$ is odd and $p \nmid a$, then $\displaystyle \mu \equiv \sum_{k=1}^{h} \left\lfloor \frac{ka}{p} \right\rfloor \pmod 2$.
:::

:::proof
Write $ka = p\left\lfloor \frac{ka}p \right\rfloor + r_k$ and sum over $k = 1, \ldots, h$:
$$a \sum k = p \sum \left\lfloor \frac{ka}{p}\right\rfloor + \sum r_k .$$
From the proof of Gauss's lemma, $\sum k = \sum t_k = \sum r_k - 2\sum_{r_k > p/2} r_k + \mu p$ (the large remainders enter as $p - r_k$ instead of $r_k$). Subtracting the two equations,
$$(a - 1)\sum k = p \sum \left\lfloor \frac{ka}p\right\rfloor - \mu p + 2\sum_{r_k > p/2} r_k .$$
Now read this modulo $2$: $a - 1$ is even and $p$ is odd, so $0 \equiv \sum \left\lfloor \frac{ka}p \right\rfloor - \mu \pmod 2$.
:::

So $\left(\frac qp\right) = (-1)^{\sum_{k=1}^{(p-1)/2} \lfloor kq/p \rfloor}$ for every odd prime $q \ne p$. The exponent counts something.

## Lemma 4: counting lattice points

The sum $\sum_{k=1}^{(p-1)/2} \left\lfloor \frac{kq}{p} \right\rfloor$ counts the points with whole-number coordinates $(k, y)$, $1 \le k \le \frac{p-1}{2}$, lying strictly between the $x$-axis and the line $y = \frac qp x$: for each $k$ there are $\left\lfloor \frac{kq}p \right\rfloor$ of them. Symmetrically, $\sum_{j=1}^{(q-1)/2} \left\lfloor \frac{jp}{q} \right\rfloor$ counts the points to the left of the same line.

::eisenstein-lattice

:::proof[Proof of quadratic reciprocity]
Let $P = \frac{p-1}{2}$ and $Q = \frac{q-1}{2}$, and consider the $PQ$ lattice points $(x, y)$ with $1 \le x \le P$ and $1 \le y \le Q$. None lies on the line $y = \frac qp x$: that would need $py = qx$, so $p \mid x$, impossible for $0 < x < p$. Points below the line with $1 \le x \le P$ automatically have $y < \frac qp x < \frac q2$, so $y \le Q$; they number $\sum_{k=1}^{P} \left\lfloor \frac{kq}p\right\rfloor$. Likewise the points above the line number $\sum_{j=1}^{Q} \left\lfloor \frac{jp}q \right\rfloor$. So the two sums add up to $PQ$, and by Eisenstein's lemma (applied twice),
$$\left(\frac qp\right)\left(\frac pq\right) = (-1)^{\sum \lfloor kq/p \rfloor}\,(-1)^{\sum \lfloor jp/q\rfloor} = (-1)^{PQ} .$$
:::

Step back and look at the whole proof: Fermat's little theorem gave Euler's criterion; a sign-counting shuffle gave Gauss's lemma; a parity computation turned the count into floors; and floors turned into points in a rectangle, which can be counted from two sides. Each step is modest. The theorem appears only at the end, when the pieces click together.

```parsons
title: The architecture of the proof
prompt: Order the steps of the proof of quadratic reciprocity.
lines:
  - 'Euler''s criterion: $\left(\frac ap\right) \equiv a^{(p-1)/2} \pmod p$.'
  - 'Gauss''s lemma: $\left(\frac ap\right) = (-1)^\mu$, where $\mu$ counts multiples $ka$ with remainder above $p/2$.'
  - 'Eisenstein''s lemma: for odd $a$, $\mu \equiv \sum_k \lfloor ka/p \rfloor \pmod 2$.'
  - 'The two floor sums count the lattice points below and above the diagonal of a $\frac{p-1}{2} \times \frac{q-1}{2}$ rectangle, so they add up to $\frac{p-1}{2}\cdot\frac{q-1}{2}$.'
  - 'Hence $\left(\frac pq\right)\left(\frac qp\right) = (-1)^{\frac{p-1}{2}\cdot\frac{q-1}{2}}$.'
distractors:
  - 'Since $p$ and $q$ are both prime, $\left(\frac pq\right) = \left(\frac qp\right)$.'
explain: The distractor is the theorem's naive guess — and it is false when both primes are $\equiv 3 \pmod 4$.
```

## Using reciprocity

The law turns an impossible-looking question into a quick calculation, much like Euclid's algorithm. Together with two **supplementary laws** — $\left(\frac{-1}{p}\right) = (-1)^{\frac{p-1}2}$ (Chapter 9) and $\left(\frac 2p\right) = +1$ exactly when $p \equiv \pm 1 \pmod 8$ (a challenge below) — and multiplicativity, it computes any Legendre symbol. Is $59$ a square modulo $101$?

$$\left(\frac{59}{101}\right) = \left(\frac{101}{59}\right) = \left(\frac{42}{59}\right) = \left(\frac{2}{59}\right)\left(\frac{3}{59}\right)\left(\frac{7}{59}\right).$$
The first step uses $101 \equiv 1 \pmod 4$; the second reduces $101$ modulo $59$. Now $59 \equiv 3 \pmod 8$, so $\left(\frac 2{59}\right) = -1$; and $\left(\frac 3{59}\right) = -\left(\frac{59}3\right) = -\left(\frac 23\right) = 1$, and $\left(\frac7{59}\right) = -\left(\frac{59}{7}\right) = -\left(\frac 37\right) = \left(\frac 73\right) = \left(\frac13\right) = 1$. So $\left(\frac{59}{101}\right) = -1$: $59$ is not a square modulo $101$ — found without trying a single square.

```blanks
title: Your turn
prompt: Enter $1$ or $-1$ for each symbol.
text: |
  1. $\left(\frac{3}{101}\right) = \left(\frac{101}{3}\right) = \left(\frac{2}{3}\right) = $ [[a]], so $3$ is not a square mod $101$.

  2. $\left(\frac{5}{101}\right) = \left(\frac{101}{5}\right) = \left(\frac{1}{5}\right) = $ [[b]].

  3. $\left(\frac{13}{17}\right) = \left(\frac{17}{13}\right) = \left(\frac{4}{13}\right) = $ [[c]] (because $4 = 2^2$).

  4. $\left(\frac{7}{11}\right) = -\left(\frac{11}{7}\right) = -\left(\frac{4}{7}\right) = $ [[d]].
blanks:
  a: { answer: '-1' }
  b: { answer: '1' }
  c: { answer: '1' }
  d: { answer: '-1' }
```

:::bio{name="Gotthold Eisenstein" born=1823 died=1852 place="Berlin"}
Eisenstein was a sickly child from a poor Berlin family, and he suffered from tuberculosis for most of his short life. He published a stream of brilliant papers in number theory and the theory of elliptic functions from the age of twenty, and Gauss admired him enormously; a remark attributed to Gauss ranks him with Archimedes and Newton. His lattice-point proof of reciprocity is from 1844, when he was twenty-one. He died at twenty-nine, a few months after being elected to the Berlin Academy.
:::

## Exercises

```prove
title: When is −1 a square?
prompt: 'Using Euler''s criterion, prove that $-1$ is a quadratic residue modulo an odd prime $p$ if and only if $p \equiv 1 \pmod 4$.'
hints:
  - 'Compute $(-1)^{(p-1)/2}$. When is $\frac{p-1}{2}$ even?'
rubric:
  - 'You applied Euler''s criterion: $\left(\frac{-1}{p}\right) \equiv (-1)^{(p-1)/2} \pmod p$.'
  - 'You noted that $1 \not\equiv -1 \pmod p$ for odd $p$, so the congruence determines the sign.'
  - 'You showed $\frac{p-1}{2}$ is even iff $p \equiv 1 \pmod 4$.'
solution: |
  By Euler's criterion $\left(\frac{-1}p\right) \equiv (-1)^{(p-1)/2} \pmod p$. Both sides are $\pm 1$, and $1 \not\equiv -1 \pmod p$ since $p > 2$, so they are equal as integers. $(-1)^{(p-1)/2} = 1$ exactly when $\frac{p-1}2$ is even, i.e. $p - 1 \equiv 0 \pmod 4$.
```

```quiz
q: 'Both $19$ and $23$ are $\equiv 3 \pmod 4$. If $\left(\frac{19}{23}\right) = 1$, what is $\left(\frac{23}{19}\right)$?'
options:
  - text: '$+1$'
    why: Reciprocity flips the sign when both primes are $3 \bmod 4$.
  - text: '$-1$'
    correct: true
    why: '$\frac{19-1}2 \cdot \frac{23-1}2 = 9 \cdot 11 = 99$ is odd, so the product of the two symbols is $-1$.'
  - text: It cannot be determined from the information given.
    why: Reciprocity determines it.
```

:::challenge
**The second supplement.** Use Gauss's lemma with $a = 2$ to prove that $\left(\frac 2p\right) = 1$ exactly when $p \equiv \pm 1 \pmod 8$. (For $a = 2$ the multiples $2, 4, \ldots, p - 1$ need no reduction; count how many exceed $p/2$.) Why can't you use Eisenstein's lemma here?
:::

## Further reading

- Franz Lemmermeyer, *Reciprocity Laws: From Euler to Eisenstein* — the history, and a list of over three hundred proofs.:cite[lemmermeyer]
- Kenneth Ireland and Michael Rosen, *A Classical Introduction to Modern Number Theory* — where reciprocity leads next: Gauss sums, cubic reciprocity, and beyond.:cite[ireland-rosen]
