---
number: 9
title: Small worlds
summary: Before there is code, there is a design. Describe it as atoms and relations, state what must always be true, and let a SAT solver search every instance up to a small size for a counterexample. Relational logic, multiplicities, transitive closure, the small scope hypothesis, and the trap of a model that rules out everything.
duration: About 1 hour
---

Part I checked systems that move: states, actions, traces. Many design mistakes are not about motion at all. A file system whose directories can contain themselves, an access policy that lets an intern approve a payment through a chain of inherited roles, a schema whose constraints contradict each other: each is a wrong *structure*, visible in a single snapshot. This chapter models structures and asks a SAT solver to find the bad snapshot.

The approach comes from Daniel Jackson's **Alloy**: write a small model of the design as **atoms** and **relations** between them, state the **facts** every snapshot obeys, and ask the tool to *check* a property in every snapshot up to a small size.:cite[jackson2002,jackson2006] If the property fails, you get a picture of the counterexample. If it holds, you have searched every instance of that size, which is far more than any test suite. This chapter is optional: the rest of the course does not depend on it, but chapter 10's "unroll it into one formula" idea appears here first in a static form.

## Atoms and relations

A Vouch `world` declares **types** of atoms (here, directories and files), and **relations** between them.

```vouch
world FileSystem {
  type Dir, File
  rel parent: Dir -> lone Dir
  rel contents: Dir -> set File
  rel root: Dir
}
```

- `rel root: Dir` is a **set** of directories (a unary relation).
- `rel contents: Dir -> set File` relates directories to files; each directory has any number of files.
- `rel parent: Dir -> lone Dir` says each directory has **at most one** parent. The other multiplicities are `one` (exactly one), `some` (at least one) and `set` (any number).

Everything is a relation, and that makes the notation uniform. An atom is a set with one element, and a set is a relation with one column. The operator that does almost all the work is the **join**, written with a dot. If `d` is a directory, `d.parent` is its parent (a set with zero or one element), and `d.parent.parent` its grandparent. Join also works backwards: `f.~contents` is the set of directories that contain file `f` (`~` swaps the columns of a binary relation).

**Transitive closure** follows a relation any number of times: `d.^parent` is every ancestor of `d`, and `d.*parent` the ancestors and `d` itself. Closure is what first-order logic cannot express and what makes relational models expressive enough for real designs: reachability, hierarchies, containment.

Formulas are built from relations with `in` (subset), `==`, `some e` (e is non-empty), `no e` (e is empty), `one e`, `lone e`, the usual connectives, and quantifiers over atoms: `forall d: Dir :: …`.

```quiz
q: 'In the file system, what is `root.~parent`?'
options:
  - text: The parent of the root.
    why: 'That is `root.parent`, which the model will say is empty.'
  - text: The directories whose parent is the root, that is, the root's children.
    correct: true
    why: '`~parent` relates each directory to the directories it is the parent of. Joining the root with it gives its children. `root.^~parent` would give all its descendants.'
  - text: Every directory except the root.
    why: 'Only if the root is every other directory''s parent. `root.^~parent` is the descendants, which in a well-formed file system is every directory except the root.'
```

## Check a property

Add facts, the constraints every instance must satisfy, and a **command**. `check p for 3` searches every instance with at most 3 atoms of each type in which the facts hold and **p fails**. `run p for 3` searches for one in which p holds, which is how you ask "can this happen at all?".

The model below says there is one root, the root has no parent, and every file is in some directory. Is that enough to prevent a directory from being its own ancestor? Run the check.

:::world-lab{title="A file system" maxScope=6}
```vouch
world FileSystem {
  type Dir, File
  rel parent: Dir -> lone Dir
  rel contents: Dir -> set File
  rel root: Dir

  fact one_root: one root
  fact root_has_no_parent: no root.parent
  fact every_file_somewhere: forall f: File :: some { d: Dir | f in d.contents }

  check no_dir_contains_itself: forall d: Dir :: d !in d.^parent for 3
  run deep: exists d: Dir :: some d.parent.parent for 3
}
```
:::

The solver finds a directory that is its own parent, or two directories that are each other's parent, disconnected from the root. Nothing in the facts says that every directory hangs off the root. The missing fact is a reachability constraint, and closure expresses it in one line. Add it to the model above (under the other facts), then run the check again:

```vouch
  fact reachable: forall d: Dir :: d in root.*~parent
```

Every directory is now the root or a descendant of the root. The check finds nothing at scope 3; slide the scope to 5 and it still finds nothing. Use **Another instance** on the `run deep` command to see what the model allows, one instance at a time.

```predict
q: 'With the `reachable` fact added, the check reports no counterexample for scopes 1 to 5. What has been established?'
options:
  - text: No file system satisfying the facts has a directory that is its own ancestor.
    why: 'Only file systems with at most 5 directories and 5 files were searched. In this case the property does hold for every size (a reachability argument proves it), but the tool did not prove that.'
  - text: Every file system with at most 5 directories and at most 5 files that satisfies the facts is free of such cycles.
    correct: true
    why: 'That is exactly what a bounded check establishes: every instance up to the scope, exhaustively. The badge says "checked up to scope 5", not "verified".'
  - text: Nothing, since the solver might have missed an instance.
    why: 'Within the scope the search is exhaustive: the SAT solver answered UNSAT, and its proof was checked. What the result trusts is the translation of the model into SAT.'
```

## The small scope hypothesis

A bounded check covers every instance up to the scope, and nothing beyond it. Jackson's **small scope hypothesis** is the bet that makes this useful: most design flaws have small counterexamples.:cite[jackson2006] A cycle needs one or two directories, not a thousand. An access-control hole needs a user, a couple of roles and a permission. If a property fails at all, it usually fails in a small instance, and a small instance is what a solver can search exhaustively.

Exhaustive is the important word. At scope 3, the file system's relations have 9 + 9 + 3 = 21 Boolean unknowns besides the existence of each atom: two million ways to fill them, for each choice of how many atoms exist. A tester who hand-wrote a hundred file systems would cover a vanishing fraction of them. The solver covers them all, in milliseconds, because it never enumerates them: it reasons about the clauses.

Press **Sweep the scope** in the lab above to see the price. The SAT problem grows with the scope, polynomially in the number of atoms for a fixed model (each relation of arity k has n^k unknowns) but steeply, and the time grows with it. Scopes of 4 to 6 are typical in practice: big enough to catch most design flaws, small enough to answer in seconds.

## Translating relations to SAT

How does a relational formula become a SAT problem? The translation, developed for Alloy's engine Kodkod by Torlak and Jackson, is surprisingly direct.:cite[torlak2007]

- Each relation becomes a **matrix of Booleans**, one per tuple of atoms: `parent` at scope 3 is a 3 × 3 grid of unknowns, where entry (i, j) means "directory j is the parent of directory i".
- Each relational expression becomes a matrix of **formulas** over those unknowns. Union is entrywise OR, intersection entrywise AND, `~` transposes, and **join is matrix multiplication** with AND for times and OR for plus: (r.s)(i, k) = OR over j of r(i, j) AND s(j, k).
- **Closure** is repeated squaring: r, then r + r.r, then that plus its own square, until the paths are as long as the number of atoms.
- Formulas become propositional formulas: `some e` is the OR of e's entries, `e in f` an implication per entry, and a quantifier over a type is a conjunction (or disjunction) over its atoms.
- Tseitin's transformation from chapter 6 turns the result into clauses.

The course's encoder (`src/lib/fv/relational/encode.ts`) does this, plus one thing a scope needs: each atom has an "exists" Boolean, so that "at most 3 directories" includes the instances with 0, 1 or 2.

:::hood
**Sharing matters.** Join and closure build formulas that reuse the same subformulas many times: every entry of r.r.r uses entries of r.r. The first version of the course's encoder forgot that, and Tseitin's transformation gave every *use* of a shared subformula its own variable. On the access-control model below, at scope 5, the CNF had 1.8 million clauses. Giving each shared subformula one variable brought it down to about twelve thousand, with the same answers. Kodkod goes further: it detects symmetric instances (renaming atoms gives an equivalent instance) and adds clauses that rule out all but one of each family, which the course's encoder does not do. That is why **Another instance** sometimes shows an instance that differs from an earlier one only in the names of the atoms.
:::

## A policy with a hole

Access control is a structure: users have roles, roles inherit other roles, roles grant permissions. The policy below lets only admin roles grant the permission to approve payments, and it forbids giving an intern an admin role. Check whether an intern can approve.

:::world-lab{title="Roles and permissions" maxScope=5}
```vouch
world Access {
  type User, Role, Perm
  rel has: User -> set Role
  rel inherits: Role -> set Role
  rel grants: Role -> set Perm
  rel intern: User
  rel admin: Role
  rel approve: Perm

  fact one_approve: one approve
  fact only_admins_grant_approval: forall r: Role :: approve in r.grants ==> r in admin
  fact interns_are_not_admins: forall u: User :: u in intern ==> no (u.has & admin)

  pred can(u: User, p: Perm) {
    p in u.has.*inherits.grants
  }

  check intern_cannot_approve: forall u: User :: u in intern ==> !can(u, approve) for 3
  run someone_can_approve: exists u: User :: can(u, approve) for 3
}
```
:::

The counterexample needs one intern and two roles: the intern has an ordinary role, and that role *inherits* an admin role. The fact forbade the direct path and forgot the indirect one, exactly the kind of mistake a reviewer misses, because the rule reads correctly.

```verify
id: small-worlds/policy
title: Close the hole without closing the system
prompt: |
  Add one fact so that `intern_cannot_approve` holds up to scope 4. The commands are locked, and two `run` commands must still find instances: someone can approve, and interns can still do *something*.
starter: |
  world Access {
    type User, Role, Perm
    rel has: User -> set Role
    rel inherits: Role -> set Role
    rel grants: Role -> set Perm
    rel intern: User
    rel admin: Role
    rel approve: Perm

    pred can(u: User, p: Perm) {
      p in u.has.*inherits.grants
    }

    check intern_cannot_approve: forall u: User :: u in intern ==> !can(u, approve) for 4
    run someone_can_approve: exists u: User :: can(u, approve) for 3
    run interns_still_work: exists u: User :: u in intern && some u.has.*inherits.grants for 3

    fact one_approve: one approve
    fact only_admins_grant_approval: forall r: Role :: approve in r.grants ==> r in admin
    fact interns_are_not_admins: forall u: User :: u in intern ==> no (u.has & admin)
  }
locked: [[1, 16]]
solution: |
  fact interns_never_reach_admin: forall u: User :: u in intern ==> no (u.has.*inherits & admin)
hints:
  - The counterexample's intern does not have an admin role. Where does the admin role come from?
  - '`u.has.*inherits` is every role u has, directly or by inheritance.'
success: 'No intern reaches an admin role, directly or through inheritance, in any instance with up to 4 users, roles and permissions, and the two `run` commands show that the policy still lets people work. A fact like `no intern` would also have made the check pass, and the third command is there to catch it.'
lines: 22
```

## The model that proves everything

A bounded check can fail in a way that looks like success. If the facts contradict each other, there are no instances at all, and then every `check` passes: there is no instance in which the property fails, because there is no instance. This is **vacuity**, and it is the most common mistake in formal models of any kind.

The model below adds a fact that sounds harmless: every directory has a parent (so that nothing is lost). Run its check, then its `run` command.

:::world-lab{title="Too many facts" maxScope=4}
```vouch
world Vacuous {
  type Dir
  rel parent: Dir -> lone Dir
  rel root: Dir

  fact one_root: one root
  fact root_has_no_parent: no root.parent
  fact nothing_is_lost: forall d: Dir :: some d.parent

  check no_dir_contains_itself: forall d: Dir :: d !in d.^parent for 4
  run anything: true for 4
}
```
:::

The check passes, and the `run` explains why: no instance exists. The root must have no parent, and every directory, the root included, must have one. The defence is a habit: for every model, `run` a command that should have instances, and look at them. Chapter 16 meets the same trap in program specifications (a precondition that nothing satisfies), and Chapter 29 lists it among the ways verified systems fail.

:::history
**Alloy and the Chord ring.** Jackson and his group at MIT designed Alloy as a lightweight formal method: a small language, a fully automatic analyser and a bet on small scopes. The language paper appeared in 2002.:cite[jackson2002] Kodkod, Torlak and Jackson's relational model finder, is the engine of today's Alloy Analyzer.:cite[torlak2007] In 2012 Pamela Zave modelled the ring-maintenance protocol of Chord, a widely cited peer-to-peer lookup protocol with published correctness claims, and showed with the Alloy Analyzer that no published version of the protocol was correct under its own assumptions, and that none of its seven claimed invariants was actually an invariant.:cite[zave2012] She later published a corrected version, with a proof.:cite[zave2017]
:::

:::industry
**Where small-scope analysis is used.** Alloy is used to analyse designs of protocols, security policies, file systems and software architectures, and it is widely taught. The same idea, bounded exhaustive search over small structures, appears in test generators that produce every small input of a data structure, and in database tools that look for small instances violating schema constraints. Chapter 14's access-policy question shows the industrial version of this chapter's second example, with an SMT solver instead of a bounded search.
:::

:::proved
**What did we prove?** "Checked up to scope n" means: among all instances with at most n atoms of each type that satisfy the facts, none violates the property. The SAT solver's *unsatisfiable* is checked by the DRAT checker; the translation from relations to clauses is trusted. A counterexample is re-checked by the reference interpreter, which evaluates every fact and the property on it. Nothing is claimed about larger instances, and if the facts are contradictory the result is vacuous, which only a `run` command reveals.
:::

## What comes next

Worlds are snapshots. [Chapter 10](/chapters/unrolling-time/) puts time back: it unrolls a system's transitions k steps into one big formula, and asks a SAT solver for a run that reaches a bad state, the bounded version of Part I's explorer.

## Further reading

- Jackson's *Software Abstractions* is the book on Alloy, and on modelling designs before building them.:cite[jackson2006]
- Zave's paper on Chord is a model of how to find bugs in a published protocol, and how to explain them.:cite[zave2012]
- Torlak and Jackson's Kodkod paper describes the translation of relations to SAT in detail.:cite[torlak2007]
