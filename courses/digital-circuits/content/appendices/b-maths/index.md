---
number: B
title: Maths toolbox
summary: Exponentials and e, logarithms and decibels, the equation of an RC circuit solved step by step, systems of linear equations and Gaussian elimination, the laws of Boolean algebra, and how the simulator’s work grows with size.
duration: About 45 minutes
prerequisites: []
---

The course uses four pieces of mathematics beyond arithmetic, and this appendix collects them: the **exponential**, which describes everything that charges, discharges or settles; the **logarithm**, its inverse, which turns up as bits and decibels; **systems of linear equations**, which is how a simulator finds the voltages in a circuit; and **Boolean algebra**, the arithmetic of 0 and 1. Nothing goes beyond school algebra. Where calculus gives a shorter route it is in a *Deeper* box, which you can skip: every section reads without it.

## Exponentials and e

Suppose something loses a fixed *fraction* of what it has left in every unit of time. A capacitor discharging through a resistor does that, and so does a cup of coffee cooling, a radioactive sample, and a cache whose entries expire at random. After one unit it has, say, 0.8 of the original; after two, 0.8 × 0.8 = 0.64; after *t*, 0.8ᵗ. That is **exponential decay**: the quantity is multiplied by the same factor in every equal interval. **Exponential growth** is the same with a factor above 1 (compound interest, a chain reaction, the number of transistors on a chip).

### The number *e*

Any factor will do, so why does one particular number keep appearing? Take a quantity that decays by 100 % in one unit of time, but do it in *N* small steps, each of which removes 1/*N* of what is left at the start of the step. After one unit the fraction remaining is (1 − 1/*N*)^*N*:

| Steps *N* | (1 − 1/*N*)^*N* |
|---|---|
| 1 | 0 |
| 2 | 0.2500 |
| 4 | 0.3164 |
| 10 | 0.3487 |
| 100 | 0.3660 |
| 1,000 | 0.3677 |
| 1,000,000 | 0.367879 |

However you cut it, the answer creeps up to a definite number, **1/*e*** = 0.367879…, where ***e*** = 2.718281828… is the base of natural exponentials. (Run the same argument for growth, (1 + 1/*N*)^*N*, and it approaches *e* itself.) That is why *e* is special: it is the factor you get when a process acts *continuously*, with the rate of change always proportional to the amount present.

The function **e^*x*** (also written exp *x*) follows the rules of any power: e^(*a*+*b*) = e^*a* · e^*b*, e⁰ = 1 and e^(−*x*) = 1/e^*x*. A few values, of e^(−*x*) for decay: e⁻¹ = 0.368, e⁻² = 0.135, e⁻³ = 0.0498, e⁻⁵ = 0.0067.

### The 63 % rule and the time constant

In an RC circuit the time constant τ = *R* × *C* is the time in which the gap between the capacitor’s voltage and its destination shrinks by the factor 1/*e*. So after one τ, 36.8 % of the gap is left, and the capacitor has covered **63.2 %** of the way; after 2τ, 13.5 % is left; after 5τ, 0.67 %. Chapter 4 has the full table, and the figure in the next section lets you see where it comes from.

:::key[Whatever decays like this, one number describes it]
The **time constant** τ is the time for the gap to shrink by 1/*e* (to 37 %). The gap after time *t* is e^(−*t*/τ) of the original. You never need more than that, plus the logarithm below to run it backwards.
:::

### Half-lives and ln 2

Engineers and physicists sometimes prefer the :term[half-life]{id=half-life} *t*½, the time for the gap to halve. Set e^(−*t*/τ) = ½ and take logarithms of both sides (see below): *t*½ = τ ln 2 = **0.693 τ**. After *k* half-lives the gap is 2^(−*k*): ten half-lives is a factor of about a thousand, because 2¹⁰ = 1,024. Chapter 4’s table has the same number: half way to the final value takes 0.69 τ.

Half-lives give a quick way to count how long settling takes to a given precision. To settle to within 1 part in 2ⁿ (the resolution of an *n*-bit converter, for example) takes *n* half-lives, that is 0.693 *n* τ:

| Precision | Half-lives | Time (in τ) |
|---|---|---|
| 8 bits (0.4 %) | 8 | 5.5 τ |
| 10 bits (0.1 %) | 10 | 6.9 τ |
| 12 bits | 12 | 8.3 τ |
| 16 bits | 16 | 11.1 τ |

:::programmer[An exponential moving average is an RC filter]
The line `v += alpha * (x - v)`, which smooths noisy readings in a thousand programs, is exactly the step rule of this appendix: each sample closes the fraction `alpha` of the gap between the smoothed value `v` and the new input `x`. Its time constant is about `1/alpha` samples, its half-life is `0.693/alpha`, and it is what an RC circuit does in hardware to a voltage. Debouncing a button with a resistor and a capacitor (Chapter 4) is the same filter with τ measured in milliseconds.
:::

```quiz
q: 'A capacitor discharges through a resistor with τ = 2 ms. How long until only a quarter of its starting voltage is left?'
options:
  - text: 'About 1.4 ms, because a quarter is half of a half, and each half takes 0.69 τ.'
    why: 'Half of a half is right, but each halving takes 0.693 τ, which is 1.39 ms with τ = 2 ms. That is one halving, not two.'
  - text: 'About 2.8 ms: two half-lives, each 0.693 × 2 ms.'
    correct: true
    why: 'Each half-life is 0.693 τ = 1.39 ms, and a quarter needs two of them: 2.77 ms. Check: e^(−2.77/2) = e^(−1.386) = 0.25.'
  - text: '8 ms, four time constants.'
    why: 'After 4 τ only 1.8 % is left. A quarter is much sooner.'
```

## Logarithms and decibels

The :term[logarithm]{id=logarithm} undoes the exponential. If *b*^*y* = *x*, then *y* = log_*b* *x*: “the power to which *b* must be raised to give *x*”. The three bases in use are 10 (log₁₀, the number of digits of a number, roughly), 2 (log₂, the number of bits), and *e* (ln, “the natural logarithm”, which undoes e^*x*). They differ only by a constant factor: log_*b* *x* = ln *x* / ln *b*.

Logarithms have one property that made them famous: **they turn multiplication into addition.**

- log(*a* × *b*) = log *a* + log *b*
- log(*a*^*k*) = *k* log *a*
- log(1/*a*) = −log *a*

That is why a slide rule multiplies by adding lengths. It is also why a logarithmic scale is the natural one for anything that spans many powers of ten: each step of one decade is the same distance.

Some values worth memorising: log₁₀ 2 ≈ 0.301, log₁₀ 3 ≈ 0.477, log₁₀ 5 ≈ 0.699, ln 2 ≈ 0.693, ln 10 ≈ 2.303. The first of these is the origin of the rule that 2¹⁰ = 1,024 ≈ 10³: ten bits are three decimal digits. And the number of bits needed to tell *N* things apart is ⌈log₂ *N*⌉: 256 values need 8 bits, a million needs 20.

### Decibels

A :term[decibel]{id=decibel} (dB) expresses a *ratio* on a logarithmic scale. For a ratio of powers,

$$\text{gain in dB} = 10 \log_{10} \frac{P_\text{out}}{P_\text{in}}.$$

Ten times the power is 10 dB, a hundred times is 20 dB, twice the power is 3.01 dB. Power in a resistor goes as the *square* of the voltage across it (*P* = *V*²/*R*), and log(*V*²) = 2 log *V*, so for a ratio of voltages (or currents) the factor is 20 instead of 10:

$$\text{gain in dB} = 20 \log_{10} \frac{V_\text{out}}{V_\text{in}}.$$

Ten times the voltage is 20 dB, twice the voltage is 6.02 dB, and one over √2 = 0.707 of the voltage is −3.01 dB. That last one is the famous **−3 dB point**: the frequency at which a filter passes half of the power. Each extra bit of an *n*-bit converter doubles the number of levels, which is 6.02 dB of range, so a 16-bit converter has about 96 dB. Losses are negative decibels; cascaded stages add.

::decibels{n="B.1"}

```quiz
q: 'An amplifier turns 10 mV into 1 V. What is its voltage gain in decibels?'
options:
  - text: '20 dB, because the ratio is 100 and 10 log₁₀ 100 = 20.'
    why: 'Careful with the factor: 10 log₁₀ applies to *powers*. This is a voltage ratio, and voltages take 20 log₁₀.'
  - text: '40 dB.'
    correct: true
    why: 'The voltage ratio is 100, so the gain is 20 log₁₀ 100 = 20 × 2 = 40 dB. (As power the ratio is 100² = 10,000, and 10 log₁₀ 10,000 = 40 dB: the same.)'
  - text: '100 dB.'
    why: '100 is the ratio, not the number of decibels. 20 log₁₀ 100 = 40.'
```

## The RC equation, step by step

Here is where the exponential of Chapter 4 comes from. A capacitor *C* is charged from a source *V*ₛ through a resistor *R*; write *v* for the capacitor’s voltage. Only two facts are needed.

1. **Ohm’s law**: the current through the resistor is the voltage across it divided by *R*, which is (*V*ₛ − *v*)/*R*. The gap between the source and the capacitor drives the current.
2. **The capacitor’s rule**: charge is *Q* = *C v*, so in a short time Δ*t* a current *I* adds a charge *I* Δ*t* and raises the voltage by Δ*v* = *I* Δ*t* / *C*.

Put them together:

$$\Delta v = \frac{V_s - v}{R}\cdot\frac{\Delta t}{C} = (V_s - v)\,\frac{\Delta t}{RC} = \text{gap} \times \frac{\Delta t}{\tau}.$$

In words: **in each short moment Δ*t*, the capacitor closes a fraction Δ*t*/τ of the gap that is left.** “The rate of change is proportional to what remains” is nothing but this sentence, with the time constant τ = *RC* setting the proportion. The current is biggest when the gap is biggest, and so the voltage rises fastest at the start and ever more slowly.

To find the voltage after a given time you can simply do the steps. If the gap at the start of a step is *g*, at the end of it the gap is *g* (1 − Δ*t*/τ). Cut one time constant into *N* steps, Δ*t* = τ/*N*, and after one τ the gap has been multiplied by (1 − 1/*N*)^*N*, the very expression of the table above. The more steps, the closer to 1/*e*. The polygon in the figure is this calculation; the smooth curve is the limit.

::exp-curve{n="B.2"}

So the limit of the step rule is the exponential, and the solution is

$$v(t) = V_s\left(1 - e^{-t/\tau}\right), \qquad \tau = RC,$$

and for a discharge, *v*(*t*) = *v*₀ e^(−*t*/τ). Time comes out of it as the logarithm: to reach a voltage *v* takes *t* = τ ln(*V*ₛ/(*V*ₛ − *v*)). With *R* = 10 kΩ and *C* = 100 nF, τ = 1 ms, and a 5 V supply reaches the 3.5 V that a 74HC gate reads as a 1 after 1 ms × ln(5/1.5) = 1.2 ms.

:::note[The simulator’s steps are a little different]
The step rule above uses the gap at the *start* of each step (“forward Euler”). The simulator of Chapter 4 uses the gap at the *end* of the step, which needs one small equation to solve per step but never overshoots, however large the step: the gap is divided by 1 + Δ*t*/τ instead of multiplied by 1 − Δ*t*/τ. Both approach the same exponential as the steps shrink.
:::

:::deeper[The same thing with calculus: separation of variables]
Let Δ*t* shrink to zero in the step rule. The change of voltage per unit time becomes a derivative and the rule becomes a differential equation:

$$\frac{dv}{dt} = \frac{V_s - v}{\tau}.$$

Write *u* = *V*ₛ − *v*, the gap. Since *V*ₛ is constant, d*u*/d*t* = −d*v*/d*t*, so

$$\frac{du}{dt} = -\frac{u}{\tau}.$$

**Separate the variables**: get every *u* on one side and every *t* on the other,

$$\frac{du}{u} = -\frac{dt}{\tau},$$

and integrate both sides, from the start (*t* = 0, gap *u*₀) to time *t*:

$$\ln u - \ln u_0 = -\frac{t}{\tau} \quad\Longrightarrow\quad u = u_0\, e^{-t/\tau}.$$

The gap starts at *V*ₛ (the capacitor is empty), so *v* = *V*ₛ − *u* = *V*ₛ(1 − e^(−*t*/τ)). Check it by differentiating: d*u*/d*t* = −(*u*₀/τ) e^(−*t*/τ) = −*u*/τ, which is the equation we started from. The logarithm appears because the integral of 1/*u* is ln *u*: it is the same “undoing the exponential” as before. The same equation, with τ = *L*/*R*, governs the current in an inductor (the coil of a relay, Chapter 5); and e^(−*t*/τ) is the only function equal to its own derivative up to a constant, which is the deepest reason it is everywhere.
:::

## Systems of linear equations

A circuit with several nodes gives several equations in several unknowns. Chapter 2’s *Under the hood* showed how the simulator writes Kirchhoff’s current law for every node and gets a **system of linear equations**: for the voltages *x*₁ … *x*ₙ of the nodes, *n* equations, each a sum of the unknowns multiplied by known numbers (conductances) and equal to a known number (a current from a source). Solving it is most of what an analogue simulator does, and it is worth knowing how.

### One unknown at a time

Start with two unknowns:

$$\begin{aligned} 2x + y &= 5\\ x - y &= 1. \end{aligned}$$

You know how to solve these: add the equations and *y* disappears, 3*x* = 6, so *x* = 2, and putting that back gives *y* = 1. That is the whole idea of :term[Gaussian elimination]{id=gaussian-elimination}: use one equation to remove one unknown from the others, then repeat on what is left until the last equation has a single unknown; then work back up.

In general, for the first unknown *x* and the equation that contains it with the coefficient *p* (the :term[pivot]{id=pivot}), take every other equation with coefficient *a* on *x*, and subtract (*a*/*p*) times the pivot equation from it. The number *a*/*p* is the **multiplier**. In the example, the second equation has coefficient 1 and the pivot is 2, so the multiplier is ½, and (*x* − *y* = 1) − ½ (2*x* + *y* = 5) gives −1.5 *y* = −1.5, so *y* = 1 and then *x* = 2. After all the eliminations the system is **triangular**: the last equation has one unknown, the one before it two, and so on. Solving upwards is **back substitution**.

The stepper below does this on three equations, one row operation at a time. Its default system is a real one: the nodal equations of a small ladder of resistors, with a 9 V source. The rows are the equations, the columns the unknowns (*x*, *y*, *z* are the voltages at the three nodes), and the last column the right-hand side. Notice what the multipliers do, and what a zero in the pivot position needs.

::gauss-stepper{n="B.3"}

### Practical points

- **Pivoting.** If the pivot is zero the elimination cannot go on with that row, but any equation below with a non-zero entry in that column will do, and the rows can be swapped freely. Real solvers choose the *largest* entry in the column as the pivot, even when the first is not zero, so that no multiplier is larger than 1 and rounding errors do not grow. The toggle in the stepper does this, as the simulator’s solver does.
- **When it fails.** If no pivot can be found the equations are either dependent (one repeats what the others say) or contradictory. For a circuit this means a **floating node** (a part of the circuit with no connection to ground, so that only voltage *differences* are determined) or a loop of ideal voltage sources that disagree. The last preset shows the first case. The simulator reports it; it does not guess.
- **Cost.** Removing the first unknown touches about *n*² numbers, removing the next about (*n* − 1)², and so on, about *n*³/3 multiplications in all. Back substitution takes only about *n*²/2.
- **Factor once, solve many times.** The multipliers are what makes the process reusable. Keep them, and elimination is finished for good: a new right-hand side (say the same circuit at the next moment of a simulation, when only the sources or the capacitor currents have changed) needs only its own row operations replayed on the new right-hand side, and back substitution: about *n*² work instead of *n*³. The multipliers, gathered into a matrix, are **L**; what is left after elimination is **U**; together they are the :term[LU decomposition]{id=lu-decomposition} of the coefficient matrix. It is the lower part of the stepper, and it is what Chapter 2’s excerpt of `lu.ts` computes.

:::deeper[Matrices and LU]
Write the system as *A* **x** = **b**, where *A* is the *n* × *n* matrix of coefficients, **x** the vector of unknowns and **b** the right-hand side. Elimination without swaps finds a lower-triangular matrix *L*, with ones on its diagonal and the multipliers below it, and an upper-triangular matrix *U*, such that

$$A = L\,U.$$

Then *A* **x** = **b** becomes *L*(*U* **x**) = **b**, which two triangular solves handle: first *L* **y** = **b** by *forward substitution* (the first equation gives *y*₁, the next uses it, and so on), then *U* **x** = **y** by back substitution. With row swaps recorded in a permutation matrix *P*, the identity is *P A* = *L U*. Both triangular solves cost about *n*² operations, against *n*³/3 for the factorisation, which is why reusing *L* and *U* pays.

Nodal matrices have a friendly shape: the diagonal entry of a node is the sum of the conductances attached to it, and the entry linking two nodes is minus the conductance between them (Chapter 2), so the matrix is symmetric and each diagonal entry is at least the sum of the others in its row. Such matrices never need pivoting for their own sake. The rows that an *ideal* voltage source adds (Chapter 2’s “modified” nodal analysis) have zeros on the diagonal, and that is where the swaps come from.
:::

## Boolean algebra: quick reference

Boolean algebra is the arithmetic of 0 and 1: variables that are true or false, and three basic operations, **AND** (written · or by putting terms side by side), **OR** (+) and **NOT** (¬, or a prime, or an overbar). In programming languages these are `&&`, `||` and `!` on truth values, and `&`, `|` and `~` on bits, with `^` for **XOR** (⊕). Precedence is as in arithmetic: NOT binds tightest, then AND, then OR, so *A* + *B* · *C* means *A* + (*B* · *C*).

Its laws are shorter to learn than those of ordinary algebra because there are only two values, and there is a check for any of them: a function of *n* variables has 2ⁿ rows in its truth table, so two expressions are equal exactly when they agree on every row. The table below does that check for every law it lists, when the page loads.

::laws-table{n="B.4"}

Three things make the table easier to use.

- **Duality.** Every law has a twin obtained by swapping AND with OR and 0 with 1. If an equation holds, so does its dual, which is why the table gives them in pairs.
- **De Morgan** is the law you will use most: invert an AND and you get the OR of the inversions, and the other way round. Drawn on a schematic, it says that moving the inversion bubble from the output of a gate to its inputs turns AND into OR. Chapter 11 turns it into a working method, bubble pushing.
- **The distributive law has two forms.** *A* · (*B* + *C*) = *A* · *B* + *A* · *C* looks like arithmetic. *A* + *B* · *C* = (*A* + *B*) · (*A* + *C*) does not, and it is the one people forget.

There are 2^(2ⁿ) Boolean functions of *n* variables: 16 for two, 256 for three, 65,536 for four, and 4.3 billion for five. Chapter 11 shows how any of them can be built from AND, OR and NOT (and, with a NAND gate alone, from that gate only, as the last rows of the table show); Chapter 12 simplifies them.

:::details[How the simulator’s work grows: big-O for the curious]
Big-O notation (:term[big-O]{id=big-o}) says how the work of an algorithm grows with the size *n* of its input, ignoring constant factors: *O*(*n*²) means “doubling *n* multiplies the work by about four”. It explains why some things in this course run instantly and others would not run at all.

| Algorithm | Size *n* | Work | What it means here |
|---|---|---|---|
| Dense LU factorisation (analogue engine) | unknowns: nodes plus ideal sources | *O*(*n*³) | 10 unknowns: about a thousand operations. 100: a million. 10,000: a trillion. |
| Solving with a stored *L* and *U* | unknowns | *O*(*n*²) | The reason the engine keeps its factorisation while the circuit does not change. |
| Transient simulation, linear circuit | time steps *T*/Δ*t* | *O*(*T*/Δ*t* · *n*²) | One factorisation, then two sweeps per step. |
| Transient simulation with diodes or transistors | steps × Newton iterations | *O*(*T*/Δ*t* · iterations · *n*³) | Each Newton iteration changes the matrix, so it must be factored again (Chapter 7). |
| Event-driven digital simulation | events *E* | *O*(*E* log *Q*), *Q* events waiting | The event queue is a binary heap: pushing and popping cost the logarithm of its length. Only gates whose inputs changed are evaluated. |
| Truth table of *n* inputs | inputs | *O*(2ⁿ) | Exact for a dozen inputs, hopeless for 64. The laws table above is checked this way. |
| Exact logic minimisation (Chapter 12) | inputs | exponential in the worst case | A function of *n* variables can have up to about 3ⁿ/*n* prime implicants, so heuristic minimisers such as Espresso are used for large ones. |
| Two-pass assembler | program length | *O*(length) | Each line is read twice, and nothing more. |

A dense matrix like the one this simulator uses is the right choice for the circuits of a course. Real circuit simulators exploit the fact that a node is connected to only a few others, so almost all of the matrix is zero, and *sparse* solvers that touch only the non-zero entries cost far less than *n*³, which is what lets them handle circuits with millions of nodes.:cite[nagel1975]
:::
