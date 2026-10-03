# Course plan: *For All Inputs*

The working plan for the course: decisions, through-lines, curriculum, interactive components, toolchain and
milestones. Update it when a decision changes or a chapter lands.

The course teaches formal verification to software engineers. It covers how to state what a program or
system must do, how to make a machine check that it does so for every input, every interleaving, every
message order and every attacker, and how to read what such a check actually guarantees. Four families of
technique are covered: exhaustive state exploration, SAT and SMT solving, deductive proof with invariants, and
abstract interpretation. For each one the reader first uses the tool and then opens it up. Everything on
screen runs on a toolchain written for the course: a SAT solver, an SMT solver, a model checker, a program
verifier and an abstract interpreter, all in TypeScript in the browser. Every answer the toolchain gives
comes with a certificate that a small trusted checker re-checks.

## 1. Positioning

The collection already has four neighbours that touch logic and proof. This course must not repeat them:

| Course | Question it answers |
|---|---|
| `courses/cic`: *The Calculus of Inductive Constructions* | How does a proof checker decide that a proof is correct? |
| `courses/proofs-are-programs`: *Proofs Are Programs* | How do I write functional programs and their proofs together in dependent type theory? |
| `courses/proofs`: *Proofcraft* | How do mathematicians find and write proofs on paper? |
| `courses/incompleteness`: *Incompleteness and Computability* | What can formal systems not do? |
| **`courses/formal-verification`: *For All Inputs*** | **How do engineers get machines to check that real software and systems are correct, how do those machines work, and what does a "verified" result really guarantee?** |

How it differs from its neighbours:

- **Automated, not interactive.** The reader writes specifications, invariants and models. Solvers and model
  checkers do the proving. Interactive theorem proving is left to *Proofs Are Programs*, which this course
  links to wherever an automatic tool gives up and a human-guided proof would take over.
- **Imperative, concurrent and distributed.** The subjects are loops, arrays, pointers, threads, messages
  and attackers. Pure functions are not the main subject.
- **The tools are opened up.** The reader steps through CDCL, DPLL(T), weakest preconditions, IC3 and widening
  until a verifier's success, failure or *unknown* can be predicted.

**Reader.** A software engineer who writes and tests code professionally. They know `if` conditions, unit
tests, perhaps property-based testing and perhaps threads. No logic beyond Boolean expressions is assumed,
no discrete maths beyond "induction, seen once", and no prior formal methods. Logic is taught as it is needed,
with a primer in appendix A.

**What this course is not.** It is not a Lean, Coq or Isabelle course (*Proofs Are Programs* and the CIC course
cover that), not a mathematical logic textbook (*Incompleteness*), and not a survey that names forty tools
without running any. It is also not a course in one industrial tool: Dafny, TLA+, Alloy, CBMC and Infer
appear in *In industry* callouts and in the Rosetta appendix, and none of them runs in the browser.

## 2. Decisions (agreed 2026-10-03)

| Topic | Decision | Notes |
|---|---|---|
| Title | **For All Inputs**, subtitled *formal verification from SAT solvers to verified systems* | Slug `formal-verification`, published at `/formal-verification/`. The title states the course's first idea: a test checks some inputs and a verifier checks all of them. The prologue widens "inputs" to include the scheduler, the network and the attacker. Alternatives considered: *Every Execution*, *Beyond Testing*. |
| Aim | Specify and verify programs and systems with the four main families of technique, understand each engine well enough to predict when it fails, and know what a result guarantees | The aim has three parts: use the tool, open the tool, audit the result. |
| Order | **The tools' dependencies decide the order. Each part answers one question: how do you check more cases than you can test?** | Explore every state, then encode states in bits (SAT), then add theories (SMT), then generalise with invariants (programs, then systems), then approximate (abstract interpretation), then audit the trust. Each engine is explained before or in the chapter where it is first used. The only exception is the prologue, which is a trailer for the whole course. |
| One language | **Vouch** (working name): a small verification-aware language with Rust/TypeScript-like syntax, no semicolons and strict types. It has three top-level forms: `fn` and `lemma` for contract-annotated programs, `system` for state machines and concurrent or distributed models, and `world` for bounded relational models | All the engines share one expression language, one type checker and one editor mode, so the reader learns one notation. The full specification goes in `docs/VOUCH.md` (milestone M0). See §6. |
| Integers | `int` is a mathematical integer. `i8`…`i64` and `u8`…`u64` are bounded, and overflow is a proof obligation. `bv8`…`bv64` are wrapping bit-vectors | The binary search bug in the prologue needs bounded integers. The peephole chapter needs bit-vectors. |
| Toolchain | **Our own engines in TypeScript**, in Web Workers, with no third-party solver in the browser | SAT (CDCL), SMT (DPLL(T) with EUF, LRA, LIA, bit-vectors, arrays and quantifiers), explicit-state model checking with LTL, BMC, k-induction, IC3, BDDs, symbolic execution, a VC generator, symbolic heaps and abstract interpretation. Z3 runs only in tests, as a differential oracle (see §10). This follows the collection's convention (kiln, the DCL toolchain, `hep`). |
| Trust | **Every answer carries a certificate that a small trusted checker re-checks** | A SAT model is evaluated. An UNSAT answer is checked by a RUP/DRAT checker, plus one certificate per theory lemma (Farkas coefficients, congruence chains, axiom instances). Counterexample traces are replayed by the reference interpreter. "Safe" results from the symbolic engines produce an inductive invariant, which is re-checked. Invariants from the abstract interpreter are re-checked by the verifier. The trusted computing base is shown on screen (§5, *TCB meter*). |
| Honest results | Each result says exactly what was established, through one shared set of **result badges** | Badges: *tested on n inputs*, *bounded to depth k*, *exhaustive for this instance*, *verified, given these assumptions*, *violated, with the counterexample replayed*, *unknown, with the reason*. This applies the collection's rule that feedback must say what was established. |
| Reader's work | The reader **writes Vouch**: specifications, invariants, models, properties and encodings. They open the tools by **driving the engines' steppers**: choosing the decision, picking the conflict cut, choosing the pivot, applying the widening. They never write engine code | There is no TypeScript code-along track (decided 2026-10-03). *Under the hood* boxes quote the real engine code instead. |
| Real bugs | **The bug museum**: each part re-enacts famous failures in the reader's own tools | See §3, through-line 4. Re-enactments are simplified models and are labelled as such. Every historical claim is cited. |
| Site | SvelteKit 2 + Svelte 5, `adapter-static`, TypeScript 6, and the Markdown-with-directives compiler copied from Particle Physics | Single npm package. Output in `dist/`, base path from `BASE_PATH`. |
| Editor | CodeMirror 6 with a Lezer grammar for Vouch | Verification gutter, hover values from counterexamples, locked regions for exercises, Unicode input for `∀ ∃ ⟹` with ASCII equivalents. |
| Rendering | SVG for diagrams, graphs and trees. Canvas 2D for plots and large state graphs. WebGL2 only for state spaces beyond a few thousand nodes | Graph layout uses ELK (elkjs, lazy-loaded in a worker), as Digital Circuits does. No charting libraries. Respect `prefers-reduced-motion`. |
| Sound | None | |
| LLM | **None** | No language-model features (decided 2026-10-03). The epilogue discusses language models in prose, as one more kind of untrusted oracle. |
| History | **The evolution of the field is a through-line** (§3, through-line 9): each part opens with an essay on how its ideas and tools developed; history cards and biographies sit where each idea appears; the course has an interactive timeline and a family tree of tools | Every date and claim is cited. Biographies use typographic monograms, as in Proofcraft, unless a portrait has a clear licence. |
| Progress | `localStorage` for exercises, badges and settings. IndexedDB for the reader's Vouch files. Export and import as JSON | Drafts are saved before a run. Results are invalidated on edit and bound to the submitted source. |
| Design | **"The Notary"**: certificate paper and seals by day, a night desk with gold seals by night | See §11. Shares the collection's `theme` key. |
| Language | British English | |

## 3. Through-lines

1. **Find the invariant.** Almost every technique in the course comes down to finding or checking an
   inductive invariant:
   - a safety property in Part I (checked by enumeration);
   - a loop invariant in Part IV;
   - a representation invariant for a data structure, and a shape invariant on the heap;
   - an inductive invariant of a transition system, strengthened by k-induction and found by IC3 in Part V;
   - a protocol invariant that holds for any number of nodes;
   - the fixpoint that abstract interpretation computes, in Part VI.

   The same three checks recur everywhere: *initiation*, *consecution* and *safety*. They are drawn the same
   way each time, as three lights. A failed consecution check produces a **counterexample to induction (CTI)**:
   a state where the invariant holds but one step breaks it. The CTI appears from Chapter 18 onwards.
   Cross-course callbacks: Proofcraft Ch. 20 (the 15 puzzle and the MU puzzle) are model-checked in Chapter 1
   and proved by invariant in Chapter 23.

2. **Don't trust, check.** Solvers are large, clever and wrong now and then. Checkers are small. Each
   chapter's *What did we prove?* box says which certificate backs the result and what remained trusted. This
   is the CIC course's de Bruijn criterion (CIC Ch. 0) applied to automated tools. It also explains why an
   untrusted oracle, whether a heuristic, an unverified tool or a language model, is safe to use.

3. **The specification is code you haven't tested.** Writing the specification is the hard part, so the
   course has tools for testing specifications:
   - the **spec adversary**: a bank of wrong implementations, each of which must fail against the reader's
     specification;
   - vacuity checks (is the precondition satisfiable? does the property hold trivially?);
   - property banks for temporal formulas;
   - Chapter 29's audit of real verified systems that still had bugs.

4. **The bug museum.** Historic failures, each re-enacted with the course's tools in the chapter that could
   have caught it. The museum page records which exhibits the reader has caught.

   | Exhibit | Year | Re-enacted in | What catches it |
   |---|---|---|---|
   | Binary search midpoint overflow (Bloch) | 2006 | Ch. 0, 16, 18 | the verifier's overflow obligation, with a counterexample array of more than 2³⁰ elements |
   | Hyman's mutual exclusion algorithm (CACM) | 1966 | Ch. 2 | the explicit-state explorer, through an interleaving trace |
   | Therac-25 race (Leveson and Turner) | 1985–87 | Ch. 2 (history card; simplified race, labelled as such) | the interleaving explorer |
   | Mars Pathfinder priority inversion | 1997 | Ch. 3 (history card) | a liveness lasso |
   | Needham–Schroeder public-key protocol (Lowe) | 1978 / 1995 | Ch. 5 | the intruder model |
   | Pentium FDIV | 1994 | Ch. 10 (toy table-driven divider) | BMC and an equivalence miter |
   | Wrong peephole rewrites in LLVM (Alive) | 2015 | Ch. 14 | bit-vector SMT |
   | Zune leap-year freeze | 2008 | Ch. 18 | a missing termination measure |
   | TimSort's run-stack invariant (KeY) | 2015 | Ch. 19 (history card; optional simplified model) | a quantified invariant |
   | The DAO re-entrancy | 2016 | Ch. 20 | an object invariant broken during a callback |
   | Ariane 5 flight 501 | 1996 | Ch. 26 | interval analysis of a narrowing conversion |
   | Heartbleed | 2014 | Ch. 26 (simplified handler) | an out-of-bounds read alarm |
   | Bugs at the interfaces of verified systems (Fonseca et al.) | 2017 | Ch. 29 | the TCB map |

5. **The Ledger.** One running system grows across the course and is assembled in the capstone (Chapter 28):
   a small sharded bank whose central invariant is that money is conserved. The same invariant is checked at
   every level:
   - Chapter 2: a lost update between concurrent transfers, and deadlock from lock ordering;
   - Chapter 4: transfers across shards with two-phase commit, which blocks when the coordinator crashes;
   - Chapters 16–19: `transfer` with overflow-safe `u64` balances, and a batch loop that preserves the total
     (the sum-over-update lemma);
   - Chapter 20: the account map as an abstraction over a hash table;
   - Chapter 22: a linked journal;
   - Chapter 25: two-phase commit for any number of shards;
   - Chapter 26: no overflow in fee arithmetic;
   - Chapter 28: the layers assembled, with the assumptions between them listed.

6. **Be the checker first.** Before an engine runs, the reader tries the search by hand and plays against the
   machine: choosing the schedule (Ch. 2), starving a process (Ch. 3), dropping messages (Ch. 4), playing the
   intruder (Ch. 5), finding a CTI (Ch. 18, 23) and proposing a peephole rewrite (Ch. 14). Then the engine
   does the same search in milliseconds. The contrast makes the case for automation better than prose can.

7. **Programmer's view.** Short callouts map ideas onto ones the reader already has:
   - a precondition is a type the type checker can't express;
   - a loop invariant is the comment you wish the last person had written;
   - a counterexample is a failing test case found for you;
   - the frame rule is why a function that takes `&mut` of one field can't break another;
   - CDCL is backtracking search with memoisation of failures;
   - widening is a timeout that is still sound;
   - a certificate is a receipt.

8. **In industry.** Callouts show how real teams use the technique, and where the course's toy version is
   simpler. Examples:
   - Linux package managers (libsolv), with SAT;
   - Zelkova at AWS, with SMT;
   - TLA+ at AWS and Azure;
   - KLEE and SAGE, for symbolic execution;
   - Dafny, SPARK, Frama-C, Viper, Verus and Prusti;
   - seL4 and CompCert;
   - Astrée on Airbus flight control;
   - Infer at Meta;
   - SLAM and the Static Driver Verifier;
   - hardware equivalence checking and model checking at Intel and elsewhere;
   - Ivy and mypyvy for protocols.

   Each tool is introduced the first time it appears.

9. **How we got here.** The history of the field, told as the evolution of its ideas and tools as well as its
   people and dates. Most techniques in the course waited decades between the idea and the tool that made it
   practical. Symbolic execution (1976) waited for fast solvers (2005–08). SAT was "hopeless" after 1971 and a
   commodity after 2001. The course says why each wait ended: an algorithmic insight, faster machines, a
   standard format, a competition, or an industrial disaster that paid for the work. The history appears at
   three levels:
   - **Part essays.** Each part opens with *How we got here*, an essay of 800–1,500 words on how its family of
     techniques developed (outlines in §4). It sits next to that part's slice of the timeline.
   - **In place.** History cards (`:::history{year title people}`) and biographies (`:::bio`) appear where an
     idea is introduced, not piled at the end. Each chapter's *Under the hood* box says when its algorithm
     appeared and what it replaced. For example, watched literals (Chaff, 2001) replaced counting every
     clause on each assignment.
   - **Course-wide.** An interactive **timeline** with one lane per family (§5), a **family tree of tools**
     showing which tools descend from or influenced which, and the field's debates. These include whether
     program proofs can be trusted (De Millo, Lipton and Perlis, 1979; Fetzer, 1988), Hoare's 1996 question
     *how did software get so reliable without proof?*, and the cost of false alarms. Chapter 29 and the
     epilogue draw them together.

   The rules from Particle Physics apply: every date, attribution and quotation is cited in
   `content/bibliography.yaml`. Priority disputes and independent discoveries are stated as such (Cook and
   Levin; Clarke and Emerson, and Queille and Sifakis). Nothing is quoted from memory. MacKenzie's
   *Mechanizing Proof* (2001) is the main secondary source on the field's history before 2000.

## 4. Curriculum

Chapters are roughly 1–1.5 hours each. Chapters marked ◇ are optional deeper chapters: the core path skips
them without losing anything later chapters need. Each chapter's *Flagship* is its main interactive; §5 lists
the cross-cutting components. Each part opens with a *How we got here* essay (through-line 9), outlined
below each part's table. The essay is a part-opening page, so a reader can skip it and come back to it.

### Prologue

| # | Chapter | Key ideas | Flagship interactive | Reader does |
|---|---|---|---|---|
| 0 | For all inputs | The binary search that was broken for years (Bloch, 2006); a test checks points, a verifier checks the whole space; the scheduler, the network and the attacker are inputs too; the four strategies (enumerate, encode, generalise, approximate) and their guarantees; certificates; Turing's 1949 *Checking a large routine* | **Bug race**: a random tester and the verifier race on the same `search` function. The tester never finds the bug, because the bug needs an array of more than 2³⁰ elements. The solver "imagines" one in under a second, and the fix verifies. The badge ladder is introduced | Fix the midpoint; watch the badge go from *violated* to *verified* |

### Part I: Explore every state (explicit-state model checking)

| # | Chapter | Key ideas | Flagship interactive | Reader does |
|---|---|---|---|---|
| 1 | State machines | Systems as state plus actions; `system` blocks; nondeterminism; reachability; an invariant as a property of every reachable state; BFS and shortest counterexamples; the Die Hard jugs (a classic first TLA+ example) solved by "proving" the goal unreachable and reading the counterexample; small 15-puzzle instances (bridge: Proofcraft Ch. 20) | **State-space explorer**: the model and its state graph side by side. Step by hand by choosing enabled actions, or run BFS. Bad states turn red, the shortest path to one lights up, and a trace replays as a table and a timeline | Model a lock with a timeout; write its invariant; step BFS by hand and predict which state it visits next |
| 2 | Interleavings | Threads as processes; atomic steps and labels; the `process` sugar compiled to actions (shown under the hood); race conditions; mutual exclusion (Hyman 1966, Peterson 1981); the Ledger's lost update; locks and deadlock; state explosion counted; symmetry and partial-order reduction; ◇ box: weak memory and the store-buffering litmus test | **Interleaving explorer** with *be the scheduler*: two or three threads as lanes. The reader picks who steps next and tries to break mutual exclusion; then the explorer finds the shortest bad interleaving. Toggles for symmetry and POR show the state count drop | Find Hyman's bug by hand, then with the explorer; fix the Ledger's transfer; order the locks |
| 3 | Eventually | Safety and liveness (Lamport; Alpern and Schneider); LTL: `always`, `eventually`, `until`, `leads to`; lasso-shaped counterexamples; fairness (weak and strong); starvation; Büchi automata and nested DFS (under the hood); a short tour of CTL | **Trace lab**: build lasso traces by drag and drop and watch each formula's truth value update; see the formula's automaton; *starve a process*, then turn fairness on and watch the lasso disappear | Write LTL for English requirements (checked against a bank of traces); evaluate a formula on a lasso by hand, position by position |
| 4 | Messages and failures | The network as a multiset of messages; loss, duplication, reordering and crashes; two-phase commit for the Ledger; why 2PC blocks; a glimpse of consensus and FLP; **refinement**: an implementation's steps map to a specification's steps, with stuttering (TLA+'s TCommit and TwoPhase pattern); TLA+ at AWS | **Message sequence chart with a network adversary**: drop, duplicate, delay or crash, then hand the same powers to the explorer. A refinement view projects each protocol step onto the specification | Find the blocking scenario; check that 2PC refines atomic commit for three shards |
| 5 | The adversary | Security protocols as systems with an attacker; the Dolev–Yao intruder (knowledge, encryption only with keys); secrecy and authentication as properties; Needham–Schroeder (1978) and Lowe's attack (1995) and fix; bounded sessions | **Intruder sandbox**: the reader plays the intruder, with their knowledge set shown, and tries to impersonate Alice. The explorer then finds Lowe's attack automatically, and the fixed protocol passes for the bounded scenario | Reproduce the attack; state the authentication property so that it fails on the original protocol and holds on Lowe's fix |

**How we got here (Part I).** Model checking began as a reaction against proving concurrent programs by hand:
let the machine search instead. The essay covers:
- Dijkstra's mutual exclusion problem (1965) and the incorrect published solutions that followed it, Hyman's
  among them;
- Pnueli bringing temporal logic to programs (1977);
- model checking, invented independently by Clarke and Emerson (1981) and by Queille and Sifakis (1982);
- Vardi and Wolper's automata-theoretic approach (1986);
- Holzmann's SPIN, built at Bell Labs for telephone-switching protocols;
- Hoare's CSP (1978) and the FDR checker, which Lowe used to break Needham–Schroeder;
- Lamport's path from safety and liveness (1977) through TLA (1994) to the TLC model checker (1999);
- the 2007 Turing Award to Clarke, Emerson and Sifakis;
- AWS's report on TLA+ in production (2015).

### Part II: Encode in bits (SAT and symbolic model checking)

| # | Chapter | Key ideas | Flagship interactive | Reader does |
|---|---|---|---|---|
| 6 | Propositional encoding | Why Part I's explosion pushes us to symbols; Boolean formulas, CNF and Tseitin's encoding; one-hot and cardinality constraints; Sudoku, N-queens and package dependency resolution; NP-completeness (Cook 1971) in one paragraph; the random 3-SAT phase transition | **Encoding lab**: high-level constraints compile to the clause list, with live clause and variable counts, a naive-versus-Tseitin blow-up slider and solution counts. A phase-transition plot is generated live, after a *predict* question about where the hard ratio lies | Encode a scheduling puzzle exactly. It is checked by **counting solutions**, not just by satisfiability |
| 7 | Inside a SAT solver | DPLL; unit propagation; CDCL: implication graph, 1-UIP learning, non-chronological backjumping; watched literals; VSIDS and restarts; GRASP and Chaff | **CDCL stepper**: trail and decision levels, implication graph, the conflict cut, the learned clause, the backjump; replay and statistics | Drive the stepper: choose the decisions, propagate by hand, then pick the 1-UIP cut and predict the learned clause and the backjump level |
| 8 | Proofs of unsatisfiability | Resolution; RUP and DRAT certificates; why checking is easier than solving; the pigeonhole principle is exponential for resolution (Haken 1985); the Boolean Pythagorean triples proof (Heule, Kullmann and Marek, 2016) | **Proof viewer**: a resolution DAG for small instances and a DRAT replay for large ones. **The lying solver**: a sabotaged solver claims UNSAT and the checker refuses. A plot shows the pigeonhole principle growing | Predict the pigeonhole growth; find the bad step in a hand-built refutation |
| 9 ◇ | Small worlds | Bounded relational model finding; `world` blocks: types, relations, multiplicities, facts; the small scope hypothesis (Jackson, Alloy); relations to SAT | **Instance visualiser**: atoms and arrows for each instance or counterexample, with a scope slider that shows time rising as more cases are covered | Model a file system or an access-control policy; find the counterexample in scope 3 |
| 10 | Unrolling time | Bounded model checking (Biere, Cimatti, Clarke and Zhu, 1999): transition relation × k copies → SAT; completeness thresholds; hardware as a transition system; equivalence checking with a miter; Part I's models checked at bounds explicit search can't reach | **Unrolling view**: the system copied k times, the SAT counterexample shown as a waveform (Digital Circuits style), and a k-versus-time chart. **Miter bench**: a ripple-carry adder against a carry-lookahead adder (bridge: Digital Circuits Ch. 14) | Catch the toy FDIV divider's missing table entries; prove two adder designs equal for 8 bits |
| 11 ◇ | Decision diagrams | ROBDDs (Bryant 1986); canonicity; `apply`; variable ordering; adders are linear, multipliers are exponential under every order (Bryant 1991); symbolic reachability as a fixpoint over sets of states; *10²⁰ states and beyond* (1990) | **BDD lab**: type a formula and see its BDD; drag the variable order and watch the size change; adder-versus-multiplier growth; reachability with the frontier BDD growing each iteration | Build a BDD by hand with `apply`; find a variable order that keeps a comparator small |

**How we got here (Part II).** From "NP-complete, so give up" to SAT solvers as a commodity. The essay
covers:
- Boole's algebra (1847, 1854);
- Davis and Putnam (1960) and Davis, Logemann and Loveland (1962), built as theorem provers for first-order
  logic;
- Robinson's resolution (1965) and Tseitin's encodings (1968);
- Cook (1971) and Levin, independently, making SAT the archetypal hard problem;
- the turnaround: GRASP's clause learning (1996), Chaff's watched literals and VSIDS (2001), MiniSat (2003)
  and the SAT competitions, from 2002;
- Bryant's BDDs (1986), symbolic model checking (Burch et al., 1990) and McMillan's SMV;
- the move from BDDs to SAT with bounded model checking (1999);
- Intel's investment in formal methods after FDIV;
- certificates (DRUP, then DRAT, 2013–14) as the community's answer to buggy solvers, and the record proofs
  they made possible;
- Alloy (Jackson; *Software Abstractions*, 2006), bringing SAT to software design.

### Part III: Reason with theories (SMT)

| # | Chapter | Key ideas | Flagship interactive | Reader does |
|---|---|---|---|---|
| 12 | Equality and functions | First-order logic in brief (with appendix A); satisfiability modulo theories; DPLL(T) (Nieuwenhuis, Oliveras and Tinelli); uninterpreted functions as abstraction; congruence closure; theory conflicts become learned clauses; Ackermann's reduction | **DPLL(T) conversation**: the SAT core proposes, and the theory solver (an e-graph with union–find) answers *consistent* or returns a conflict with its explanation | Merge classes in the e-graph by hand and predict the conflict; prove two programs equal modulo uninterpreted operations |
| 13 | Arithmetic | Linear real arithmetic and simplex (Dutertre and de Moura); Farkas certificates; integers with branch and bound and cuts; nonlinear arithmetic: undecidable over the integers (Hilbert's tenth problem, Matiyasevich; bridge: *Incompleteness*), decidable over the reals (Tarski); why a verifier says *unknown* | **Simplex view**: a 2D or 3D feasible region with the pivots, the branch-and-bound tree for integer problems, and a nonlinear query that returns *unknown* with its reason | Read a Farkas certificate; solve a resource-allocation problem; choose the next pivot |
| 14 | Bits and arrays | Bit-vectors by bit-blasting; machine arithmetic: overflow, signedness, shifts; arrays: read-over-write and extensionality; Alive (Lopes, Menendez, Nagarakatte and Regehr, 2015): peephole rewrites proved or refuted; Zelkova for AWS access policies | **Peephole court**: propose `lhs ⇒ rhs` at widths 8–64 and get a verdict for each width; a refutation shows its counterexample in binary and hex; also bit-blasted circuit sizes (bridge: SSA to Silicon Ch. 17) | Decide which of a docket of rewrites are correct, with preconditions where needed; write an access policy question |
| 15 | Symbolic execution | Symbolic values and path conditions (King 1976); generating tests from paths; path explosion; KLEE and SAGE; loops unroll forever, which motivates invariants | **Path tree explorer**: the execution tree with a path condition at every node, a solver-generated input for each leaf (replayed to confirm) and the coverage map; a loop makes the tree explode | Generate inputs that reach a hard branch; see why the binary search loop needs something other than unrolling |

**How we got here (Part III).** Program verifiers needed decision procedures before the name SMT existed. The
essay covers:
- the Stanford Pascal Verifier (1979) and Nelson and Oppen's combination of theories (1979), then Shostak
  (1984);
- Simplify and ESC/Java (2002);
- the SMT-LIB initiative (2003) and its competition;
- DPLL(T) (2004–06);
- Yices, CVC and Z3 (2008), and the uses that followed;
- the ceiling on all of this: Hilbert's tenth problem, settled by Matiyasevich (1970).

Symbolic execution is the other story: King's 1976 idea waited for solvers to catch up, then returned as
DART (2005), KLEE and SAGE (2008).

### Part IV: Prove programs (deductive verification)

| # | Chapter | Key ideas | Flagship interactive | Reader does |
|---|---|---|---|---|
| 16 | Specifications and contracts | `requires`, `ensures`, `assert`, `old`; partial and total correctness; modularity (callers see only contracts); executable contracts: test first, then verify; writing specifications is the hard part; vacuity | **The Workbench** (first full use) and the **spec adversary**: the reader writes a specification for `max`, `dedup` or `sort`, and a bank of wrong implementations tries to satisfy it; any that verifies exposes a hole | Specify sorting (the empty-array implementation must fail); the Ledger's overflow-safe `transfer` |
| 17 | Weakest preconditions | Hoare triples and the rules (Floyd 1967, Hoare 1969); wp (Dijkstra 1975); verification conditions; passive form and SSA (bridge: SSA to Silicon Ch. 4); exponential VCs and how to avoid them (Flanagan and Saxe) | **wp stepper**: the predicate flows backwards line by line, and hovering a program point shows what must hold there. **Hoare rule builder**: apply rules by clicking, with side conditions sent to the solver. **VC inspector**: the exact SMT query | Compute wp by hand for a short program, then compare with the stepper; build a Hoare derivation with the rule builder |
| 18 | Loop invariants and termination | The missing piece; the three lights; heuristics for finding invariants (weaken the postcondition, replace a constant with a variable; Gries); CTIs; termination with `decreases`; the Zune freeze; binary search, fully verified; Dijkstra's Dutch national flag | **Invariant workshop (programs)**: the loop's actual states plotted (2D for two-variable loops), the candidate invariant as a region, the three lights, and CTIs as state pairs; a termination bar that must shrink | Invariants for sum, power, Dutch flag and binary search; find the Zune bug with `decreases` |
| 19 | Quantifiers, ghosts and lemmas | Arrays, sequences and multisets in specifications (`sorted`, permutation); ghost variables and ghost code; quantifier instantiation by E-matching (Simplify), triggers and matching loops; recursive functions in specifications; a lemma as a recursive proof (bridge: *Proofs Are Programs* Ch. 11); debugging a failed proof; the TimSort story | **Proof debugger**: a failing VC's model mapped back to program states, an instantiation viewer (which quantifier instances fired, with a matching-loop counter) and *assert bisection* | Verify insertion sort (sorted and a permutation); the Ledger's sum-over-update lemma |
| 20 | Data abstraction and refinement | Abstract state as ghost state; representation invariants; abstraction functions; the simulation square (bridge: *Proofs Are Programs* Ch. 17); invariants at method boundaries; re-entrancy and the DAO | **Abstraction view**: concrete state (ring buffer, hash table) and abstract state (sequence, map) side by side, linked; one simulation square per operation, coloured when proved | A verified ring-buffer queue; the Ledger's account map |
| 21 | The heap: separation logic | Aliasing breaks Hoare logic; the frame problem; dynamic frames, briefly; separation logic (Reynolds; O'Hearn, Reynolds and Yang): points-to, the separating conjunction, the frame rule | **Heap diagrams linked to assertions**: hovering a conjunct highlights its footprint; drag a pointer to create aliasing and watch `*` become false; the frame rule animated | Specify and verify swap and an in-place update with frames |
| 22 | Linked structures and ownership | List segments and inductive predicates; folding and unfolding; symbolic execution with symbolic heaps (Smallfoot); memory safety: null dereferences, leaks and use-after-free; Infer at Meta; **ownership**: Rust's borrow checker as permission accounting; fractional permissions; Prusti, Creusot and Verus | **Symbolic heap stepper**: list reversal step by step, with fold and unfold; memory-safety errors pinpointed. **Permission tracker**: permissions flowing through a Rust-like program as tokens | Verify list reversal; the Ledger's journal; find the use-after-free |

**How we got here (Part IV).** From proofs on paper to a verifier in the editor. The essay covers:
- Goldstine and von Neumann's assertion boxes in flow diagrams (1947), Turing's *Checking a large routine*
  (1949), McCarthy (1963) and Naur's "general snapshots" (1966);
- Floyd (1967) and Hoare (1969);
- the NATO conference of 1968 and the "software crisis";
- Dijkstra's weakest preconditions and the derivation of programs (1975–76);
- the backlash: De Millo, Lipton and Perlis (1979) and Fetzer (1988);
- design by contract (Meyer, Eiffel);
- the line of verifiers from ESC/Modula-3 through ESC/Java and Spec# to Boogie and Dafny, alongside Why3,
  Frama-C, KeY and SPARK;
- heap reasoning, from Burstall (1972) to Reynolds and O'Hearn's separation logic (2001–02), then Smallfoot
  and Infer at Facebook (acquired with Monoidics, 2013);
- Hoare's Verifying Compiler grand challenge (2003), seL4 (2009), and the verifiers built on Rust's
  ownership types.

### Part V: Prove systems (inductive invariants)

| # | Chapter | Key ideas | Flagship interactive | Reader does |
|---|---|---|---|---|
| 23 | Inductive invariants | From loop invariants to system invariants; why "holds in every reachable state" is not "inductive"; CTIs; strengthening; k-induction (Sheeran, Singh and Stålmarck, 2000); Part I's models proved without enumeration; the 15 puzzle's parity invariant | **Invariant workshop (systems)**: a CTI drawn as two states of the model; the reader adds a conjunct and repeats until the invariant is inductive; a k-induction slider | Make Peterson's mutual exclusion inductive; prove the 15-puzzle invariant |
| 24 ◇ | IC3: the machine finds the invariant | IC3/PDR (Bradley 2011; Eén, Mishchenko and Brayton 2011): frames, relative induction, generalisation, propagation; the result is a certificate | **IC3 stepper**: frames as nested regions over a small state space, the proof-obligation stack, blocked cubes generalised, and the final invariant exported and re-checked | Predict which clauses survive propagation; compare IC3's invariant with the one written by hand in Ch. 23 |
| 25 | For every N | Parameterised verification; uninterpreted sorts for nodes; decidable fragments (EPR) and why they matter; the Ivy workflow (Padon et al., 2016); leader election in a ring (Chang and Roberts); two-phase commit for any number of shards | **Parameterised workshop**: a CTI drawn as a small diagram of nodes and messages, plus a counter of ground instances | Prove ring leader election and the Ledger's 2PC for every N |

**How we got here (Part V).** From inventing invariants by hand to machines that find them. The essay covers:
- invariants for concurrent programs: Owicki and Gries (1976), Lamport (1977), and Manna and Pnueli's books;
- induction over transition systems and k-induction (2000);
- IC3 (Bradley, 2011) and PDR, which changed hardware model checking;
- decidable fragments of logic, going back to Bernays, Schönfinkel and Ramsey (1928–30), revived by Ivy
  (2016) for protocols;
- IronFleet and Verdi (2015): verified distributed systems.

### Part VI: Approximate (abstract interpretation)

| # | Chapter | Key ideas | Flagship interactive | Reader does |
|---|---|---|---|---|
| 26 | Abstract interpretation | Concrete and abstract semantics (Cousot and Cousot, 1977); the sign and interval domains; lattices and joins; fixpoints over the CFG (bridge: SSA to Silicon Ch. 11, the liveness fixpoint); widening and narrowing; soundness means false alarms; Ariane 5; Astrée | **Interval analyser**: a CFG with intervals on every edge, updated iteration by iteration; widening animated; a number line showing concrete states inside their abstraction; a false alarm explained | Run the fixpoint by hand and choose where to widen; triage alarms in the Ledger's fee code and a heartbeat handler |
| 27 ◇ | Better abstractions | Relational domains: octagons (Miné) and polyhedra (Cousot and Halbwachs, 1978); predicate abstraction (Graf and Saïdi) and CEGAR (Clarke et al., 2000); SLAM; the analyser's invariants handed to the verifier (untrusted oracle, checked result) | **Domain comparison**: 2D reachable states with box, octagon and polyhedron overlays. **CEGAR loop**: an abstract counterexample is replayed, found spurious, and the abstraction refined | Pick the cheapest domain that proves an assertion; watch CEGAR discover a predicate |

**How we got here (Part VI).** Soundness against usability. The essay covers:
- dataflow analysis in compilers (Kildall, 1973) as the ancestor;
- the Cousots' abstract interpretation (1977) and Cousot and Halbwachs' polyhedra (1978);
- Ariane 5, the inquiry board's report (1996) and the static analysis that followed;
- Astrée on Airbus flight control (2003) and Miné's octagons;
- predicate abstraction (1997), SLAM (2001) and CEGAR (2000), which led to Microsoft's Static Driver
  Verifier;
- the industrial lesson on false alarms (Bessey et al., *A few billion lines of code later*, 2010) and how
  Infer's diff-time deployment answered it.

### Part VII: Trust

| # | Chapter | Key ideas | Flagship interactive | Reader does |
|---|---|---|---|---|
| 28 | Capstone: the verified Ledger | Layers in the style of IronFleet (Hawblitzel et al., 2015): specification → protocol → implementation; which engine checks each layer; the assumptions between layers; what the composition proves | **Ledger dashboard**: each layer with its badge and certificate status, and *break it* switches that inject a bug into any layer to show which check catches it and which one can't | Close the last proof obligations; find the bug that slips between layers |
| 29 | What did we prove? | The trusted computing base; specification validation; the verified compiler (CompCert) and what Csmith found in its unverified parts; bugs at the interfaces of verified distributed systems (Fonseca et al., 2017); seL4's assumptions; the limits: Rice's theorem (bridge: *Incompleteness*) | **TCB map**: everything a result trusted, from parser and VC generator to solver, checker, compiler and hardware, each component clickable. **Spec court**: planted specification bugs to find | Audit three "verified" artefacts and name each one's gap |

**How we got here (Part VII).** What a proof buys, an argument that has run since 1979:
- the "social processes" critique, Fetzer, and Hoare's 1996 reconsideration;
- CompCert (2006–09) and what Csmith did and did not find in it (2011);
- seL4 (2009);
- the industrial turn of the 2010s at AWS, Meta, Microsoft and Intel;
- where the field stands in 2026.

### Epilogue

| # | Chapter | Key ideas | Flagship interactive |
|---|---|---|---|
| 30 | The landscape | Which tool when: Dafny, Why3, Frama-C, SPARK, Viper, Verus, KeY, CBMC, TLA+ and Apalache, Alloy, Ivy, SPIN, nuXmv, ABC, Infer, Astrée, KLEE, and Lean, Coq and Isabelle for the rest; the field's open problems and a look back across the timeline; language models as one more untrusted oracle, which checkers make safe; where to go next | **Tool chooser**: answer questions about the system to be checked and get recommended tools, each linked to the Rosetta appendix |

**Appendices.** A. Logic primer: propositional and first-order logic, sets and relations, induction.
B. Vouch reference. C. The engines: what each one checks, its limits and its certificate (the honesty page,
like Proofcraft's appendix B). D. The bug museum. E. Rosetta: the same small examples in Vouch, Dafny, TLA+,
Alloy, SMT-LIB, Viper and ACSL. F. The timeline and the family tree of tools (full-page versions). G. Glossary
and bibliography.

**Reading paths** (shown on the home page's course map):

- *Verify my code*: 0 → 15 → 16–20 → 26 → 29, with Part III dipped into as needed.
- *Distributed systems*: 0 → 1–5 → 23 → 25 → 28–29.
- *How the tools work*: 0 → 6–8 → 10–14 → 17 → 24 → 26–27.

## 5. Interactive components

### Cross-cutting

| Component | What it does |
|---|---|
| **Workbench** (full page and inline) | Vouch editor with a verification gutter (✓, ✗ or ? on every assertion, postcondition, invariant and overflow check). Hovering an expression shows its value in the current counterexample. Also an engine selector, solver statistics, the VC inspector, certificate status and the badge. Re-verifies after a debounced edit; results are per declaration, cached and cancellable, and bound to the source they were computed from |
| **Result badge** | The one way any result is reported (§2, *Honest results*). Every badge expands into *what was checked*, *how* and *what was assumed* |
| **Engine room** | One model or program run under every applicable engine side by side: explorer, BMC, k-induction, IC3 and BDD for systems; random tests, symbolic execution, bounded unrolling, the verifier and the abstract interpreter for programs. Each column shows time, states or clauses, and the badge. This shows the guarantee ladder on one example. Appears in Ch. 10, 23, 26 and 28 |
| **Counterexample viewer** | Program counterexamples as a time-travel debugger: values on each line, stepping forwards and backwards. System traces as a table, as process lanes and as a message sequence chart, with lassos for liveness. Every counterexample is replayed by the reference interpreter before it is shown; a spurious one is labelled spurious |
| **TCB meter** | A compact strip that shows which components a result depended on, and which of them were trusted and which were certificate-checked |
| **Spec adversary** | Runs a bank of wrong implementations (or systems, or traces) against the reader's specification, which must reject them all. Running the reference implementation guards against the opposite mistake, a specification that is too strong |
| **Invariant workshop** | One design in three settings (loops, Ch. 18; systems, Ch. 23; protocols, Ch. 25): the three lights, CTIs drawn in the setting's own picture, and the strengthening loop |
| **Timeline** | One lane per family: logic and decision procedures, model checking, SAT, SMT, deductive verification, heap reasoning, abstract interpretation, industrial adoption and disasters. It runs from Boole (1847) to 2026. Zoom, filter by lane or by part, and follow links to the chapter where each event matters. Every card is cited. The part essays embed their own slice. Built from `content/timeline.yaml` |
| **Family tree of tools** | A lineage graph of tools and the ideas they carried, such as Chaff → MiniSat → today's CDCL solvers, Simplify → ESC/Java → Boogie → Dafny, SMV → NuSMV → nuXmv, and Smallfoot → Infer. Edges are typed *descends from* or *influenced*, and each edge is cited. Each node links to the Rosetta appendix and the chapter that uses its idea. Built from `content/lineage.yaml` |
| **Biography cards** | `:::bio{name born died}` for the people behind the ideas: Turing, Floyd, Hoare, Dijkstra, Pnueli, Clarke, Emerson, Sifakis, Lamport, the Cousots, Bryant, Reynolds, O'Hearn and others, placed where their idea appears. Typographic monograms unless a portrait has a clear licence |
| **Bug museum** | A gallery page: exhibit cards with a history summary and citation, linked to their re-enactment, with *caught* status |
| **Course map** | Chapters as a graph with engine icons and the three reading paths |
| Terms, equations, history cards, glossary, timeline, bibliography | Ported from Particle Physics' compiler and components |

### Exercise types (fenced YAML blocks, as in the other SvelteKit courses)

| Type | The reader… | Checked by (the exercise contract) |
|---|---|---|
| `quiz` | predicts before a figure answers | answer key |
| `verify` | completes Vouch code (invariants, assertions, lemma calls, ghost code) until it verifies | the verifier, plus the contract: locked regions unchanged (specification fingerprint), no `assume`, `axiom` or `decreases *`, satisfiable preconditions |
| `spec` | writes a specification | reference implementation verifies (not too strong); every adversary fails (not too weak) |
| `invariant` | supplies an invariant for a loop or system | the three lights; CTIs shown on failure |
| `model` | writes a system model or property | expected verdicts on a bank of correct and buggy systems (for example, the property must fail on Hyman's algorithm and hold on Peterson's) |
| `ltl` | writes a temporal formula for an English requirement | a bank of lasso traces, plus automaton equivalence where feasible |
| `encode` | encodes a puzzle or constraint problem | the **exact solution count** (by model enumeration with blocking clauses), so over- and under-constrained encodings both fail |
| `play` | plays scheduler, intruder, network or environment | the game state reaches the target (a bad state or a broken property) |
| `drive` | drives an engine's stepper: picks the decision, the conflict cut, the pivot, the widening point or the next frame | each step is compared with what the engine would do, and the run must reach the engine's answer |
| `rewrite` | decides whether rewrites are correct, adding preconditions where needed | bit-vector SMT at every listed width |
| `bug`, `parsons` | spots the flaw in a proof, specification or model; orders Hoare-rule steps | answer key |

All exercises save progress locally. Feedback always names what was established, such as *verified*,
*replayed counterexample*, *tests passed* or *self-reviewed*. Each `verify` exercise's reference solution and
starter are checked at build time: the reference must verify and the starter must not.

## 6. The language: Vouch (sketch; full specification in `docs/VOUCH.md`)

The language is one notation with three top-level forms. These examples are illustrative.

```vouch
pred sorted(a: [i32]) { forall i, j :: 0 <= i < j < len(a) ==> a[i] <= a[j] }

fn search(a: [i32], key: i32) -> (r: int)
  requires sorted(a) && len(a) <= i32::MAX
  ensures r >= 0 ==> r < len(a) && a[r] == key
  ensures r < 0  ==> key !in a
{
  var lo: i32 = 0
  var hi: i32 = len(a) as i32
  while lo < hi
    invariant 0 <= lo <= hi <= len(a)
    invariant key !in a[..lo] && key !in a[hi..]
    decreases hi - lo
  {
    let mid = (lo + hi) / 2          // ✗ i32 overflow when lo + hi > 2³¹ − 1
    if a[mid] < key { lo = mid + 1 } else if a[mid] > key { hi = mid } else { return mid }
  }
  return -1
}
```

```vouch
system Peterson {
  var flag: [2]bool = [false, false]
  var turn: 0..1 = 0

  process P(me: 0..1) {            // each label is one atomic step
    loop {
      want:     flag[me] = true
      yield:    turn = 1 - me
      wait:     await !flag[1 - me] || turn == me
      critical: flag[me] = false
    }
  }

  invariant mutex: !(P(0) at critical && P(1) at critical)
  property progress: forall p :: always (P(p) at wait ==> eventually P(p) at critical)
  fairness weak P
}
```

```vouch
system Commit {
  type Shard                       // uninterpreted: proved for every number of shards (Ch. 25)
  var vote: Shard -> {none, yes, no}
  var decision: {none, commit, abort}
  action decide_commit() when forall s :: vote[s] == yes { decision = commit }
  ...
  invariant consistent: decision == commit ==> forall s :: vote[s] == yes
}
```

Heap programs add `ref` types, fields, `new` and `free`, with separation-logic assertions (`x.next |-> y`,
`P ** Q`, inductive predicates such as `lseg(x, y, xs)`). Small worlds add relations and multiplicities
(`rel parent: Dir -> lone Dir`, `check acyclic for 4`). Finite types (`0..3`, enumerations, bounded
collections) make a system explicitly explorable. Uninterpreted types make it parameterised.

The concrete syntax is to be settled in M0, following DCL's lessons: no semicolons, strict typing,
error messages written for learners, and every construct with a hover explanation.

## 7. The engines

| Engine | Input | Answers | Certificate | Trusted |
|---|---|---|---|---|
| `explore` | finite systems; invariants, LTL with fairness | violated (trace or lasso) / holds for this instance | trace replayed; state count | the explorer (for *holds*) |
| `sat` | CNF | sat / unsat | model evaluated; DRAT checked | the DRAT checker |
| `relational` | `world` blocks | instance / none within scope | instance evaluated | the encoder |
| `bmc` | finite systems; programs with a loop bound | violated / none up to k | trace replayed | the encoder |
| `bdd` | finite systems | holds / violated | reachable set exported as an invariant and re-checked by SAT | the encoder |
| `kind`, `ic3` | finite systems | holds / violated / unknown | inductive invariant re-checked; trace replayed | the encoder |
| `smt` | EUF, LRA, LIA, nonlinear (incomplete), bit-vectors, arrays, quantifiers (E-matching; complete grounding for EPR) | sat / unsat / unknown | model evaluated; RUP for the Boolean skeleton, plus theory-lemma certificates (congruence chains, Farkas coefficients, bit-blasting DRAT, axiom instances) | the checkers |
| `symex` | programs | inputs per path | inputs replayed | the interpreter |
| `vcgen` | `fn` and `lemma` with contracts | verified / violated / unknown | the VC's unsat certificate; models mapped back to program states | parser, type checker and VC generator |
| `param` | systems over uninterpreted types | inductive / CTI | SMT certificate | the encoder |
| `heap` | heap programs (list-segment fragment) | verified / error | — | the symbolic-heap prover |
| `absint` | programs | an invariant at each program point; alarms | invariants re-checked by `vcgen` | nothing beyond `vcgen` |

The reference interpreter (which runs programs and systems, executes contracts at run time and replays traces)
is the semantics every engine is tested against.

## 8. Chapter template

Hook (an exhibit from the museum or a history card) → 🔮 predict → explore (the flagship) → explain →
✍️ specify or verify (a Vouch exercise) → 🐞 catch the bug → ⚙️ under the hood (how the engine does it, with an
excerpt of the real code) → 🏭 in industry → 🔏 what did we prove? → what's next →
further reading.

Standards per chapter:

- 2,500–5,000 words, in named sessions with a natural stopping point.
- One flagship interactive, plus 2–4 smaller figures.
- At least one *predict* question, placed where intuition is usually wrong.
- At least one exercise that is a verification task (`verify`, `spec`, `invariant`, `model`, `ltl` or
  `encode`).
- One *What did we prove?* box.
- At least one history card or museum exhibit, cited, placed where its idea appears. Biographies for the
  people whose idea the chapter is built on. *Under the hood* says when the algorithm appeared and what it
  replaced.
- Each part opener: a *How we got here* essay of 800–1,500 words with its slice of the timeline, and new
  entries in the timeline and the family tree.
- An *Under the hood* box wherever an engine does something non-trivial.
- Every Vouch snippet carries its expected verdict and is checked in tests.

## 9. Bridges with other courses

| This course | Elsewhere |
|---|---|
| Through-line 2, certificates and the TCB | CIC Ch. 0 (the de Bruijn criterion); *Proofs Are Programs* Ch. 10 (automation that leaves a proof) |
| Ch. 1, Ch. 23: invariants of puzzles | Proofcraft Ch. 20 (invariants: the 15 puzzle, the MU puzzle) |
| Ch. 10, Ch. 11: adders, miters, BDDs | Digital Circuits Ch. 14 (arithmetic) and Ch. 19 (FSM equivalence by product machine) |
| Ch. 13: nonlinear integer arithmetic is undecidable; Ch. 29: Rice's theorem | *Incompleteness* Ch. 6 (computability and incompleteness) |
| Ch. 14: the peephole court | SSA to Silicon Ch. 17 (peephole optimisation and superoptimisation) |
| Ch. 17: passive form | SSA to Silicon Ch. 4 (SSA) |
| Ch. 19: lemmas as recursion; Ch. 20: the simulation square | *Proofs Are Programs* Ch. 11 (induction) and Ch. 17 (the compiler) |
| Ch. 26: fixpoints on the CFG | SSA to Silicon Ch. 11 (liveness) |

Reciprocal *see also* links in those courses are a separate, small change made at integration (M8).

## 10. Architecture and quality gates

```
courses/formal-verification/
  content/            outline.ts; parts/<n>-<slug>/index.md (the *How we got here* essays);
                      chapters/<nn>-<slug>/{index.md, widgets/*.svelte, *.vouch}; appendices;
                      museum.yaml, timeline.yaml (with lanes), lineage.yaml (tool family tree);
                      YAML for the glossary, bibliography and terms
  src/lib/fv/         the toolchain: pure TypeScript, no DOM (it runs in workers and under Vitest)
    logic/            sorts, terms, formulas, printer, evaluator                      (trusted)
    sat/              CDCL solver, DIMACS, DRAT output; check/ (RUP/DRAT checker)     (check/ trusted)
    smt/              DPLL(T); theories euf, lra, lia, nla, bv, arrays, quant; certificates; check/
    bdd/              BDD package
    vouch/            lexer, parser, type checker, interpreter (run-time contracts), VC generator,
                      process → action compiler, encoders to SAT and SMT
    explore/  ltl/  bmc/  ic3/  symex/  heap/  absint/  relational/
    engines.ts        the common Engine interface → Verdict { badge, certificate, assumptions, stats }
  src/lib/components/ workbench, badge, counterexample viewer, TCB meter, exercises, layout
  src/lib/widgets/    the flagship interactives
  tools/markdown/     Markdown → Svelte compiler (copied from Particle Physics)
```

Quality gates (Vitest, deterministic, and in `.github/workflows/formal-verification.yml`):

- **Snippets:** every Vouch snippet in every chapter yields its annotated verdict. Every exercise's reference
  solution passes and its starter fails, and every adversary bank is rejected by the reference specification.
- **Certificates:** every SAT and SMT answer in the test suite is certificate-checked. Sabotaged solvers
  (mutation tests) must be caught by the checkers.
- **Differential testing:** the course's SAT and SMT solvers are checked against Z3 (the `z3-solver` npm
  package, a Node-only dev dependency, never shipped to the browser) on fuzzed formulas and on every query
  the chapters generate. The explorer is checked against BMC and IC3 on the same models.
- **Soundness fuzzing:** every program the verifier accepts is run on random inputs with run-time contract
  checking, and no contract may fail. Every counterexample must replay.
- **History data:** every timeline event, lineage edge, museum exhibit and biography has a bibliography key
  that resolves, and every timeline event links to a chapter that exists.
- `npm run check` (svelte-check, 0 errors) and `npm run build`; the root audit and the navigation and workflow
  browser checks.

Performance targets, to be measured at M1 and M4 and adjusted then:

- Ch. 2 models explored at 100,000 states/s or more in a worker.
- A 9×9 Sudoku solved in under 50 ms.
- Every Part IV example verified in under 2 s on a laptop, re-verified on edit.

**Decision point (M5):** if the TypeScript SMT solver cannot verify Chapter 19's insertion sort and the
Ledger lemma interactively, the hot paths move to Rust compiled to WebAssembly behind the same interface,
as the other courses planned. Loading Z3 compiled to WebAssembly in the browser is the last resort: it needs
cross-origin isolation, which GitHub Pages does not provide without a service-worker workaround.

## 11. Look and feel: "The Notary"

By day, warm certificate paper: fine guilloché rules in part headers, ink-blue text, *verified* results as
an embossed green seal, and counterexamples as red-pencil annotations in the margin. By night, a dark desk
with gold seals and the same red. The badge is the course's signature element. Code is in a monospace face
with ligatures for `==>`, `<==>` and `forall`. Graphs use one consistent encoding:

- states are circles;
- bad states are red;
- traces are thick paths;
- CTIs are paired states joined by a dashed step.

Colour is never the only signal; ✓, ✗ and ? glyphs go with it. The index card shows a loop with its
`invariant` line, a green seal reading *verified · ∀ inputs* and a red counterexample chip.

## 12. Milestones

| | Milestone | Contents |
|---|---|---|
| M0 | Plan and language | This plan agreed; `docs/VOUCH.md` (syntax, types, semantics, contract checking); `docs/AUTHORING.md`; scaffold copied from Particle Physics; the reference chapter chosen (Ch. 18) |
| M1 | Core and first engines | `logic`, `sat` with DRAT checking, the Vouch parser, type checker and interpreter, `explore` with traces; the Workbench, badge and counterexample viewer; the timeline, family-tree and biography components with their YAML schemas. Benchmark: Ch. 2's models at target speed |
| M2 | Part I | Chapters 0–5 and the Part I essay; `ltl`; the explorer, interleaving, trace-lab, message-chart and intruder widgets |
| M3 | Part II | Chapters 6–11 and the Part II essay; `relational`, `bmc`, `bdd`; the CDCL stepper and proof viewer |
| M4 | Part III | `smt` with every theory and its certificates; differential testing against Z3; Chapters 12–15 and the Part III essay; `symex` |
| M5 | Part IV | `vcgen`, `heap`; Chapters 16–22 and the Part IV essay; **benchmark decision** (§10) |
| M6 | Part V | `kind`, `ic3`, `param`; Chapters 23–25 and the Part V essay |
| M7 | Part VI | `absint`; Chapters 26–27 and the Part VI essay |
| M8 | Part VII and integration | Chapters 28–30 and the Part VII essay, the appendices, the museum page, and the full timeline and family tree reviewed end to end for coverage and citations; root build, deploy, workflow, index card, README row, reciprocal links in the bridged courses |

## 13. Risks

- **Solver power.** Teaching solvers are far weaker than Z3. Mitigations:
  - every example is authored against the course's solver and kept in tests;
  - *unknown* is taught as a normal outcome (Ch. 13 and 19);
  - the M5 decision point.
- **Scope.** There are 31 chapters and about a dozen engines, and all of them ship in the first release. One
  shared language and one shared expression layer keep the engines small. If a milestone slips, the four ◇
  chapters are the ones that can move later without breaking the core path.
- **Language design.** A language that is pleasant both for programs and for systems is the hardest design
  problem here. M0 writes VOUCH.md and checks it on the hardest examples (Peterson, the 2PC for every N,
  insertion sort, list reversal) before any chapter is written.
- **Facts.** History is now a through-line, so it carries more claims. Every number, date, attribution and
  claim about a historical bug must be cited from a primary or reputable
  source in `content/bibliography.yaml`. Re-enactments say what they simplify. If a number cannot be checked,
  the chapter says less.

## 14. Resolved questions (2026-10-03)

1. **Names.** *For All Inputs* (course), *Vouch* (language) and *The Notary* (design) are agreed.
2. **Length.** The first release ships all 31 chapters, the four ◇ chapters included.
3. **LLM.** There is no language-model feature. The epilogue mentions language models in prose only.
4. **Code-along.** There is no TypeScript engine-building track. The reader opens the tools by driving their
   steppers (`drive` exercises) and by reading *Under the hood* excerpts.
5. **History.** The evolution of the field's theories and tools is a through-line (§3, through-line 9; §4,
   *How we got here*; §5, *Timeline* and *Family tree of tools*).
