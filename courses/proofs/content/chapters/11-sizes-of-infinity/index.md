---
number: 11
title: Sizes of infinity
summary: Are there more fractions than whole numbers? More real numbers than fractions? Georg Cantor answered with bijections and a diagonal, discovered that there are infinitely many sizes of infinity, and paid a heavy price for it.
duration: About 2½ hours
prerequisites: [for-all-there-exists, unique-factorisation]
theorems: [ℚ is countable, ℝ is uncountable (Cantor, 1891), Cantor’s theorem, The Schröder–Bernstein theorem]
techniques: [bijection, diagonal argument, proof by contradiction, construction]
---

In 1638, in his last book, Galileo pointed out a paradox. Every whole number has a square, and different numbers have different squares, so there are *as many* squares as whole numbers:

$$1, 2, 3, 4, 5, \ldots \quad\longleftrightarrow\quad 1, 4, 9, 16, 25, \ldots$$

Yet the squares are only a small part of the whole numbers, and they get rarer and rarer: below a million, only a thousand numbers are squares. So there are *fewer* squares than whole numbers. Galileo concluded that the words “more”, “fewer” and “equal” simply do not apply to infinite collections.:cite[galileo1638]

Two and a half centuries later, Georg Cantor drew the opposite conclusion. The pairing *is* the right notion of “same size”; it is our intuition that a part must be smaller than the whole that fails for infinite sets. Following that idea with complete rigour, he found that some infinities are genuinely larger than others.

## Same size means a bijection

Two finite sets have the same number of elements exactly when their elements can be paired off one to one, with nothing left over on either side. Cantor took this as the *definition* for all sets.

:::definition
A **bijection** from $A$ to $B$ is a function $f: A \to B$ that is **injective** (different elements go to different elements) and **surjective** (every element of $B$ is hit). Sets $A$ and $B$ have the **same cardinality**, written $|A| = |B|$, if there is a bijection between them. A set is **countable** if it is finite or has the same cardinality as $\mathbb{N} = \{0, 1, 2, \ldots\}$ — that is, if its elements can be listed as a sequence $a_0, a_1, a_2, \ldots$
:::

With this definition Galileo's paradox dissolves: $n \mapsto n^2$ is a bijection, so the squares and the natural numbers have the same cardinality. The price is that an infinite set can have the same size as a part of itself. David Hilbert liked to dramatise this with an imaginary hotel.

::hilbert-hotel

Each move is a bijection: $n \mapsto n + 1$ from $\mathbb{N}$ onto $\mathbb{N} \setminus \{0\}$, $n \mapsto 2n$ onto the even numbers, and the prime-power trick packs countably many countable sets into one. Richard Dedekind turned the paradox into a definition in 1888: a set is *infinite* exactly when it has the same size as a proper part of itself.

## The rationals are countable

The integers are countable — list them as $0, 1, -1, 2, -2, 3, \ldots$ What about the rationals? Between any two of them there are infinitely many others (Chapter 2), so it seems impossible to list them in order. But a list need not be in order of size.

Here is a list, found by Neil Calkin and Herbert Wilf in 2000.:cite[calkin-wilf] Put $\frac11$ at the top of a tree and give each fraction $\frac ab$ two children, $\frac{a}{a+b}$ and $\frac{a+b}{b}$.

::calkin-wilf

:::theorem{name="The Calkin–Wilf tree" who="Neil Calkin and Herbert Wilf" year=2000}
Every positive rational number appears exactly once in the tree, in lowest terms. Hence the positive rationals are countable, and so are all the rationals.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Going *up* the tree from $\frac ab$ subtracts the smaller of $a, b$ from the larger — one step of Euclid's subtraction algorithm (Chapter 6). So every fraction in lowest terms climbs back to $\frac11$ along a unique path.
:::
:::level[Proof]
Every fraction in the tree is in lowest terms: $\frac11$ is, and $\gcd(a, a+b) = \gcd(a+b, b) = \gcd(a, b)$, so children inherit the property.

The parent of a non-root fraction $\frac xy$ is determined: if $x < y$ it is a left child $\frac{a}{a+b}$, so $a = x$, $b = y - x$; if $x > y$ it is a right child, with $a = x - y$, $b = y$; and $x = y$ happens only at the root (in lowest terms, $\frac11$). So each fraction has at most one position.

Every $\frac xy$ in lowest terms *does* appear: by strong induction on $x + y$. If $x + y = 2$, it is $\frac 11$. Otherwise $x \ne y$, and the fraction $\frac{x}{y - x}$ or $\frac{x - y}{y}$ is in lowest terms with a smaller sum, so by induction it is in the tree, and $\frac xy$ is its child.

Reading the tree row by row lists every positive rational exactly once. Interleaving with the negatives and $0$ lists all of $\mathbb{Q}$.
:::
::::

Look at the sequence the tree produces: $1, \frac12, 2, \frac13, \frac32, \frac23, 3, \frac14, \ldots$ The numerator of each fraction is the denominator of the one before — a sequence Moritz Stern studied in 1858. Cantor himself used a different list, walking through a grid of fractions along diagonals. Every countable-by-listing proof is a construction; the art is in finding a listing that provably misses nothing.

## The reals are not

On 29 November 1873 Cantor wrote to Dedekind with a question he could not answer: can the real numbers be listed? Nine days later he sent a proof that they cannot. The argument he is famous for, from 1891, is simpler still.:cite[cantor1891]

:::theorem{name="Uncountability of the reals" who="Georg Cantor" year="1874; 1891"}
The real numbers between $0$ and $1$ cannot be listed: for every sequence $x_1, x_2, x_3, \ldots$ of real numbers there is a real number in $(0, 1)$ that is not in the sequence.
:::

The statement has the shape $\forall$ list $\exists$ missing number, so the proof is a strategy for the Prover of Chapter 2: *given any list, construct a number it misses.* Try to defeat it.

::diagonaliser

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Write the listed numbers as decimals, one per row. Walk down the diagonal and change every digit you pass. The new number differs from the first number in the first digit, from the second in the second, and so on — so it is none of them.
:::
:::level[Proof]
Let $x_1, x_2, \ldots$ be any sequence of real numbers. Write the decimal expansion of the fractional part of each, $x_n = 0.d_{n1}d_{n2}d_{n3}\ldots$; when a number has two expansions (like $0.5000\ldots = 0.4999\ldots$), choose either.

Define $y = 0.e_1e_2e_3\ldots$ by $e_n = 5$ if $d_{nn} \ne 5$ and $e_n = 4$ if $d_{nn} = 5$. Then $y \in (0, 1)$, and since $y$ uses only the digits $4$ and $5$, it has only one decimal expansion. For each $n$, the $n$th digit of $y$ differs from the $n$th digit of the chosen expansion of $x_n$, and because $y$ has a unique expansion, $y \ne x_n$. So $y$ is not in the list.
:::
::::

The care about two expansions is not pedantry. If we allowed the new digits to be $0$ and $9$, the diagonal number might be $0.4999\ldots$, which *equals* a number $0.5000\ldots$ that could be in the list. Choosing digits $4$ and $5$ avoids the trap.

So there are at least two sizes of infinity: the **countable** one of $\mathbb{N}$, $\mathbb{Z}$ and $\mathbb{Q}$, and the larger one of $\mathbb{R}$, called the **continuum**.

```bug
title: The rationals are uncountable?
prompt: 'Apply the diagonal argument to a list of all rationals in $(0, 1)$. It seems to prove the rationals are uncountable. Where does it break?'
lines:
  - The rationals in $(0, 1)$ can be listed (Calkin–Wilf), say $q_1, q_2, \ldots$
  - Write each $q_n$ as a decimal $0.d_{n1}d_{n2}\ldots$
  - Build $y$ by changing each diagonal digit $d_{nn}$ to $4$ or $5$.
  - Then $y$ is a rational number in $(0, 1)$ that is not on the list.
  - So the list was incomplete — a contradiction.
wrong: 3
why: |
  $y$ is a real number not on the list, but nothing makes it **rational**. Its digits follow no repeating pattern in general, so $y$ is typically irrational — and a list of the rationals was never supposed to contain it. The argument only proves that a list of rationals misses some real, which we knew.
```

### A bonus: transcendental numbers exist

A number is **algebraic** if it is a root of a non-zero polynomial with integer coefficients — like $\sqrt 2$ (a root of $x^2 - 2$) or $\sqrt[3]{5} + 1$ — and **transcendental** otherwise. In 1874 no one could easily exhibit a transcendental number: Liouville had found some in 1844 by hard work (Chapter 17), and Hermite had just shown in 1873 that $e$ is one. Cantor's first paper on infinity proved in a few lines that *most* numbers are transcendental.

:::theorem{who="Georg Cantor" year=1874}
The algebraic numbers are countable. Consequently transcendental numbers exist — in fact, all but countably many real numbers are transcendental.
:::

:::proof
There are countably many polynomials with integer coefficients: for each $h$ there are only finitely many polynomials whose degree and coefficients have absolute values adding up to $h$, so we can list them by increasing $h$. Each non-zero polynomial has finitely many roots. Listing the roots of each polynomial in turn lists all algebraic numbers. Since $\mathbb{R}$ is not countable, some real number is not on the list.
:::

This is the archetypal non-constructive existence proof: it proves that transcendental numbers are overwhelmingly common without naming one.

## Infinitely many infinities

Is the continuum the largest infinity? Cantor showed that there is no largest.

:::theorem{name="Cantor’s theorem" who="Georg Cantor" year=1891}
For every set $A$, there is no surjection from $A$ onto its power set $\mathcal{P}(A)$, the set of all subsets of $A$. So $|\mathcal{P}(A)| > |A|$.
:::

:::proof
Let $f: A \to \mathcal{P}(A)$ be any function. Consider the set
$$D = \{\, x \in A : x \notin f(x) \,\}.$$
If $D = f(d)$ for some $d \in A$, ask whether $d \in D$. If $d \in D$, then by the definition of $D$, $d \notin f(d) = D$. If $d \notin D$, then $d \notin f(d)$, so $d \in D$. Either way we have a contradiction. So $D$ is not in the image of $f$, and $f$ is not surjective.
:::

This is the diagonal argument stripped to its bones. Think of a table whose row $x$ records, for each $y \in A$, whether $y \in f(x)$. The set $D$ is built by going down the diagonal and flipping every answer. Applying the theorem again and again gives an endless tower: $|\mathbb{N}| < |\mathcal{P}(\mathbb{N})| < |\mathcal{P}(\mathcal{P}(\mathbb{N}))| < \cdots$. (And $|\mathcal{P}(\mathbb{N})| = |\mathbb{R}|$, as the next theorem helps to show.)

```parsons
title: Rebuild Cantor’s theorem
prompt: Order the proof that no function $f: A \to \mathcal P(A)$ is surjective.
lines:
  - Let $f: A \to \mathcal{P}(A)$ be any function.
  - Define $D = \{x \in A : x \notin f(x)\}$, a subset of $A$.
  - Suppose, for a contradiction, that $D = f(d)$ for some $d \in A$.
  - If $d \in D$ then $d \notin f(d) = D$; if $d \notin D$ then $d \notin f(d)$, so $d \in D$.
  - Both cases are impossible, so $D$ is not $f(d)$ for any $d$: $f$ is not surjective.
distractors:
  - Since $A$ is infinite, $\mathcal{P}(A)$ is larger.
explain: The proof never uses that $A$ is infinite — the theorem is true (and easy) for finite sets too, where $|\mathcal{P}(A)| = 2^{|A|}$.
```

Cantor's theorem also carries a warning. Apply it to the “set of all sets” $V$: then $\mathcal P(V) \subseteq V$, so $|\mathcal P(V)| \le |V|$, contradicting the theorem. Something is wrong with the very idea of a set of all sets. Bertrand Russell, reading Cantor's proof, extracted the contradiction in its purest form — it is where the next chapter begins.

## Comparing sizes

To show two sets have the same size we need a bijection, and bijections can be hard to find even when injections both ways are easy. For instance, $x \mapsto x$ injects $(0, 1)$ into $[0, 1]$, and $x \mapsto \frac{x + 1}{3}$ injects $[0,1]$ into $(0,1)$. Is there a bijection?

:::theorem{name="The Schröder–Bernstein theorem" who="Cantor, Dedekind, Schröder, Bernstein" year="1887–1897"}
If there are injections $f: A \to B$ and $g: B \to A$, then there is a bijection between $A$ and $B$.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Follow each element backwards through $g$ and $f$ as far as you can. Every element lies on a chain $\cdots \to a \to f(a) \to g(f(a)) \to \cdots$. On each chain, pair elements using $f$ — except on chains that start in $B$, where you use $g^{-1}$ instead.
:::
:::level[Proof]
Call $x \in A$ a *$B$-stopper* if tracing back — $x = g(y_1)$, $y_1 = f(x_1)$, $x_1 = g(y_2)$, … — eventually reaches an element of $B$ that is not in the image of $f$. Let $A_B$ be the set of $B$-stoppers. Define $h: A \to B$ by $h(x) = g^{-1}(x)$ if $x \in A_B$ (such $x$ are in the image of $g$, and $g$ is injective, so $g^{-1}(x)$ is well defined), and $h(x) = f(x)$ otherwise.

*$h$ is injective.* Each case is injective. If $f(x) = g^{-1}(x')$ with $x \notin A_B$ and $x' \in A_B$, then $x' = g(f(x))$; tracing back from $x'$ passes through $f(x)$ and then $x$, so $x$ would be a $B$-stopper too — contradiction.

*$h$ is surjective.* Let $y \in B$. If $g(y) \in A_B$, then $h(g(y)) = y$. If not, then $y$ is in the image of $f$ (otherwise $g(y)$ would stop at $y$ in $B$): $y = f(x)$, and $x \notin A_B$ (as tracing back from $g(y)$ passes through $x$), so $h(x) = f(x) = y$.
:::
::::

With it, $|(0,1)| = |[0,1]| = |\mathbb{R}|$ follows from easy injections, and one can show $|\mathbb{R}| = |\mathcal{P}(\mathbb{N})|$ by injecting each into the other with binary and decimal expansions. Cantor even found, to his own astonishment, that the unit square has no more points than the unit interval — “I see it, but I don't believe it!”, he wrote to Dedekind in 1877.

:::history{year=1878 title="The continuum hypothesis" people="Georg Cantor, Kurt Gödel, Paul Cohen"}
Is there an infinity strictly between $|\mathbb{N}|$ and $|\mathbb{R}|$? Cantor conjectured in 1878 that there is not — the **continuum hypothesis** — and tried for the rest of his life to prove it. Hilbert put it first on his famous list of 23 problems in 1900. The answer, when it came, was the strangest possible. In 1940 Kurt Gödel showed that the continuum hypothesis cannot be *disproved* from the standard axioms of set theory; in 1963 Paul Cohen showed that it cannot be *proved* from them either. It is independent: the axioms that underlie almost all of mathematics simply do not decide it. Chapter 12 explains how statements can be unprovable.
:::

:::bio{name="Georg Cantor" born=1845 died=1918 place="St Petersburg and Halle"}
Cantor spent his career at the small university of Halle, never getting the Berlin post he wanted. His theory of infinite sets met hostility from powerful mathematicians — above all Leopold Kronecker, who rejected any mathematics not built from the whole numbers in finitely many steps — and from theologians and philosophers. He suffered repeated episodes of severe depression and died in a sanatorium in Halle. Recognition came in his lifetime, but late: by 1926 Hilbert was declaring that “no one shall expel us from the paradise that Cantor has created”. Set theory became the common language of mathematics, and the diagonal argument one of its most powerful tools.
:::

## Exercises

```step
title: Pairing up ℕ × ℕ
prompt: 'Cantor''s pairing function $\pi(m, n) = \frac{(m+n)(m+n+1)}{2} + n$ numbers the grid of pairs diagonal by diagonal. Check the key fact: consecutive diagonals start $s + 1$ apart, i.e. $\frac{(s+1)(s+2)}{2} - \frac{s(s+1)}{2} = s + 1$.'
start: (s+1)(s+2)/2 - s(s+1)/2
target: s + 1
relation: '='
initial: (s+1)(s+2)/2 - s(s+1)/2
solution: '$\frac{(s+1)(s+2) - s(s+1)}{2} = \frac{(s+1) \cdot 2}{2} = s + 1$.'
```

```prove
title: Finite strings are countable
prompt: Prove that the set of all finite strings of letters from a finite alphabet (for example, all possible English texts) is countable.
hints:
  - How many strings of length exactly $n$ are there?
  - List all strings of length $0$, then length $1$, then length $2$, …
rubric:
  - You observed that there are finitely many strings of each length ($k^n$ for an alphabet of size $k$).
  - You described a listing (by length, then alphabetically) and argued that every string appears at a finite position.
solution: |
  With an alphabet of $k$ letters there are $k^n$ strings of length $n$, finitely many. List the strings of length $0$, then those of length $1$ in alphabetical order, then length $2$, and so on. A string of length $n$ appears after at most $1 + k + \cdots + k^n$ entries, so it has a finite position in the list. Hence the set is countable. (Consequence: since every definition, proof or computer program is a finite string, there are only countably many of each — and so there are real numbers that no finite description can pin down.)
```

```quiz
q: 'Which of these sets is **uncountable**?'
options:
  - text: The set of all finite subsets of $\mathbb{N}$.
    why: Each finite subset can be encoded as a finite string (or as a natural number in binary), so they are countable.
  - text: The set of all infinite sequences of 0s and 1s.
    correct: true
    why: This is essentially $\mathcal{P}(\mathbb{N})$ — a sequence records which numbers are in a subset — and the diagonal argument applies directly.
  - text: The set of all algebraic numbers.
    why: Countable, by Cantor's argument above.
```

:::challenge
**A bijection by hand.** Write down an explicit bijection between $[0, 1]$ and $(0, 1)$. (Hint: Hilbert's hotel. Pick a sequence $\frac12, \frac13, \frac14, \ldots$ inside $(0,1)$ and use it to make room for the two endpoints.)
:::

## Further reading

- Neil Calkin and Herbert Wilf, “Recounting the rationals” — a delightful four-page paper.:cite[calkin-wilf]
- Joseph Dauben, *Georg Cantor: His Mathematics and Philosophy of the Infinite* — the definitive biography.:cite[dauben]
