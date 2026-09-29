---
number: 12
title: Simplifying logic
summary: 'Why smaller circuits matter, how a Karnaugh map turns simplification into a picture, how the Quine–McCluskey algorithm does it for any number of variables, and why real tools also factor.'
duration: About 1½ hours
prerequisites: [boolean-algebra]
---

Chapter 11 ended with a machine that turns any truth table into a circuit, and a warning. The recipe is mechanical, and it is wasteful. The carry out of a full adder, the *majority* of three bits, comes out of the synthesiser as eight gates and 19 gate inputs, and the same function needs four gates and nine inputs. This chapter is about closing that gap: finding the smallest circuit for a function, first by eye, then by algorithm.

Start with a function whose truth table is 16 rows, of which four are 1. Its canonical sum of products has four terms of four literals each.

```quiz
q: 'A function of A, B, C, D is 1 only for the four inputs 0000, 0010, 1000 and 1010 (as ABCD). Its canonical sum of products has four terms of four literals, 16 in all. How many literals does the simplest expression need?'
options:
  - text: 16, because each row needs its own term.
    why: 'That is the canonical form. Look at what the four rows have in common.'
  - text: 8, two terms of four literals.
    why: 'Better, but there is more to see. In all four rows, what are B and D?'
  - text: 2.
    correct: true
    why: 'In every one of the four rows B = 0 and D = 0, and A and C take all four combinations. The function is ¬B·¬D: two literals, and one AND gate. The four minterms are corners of a picture you are about to see, and they are neighbours.'
```

## Why simplify?

Every gate costs something, and fewer, smaller gates cost less of all of it.

- **Area.** A CMOS gate needs two transistors for each input (Chapter 9), so the number of *gate inputs* is a good estimate of a circuit’s silicon: an inverter is 2 transistors, a two-input NAND or NOR 4, a three-input one 6. Half the gate inputs is roughly half the area, and half the cost of the chip.
- **Power.** The dynamic power of Chapter 10 is *α C V² f*, and *C* is the capacitance of all the gates and wires that switch. Fewer gates, less capacitance.
- **Delay.** A signal goes through one gate after another, so a circuit that is shallower and less loaded is faster (Chapter 15 measures this). A simpler expression is usually, not always, a faster circuit.
- **Fitting.** A programmable logic device (Part VI) offers a fixed number of product terms. A function that needs 12 terms in one form and 5 in another may fit in one chip and not in the other.

Simplification also makes circuits easier to read, which is worth more than it sounds when you are hunting a fault at 2 a.m. But smaller is not the only goal. The end of this chapter shows a circuit that is smaller *and* slower, and the trade between them is most of what logic design is.

## The algebra, and where it stops

Chapter 11’s laws are enough to simplify anything, in principle. They contain a single rule that does nearly all the work:

:::key[The combining rule]
**X·A + X·¬A = X.** Two product terms that are identical except that one has a variable and the other its complement can be replaced by the common part, and the variable disappears. (Proof: X·A + X·¬A = X·(A + ¬A) = X·1 = X.)
:::

Apply it to the carry-out of a full adder. Its canonical sum of products has one term for each of the rows 011, 101, 110 and 111:

¬A·B·C + A·¬B·C + A·B·¬C + A·B·C

The last term, A·B·C, differs in one variable from each of the other three, so it can combine with each. It may be used as often as you like, because X + X = X (the idempotent law): write it three times, and combine each copy with one neighbour.

- ¬A·B·C + A·B·C = B·C
- A·¬B·C + A·B·C = A·C
- A·B·¬C + A·B·C = A·B

The result is A·B + A·C + B·C: three terms of two literals each, where there were four of three.

The trouble is that nothing tells you *which* pairs to combine, or whether you have found them all, or when you are finished. Combine the wrong pairs in the wrong order and you end at an expression that no single step improves and that is still not the smallest. Sometimes you must even go the *other* way first. The consensus law, A·B + ¬A·C + B·C = A·B + ¬A·C, says that B·C is redundant, but no combining step will show it: nothing in the right-hand side combines with anything else. Read from right to left the law *adds* a term, a step you would take only if you already knew the answer. Try it in the checker of Figure 11.1: the two sides are equal, and only one of them is smaller.

Nobody wants to simplify by luck. What we need is a way to *see* every pair of terms that differ in one variable at once. That is what a Karnaugh map draws.

## Karnaugh maps

The combining rule works on terms that differ in **exactly one variable**: the minterms 011 and 111 combine, and 011 and 100 do not. In a truth table, in the usual order 000, 001, 010, 011, …, these neighbours are scattered: 011 is next to 010 and 100 but its partner 111 is four rows down. A :term[Karnaugh map]{id=karnaugh-map} rearranges the truth table into a grid where every pair of neighbours *is* adjacent.

The trick is in the order of the labels. Instead of counting 00, 01, 10, 11, count 00, 01, **11**, 10. This is the :term[Gray code]{id=gray-code}: each step changes exactly one bit. Put four variables on a 4 × 4 grid, two down the side and two across the top, each in Gray order, and every cell has a neighbour that differs in exactly one variable in each of the four directions. Even the last and the first are neighbours: 10 is next to 00, one bit away. The grid *wraps round*, like the screen of an old arcade game, and its edges are joined into a torus.

A cell that is 1 holds a minterm. Two adjacent 1s can be merged into one term with one variable fewer. Four 1s in a 2 × 2 block, or a row of four, merge into one term with two variables fewer, and so on: a **group** of 2<sup>*k*</sup> cells is a product term with *k* fewer literals, because the *k* variables that change inside the group drop out and those that do not change are the term. The whole method is:

1. Circle all the 1s in **groups of 1, 2, 4, 8 or 16 cells**, rectangles that may wrap round the edges.
2. Make the groups as **large** as possible, and use as **few** groups as possible. A cell may be in several groups; that is allowed, and it is often what makes the groups large.
3. Every 1 must be in at least one group, and no group may contain a 0.
4. Each group is a product term: the variables that are the same in every cell of the group, each complemented if its value there is 0.
5. OR the terms.

Try it. The playground below starts with the majority function on three variables.

::kmap-playground{n="12.1" caption="Click a cell to cycle it through 0, 1 and x (don’t care). Drag across cells to draw a group; drag past the edge of the map to wrap round it. The expression and circuit follow. Use Show me the minimum to see Quine–McCluskey’s answer and compare it with yours; tick Show every largest group to see the candidates. From the keyboard: arrows move, 0 / 1 / x set a cell, hold Shift with the arrows to select a rectangle and press Enter."}

:::lab[Draw the groups]
1. **Majority.** The three 1s of A·B, A·C and B·C each form a pair. Draw the three groups, and read the terms: each group is two cells, so each has two literals. The circuit under it is the three-AND, one-OR circuit of Chapter 11, and it has no inverters. Press *Show me the minimum*: the same three.
2. **Four corners.** Choose the example. The four 1s sit in the four corners of the map, which look as if they could never be merged. Drag from the top left cell *off the right edge*, and then *off the bottom edge*: the group wraps in both directions and covers all four. It is one term of two literals, ¬B·¬D, which is the answer to the question at the start of this chapter.
3. **Do not stop at the first cover.** Load *A ≥ B* (the two-bit comparison), draw groups that cover all the 1s but are *smaller* than they could be, and read the verdict: it is correct, but the score is below 100 %, and it says that some groups could be bigger. Tick *Show every largest group* and add them.
4. **XOR.** The two 1s are on a diagonal. No two 1s are neighbours, so nothing merges. XOR is the same size as its truth table, a checkerboard, and that is what a checkerboard means on a map.
5. **A map with no forced choice.** Load *No essential group*. The six 1s form a ring, and every 1 lies in two groups, so nothing is forced. Both covers of three groups (one going each way round the ring) are minimal. Which one is it choosing when you press the button? Either: both cost the same.
:::

:::history{year=1953 title="The map" people="Edward Veitch, Maurice Karnaugh"}
In May 1952 Edward Veitch presented “A chart method for simplifying truth functions” at the Pittsburgh meeting of the Association for Computing Machinery: a rectangular chart with a cell for each combination of the variables, in which adjacent cells could be merged.:cite[veitch1952]

A year later Maurice Karnaugh, at Bell Telephone Laboratories in Murray Hill, published “The map method for synthesis of combinational logic circuits”, in the *Transactions of the American Institute of Electrical Engineers*, after presenting it at the Institute’s summer meeting in Atlantic City.:cite[karnaugh1953] His version puts the labels in the Gray-code order, so that neighbouring cells always differ in one variable, and that is the one every textbook draws. Today it is called the Karnaugh map, or sometimes the Veitch or Karnaugh–Veitch diagram. It was designed for the engineers of the day, who drew relay and vacuum-tube circuits by hand and needed something quicker than algebra: it is a method for humans and, as we shall see, it stops working when the human’s eye does.
:::

### Don’t-cares

Some inputs never occur. A decimal digit is stored in four bits (binary-coded decimal, BCD) and only the codes 0000 to 1001 (0 to 9) are used; the six codes 1010 to 1111 cannot arrive. For those rows the function may be *anything*, and we write the output as a :term[don’t-care]{id=dont-care}, **x**. An x is a free gift: it may be included in a group when that makes the group larger, and it need not be covered when it does not help.

The classic example is a 7-segment display. Segment *a*, the top bar, is lit for the digits 0, 2, 3, 5, 6, 7, 8 and 9 (not for 1 and 4). Load the *7-segment a* example: the eight 1s, six x cells in the lower right and the 0s of 1 and 4. Without the x cells the 1s need several small groups. With them, four groups cover everything, and they are large:

a = A + C + B·D + ¬B·¬D

(A is the top bit, the 8s.) The group for A is eight cells, a whole half of the map, and it is that big only because it borrows four don’t-cares; C is another eight, with four of them borrowed. The unused codes have paid for two of the four terms. Here is that circuit:

::circuit{src="12-simplifying-logic/circuits/seg-a.json" title="Segment a of a 7-segment display" n="12.2" mode="logic" speed=1e-6 caption="A, B, C, D are the bits of a decimal digit (A is 8s). Set 0000 (0), 0001 (1) and 0100 (4): the output is 1 for 0 and 0 for 1 and 4. Set 1010 to 1111 and it does whatever it likes: those inputs never occur."}

:::note[Don’t-cares are a promise]
An x is a promise about the world outside: “this input never happens.” The minimised circuit does something on those inputs, something you did not choose, and if the promise is ever broken the display shows nonsense. That is acceptable for a display and not for a machine that can crash. Chapter 19 returns to it: the unused states of a state machine are don’t-cares too, and a machine that lands in one by accident must not lock up.
:::

### Products of sums

Circle the **0s** instead and you get the other canonical form. Each group of 0s is a product term that is 1 exactly where the function is 0. The function is the complement of the OR of the groups, and De Morgan (Chapter 11) turns that into a **product of sums**: a group of 0s becomes a sum with each of its literals *complemented*. For the majority function the zeros form the pairs ¬A·¬B, ¬A·¬C, ¬B·¬C, giving (A + B)·(A + C)·(B + C). Switch the playground to *Group the 0s* and see it: the circuit is OR gates feeding an AND.

Which is better? Whichever has fewer literals. A function with many 1s and few 0s is usually cheaper as a product of sums. A PAL (Chapter 26) can only realise sums of products, but it can produce the *complement* of the output, and so use either; Chapter 26’s fitter tries both.

### What a map cannot do

A Karnaugh map is a picture, and pictures run out. Two, three and four variables fit on a page. Five need two maps, one over the other, with neighbours that are not next to each other on the paper. Six need four. Beyond that nobody can see the groups. And even at four variables the method is a *procedure for humans*: to be sure you have the fewest groups you must compare choices by eye, which is exactly what you cannot verify. A program needs an algorithm: something with steps that always end and that can be proved to give the smallest answer.

## Quine–McCluskey

The Quine–McCluskey method finds the same groups a map does, but with no picture. It is Karnaugh’s idea done by bookkeeping, and it works for any number of variables. It has two halves: find *every* largest group (there may be many), then choose the fewest that cover all the 1s.

**Half one: prime implicants.** An **implicant** is a product term that implies the function: a group with no 0 in it. A :term[prime implicant]{id=prime-implicant} is one that cannot be made any larger: dropping any one of its literals would let in a 0. These are the largest groups of the map, and the answer is always made of them. To find them:

1. Write all the minterms (and don’t-cares) in binary and sort them into groups by the **number of 1s**. Two terms that differ in exactly one bit have counts of 1s that differ by one, so only neighbouring groups need to be compared.
2. Compare each term with every term in the next group. If they differ in one bit, write a merged term with a **dash** in that bit, and tick both. The dash means “either”.
3. Repeat with the merged terms: only terms with the same dashes can combine. Continue until nothing merges.
4. Every term without a tick is a prime implicant.

**Half two: covering.** Make a table: a row for each prime, a column for each required minterm (not the don’t-cares) and a dot where a prime covers a minterm. Then:

- A column with **one** dot has only one prime that can cover it. That prime is :term[essential]{id=essential-prime}: it must be in the answer. Choose it, and cross out the columns it covers.
- A row whose dots are a subset of another’s, at no lower cost, is **dominated**: drop it. A column that has a dot in every row where another column has one is redundant: drop it.
- Repeat. If nothing is left, you are done.
- If something is left but nothing is essential or dominated, you have hit the :term[cyclic core]{id=cyclic-core}, the ring of the *No essential group* example. Then every remaining choice is a real choice, and **Petrick’s method** makes it exactly. Write, for each remaining column, the sum of the primes that cover it: (P1 + P2). All columns must be covered, so multiply all the sums together and multiply out. Each product in the result is a set of primes that covers everything; take a shortest one.

That is the whole algorithm. The stepper below runs it on any function you enter and shows each step.

::qm-stepper{n="12.3" caption="Press Play or step through with the arrows: merges appear one at a time; then the chart, the essential primes and, for a cyclic function, Petrick’s product. Hover over a term to see what it was merged from. Change the minterms and don’t-cares to try your own function (up to five variables)."}

:::lab[Run the algorithm]
1. Step through the **textbook example**. Watch how terms in adjacent groups merge: eight terms become ten merged ones, and then three. A term that merged is ticked; one that merged in two ways still appears in the next column only once. Then look at the chart: which primes are essential, and which minterm makes each one essential? One row is dropped as dominated.
2. Choose **A cyclic core**. There is no essential prime, and no row or column can be dropped. Follow Petrick’s product through: every step multiplies in a sum of two primes, and the number of products grows and shrinks as terms are absorbed (X + X·Y = X). The products go 2, 2, 3, 4, 5, 5 as the columns are multiplied in, and two of the final products have the fewest primes, three: the two ways round the ring. The tool takes the one with fewer literals, and, both being equal, the first.
3. Choose **Five variables**. A Karnaugh map cannot show this on one page. Sixteen minterms merge into 23 terms, then seven, and the nine primes are pairs and groups of four: no eight-cell group exists.
4. Choose **4-bit parity**. Nothing merges: every minterm is a prime, and every prime is essential, so the answer is the canonical sum of eight terms. This is a case in which Quine–McCluskey finishes at once, and in which the result is a disaster for two-level logic. The next section does something about it.
:::

:::history{year=1956 title="Quine, McCluskey and Petrick" people="Willard Van Orman Quine, Edward J. McCluskey, Stanley R. Petrick"}
The algorithm was not invented for circuits. In 1952 the Harvard logician Willard Van Orman Quine published “The problem of simplifying truth functions”, in the *American Mathematical Monthly*, about how to write a formula of logic in its shortest form, and gave the notion of prime implicant its shape.:cite[quine1952]

In 1956 Edward McCluskey of Bell Laboratories published “Minimization of Boolean functions” in the *Bell System Technical Journal*, whose abstract calls its procedure “a simplification and extension” of Quine’s: the tabular method with binary numbers and groups by the number of 1s, which a clerk, or a computer, can carry out without thinking.:cite[mccluskey1956] The covering step that this chapter solves with Petrick’s product comes from a report of the same year by Stanley Petrick of the Air Force Cambridge Research Center.:cite[petrick1956]
:::

:::hood[Quine–McCluskey and Petrick in the course’s toolchain]
The same `quineMcCluskey` that draws the stepper’s frames is the exact minimiser of the fitters of Part VI (`src/lib/pld/twolevel/qm.ts`). An implicant is a pair of numbers: `value` holds the fixed bits and `mask` marks the dashes. Merging two implicants is a handful of bit operations. They must have the same dashes, differ in exactly one bit, and the merged one gets that bit added to its mask:

```ts
const A = implicants[a]!;
const B = implicants[b]!;
if (A.mask !== B.mask) continue;
const diff = A.value ^ B.value;
if (popcount(diff) !== 1 || (B.value & diff) === 0) continue;
const { id, fresh } = make(A.value, A.mask | diff, r + 1);
```

Everything that no pair used is prime. The chart is then reduced by essential primes and dominance until nothing changes, and what is left goes to Petrick. Here the products are sets of primes stored as the bits of an integer (`BigInt`, so any number of primes works), and multiplying by the next sum of primes is a bitwise OR, with absorption after every step so the list does not explode:

```ts
for (const { minterm, primes } of sums) {
  const next = new Set<bigint>();
  for (const p of products) {
    for (const r of primes) next.add(p | (1n << BigInt(index.get(r)!)));
  }
  products = absorb([...next]);
```

`absorb` keeps a product only if no smaller product is a subset of it, which is X + X·Y = X in one line: `if (!kept.some((q) => (q & p) === q)) kept.push(p)`. Petrick’s product can still grow exponentially, so the code gives up after 2,000 products and solves the covering problem by branch and bound instead, with a budget of 200,000 nodes; the result says whether it is guaranteed minimal. Every frame of the stepper is a piece of the trace that the function returns: the rounds and their merges, the chart, each essential or dominance step and each Petrick product.

**A word on Espresso.** The exact method cannot go on for ever. A function of *n* variables can have as many as about 3<sup>*n*</sup>/*n* prime implicants,:cite[chandra1978] which for 16 variables is millions, and Petrick’s product on top of them is worse; finding the smallest cover is a hard problem in general (it contains set cover). **Espresso**, developed in the 1980s at IBM and Berkeley,:cite[brayton1984] never lists all the primes. It starts from any cover and improves it by a loop of three moves, `EXPAND` each cube into a larger prime, `IRREDUNDANT` to drop cubes that the others make unnecessary, and `REDUCE` to shrink each cube so the next `EXPAND` can go a different way. The loop in `src/lib/pld/twolevel/espresso.ts` is literally:

```text
F = IRREDUNDANT(EXPAND(F, R), D)
repeat
  F' = IRREDUNDANT(EXPAND(REDUCE(F, D), R), D)
while F' is cheaper than F
```

It usually reaches a minimum or comes very close, and in a time that is manageable for functions of dozens of inputs and thousands of terms. The course’s `minimise` picks the exact algorithm for functions that depend on at most eight variables and Espresso for the rest.
:::

## Beyond two levels

Everything so far minimised a **two-level** circuit: one layer of ANDs, one OR (or the reverse). That is the right target for a PLA, whose structure is exactly that. It is a poor target for most logic, for two reasons.

The first is that some functions are simply terrible as sums of products. Parity of *n* bits has 2<sup>*n*−1</sup> terms, and *nothing* merges: not a Karnaugh map, not Quine–McCluskey, not Espresso can make it smaller in two levels. As a chain of XOR gates it is *n* − 1 gates.

The second is that two-level logic misses *sharing*. Look at A·B + A·C + A·D. Three ANDs and an OR: four gates, nine inputs. But A appears in every term, and the algebra says A·(B + C + D): an OR and an AND, two gates and five inputs. This is **factoring**, and it produces a :term[multi-level]{id=multi-level} circuit, in which some signals pass through more than two gates. The XOR from four NANDs in Chapter 11 is a small example: the first NAND is shared between the two that follow it.

The price is depth. Every extra level is a gate delay in series. The two-level circuit is as shallow as logic gets; a factored circuit is usually smaller and slower, and the best tool is one that can trade between the two. Here are the two forms of four functions side by side.

::two-vs-multi{n="12.4" caption="Pick a function. Both circuits are drawn together with the same inputs, and their outputs always agree. The table counts what each costs: gates, gate inputs, transistors (a static CMOS estimate), and depth (gates on the longest path). Green marks the smaller; red, the case where factoring is slower."}

:::lab[Read the trade]
1. **A common factor.** Factoring halves the gates and cuts the transistors from 26 to 14, and the depth is the same. This is the case where factoring costs nothing.
2. **Two sums multiplied.** (A + B)·(C + D) against four ANDs and an OR: five gates against three. No map or table would find it, since it is not a sum of products at all; it is a *different shape* of expression.
3. **Majority.** The two forms have the same number of gates (four, with three-input gates), but the factored form has one input and two transistors fewer, and one more level of delay. The saving is small and it costs time: this is the trade in its purest form. Whether to take it depends on whether this path is the slow one in the whole chip.
4. **4-bit parity.** Fifteen gates and 114 transistors as a sum of products against three XOR gates and 24 transistors, and fewer levels as well. It is the case that the exact minimiser cannot even see.
:::

Real tools therefore work in two steps. First they build a multi-level network by **algebraic factoring** and **kernel extraction**, hunting for common sub-expressions like (B + C + D) that several outputs can share; this is the job of programs in the line of MIS (1987) and, today, ABC.:cite[brayton1987] Then **technology mapping** covers the network with the cells of a real library (NAND, NOR, AOI gates and so on), picking the cheapest match for each part. Two-level minimisation (Espresso) survives where two levels are what the hardware is: inside PLAs and PALs, and as a step for small pieces of logic. For FPGAs, in Chapter 30, the network is cut into pieces of at most four to six inputs that fit a lookup table, and a truth table that fits a LUT needs no minimisation at all. The Karnaugh map, meanwhile, remains the best way for a person to *understand* a small function, and it is what you use at the whiteboard.

## Gate golf

Now the fun part. Each exercise below is a circuit editor with a **par**: the fewest gates that the best circuit needs, checked by exhaustive search. Beat par and you have found something the search did not allow for; match it and you have found the smallest circuit there is.

```golf
id: simplify/majority-golf
title: Majority in four gates
par: 4
metric: gates
allowed: [and, or, not]
spec:
  expression: "Y = A & B | A & C | B & C"
  inputs: [A, B, C]
prompt: |
  Y is 1 when **at least two** of A, B and C are 1. The obvious circuit has three ANDs and an OR (or two ORs), and there is a smaller one. Par is four gates: try it with the AND, OR and NOT gates.
hints:
  - Three ANDs feeding one three-input OR is four gates, and counts as par. So does a circuit of two-input gates only, if you factor.
  - Factor out C. When is Y 1 whether or not C is 1?
explain: |
  A·B + C·(A + B): the pair A·B is enough by itself, and otherwise C decides. No circuit of AND, OR and NOT gates is smaller (a computer checked every one of three gates).
solution: {"version":1,"title":"Majority in four gates","engine":"digital","components":[{"id":"A","type":"port","x":5,"y":3,"params":{"name":"A","dir":"in"},"label":""},{"id":"B","type":"port","x":5,"y":5,"params":{"name":"B","dir":"in"},"label":""},{"id":"C","type":"port","x":5,"y":7,"params":{"name":"C","dir":"in"},"label":""},{"id":"g1","type":"and","x":10,"y":3,"label":""},{"id":"g2","type":"or","x":10,"y":8,"label":""},{"id":"g3","type":"and","x":20,"y":11,"label":""},{"id":"g4","type":"or","x":30,"y":7,"label":""},{"id":"Y","type":"port","x":38,"y":8,"flip":true,"params":{"name":"Y","dir":"out"},"label":""}],"wires":[{"points":[[10,12],[16,12]]},{"points":[[20,4],[26,4]]},{"points":[[5,3],[8,3]]},{"points":[[8,3],[8,8]]},{"points":[[8,3],[10,3]]},{"points":[[8,8],[10,8]]},{"points":[[5,5],[7,5]]},{"points":[[7,5],[7,10]]},{"points":[[7,5],[10,5]]},{"points":[[7,10],[10,10]]},{"points":[[5,7],[6,7]]},{"points":[[6,7],[6,12]]},{"points":[[6,12],[10,12]]},{"points":[[16,12],[18,12]]},{"points":[[18,11],[18,12]]},{"points":[[18,11],[20,11]]},{"points":[[16,9],[17,9]]},{"points":[[17,9],[17,13]]},{"points":[[17,13],[20,13]]},{"points":[[16,4],[20,4]]},{"points":[[26,4],[27,4]]},{"points":[[27,4],[27,7]]},{"points":[[27,7],[30,7]]},{"points":[[26,12],[28,12]]},{"points":[[28,9],[28,12]]},{"points":[[28,9],[30,9]]},{"points":[[36,8],[38,8]]}]}
```

```golf
id: simplify/mux-golf
title: A multiplexer in three gates
par: 3
metric: gates
allowed: [and, or, not, xor]
spec:
  expression: "Y = !S & A | S & B"
  inputs: [S, A, B]
prompt: |
  Y is **A** when S is 0 and **B** when S is 1. The direct circuit is an inverter, two ANDs and an OR: four gates. With the XOR gate allowed there is a three-gate circuit. Par is three.
hints:
  - When S = 0 the output is A. So what does the circuit have to add to A when S = 1?
  - A ⊕ (A ⊕ B) is B, and A ⊕ 0 is A.
explain: |
  Y = A ⊕ (S · (A ⊕ B)). With S = 0 the AND gives 0 and Y = A ⊕ 0 = A. With S = 1 it gives A ⊕ B and Y = A ⊕ A ⊕ B = B. A programmable inverter, twice: the XOR trick of Chapter 11. Without the XOR gate, four gates are the best.
solution: {"version":1,"title":"A multiplexer in three gates","engine":"digital","components":[{"id":"S","type":"port","x":5,"y":3,"params":{"name":"S","dir":"in"},"label":""},{"id":"A","type":"port","x":5,"y":5,"params":{"name":"A","dir":"in"},"label":""},{"id":"B","type":"port","x":5,"y":7,"params":{"name":"B","dir":"in"},"label":""},{"id":"g1","type":"xor","x":9,"y":8,"label":""},{"id":"g2","type":"and","x":18,"y":7,"label":""},{"id":"g3","type":"xor","x":27,"y":6,"label":""},{"id":"Y","type":"port","x":35,"y":7,"flip":true,"params":{"name":"Y","dir":"out"},"label":""}],"wires":[{"points":[[9,5],[15,5]]},{"points":[[18,5],[24,5]]},{"points":[[9,3],[15,3]]},{"points":[[5,5],[7,5]]},{"points":[[7,5],[7,8]]},{"points":[[7,8],[9,8]]},{"points":[[7,5],[9,5]]},{"points":[[5,7],[6,7]]},{"points":[[6,7],[6,10]]},{"points":[[6,10],[9,10]]},{"points":[[5,3],[9,3]]},{"points":[[15,3],[16,3]]},{"points":[[16,3],[16,7]]},{"points":[[16,7],[18,7]]},{"points":[[15,9],[18,9]]},{"points":[[15,5],[18,5]]},{"points":[[24,5],[25,5]]},{"points":[[25,5],[25,6]]},{"points":[[25,6],[27,6]]},{"points":[[24,8],[27,8]]},{"points":[[33,7],[35,7]]}]}
```

```golf
id: simplify/seg-a-golf
title: Segment a in two gates
par: 2
metric: gates
allowed: [and, or, not, xnor]
spec:
  truthTable:
    inputs: [A, B, C, D]
    outputs: [Y]
    rows: ["0000 1", "0001 0", "0010 1", "0011 1", "0100 0", "0101 1", "0110 1", "0111 1", "1000 1", "1001 1", "1010 x", "1011 x", "1100 x", "1101 x", "1110 x", "1111 x"]
prompt: |
  The top segment of a 7-segment display, for the decimal digits 0 to 9 (A is the 8s bit). The codes 1010 to 1111 never occur, so the output may be anything for them. The Karnaugh-map answer, A + C + B·D + ¬B·¬D, takes five gates. Par is **two**: look at the two groups B·D and ¬B·¬D together.
hints:
  - B·D + ¬B·¬D is 1 when B and D are the same.
  - There is a gate whose output is 1 exactly when its inputs are the same.
explain: |
  The two small groups form a checkerboard on the map, and a checkerboard is an XNOR. So a = A + C + (B XNOR D): one XNOR and one three-input OR. Don’t-cares make room for the A and C groups; the checkerboard makes room for the gate.
solution: {"version":1,"title":"Segment a in two gates","engine":"digital","components":[{"id":"A","type":"port","x":5,"y":3,"params":{"name":"A","dir":"in"},"label":""},{"id":"B","type":"port","x":5,"y":5,"params":{"name":"B","dir":"in"},"label":""},{"id":"C","type":"port","x":5,"y":7,"params":{"name":"C","dir":"in"},"label":""},{"id":"D","type":"port","x":5,"y":9,"params":{"name":"D","dir":"in"},"label":""},{"id":"g1","type":"xnor","x":10,"y":6,"label":""},{"id":"g2","type":"or","x":20,"y":8,"label":"","params":{"inputs":3}},{"id":"Y","type":"port","x":28,"y":10,"flip":true,"params":{"name":"Y","dir":"out"},"label":""}],"wires":[{"points":[[10,3],[16,3]]},{"points":[[10,10],[16,10]]},{"points":[[5,5],[6,5]]},{"points":[[6,5],[6,6]]},{"points":[[6,6],[10,6]]},{"points":[[5,9],[8,9]]},{"points":[[8,8],[8,9]]},{"points":[[8,8],[10,8]]},{"points":[[5,3],[10,3]]},{"points":[[5,7],[7,7]]},{"points":[[7,7],[7,10]]},{"points":[[7,10],[10,10]]},{"points":[[16,3],[18,3]]},{"points":[[18,3],[18,8]]},{"points":[[18,8],[20,8]]},{"points":[[16,10],[20,10]]},{"points":[[16,7],[17,7]]},{"points":[[17,7],[17,12]]},{"points":[[17,12],[20,12]]},{"points":[[26,10],[28,10]]}]}
```

## Build it for real

:::real{parts="74HC08, 74HC32, 74HC04, 3 push-buttons or a 3-way DIP switch, LED, 1 kΩ resistor, 5 V USB supply module, breadboard, jumper wires"}
**The same function, three ways.** Build the majority function twice and compare the wiring. The 74HC08 holds four two-input ANDs (gate inputs on pins 1–2, 4–5, 9–10 and 12–13; outputs on pins 3, 6, 8 and 11) and the 74HC32 four ORs, with the same pin layout; pin 7 is ground and pin 14 is +5 V on both. For A·B + A·C + B·C use three ANDs and, since each OR has only two inputs, *two* ORs in a row. That is five gates. For A·B + C·(A + B) use one OR, two ANDs and one OR: four gates, but the signal from A to the output now passes through *three* gates instead of two. With the inputs on a DIP switch and the output on an LED, try all eight combinations of both circuits: they agree, and the second has one gate fewer to wire. (The canonical sum of products of Chapter 11 would need the 74HC04 as well, for its three inverters, and gates of three and four inputs: more chips for the same function.) Tie the unused inputs of the chips to ground (Chapter 10).
:::

## What’s next

We now have three ways to make logic small: the algebra, the map and the algorithm, and a fourth, factoring, that changes the shape of the circuit instead of its size. The next chapter uses them on the standard building blocks that every design contains: multiplexers, decoders, encoders and comparators. A multiplexer turns out to be a lookup table with the inputs of a truth table as its data, and that idea, a truth table stored in memory, is where Part VI ends up: an FPGA is a sea of them.
