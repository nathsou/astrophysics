/**
 * The course outline: single source of truth for navigation. A chapter becomes readable when a
 * matching `chapters/<nn>-<slug>/index.md` exists; until then it is listed as planned.
 * Slugs are fixed: other courses link to them.
 */

/** The engines a chapter uses (shown as icons on the course map). */
export type EngineId = 'explore' | 'ltl' | 'sat' | 'relational' | 'bmc' | 'bdd' | 'smt' | 'symex' | 'vcgen' | 'heap' | 'kind' | 'ic3' | 'param' | 'absint';

export interface OutlineEntry {
  slug: string;
  number: string;
  title: string;
  summary: string;
  /** The flagship interactive. */
  flagship?: string;
  /** Optional deeper chapter (◇): the core path skips it. */
  optional?: boolean;
  engines?: EngineId[];
  /** Year of the chapter's key historical moment, for the course map. */
  year?: number;
  event?: string;
}

export interface OutlinePart {
  id: string;
  title: string;
  /** Part opener page with the "How we got here" essay (absent for the prologue and epilogue). */
  essay?: string;
  blurb: string;
  chapters: OutlineEntry[];
}

export const COURSE_TITLE = 'For All Inputs';
export const COURSE_SUBTITLE = 'Formal verification from SAT solvers to verified systems';

export const PARTS: OutlinePart[] = [
  {
    id: '0',
    title: 'Prologue',
    blurb: 'A test checks some inputs; a verifier checks all of them. The scheduler, the network and the attacker are inputs too.',
    chapters: [
      { slug: 'for-all-inputs', number: '0', title: 'For all inputs', summary: 'A binary search that was broken for years, a tester that never finds the bug, and a solver that finds it in a second.', flagship: 'Bug race', engines: ['vcgen', 'smt'], year: 2006, event: 'Bloch: nearly all binary searches are broken' },
    ],
  },
  {
    id: 'I',
    title: 'Explore every state',
    essay: 'explore-every-state',
    blurb: 'Model systems as state machines and let a machine search every reachable state, every interleaving, every message order and every attack.',
    chapters: [
      { slug: 'state-machines', number: '1', title: 'State machines', summary: 'Systems as states and actions, invariants, breadth-first search and the shortest counterexample.', flagship: 'State-space explorer', engines: ['explore'], year: 1981, event: 'Model checking is invented' },
      { slug: 'interleavings', number: '2', title: 'Interleavings', summary: 'Threads, atomic steps, races, mutual exclusion, deadlock and the state explosion.', flagship: 'Interleaving explorer', engines: ['explore'], year: 1966, event: 'Hyman’s flawed mutual exclusion' },
      { slug: 'eventually', number: '3', title: 'Eventually', summary: 'Safety and liveness, temporal logic, fairness and lasso-shaped counterexamples.', flagship: 'Trace lab', engines: ['explore', 'ltl'], year: 1977, event: 'Pnueli’s temporal logic of programs' },
      { slug: 'messages-and-failures', number: '4', title: 'Messages and failures', summary: 'Networks that lose, duplicate and reorder messages; two-phase commit; refinement.', flagship: 'Message sequence chart', engines: ['explore'], year: 2015, event: 'AWS reports on TLA+ in production' },
      { slug: 'the-adversary', number: '5', title: 'The adversary', summary: 'Security protocols, the Dolev–Yao intruder, and Lowe’s attack on Needham–Schroeder.', flagship: 'Intruder sandbox', engines: ['explore'], year: 1995, event: 'Lowe breaks Needham–Schroeder' },
    ],
  },
  {
    id: 'II',
    title: 'Encode in bits',
    essay: 'encode-in-bits',
    blurb: 'When there are too many states to visit, describe them with Boolean formulas and let a SAT solver or a BDD do the searching.',
    chapters: [
      { slug: 'propositional-encoding', number: '6', title: 'Propositional encoding', summary: 'Boolean formulas, CNF, Tseitin’s encoding, puzzles and package managers.', flagship: 'Encoding lab', engines: ['sat'], year: 1971, event: 'Cook: SAT is NP-complete' },
      { slug: 'inside-a-sat-solver', number: '7', title: 'Inside a SAT solver', summary: 'DPLL, unit propagation, conflict-driven clause learning and watched literals.', flagship: 'CDCL stepper', engines: ['sat'], year: 2001, event: 'Chaff' },
      { slug: 'proofs-of-unsatisfiability', number: '8', title: 'Proofs of unsatisfiability', summary: 'Resolution, DRAT certificates, the pigeonhole principle and a lying solver.', flagship: 'Proof viewer', engines: ['sat'], year: 2016, event: 'The 200-terabyte proof' },
      { slug: 'small-worlds', number: '9', title: 'Small worlds', summary: 'Bounded relational models and the small scope hypothesis.', flagship: 'Instance visualiser', optional: true, engines: ['relational', 'sat'], year: 2006, event: 'Software Abstractions' },
      { slug: 'unrolling-time', number: '10', title: 'Unrolling time', summary: 'Bounded model checking, hardware, and equivalence checking with a miter.', flagship: 'Unrolling view', engines: ['bmc', 'sat'], year: 1999, event: 'Bounded model checking' },
      { slug: 'decision-diagrams', number: '11', title: 'Decision diagrams', summary: 'BDDs, variable orders, and symbolic reachability over sets of states.', flagship: 'BDD lab', optional: true, engines: ['bdd'], year: 1986, event: 'Bryant’s BDDs' },
    ],
  },
  {
    id: 'III',
    title: 'Reason with theories',
    essay: 'reason-with-theories',
    blurb: 'Satisfiability modulo theories: equality, arithmetic, bit-vectors and arrays, and symbolic execution on top.',
    chapters: [
      { slug: 'equality-and-functions', number: '12', title: 'Equality and functions', summary: 'First-order logic, DPLL(T), congruence closure and uninterpreted functions.', flagship: 'DPLL(T) conversation', engines: ['smt'], year: 1979, event: 'Nelson and Oppen combine theories' },
      { slug: 'arithmetic', number: '13', title: 'Arithmetic', summary: 'Simplex, Farkas certificates, branch and bound, and why a solver says unknown.', flagship: 'Simplex view', engines: ['smt'], year: 1970, event: 'Matiyasevich settles Hilbert’s tenth problem' },
      { slug: 'bits-and-arrays', number: '14', title: 'Bits and arrays', summary: 'Machine arithmetic by bit-blasting, arrays, and peephole rewrites proved or refuted.', flagship: 'Peephole court', engines: ['smt'], year: 2015, event: 'Alive checks LLVM’s peepholes' },
      { slug: 'symbolic-execution', number: '15', title: 'Symbolic execution', summary: 'Path conditions, generated tests, path explosion, and why loops need something else.', flagship: 'Path tree explorer', engines: ['symex', 'smt'], year: 1976, event: 'King’s symbolic execution' },
    ],
  },
  {
    id: 'IV',
    title: 'Prove programs',
    essay: 'prove-programs',
    blurb: 'Contracts, weakest preconditions, loop invariants, quantifiers, abstraction and the heap.',
    chapters: [
      { slug: 'specifications-and-contracts', number: '16', title: 'Specifications and contracts', summary: 'Requires and ensures, modular verification, and a spec adversary that hunts for holes.', flagship: 'Spec adversary', engines: ['vcgen', 'smt'], year: 1986, event: 'Design by contract' },
      { slug: 'weakest-preconditions', number: '17', title: 'Weakest preconditions', summary: 'Hoare triples, the wp calculus and verification conditions.', flagship: 'wp stepper', engines: ['vcgen', 'smt'], year: 1969, event: 'Hoare’s axiomatic basis' },
      { slug: 'loop-invariants', number: '18', title: 'Loop invariants and termination', summary: 'The missing piece, the three lights, counterexamples to induction and the Zune freeze.', flagship: 'Invariant workshop', engines: ['vcgen', 'smt'], year: 1967, event: 'Floyd’s inductive assertions' },
      { slug: 'quantifiers-ghosts-and-lemmas', number: '19', title: 'Quantifiers, ghosts and lemmas', summary: 'Sortedness and permutations, triggers and matching loops, lemmas as recursive proofs.', flagship: 'Proof debugger', engines: ['vcgen', 'smt'], year: 2015, event: 'KeY finds the TimSort bug' },
      { slug: 'data-abstraction', number: '20', title: 'Data abstraction and refinement', summary: 'Representation invariants, abstraction functions and the simulation square.', flagship: 'Abstraction view', engines: ['vcgen', 'smt'], year: 1972, event: 'Hoare: proof of correctness of data representations' },
      { slug: 'the-heap', number: '21', title: 'The heap: separation logic', summary: 'Aliasing, the frame problem, points-to and the separating conjunction.', flagship: 'Heap diagrams', engines: ['heap'], year: 2002, event: 'Reynolds’ separation logic' },
      { slug: 'linked-structures-and-ownership', number: '22', title: 'Linked structures and ownership', summary: 'List segments, symbolic heaps, memory safety, and ownership as permission accounting.', flagship: 'Symbolic heap stepper', engines: ['heap'], year: 2015, event: 'Infer is open-sourced' },
    ],
  },
  {
    id: 'V',
    title: 'Prove systems',
    essay: 'prove-systems',
    blurb: 'Inductive invariants for transition systems: strengthened by hand, found by IC3, and proved for any number of nodes.',
    chapters: [
      { slug: 'inductive-invariants', number: '23', title: 'Inductive invariants', summary: 'Why “holds in every reachable state” is not “inductive”, CTIs and k-induction.', flagship: 'Invariant workshop (systems)', engines: ['kind', 'sat', 'smt'], year: 2000, event: 'k-induction' },
      { slug: 'ic3', number: '24', title: 'IC3: the machine finds the invariant', summary: 'Frames, relative induction and generalisation.', flagship: 'IC3 stepper', optional: true, engines: ['ic3', 'sat'], year: 2011, event: 'Bradley’s IC3' },
      { slug: 'for-every-n', number: '25', title: 'For every N', summary: 'Parameterised protocols, decidable fragments and the invariant for any number of nodes.', flagship: 'Parameterised workshop', engines: ['param', 'smt'], year: 2016, event: 'Ivy' },
    ],
  },
  {
    id: 'VI',
    title: 'Approximate',
    essay: 'approximate',
    blurb: 'Abstract interpretation: compute invariants automatically by giving up precision, never soundness.',
    chapters: [
      { slug: 'abstract-interpretation', number: '26', title: 'Abstract interpretation', summary: 'Signs, intervals, lattices, widening, false alarms, Ariane 5 and Astrée.', flagship: 'Interval analyser', engines: ['absint'], year: 1977, event: 'Cousot and Cousot' },
      { slug: 'better-abstractions', number: '27', title: 'Better abstractions', summary: 'Octagons, polyhedra, predicate abstraction and CEGAR.', flagship: 'Domain comparison', optional: true, engines: ['absint', 'smt'], year: 2000, event: 'CEGAR' },
    ],
  },
  {
    id: 'VII',
    title: 'Trust',
    essay: 'trust',
    blurb: 'Assemble a verified system, then ask what was actually proved.',
    chapters: [
      { slug: 'the-verified-ledger', number: '28', title: 'Capstone: the verified Ledger', summary: 'Specification, protocol and implementation, each checked, and the gaps between them.', flagship: 'Ledger dashboard', engines: ['explore', 'param', 'vcgen', 'heap', 'absint'], year: 2015, event: 'IronFleet' },
      { slug: 'what-did-we-prove', number: '29', title: 'What did we prove?', summary: 'Trusted computing bases, specification bugs, and bugs in verified systems.', flagship: 'TCB map', engines: [], year: 2011, event: 'Csmith tests CompCert' },
    ],
  },
  {
    id: 'E',
    title: 'Epilogue',
    blurb: 'The landscape of real tools, and where to go next.',
    chapters: [
      { slug: 'the-landscape', number: '30', title: 'The landscape', summary: 'Which tool when, how they relate, and where to go next.', flagship: 'Tool chooser', engines: [], year: 2007, event: 'Turing Award for model checking' },
    ],
  },
];

export interface AppendixEntry {
  slug: string;
  number: string;
  title: string;
  summary: string;
}

export const APPENDICES: AppendixEntry[] = [
  { slug: 'logic-primer', number: 'A', title: 'Logic primer', summary: 'Propositional and first-order logic, sets and relations, induction.' },
  { slug: 'vouch-reference', number: 'B', title: 'Vouch reference', summary: 'The language at a glance: types, statements, specifications, systems and worlds.' },
  { slug: 'the-engines', number: 'C', title: 'The engines', summary: 'What each engine checks, its limits and its certificate.' },
  { slug: 'bug-museum', number: 'D', title: 'The bug museum', summary: 'Historic failures and where the course re-enacts them.' },
  { slug: 'rosetta', number: 'E', title: 'Rosetta', summary: 'The same small examples in Vouch, Dafny, TLA+, Alloy, SMT-LIB, Viper and ACSL.' },
  { slug: 'timeline-and-family-tree', number: 'F', title: 'Timeline and family tree', summary: 'The history of the field, and how its tools descend from one another.' },
  { slug: 'glossary-and-bibliography', number: 'G', title: 'Glossary and bibliography', summary: 'Every term and every source.' },
];

/** The three reading paths of PLAN §4 (chapter slugs, in order). */
export const READING_PATHS: { id: string; title: string; blurb: string; chapters: string[] }[] = [
  {
    id: 'code',
    title: 'Verify my code',
    blurb: 'Contracts, invariants and static analysis for the code you write.',
    chapters: ['for-all-inputs', 'symbolic-execution', 'specifications-and-contracts', 'weakest-preconditions', 'loop-invariants', 'quantifiers-ghosts-and-lemmas', 'data-abstraction', 'abstract-interpretation', 'what-did-we-prove'],
  },
  {
    id: 'systems',
    title: 'Distributed systems',
    blurb: 'Model concurrent and distributed systems, then prove them for any size.',
    chapters: ['for-all-inputs', 'state-machines', 'interleavings', 'eventually', 'messages-and-failures', 'the-adversary', 'inductive-invariants', 'for-every-n', 'the-verified-ledger', 'what-did-we-prove'],
  },
  {
    id: 'tools',
    title: 'How the tools work',
    blurb: 'Open up SAT and SMT solvers, verification-condition generators, IC3 and abstract interpreters.',
    chapters: ['for-all-inputs', 'propositional-encoding', 'inside-a-sat-solver', 'proofs-of-unsatisfiability', 'unrolling-time', 'decision-diagrams', 'equality-and-functions', 'arithmetic', 'bits-and-arrays', 'weakest-preconditions', 'ic3', 'abstract-interpretation', 'better-abstractions'],
  },
];
