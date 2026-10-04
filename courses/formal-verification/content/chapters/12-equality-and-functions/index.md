---
number: 12
title: Equality and functions
summary: 'The first theory: equality with uninterpreted functions. First-order formulas in brief, functions known only to be functions, congruence closure on an e-graph, and DPLL(T), the conversation between a SAT solver and a theory solver that every SMT solver is built on.'
duration: About 1 hour 15 minutes
---

A verification condition for a real program does not stay Boolean for long. It says things like *if i = j then a[i] = a[j]*, *hash(k) = hash(k′) whenever k = k′*, *x + 1 > x*. Part II's solver sees each of these atoms as an opaque Boolean variable, and would happily make *i = j* true and *a[i] = a[j]* false. The atoms have meanings, and a solver must respect them. **Satisfiability modulo theories** (SMT) is satisfiability where the meaning of some symbols is fixed by a *theory*: equality, arithmetic, arrays, bit-vectors.

This chapter introduces the simplest theory and the architecture that every SMT solver uses to combine a theory with a SAT solver.

## First-order formulas in brief

Propositional logic has variables that are true or false. First-order logic adds **terms**, which denote objects: variables such as x, constants such as 0, and applications of **function symbols** such as f(x) or hash(key, 3). Atoms compare terms (x = f(y), x < 3) or apply predicates (sorted(a)), and formulas combine atoms with the connectives and with quantifiers ∀ and ∃. Appendix A has the details; this chapter needs only quantifier-free formulas.

A formula is satisfiable when some **interpretation** makes it true: a domain of objects, a value for each variable, and a function on the domain for each function symbol. A **theory** restricts the interpretations allowed. In the theory of integer arithmetic, + must be addition; in the theory of arrays, reading a cell you just wrote must return what you wrote. The question an SMT solver answers is: is this formula true in some interpretation that the theory allows?

## Functions you know nothing about

The weakest useful theory says almost nothing: a function symbol f stands for *some* function, any function. The only thing you may assume is what being a function means:

$$
x = y \;\implies\; f(x) = f(y)
$$

This is **equality with uninterpreted functions** (EUF). It sounds too weak to be useful, and it is the opposite: it lets a verifier ignore what an operation does when the argument does not depend on it. A hash function, a cryptographic primitive, a floating-point operation, a system call: if a program computes hash(k) twice with the same k and the proof only needs the two results to be equal, there is no need to know anything about hashing.

In Vouch, a pure function without a body is uninterpreted:

```vouch
pure fn hash(x: int) -> int          // some function from int to int; nothing else is known

fn twice(x: int) -> int
  ensures result == hash(hash(x))
{
  let t = hash(x)
  return hash(t)
}
```

The verifier proves `twice` without knowing anything about `hash`. If a proof fails, the counterexample includes the solver's choice of function: *hash(0) = 2, hash(1) = 0*, enough to replay the failing run.

```quiz
q: 'With hash uninterpreted, which of these can the verifier prove?'
options:
  - text: hash(x) == hash(y) ==> x == y
    why: 'That says hash is injective, which a function need not be: hash(0) = hash(1) = 7 is a perfectly good interpretation. The solver finds it.'
  - text: x == y ==> hash(x) + 1 == hash(y) + 1
    correct: true
    why: 'Equal arguments give equal results (congruence), and adding 1 to equal numbers gives equal numbers. Nothing about hash itself is needed.'
  - text: hash(x) != x
    why: 'An interpretation in which hash is the identity makes this false. Uninterpreted means every function is allowed, including that one.'
```

## Congruence closure

How does a solver decide a conjunction of equalities and disequalities between terms? Put every term in a graph, and maintain **classes** of terms known to be equal, with a union–find structure. Each asserted equality s = t merges the classes of s and t. Then apply **congruence**: whenever two applications f(s₁, …, sₙ) and f(t₁, …, tₙ) have their arguments pairwise in the same classes, merge them too, and repeat until nothing changes. The conjunction is satisfiable exactly when no asserted disequality s ≠ t ends with s and t in one class. This is **congruence closure**, the algorithm of Nelson and Oppen and of Downey, Sethi and Tarjan, both published in 1980.:cite[nelson1980,downey1980] The data structure is called an **e-graph**.

Below is the classic example. The disequality f(a) ≠ a holds from the start. Assert the two equalities, one after the other, and watch congruence do the work.

```predict
q: 'f(f(f(a))) = a and f(f(f(f(f(a))))) = a. Can f(a) ≠ a also hold?'
options:
  - text: Yes. The equalities only constrain f³ and f⁵, not f.
    why: 'Congruence propagates: from f³(a) = a, apply f twice to get f⁵(a) = f²(a), so f²(a) = a; then f³(a) = f(a), so f(a) = a.'
  - text: No. The two equalities force f(a) = a.
    correct: true
    why: 'f⁵(a) = f²(f³(a)) = f²(a) by congruence, so f²(a) = a; then f(a) = f(f²(a)) = f³(a) = a. Assert them below and watch the classes merge.'
```

::e-graph{equalities='["f(f(f(a))) = a", "f(f(f(f(f(a))))) = a"]' disequalities='["f(a) != a"]' caption="The e-graph sandbox. Click an equality to assert it; congruence merges are listed in blue. The conflict's explanation names the assertions that were needed."}

The explanation matters as much as the verdict. When the e-graph finds a conflict, it can say *which* asserted literals forced it, by following the merges back (Nieuwenhuis and Oliveras's proof forest).:cite[nieuwenhuis2007] A short explanation becomes a short learned clause in the next section, and it is also a certificate: the course's checker re-derives the equality chain from the listed literals alone.

::e-graph{equalities='["a = b", "f(b) = c", "b = c", "g(a, c) = d"]' disequalities='["g(b, f(a)) != d", "f(c) != a"]' caption="A second e-graph. Which disequality breaks first depends on the order you assert the equalities in; the explanation never uses more than it needs."}

## DPLL(T): a conversation

Real verification conditions are not conjunctions: they have disjunctions, implications, case splits. The SAT solver of chapter 7 is very good at Boolean structure and knows nothing about equality; congruence closure knows equality and nothing about disjunctions. **DPLL(T)** makes them talk.:cite[nieuwenhuis2006]

- The SAT solver treats each atom (s = t) as a Boolean variable and searches as usual: it decides, propagates and backtracks.
- After each round of propagation, it shows the **theory solver** the atoms it has made true and false.
- The theory solver answers *consistent*, or *conflict* with an explanation: a subset of those literals that cannot hold together.
- The SAT solver adds the negation of the explanation as a clause, a **theory lemma**, and handles it like any conflict: analyse, learn, backjump.

Here is the conversation on a small formula. The atoms are g(a) = c, f(g(a)) = f(c), g(a) = d and c = d.

::dpllt-conversation{clauses='["g(a) = c", "f(g(a)) != f(c) | g(a) = d", "c != d"]' caption="The DPLL(T) conversation. Left: the clauses, with theory lemmas added as they are learned. Middle: who says what. Right: the e-graph of the SAT solver's current choices. The clauses are editable: one per line, literals separated by |."}

The SAT solver never learns anything about equality in general. It learns specific facts, one lemma at a time, and only the ones its search runs into: here, that g(a) = c forces f(g(a)) = f(c). Production solvers add one more move, **theory propagation**: when the e-graph already implies an atom (f(g(a)) = f(c) as soon as g(a) = c is chosen), the theory tells the SAT solver at once instead of waiting for it to guess wrong. The course's solver (`src/lib/fv/smt/solver.ts`) does this, and runs the same conversation with arithmetic, arrays and bit-vectors in chapters 13 and 14.

```quiz
q: 'Why does the theory return an explanation (a few literals) rather than just saying "conflict"?'
options:
  - text: The explanation is only shown to the user.
    why: 'It is the input to learning. Without it, the SAT solver could only learn "not this whole assignment", a clause as long as the trail, that would never apply again.'
  - text: The negated explanation is the learned clause; the shorter it is, the more of the search space it rules out.
    correct: true
    why: 'A lemma with two literals, ¬(g(a) = c) ∨ f(g(a)) = f(c), prunes every branch that contains g(a) = c and f(g(a)) ≠ f(c), whatever else was chosen. Good explanations are what make DPLL(T) fast.'
  - text: The SAT solver needs it to decide which variable to choose next.
    why: 'Decisions come from the SAT solver''s own heuristic. The explanation feeds conflict analysis.'
```

## The eager alternative: Ackermann's reduction

There is another way to use a SAT solver for EUF, older and simpler: get rid of the functions first. Replace each application f(t) by a fresh variable vₜ, and for every pair of applications of the same function add the constraint that equal arguments give equal results:

$$
s = t \;\implies\; v_s = v_t
$$

What is left is equality between variables, which a SAT encoding can handle directly. This is **Ackermann's reduction**, from his 1954 book on decidable cases of the decision problem.:cite[ackermann1954] It is *eager* (all the constraints are generated up front, quadratically many in the number of applications) where DPLL(T) is *lazy* (lemmas are generated only when the search needs them). The course's bit-vector solver uses the eager version for functions over bit-vectors (chapter 14).

## Exercise: an optimisation, proved

Compilers and programmers both rewrite code to call expensive functions less often. With the functions uninterpreted, the verifier checks that the rewrite computes the same thing *whatever the functions do*: the proof survives any change to the hash function.

```verify
id: equality-and-functions/cse
title: Call the hash function less often
prompt: |
  `fast_tag` must compute the same tag as the specification `tag`, calling `hash` as few times as possible. The version below calls `hash(key)` once, but it is wrong in one case. Fix it without calling `tag`. The counterexample shows the solver's choice of `hash` and `combine`.
starter: |
  // An expensive hash and a way to combine hashes, known only as functions.
  pure fn hash(x: int) -> int
  pure fn combine(a: int, b: int) -> int

  // The specification: the tag of a record with a key, a value and an optional link.
  pure fn tag(key: int, value: int, linked: bool, other: int) -> int {
    if linked {
      combine(combine(hash(key), hash(value)), combine(hash(key), hash(other)))
    } else {
      combine(combine(hash(key), hash(value)), combine(hash(key), hash(key)))
    }
  }

  fn fast_tag(key: int, value: int, linked: bool, other: int) -> int
    ensures result == tag(key, value, linked, other)
  {
    let hk = hash(key)
    let left = combine(hk, hash(value))
    let right = combine(hk, hash(other))
    return combine(left, right)
  }
locked: [[1, 15]]
forbid: ['return tag(']
solution: |
  {
    let hk = hash(key)
    let left = combine(hk, hash(value))
    let second = if linked { hash(other) } else { hk }
    return combine(left, combine(hk, second))
  }
hints:
  - Read the counterexample's inputs. Which branch of `tag` do they take?
  - When `linked` is false, the second half combines `hash(key)` with itself.
success: 'The proof uses only congruence: equal arguments give equal results. It holds for every function `hash` and every function `combine`, so it survives any change to either.'
lines: 22
```

:::history
**Decision procedures for program verification.** Congruence closure was published twice in 1980: by Nelson and Oppen, who were building decision procedures for program verification at Stanford, and by Downey, Sethi and Tarjan, who studied it as a problem about common subexpressions.:cite[nelson1980,downey1980] The idea that a theory solver should *explain* its conflicts so that a SAT solver can learn from them is what turned these procedures into modern SMT solvers, and the explanation algorithm in this chapter is Nieuwenhuis and Oliveras's.:cite[nieuwenhuis2007,nieuwenhuis2006]
:::

:::hood
**The course's EUF solver.** `src/lib/fv/smt/euf.ts` is about 200 lines: a union–find with member lists, a signature table for congruence (two applications with the same symbol and the same argument classes), use lists so that a merge revisits only the applications of the merged class, and a proof forest for explanations. After the SAT solver backtracks, the closure is rebuilt from the literals that remain: simpler than undoing merges, and fast enough for the course's problems. Each theory lemma carries the literals of its explanation, and the certificate checker (`src/lib/fv/smt/check/certificate.ts`) recomputes the closure from those literals alone.
:::

:::proved
**What did we prove?** An *unsatisfiable* answer from DPLL(T) over EUF is certified twice: the Boolean part by a DRAT proof, and each theory lemma by re-running congruence closure on its literals in the trusted checker. A proof about a program with uninterpreted functions holds for **every** interpretation of those functions, which is stronger than a proof about one implementation, and weaker than knowing what the functions actually do.
:::

## What comes next

Equality is the hub that every other theory connects to. [Chapter 13](/chapters/arithmetic/) adds arithmetic: a theory solver based on the simplex method, certificates made of a few rational numbers, and the precise point where a solver has to answer *unknown*.

## Further reading

- Nelson and Oppen's 1980 paper is four pages on congruence closure, and still the clearest introduction.:cite[nelson1980]
- Nieuwenhuis, Oliveras and Tinelli's DPLL(T) paper presents the whole architecture as a set of rules.:cite[nieuwenhuis2006]
