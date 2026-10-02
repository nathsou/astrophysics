---
number: 4
title: Infinitely many primes
summary: Euclid’s proof that the primes never run out — which, contrary to legend, is not a proof by contradiction — and five more proofs of the same fact, each showing off a different technique.
duration: About 2½ hours
prerequisites: [root-two]
theorems: [There are infinitely many primes (Euclid IX.20), There are arbitrarily long gaps between primes]
techniques: [proof by construction, contradiction, coprimality, counting]
---

A **prime** is a whole number greater than $1$ whose only positive divisors are $1$ and itself: $2, 3, 5, 7, 11, 13, \ldots$ Every other whole number greater than $1$ is **composite**: it is a product of smaller numbers, and breaking those down in turn eventually leaves a product of primes. Primes are the atoms of multiplication (Chapter 6 proves that the breakdown is unique).

The first question anyone asks about them is whether they run out. Among the numbers up to $100$ there are $25$ primes; up to $1000$ there are $168$; up to a million, $78{,}498$. They thin out. Perhaps, far enough along, every number is composite?

The oldest way to list primes is a sieve, described by Nicomachus in the first century AD and attributed to Eratosthenes of Cyrene, the librarian of Alexandria who measured the circumference of the Earth.

::sieve

The sieve can list primes up to any bound, but it cannot answer our question: however far it runs, it says nothing about what lies beyond. That takes a proof.

## Euclid's theorem

Here is the statement in Euclid's own words, as Proposition 20 of Book IX of the *Elements* (in Heath's translation).:cite[euclid]

:::theorem{name="Elements IX.20" who="Euclid" year="c. 300 BC"}
Prime numbers are more than any assigned multitude of prime numbers.
:::

That is: given any finite list of primes, there is a prime that is not on the list. The proof needs one small fact.

:::lemma
Every whole number $N > 1$ has a prime factor.
:::

:::proof
The set of divisors of $N$ that are greater than $1$ is non-empty (it contains $N$), so by well-ordering it has a smallest element $d$. If $d$ were not prime, it would have a divisor $e$ with $1 < e < d$; but then $e$ would also divide $N$, contradicting the minimality of $d$. So $d$ is a prime factor of $N$.
:::

::::zoom{levels="Idea, Sketch, Proof"}
:::level[Idea]
Multiply the primes on the list and add one. The result is not divisible by any of them — each leaves remainder $1$ — so its prime factors are new.
:::
:::level[Sketch]
Given primes $p_1, \ldots, p_n$, let $N = p_1 p_2 \cdots p_n + 1$. Some prime $p$ divides $N$. If $p$ were one of the $p_i$, it would divide both $N$ and $N - 1 = p_1 \cdots p_n$, hence their difference $1$ — impossible. So $p$ is a new prime.
:::
:::level[Proof]
Let $p_1, \ldots, p_n$ be any finite list of primes, and let $N = p_1 p_2 \cdots p_n + 1$. Then $N > 1$, so by the lemma $N$ has a prime factor $p$.

Suppose $p = p_i$ for some $i$. Then $p$ divides the product $p_1 \cdots p_n$, and it divides $N$, so it divides their difference $N - p_1 \cdots p_n = 1$. But no prime divides $1$. So $p$ is different from every $p_i$: it is a prime not on the list.
:::
::::

:::warning
**Euclid did not prove this by contradiction.** Countless textbooks retell the proof as: *suppose there are finitely many primes; multiply them all and add one; …contradiction.* That version is correct, but it is not Euclid's, and it is weaker in a practical sense: Euclid's proof *constructs* a new prime from any list (at least in principle), while the contradiction version shows only that the assumption was wrong.:cite[hardy-woodgold] A good habit: before writing “suppose not”, check whether a direct proof is hiding inside your contradiction.
:::

Watch the construction in action. Start from $\{2\}$ and the machine produces $3$, then $7$, then $43$, then $2 \cdot 3 \cdot 7 \cdot 43 + 1 = 1807 = 13 \cdot 139$, so $13$, and so on.

::euclid-machine

Starting from $\{2\}$ and always taking the smallest new prime gives the **Euclid–Mullin sequence** $2, 3, 7, 43, 13, 53, 5, 6221671, \ldots$ Nobody knows whether every prime eventually appears in it. After a few dozen steps the numbers become too large to factor with any computer on Earth — but the *proof* doesn't care: it guarantees a new prime factor without finding it.

```bug
title: A popular mistake
prompt: 'We want to find a new prime from an arbitrary finite list. Which line makes a claim that does not follow?'
lines:
  - Start with any finite list of primes, $p_1, \ldots, p_n$.
  - Let $N = p_1 p_2 \cdots p_n + 1$.
  - None of the $p_i$ divides $N$, because each leaves remainder $1$.
  - Therefore $N$ is prime.
  - If $N$ is prime, it is larger than every $p_i$, so it is a prime not on the list.
wrong: 3
why: |
  $N$ need not be prime: $2 \cdot 3 \cdot 5 \cdot 7 \cdot 11 \cdot 13 + 1 = 30031 = 59 \cdot 509$. The list is arbitrary, so it can omit prime factors smaller than $N$. What we can always conclude is that $N$ has some prime factor, and none of its prime factors is on the list. That is enough to construct a new prime.
notes:
  '2': 'Correct: $N$ divided by $p_i$ leaves remainder $1$.'
```


:::note
**A stopping point:** explain why a prime factor of the product-plus-one cannot be on the original list. That completes the main lesson. The following proofs are optional alternatives: the Euler route uses unique factorisation (Chapter 6) and infinite series (Chapter 16); the topological proof introduces another viewpoint. Return after those prerequisites if they are unfamiliar.
:::

## Five more proofs

A fact this fundamental has been proved in many ways, and each proof teaches a different technique. There is even a whole book of them.:cite[aigner-ziegler]

### Fermat numbers are pairwise coprime (Goldbach, 1730)

The **Fermat numbers** are $F_n = 2^{2^n} + 1$: $F_0 = 3$, $F_1 = 5$, $F_2 = 17$, $F_3 = 257$, $F_4 = 65537$. Fermat conjectured in 1640 that they are all prime. The first five are — and then Euler found in 1732 that $F_5 = 4294967297 = 641 \cdot 6700417$. (The strong law of small numbers again: no Fermat prime beyond $F_4$ has ever been found.)

Christian Goldbach noticed that they are nevertheless useful. They satisfy
$$F_0 F_1 F_2 \cdots F_{n-1} = F_n - 2 .$$
So if a prime $p$ divided both $F_m$ and $F_n$ with $m < n$, it would divide $F_n - 2$ and $F_n$, hence $2$; but Fermat numbers are odd. So no two Fermat numbers share a prime factor, and each of the infinitely many $F_n$ contributes at least one prime of its own.

The product formula follows by repeating one identity, which you can check.

```step
title: The Fermat number identity
prompt: 'Show that $(F_n - 2)\,F_n = F_{n+1} - 2$, where $F_n = 2^{2^n} + 1$. Then $F_0 \cdots F_n = (F_n - 2)F_n = F_{n+1} - 2$ by the formula for $n$ — an induction (Chapter 5).'
defs: ['F(n) = 2^(2^n) + 1']
start: (F(n) - 2) F(n)
target: F(n+1) - 2
relation: '='
initial: (F(n) - 2) F(n)
domains: { n: nat }
hints:
  - '$(F_n - 2)F_n = (2^{2^n} - 1)(2^{2^n} + 1)$, a difference of squares.'
  - '$\left(2^{2^n}\right)^2 = 2^{2 \cdot 2^n} = 2^{2^{n+1}}$.'
solution: '$(2^{2^n} - 1)(2^{2^n} + 1) = 2^{2^{n+1}} - 1 = F_{n+1} - 2$.'
```

### Euler's product (1737)

Euler found a proof with a completely different flavour, and it opened a new subject: analytic number theory. Every whole number $n$ is a product of primes, so formally
$$\prod_{p \text{ prime}} \left(1 + \frac1p + \frac1{p^2} + \cdots\right) = \sum_{n=1}^{\infty} \frac1n ,$$
because expanding the product produces $\frac1n$ exactly once for each $n$ (this is unique factorisation again). Each bracket is a geometric series, equal to $\frac{1}{1 - 1/p}$. If there were only finitely many primes, the left-hand side would be a finite product of finite numbers. But the right-hand side, the **harmonic series**, is infinite: its partial sums grow without bound, as Nicole Oresme showed around 1350 (Chapter 16). So there must be infinitely many primes.

Euler went much further: he showed that even $\sum_p \frac1p = \frac12 + \frac13 + \frac15 + \frac17 + \cdots$ diverges. The primes are not only infinite; they are, in a precise sense, much more numerous than the squares, for which $\sum \frac1{n^2}$ converges.

### Counting (Erdős, 1938)

Paul Erdős gave a proof that uses nothing but counting.:cite[aigner-ziegler]

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Every number is a square times a product of *distinct* primes. With only $k$ primes there are few such products — at most $2^k$ — and few squares, so not enough numbers can be built. For large $N$, the numbers $1, \ldots, N$ run out of representations.
:::
:::level[Proof]
Suppose there are only $k$ primes. Every $n \ge 1$ can be written as $n = a^2 b$ where $b$ is **squarefree** (a product of distinct primes): take $a^2$ to be the largest square dividing $n$. Then $b$ is a product of some subset of the $k$ primes, so there are at most $2^k$ choices for $b$. For $n \le N$ we have $a \le \sqrt N$, so at most $\sqrt N$ choices for $a$. Hence the $N$ numbers $1, \ldots, N$ are all among at most $2^k \sqrt N$ products:
$$N \le 2^k \sqrt N, \quad\text{that is,}\quad N \le 4^k .$$
Taking $N = 4^k + 1$ gives a contradiction.
:::
::::

This is a proof by contradiction that genuinely needs to be one: it never produces a new prime, it only shows that $k$ primes are too few.

### Topology (Fürstenberg, 1955)

As an undergraduate, Hillel Fürstenberg published a proof using *topology*, the abstract study of open and closed sets.:cite[furstenberg1955] Declare a set of integers “open” if it is a union of arithmetic progressions $\{a + nb : n \in \mathbb{Z}\}$. Each progression is then also closed, and the set of integers other than $\pm 1$ is the union of the progressions $p\mathbb{Z}$ over all primes $p$. If there were finitely many primes, this would be a finite union of closed sets, hence closed, so $\{-1, 1\}$ would be open — but non-empty open sets are infinite. It is essentially Euclid's argument in disguise, and a good example of how new language can reframe old ideas.

### Saidak's sequence (2006)

The most recent and perhaps the simplest proof is yours to write in the exercises.

:::bio{name="Leonhard Euler" born=1707 died=1783 place="Basel, St Petersburg and Berlin"}
The most prolific mathematician in history: his collected works run to over eighty volumes, and much of that was written after he had lost his sight. He worked on everything — number theory, analysis, mechanics, optics, music theory, ship design — and gave us much of our notation, including $f(x)$, $e$, $i$, $\pi$ and $\Sigma$. Euler will appear in this course more than anyone else: he disproved Fermat's conjecture about $F_5$, proved Fermat's little theorem (Chapter 8) and the two-squares theorem (Chapter 9), solved the Basel problem (Chapter 16), and founded graph theory with the bridges of Königsberg (Chapter 20). Laplace told his students: “Read Euler, read Euler, he is the master of us all.”
:::

## Primes that leave remainder 3

Euclid's idea can be adapted to find primes of special forms. Every odd prime leaves remainder $1$ or $3$ on division by $4$: $5, 13, 17, 29, \ldots$ or $3, 7, 11, 19, 23, \ldots$

```prove
title: Infinitely many primes of the form 4k + 3
prompt: |
  Prove that there are infinitely many primes that leave remainder $3$ when divided by $4$.
hints:
  - 'Given primes $p_1, \ldots, p_n$ of the form $4k+3$, consider $N = 4p_1 p_2 \cdots p_n - 1$.'
  - 'A product of numbers of the form $4k + 1$ is again of the form $4k + 1$. So a number of the form $4k + 3$ must have a prime factor of the form $4k+3$.'
  - Could that prime factor be one of the $p_i$? Could it be $2$?
rubric:
  - You started from an arbitrary finite list of primes of the form $4k + 3$ and constructed $N = 4p_1\cdots p_n - 1$ (or $4p_1 \cdots p_n + 3$, handling $3$ carefully).
  - 'You showed that $N \equiv 3 \pmod 4$ and is odd.'
  - You justified that $N$ has a prime factor of the form $4k+3$ (products of $4k+1$ numbers stay $4k+1$).
  - You showed that this prime factor is not on the list.
solution: |
  Let $p_1, \ldots, p_n$ be any finite list of primes of the form $4k + 3$, and let $N = 4p_1 \cdots p_n - 1$. Then $N$ is odd and $N \equiv 3 \pmod 4$, so all its prime factors are odd, hence of the form $4k+1$ or $4k+3$. If they were all of the form $4k+1$, then so would be their product $N$, since $(4a+1)(4b+1) = 4(4ab + a + b) + 1$. So $N$ has a prime factor $q \equiv 3 \pmod 4$. If $q$ were some $p_i$, it would divide $4p_1\cdots p_n - N = 1$, which is impossible. So $q$ is a prime of the form $4k+3$ not on the list.
tutor: Key points — construct N = 4p₁⋯pₙ − 1, argue it has a prime factor ≡ 3 (mod 4) because products of numbers ≡ 1 (mod 4) are ≡ 1 (mod 4), and show that factor is new. Using N = p₁⋯pₙ + 1 does not work.
```

For primes of the form $4k + 1$, the same trick fails (a product of $4k+3$ numbers can be $4k+1$). A proof needs more machinery — we will be able to give one in Chapter 9. In 1837 Peter Gustav Lejeune Dirichlet proved the general theorem: every arithmetic progression $a, a + d, a + 2d, \ldots$ with $\gcd(a, d) = 1$ contains infinitely many primes. His proof, built on Euler's product, needs complex analysis.

## Arbitrarily long gaps

The primes never end, but they can be very far apart.

:::theorem
For every $n \ge 2$ there are $n - 1$ consecutive whole numbers, none of which is prime.
:::

:::proof
Consider $n! + 2, \; n! + 3, \; \ldots, \; n! + n$. For each $k$ with $2 \le k \le n$, $k$ divides $n!$ and $k$ divides $k$, so $k$ divides $n! + k$. Since $n! + k > k$, it is composite.
:::

This proof is a construction, like Euclid's, and it is extremely wasteful: the first run of $99$ composites starts far below $100!$. But a proof only has to work, not to be efficient. The true behaviour of prime gaps is one of the great open areas of number theory: in 2013 Yitang Zhang proved that some fixed gap (at most $70$ million, now improved to $246$) occurs infinitely often, while the *twin prime conjecture* — that gap $2$ occurs infinitely often — remains open.

## Exercises

```blanks
title: Euclid’s argument, in full
text: |
  Let $p_1, \ldots, p_n$ be primes and $N = p_1 \cdots p_n + 1$. Since $N > 1$, it has a [[a]] factor $p$. If $p = p_i$ for some $i$, then $p$ divides both $N$ and $p_1 \cdots p_n$, so it divides $N - p_1\cdots p_n = $ [[b]], which is impossible. For example, starting from the primes $2, 3, 5$ gives $N = $ [[c]], and starting from $2, 3, 5, 7, 11, 13$ gives $N = 30031 = 59 \cdot$ [[d]].
blanks:
  a: { answer: prime, kind: text }
  b: { answer: '1' }
  c: { answer: '31' }
  d: { answer: '509' }
```

```prove
title: Saidak’s proof
prompt: |
  Let $N_1 = 2$ and $N_{k+1} = N_k(N_k + 1)$, so $N_2 = 6$, $N_3 = 42$, $N_4 = 1806$, … Prove that $N_k$ has at least $k$ different prime factors, and deduce that there are infinitely many primes.
hints:
  - 'Consecutive integers $m$ and $m+1$ have no common prime factor. Why?'
  - 'So $N_k + 1$ has a prime factor that does not divide $N_k$. How many prime factors does $N_{k+1} = N_k(N_k+1)$ then have?'
rubric:
  - You proved that $m$ and $m+1$ share no prime factor.
  - 'You argued by induction (or step by step) that $N_{k+1}$ has at least one more prime factor than $N_k$.'
  - You stated the conclusion: since $N_k$ has at least $k$ distinct prime factors for every $k$, there are infinitely many primes.
solution: |
  If a prime $p$ divided both $m$ and $m + 1$, it would divide their difference $1$; so consecutive integers are coprime. Now $N_1 = 2$ has one prime factor. If $N_k$ has at least $k$ distinct prime factors, then $N_k + 1 > 1$ has some prime factor, which does not divide $N_k$; so $N_{k+1} = N_k(N_k+1)$ has at least $k + 1$ distinct prime factors. By induction $N_k$ has at least $k$ distinct prime factors for every $k$, so there are at least $k$ primes for every $k$ — infinitely many.
```

```quiz
q: 'Which of these statements does Euclid''s proof establish most directly?'
options:
  - text: The product of the first $n$ primes plus one is prime.
    why: False — $30031$ is a counterexample.
  - text: For every finite set of primes, there is a prime outside it.
    correct: true
    why: That is exactly Proposition IX.20, proved by construction.
  - text: 'The $n$th prime is at most $2^{2^n}$.'
    why: That is true, and it can be derived from Euclid's argument with a little more work — try it! — but it is not what the argument shows directly.
```

:::challenge
**A bound from Euclid.** Let $p_n$ be the $n$th prime. Using Euclid's construction, show that $p_{n+1} \le p_1 p_2 \cdots p_n + 1$, and deduce by induction that $p_n \le 2^{2^{n-1}}$. (This is a terrible bound — the truth, by the prime number theorem of 1896, is that $p_n$ is about $n \ln n$ — but it is a bound, and it came for free.)
:::

## Further reading

- Martin Aigner and Günter Ziegler, *Proofs from THE BOOK* — the first chapter is six proofs of this theorem; the rest of the book is just as good.:cite[aigner-ziegler]
- Michael Hardy and Catherine Woodgold, “Prime simplicity” — on how Euclid's proof came to be misremembered as a proof by contradiction.:cite[hardy-woodgold]
