---
number: 7
title: Fermat’s descent
summary: Every Pythagorean triple, found three ways — by algebra, by factorisation and by drawing lines through a circle — and then the one proof Fermat left us, by infinite descent, of a special case of his Last Theorem.
duration: About 2½ hours
prerequisites: [unique-factorisation]
theorems: [Euclid’s formula for Pythagorean triples, x⁴ + y⁴ = z² has no solutions in positive integers (Fermat)]
techniques: [parametrisation, parity, coprime factors of a square, infinite descent]
---

Some time around 1637, a lawyer in Toulouse was reading a Latin translation of the *Arithmetica* of Diophantus, a third-century Greek book of problems about whole-number and fractional solutions to equations. Next to Problem II.8 — *to divide a given square into two squares* — he wrote in the margin:

> On the other hand, it is impossible to separate a cube into two cubes, or a fourth power into two fourth powers, or in general any power higher than the second into two like powers. I have discovered a truly marvellous proof of this, which this margin is too narrow to contain.

The lawyer was Pierre de Fermat, the claim became known as **Fermat's Last Theorem**, and it took 358 years to prove. Fermat almost certainly did not have a proof for every power. But he did have one for fourth powers, and it is the only complete proof he left us.:cite[weil-nt] This chapter builds up to it. Along the way we will find every solution of the problem Fermat was reading about — every Pythagorean triple.

## Pythagorean triples

A **Pythagorean triple** is a triple of positive integers $(a, b, c)$ with $a^2 + b^2 = c^2$: the sides of a right triangle with whole-number sides. The oldest known list, on the tablet Plimpton 322 from Chapter 0, is nearly four thousand years old. The most famous triples are $(3, 4, 5)$, $(5, 12, 13)$ and $(8, 15, 17)$.

If $(a, b, c)$ is a triple, so is $(ka, kb, kc)$: multiplying by $k$ scales both sides by $k^2$. So the interesting triples are the **primitive** ones, where $a$, $b$ and $c$ have no common factor. Every triple is a multiple of a primitive one. Here are all triples up to a bound; the primitive ones are the big dots, and the rest lie on rays from the origin through them.

::triple-scatter

Look for structure. Raise the bound and the primitive triples line up along curves — parabolas, it turns out — and the reason is the formula we are about to prove.

:::theorem{name="Euclid’s formula" who="Euclid, Elements X, Lemma 1 to Prop. 29" year="c. 300 BC"}
The primitive Pythagorean triples are exactly the triples
$$a = m^2 - n^2, \qquad b = 2mn, \qquad c = m^2 + n^2$$
(up to swapping $a$ and $b$), where $m > n > 0$ are coprime integers, not both odd.
:::

Checking that these *are* triples is algebra:

```step
title: Euclid’s formula works
prompt: 'Show that $(m^2 - n^2)^2 + (2mn)^2 = (m^2 + n^2)^2$.'
start: (m^2 - n^2)^2 + (2m n)^2
target: (m^2 + n^2)^2
relation: '='
initial: (m^2 - n^2)^2 + (2m n)^2
hints:
  - 'Expand: $(m^2 - n^2)^2 = m^4 - 2m^2n^2 + n^4$.'
solution: '$(m^2-n^2)^2 + 4m^2n^2 = m^4 + 2m^2n^2 + n^4 = (m^2+n^2)^2$.'
```

The real content is the converse: *every* primitive triple arises this way. That needs a small lemma, which comes straight from unique factorisation (Chapter 6).

:::lemma
If $u$ and $v$ are coprime positive integers and $uv$ is a perfect square, then $u$ and $v$ are both perfect squares.
:::

:::proof
In the prime factorisation of $uv = w^2$, every prime appears to an even power. Since $u$ and $v$ share no prime, each prime of $uv$ comes entirely from $u$ or entirely from $v$, with its full, even exponent. So every prime in $u$ has an even exponent, and $u$ is a square; likewise $v$.
:::

::::zoom{levels="Idea, Sketch, Proof"}
:::level[Idea]
Exactly one leg is even; call it $b$. Then $b^2 = c^2 - a^2 = (c - a)(c + a)$. After dividing by $4$, the two factors are coprime and multiply to a square, so each is a square: $m^2$ and $n^2$.
:::
:::level[Sketch]
Squares are $0$ or $1$ modulo $4$. If $a$ and $b$ were both odd, $c^2 = a^2 + b^2 \equiv 2 \pmod 4$, impossible; they can't both be even (primitive). So say $b$ is even and $a$, $c$ are odd. Then $\left(\frac b2\right)^2 = \frac{c+a}{2} \cdot \frac{c-a}{2}$, and the two factors are coprime integers. So $\frac{c+a}2 = m^2$ and $\frac{c-a}2 = n^2$, giving $c = m^2 + n^2$, $a = m^2 - n^2$, $b = 2mn$.
:::
:::level[Proof]
Let $(a, b, c)$ be a primitive triple. Any prime dividing two of $a, b, c$ divides the third (by the equation), so $a, b, c$ are pairwise coprime; in particular $a$ and $b$ are not both even. Every square is $0$ or $1$ modulo $4$, so if $a$ and $b$ were both odd, $c^2 \equiv 2 \pmod 4$ — impossible. So exactly one of them is even; call it $b$. Then $a$ and $c$ are odd.

Now $b^2 = c^2 - a^2 = (c + a)(c - a)$, and $c + a$, $c - a$ are both even. Put $u = \frac{c+a}{2}$ and $v = \frac{c - a}{2}$, positive integers with $uv = \left(\frac b2\right)^2$. Any common divisor of $u$ and $v$ divides $u + v = c$ and $u - v = a$, so $\gcd(u, v) = 1$. By the lemma, $u = m^2$ and $v = n^2$ for positive integers $m > n$. Then $c = u + v = m^2 + n^2$, $a = u - v = m^2 - n^2$ and $b = 2\sqrt{uv} = 2mn$. Finally $\gcd(m, n) = 1$ (a common factor would divide $a, b, c$), and $m, n$ are not both odd (else $a$ and $c$ would be even).
:::
::::

```bug
title: Too quick with the squares
prompt: 'This argument tries to find all triples $a^2 + b^2 = c^2$ more quickly. Which step is unjustified?'
lines:
  - We have $b^2 = c^2 - a^2 = (c + a)(c - a)$.
  - A product is a square, so each factor is a square.
  - So $c + a = m^2$ and $c - a = n^2$ for some integers $m, n$.
  - Hence $c = \frac{m^2 + n^2}{2}$, $a = \frac{m^2 - n^2}{2}$ and $b = mn$.
wrong: 1
why: |
  A product of two numbers can be a square without either being one: $2 \times 8 = 16$. The lemma needs the factors to be **coprime**. For the triple $(3, 4, 5)$, $c + a = 8$ and $c - a = 2$ — neither is a square. The correct proof first divides by $4$ to make the factors coprime.
```

## A geometric view: rational points on a circle

There is a completely different way to find the same formula, and it is one of the great ideas of number theory. Dividing $a^2 + b^2 = c^2$ by $c^2$ gives
$$\left(\frac ac\right)^2 + \left(\frac bc\right)^2 = 1 :$$
a Pythagorean triple is a point with *rational* coordinates on the unit circle $x^2 + y^2 = 1$. How can we find all such points?

We know one: $(-1, 0)$. Draw any line through it with rational slope $t$. It meets the circle in one more point, and — because the line's equation has rational coefficients and one intersection is rational — the other intersection is rational too. Conversely, the line from $(-1, 0)$ to any rational point on the circle has rational slope. So rational points correspond to rational slopes.

::rational-circle

Substituting $y = t(x + 1)$ into $x^2 + y^2 = 1$ and dividing out the known root $x = -1$ gives
$$x = \frac{1 - t^2}{1 + t^2}, \qquad y = \frac{2t}{1 + t^2}.$$
With $t = n/m$ this is $\left(\frac{m^2 - n^2}{m^2 + n^2}, \frac{2mn}{m^2 + n^2}\right)$ — Euclid's formula, found by a line and a circle.

```step
title: The point is on the circle
prompt: 'Verify that $\left(\frac{1-t^2}{1+t^2}\right)^2 + \left(\frac{2t}{1+t^2}\right)^2 = 1$.'
start: ((1 - t^2)/(1 + t^2))^2 + (2t/(1 + t^2))^2
target: '1'
relation: '='
initial: ((1 - t^2)/(1 + t^2))^2 + (2t/(1 + t^2))^2
hints:
  - Put everything over $(1 + t^2)^2$.
solution: '$\dfrac{(1-t^2)^2 + 4t^2}{(1+t^2)^2} = \dfrac{1 + 2t^2 + t^4}{(1+t^2)^2} = 1$.'
```

This method — find one rational point, then sweep lines through it — works for every conic section, and a version of it (the “chord and tangent” method) organises the rational points on cubic curves, the *elliptic curves* at the heart of Wiles's proof of Fermat's Last Theorem.

## Fermat's descent

Now for Fermat's proof. The version we give is about fourth powers.

:::theorem{name="Fermat’s theorem on fourth powers" who="Pierre de Fermat" year="c. 1640"}
There are no positive integers $x$, $y$, $z$ with $x^4 + y^4 = z^2$.
:::

:::corollary{name="Fermat’s Last Theorem for n = 4"}
There are no positive integers with $x^4 + y^4 = w^4$.
:::

:::proof
A solution would give $x^4 + y^4 = (w^2)^2$, a solution of the theorem's equation with $z = w^2$.
:::

Proving something *stronger* — with $z^2$ instead of $w^4$ — is again the inventor's paradox of Chapter 5: the stronger statement is what makes the descent close up. The idea is Fermat's **infinite descent**, which we met in Chapter 3: from any solution, build another in smaller positive integers. Since positive integers cannot decrease for ever, there is no solution at all.

::::zoom{levels="Idea, Sketch, Proof"}
:::level[Idea]
A solution makes $(x^2, y^2, z)$ a Pythagorean triple. Apply Euclid's formula to it — and then again to a second triple that appears inside the first. Unique factorisation then produces a new solution $u^4 + v^4 = w^2$ with $w < z$.
:::
:::level[Sketch]
Take a solution with $z$ as small as possible. Then $(x^2, y^2, z)$ is a primitive triple, so (with $y$ even) $x^2 = m^2 - n^2$, $y^2 = 2mn$, $z = m^2 + n^2$. The first equation says $(x, n, m)$ is again a triple, so $n = 2rs$, $x = r^2 - s^2$, $m = r^2 + s^2$. Then $y^2 = 4rs(r^2 + s^2)$, and the three factors $r$, $s$, $r^2 + s^2$ are pairwise coprime, so each is a square: $r = u^2$, $s = v^2$, $r^2 + s^2 = w^2$. That says $u^4 + v^4 = w^2$ — with $w \le m < z$.
:::
:::level[Proof]
Suppose there is a solution in positive integers, and choose one with $z$ as small as possible.

*The solution is primitive.* If a prime $p$ divided both $x$ and $y$, then $p^4 \mid z^2$, so $p^2 \mid z$, and $(x/p, y/p, z/p^2)$ would be a smaller solution. So $\gcd(x, y) = 1$, and $(x^2, y^2, z)$ is a primitive Pythagorean triple.

*First application of Euclid's formula.* Exactly one of $x^2, y^2$ is even; say $y$ is even. Then there are coprime $m > n > 0$, not both odd, with
$$x^2 = m^2 - n^2, \qquad y^2 = 2mn, \qquad z = m^2 + n^2 .$$

*Second application.* The first equation reads $x^2 + n^2 = m^2$, and $\gcd(m, n) = 1$, so $(x, n, m)$ is a primitive triple. Since $x$ is odd, $n$ is the even leg: there are coprime $r > s > 0$ with
$$x = r^2 - s^2, \qquad n = 2rs, \qquad m = r^2 + s^2 .$$

*Squares.* Now $y^2 = 2mn = 4rs(r^2 + s^2)$, so $\left(\frac y2\right)^2 = r \cdot s \cdot (r^2 + s^2)$. These three factors are pairwise coprime: $\gcd(r, s) = 1$, and a prime dividing $r$ and $r^2 + s^2$ would divide $s^2$, hence $s$. By the lemma (applied twice), each is a perfect square: $r = u^2$, $s = v^2$, $r^2 + s^2 = w^2$ with $u, v, w$ positive integers.

*Descent.* Then $u^4 + v^4 = r^2 + s^2 = w^2$: a new solution. And $w \le w^2 = m \le m^2 < m^2 + n^2 = z$. This contradicts the minimality of $z$. So there is no solution.
:::
::::

Look at the structure: two applications of the same theorem, one use of unique factorisation, and a smaller solution at the end. Fermat's own proof, written in the margin next to Diophantus VI.26, proves a closely related statement: *the area of a right triangle with whole-number sides is never a perfect square*. It reduces to the equation $x^4 - y^4 = z^2$ and descends in the same way. He wrote that the margin was too narrow to give it in full — but this time, he gave enough.:cite[weil-nt]

```parsons
title: The shape of a descent
prompt: Put the steps of a proof by infinite descent in order.
lines:
  - Suppose there is a solution, and take one in which a chosen positive integer (here $z$) is as small as possible.
  - Show that this minimal solution has some extra structure (here, it is primitive).
  - Use that structure to build another solution.
  - Show that the new solution has a smaller value of the chosen integer.
  - This contradicts minimality, so there is no solution.
distractors:
  - Check the first few values of $z$ to see that there is no small solution.
explain: A descent never needs to check cases. Its engine is the construction of a smaller solution, and its fuel is well-ordering.
```

:::history{year=1995 title="358 years" people="Pierre de Fermat, Leonhard Euler, Sophie Germain, Ernst Kummer, Andrew Wiles, Richard Taylor"}
Fermat's case $n = 4$ settles every exponent divisible by $4$, so what remained were the odd primes. Euler proved $n = 3$ around 1770. Sophie Germain, corresponding with Gauss under the male pseudonym *Monsieur Le Blanc*, found in the 1820s the first general approach, covering many primes under a condition. Legendre and Dirichlet did $n = 5$ in 1825, and Lamé $n = 7$ in 1839. Kummer's theory of ideal numbers (Chapter 6) handled all “regular” primes — all primes below 100 except 37, 59 and 67.

The final proof came from an unexpected direction. In the 1980s Gerhard Frey and Ken Ribet showed that a counterexample to Fermat would produce an elliptic curve so strange that it could not be *modular*, a deep property conjectured for all elliptic curves by Taniyama and Shimura. In 1994, after seven years' secret work and one year repairing a gap with his former student Richard Taylor, Andrew Wiles proved enough of that conjecture to rule the curve out.:cite[singh-flt]
:::

:::bio{name="Pierre de Fermat" born=1607 died=1665 place="Beaumont-de-Lomagne and Toulouse"}
Fermat was a lawyer and magistrate who did mathematics in his spare time and published almost nothing. We know his work from letters — to Mersenne, Pascal, Frénicle and others — and from the notes in his copy of Diophantus, which his son Samuel published in 1670. With Descartes he invented analytic geometry; with Pascal, probability theory; his method for finding maxima and tangents anticipated calculus. But his great love was number theory, which he practically recreated: Fermat's little theorem (Chapter 8), the two-squares theorem (Chapter 9) and Pell's equation all start with him. He often challenged others with problems he claimed to have solved, and he was nearly always right.
:::

## Exercises

```blanks
title: Making triples
prompt: Use Euclid's formula.
text: |
  With $m = 5$ and $n = 2$: $a = m^2 - n^2 = $ [[a]], $b = 2mn = $ [[b]], $c = m^2 + n^2 = $ [[c]].

  With $m = 4$ and $n = 1$ we get the triple ( [[a2]] , [[b2]] , [[c2]] ).

  With $m = 3$, $n = 1$ we get $(8, 6, 10)$, which is *not* primitive, because $m$ and $n$ are both [[par]].
blanks:
  a: { answer: '21' }
  b: { answer: '20' }
  c: { answer: '29' }
  a2: { answer: '15' }
  b2: { answer: '8' }
  c2: { answer: '17' }
  par: { answer: 1, options: [even, odd] }
```

```prove
title: A leg divisible by three
prompt: Prove that in every Pythagorean triple $(a, b, c)$, at least one of $a$ and $b$ is divisible by $3$.
hints:
  - What remainders can a square leave on division by $3$?
  - 'If neither $a$ nor $b$ is divisible by $3$, what is $a^2 + b^2$ modulo $3$? Can $c^2$ be that?'
rubric:
  - 'You showed that every square is $\equiv 0$ or $1 \pmod 3$ (by cases on $n \bmod 3$).'
  - 'You assumed $3 \nmid a$ and $3 \nmid b$ (contrapositive or contradiction) and got $a^2 + b^2 \equiv 2 \pmod 3$.'
  - You concluded that no square is $\equiv 2 \pmod 3$, giving the contradiction.
solution: |
  If $n \equiv 0 \pmod 3$ then $n^2 \equiv 0$; if $n \equiv \pm 1$ then $n^2 \equiv 1 \pmod 3$. So squares are $0$ or $1$ modulo $3$. Suppose neither $a$ nor $b$ is divisible by $3$. Then $a^2 \equiv b^2 \equiv 1$, so $c^2 = a^2 + b^2 \equiv 2 \pmod 3$, which no square is. So $3$ divides $a$ or $b$.
```

```quiz
q: 'Why does proving “$x^4 + y^4 = z^2$ has no solutions” also prove “$x^4 + y^4 = w^8$ has no solutions”?'
options:
  - text: Because $w^8$ is a square, $(w^4)^2$.
    correct: true
    why: Any solution of the second equation gives a solution of the first with $z = w^4$. Stronger theorems imply weaker ones.
  - text: It doesn't; the eighth-power case needs a separate descent.
    why: The fourth-power theorem covers every right-hand side that is a perfect square.
```

:::challenge
**Sixty.** Prove that in every Pythagorean triple, $abc$ is divisible by $60$. (You have $3$ already; show that $4$ divides $a$ or $b$, and that $5$ divides one of $a$, $b$, $c$, by looking at squares modulo $8$ — or modulo $4$ applied to $m$ and $n$ — and modulo $5$.)

**Congruent numbers.** A positive integer is *congruent* if it is the area of a right triangle with *rational* sides. $6$ is (the $3, 4, 5$ triangle); Fibonacci showed in 1225 that $5$ is (sides $\frac32, \frac{20}3, \frac{41}6$ — check it). Fermat's theorem shows that $1$ is not. Deciding which numbers are congruent is still not completely solved: Jerrold Tunnell gave a simple test in 1983, but it relies on the unproven Birch and Swinnerton-Dyer conjecture, one of the seven Millennium Prize Problems.
:::

## Further reading

- André Weil, *Number Theory: An Approach Through History from Hammurapi to Legendre* — a great mathematician's account of Fermat's methods, including the descent.:cite[weil-nt]
- Simon Singh, *Fermat's Last Theorem* — the story of the 358-year hunt, for everyone.:cite[singh-flt]
