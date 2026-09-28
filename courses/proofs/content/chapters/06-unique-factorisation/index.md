---
number: 6
title: Unique factorisation
summary: Every whole number is a product of primes in exactly one way. Strong induction, Euclid’s algorithm, Bézout’s identity — and a world where factorisation is not unique, which ruined a famous proof of Fermat’s Last Theorem.
duration: About 2½ hours
prerequisites: [infinitely-many-primes, induction]
theorems: [The fundamental theorem of arithmetic, Bézout’s identity, Euclid’s lemma]
techniques: [strong induction, well-ordering, least counterexample]
---

$360 = 2^3 \cdot 3^2 \cdot 5$. However you break $360$ down — $10 \times 36$, or $8 \times 45$, or $2 \times 180$ — you always end up with the same primes, the same number of times. We learn this at school and use it constantly: to simplify fractions, to find common denominators, and in Chapter 3 (without saying so) to see why $\sqrt 2$ is irrational. It feels too obvious to need a proof.

:::theorem{name="The fundamental theorem of arithmetic" who="Euclid; Gauss" year="c. 300 BC; 1801"}
Every whole number $n \ge 2$ can be written as a product of primes, and this factorisation is unique apart from the order of the factors.
:::

The theorem has two halves. *Existence* — every number *has* a prime factorisation — is easy, and we will prove it with a stronger form of induction. *Uniqueness* is where the content lies, and it is less obvious than it looks. Before believing that, visit a world where it fails.

## A world without unique factorisation

David Hilbert liked to show his students the numbers $1, 5, 9, 13, 17, 21, \ldots$ — those that leave remainder $1$ on division by $4$. The product of two such numbers is again one ($(4a+1)(4b+1) = 4(4ab + a + b) + 1$), so they form a little world of their own with its own multiplication. Call a Hilbert number (other than $1$) a *Hilbert prime* if it is not the product of two smaller Hilbert numbers.

::hilbert-numbers

In this world $441 = 9 \times 49 = 21 \times 21$, and $9$, $21$ and $49$ are all Hilbert primes. Every Hilbert number *does* factor into Hilbert primes — the existence proof below works word for word — but not uniquely. So uniqueness cannot follow merely from “multiplication and primes”. It must depend on something special about the ordinary integers. We will find out exactly what.

## Strong induction

To prove existence, the natural argument is: if $n$ is prime, it is its own factorisation; if not, $n = ab$ with smaller $a$ and $b$, which factor, so $n$ does. The trouble is that $a$ and $b$ are not $n - 1$. Ordinary induction lets us assume the statement only for the *previous* number. We need to assume it for *all* smaller numbers.

:::theorem{name="Strong induction"}
Let $P(n)$ be a statement about natural numbers. Suppose that for every $n$, if $P(k)$ holds for **all** $k < n$, then $P(n)$ holds. Then $P(n)$ holds for every natural number $n$.
:::

:::proof
Apply ordinary induction to the statement $Q(n)$: “$P(k)$ holds for all $k < n$”. $Q(0)$ is vacuously true (there is no $k < 0$). If $Q(n)$ holds, then the hypothesis gives $P(n)$, so $P(k)$ holds for all $k < n + 1$: that is $Q(n+1)$. So $Q(n)$ holds for all $n$, and $P(n)$ follows from $Q(n+1)$.
:::

Notice that there is no separate base case: the hypothesis for $n = 0$ says “if $P$ holds for all $k < 0$ (a vacuous condition), then $P(0)$”, so $P(0)$ must be proved outright. In practice the smallest cases usually need their own argument anyway.

:::proof[Proof of existence]
We prove by strong induction that every $n \ge 2$ is a product of primes (a prime counting as a product of one prime). Let $n \ge 2$ and assume every $k$ with $2 \le k < n$ is a product of primes. If $n$ is prime, we are done. Otherwise $n = ab$ with $2 \le a, b < n$. By hypothesis $a$ and $b$ are products of primes, and multiplying the two products gives one for $n$.
:::

## Dividing and the greatest common divisor

Uniqueness rests on a property of the integers that Hilbert's world lacks: you can divide with a remainder, and you can find greatest common divisors by Euclid's algorithm.

:::theorem{name="Division with remainder"}
For all integers $a$ and $b$ with $b > 0$, there are unique integers $q$ and $r$ with $a = qb + r$ and $0 \le r < b$.
:::

:::proof
Consider the set of non-negative numbers of the form $a - qb$ with $q$ an integer. It is non-empty (take $q$ very negative), so by well-ordering it has a smallest element $r = a - qb \ge 0$. If $r \ge b$, then $r - b = a - (q+1)b$ would be a smaller non-negative element, which is impossible; so $0 \le r < b$. For uniqueness, if $qb + r = q'b + r'$ with both remainders in $[0, b)$, then $b$ divides $r - r'$, which lies strictly between $-b$ and $b$, so $r = r'$ and $q = q'$.
:::

The **greatest common divisor** $\gcd(a, b)$ is the largest integer dividing both $a$ and $b$. Euclid's algorithm computes it by repeated division: if $a = qb + r$, then every common divisor of $a$ and $b$ divides $r = a - qb$, and every common divisor of $b$ and $r$ divides $a = qb + r$, so

$$\gcd(a, b) = \gcd(b, r).$$

Replace $(a, b)$ by $(b, r)$ and repeat. The remainders strictly decrease, so the process stops — by well-ordering once more — and when the remainder is $0$, $\gcd(b, 0) = b$. Euclid described it geometrically, as repeatedly subtracting the smaller length from the larger (*Elements* VII.2), and that is exactly what this picture does.

::euclid-rectangle

The algorithm is astonishingly fast. In 1844 Gabriel Lamé proved that it never needs more steps than five times the number of digits of the smaller number. The worst cases are consecutive Fibonacci numbers — try $89$ and $55$. This was one of the first analyses of the running time of an algorithm, a century before computers.

## Bézout's identity

The panel under the picture shows something more: the gcd can be written as a **combination** of $a$ and $b$ with integer coefficients. For $240$ and $46$: $2 = (-9) \cdot 240 + 47 \cdot 46$.

:::theorem{name="Bézout’s identity" who="Bachet; Bézout" year="1624; 1779"}
For all integers $a, b$, not both zero, there are integers $x$ and $y$ with $ax + by = \gcd(a, b)$. In fact $\gcd(a, b)$ is the smallest positive number of the form $ax + by$.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Look at all the numbers $ax + by$. The smallest positive one must divide $a$ — otherwise dividing $a$ by it leaves a smaller positive combination. So it is a common divisor, and every common divisor divides it.
:::
:::level[Proof]
Let $S$ be the set of positive integers of the form $ax + by$. It is non-empty (it contains $|a|$ or $|b|$), so it has a smallest element $d = ax_0 + by_0$.

*$d$ divides $a$.* Divide: $a = qd + r$ with $0 \le r < d$. Then $r = a - qd = a(1 - qx_0) + b(-qy_0)$ is of the form $ax + by$. If $r > 0$ it would be an element of $S$ smaller than $d$; so $r = 0$ and $d \mid a$. In the same way $d \mid b$.

*Every common divisor divides $d$.* If $c \mid a$ and $c \mid b$, then $c \mid ax_0 + by_0 = d$, so $c \le d$.

So $d$ is the greatest common divisor, and it has the required form.
:::
::::

This proof is a beautiful use of well-ordering: it does not *find* $x$ and $y$ (the extended algorithm does that), it just considers the smallest thing that could work and shows that it does.

## Euclid's lemma, and uniqueness

Here is the property that Hilbert's world lacks. In that world, the Hilbert prime $9$ divides $21 \times 21 = 441$ without dividing $21$.

:::lemma{name="Euclid’s lemma" who="Euclid, Elements VII.30"}
If a prime $p$ divides a product $ab$, then $p$ divides $a$ or $p$ divides $b$.
:::

:::proof
Suppose $p \mid ab$ and $p \nmid a$. The only positive divisors of $p$ are $1$ and $p$, so $\gcd(p, a) = 1$, and by Bézout there are integers $x, y$ with $px + ay = 1$. Multiply by $b$: $pbx + aby = b$. Now $p$ divides $pbx$ and $p$ divides $ab$, so $p$ divides $b$.
:::

By induction, if a prime divides a product of several numbers, it divides one of them. Now uniqueness follows.

::::zoom{levels="Idea, Proof"}
:::level[Idea]
If a number had two different factorisations, a prime from the first divides the second product, so it *is* one of the primes in the second. Cancel it from both sides and repeat — or, more elegantly, look at the smallest number with two factorisations and get a contradiction.
:::
:::level[Proof]
Suppose, for a contradiction, that some number has two different prime factorisations, and let $n$ be the smallest such number (well-ordering):
$$n = p_1 p_2 \cdots p_r = q_1 q_2 \cdots q_s ,$$
where the two lists of primes are not rearrangements of each other. The prime $p_1$ divides $q_1 q_2 \cdots q_s$, so by Euclid's lemma it divides some $q_j$. Since $q_j$ is prime, $p_1 = q_j$. Cancelling it gives
$$\frac{n}{p_1} = p_2 \cdots p_r = q_1 \cdots \widehat{q_j} \cdots q_s ,$$
two factorisations of the smaller number $n/p_1$ that are still not rearrangements of each other (the full lists differed, and we removed the same prime from both). If $n/p_1 = 1$, one side is an empty product while the other is not, which is impossible; otherwise $n/p_1 \ge 2$ contradicts the minimality of $n$.
:::
::::

```parsons
title: Rebuild the proof of Euclid’s lemma
prompt: Order the proof that if a prime $p$ divides $ab$ then $p \mid a$ or $p \mid b$. One line is circular.
lines:
  - Suppose $p \mid ab$ and $p \nmid a$; we show $p \mid b$.
  - The only positive divisors of $p$ are $1$ and $p$, so $\gcd(p, a) = 1$.
  - By Bézout's identity, $px + ay = 1$ for some integers $x, y$.
  - Multiplying by $b$ gives $pbx + aby = b$.
  - Since $p$ divides both $pbx$ and $ab$, it divides $b$.
distractors:
  - By unique factorisation, $p$ appears in the factorisation of $a$ or of $b$.
explain: The distractor is circular — we use Euclid's lemma to *prove* unique factorisation, so we can't use unique factorisation to prove the lemma.
```

:::history{year=1847 title="The collapse of a proof" people="Gabriel Lamé, Joseph Liouville, Ernst Kummer"}
On 1 March 1847 Gabriel Lamé announced to the Paris Academy of Sciences that he had proved Fermat's Last Theorem — that $x^n + y^n = z^n$ has no solutions in positive integers for $n \ge 3$. His idea was to factor $x^n + y^n$ into $n$ linear factors using complex roots of unity, and to argue as one would with ordinary integers. Joseph Liouville immediately asked the question you should now ask: *is factorisation into primes unique in that number system?* Within weeks a letter arrived from Ernst Kummer in Breslau. He had shown three years earlier that it is not — the first failure comes at $n = 23$. Lamé's proof collapsed.

The simplest example of the failure is in the numbers $a + b\sqrt{-5}$ with integer $a, b$, where
$$6 = 2 \times 3 = \big(1 + \sqrt{-5}\big)\big(1 - \sqrt{-5}\big),$$
and none of the four factors can be broken down further. Kummer rescued what he could by inventing “ideal numbers”, which restore unique factorisation in a new sense. They grew into the theory of ideals, one of the foundations of modern algebra — and the theorem itself waited until Andrew Wiles, in 1995.:cite[edwards-flt]
:::

:::bio{name="Carl Friedrich Gauss" born=1777 died=1855 place="Brunswick and Göttingen"}
The son of a bricklayer, Gauss was supported by the Duke of Brunswick after his talent was noticed at school. At nineteen he proved that a regular 17-sided polygon can be constructed with ruler and compass — the first new such construction since the Greeks — and decided to become a mathematician. His *Disquisitiones Arithmeticae* (1801), written in his early twenties, founded modern number theory: it introduced congruences (Chapter 8), gave the first clear statement and proof of unique factorisation, and contained the first proof of quadratic reciprocity (Chapter 10). He went on to transform astronomy, geodesy, magnetism and the theory of curved surfaces, published only what he considered perfect — his motto was *pauca sed matura*, “few, but ripe” — and left many discoveries in his notebooks for others to rediscover.
:::

## A conjecture that held for 906 million numbers

In Chapter 0 we promised a story. Unique factorisation lets us count prime factors without ambiguity: $12 = 2 \cdot 2 \cdot 3$ has three, counted with multiplicity. In 1919 George Pólya noticed that numbers with an *odd* number of prime factors seem always to be at least as common as those with an even number, among the numbers up to any $n \ge 2$.

::polya-conjecture

The conjecture held for every $n$ anyone checked. In 1958 Brian Haselgrove proved that it is false, without finding a counterexample. In 1980 Minoru Tanaka found the smallest: $n = 906{,}150{,}257$.:cite[haselgrove1958] No amount of checking could have established it; a proof was needed, and none could exist.

## Exercises

```blanks
title: Euclid’s algorithm by hand
prompt: Run Euclid’s algorithm on $1071$ and $462$ (the example Euclid himself would have liked).
text: |
  $1071 = 2 \times 462 + $ [[r1]]

  $462 = $ [[q2]] $\times 147 + 21$

  $147 = 7 \times 21 + 0$

  So $\gcd(1071, 462) = $ [[g]].
blanks:
  r1: { answer: '147' }
  q2: { answer: '3' }
  g: { answer: '21' }
```

```bug
title: A lemma too far
prompt: 'This “proof” shows that $6$ divides $2$ or $6$ divides $3$. Where is the error?'
lines:
  - Euclid's lemma says that if $p \mid ab$ then $p \mid a$ or $p \mid b$.
  - We have $6 \mid 2 \times 3$, because $2 \times 3 = 6$.
  - So by Euclid's lemma, $6 \mid 2$ or $6 \mid 3$.
wrong: 2
why: |
  Euclid's lemma needs $p$ to be **prime**, and $6$ is not. The proof of the lemma used primality exactly once — to conclude that $\gcd(p, a) = 1$ when $p \nmid a$. For $p = 6$, $a = 2$ that fails: $\gcd(6, 2) = 2$.
notes:
  '0': That is the statement of the lemma — but read its hypotheses carefully.
```

```prove
title: The generalised Euclid lemma
prompt: 'Prove that if $\gcd(a, b) = 1$ and $a \mid bc$, then $a \mid c$.'
hints:
  - Copy the proof of Euclid's lemma. What did primality give us there?
  - 'By Bézout, $ax + by = 1$. Multiply by $c$.'
rubric:
  - 'You used Bézout to write $ax + by = 1$.'
  - 'You multiplied by $c$ to get $acx + bcy = c$.'
  - 'You explained why $a$ divides each term on the left.'
solution: |
  Since $\gcd(a, b) = 1$, Bézout's identity gives integers $x, y$ with $ax + by = 1$. Multiplying by $c$, $acx + bcy = c$. Now $a$ divides $acx$ obviously, and $a$ divides $bc$ by hypothesis, so $a$ divides $bcy$. Hence $a$ divides the sum, $c$.
```

```quiz
q: 'Why is the fundamental theorem stated for $n \ge 2$ — what about $1$?'
options:
  - text: '$1$ is prime, so it is its own factorisation.'
    why: '$1$ is not prime, by definition.'
  - text: '$1$ is the empty product: the factorisation with no primes at all. The convention that $1$ is not prime is exactly what makes factorisations unique.'
    correct: true
    why: 'If $1$ were prime, $6 = 2 \cdot 3 = 1 \cdot 2 \cdot 3 = 1 \cdot 1 \cdot 2 \cdot 3$ would have infinitely many factorisations.'
  - text: The theorem is false for $1$.
    why: 'With the empty product, it is true (and unique) for $1$ too; stating it for $n \ge 2$ just avoids talking about empty products.'
```

:::challenge
**√n again, via factorisation.** Using the fundamental theorem, give a one-paragraph proof that $\sqrt n$ is irrational unless $n$ is a perfect square. (If $n q^2 = p^2$, compare the exponent of each prime on the two sides.) Then prove that $\gcd(a, b) \cdot \operatorname{lcm}(a, b) = ab$ for positive integers $a, b$, where lcm is the least common multiple.
:::

## Further reading

- Harold Edwards, *Fermat's Last Theorem: A Genetic Introduction to Algebraic Number Theory* — the Lamé–Kummer story, and the mathematics that grew from it.:cite[edwards-flt]
- G. H. Hardy and E. M. Wright, *An Introduction to the Theory of Numbers* — Chapter 2 gives several proofs of unique factorisation, including one that avoids Euclid's lemma.:cite[hardy-wright]
