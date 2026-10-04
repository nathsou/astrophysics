---
number: 16
title: Specifications and contracts
summary: 'Before a program can be proved correct, someone has to say what correct means. Preconditions and postconditions, old values, modular verification (callers see only contracts), contracts you can run before you can prove them, partial and total correctness, and the hardest part: a specification that says enough. A bank of wrong implementations hunts for the holes in yours.'
duration: About 1 hour 15 minutes
---

Every chapter so far has checked a property someone else wrote down: a state the system must never reach, a formula, a rewrite. Part IV proves programs, and a program is not correct or incorrect on its own. It is correct *with respect to a specification*. This chapter is about writing that specification, and it comes first for a reason: in practice, it is the hard part.

## Contracts

A **contract** is a specification attached to a function. Vouch's contracts have two main clauses:

- `requires P`, the **precondition**: what the function may assume about its inputs. It is the caller's obligation.
- `ensures Q`, the **postcondition**: what the function guarantees about its result, provided the precondition held. It is the function's obligation. In a postcondition, `result` is the returned value, and `old(e)` is the value of e when the function was called.

The function and its caller divide the work like the parties to a contract, which is where the name comes from: Bertrand Meyer called the method **design by contract** and built it into the Eiffel language in the 1980s.:cite[meyer1986,meyer1992]

:::workbench{title="Contracts" minLines=16}
```vouch
fn max(a: int, b: int) -> int
  ensures result >= a && result >= b
{
  if a >= b {
    return a
  }
  return b
}

fn pick() -> int
  ensures result == 5
{
  return max(3, 5)
}
```
:::

`max` verifies. `pick` does not, although `max(3, 5)` is obviously 5. The verifier is not being obtuse: it is being **modular**. When it checks `pick`, it does not look inside `max`. It knows only what `max`'s contract promises, a result at least 3 and at least 5, and 6 satisfies that. The counterexample the solver found is not a real run, and the badge says so: *the solver found values for which this check fails, but running the function on them does not fail*.

Add the missing half of the specification to `max`, `ensures result == a || result == b`, and `pick` verifies.

```quiz
q: 'Why do verifiers check calls against contracts instead of looking inside the called function?'
options:
  - text: Because the solver cannot handle function bodies.
    why: 'It can: Part III''s solvers handle the formulas a body produces. The reason is about scale and stability.'
  - text: So that each function is verified once, on its own, and a change inside a function cannot break the proofs of its callers as long as its contract still holds.
    correct: true
    why: 'This is modularity. Verification scales with the number of functions, not with the size of the call tree, and a contract is the interface the proof of every caller relies on. It is also how library functions with no source available can be used.'
  - text: Because a function's body might not terminate.
    why: 'Termination is a separate question, below. Even for functions that clearly terminate, verifiers use the contract.'
```

## Run the contract before you prove it

A contract is code, and it can be executed. Vouch's interpreter checks every precondition, postcondition and assertion at run time, so a function with a contract can be tested long before it can be proved: run it on many inputs and see whether a contract ever fails. This is the **tested** rung of the course's badges, the plain ink stamp. Contracts that are wrong usually fail on the first few random inputs, and fixing them then is cheaper than discovering the problem halfway through a proof.

The proof is the stronger result. Testing checks the inputs it tried; the proof checks all of them. The badge says which you have.

## Partial and total correctness

A postcondition says what holds *if the function returns*. A function that loops forever never returns, so it satisfies every postcondition. Proving the postcondition alone is **partial correctness**. **Total correctness** adds a proof that the function terminates. For loops and recursion, Vouch asks for a `decreases` clause, a measure that gets smaller at each iteration and cannot decrease forever. Without one, the verifier proves partial correctness and lists termination among its assumptions:

:::workbench{title="Partial correctness" minLines=10}
```vouch
fn countdown(n: int) -> int
  ensures result == 0
{
  var k = n
  while k != 0 {
    k = k - 1
  }
  return k
}
```
:::

The badge says *verified*, and its details list the assumption *the loop without `decreases` terminates*. That assumption is false: for n = −1 the loop runs forever. Partial correctness is honest about what it proves, but you have to read the assumptions. Chapter 18 proves termination.

## The hard part: saying enough

A specification can be wrong in two directions. Too strong, and the correct program fails to verify against it. Too weak, and wrong programs verify too. The second is the dangerous one, because the verifier cannot notice it: it proves what you asked for.

The exercise below makes the danger concrete. You write the specification of `max`. The correct implementation must verify against it. Then a bank of wrong implementations, the **spec adversary**, is checked against your specification too. Any wrong implementation that verifies is a hole in what you wrote.

```spec
id: specifications-and-contracts/max
title: Specify max
fn: max
prompt: |
  Write the postcondition of `max`. The implementation is correct; your specification must let it verify and must reject every wrong implementation in the bank.
starter: |
  fn max(a: int, b: int) -> int
    ensures result >= a
  {
    if a >= b {
      return a
    }
    return b
  }
adversaries:
  - name: Always the first argument
    body: |
      {
        return a
      }
    why: 'Returning a satisfies result >= a. Nothing says the result must also be at least b.'
  - name: One more than the maximum
    body: |
      {
        if a >= b {
          return a + 1
        }
        return b + 1
      }
    why: 'A result larger than both arguments satisfies every lower bound. The specification must also say that the result is one of the arguments.'
  - name: The sum
    body: |
      {
        return a + b
      }
    why: 'a + b is at least a whenever b is non-negative, and at least both when both are. A precise specification rules it out for every input.'
solution: |
  fn max(a: int, b: int) -> int
    ensures result >= a && result >= b
    ensures result == a || result == b
  {
    if a >= b {
      return a
    }
    return b
  }
hints:
  - The result must be at least each argument. What else is true of the maximum of two numbers?
success: 'A complete specification of max has two halves: the result bounds both arguments, and it is one of them. Each half alone lets a wrong implementation through.'
lines: 9
```

Sorting is the classic case. "The output is sorted" sounds like the whole specification of a sort. It is not.

```spec
id: specifications-and-contracts/sort
title: Specify sorting
fn: sort3
prompt: |
  `sort3` sorts an array of three integers by swapping neighbours. Its specification says the result is sorted, and it does verify. So does returning an empty array. Strengthen the specification until every wrong implementation fails. `multiset(s)` is the multiset of the elements of s: each value with the number of times it occurs.
starter: |
  fn sort3(a: [int]) -> [int]
    requires len(a) == 3
    ensures forall i, j :: 0 <= i < j < len(result) ==> result[i] <= result[j]
  {
    var b = a
    if b[0] > b[1] { b = b[0 := b[1]][1 := b[0]] }
    if b[1] > b[2] { b = b[1 := b[2]][2 := b[1]] }
    if b[0] > b[1] { b = b[0 := b[1]][1 := b[0]] }
    return b
  }
adversaries:
  - name: The empty array
    body: |
      {
        return []
      }
    why: 'An empty array is sorted: there is no pair of elements out of order. The specification must say how long the result is.'
  - name: Three zeros
    body: |
      {
        return [0, 0, 0]
      }
    why: 'Sorted and the right length, but unrelated to the input. The result must contain the input''s elements.'
  - name: The first element three times
    body: |
      {
        return [a[0], a[0], a[0]]
      }
    why: 'Every element comes from the input, but not every input element appears. "Contains only input elements" is not enough either: the counts must match.'
  - name: Overwrite instead of swap
    body: |
      {
        var b = a
        if b[0] > b[1] { b = b[0 := b[1]] }
        if b[1] > b[2] { b = b[1 := b[2]] }
        if b[0] > b[1] { b = b[0 := b[1]] }
        return b
      }
    why: 'A classic slip: copying the smaller element down without moving the larger one up. The output is sorted and has the right length, but a value has been duplicated and another lost.'
solution: |
  fn sort3(a: [int]) -> [int]
    requires len(a) == 3
    ensures len(result) == len(a)
    ensures forall i, j :: 0 <= i < j < len(result) ==> result[i] <= result[j]
    ensures multiset(result) == multiset(a)
  {
    var b = a
    if b[0] > b[1] { b = b[0 := b[1]][1 := b[0]] }
    if b[1] > b[2] { b = b[1 := b[2]][2 := b[1]] }
    if b[0] > b[1] { b = b[0 := b[1]][1 := b[0]] }
    return b
  }
hints:
  - Check the empty-array adversary first. What does every sort preserve about the length?
  - The result must be a rearrangement of the input. A multiset counts each value, so equal multisets mean the same elements with the same multiplicities.
success: 'Sorted, and a permutation of the input: that is the whole specification of sorting. The permutation half is the one people forget, and it is the half that needs multisets (or an explicit permutation) to state. Chapter 19 proves it for a sort with a loop.'
lines: 12
```

## Vacuity

A specification can also be wrong by being unsatisfiable. If no input satisfies the precondition, every postcondition holds, because there is nothing to check:

:::workbench{title="A vacuous contract" minLines=7}
```vouch
fn answer(x: int) -> int
  requires x > 0 && x < 0
  ensures result == 42
{
  return 7
}
```
:::

Every obligation is proved, and the course's verifier refuses to stamp it *verified*: it checks that some input satisfies the precondition, and says *vacuous* when none does. Chapter 9 met the same trap with facts that ruled out every world, and chapter 14 with a rewrite whose precondition never held. A proof under impossible assumptions is a proof of nothing.

## The Ledger: transfer

The Ledger returns, as code. Balances are 64-bit unsigned integers, and `transfer` moves an amount between two accounts. Its contract says exactly what changes: the source loses the amount, the destination gains it, and every other account keeps its balance (a **frame condition**, which says what does *not* change).

```verify
id: specifications-and-contracts/transfer
title: An overflow-safe transfer
prompt: |
  The verifier finds an input on which `transfer` fails. Read the counterexample, then add the precondition that rules it out. Do not weaken the postconditions: they are locked.
starter: |
  fn transfer(inout bal: [u64], from: int, to: int, amount: u64)
    requires 0 <= from < len(bal) && 0 <= to < len(bal) && from != to
    requires bal[from] >= amount
    ensures len(bal) == len(old(bal))
    ensures bal[from] == old(bal[from]) - amount
    ensures bal[to] == old(bal[to]) + amount
    ensures forall k :: 0 <= k < len(bal) && k != from && k != to ==> bal[k] == old(bal[k])
  {
    bal[from] = bal[from] - amount
    bal[to] = bal[to] + amount
  }
locked: [[4, 11]]
solution: |
  fn transfer(inout bal: [u64], from: int, to: int, amount: u64)
    requires 0 <= from < len(bal) && 0 <= to < len(bal) && from != to
    requires bal[from] >= amount
    requires bal[to] <= 18446744073709551615 - amount
    ensures len(bal) == len(old(bal))
    ensures bal[from] == old(bal[from]) - amount
    ensures bal[to] == old(bal[to]) + amount
    ensures forall k :: 0 <= k < len(bal) && k != from && k != to ==> bal[k] == old(bal[k])
  {
    bal[from] = bal[from] - amount
    bal[to] = bal[to] + amount
  }
hints:
  - The counterexample's destination balance is close to the largest u64 value, 18,446,744,073,709,551,615.
  - Write the condition so that it cannot overflow itself. `bal[to] + amount <= …` overflows in exactly the case you want to exclude; compare `bal[to]` with the maximum minus `amount` instead.
success: 'The precondition moves the responsibility to the caller: whoever calls transfer must show that the destination can hold the money. A real bank would check and return an error instead; either way, the overflow is now a decision someone made, not an accident.'
lines: 12
```

:::history
**Contracts in the language.** The idea that a program carries its own specification is as old as program proving: Floyd and Hoare attached assertions to programs in the 1960s (chapter 17).:cite[floyd1967,hoare1969] Design by contract made assertions part of everyday programming. Meyer described it in a 1986 report and built it into Eiffel, where preconditions, postconditions and class invariants are checked at run time.:cite[meyer1986,meyer1992] Run-time contracts are now found in many languages and libraries, and the verifiers of *How we got here (Part IV)* prove the same annotations statically.
:::

:::hood
**What the verifier does with a contract.** The verification-condition generator (`src/lib/fv/vouch/vc/gen.ts`) executes the body symbolically, assuming the precondition, and turns every check on the way into an obligation: the postcondition at each return, and also each array index, division and machine-integer operation. At a call, it checks the callee's precondition, forgets what the callee may modify, and assumes the callee's postcondition. The interpreter (`src/lib/fv/vouch/interp/`) checks the same contracts at run time; the two must agree, and every counterexample the solver produces is replayed by the interpreter before it is shown as a bug.
:::

:::proved
**What did we prove?** A verified contract says: for every input satisfying the precondition, the function, if it returns, returns a result satisfying the postcondition, and no check along the way fails. The *if it returns* goes away with a termination proof. The rest depends on the specification: the proof is exactly as useful as what the contract says. Nobody can verify that a specification says what you meant. The spec adversary can only test it against wrong programs someone thought of.
:::

## What comes next

How does the verifier get from a contract and a body to formulas? [Chapter 17](/chapters/weakest-preconditions/) shows the machinery: Hoare triples, the rules for each statement, and the weakest precondition, which computes exactly what must hold before a program for a postcondition to hold after it.

## Further reading

- Meyer's 1992 article in *IEEE Computer* is the standard introduction to design by contract.:cite[meyer1992]
