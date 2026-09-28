---
number: 9
title: Sums of two squares
summary: Which primes are the sum of two squares? Fermat announced the answer on Christmas Day 1640; Euler needed seven years to prove it. In 1990 Don Zagier proved it in one sentence — and the sentence turns out to be about windmills.
duration: About 2½ hours
prerequisites: [fermats-little-theorem]
theorems: [Fermat’s two-squares theorem, Infinitely many primes of the form 4k + 1, The Brahmagupta–Fibonacci identity]
techniques: [involutions and fixed points, parity, congruences, algebraic identity]
---

$5 = 1^2 + 2^2$. $13 = 2^2 + 3^2$. $17 = 1^2 + 4^2$. But $3$, $7$, $11$ and $19$ cannot be written as a sum of two squares, however hard you try. Which primes can? Before reading on, gather some evidence and form a conjecture.

::two-squares-primes

## The conjecture, and the easy half

Turn on the colours. With the single exception of $2 = 1^2 + 1^2$, the primes that are sums of two squares are exactly those that leave remainder $1$ on division by $4$.

:::theorem{name="Fermat’s two-squares theorem" who="Girard; Fermat; Euler" year="1625; 1640; 1749"}
An odd prime $p$ is a sum of two squares if and only if $p \equiv 1 \pmod 4$.
:::

An “if and only if” has two directions, and here they are of very different difficulty. One is a two-line argument with remainders — the same one that appeared in Chapter 7.

```blanks
title: Why 4k + 3 primes fail
text: |
  Every integer is even or odd. If $x$ is even, $x^2 \equiv$ [[a]] $\pmod 4$; if $x$ is odd, $x = 2k+1$ and $x^2 = 4k^2 + 4k + 1 \equiv$ [[b]] $\pmod 4$. So $x^2 + y^2$ is congruent to $0$, $1$ or [[c]] modulo $4$, and never to [[d]]. Hence no prime $p \equiv 3 \pmod 4$ is a sum of two squares.
blanks:
  a: { answer: '0' }
  b: { answer: '1' }
  c: { answer: '2' }
  d: { answer: '3' }
```

The other direction — that every prime $p \equiv 1 \pmod 4$ *is* a sum of two squares — is the real theorem. It asserts that something exists, and gives no hint of how to find it.

:::history{year=1640 title="Fermat’s Christmas theorem" people="Albert Girard, Pierre de Fermat, Leonhard Euler"}
The Flemish mathematician Albert Girard stated which numbers are sums of two squares in 1625. Fermat announced the result for primes in a letter to Marin Mersenne dated 25 December 1640 — hence its nickname — and claimed a proof by infinite descent, which he never wrote down. Euler took up the challenge in 1742 and finally found a proof, also by descent, in 1747, reporting it to Goldbach in a letter and publishing it a few years later. It is long and delicate. Lagrange and Gauss later gave proofs through the theory of quadratic forms, and Dedekind through what we now call Gaussian integers.:cite[weil-nt]
:::

## A proof in one sentence

In 1990 Don Zagier published a paper in the *American Mathematical Monthly* whose title announced “a one-sentence proof”. Here is its content, in our own words.:cite[zagier1990]

> The map
> $$(x, y, z) \mapsto \begin{cases} (x + 2z,\; z,\; y - x - z) & \text{if } x < y - z, \\ (2y - x,\; y,\; x - y + z) & \text{if } y - z < x < 2y, \\ (x - 2y,\; x - y + z,\; y) & \text{if } x > 2y \end{cases}$$
> is an involution of the finite set $S = \{(x, y, z) \in \mathbb{N}^3 : x^2 + 4yz = p\}$ with exactly one fixed point, so $|S|$ is odd, and therefore the involution $(x, y, z) \mapsto (x, z, y)$ also has a fixed point.

If this reads like a magic trick, that is because the sentence hides three ideas and one very clever picture. Let us unpack it.

### Idea 1: involutions and parity

An **involution** of a set is a map $f$ with $f(f(s)) = s$ for every $s$: doing it twice gets you back where you started. An involution pairs elements up — each $s$ with $f(s)$ — except for the **fixed points**, where $f(s) = s$.

:::lemma
If $f$ is an involution of a finite set $S$, then $|S|$ and the number of fixed points of $f$ have the same parity.
:::

:::proof
The elements that are not fixed come in pairs $\{s, f(s)\}$ with $s \ne f(s)$, and these pairs are disjoint. So $|S| = (\text{number of fixed points}) + 2 \times (\text{number of pairs})$.
:::

So if we know that one involution of $S$ has an *odd* number of fixed points, then $|S|$ is odd, and then *every* involution of $S$ has an odd number of fixed points — in particular at least one. Two involutions, one set, and parity carries information from one to the other. This is a counting argument, a cousin of the necklaces of Chapter 8.

### Idea 2: the flip finds the squares

For the set $S$ of solutions of $x^2 + 4yz = p$ in positive integers, the easy involution is the **flip** $(x, y, z) \mapsto (x, z, y)$: swapping $y$ and $z$ doesn't change $4yz$. Its fixed points are the solutions with $y = z$, and then
$$p = x^2 + 4y^2 = x^2 + (2y)^2 .$$
So a fixed point of the flip *is* the representation we want. It remains to show that $|S|$ is odd, and for that we need a second involution whose fixed points we can count.

### Idea 3: windmills

Here is the picture, found by the Russian mathematician Alexander Spivak. A solution $x^2 + 4yz = p$ is a **windmill**: a central $x \times x$ square with four $y \times z$ blades attached around it like the sails of a mill. Its total area is $x^2 + 4yz = p$. The flip turns each blade on its side.

::windmills

Now look at the outline of a windmill. The same outline can often be cut differently: pick a *different* central square inside it — the largest square centred at the middle that fits — and the rest splits into four congruent blades again. That re-cutting is exactly Zagier's map. Doing it twice returns the original cutting, so it is an involution, and it pairs up windmills with the same outline. Switch between the two pairings in the widget: Zagier's always leaves exactly one windmill alone; the flip leaves exactly the windmills whose blades are squares.

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Zagier's map re-cuts the same windmill outline around a different central square, so it preserves $x^2 + 4yz$ and undoes itself. A windmill that is re-cut into itself must have $x = y$; then $p = x(x + 4z)$, and since $p$ is prime, $x = 1$. So there is exactly one fixed point, $|S|$ is odd, and the flip has a fixed point.
:::
:::level[Proof]
Let $p \equiv 1 \pmod 4$ be prime and $S = \{(x, y, z) : x, y, z \ge 1,\ x^2 + 4yz = p\}$. $S$ is finite (each coordinate is less than $p$) and non-empty: $(1, 1, \frac{p-1}{4}) \in S$.

*Zagier's map $g$ is well defined on $S$.* The boundary cases $x = y - z$ and $x = 2y$ never occur: the first would give $p = x^2 + 4yz = (y-z)^2 + 4yz = (y + z)^2$, and the second $p = 4y^2 + 4yz = 4y(y + z)$, neither of which is prime. In each case, direct expansion shows that the image $(x', y', z')$ satisfies $x'^2 + 4y'z' = x^2 + 4yz$ (you will check the first case below), and its coordinates are positive by the case conditions. So $g$ maps $S$ to $S$.

*$g$ is an involution.* One checks that $g$ sends the first case into the third and vice versa, and the second case into itself, and that applying the formulas twice gives back $(x, y, z)$. For example, in the second case $g(x, y, z) = (2y - x, y, x - y + z)$, which again satisfies $y - z' < x' < 2y$ where $x' = 2y - x$, $z' = x - y + z$; applying the formula once more gives $(2y - (2y - x), y, (2y - x) - y + (x - y + z)) = (x, y, z)$.

*$g$ has exactly one fixed point.* A fixed point in the first or third case is impossible (the first coordinate strictly increases or decreases). In the second case, $(2y - x, y, x - y + z) = (x, y, z)$ means $x = y$. Then $p = x^2 + 4xz = x(x + 4z)$, and since $p$ is prime, $x = 1$, so $y = 1$ and $z = \frac{p-1}{4}$. This point does lie in the second case, since $y - z = 1 - \frac{p-1}{4} < 1 < 2$.

*Conclusion.* By the parity lemma, $|S|$ is odd. The flip $(x, y, z) \mapsto (x, z, y)$ is another involution of $S$, so it has an odd number of fixed points, hence at least one: some $(x, y, y) \in S$, and $p = x^2 + (2y)^2$.
:::
::::

```step
title: Zagier’s map preserves the equation
prompt: 'Check the first case: show that $(x + 2z)^2 + 4z(y - x - z) = x^2 + 4yz$.'
start: (x + 2z)^2 + 4z(y - x - z)
target: x^2 + 4y z
relation: '='
initial: (x + 2z)^2 + 4z(y - x - z)
solution: '$x^2 + 4xz + 4z^2 + 4yz - 4xz - 4z^2 = x^2 + 4yz$.'
```

Notice what kind of proof this is. It never *constructs* the two squares — it proves that a fixed point exists by counting. (It can be turned into an algorithm, but a slow one.) It is a pure existence proof by parity, in the spirit of the drinker paradox of Chapter 2 and the counting proof of Erdős in Chapter 4.

:::bio{name="Don Zagier" born=1951 place="Heidelberg, Bonn"}
Zagier grew up in the United States, finished school at thirteen and took his first degree at MIT at sixteen. He wrote his doctorate in Bonn under Friedrich Hirzebruch at twenty and became a professor at twenty-four. A number theorist of great range — modular forms, the values of zeta functions, knot invariants — he is also celebrated for short, surprising arguments and for his love of explicit computation. His one-sentence proof was inspired by an argument of Roger Heath-Brown, who in turn built on ideas of Liouville.
:::

## Products of sums of two squares

Which *composite* numbers are sums of two squares? The key is an identity known to the Indian mathematician Brahmagupta in 628, and rediscovered by Fibonacci in 1225: a product of two sums of two squares is again a sum of two squares.

$$(a^2 + b^2)(c^2 + d^2) = (ac - bd)^2 + (ad + bc)^2 .$$

```step
title: The Brahmagupta–Fibonacci identity
prompt: 'Verify the identity: start from $(a^2+b^2)(c^2+d^2)$ and reach $(ac - bd)^2 + (ad + bc)^2$.'
start: (a^2 + b^2)(c^2 + d^2)
target: (a c - b d)^2 + (a d + b c)^2
relation: '='
initial: (a^2 + b^2)(c^2 + d^2)
hints:
  - Expand both sides fully; the cross terms $\pm 2abcd$ cancel on the right.
solution: 'Both sides equal $a^2c^2 + a^2d^2 + b^2c^2 + b^2d^2$.'
```

With Fermat's theorem this gives the full answer, first stated by Girard: *a positive integer is a sum of two squares if and only if every prime $\equiv 3 \pmod 4$ appears in its factorisation to an even power.* For example $245 = 5 \cdot 7^2 = 7^2(1^2 + 2^2) = 7^2 + 14^2$, while $21 = 3 \cdot 7$ is not a sum of two squares. (If you have met complex numbers: the identity says $|zw|^2 = |z|^2|w|^2$ for $z = a + bi$ and $w = c + di$.)

## Infinitely many primes of the form 4k + 1

In Chapter 4 we proved that there are infinitely many primes $\equiv 3 \pmod 4$, and promised the other half. Fermat's little theorem supplies the missing piece.

:::lemma
If an odd prime $p$ divides $n^2 + 1$ for some integer $n$, then $p \equiv 1 \pmod 4$.
:::

:::proof
We have $n^2 \equiv -1 \pmod p$, and $p \nmid n$. Raise both sides to the power $\frac{p-1}{2}$ and use Fermat's little theorem:
$$1 \equiv n^{p-1} = \left(n^2\right)^{\frac{p-1}{2}} \equiv (-1)^{\frac{p-1}{2}} \pmod p .$$
Since $p > 2$, $1 \not\equiv -1 \pmod p$, so $\frac{p-1}{2}$ must be even: $p \equiv 1 \pmod 4$.
:::

:::theorem
There are infinitely many primes of the form $4k + 1$.
:::

:::proof
Let $p_1, \ldots, p_k$ be any primes of the form $4k+1$, and let $N = (2p_1 \cdots p_k)^2 + 1$. $N$ is odd and greater than $1$, so it has an odd prime factor $q$, which by the lemma is $\equiv 1 \pmod 4$. If $q$ were some $p_i$, it would divide $N - (2p_1\cdots p_k)^2 = 1$. So $q$ is a new prime of the form $4k+1$.
:::

This is Euclid's construction again (Chapter 4), with a different polynomial. The lemma is a first glimpse of a deeper question — *for which primes is $-1$, or $2$, or $3$, a square modulo $p$?* — whose answer is the subject of the next chapter.

## Exercises

```quiz
q: 'An involution on a set of $15$ elements has exactly $3$ fixed points. A second involution on the same set — how many fixed points can it have?'
options:
  - text: Exactly 3.
    why: Only the parity is forced.
  - text: Any odd number from 1 to 15.
    correct: true
    why: '$|S| = 15$ is odd, so every involution has an odd number of fixed points. All odd numbers are possible.'
  - text: Any number from 0 to 15.
    why: 'Zero is impossible: $15$ elements can''t all be paired.'
```

```prove
title: 2, and products
prompt: 'Using the Brahmagupta–Fibonacci identity, write $65 = 5 \times 13$ as a sum of two squares in two different ways, and then prove that if $n$ is a sum of two squares, so is $2n$.'
hints:
  - '$5 = 1^2 + 2^2$ and $13 = 2^2 + 3^2$ (or $3^2 + 2^2$ — the order of $c$ and $d$ changes the answer).'
  - '$2 = 1^2 + 1^2$.'
rubric:
  - 'You found two representations of $65$, e.g. $1^2 + 8^2$ and $4^2 + 7^2$.'
  - 'You applied the identity with $2 = 1^2 + 1^2$: $2(a^2+b^2) = (a-b)^2 + (a+b)^2$.'
solution: |
  With $(a, b) = (1, 2)$ and $(c, d) = (2, 3)$: $(1\cdot2 - 2\cdot3)^2 + (1\cdot 3 + 2 \cdot 2)^2 = 16 + 49 = 65$. With $(c, d) = (3, 2)$: $(3 - 4)^2 + (2 + 6)^2 = 1 + 64 = 65$. For the second part, $2(a^2 + b^2) = (1^2 + 1^2)(a^2 + b^2) = (a - b)^2 + (a + b)^2$.
```

```bug
title: A fixed point too many
prompt: 'A student tries to prove that every prime $p \equiv 1 \pmod 4$ has **exactly one** representation $p = x^2 + (2y)^2$ with $x$ odd. Where does the argument break?'
lines:
  - Zagier's involution on $S$ has exactly one fixed point.
  - So the flip has the same number of fixed points, namely one.
  - Each fixed point of the flip gives one representation $p = x^2 + (2y)^2$.
  - So the representation is unique.
wrong: 1
why: |
  Parity is all that transfers between involutions: both have an **odd** number of fixed points, not the same number. (The conclusion happens to be true — the representation is unique — but proving it needs a different argument, for example via unique factorisation in the Gaussian integers.)
```

:::challenge
**Check the involution.** Verify Zagier's map in the third case: show that $(x - 2y)^2 + 4(x - y + z)y = x^2 + 4yz$, that the image lies in the first case, and that applying the first-case formula to it returns $(x, y, z)$.

**From one fixed point to the other.** Start at Zagier's fixed point $(1, 1, rac{p-1}{4})$ and apply the flip, then Zagier's map, then the flip, and so on. Try it by hand for $p = 13$ or $p = 29$ with the widget. Prove that the walk never repeats a windmill and must end at a fixed point of the flip. This turns the existence proof into an algorithm (though not a fast one).
:::

## Further reading

- Don Zagier, “A one-sentence proof that every prime $p \equiv 1 \pmod 4$ is a sum of two squares”.:cite[zagier1990]
- Martin Aigner and Günter Ziegler, *Proofs from THE BOOK*, chapter “Representing numbers as sums of two squares” — three proofs, including Zagier's.:cite[aigner-ziegler]
