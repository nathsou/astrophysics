---
number: 22
title: How to find proofs
summary: Looking back over twenty-two chapters — the moves that keep recurring, how to choose among them, how to write a proof someone else can read, and what happens now that machines check, and even find, proofs.
duration: About 1½ hours
prerequisites: [what-is-a-proof]
theorems: []
techniques: [all of them]
---

We started with a question: how do people find proofs? Twenty-one chapters later, you have rebuilt some of the most celebrated arguments in mathematics — Euclid's primes, the irrationality of $\sqrt 2$ and of $\pi$, Fermat's descent and his little theorem, Gauss's golden theorem, Cantor's diagonal, Gödel's incompleteness, the ε–δ foundations of calculus, Euler's formula. None of them was found by magic. Each was found by someone who knew a repertoire of moves, recognised which one the problem was asking for, and kept trying when the first attempts failed.

This chapter gathers the moves together and offers some advice on using them. Then it looks ahead, to a world in which computers check proofs and are beginning to find them.

## Pólya revisited

George Pólya's four phases from Chapter 0 have been at work in every chapter.

**Understand the problem.** Every chapter began with evidence: tables of primes, circles of points, windmills, a Wason card task. Experiments don't prove anything, but they show you what is true, what is almost true (Euler's $n^2 + n + 41$) and what the hypotheses are for (Bernoulli's inequality fails without $x \ge -1$). Before you try to prove a statement, try to break it.

**Devise a plan.** The plan usually comes from the *shape* of the statement. “For all $n$” suggests induction. “There is no …” suggests contradiction, descent or an invariant. “There exists …” suggests a construction, a pigeonhole, a parity count or an extremal choice. A limit suggests working backwards from ε. The atlas below is organised this way.

**Carry out the plan.** Here the details matter: the order of the quantifiers (Chapter 2), the hypothesis you forgot to use (Chapter 15's Rolle without differentiability), the case that doesn't fit (Pólya's horses in Chapter 5). The step checker exists for this phase.

**Look back.** Can you see the result at a glance? Can you prove it differently? Zagier's windmills, the necklaces of Fermat's little theorem and Tennenbaum's squares are all “looking back” — second proofs that reveal *why*. And can you use the method elsewhere? Euclid's “multiply and add one” gave primes of the forms $4k+3$ and $4k+1$; Cantor's diagonal gave Russell, Turing and Gödel.

::technique-atlas

## Heuristics that keep working

A few pieces of advice cut across all the techniques.

- **Specialise.** Try the smallest cases, the extreme cases, the symmetric cases. The proof for $n = 3$ often contains the proof for every $n$.
- **Generalise, or strengthen.** Pólya's inventor's paradox: a stronger statement can be easier to prove, because it gives you a stronger hypothesis to use (Chapter 5's $2 - \frac1n$; Chapter 7's $x^4 + y^4 = z^2$; Chapter 5's trominoes with *any* square missing).
- **Work backwards.** From what you want, ask what would imply it. Every ε–N proof in Chapter 13 was found backwards and written forwards.
- **Name things.** “Let $d$ be the smallest divisor greater than $1$.” “Let $s = \sup A$.” A good name turns a vague object into one you can reason about, and extremal choices come with extra properties for free.
- **Look for what doesn't change.** Invariants (Chapter 20) prove impossibility; monovariants prove termination.
- **Count twice.** If you can count something in two ways, you get an equation (Chapters 8, 9 and 21).
- **Draw a picture — then distrust it.** Pictures suggested half the proofs in this course (Tennenbaum, windmills, lattice points, bisection) and hid assumptions in others (Chapter 0's missing square, Chapter 21's picture frame).
- **Read the hypotheses as clues.** If a hypothesis hasn't been used, either the proof is wrong or the theorem is more general than stated. Primality in Euclid's lemma, completeness in the intermediate value theorem, uniformity in Chapter 18's limit theorem: each was used exactly once, at the crucial moment.

## Which move? A mixed review

When you practise one technique at a time, the hardest decision — *which technique?* — is made for you. Here it isn't.

```quiz
q: 'Prove that there are infinitely many primes of the form $6k + 5$. Which move is most promising?'
options:
  - text: Induction on $k$.
    why: There is no useful relationship between the $k$th and $(k+1)$th such prime.
  - text: A Euclid-style construction, like the $4k + 3$ case in Chapter 4.
    correct: true
    why: 'Consider $6p_1\cdots p_n - 1$. It is $\equiv 5 \pmod 6$, so it has a prime factor $\equiv 5 \pmod 6$ (products of primes $\equiv 1$ stay $\equiv 1$), and that factor is new.'
  - text: The pigeonhole principle.
    why: Pigeonhole finds coincidences, not infinitely many primes.
```

```quiz
q: 'Prove that no power of $2$ is a sum of two or more consecutive positive integers ($2^k \ne a + (a+1) + \cdots + (a + m)$ with $m \ge 1$). Which idea cracks it?'
options:
  - text: The ε–δ definition.
    why: This is a statement about integers.
  - text: 'Write the sum as $\frac{(m+1)(2a + m)}{2}$ and look at parity: one factor is odd and greater than 1.'
    correct: true
    why: '$m + 1$ and $2a + m$ have opposite parity, and both are at least $2$, so the product has an odd factor greater than $1$ — which no power of $2$ has. Unfolding the definition, then parity.'
  - text: Cantor's diagonal argument.
    why: No list here to diagonalise against.
```

```quiz
q: 'Every point of the plane is coloured red or blue. Prove that there are two points exactly $1$ apart with the same colour. Which move?'
options:
  - text: Pigeonhole on a well-chosen finite configuration.
    correct: true
    why: 'Take an equilateral triangle of side $1$: three points, two colours, so two vertices share a colour — and they are $1$ apart.'
  - text: Induction on the number of points.
    why: The plane has uncountably many points; there is no natural induction.
  - text: Contradiction and the intermediate value theorem.
    why: Possible in principle, but a three-point pigeonhole is far simpler.
```

```quiz
q: 'Show that $f(x) = x^3 + x - 1$ has exactly one real root. Which combination of results works?'
options:
  - text: The intermediate value theorem for existence, and monotonicity (from $f'(x) = 3x^2 + 1 > 0$) for uniqueness.
    correct: true
    why: '$f(0) < 0 < f(1)$ gives a root; a strictly increasing function (Chapter 15) takes each value at most once.'
  - text: Rolle's theorem alone.
    why: Rolle helps with uniqueness (two roots would force $f' = 0$ somewhere), but existence needs the intermediate value theorem.
  - text: The rational root test.
    why: It shows the root is irrational, not that it exists or is unique.
```

## Writing a proof someone can read

A proof is a piece of writing addressed to a sceptical but patient reader. Some rules that make the difference:

1. **Say what you are proving and how.** “We prove the contrapositive.” “We argue by induction on $n$.” “Suppose, for a contradiction, that …”
2. **Introduce every symbol before you use it,** with its type: “Let $n \ge 1$ be an integer.” “Let $\varepsilon > 0$.”
3. **Keep the quantifiers in order.** Choose things in the order the statement allows (Chapter 2), and make dependencies visible: “choose $N$ (depending on $\varepsilon$) such that …”
4. **Justify every step that is not routine** — and be honest about what is routine for your reader. “Clearly” should mean “you can check this in your head in a few seconds”.
5. **Use words, not just symbols.** “So”, “hence”, “because”, “it follows that” carry the logic; a column of equations without them is a puzzle, not a proof.
6. **End by saying what you have shown.** “This contradiction shows that $\sqrt 2$ is irrational.”

```prove
title: Your turn, from scratch
prompt: |
  Prove that for every positive integer $n$, some Fibonacci number is divisible by $n$. (The Fibonacci numbers are $F_0 = 0$, $F_1 = 1$, $F_{k+1} = F_k + F_{k-1}$.)

  *There is no chapter for this one. Decide on a move, and write the proof as if for a reader who has not seen the course.*
hints:
  - 'Look at the pairs $(F_k \bmod n,\; F_{k+1} \bmod n)$. How many possible pairs are there?'
  - By pigeonhole two pairs coincide. The recurrence can be run **backwards** too — $F_{k-1} = F_{k+1} - F_k$ — so the sequence of pairs is periodic from the very start.
  - 'The pair $(F_0, F_1) = (0, 1)$ therefore recurs: some $F_m \equiv 0 \pmod n$ with $m > 0$.'
rubric:
  - You considered consecutive pairs of Fibonacci numbers modulo $n$ and counted $n^2$ possible pairs (pigeonhole).
  - You showed that a repeated pair forces the whole sequence of pairs to repeat, using the recurrence forwards and backwards.
  - 'You concluded that $(0, 1)$ recurs, giving $F_m \equiv 0 \pmod n$ with $m \ge 1$.'
  - The proof names its objects, states its technique and ends with the conclusion.
solution: |
  Consider the pairs $P_k = (F_k \bmod n, F_{k+1} \bmod n)$ for $k = 0, 1, \ldots, n^2$. There are only $n^2$ possible pairs of remainders, so by the pigeonhole principle $P_i = P_j$ for some $0 \le i < j \le n^2$. Each pair determines the next one, $P_{k+1} = (F_{k+1}, F_k + F_{k+1}) \bmod n$, and also the previous one, since $F_{k-1} = F_{k+1} - F_k$. So from $P_i = P_j$ we get, stepping backwards $i$ times, $P_0 = P_{j - i}$. Hence $F_{j-i} \equiv F_0 = 0 \pmod n$, with $j - i \ge 1$: the Fibonacci number $F_{j-i}$ is divisible by $n$.
tutor: A good proof uses pigeonhole on the n² pairs of consecutive residues and the reversibility of the recurrence to show the pair (0, 1) recurs. Check that the learner justifies why the repetition goes back to the start.
```

## Machines that check proofs

The four-colour theorem of 1976 (Chapter 21) was the first major theorem whose proof no human could check entirely by hand. It was not the last. In 1998 Thomas Hales announced a proof of the Kepler conjecture — that the familiar pyramid of oranges is the densest way to pack spheres — which relied on enormous computations; the referees of the *Annals of Mathematics* declared themselves “99% certain” of it. Hales responded by leading a project, Flyspeck, to check the entire proof by computer, line by line, in formal logic. It was finished in 2014.

Programs like this are **proof assistants**: Coq (now Rocq), Isabelle, HOL Light and Lean. In them a proof is written in a formal language like the ones of Chapter 12, and a small program called the *kernel* checks every step against the rules of logic. Georges Gonthier verified the four-colour theorem in Coq in 2005. In 2020 Peter Scholze challenged the Lean community to check a difficult new theorem of his that even he was not fully sure about; they did so by 2022. A project to formalise the proof of Fermat's Last Theorem in Lean began in 2024. Lean's library, mathlib, now contains a large part of an undergraduate curriculum.

The step checker in this course is a much humbler cousin. It checks individual algebraic steps exactly, and tests other claims by trying many values — which is why it distinguishes “✓ algebra” from “✓ tested”. It cannot tell you whether your argument as a whole is valid. That remains your job, and the tutor's.

## Machines that find proofs

Since the 1950s programs have been finding proofs of small theorems, and some have found things humans had missed: in 1996 a program called EQP proved the Robbins conjecture in Boolean algebra, open for sixty years. More recently, systems that combine language models with proof assistants have started to solve competition problems. In 2024 Google DeepMind's AlphaProof and AlphaGeometry together reached the standard of a silver medal at the International Mathematical Olympiad, with every proof checked by Lean.

What does that mean for learning to prove? Probably what calculators meant for arithmetic: the mechanical parts get cheaper, and understanding gets more valuable. A formal proof checked by a machine certifies that a statement is true. It does not tell you *why*, it does not tell you which ideas could be used elsewhere, and it does not choose which questions are worth asking. The proofs in this course have lasted, some of them for more than two thousand years, not because they were correct — plenty of correct proofs are forgotten — but because they explain.

:::bio{name="Nicolas Bourbaki" born=1934 place="Nancy (Poldavia, allegedly)"}
The most influential mathematician of the twentieth century never existed. “Nicolas Bourbaki” was the pen-name of a group of young French mathematicians — André Weil, Henri Cartan, Jean Dieudonné, Claude Chevalley and others — who met in 1934 intending to write a modern analysis textbook, and ended up rewriting mathematics. Their *Éléments de mathématique*, begun in 1939, built everything from set theory upwards with a rigour and structure that shaped university teaching for decades. Members retired at fifty. The group enjoyed its own joke: Bourbaki was given a biography, a daughter's wedding announcement, and a membership of the Royal Academy of Poldavia; he even applied to join the American Mathematical Society.
:::

## Where to go next

- **More problems:** Paul Zeitz, *The Art and Craft of Problem Solving*, and Arthur Engel, *Problem-Solving Strategies*, organised by technique, with hundreds of problems.:cite[zeitz,engel]
- **Proof as a subject:** Daniel Velleman, *How to Prove It*.:cite[velleman]
- **More beautiful proofs:** Aigner and Ziegler, *Proofs from THE BOOK*.:cite[aigner-ziegler]
- **Formal proof:** the *Natural Number Game* and *Mathematics in Lean*, free online introductions to proving theorems in Lean.:cite[mil]
- **Heuristics:** George Pólya, *How to Solve It* and *Mathematics and Plausible Reasoning*.:cite[polya1945,polya1954]
