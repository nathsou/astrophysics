---
number: 5
title: Climbing the ladder
summary: Mathematical induction — proving infinitely many statements with two finite arguments. Sums, inequalities, tromino tilings, the Tower of Hanoi, the surprising power of proving something stronger, and a horse of a different colour.
duration: About 2½ hours
prerequisites: [root-two]
theorems: [Gauss’s sum, Bernoulli’s inequality, Golomb’s tromino theorem (1954), The Tower of Hanoi needs 2ⁿ − 1 moves]
techniques: [induction, strengthening the hypothesis, recursion]
---

The story goes that in 1784 a schoolmaster in Brunswick, wanting some peace, told his class to add up the numbers from $1$ to $100$. Almost at once a seven-year-old called Carl Friedrich Gauss put his slate on the teacher's desk with a single number on it: $5050$.:cite[hayes-gauss] Whether or not it happened quite like that, the trick is real. Pair the first number with the last, the second with the second-to-last, and so on:

$$1 + 100 = 2 + 99 = 3 + 98 = \cdots = 50 + 51 = 101 .$$

There are $50$ pairs, so the total is $50 \times 101 = 5050$. The same pairing gives, for any $n$,

$$1 + 2 + \cdots + n = \frac{n(n+1)}{2}.$$

This is a statement about *every* natural number $n$ — infinitely many statements at once. Gauss's pairing proves them all with one idea. But what if you had guessed the formula from a table of small cases, and had no clever idea? There is a method that turns “it works for $n$, therefore it works for $n + 1$” into a proof for every $n$. It is called **induction**, and it is the most important proof technique in discrete mathematics.

## The principle of induction

:::theorem{name="The principle of mathematical induction"}
Let $P(n)$ be a statement about natural numbers $n$. Suppose that

1. **(base case)** $P(0)$ is true, and
2. **(inductive step)** for every $k \ge 0$, if $P(k)$ is true then $P(k+1)$ is true.

Then $P(n)$ is true for every natural number $n$.
:::

The usual picture is a row of dominoes. The base case knocks over the first. The inductive step says that each domino, *if* it falls, knocks over the next. Together, they bring down the whole infinite row — but only together.

::dominoes

Why is the principle true? One answer is that it is an **axiom**: part of what we mean by the natural numbers, as Richard Dedekind and Giuseppe Peano made precise in 1888–89. Another is that it follows from the well-ordering principle of Chapter 3.

:::proof[Proof from well-ordering]
Suppose (1) and (2) hold, but $P(n)$ fails for some $n$. Then the set of $n$ for which $P(n)$ fails is non-empty, so it has a smallest element $m$. By (1), $m \ne 0$, so $m - 1$ is a natural number, and $P(m - 1)$ is true because $m$ was the *smallest* failure. By (2), $P(m)$ is true — a contradiction.
:::

This argument — *consider the smallest counterexample* — is worth remembering in its own right. It turns every induction proof into a proof by contradiction, and sometimes it is the more natural way to think.

## A first induction proof

Here is Gauss's formula again, proved by induction. Every induction proof has the same four parts, and it is good practice to label them.

:::theorem{name="Gauss’s sum"}
For every natural number $n$, $\displaystyle 1 + 2 + \cdots + n = \frac{n(n+1)}{2}$.
:::

:::proof
Let $P(n)$ be the statement $1 + 2 + \cdots + n = \frac{n(n+1)}{2}$.

**Base case.** For $n = 0$ the left side is the empty sum, $0$, and the right side is $\frac{0 \cdot 1}{2} = 0$.

**Inductive hypothesis.** Let $k \ge 0$ and suppose $P(k)$: $1 + 2 + \cdots + k = \frac{k(k+1)}{2}$.

**Inductive step.** Then
$$1 + 2 + \cdots + k + (k+1) = \frac{k(k+1)}{2} + (k + 1) = \frac{(k+1)(k+2)}{2},$$
using the hypothesis in the first equality and algebra in the second. This is $P(k+1)$.

**Conclusion.** By induction, $P(n)$ holds for every natural number $n$.
:::

Notice where the hypothesis is used: to replace the sum of the first $k$ terms by the formula. That is the heart of every inductive step — find the smaller instance hiding inside the larger one. The rest is algebra, which you can hand to the step checker. Below, $S(n)$ is defined as the sum $1 + \cdots + n$, so the checker knows that $S(k+1) = S(k) + (k+1)$.

```step
title: The inductive step, checked
prompt: 'Starting from $S(k+1)$, reach $\frac{(k+1)(k+2)}{2}$. Mark where you use the inductive hypothesis $S(k) = \frac{k(k+1)}{2}$ with a comment.'
defs: ['S(n) = sum(j, j, 1, n)']
domains: { k: nat }
start: S(k+1)
target: (k+1)(k+2)/2
relation: '='
initial: S(k+1)
hints:
  - 'First peel off the last term: $S(k+1) = S(k) + (k+1)$.'
  - 'Now use the hypothesis: $S(k) + (k+1) = \frac{k(k+1)}{2} + (k+1)$.'
solution: |
  $S(k+1) = S(k) + (k+1) = \frac{k(k+1)}{2} + (k+1) = \frac{(k+1)(k+2)}{2}$.
```

:::tip
The checker marks the step that uses the inductive hypothesis as **✓ tested**, not **✓ algebra**: it is not an algebraic identity, it is true *because the formula is true*, which the checker can confirm only by testing values. That is exactly the step that needs the hypothesis.
:::

:::history{year=1575 title="Naming the ladder" people="Francesco Maurolico, Blaise Pascal, Augustus De Morgan, Richard Dedekind, Giuseppe Peano"}
Arguments that pass from each case to the next are ancient, but the first clear use of induction as a method of proof is usually credited to Francesco Maurolico, who in 1575 proved that the sum of the first $n$ odd numbers is $n^2$. Blaise Pascal used it systematically in his *Treatise on the Arithmetical Triangle* (written 1654), proving each property of the triangle for the first row and then showing how it passes from one row to the next. The name “mathematical induction” was given by Augustus De Morgan in 1838, to distinguish it from induction in the sciences — which, as Chapter 0 showed, proves nothing. Dedekind (1888) and Peano (1889) finally made it one of the axioms that *define* the natural numbers.:cite[cajori-induction]
:::

## Squares and odd numbers

Maurolico's theorem has a proof you can see: an $n \times n$ square is built from nested L-shapes containing $1, 3, 5, \ldots, 2n - 1$ dots.

$$1 + 3 + 5 + \cdots + (2n - 1) = n^2$$

```step
title: Maurolico’s theorem, inductive step
prompt: 'Let $T(n) = 1 + 3 + \cdots + (2n-1)$. Assuming $T(k) = k^2$, show $T(k+1) = (k+1)^2$.'
defs: ['T(n) = sum(2j - 1, j, 1, n)']
domains: { k: nat }
start: T(k+1)
target: (k+1)^2
relation: '='
initial: T(k+1)
hints:
  - 'The last term of $T(k+1)$ is $2(k+1) - 1 = 2k + 1$.'
solution: '$T(k+1) = T(k) + (2k+1) = k^2 + 2k + 1 = (k+1)^2$.'
```

## Inequalities

Induction proves inequalities too, and here the inductive step usually needs a little more care: you replace a quantity by something *smaller* (or larger), and must check that the direction is right. A classic example, found by Jacob Bernoulli in 1689:

:::theorem{name="Bernoulli’s inequality"}
For every real number $x \ge -1$ and every natural number $n$, $(1 + x)^n \ge 1 + nx$.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Multiply the inequality for $n$ by $1 + x$, which is not negative, and throw away a square.
:::
:::level[Proof]
Fix $x \ge -1$ and induct on $n$. For $n = 0$ both sides are $1$. Suppose $(1+x)^k \ge 1 + kx$. Since $1 + x \ge 0$, multiplying both sides by $1 + x$ keeps the direction of the inequality:
$$(1 + x)^{k+1} = (1+x)^k(1+x) \ge (1 + kx)(1 + x) = 1 + (k+1)x + kx^2 \ge 1 + (k+1)x,$$
since $kx^2 \ge 0$. This is the statement for $k + 1$.
:::
::::

Where did we use $x \ge -1$? Only in multiplying by $1 + x$. Remove the hypothesis and the theorem fails: for $x = -3$ and $n = 5$, $(1+x)^5 = (-2)^5 = -32$, while $1 + 5x = -14$. Try the chain in the step checker; it will warn you if an inequality points the wrong way.

```step
title: Bernoulli’s inductive step
prompt: 'Assuming $x \ge -1$ and $(1+x)^k \ge 1 + kx$, show $(1+x)^{k+1} \ge 1 + (k+1)x$.'
assume: ['x >= -1']
domains: { k: nat }
start: (1+x)^(k+1)
target: 1 + (k+1)x
relation: '>='
initial: (1+x)^(k+1)
hints:
  - 'Write $(1+x)^{k+1} = (1+x)^k (1+x)$, then use the hypothesis.'
  - '$(1 + kx)(1+x) = 1 + (k+1)x + kx^2$.'
solution: '$(1+x)^{k+1} = (1+x)^k(1+x) \ge (1+kx)(1+x) = 1 + (k+1)x + kx^2 \ge 1 + (k+1)x$.'
```

## Beyond formulas: tilings

Induction is not only for formulas. Here is a theorem about tiling a chessboard, from Solomon Golomb's 1954 paper that introduced **polyominoes** — shapes made of squares joined edge to edge.:cite[golomb1954] An **L-tromino** is three squares in an L.

:::theorem{name="Golomb’s tromino theorem" who="Solomon Golomb" year=1954}
For every $n \ge 0$, a $2^n \times 2^n$ board with any one square removed can be tiled exactly by L-trominoes.
:::

Play with it first: remove any square you like and watch the tiling appear. Then read the proof, and notice that the picture *is* the inductive step.

::tromino-tiler

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Cut the board into four quarters. The missing square is in one of them. Place one tromino at the centre, covering one square of each of the *other* three quarters. Now every quarter is a smaller board with one square missing.
:::
:::level[Proof]
Induction on $n$. For $n = 0$ the board is a single square, which is removed, leaving nothing to tile.

Suppose the theorem holds for $2^k \times 2^k$ boards, and take a $2^{k+1} \times 2^{k+1}$ board with one square removed. Divide it into four $2^k \times 2^k$ quarters. The removed square lies in exactly one quarter. The four squares at the centre of the board, one in each quarter, form a $2 \times 2$ block; the three of them that lie in the *other* quarters form an L-tromino. Place a tromino there.

Now each of the four quarters is a $2^k \times 2^k$ board with exactly one square unavailable — the removed one, or the one covered by the central tromino. By the inductive hypothesis, each can be tiled. Together with the central tromino, this tiles the whole board.
:::
::::

The count checks out: $4^n - 1$ squares, and $4^n - 1$ is always divisible by $3$ — itself an easy induction. Notice something subtle: the *statement* of the theorem had to allow the missing square to be anywhere. If it had said “with a corner removed”, the inductive step would fail, because three of the four quarters are missing a square at their *centre* corner, not at the board's corner. A stronger statement made the induction work. We will come back to this idea shortly.

## The Tower of Hanoi

In 1883 the French mathematician Édouard Lucas sold a puzzle under the pen-name “N. Claus de Siam” — an anagram of *Lucas d'Amiens*. It came with a legend: in a temple in Benares, priests move sixty-four golden discs between three diamond needles, and when they finish, the world will end.

::hanoi

:::theorem
The Tower of Hanoi with $n$ discs can be solved in $2^n - 1$ moves, and no fewer.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
To move the largest disc, the other $n - 1$ must all be stacked on the third peg. So: move $n - 1$ discs out of the way, move the largest, move the $n - 1$ back. That gives $M(n) = 2M(n-1) + 1$, and nothing faster is possible.
:::
:::level[Proof]
Let $M(n)$ be the minimum number of moves. $M(0) = 0$.

*Upper bound.* The recursive strategy — move the top $n - 1$ discs to the spare peg, move the largest disc, move the $n - 1$ discs on top of it — takes $M(n-1) + 1 + M(n-1)$ moves, so $M(n) \le 2M(n-1) + 1$.

*Lower bound.* In any solution, the largest disc must move at least once. Just before its first move, it is alone on its peg and the target peg is empty, so the other $n - 1$ discs are all on the third peg: getting them there took at least $M(n-1)$ moves. After the largest disc's *last* move, the other $n - 1$ discs must be moved onto it, taking at least $M(n-1)$ more moves. So $M(n) \ge 2M(n-1) + 1$.

Hence $M(n) = 2M(n-1) + 1$. Now show $M(n) = 2^n - 1$ by induction: it holds for $n = 0$, and if $M(k) = 2^k - 1$ then $M(k+1) = 2(2^k - 1) + 1 = 2^{k+1} - 1$.
:::
::::

For $64$ discs, at one move per second, the priests need $2^{64} - 1 \approx 1.8 \times 10^{19}$ seconds — about $585$ billion years, forty times the age of the universe. The legend is safe.

Notice how closely the proof follows the recursive *algorithm*. That is no accident: a recursive program and an induction proof are the same idea, one computing, the other proving. The widget's solver is literally the three-line recursion from the proof.

:::bio{name="Édouard Lucas" born=1842 died=1891 place="Amiens and Paris"}
Lucas taught at a Paris lycée and loved recreational mathematics: besides the Tower of Hanoi he studied the Fibonacci numbers (and the Lucas numbers named after him), and devised a test for the primality of Mersenne numbers. In 1876 he used it to show by hand that $2^{127} - 1$ is prime, which remained the largest known prime for 75 years. He died at 49 after a strange accident: at a banquet a waiter dropped a stack of plates, and a shard cut his cheek; the wound became infected.
:::

## Proving more to prove less

Here is a puzzle that looks as if it should be easy by induction.

:::theorem
For every $n \ge 1$, $\displaystyle 1 + \frac14 + \frac19 + \cdots + \frac1{n^2} < 2$.
:::

Try the obvious induction. Suppose the sum up to $k$ is less than $2$. Adding $\frac1{(k+1)^2}$ gives something less than $2 + \frac1{(k+1)^2}$ — which tells us nothing. The hypothesis “less than $2$” is too weak to carry itself forward: we don't know *how much* room is left below $2$.

The cure is surprising. Prove something **stronger**, which carries its own margin:

$$1 + \frac14 + \cdots + \frac1{n^2} \le 2 - \frac1n .$$

Now the inductive step has exactly what it needs. Assuming the bound for $k$, the sum up to $k + 1$ is at most $2 - \frac1k + \frac1{(k+1)^2}$, and we need this to be at most $2 - \frac1{k+1}$ — that is, $\frac1{(k+1)^2} \le \frac1k - \frac1{k+1} = \frac1{k(k+1)}$, which is true.

```step
title: The stronger inductive step
prompt: 'Check the chain that finishes the step: $2 - \frac1k + \frac1{(k+1)^2} \le 2 - \frac1{k+1}$ for $k \ge 1$.'
domains: { k: posint }
start: 2 - 1/k + 1/(k+1)^2
target: 2 - 1/(k+1)
relation: '<='
initial: 2 - 1/k + 1/(k+1)^2
hints:
  - 'Since $(k+1)^2 > k(k+1)$, we have $\frac1{(k+1)^2} < \frac1{k(k+1)}$.'
  - '$\frac1{k(k+1)} = \frac1k - \frac1{k+1}$.'
solution: '$2 - \frac1k + \frac{1}{(k+1)^2} < 2 - \frac1k + \frac{1}{k(k+1)} = 2 - \frac1k + \frac1k - \frac1{k+1} = 2 - \frac1{k+1}$.'
```

Pólya called this the **inventor's paradox**: the more ambitious plan may have more chance of success.:cite[polya1945] A stronger statement gives you a stronger hypothesis to use. When an induction gets stuck, ask whether you are trying to prove too little. (The true value of the infinite sum, by the way, is $\pi^2/6 \approx 1.645$, a famous result of Euler we will prove in Chapter 16.)

## When induction goes wrong

Induction has two parts, and both are essential. Consider “every natural number $n$ satisfies $n = n + 1$”. The inductive step is valid: if $k = k + 1$, adding $1$ to both sides gives $k + 1 = k + 2$. Only the base case fails. Without it, the dominoes stand.

More treacherous is an inductive step that works for most $k$ but not for all. George Pólya invented the best example.:cite[polya1954]

```bug
title: All horses are the same colour
prompt: 'Here is Pólya''s “proof” that in any set of horses, all the horses have the same colour. Which line is the first one that fails — and for which value of $k$?'
lines:
  - Let $P(n)$ be the statement “in any set of $n$ horses, all have the same colour”. We prove it for all $n \ge 1$.
  - '**Base case.** In a set of one horse, all horses have the same colour.'
  - '**Step.** Suppose $P(k)$, and take a set of $k + 1$ horses, numbered $1, \ldots, k+1$.'
  - Horses $1, \ldots, k$ form a set of $k$ horses, so they all have the same colour. So do horses $2, \ldots, k+1$.
  - The two groups overlap, so all $k + 1$ horses have the same colour as the horses in the overlap.
wrong: 4
why: |
  For $k = 1$ the two groups are $\{1\}$ and $\{2\}$, and they **do not overlap**. Every other line is fine for every $k$, and line 5 is fine for $k \ge 2$ — so the whole chain of dominoes is intact *except the very first link*, from $P(1)$ to $P(2)$. That single gap is enough to make the conclusion false.
notes:
  '3': 'Each group has $k$ horses, so the hypothesis applies to each. That is correct.'
```

## Exercises

```prove
title: Divisible by three
prompt: Prove by induction that $n^3 - n$ is divisible by $3$ for every natural number $n$.
hints:
  - 'Expand $(k+1)^3 - (k+1)$ and look for $k^3 - k$ inside it.'
  - '$(k+1)^3 - (k+1) = (k^3 - k) + 3k^2 + 3k$.'
rubric:
  - You checked the base case $n = 0$ (or $n = 1$).
  - You stated the inductive hypothesis clearly.
  - 'You wrote $(k+1)^3 - (k+1)$ as $(k^3 - k)$ plus a multiple of $3$, and concluded.'
solution: |
  Let $P(n)$: $3 \mid n^3 - n$. For $n = 0$, $0^3 - 0 = 0$ is divisible by $3$. Suppose $3 \mid k^3 - k$. Then
  $$(k+1)^3 - (k+1) = k^3 + 3k^2 + 3k + 1 - k - 1 = (k^3 - k) + 3(k^2 + k),$$
  a sum of two multiples of $3$. So $3 \mid (k+1)^3 - (k+1)$, and by induction $P(n)$ holds for all $n$. (Alternatively, without induction: $n^3 - n = (n-1)n(n+1)$ is a product of three consecutive integers, one of which is a multiple of $3$.)
```

```step
title: Hanoi’s recurrence
prompt: 'Show that $M(k) = 2^k - 1$ satisfies $M(k+1) = 2M(k) + 1$: start from $2(2^k - 1) + 1$ and reach $2^{k+1} - 1$.'
domains: { k: nat }
start: 2(2^k - 1) + 1
target: 2^(k+1) - 1
relation: '='
initial: 2(2^k - 1) + 1
solution: '$2(2^k - 1) + 1 = 2^{k+1} - 2 + 1 = 2^{k+1} - 1$.'
```

```quiz
q: 'You want to prove $2^n > n^2$ for all $n \ge 5$. Which base case do you need?'
options:
  - text: '$n = 0$'
    why: 'The statement is claimed only from $5$ on — and it is false for $n = 2, 3, 4$ ($2^4 = 16 = 4^2$).'
  - text: '$n = 5$'
    correct: true
    why: '$32 > 25$. Induction can start at any integer $n_0$: the base case is $P(n_0)$ and the step is for every $k \ge n_0$.'
  - text: 'None — the inductive step alone suffices.'
    why: Without a base case, nothing starts the chain.
```

:::challenge
**Fibonacci.** The Fibonacci numbers are $F_1 = F_2 = 1$ and $F_{n+2} = F_{n+1} + F_n$. Prove that $F_1 + F_2 + \cdots + F_n = F_{n+2} - 1$, and that $F_n^2 - F_{n-1}F_{n+1} = (-1)^{n+1}$ for $n \ge 2$. For the second, you will want to prove something about two consecutive values of $n$ at once — a first taste of the *strong induction* of Chapter 6.
:::

## Further reading

- George Pólya, *Induction and Analogy in Mathematics* — where the horses come from, and much more about guessing and proving.:cite[polya1954]
- Solomon Golomb, *Polyominoes* — the book that grew out of the 1954 paper (and indirectly inspired *Tetris*).:cite[golomb1954]
