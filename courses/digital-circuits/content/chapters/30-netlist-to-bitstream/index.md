---
number: 30
title: From netlist to bitstream
summary: How 17 gates and four flip-flops become six logic cells in a chosen tile, wired through chosen switches, and about a hundred bits, by way of synthesis, LUT mapping, packing, placement by annealing, routing by negotiation and timing analysis.
duration: About 2 hours
prerequisites: [describing-hardware, inside-an-fpga]
---

Chapter 29 ended with a counter: seventeen gates and four flip-flops, in a netlist that has no place and no wires. Chapter 28 ended with a chip: 32 logic cells, thousands of switches, and 1,772 bits of configuration. Between them lies a translation that nobody does by hand, and it is the same job a compiler does, with a stranger last step. The program is the counter; the machine is a fabric of LUTs and wires; and the output is a file of bits.

A hardware compiler has more stages than a software one, because a chip has *geography*: it is not enough to say what each piece computes, the tool must say which cell of which tile holds it and which of thousands of switches connect it to its neighbours. Each stage is a well-known problem with a well-known algorithm.

1. **Synthesis** turns the netlist into a graph of two-input ANDs and inverters, and simplifies it.
2. :term[Technology mapping]{id=technology-mapping} cuts the graph into pieces that each fit one LUT.
3. :term[Packing]{id=packing} groups the LUTs and flip-flops into tiles.
4. **Placement** decides which tile each group goes in.
5. **Routing** chooses the wires between them.
6. **Timing analysis** finds the slowest path, and so the fastest clock.
7. **Bitstream generation** writes every decision down as bits.

```quiz
q: 'The counter is 17 gates and four flip-flops: 21 pieces of logic. How many of the 32 logic cells of the vFPGA-S will it use?'
options:
  - text: 21, one for each gate and flip-flop.
    why: 'That is what a fabric of two-input gates would need. A LUT can hold a whole cone of gates, and a cell has a flip-flop of its own.'
  - text: '12.'
    why: 'Better, but the answer depends on how many gates a LUT can absorb, which is far more than one.'
  - text: '6.'
    correct: true
    why: 'The flip-flops sit inside four of the cells, each with the LUT that computes its next value; two more LUTs make the carry and the wrapped output. Even the enable and the clear vanish into the flip-flops’ own control pins. The rest of this chapter is how the tools found that.'
  - text: 1, since it is only one tile of eight.
    why: 'A tile has eight cells, and the counter uses six of them, but a cell is a LUT and a flip-flop: the count is of cells.'
```

Here is the whole flow, on the counter, in the Studio. Fit it, and then look at each stage’s trace: the Source is the DCL of Chapter 29; the Logic view is the gates it became; the Chip view shows where the cells went; the Bits view is the file; the Report has the numbers of every stage; and the Board runs the configured chip.

::fpga-studio{n="30.1" design="counter" size="S" views="source,chip,logic,bits,report,replay,board" caption="The counter on a vFPGA-S. The Report tab has the utilisation, the critical path and the time each stage took (a few tens of milliseconds in all). The two replays of the flow, placement and routing, are in Figures 30.3 and 30.4 below. In the Logic view click a gate and follow it to its cell and its bits. On the Board, set the enable switch (the free input) and press Step or Run: the count comes from the configured chip, not from the source."}

:::lab[Follow the counter through the tools]
Use Figure 30.1. Open the Report.

1. **Sizes.** The log lists what each stage produced: the counter is 13 AND nodes (down from 14 before the last simplification), then 5 LUTs, then 6 logic cells in 1 tile, with 8 routed nets.
2. **Cells.** In the Logic view select a gate of the incrementer, say an XOR. The chip view marks the cell that absorbed it, and the Bits view marks that cell’s bits.
3. **Time.** Find the critical path in the report: under 3 ns. It need not run from flip-flop to flip-flop, as you might expect: it can start at an input pin or end at an output pin, because the pads have delays too (0.5 ns in, 0.8 ns out in the model), and in this tiny design the pads are a large part of it.
4. **Run.** On the Board tab, set the free input `enable` and press Run. The count on the LEDs comes from the configured chip, and the panel beneath says the device agrees with the RTL simulator: the last section of this chapter is about that line.
:::

## Synthesis: a graph of ANDs

The netlist Chapter 29 produced is made of gates of many kinds: AND, OR, XOR, multiplexers, adders. A tool that wants to optimise it would need a rule for every combination. So the first step is to throw away the kinds. Chapter 11 showed that NAND alone is enough for any function; the tools use its cousin, the two-input **AND with optional inversion on every edge**. Everything else is built from it: an OR is an AND with three inversions (De Morgan again), an XOR is three ANDs, a multiplexer is three. The result is an :term[and-inverter graph]{id=aig}, or AIG: a directed graph whose nodes are two-input ANDs and whose edges may carry a bubble.

The counter’s 17 gates and four flip-flops become 14 AND nodes in the graph. The flip-flops are not part of it: a register’s output is an *input* of the graph, and its next value an *output*, so the graph is purely combinational and a timing path always runs from a register (or a pin) to a register (or a pin).

The graph is simplified as it is built, and again afterwards, by rules any programmer will recognise as compiler optimisations.

- **Structural hashing**: an AND of the same two operands is built once, however many times the design asks for it, the hardware version of common-subexpression elimination.
- **Constant propagation and local rewriting**: `x & 1` is `x`, `x & !x` is 0, and a few two-level patterns fall away.
- **Balancing**: a chain of ANDs, `(((a·b)·c)·d)·e`, is a tree, `((a·b)·(c·d))·e`, in which the operands that arrive early are combined first. The same nodes, half as deep.

On the counter the last step saves one node (14 to 13). On the 32-bit ALU of the RV32I core it takes the graph from 2,114 AND nodes to 2,027, and the depth from 81 to 79. Nothing dramatic: DCL’s compiler already builds sensible structure, and the biggest wins come from the next stage.

## Technology mapping: cutting the graph into LUTs

The graph has 2,027 nodes of two inputs each. The chip has LUTs of four. To turn one into the other, we pick a set of nodes whose *cones* (everything between them and the nodes below) each depend on at most four other nodes, and give each cone a LUT that holds its truth table. The choice is made with cuts.

A :term[cut]{id=cut} of a node is a set of at most four nodes, its leaves, such that every path from the inputs to the node passes through one of them. If a node has a cut with leaves {a, b, c, d}, it is a function of those four alone, and one LUT can replace everything between. A node has many cuts. The counter’s `wrapped`, an AND of five signals, has no cut of four leaves that reaches all five inputs, so the best it can do is a cut such as {enable, v3, n}, where n is the AND of the other three: two LUTs.

```quiz
q: 'An 8-input parity (the XOR of eight signals) is 21 AND nodes in the graph, and 6 levels deep. How many 4-input LUTs will the mapper cover it with?'
options:
  - text: 21, one for each node.
    why: 'That is what K = 2 would give if each LUT covered a single node. But a LUT can cover a whole cone: one 2-input LUT already covers a complete XOR of three nodes.'
  - text: 7, one for each XOR.
    why: 'Seven 2-input XORs need seven 2-input LUTs. A 4-input LUT is wide enough to hold the XOR of four signals, which is three XORs.'
  - text: '3.'
    correct: true
    why: 'A 4-input LUT holds any function of four inputs, including the parity of four. Two of them take four inputs each, and a third takes their two outputs: 3 LUTs, two levels deep.'
  - text: 1, because parity is one function.
    why: 'Only if the LUT had eight inputs. A LUT4 can see four signals.'
```

The mapper works in two passes. First it labels every node with the fewest LUT levels it can be reached in: an input has label 0, and any other node has 1 plus the smallest, over its cuts, of the largest label among the cut’s leaves. The label of an output is the depth of the best possible mapping, so this pass finds the **fastest** cover. Then it recovers area: nodes off the critical path do not need the fastest cut, so it picks cuts that share the most logic, until the count stops falling.

The figure runs the course’s own mapper on four small functions. Change K to two, three, four, and see the trade: bigger LUTs, fewer LUTs and fewer levels.

::cut-mapper{n="30.2" caption="Pick a function and set K to 4. Click a node to see all its cuts (the leaves, the truth table the LUT would hold, and the levels each would need). The mapper’s choice is marked. Then turn Balance on for the 8-input AND, and see the depth fall from 3 levels of LUTs to 2. Compare K = 3 and K = 4 for the carry of the 4-bit adder: 4 LUTs four levels deep, against 3 LUTs three deep. That is the argument for the LUT4."}

:::lab[Cover the graph]
Use Figure 30.2.

1. Choose *8-input AND* and K = 4: a chain of seven ANDs, mapped to three LUTs, three levels deep. Turn on Balance: the same seven nodes, but now three LUTs two levels deep. Balancing before mapping made the *mapped* circuit faster, because the mapper is optimal only for the graph it is given.
2. Choose *Parity of 8 bits* and set K = 2, 3 and 4: the LUT count goes 7, 5, 3 and the depth 3, 3, 2. Three inputs save two LUTs and no level; four save two more and a level. For this function four is where a LUT starts to pay.
3. Choose *4-way multiplexer*. With K = 2 it needs 9 LUTs, one per node; with K = 3, three, one for each 2:1 multiplexer. Click the top node of any function and compare its cuts with the mapper’s choice: is it always the one with the fewest leaves?
:::

:::history{year=1994 title="FlowMap" people="Jason Cong, Yuzheng Ding"}
In 1994 Jason Cong and Yuzheng Ding showed that mapping a network to LUTs for the fewest levels has an efficient exact solution. Their FlowMap labels each node with the least depth it can have, using a maximum-flow computation to find the cut that gives it, and covers the network from the outputs. It was the first delay-optimal algorithm for LUT-based FPGAs, and won the IEEE Circuits and Systems Society’s best paper award of 1995.:cite[cong1994] Modern mappers, such as ABC inside Yosys, follow the same plan: label for depth, then recover area. The course’s mapper reaches the same labels without the max-flow, by keeping the eight best cuts of every node, which is exact whenever the best cut is among them; that holds on every design in the tests.
:::

:::hood[The truth table of a cut]
Cut enumeration (`src/lib/pld/fpga/cuts.ts`) builds the cuts of a node from those of its two fanins, and with each cut goes the truth table the LUT will hold. Merging two cuts computes it:

```ts
export function mergeCuts(x: Cut, cx: number, y: Cut, cy: number, k: number): Cut | null {
  const leaves = mergeLeaves(x.leaves, y.leaves, k);
  if (!leaves) return null;                 // more than k leaves: not a cut
  const m = leaves.length;
  let a = expandTt(x.tt, x.leaves, leaves);
  let b = expandTt(y.tt, y.leaves, leaves);
  const mask = (1 << (1 << m)) - 1;
  if (cx) a = ~a & mask;                    // an inverted edge inverts the table
  if (cy) b = ~b & mask;
  return { leaves, tt: a & b & mask };
}
```

The new node’s leaves are the union of its fanins’ leaves, if there are at most `k`. Each fanin’s table is re-expressed over the combined leaves (`expandTt` repeats it over the variables it did not depend on), an inverted edge complements it, and since the node is an AND, its table is the bitwise AND of the two. A table over four leaves is a 16-bit number, so the mapper never simulates anything: one `&` is all the logic there is. Cuts whose leaves contain another cut’s are dropped as dominated, and the eight best remain, ordered by depth, then area flow.
:::

**Carry chains.** One kind of logic is not left to the mapper. An adder is a chain of full adders, and its structure is recognised in the graph, so that the carry can be sent through the cell’s dedicated carry path of Chapter 28. On a 32-bit adder the difference is large. With the chain, the adder is 32 cells and about 8 ns pad to pad; without it, the mapper needs 71 LUTs, 21 levels deep, and the delay is nearly 24 ns. **Block RAM** is inferred the same way: a `mem` of DCL is left out of the graph and given a block, if the chip has one.

## Packing: cells into tiles

The mapped circuit is now a netlist of *cells*: a LUT, perhaps with a flip-flop after it and a carry to its neighbour. The chip’s cells come in tiles of eight, with shared clock, enable and set/reset pins (Chapter 28), and the next step, **packing**, puts the cells into tiles so that the constraints hold, and so that cells that talk to each other are together.

Two rules constrain the choice. Flip-flops that share a tile must share their clock, enable and reset. And a carry chain must sit in one column, cell after cell, so a long chain becomes a rigid vertical block of tiles that the placer moves as one. Within those, the packer is greedy: it picks a cell, then repeatedly adds the unplaced cell that shares the most signals with what is in the tile, until the tile is full or nothing is attracted to it. The counter’s six cells go into one tile. The ALU’s 679 cells fill a large part of the vFPGA-M’s 144 tiles, and every tile is as full as its flip-flops’ shared clock, enable and reset allow: a packing is never perfect. Placement then moves *blocks*, not cells: tiles of up to eight cells, the pads at the edge and any block RAMs.

## Placement: simulated annealing

Now every block must go on a site of its own kind: logic blocks on logic tiles, pads on pads, RAMs in RAM columns. The ways to do it are astronomical in number, and what makes one better than another is the length of the wires: a block far from what it talks to needs a long route, which is slow and uses scarce wires. So the tool estimates each net’s length as the **half-perimeter of its bounding box**, the smallest rectangle containing every block on it, and tries to make the sum small. A timing term is added, so that nets on the critical path are shortened first.

The algorithm that has done this for chips for forty years is borrowed from a metal-working trade. To make a crystal without flaws, a metallurgist heats the metal and cools it slowly, so that the atoms can shake out of a bad arrangement before they freeze. The computer version, :term[simulated annealing]{id=simulated-annealing}, does the same with blocks. Start with a random placement and a high *temperature* T. Repeat: pick a block and a random new site, and compute the change Δ in cost. If Δ ≤ 0, the move improves things: do it. If Δ > 0, the move makes things worse, and it is still done with probability e^(−Δ/T). Then cool a little. At high T almost every move is accepted, and the blocks wander; as T falls, worse moves are accepted less and less; at T = 0 only improvements are.

```quiz
q: 'Why does the annealer sometimes accept a move that makes the placement worse, instead of taking only improvements?'
options:
  - text: To make the run slower, so the result is better.
    why: 'The random moves are not padding. They have a purpose, and it is not to waste time.'
  - text: 'So that it can climb out of a local minimum: an arrangement that no single move improves, but that is far from the best.'
    correct: true
    why: 'A greedy placer stops at the first arrangement none of whose neighbours is better, and a random start makes that a poor one. Accepting an occasional worse move lets the blocks move over a hill to a better valley. The probability e^(−Δ/T) shrinks as T falls, so the search settles.'
  - text: 'Because the cost function is noisy, and a worse move may in fact be better.'
    why: 'The cost is computed exactly for each move. The randomness is in which moves are tried and which worse ones are accepted, on purpose.'
```

:::history{year=1983 title="Optimization by simulated annealing" people="Scott Kirkpatrick, C. Daniel Gelatt, Mario Vecchi"}
In 1983 three researchers published “Optimization by simulated annealing” in *Science*. The way a physical system cools into a low-energy state, they pointed out, is a way to search for a good solution to a problem with many variables. The acceptance rule, that a worse state is taken with probability e^(−Δ/T), is that of Nicholas Metropolis and colleagues’ simulation of atoms in 1953.:cite[metropolis1953] The paper’s examples were in the physical design of computers: placing circuit elements on chips, and wiring them.:cite[kirkpatrick1983] Annealing became the standard method for placing chips.
:::

The vFPGA’s placer follows VPR, the tool of Vaughn Betz and Jonathan Rose that became the reference for FPGA research.:cite[betz1997] The starting temperature is 20 times the standard deviation of the cost over as many random moves as there are blocks; each temperature runs N^(4/3) moves for N blocks; the cooling factor depends on how many moves were accepted (0.5 if nearly all, 0.95 in the middle, 0.8 near the end); and the distance a block may jump shrinks as acceptance falls, so late moves are local. The figure replays the placement of the 32-bit ALU.

::place-route-replay{n="30.3" design="alu" mode="place" caption="Press play (or drag the scrubber) to watch the annealer. Blocks jump wildly while it is hot; as the temperature falls the placement freezes into clusters, and the pads gather at the edge nearest what they talk to. The chart under the chip shows the wirelength cost: it does not fall at first (the annealer is exploring), and then drops quickly in the middle."}

On the ALU the estimated wirelength falls to about half of that of the random start, over a hundred temperatures and some two hundred thousand moves, and the timing cost, which weighs each connection by how critical it is, falls to a few per cent of its starting value. The placer’s own estimate of the critical path, made before any wire exists, comes within a few per cent of what the timing analysis measures after routing: a placement is a good forecast of a route.

:::hood[The annealer’s accept rule and its cooling]
The placer is `src/lib/pld/fpga/place.ts`. For every move at a temperature `T` it applies the swap, computes the change of the combined cost, and keeps it if it is an improvement, or with the Metropolis probability if it is not:

```ts
const { dBB, dT } = evaluate();
const delta = combine(dBB, dT);
if (delta <= 0 || (T > 0 && rnd() < Math.exp(-delta / T))) {
  commit();
  accepted++;
} else apply(mvOld);
```

`combine` is the weighted sum of the two costs, each divided by its value at the previous temperature so that wirelength and timing count in comparable units: `(1 − λ)·dBB/prevBB + λ·dT/prevT`. After each temperature the loop looks at the acceptance rate and cools by an amount that depends on it, as VPR does, and shrinks the window (`rlim`) in which blocks may move:

```ts
const alpha = rate > 0.96 ? 0.5 : rate > 0.8 ? 0.9 : rate > 0.15 ? 0.95 : 0.8;
temp *= alpha;
rlim = Math.min(maxR, Math.max(1, rlim * (1 - 0.44 + rate)));
if (temp < 0.005 * norm / nNets || iter >= maxTemps) break;
```

It stops when the temperature is below half a per cent of the cost per net, and then makes one more pass at T = 0, the “quench”, which accepts only improvements. The random numbers come from a seeded generator (xorshift32), so the same design always gives the same placement: the same counter gives the same placement on your laptop and in the test suite. Every temperature is recorded in `trace.steps`, and some block positions in `trace.snapshots`; that is what the replay plays.
:::

## Routing: negotiation

With the blocks in place, every net must be given a path through the switches of Chapter 28. The chip is modelled as a **routing-resource graph**: a node for every wire and pin, an edge for every switch that can connect two of them, and a delay on each node. Routing a net is finding a tree in this graph from its driver to its sinks. Routing one net is easy: it is a shortest-path search. The difficulty is that a wire carries only one signal, so two nets that want the same wire cannot both have it, and a net that takes the best route may leave another with none.

The first idea is to route the nets one by one, each on the shortest free path, and to rip up and retry when one gets stuck. This depends badly on the order: a net routed first may take the wire a critical net needed. :term[PathFinder]{id=pathfinder} is a better idea. Let every net take whatever it wants, wires shared or not, and then *negotiate*: raise the price of every wire that two nets want, so that the nets for which the wire matters least will go round, and the nets that need it most will keep it.

The price of a wire is the product of three things: its **base cost** (its delay), a **present-sharing** factor that rises with the number of nets using it now, and a **history** factor that has grown for every iteration in which it was contested. The present factor grows over the iterations, so that contested wires become steadily dearer. The history term never falls, so a wire that has been fought over stays unattractive. Only the nets on an overused wire are ripped up and routed again.

```quiz
q: 'In the first iteration of PathFinder every net is routed as if it were alone on the chip. On the 32-bit ALU, about 5,000 routing nodes are then in use. How many are wanted by two nets or more at the end of that iteration?'
options:
  - text: 'None: with 13,976 nodes on the chip, there is room for everyone.'
    why: 'The chip is not full, but the wires are not spread evenly: nets from the same place, going to the same place, all want the same short wires.'
  - text: 'About a tenth of them.'
    correct: true
    why: 'Several hundred nodes are overused after the first pass, roughly a tenth of those in use. The number then falls through the iterations, as the chart of the figure shows, until it reaches 0.'
  - text: 'About half of them.'
    why: 'The shortest paths overlap a good deal, but not that much: the chip has other routes of much the same length, and the nets choose among them once the price changes.'
```

:::history{year=1995 title="PathFinder" people="Larry McMurchie, Carl Ebeling"}
Larry McMurchie and Carl Ebeling of the University of Washington presented PathFinder at the FPGA ’95 symposium in Monterey, in February 1995. It is a router that balances routability against speed by *forcing signals to negotiate for a resource*: an iterative algorithm that converges to a state in which every signal is routed, with close to the performance the placement allows.:cite[mcmurchie1995] Negotiated congestion became the basis of the router in VPR, and of many routers since.:cite[betz1997]
:::

::place-route-replay{n="30.4" design="alu" mode="route" caption="Play the routing of the ALU. Every net is routed in the first iteration, and the map shows where two nets share a wire. Iteration by iteration the shared wires melt away as nets go round: several hundred at first, none at the end. The chart shows how many nodes are overused at the end of each iteration. Compare with the fitting of the counter (Figure 30.1): its few iterations are over in a few milliseconds."}

The ALU’s first iteration leaves several hundred nodes overused, and the router iterates until none is; the register file on vFPGA-L starts with thousands. The count is not a proof of anything, but the *shape* is the thing to notice: a fast fall, then a long tail, because the last few conflicts are the hard ones, where two nets each have no good alternative.

:::hood[The price of a wire]
The router is `src/lib/pld/fpga/route.ts`. Each net is routed by an A* search over the graph, which expands the node with the lowest cost so far plus a guess of what remains. The cost of stepping onto a node `m` is the PathFinder price, in three lines:

```ts
const o = occ[m]!;
const pres = 1 + (o >= 1 ? o : 0) * presFac;
const cong = baseCost[m]! * acc[m]! * pres;
```

`occ` is how many nets use the node now, so `pres` is 1 for a free wire and grows for a shared one; `acc` is the history; `baseCost` is the node’s delay plus a hundredth of a nanosecond, so that even free nodes have a price. At the end of each iteration, every node that is still overused has its history raised, and the present-sharing factor is multiplied:

```ts
if (occ[n]! > 1) {
  over++;
  acc[n] = acc[n]! + accFac * (occ[n]! - 1);
}
// …
presFac *= presMult;   // 0.5, 0.7, 0.98, 1.37, … : times 1.4 each iteration
```

That is the negotiation: the first iteration has `presFac` = 0.5, so sharing is cheap and nets go their own way; by the sixteenth it is 78, sharing is nearly forbidden, and the history has taught each net which wires are contested. With timing on, a connection’s cost blends its delay with this price, weighted by its criticality, and the weight fades so that congestion is always resolved in the end.
:::

:::history{year=1997 title="VPR" people="Vaughn Betz, Jonathan Rose"}
In 1997 Vaughn Betz and Jonathan Rose of the University of Toronto published VPR, “Versatile Place and Route”: a packing, placement and routing tool for FPGA research that could target any architecture a researcher could describe, with its source code public.:cite[betz1997] Its placer used simulated annealing, and its router PathFinder. Almost every academic study of FPGA architecture since has used it or its successor, Verilog-to-Routing; the vFPGA’s placer follows its schedule.
:::

## Timing: the slowest path sets the clock

When the wires are chosen, their delays are known. :term[Static timing analysis]{id=static-timing-analysis} takes them together with the delays of the cells and finds the slowest path, without simulating a single input. It treats the circuit as a graph again, with a delay on every edge, and does two sweeps.

- **Forward:** the *arrival time* at every point is the largest, over all the edges that lead in, of the arrival at the far end plus the delay of the edge. A flip-flop starts a path when the clock ticks, after its clock-to-output delay; an input pin starts one after the input buffer’s delay.
- **The period:** the largest arrival at any end point, plus what that end point needs, is the smallest clock period the design can run at. Its inverse is the maximum clock frequency, :term[fmax]{id=fmax}. A flip-flop needs its set-up time; an output pin needs its buffer.
- **Backward:** the *required time* at each point is the latest the signal may arrive without lengthening the period, and the :term[slack]{id=slack} of a connection is required minus arrival. A connection with zero slack is on the :term[critical path]{id=critical-path}; every other has slack to spare.

The counter’s critical path, in Figure 30.1’s report, is a path of a LUT or two between pins and flip-flops: a launch of 0.3 to 0.5 ns, 0.5 ns per LUT, a few tenths in the nets and, at an output pin, 0.8 ns for the buffer, so under 3 ns, or more than 300 MHz. The ALU’s is about 35 ns, under 30 MHz, and the nets are a little over half of it; in the register file on vFPGA-L they are nearly two thirds. That is Chapter 28’s prediction: wires are the delay.

The figure is a timing graph small enough to see whole, analysed by the same function that produces the Studio’s report. The nets are yours to change.

::slack-explorer{n="30.5" caption="The critical path is drawn thick: FF2 → L2 → L3 → L4 → FF4, 4.4 ns. Click the net n4, which takes 1.1 ns, and drag its delay down to 0.1 ns: the period falls only from 4.4 to 4.2 ns, because the path through L1 was only 0.2 ns behind and is now critical. Then set the target clock period below the slowest path, and watch the slack of the nets go negative."}

:::lab[Chase the critical path]
Use Figure 30.5.

1. Note the critical path and the period (4.4 ns, 227 MHz). Which nets have the smallest positive slack? (n1 and n3, 0.2 ns.)
2. Speed up n4, on the critical path, from 1.1 to 0.1 ns. The period improves by 0.2 ns, not 1.0. Why? Now speed up n1 as well: the period falls again, to 3.7 ns, and the critical path has moved to the branch that starts at FF1 (n0). *Fixing the worst path only helps until another takes over*: this is why the timing-driven placer and router give every connection a criticality, not only those on the current worst path.
3. Set the target clock period to 4.0 ns, below the slowest path. The worst slack is −0.4 ns, and the failing nets turn red: a real tool would report that timing is not met, and the design would have to be improved, or the clock slowed.
4. Restore the delays, and slow n0 to 2.5 ns. Which path is critical now, and how long is it? (FF1 → L1 → L3 → L4 → FF4, 5.8 ns.)
:::

## The bitstream, and running it

Everything decided so far is now written down as bits. The bitstream generator (`bitgen.ts`) gives each cell its LUT table and flags, each routing multiplexer on a route the code of the input that drives it, and each pad and block RAM its settings. One detail: the router may connect a net to *any* of a LUT’s four pins, since they are interchangeable, so the table is permuted to match the pins it chose. The tables the Bits view shows are these permuted tables, not the ones in the mapper’s report.

The counter’s file is 277 bytes: a header, four frames each with its own checksum, and a checksum of the whole. Of its 1,772 bits, about 110 are set.

Now the most important step. The tools have worked on a *model* of the chip; what is loaded onto the device is the bits. So when you press Run on the Studio’s board it does not run the source, or the placed netlist. It decodes the bitstream, as Chapter 28’s under-the-hood box describes, into a circuit of LUTs, multiplexers and flip-flops, runs *that* on the digital engine beside the RTL simulator running the source, and compares the two after every clock. When they agree, the whole chain has preserved the meaning of the design: elaboration, graph, mapping, packing, routing, bits. When they do not, something in the chain is wrong, or a bit has been changed.

::corrupt-bits{n="30.6" caption="Every square is one bit of a LUT’s table in the counter as the tools configured it. The two rows underneath are the count after each of twenty clocks, on the RTL simulator and on the chip decoded from these bits. Flip a bit and watch them part: a red cell is the first clock at which the chip disagrees. Some flips are not noticed: hold the enable high and find the bits of n11 that never matter. Then choose the second stimulus, which lowers the enable every third cycle, and see how many of them come to light."}

:::lab[Break the counter, one bit at a time]
Use Figure 30.6.

1. Flip any one bit of the table of `value[0]`, the cell of the lowest bit of the count. Within a clock or two the chip parts from the source and shows `x`: the output is unknown. (The rows where its input is 0 are read at the first clock, and the rows where it is 1 one clock later, when the bit has become 1.)
2. There are 96 bits in the six tables. With the enable held high, 88 flips are noticed. The other eight are all in the cell `n11`, which makes `wrapped`, in the rows where the enable is low: a test that never lowers the enable cannot see them.
3. Switch to *enable low every third cycle*. Four of the eight now show up. The other four need the enable low while the count sits at 7 or 15, which this stimulus never arranges. Testing a design is an argument about which rows of which tables are reached, as in the coverage of a software test.
4. Restore, then press *Invert* on the table of `value[1]`. Now the chip shows wrong *numbers* (3, 6, 5, 4, …), not `x`. One flipped bit makes the table depend on an input wired to nothing, so the output is unknown; a table inverted whole still ignores the unwired inputs, and computes a definite, wrong function.
:::

## One design, three chips

The same counter, as equations, goes into the devices of Chapters 26 and 27. Here is what each tool reports for the 4-bit counter with enable, clear and the `wrapped` output. The tools report different quantities, and the delay models are different, so the table compares the resources and not the speeds.

| | GAL22V10 | vCPLD-32 | vFPGA-S |
|---|---|---|---|
| What is used | 5 of 10 macrocells, 15 product terms | 5 of 32 macrocells, 9 product terms, one function block | 6 of 32 logic cells, one tile |
| How the counter is built | Every register is a D flip-flop; the highest bit needs 5 product terms (of the 8 its macrocell has) | T flip-flops: every register needs 2 terms | 4 flip-flops, each with the LUT of its next value, and 2 more LUTs |
| Configuration | 53 of 5,808 array fuses connected | 9,024 configuration bits in all | about 110 of 1,772 bits set |
| Why the counter fits | Enough registers and terms | T flip-flops make counting cheap | One cell per bit, and the enable and clear are pins of the flip-flop |

The GAL’s cost rises with the bit position, because bit *k* of a counter depends on all the lower bits (2, 3, 4 and 5 product terms for the four registers). That is the limit of Chapter 26, and a 16-bit counter cannot fit at all: it needs 16 registers, and its top bit alone 17 terms. The FPGA’s cost is flat: the lower bits reach each bit through a shared AND (the cell `n10` of Figure 30.1), and every bit is one LUT with its flip-flop. And when a design outgrows the chip, the FPGA has more: the 16-bit hexadecimal counter of the virtual board, with its four display decoders, takes 83 cells of the vFPGA-M, 16 of them flip-flops.

## Build it for real

:::real{parts="an iCE40 board (an iCEstick or any board with an iCE40 HX1K, HX8K or UP5K), a USB cable, the open-source tools Yosys, nextpnr-ice40 and Project IceStorm"}
The same counter, on an iCE40, through the open-source flow, and a comparison with what you saw.

1. Take the counter of Chapter 29 in its Verilog form (`counter.v`, in the *In industry* box), and add a top module that slows the clock down so that the count is visible. The counter counts once per `enable`; a 22-bit prescaler makes one every 0.35 s at 12 MHz:

   ```verilog title="top.v"
   module top (input clk, output [3:0] led);
     reg [21:0] div = 0;
     always @(posedge clk) div <= div + 1;
     wire tick = &div;                       // once per 2^22 clocks
     counter c (.clk(clk), .enable(tick), .clear(1'b0), .count(led), .wrapped());
   endmodule
   ```

   ```text title="icestick.pcf"
   set_io clk 21
   set_io led[0] 99
   set_io led[1] 98
   set_io led[2] 97
   set_io led[3] 96
   ```

   (Those are the pins of an iCEstick; on another board use its constraints file. The course’s own compiler will write this netlist for you in Chapter 31. Until then the Verilog above is the same design, written by hand.)

2. Run the four steps:

   ```sh
   yosys -p "read_verilog counter.v top.v; synth_ice40 -top top -json top.json" | tee yosys.log
   nextpnr-ice40 --hx1k --package tq144 --json top.json --pcf icestick.pcf --asc top.asc --freq 12
   icepack top.asc top.bin
   iceprog top.bin
   ```

   The four LEDs count in binary, about three times a second.

3. Now read the logs as you read the Studio’s report, and match each stage of this chapter to a tool:

   | This chapter | The open-source flow |
   |---|---|
   | Elaboration, synthesis (DCL to a graph of gates) | Yosys: `read_verilog`, then `synth_ice40` (`proc`, `opt`, `alumacc`, …) |
   | LUT mapping (cuts, depth first, then area) | ABC, called by `synth_ice40` with a four-input LUT target; Yosys’s final `stat` lists the `SB_LUT4`, `SB_DFF…` and `SB_CARRY` cells |
   | Packing | nextpnr’s packing phase: cells into logic cells, carry chains into columns |
   | Placement | nextpnr: an analytic placer (HeAP) by default, and an annealing placer with `--placer sa` |
   | Routing | nextpnr’s router, `router1` by default, `router2` with `--router router2`: rip-up and re-route on the chip’s routing graph |
   | Timing analysis | nextpnr’s “Max frequency for clock” line, and `icetime -d hx1k top.asc` |
   | Bitstream | `icepack` (`.asc` to `.bin`), the format that Project IceStorm reverse-engineered |
   | Running the bits | `iceprog` writes them to the board’s flash; the chip loads them at power-up |

   Compare the numbers. Yosys should report a handful of `SB_LUT4` and four `SB_DFFE`, flip-flops with a clock enable (`clear` is tied to 0 and disappears; on a button it would be `SB_DFFESR`, with a synchronous reset too): the same shape as the counter’s cells in Figure 30.1. nextpnr reports the logic cells it used and an fmax far above 12 MHz. They will not agree exactly with 6 cells and 370 MHz, because the vFPGA has its own mapper and delay model; what matters is that the same stages give the same kind of answer.

4. Run nextpnr again with `--placer sa` (annealing, as in this chapter), with `--router router2`, and with different `--seed` values, and read the maximum frequency each time. It moves by some per cent with each change of algorithm and of seed: that is the variation randomness in placement gives, and the reason timing must be checked on the final run.
:::

:::history{year=2015 title="Project IceStorm" people="Clifford Wolf, Mathias Lasser"}
For most of the history of FPGAs, the bitstream was a secret: the vendor’s own software was the only way to turn a design into one, and the tools could be neither studied nor improved. In 2015 Clifford Wolf and Mathias Lasser published Project IceStorm, a reverse-engineered documentation of the bitstream of the Lattice iCE40, with tools to read and write it.:cite[icestorm-eetimes] That made the iCE40 the first FPGA family with a documented bitstream and a free toolchain: Yosys, Wolf’s synthesis suite (described in 2013),:cite[wolf2013] for synthesis and mapping; IceStorm for the bitstream; and, from 2018, nextpnr, a portable place-and-route tool by David Shah and others.:cite[shah2019] The same approach has since been applied to other families: a design can now be traced, with open tools and an open format, all the way to the wires and switches of a real chip, as this chapter has done on the virtual one.
:::

## Exercises

```quiz
q: 'The technology mapper of this chapter is “depth-optimal”. What does that guarantee?'
options:
  - text: 'That the circuit uses the fewest LUTs possible.'
    why: 'Area is recovered afterwards, and only without lengthening the deepest path. Depth comes first.'
  - text: 'That for the graph it is given, no cover has fewer levels of LUTs on any output.'
    correct: true
    why: 'The labelling gives the least depth each node can have. But only for the graph as given: balance the graph first (Figure 30.2, the 8-input AND) and the optimum for it may be lower.'
  - text: 'That the circuit is the fastest possible on the chip.'
    why: 'Levels of LUTs are only part of the delay. The wires between them, and the placement, matter as much: half the ALU’s critical path is wire.'
```

```quiz
q: 'A placement puts two blocks that share a net at opposite corners of the chip. Which stage is most likely to complain?'
options:
  - text: 'Packing, because they are in different tiles.'
    why: 'Packing happens before there is any geography. It decides which cells share a tile, not where the tiles go.'
  - text: 'The router or the timing analysis: a long net is slow, and needs the scarce long wires.'
    correct: true
    why: 'A net across the chip needs several long wires, competing with other long nets, and its delay is on some path. The placer avoids it by minimising wirelength and by weighting critical connections more; if it fails, the router or the timing report shows it.'
  - text: 'The bitstream generator, because the bits are too far apart.'
    why: 'Bits have no geography. A route across the chip is just more select bits set.'
```

```quiz
q: 'PathFinder’s history factor never decreases. What would go wrong if it were forgotten at the end of every iteration?'
options:
  - text: 'Nothing: the present-sharing factor already makes contested wires expensive.'
    why: 'The present-sharing factor looks only at the current iteration. A wire that was contested and then abandoned looks free again.'
  - text: 'Two nets could keep swapping a wire, each leaving it when it is crowded and returning when it is free, and never settle.'
    correct: true
    why: 'This is the oscillation the history term prevents: a wire that has been contested many times stays dear, so nets that once fought over it look for another way, and the negotiation converges.'
  - text: 'The router would run out of memory.'
    why: 'The history costs one number per node, and forgetting it would save memory rather than cost it.'
```

```parsons
title: 'A design becomes a bitstream'
prompt: 'Put the stages of the toolchain in the order in which they run.'
lines:
  - 'Synthesis: the netlist becomes a graph of ANDs and inverters, simplified and balanced.'
  - 'Technology mapping: the graph is cut into LUTs of at most four inputs.'
  - 'Packing: the LUTs and flip-flops are grouped into tiles of eight cells.'
  - 'Placement: every tile and pad is given a place on the chip, by annealing.'
  - 'Routing: every net is given a path through the switches, by negotiation.'
  - 'Timing analysis: the slowest path, and so the fastest clock, is found.'
  - 'Bitstream generation: the LUT tables, routing selects and flags are written as bits.'
distractors:
  - 'Placement: each LUT is given a truth table.'
  - 'Routing: the flip-flops are given their initial values.'
```

```bug
title: 'Reading a timing report'
prompt: 'A designer reads the report of a fitted design and reasons about it. Click the first line that is wrong.'
lines:
  - 'The report says the critical path is 8.0 ns, so fmax is 125 MHz.'
  - 'The path goes through four LUTs of 0.5 ns each (2.0 ns), and the flip-flops’ clock-to-output and set-up take 0.5 ns in all.'
  - 'The remaining 5.5 ns is in nets, so the wires are more than two thirds of the delay.'
  - 'Making the LUTs twice as fast, 0.25 ns each, would therefore make the design about twice as fast overall.'
wrong: 3
why: 'Halving 2.0 ns of logic saves 1.0 ns, and the path becomes 7.0 ns: a gain of 14 %, not 100 %. It is the nets that dominate. (And if the wires were sped up instead, another path might take over, as Figure 30.5 showed.)'
notes:
  '0': 'Correct: 1000 ÷ 8.0 = 125 MHz.'
  '1': 'Four LUTs of 0.5 ns is 2.0 ns, and 2.0 + 0.5 = 2.5 ns of the path is not wire.'
  '2': 'Correct: 8.0 − 2.5 = 5.5 ns of wire, 69 %.'
```

:::challenge[Fmax by hand]
A path starts at a flip-flop (clock-to-output 0.3 ns), goes over a net of 0.4 ns to a LUT (0.5 ns), over a net of 0.9 ns to a second LUT (0.5 ns), over a net of 0.4 ns to a third LUT (0.5 ns), and over a last net of 0.4 ns to a flip-flop whose set-up time is 0.2 ns. What is the period, and the fmax? If the mapper could merge the second and third LUTs into one (the two of them depend on only four signals in all), and the net between them disappears, what is the new fmax?

*Answer.* 0.3 + 0.4 + 0.5 + 0.9 + 0.5 + 0.4 + 0.5 + 0.4 + 0.2 = 4.1 ns, and 1000 ÷ 4.1 = 244 MHz. With the merge, the net between the second and third LUTs (0.4 ns) and one LUT (0.5 ns) vanish, and the merged LUT still takes 0.5 ns: 0.3 + 0.4 + 0.5 + 0.9 + 0.5 + 0.4 + 0.2 = 3.2 ns, 312.5 MHz. A quarter faster, from one fewer LUT in the path: this is why the mapper minimises depth first, and why a LUT’s delay does not depend on what it holds.
:::

Two exercises on the tools’ own data: a placement to improve, and a bitstream to read.

```place
id: 30-netlist-to-bitstream/place-shift-register
title: Beat the annealer
seed: 5
prompt: |
  A small design, a 12-bit shift register with feedback and three flags, has been taken through Chapter 30’s flow as far as packing: its 23 logic cells are in **three tiles**, and it has a clock and thirteen ports. Five pads are already fixed, as on a board: the clock, and four pins that the circuit board has wired (`seed[0]`, `seed[2]`, `q[0]` and `q[2]`). The annealer placed everything on the vFPGA-S with seed 5, and got a wirelength cost of **40.50**.

  Place the other blocks yourself, onto the four tile sites and the free pads, so that your cost is **lower**. The cost is the placer’s own: for each net, the half-perimeter of the box around its blocks, scaled up for nets with many terminals, added up over all the nets.
hints:
  - 'Each tile wants to sit near the blocks it shares nets with. Press *The annealer’s*, look at what it did, and draw the nets (the lines) to see which blocks pull on which.'
  - 'The fixed pads pull their tiles towards them: `seed[2]` and `q[2]` want the tile that uses their nets. Put the pads you may choose beside the tile whose nets they join, and pads that join two tiles between them.'
  - 'A net that stays inside one tile costs nothing. Look for the nets with the longest boxes, and shorten those first.'
explain: |
  The annealer minimises a weighted sum: wirelength, and timing, and a spreading term that stops the design piling up in one place. You minimised only the first, so you could pay for shorter wires with a longer critical path, or with a more crowded die, that the annealer would not accept (compare the estimated critical paths in the panel). It is also why the real flow runs the router afterwards: a placement that has the best wirelength is only a promise, and the wires have to keep it.
design: |
  /// A 12-bit shift register with feedback taps, four bits loaded at the top, and three flags.
  module Lfsr(clk: clock, en: bit, load: bit, seed: bits<4>) -> (q: bits<4>, par: bit, hit: bit) {
    reg r: bits<12> = 1
    let fb: bit = r[11] ^ r[10] ^ r[9] ^ r[3]
    next r = if load { concat(seed, r[7:0]) } else if en { concat(r[10:0], fb) } else { r }
    q = r[11:8]
    par = r[0] ^ r[1] ^ r[2] ^ r[3] ^ r[4] ^ r[5] ^ r[6] ^ r[7]
    hit = r[11:4] == 0xA5
  }
pins: { "seed[0]": P12, "seed[2]": P14, "q[0]": P4, "q[2]": P6 }
solution:
  tile 0: "2,2"
  tile 1: "1,1"
  tile 2: "2,1"
  en: P5
  load: P13
  seed[1]: P9
  seed[3]: P8
  q[1]: P2
  q[3]: P3
  par: P10
  hit: P7
```

```decode
id: 30-netlist-to-bitstream/read-the-bitstream
title: What does this bitstream do?
device: fpga
prompt: |
  A vFPGA-S has been configured, and this is what is in its bitstream, region by region: three logic cells, the routing multiplexers that are set, and the pads. Pads **P0**, **P1** and **P2** are inputs, and **P8** and **P9** are outputs. What does each output compute?

  Start with the LUTs: bit *r* of a LUT is its output when I0 + 2·I1 + 4·I2 + 8·I3 = *r*. Then follow the wires: the routing table says which cell input is driven by what.
hints:
  - 'The LUT bits of `LC(1,2,0)` and `LC(1,2,1)` are the same: 0110 repeated. In which rows of a two-input table is the output 1? (The other two inputs do not matter.)'
  - 'The third cell uses three inputs: its bits, 0xe8e8, are 1 when at least two of I0, I1, I2 are 1.'
explain: |
  `LC(1,2,0)` holds 0x6666, the XOR of its first two inputs (P0 and P1); `LC(1,2,1)` holds the same table and reads that result and P2, so **P8 = P0 ^ P1 ^ P2**. `LC(2,2,0)` holds 0xE8E8, the majority of its three inputs, and they are P0, P1 and P2, so **P9 = P0 & P1 | P0 & P2 | P1 & P2**. It is the full adder of Chapter 14, made of three logic cells: the sum by two XORs in series, the carry by one LUT, because a LUT has four inputs and a majority needs only three.
bitstream:
  pads: { P0: in, P1: in, P2: in, P8: out, P9: out }
  cells:
    - { at: [1, 2, 0], lut: "I0 ^ I1" }
    - { at: [1, 2, 1], lut: "I0 ^ I1" }
    - { at: [2, 2, 0], lut: "I0 & I1 | I0 & I2 | I1 & I2" }
  routes:
    - [P0, "LC(1,2,0).I0"]
    - [P1, "LC(1,2,0).I1"]
    - ["LC(1,2,0)", "LC(1,2,1).I0"]
    - [P2, "LC(1,2,1).I1"]
    - ["LC(1,2,1)", P8]
    - [P0, "LC(2,2,0).I0"]
    - [P1, "LC(2,2,0).I1"]
    - [P2, "LC(2,2,0).I2"]
    - ["LC(2,2,0)", P9]
inputs: [P0, P1, P2]
outputs: [P8, P9]
answers: [expression, table, dcl]
solution: |
  P8 = P0 ^ P1 ^ P2
  P9 = P0 & P1 | P0 & P2 | P1 & P2
```

## What’s next

You have followed a design the whole way, from a netlist through a graph of ANDs, LUTs, tiles, a placement, a routing and a timing report to about a hundred bits that a chip runs. Every step was one of a few classic algorithms, the same on the 32-bit ALU as on the counter, only slower. Chapter 31 uses all of it at once. It puts the Octet processor you built onto the vFPGA-M, and an RV32I core, a real instruction set that real compilers target, onto the vFPGA-L; it runs programs on the configured fabric through the virtual board; and it sends the same designs to a real iCE40, where the LEDs blink and the UART prints.
