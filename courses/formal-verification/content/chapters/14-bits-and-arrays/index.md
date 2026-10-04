---
number: 14
title: Bits and arrays
summary: 'The theories that model machines. Fixed-width integers that wrap around, decided by bit-blasting them into circuits; a court for compiler peephole rewrites in the spirit of Alive; arrays and the read-over-write axioms; and cloud access policies turned into satisfiability questions.'
duration: About 1 hour 30 minutes
---

Chapter 13's integers never overflow. A machine's do. A 32-bit register holds one of 2³² values, and adding 1 to the largest gives 0. Most of the bugs that verification is asked to rule out live in this gap between the integers of mathematics and the integers of a machine: overflows, sign confusions, shifts by too much. This chapter adds the theory that models machine words exactly, and the theory of arrays that models memory.

## Fixed-width integers

A **bit-vector** of width n is a string of n bits. Arithmetic on bit-vectors wraps around: it is arithmetic modulo 2ⁿ. The same bits have two readings. Read as **unsigned**, 1111 1111 is 255. Read as **two's complement**, the top bit counts as −128, so the same bits mean −1. Addition, subtraction and multiplication give the same bits under both readings, which is why processors have one add instruction. Division, remainder, right shift and comparison do not: 1111 1111 > 0000 0001 is true unsigned and false signed. So every operation where the reading matters exists in two versions.

:::bridge{course=digital-circuits chapter=arithmetic}
*Digital Circuits* builds binary numbers, two's complement and the adder from gates. This chapter uses those adders as formulas: a bit-vector solver is a circuit builder followed by a SAT solver.
:::

Vouch has both kinds of fixed-width integer. Machine integers (`u32`, `i64`) behave like integers that must stay in range: every operation in executable code that could leave the range is a proof obligation. Bit-vectors (`bv32`) wrap silently, as the hardware does. Contracts use mathematical arithmetic in both cases, so a specification can say what a computation *should* produce.

:::workbench{title="Averages" minLines=14}
```vouch
// Machine integers: the sum can overflow before the division.
fn average(a: u32, b: u32) -> u32
  ensures result == (a + b) / 2
{
  return (a + b) / 2
}

// Bit-vectors wrap. This classic trick never overflows: the shared bits, plus half the differing ones.
fn average_bits(a: bv32, b: bv32) -> bv32
  ensures result as bv33 == ((a as bv33) + (b as bv33)) >> 1
{
  return (a & b) + ((a ^ b) >> 1)
}
```
:::

The first function fails with a counterexample: a = 4,294,967,295 and b = 1, whose sum does not fit in 32 bits. The second is proved: its specification computes the average exactly in 33 bits, where the sum cannot wrap, and the solver checks that the 32-bit trick agrees for all 2⁶⁴ pairs of inputs. Change the body of `average_bits` to `(a + b) >> 1` and the counterexample shows two large numbers whose sum wraps.

## Bit-blasting

A bit-vector solver usually works by **bit-blasting**: every bit of every value becomes a propositional variable, and every operation becomes a circuit. An *and* of two 32-bit words is 32 *and* gates. Addition is a ripple-carry adder, a chain of full adders that pass the carry from each bit to the next. Multiplication is shift-and-add: one adder per bit of the multiplier. Division is not built as a divider at all: the solver introduces a quotient q and a remainder r and asserts *a = q·b + r* with *r < b*, which costs a multiplier. The circuit then goes to the SAT solver of Part II, through Tseitin's transformation (chapter 6).

The cost depends on the operation. These are the gate counts of the course's bit-blaster for one operation on two variables:

| Operation | 8 bits | 16 bits | 32 bits | 64 bits |
|---|---:|---:|---:|---:|
| `x & y` | 8 | 16 | 32 | 64 |
| `x + y` | 37 | 77 | 157 | 317 |
| `x * y` | 155 | 691 | 2,915 | 11,971 |
| `x /u y` | 472 | 1,720 | 6,520 | 25,336 |

Bitwise operations and addition grow linearly with the width. Multiplication and division grow quadratically, and they are also *hard* for the SAT solver, not just large: a multiplier's carries tangle every input bit with every output bit, and conflict-driven learning finds little structure to exploit. You will meet this in the court below.

## The peephole court

A compiler's **peephole optimiser** replaces small patterns of instructions with cheaper equivalents: multiplying by 2 becomes a left shift, `x ^ -1` becomes `~x`. LLVM's instruction combiner contains hundreds of these rewrites, written by hand in C++, and a wrong one silently miscompiles every program that contains the pattern. In 2015 Nuno Lopes, David Menendez, Santosh Nagarakatte and John Regehr published **Alive**, a small language for writing such rewrites together with a checker that proves them correct with an SMT solver or produces a counterexample. They translated more than 300 of LLVM's rewrites into Alive and found that eight of them were wrong.:cite[lopes2015]

::museum{exhibit=alive-2015}

A rewrite `lhs => rhs` is correct at width n when, for every input where the left side is defined, the right side is defined too and computes the same bits. The words *where the left side is defined* matter. In LLVM, division by zero is **undefined behaviour**: the compiler may assume it never happens, so a rewrite may do anything on those inputs. The same goes for shifting by the width or more, and for dividing the most negative number by −1, whose true answer does not fit. The court below models these three cases. Alive models more: values that are *poison*, and flags such as `nsw` (no signed wrap) that let the compiler assume an addition does not overflow.

The court checks the rewrite at each width with a separate bit-vector query: *is there an input where the precondition holds, the left side is defined, and the right side differs or is undefined?* Unsatisfiable means proved, and the proof's certificate is then checked. Satisfiable means refuted, and the input is replayed with ordinary arithmetic before it is shown.

```predict
q: 'Signed division by 2 and an arithmetic shift right by 1 are both "divide by two". Is x /s 2 => x >>s 1 correct?'
options:
  - text: Yes, at every width.
    why: 'Try x = −1. Signed division truncates towards zero, so −1 /s 2 = 0. The arithmetic shift rounds towards minus infinity: −1 >>s 1 = −1.'
  - text: No, it is wrong for negative odd numbers.
    correct: true
    why: 'Division truncates towards zero; the shift rounds down. They agree on non-negative numbers and on even ones, so the rewrite is correct with the precondition x >=s 0.'
  - text: Only at 8 bits.
    why: 'The difference does not depend on the width: −1 behaves the same way at every width.'
```

::peephole-court{rewrite="x /s 2 => x >>s 1" docket='["x * 2 => x << 1", "x /s 2 => x >>s 1 if x >=s 0", "x + 1 >s x => true", "x %u C => x & (C - 1) if pow2(C)", "x %s C => x & (C - 1) if pow2(C)", "(x | y) - (x & y) => x ^ y", "-x * -y => x * y", "x => x + 1 if x == x + 1"]' caption="The peephole court. Each width is a separate bit-vector query. A refutation shows the inputs in binary, hex and decimal; a proof becomes final when its certificate has been checked. Click a refuted width to see its counterexample."}

Run the docket. Three rulings deserve a second look:

- `x %s C => x & (C - 1) if pow2(C)` replaces a remainder by a mask. It is correct unsigned. Signed, it is wrong: the remainder of −1 by 4 is −1, but the mask gives 3.
- `-x * -y => x * y` is true at every width, since the two negations cancel modulo 2ⁿ. The court proves it at 8 bits and runs out of time beyond: multiplier circuits are hard for SAT solvers, as promised. The verdict is *unknown*, not *refuted*. A human sees the algebra at once; the course's solver only sees bits.
- `x => x + 1 if x == x + 1` is *vacuous*: its precondition never holds, so the proof says nothing. The court flags it rather than stamping it proved. Chapter 9 met the same trap with facts that rule out every world.

:::bridge{course=compiler-backends chapter=peephole}
*SSA to Silicon* builds a peephole optimiser for a compiler back end. Each of its rewrites is a claim of the kind the court checks: the same bits out, for every input where the original was defined.
:::

```rewrite
id: bits-and-arrays/docket
title: The court's docket
exhibit: alive-2015
prompt: |
  Rule on each rewrite. If it is correct at 8, 16 and 32 bits, say so. If it is wrong, say so and repair it with a precondition: the weakest condition you can find under which it is correct. A precondition that never holds is rejected. The syntax is the court's (see *Syntax* in the court above); `SMAX` is the largest signed value.
rewrites:
  - 'x * 3 => (x << 1) + x'
  - 'x + 1 >s x => true'
  - 'x - y <u x => true'
  - '(x ^ y) ^ y => x'
  - 'x %u C => x & (C - 1)'
  - '(x >>u C) << C => x'
widths: [8, 16, 32]
hints:
  - 'For `x + 1 >s x`, which x makes x + 1 wrap around to a negative number?'
  - 'For `x - y <u x`: what if y is 0? What if y is larger than x, so that the subtraction wraps?'
  - 'Shifting right then left clears the low C bits. When are they already clear? The bits of x below position C are `x & ((1 << C) - 1)`.'
success: 'Every precondition you wrote is a fact the compiler must establish before it may apply the rewrite. Alive works the same way: a rewrite comes with its precondition, and the checker proves the pair at each width.'
```

## Arrays

Memory is a function from addresses to values that a program updates one cell at a time. The **theory of arrays** captures exactly that, with two operations: *read*(a, i), the value of array a at index i, and *write*(a, i, v), the array that is like a except that index i now holds v. John McCarthy stated the axioms in 1962, in his program for a mathematical theory of computation:cite[mccarthy1962]

$$
\mathit{read}(\mathit{write}(a, i, v), j) \;=\; \begin{cases} v & \text{if } i = j \\ \mathit{read}(a, j) & \text{otherwise} \end{cases}
$$

This is the **read-over-write** axiom: reading what you just wrote gives back what you wrote, and writing one cell leaves the others alone. A second axiom, **extensionality**, says that two arrays are equal when they agree at every index.

A solver decides arrays the way chapter 12 decided equality, lazily. Array reads are treated as uninterpreted functions of the array and the index. When the SAT solver's choices contradict an axiom, for example by making *read*(*write*(a, i, v), i) ≠ v, the theory adds the instance of read-over-write that rules it out, and the search continues. To refute a disequality between two arrays, the solver names a fresh index where they must differ, and extensionality does the rest. In Vouch, sequences are arrays with a length, and `s[i := v]` is *write*.

:::workbench{title="Read over write" minLines=12}
```vouch
lemma read_after_write(s: [int], i: int, v: int)
  requires 0 <= i < len(s)
  ensures s[i := v][i] == v
{}

// Writing a cell's own value back changes nothing (extensionality).
lemma write_back(s: [int], i: int)
  requires 0 <= i < len(s)
  ensures s[i := s[i]] == s
{}

// Wrong: forgets the case where j is the index that was written.
lemma other_cells(s: [int], i: int, j: int, v: int)
  requires 0 <= i < len(s) && 0 <= j < len(s)
  ensures s[i := v][j] == s[j]
{}
```
:::

The third lemma fails with i = j = 0 and a value that differs from the old one: exactly the first case of the axiom.

```verify
id: bits-and-arrays/swap
title: Swap two cells
prompt: |
  `swap` must exchange the values at indices i and j. The version below writes `a[j]` into cell i, then reads cell i of the *new* array to fill cell j. Find the input the verifier reports, then fix the body. The contract is locked.
starter: |
  fn swap(a: [int], i: int, j: int) -> [int]
    requires 0 <= i < len(a) && 0 <= j < len(a)
    ensures len(result) == len(a)
    ensures result[i] == a[j] && result[j] == a[i]
    ensures forall k :: 0 <= k < len(a) && k != i && k != j ==> result[k] == a[k]
  {
    let b = a[i := a[j]]
    return b[j := b[i]]
  }
locked: [[1, 6]]
solution: |
  {
    let b = a[i := a[j]]
    return b[j := a[i]]
  }
hints:
  - After the first write, what is `b[i]`?
  - Read the old value of cell i from `a`, which the write did not change.
success: 'The proof uses read-over-write for each pair of writes and reads, and the quantified postcondition is proved for an arbitrary k. Arrays are values here: `a` still holds the old contents after `b` is made from it.'
lines: 10
```

## Access policies

Bit-vectors and SMT now run inside cloud services, far from compilers. An access policy for a cloud resource is a list of statements such as *allow reading the logs bucket from the office network*, *deny deleting anything*. When a request arrives, it is allowed if some *allow* statement matches it and no *deny* statement does. The interesting questions about a policy are universal: *can anyone outside the office write to this bucket? Does the new version of the policy allow anything the old one did not?* Testing a few requests answers neither.

**Zelkova**, built at Amazon Web Services and described by Backes and colleagues in 2018, translates policies into SMT formulas over strings, regular expressions, bit-vectors (for IP address ranges) and integers, and answers such questions with an SMT solver. Its authors reported that it was used many millions of times a day, behind services including Amazon S3, AWS Config and Amazon Macie.:cite[backes2018] By 2022, AWS reported generating about a billion SMT queries a day across its services.:cite[rungta2022]

The lab below is a small version of the idea. A request has a user, an action, a resource path, a source IP address and an MFA flag. An address range such as 10.0.0.0/8 is a bit-vector condition, encoded as Zelkova encodes it: mask off the insignificant bits and compare, *ip & 0xff000000 = 0x0a000000*.:cite[backes2018]

::policy-lab{policy='["# The logs bucket.", "allow read on logs/* if ip in 10.0.0.0/8", "allow write on logs/* if user == ingest", "allow * on public/*", "deny delete on *", "deny * on secrets/* if !mfa"]' question="action == write && !(ip in 10.0.0.0/8)" other='["allow read on logs/* if ip in 10.0.0.0/8", "allow write on logs/* if user == ingest", "allow * on public/*", "allow read on secrets/* if ip in 10.1.0.0/16", "deny delete on *"]' caption="The policy lab. A question is a condition on requests; the solver either produces a request that the policy allows and that satisfies the condition, re-checked against the policy, or proves that there is none. Compare checks whether a new version allows anything the old one did not."}

The first answer is a write from outside the office network. It is allowed for the `ingest` user, or for anyone writing under `public/`. Ask more precise questions. Can anyone other than `ingest` write to the logs from outside? Can anything under `secrets/` be read without MFA? Then switch to *Compare*: the new version drops the MFA rule for `secrets/` and adds a statement that allows reading `secrets/` from a smaller network, and the solver finds a request it newly allows. In the original, the deny on `secrets/` without MFA was the only statement that mentioned secrets, so nothing there was allowed at all.

```quiz
q: 'A policy has a single statement: allow read on reports/* if ip in 192.168.0.0/16. A colleague proposes adding: deny * on reports/* if !(ip in 192.168.0.0/16). Does the new version allow less, more, or the same?'
options:
  - text: Less. The deny removes some requests.
    why: 'The deny only matches requests from outside 192.168.0.0/16, which the allow never matched in the first place. Ask the lab to compare both ways.'
  - text: The same. The deny only matches requests the policy already denied.
    correct: true
    why: 'Without an allow, a request is denied by default; the explicit deny changes nothing that was allowed. It may still be worth having as a guard against a broader allow added later, which is a design question the solver cannot answer for you.'
  - text: More, because deny statements are checked first.
    why: 'Order does not matter: a request is allowed only if some allow matches and no deny matches.'
```

:::history
**From hardware to cloud.** Bit-vector decision procedures came from hardware verification, where every value is a word. The theory of arrays goes back to McCarthy's 1962 programme for a mathematical science of computation.:cite[mccarthy1962] Alive (2015) brought SMT checking into the daily work of compiler developers.:cite[lopes2015] Zelkova (2018) brought it to people who never see a formula: it runs behind services that audit cloud configurations, for example to check that resources are not publicly accessible.:cite[backes2018]
:::

:::hood
**The course's bit-vector solver.** `src/lib/fv/smt/bv.ts` bit-blasts each bit-vector term into gates (*and*, *xor* and multiplexers, each defined by Tseitin clauses), memoising shared subterms and gates so that the circuit is a DAG. Constants fold away: `x * 2` blasts to the same bits as `x << 1`, which is why the court proves that rewrite with no search at all. Uninterpreted functions over bit-vectors use Ackermann's reduction (chapter 12). The court (`src/lib/fv/rewrite/peephole.ts`) runs in a Web Worker, one width at a time; its tests compare every verdict with brute force over all inputs at 3 and 4 bits. Arrays are handled in `src/lib/fv/smt/solver.ts` by read-over-write lemmas generated on demand, each justified in the certificate as an instance of the axiom.
:::

:::proved
**What did we prove?** A rewrite proved at 8, 16, 32 and 64 bits is proved at those widths and no others; LLVM also has widths such as 1, 7 and 128. A proof says nothing about poison values or overflow flags, which the court does not model. A policy answer is about the policy as the encoding reads it: if the encoding of the policy language is wrong, the proof is a proof about the wrong thing. The lab's answers are re-checked against its own reference semantics (`decide` in `src/lib/fv/policy/policy.ts`), which catches a wrong example but not a wrong proof; the encoding stays trusted.
:::

## What comes next

Part III's solvers decide formulas. [Chapter 15](/chapters/symbolic-execution/) turns programs into formulas, path by path: symbolic execution, which runs a program on symbolic inputs and asks the solver which paths are feasible. It finds bugs and generates tests, and it shows why loops need an idea that Part IV supplies.

## Further reading

- Lopes, Menendez, Nagarakatte and Regehr's Alive paper shows real wrong rewrites and their counterexamples.:cite[lopes2015]
- Backes and colleagues describe Zelkova's encoding of policies, and how its answers are presented to people who never see a formula.:cite[backes2018]
