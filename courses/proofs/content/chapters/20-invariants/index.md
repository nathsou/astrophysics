---
number: 20
title: Invariants
summary: To prove that something is impossible, find a quantity that never changes. The bridges of Königsberg, the 15 puzzle that fooled America, a puzzle about formal systems, and Conway’s soldiers — who can never reach row five.
duration: About 2½ hours
prerequisites: [induction]
theorems: [Euler’s theorem on walks (1736), The handshake lemma, The 15 puzzle’s parity invariant, Conway’s soldiers cannot reach row 5 (1961)]
techniques: [invariants, monovariants, parity, colouring, weighting]
---

How do you prove that something *cannot* be done — that no sequence of moves, however long or clever, leads from here to there? You can't try every sequence. Instead, look for a quantity that every move leaves unchanged — an **invariant**. If it has one value at the start and another at the goal, the goal is unreachable. The same idea with a quantity that only ever goes *down* — a **monovariant** — proves that processes must stop, or that some targets are out of reach.

The classic warm-up is the **mutilated chessboard**. Remove two opposite corners from a chessboard, leaving $62$ squares. Can you cover it exactly with $31$ dominoes? Every domino covers one black and one white square, whatever its position — that is the invariant. Opposite corners have the same colour, so the mutilated board has $32$ squares of one colour and $30$ of the other. No tiling exists. The philosopher Max Black posed the puzzle in 1946; its solution is a perfect example of a proof that replaces an impossible search with a single observation.

## The bridges of Königsberg

The city of Königsberg in Prussia (now Kaliningrad) was built around two islands in the river Pregel, linked to the banks and to each other by seven bridges. Its citizens, the story goes, liked to wonder whether one could walk through the city crossing each bridge exactly once. Try it.

::konigsberg

In 1736 Leonhard Euler proved that it is impossible — and in doing so founded the subject now called graph theory.:cite[euler1736] He noticed that the shape of the land doesn't matter, only which pieces are connected by how many bridges. Today we draw each land mass as a point (a **vertex**) and each bridge as a line (an **edge**): a **graph**. The number of edges at a vertex is its **degree**.

:::theorem{name="Euler’s theorem on walks" who="Leonhard Euler" year=1736}
A walk that uses every edge of a graph exactly once can exist only if the graph has either no vertices of odd degree (and then the walk can return to its start) or exactly two (and then it must start at one of them and end at the other).
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Every time a walk passes *through* a vertex, it uses two edges there — one in, one out. So every vertex except the start and the end must have an even number of edges.
:::
:::level[Proof]
Consider a walk using each edge exactly once, and a vertex $v$ that is neither the start nor the end of the walk. Each visit to $v$ enters along one edge and leaves along another, using two edges at $v$, and every edge at $v$ is used exactly once. So the degree of $v$ is twice the number of visits: even. The start and end can have odd degree (one extra edge each) — or, if they are the same vertex, even degree. So the number of odd vertices is $0$ or $2$.
:::
::::

In Königsberg all four land masses have odd degree ($3, 3, 3$ and $5$). So there is no such walk. The converse is also true for connected graphs (proved by Carl Hierholzer in 1873): zero or two odd vertices guarantee a walk. Try the eighth bridge in the widget — two odd vertices remain, and a walk appears.

Why can't there be exactly *one* odd vertex? Because of a small but famous invariant.

:::lemma{name="The handshake lemma"}
In every graph, the sum of all the degrees is twice the number of edges. So the number of vertices of odd degree is even.
:::

:::proof
Each edge has two ends, so it contributes exactly $2$ to the sum of the degrees. A sum of numbers is even exactly when it has an even number of odd terms.
:::

At any party, the number of people who have shaken an odd number of hands is even.

:::bio{name="Leonhard Euler, geographer" born=1707 died=1783 place="St Petersburg"}
Euler never visited Königsberg. The problem reached him in St Petersburg through the mayor of Danzig, Carl Ehler, and at first Euler thought it hardly mathematics at all — its solution, he wrote, “bears little relationship to mathematics”. He was wrong about that: his short paper, presented in 1735, is regarded as the first theorem of graph theory and a founding document of topology. Two of the seven bridges were destroyed in the Second World War; with the ones that remain today, the walk *is* possible.
:::

## The 15 puzzle

In 1880 the United States went mad for a small sliding puzzle: fifteen numbered tiles in a four-by-four box with one empty space. Newspapers printed puzzles; employers banned it at work. The famous puzzle-maker Sam Loyd (who falsely claimed to have invented it — the postmaster Noyes Chapman had, around 1874) offered a prize of \$1,000 to anyone who could start from the solved position with just the $14$ and $15$ swapped and slide the tiles back into order. Nobody collected it.

::fifteen-puzzle

:::theorem{name="The 15 puzzle is half impossible" who="Johnson and Story" year=1879}
A position of the 15 puzzle can be reached from the solved position only if the parity of the arrangement (as a permutation of the 16 squares, counting the gap) equals the parity of the gap's distance from its home corner. In particular, the position with $14$ and $15$ swapped cannot be solved.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Each move swaps the gap with a tile. That changes the parity of the arrangement *and* moves the gap one step, changing the parity of its distance. So the sum of the two parities never changes. Loyd's position has the wrong sum.
:::
:::level[Proof]
Think of a position as a permutation of the 16 squares, with the gap as the 16th tile. Every permutation is either **even** or **odd** — a product of an even or odd number of transpositions (swaps of two items) — and a single transposition always changes the parity (this can be shown by counting inversions, pairs in the wrong order). A move swaps the gap with an adjacent tile: one transposition, so the parity of the arrangement flips. It also moves the gap one step up, down, left or right, changing its taxicab distance from the bottom-right corner by exactly $1$, so that parity flips too. Hence the sum of the two parities, modulo $2$, is invariant.

In the solved position both are even. Swapping $14$ and $15$ is a single transposition with the gap at home: the arrangement is odd and the distance is $0$, so the invariant is odd. Unreachable.
:::
::::

William Woolsey Johnson and William Edward Story proved this in 1879, before the craze even started, in the new *American Journal of Mathematics*.:cite[johnson-story] Story also proved the converse: every position with the right invariant *can* be solved — so exactly half of all arrangements are reachable.

## A puzzle about proofs

In *Gödel, Escher, Bach*, Douglas Hofstadter introduced a tiny formal system — a set of strings and rules for making new strings from old, like the formal systems of Chapter 12 in miniature.:cite[geb] You start with the string MI; can you produce MU?

::mu-puzzle

People who try it by hand soon suspect that it is impossible, and they are right. The invariant is not in the strings but in a number computed from them.

:::theorem{name="MU is not a theorem" who="Douglas Hofstadter" year=1979}
No sequence of rules produces MU from MI.
:::

:::proof
Let $c$ be the number of I's in the string. Initially $c = 1$. Rule 1 and rule 4 don't change $c$; rule 2 doubles it; rule 3 decreases it by $3$. Modulo $3$, doubling sends $1 \mapsto 2$ and $2 \mapsto 1$, and subtracting $3$ changes nothing. So $c \bmod 3$ is always $1$ or $2$ — never $0$. But MU has $c = 0$.
:::

Hofstadter's point was about the difference between working *inside* a system (applying rules, getting nowhere) and reasoning *about* it from outside (finding the invariant). A mathematician who proves that the puzzle is impossible has proved a theorem about the system that the system itself cannot express — a first taste of Gödel.

## Conway's soldiers

In 1961 John Horton Conway invented a solitaire game with an astonishing answer. An infinite board has a horizontal line across it; you may place as many soldiers as you like below the line. A soldier moves by jumping over an adjacent soldier (horizontally or vertically) into an empty square, and the jumped soldier is removed, as in peg solitaire. How far above the line can you get a soldier?

With two soldiers you reach row 1, with four row 2 (the widget starts with this), with eight row 3, and with twenty row 4. Row 5 is impossible — with any finite number of soldiers.:cite[berlekamp-winning]

::conway-soldiers

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Give each square a weight $\omega^d$, where $d$ is its distance from the target and $\omega$ is the number with $\omega^2 + \omega = 1$. A jump towards the target replaces weights $\omega^{d+2} + \omega^{d+1}$ by $\omega^d$ — no change — and any other jump loses weight. So the total weight never increases. For target row 5, the *whole* region below the line has total weight exactly $1$ — the weight of the target itself — so any finite army weighs less than $1$.
:::
:::level[Proof]
Let $\omega = \frac{\sqrt5 - 1}{2} \approx 0.618$, the positive root of $\omega^2 + \omega = 1$. Put the target at $(0, 5)$, and give a soldier at $(x, y)$ the weight $\omega^{|x| + |y - 5|}$. Let $W$ be the total weight of all soldiers.

*$W$ never increases.* A jump takes a soldier from $P$ over $Q$ to $R$, three squares in a line. Two unit steps change the distance to the target by $-2$, $0$ or $+2$. If $d(R) = d(P) - 2$, the jump is straight towards the target, $d(Q) = d(P) - 1$, and the change in weight is $\omega^{d} - \omega^{d+1} - \omega^{d+2} = \omega^d(1 - \omega - \omega^2) = 0$, where $d = d(R)$. If $d(R) = d(P)$, the change is $\omega^{d(R)} - \omega^{d(P)} - \omega^{d(Q)} = -\omega^{d(Q)} < 0$. If $d(R) = d(P) + 2$, with $d = d(P)$ the change is $\omega^{d+2} - \omega^{d} - \omega^{d+1} = \omega^d(\omega^2 - 1 - \omega) = -2\omega^{d+1} < 0$. So no jump increases $W$.

*The half-plane weighs 1.* Summing $\omega^{|x| + (5 - y)}$ over all $x$ and all $y \le 0$ gives
$$\Big(\sum_{x} \omega^{|x|}\Big)\Big(\sum_{k \ge 5} \omega^{k}\Big) = \Big(1 + \frac{2\omega}{1 - \omega}\Big)\frac{\omega^5}{1 - \omega} = 1,$$
using $1 - \omega = \omega^2$, so that $1 + \frac{2\omega}{\omega^2} = 1 + \frac{2}{\omega} = \omega^{-3}$ and $\frac{\omega^5}{\omega^2} = \omega^3$.

*Conclusion.* Any finite set of soldiers below the line weighs strictly less than $1$, and $W$ never increases, so no soldier can ever stand on the target, whose weight alone is $\omega^0 = 1$. Since any square in row 5 can serve as the target, row 5 is unreachable.
:::
::::

:::bio{name="John Horton Conway" born=1937 died=2020 place="Liverpool, Cambridge and Princeton"}
Conway invented the Game of Life, the surreal numbers and the Doomsday rule for finding the day of the week in your head; he discovered three of the sporadic simple groups and, with Simon Norton, the “monstrous moonshine” connecting the largest of them to number theory. He loved games and puzzles and treated them as serious mathematics — *Winning Ways for Your Mathematical Plays*, written with Elwyn Berlekamp and Richard Guy, founded combinatorial game theory. He died of COVID-19 in April 2020.
:::

## Exercises

```prove
title: Handshakes
prompt: 'Prove that at any party with at least two people, two people have shaken the same number of hands. (Nobody shakes their own hand or anyone''s twice.)'
hints:
  - With $n$ people, the possible numbers of handshakes are $0, 1, \ldots, n - 1$ — that is $n$ values for $n$ people. Pigeonhole doesn't immediately work…
  - …but $0$ and $n - 1$ can't both occur. Why?
rubric:
  - You identified the possible values $0, \ldots, n-1$.
  - You showed that $0$ and $n - 1$ cannot both occur (someone who shook everyone's hand shook the hand of the person who shook nobody's).
  - You concluded by pigeonhole ($n$ people, at most $n - 1$ values).
solution: |
  With $n$ people, each shakes between $0$ and $n - 1$ hands. If someone shook $n - 1$ hands, they shook everyone's, so nobody has $0$; so $0$ and $n - 1$ don't both occur. Hence there are at most $n - 1$ possible values for $n$ people, and by the pigeonhole principle (Chapter 19) two people share a value.
```

```quiz
q: 'Numbers $1, 2, \ldots, 10$ are written on a board. A move erases any two numbers $a, b$ and writes $|a - b|$. After nine moves one number remains. Which statement is true?'
options:
  - text: The remaining number could be 0.
    why: 'Look at the parity of the sum: it starts at $55$.'
  - text: The remaining number is odd.
    correct: true
    why: '$a + b$ and $|a - b|$ have the same parity, so the parity of the total sum is invariant. It starts odd ($55$), so the last number is odd.'
  - text: The remaining number is always 1.
    why: Other odd numbers are possible — try it.
```

:::challenge
**Tromino colouring.** In Chapter 5 we tiled a $2^n \times 2^n$ board minus one square with L-trominoes. Use a colouring invariant to show that an $8 \times 8$ board cannot be tiled by *straight* $1 \times 3$ trominoes and one extra monomino unless the monomino sits on one of just four squares. (Colour the board diagonally in three colours so that every straight tromino covers one square of each colour, and count.)
:::

## Further reading

- Elwyn Berlekamp, John Conway and Richard Guy, *Winning Ways for Your Mathematical Plays* — games, invariants and Conway's soldiers.:cite[berlekamp-winning]
- Arthur Engel, *Problem-Solving Strategies* — its first chapter, “The invariance principle”, has a hundred more examples.:cite[engel]
