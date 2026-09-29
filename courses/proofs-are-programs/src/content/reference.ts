// Data for the reference pages.

export interface TacticDoc {
  name: string;
  syntax: string[];
  what: string;
  /** the proof term it writes */
  term: string;
  example?: string;
  ch: string;
}

export const tactics: TacticDoc[] = [
  { name: 'intro', syntax: ['intro x y', 'intro ⟨a, b⟩', 'intro (h | h)'], what: 'Introduces the hypotheses of a goal of the form ∀ x, … or p → … (¬p counts: it means p → False). Patterns destructure what is introduced, like rintro.', term: 'fun x => ?goal', example: 'example (p q : Prop) : p → q → p := by\n  intro hp hq\n  exact hp', ch: 'tactics' },
  { name: 'intros', syntax: ['intros', 'intros x y'], what: 'Introduces all the leading hypotheses (with inaccessible names unless names are given).', term: 'fun x y … => ?goal', ch: 'toolbox' },
  { name: 'rintro', syntax: ['rintro ⟨x, hx⟩ (h | h) rfl'], what: 'Introduces and destructures at once: ⟨…⟩ splits a structure, (a | b) splits a disjunction into two goals, rfl substitutes an equation.', term: 'fun x => match x with …', ch: 'toolbox' },
  { name: 'exact', syntax: ['exact e'], what: 'Closes the goal with the term e, which must have exactly the goal’s type (up to computation).', term: 'e', example: 'example (p : Prop) (hp : p) : p := by exact hp', ch: 'tactics' },
  { name: 'apply', syntax: ['apply f'], what: 'Works backwards: if f : A₁ → … → Aₙ → C and C matches the goal, the goal is replaced by A₁, …, Aₙ (the arguments that unification could not determine).', term: 'f ?a₁ … ?aₙ', example: 'example (p q : Prop) (hp : p) (hq : q) : p ∧ q := by\n  apply And.intro\n  · exact hp\n  · exact hq', ch: 'tactics' },
  { name: 'refine', syntax: ['refine ⟨?_, ?_⟩', 'refine f ?_ x'], what: 'Like exact, but the term may contain holes ?_ (or named ?x): they become the new goals.', term: 'the term, with its holes as goals', ch: 'tactics' },
  { name: 'constructor', syntax: ['constructor'], what: 'Applies the first constructor of the goal’s inductive type that fits (for ∧: And.intro, for ↔: Iff.intro, for ∃: Exists.intro).', term: 'C.mk ?a ?b', ch: 'tactics' },
  { name: 'left / right', syntax: ['left', 'right'], what: 'For a goal with two constructors (like p ∨ q): prove it with the first (left) or the second (right).', term: 'Or.inl ?h / Or.inr ?h', ch: 'tactics' },
  { name: 'exists', syntax: ['exists 3', 'exists a, b'], what: 'Provides the witnesses of an existential goal, then tries trivial on what remains.', term: '⟨3, ?h⟩', ch: 'toolbox' },
  { name: 'exfalso', syntax: ['exfalso'], what: 'Replaces the goal by False: from a contradiction, anything follows.', term: 'False.elim ?h', ch: 'toolbox' },
  { name: 'cases', syntax: ['cases h', 'cases h with\n| inl hp => tac\n| inr hq => tac'], what: 'Case analysis on a value of an inductive type: one goal per constructor, with its fields as new hypotheses. On an equation between constructors it performs injection and substitution; impossible cases disappear.', term: 'match h with | … => ?goal₁ | … => ?goal₂', ch: 'toolbox' },
  { name: 'rcases / obtain', syntax: ['rcases h with ⟨x, hx⟩ | h', 'obtain ⟨x, hx⟩ := h'], what: 'Case analysis with nested patterns. obtain pattern := e is the same, for an arbitrary term e.', term: 'nested matches', ch: 'toolbox' },
  { name: 'induction', syntax: ['induction n with\n| zero => tac\n| succ n ih => tac', 'induction xs generalizing acc'], what: 'Proof by induction: one goal per constructor, with an induction hypothesis for each recursive field. generalizing reverts variables first, so that the hypothesis is about all their values.', term: 'T.rec ?zero ?succ n', ch: 'induction' },
  { name: 'rfl', syntax: ['rfl'], what: 'Closes a goal a = a (also ↔ and ≤) when both sides compute to the same thing.', term: 'rfl', ch: 'equality' },
  { name: 'rw', syntax: ['rw [h]', 'rw [← h, foo] at h₂'], what: 'Rewrites with equations (and ↔), left to right (← for right to left), in the goal or at hypotheses; then tries rfl. A definition name rewrites with its equation lemmas.', term: 'Eq.mpr (congrArg (fun x => …) h) ?goal', ch: 'equality' },
  { name: 'simp', syntax: ['simp', 'simp [h, f]', 'simp only [h]', 'simp at h', 'simp [*] at *'], what: 'Rewrites to a normal form with the @[simp] lemmas, the given lemmas and definitions (their equations), until nothing applies; closes the goal if it becomes True. Also computes with numerals and decides small closed propositions.', term: 'Eq.mpr (a chain of congruence proofs) ?goal, or of_eq_true …', ch: 'automation' },
  { name: 'simp_all', syntax: ['simp_all'], what: 'Simplifies every hypothesis and the goal with each other.', term: 'as simp', ch: 'automation' },
  { name: 'unfold', syntax: ['unfold f', 'unfold f at h'], what: 'Unfolds a definition (using its equation lemmas when it is defined by pattern matching).', term: 'as simp only', ch: 'toolbox' },
  { name: 'decide', syntax: ['decide'], what: 'Proves a proposition that has a Decidable instance by running the decision procedure: the kernel checks that it returns true.', term: 'of_decide_eq_true rfl', ch: 'automation' },
  { name: 'omega', syntax: ['omega'], what: 'Linear arithmetic over the natural numbers: combines hypotheses and the negated goal into a contradiction. The proof is built by reflection (Chapter 19). This version reasons over the rationals, so facts that need integrality (like 2x ≠ 1) are out of reach.', term: 'Omega.contra ρ A B rfl (…)', ch: 'automation' },
  { name: 'have', syntax: ['have h : T := e', 'have h : T := by tac', 'have h : T'], what: 'Adds a hypothesis. Without := the proof of T becomes the first goal.', term: '(fun h => ?goal) e', ch: 'toolbox' },
  { name: 'suffices', syntax: ['suffices h : T by tac', 'suffices h : T from e'], what: 'Reduces the goal to T: the original goal is proved using h : T, and T remains to be proved.', term: '(fun h => proof of goal) ?T', ch: 'toolbox' },
  { name: 'show / change', syntax: ['show T', 'change T at h'], what: 'Replaces the goal (or a hypothesis) by something definitionally equal — the same after computation.', term: '?goal (no proof needed: the kernel sees the same type)', ch: 'toolbox' },
  { name: 'calc', syntax: ['calc a = b := p\n  _ ≤ c := q'], what: 'A chain of equations and inequalities, each step with its proof.', term: 'Eq.trans p q, Nat.le_trans …', ch: 'toolbox' },
  { name: 'specialize', syntax: ['specialize h x'], what: 'Replaces a hypothesis h : ∀ x, P x by h : P x.', term: '(fun h => ?goal) (h x)', ch: 'toolbox' },
  { name: 'subst', syntax: ['subst h', 'subst x'], what: 'Uses an equation x = e (or e = x) with x a variable to replace x everywhere.', term: 'match h with | rfl => ?goal', ch: 'equality' },
  { name: 'contradiction', syntax: ['contradiction'], what: 'Closes the goal if the hypotheses are contradictory: False, p together with ¬p, a ≠ a, or an equation between different constructors.', term: 'absurd h h′, nomatch h, …', ch: 'toolbox' },
  { name: 'assumption', syntax: ['assumption'], what: 'Closes the goal with a hypothesis of the same type.', term: 'h', ch: 'toolbox' },
  { name: 'trivial', syntax: ['trivial'], what: 'Tries rfl, assumption, True.intro, decide and splitting ∧.', term: 'one of those', ch: 'toolbox' },
  { name: 'by_cases', syntax: ['by_cases h : p'], what: 'Case split on a decidable proposition: one goal with h : p, one with h : ¬p.', term: 'match (inst : Decidable p) with | isTrue h => … | isFalse h => …', ch: 'predicates' },
  { name: 'split', syntax: ['split'], what: 'Splits a goal containing if … then … else … into the two branches.', term: 'match on the Decidable instance', ch: 'predicates' },
  { name: 'generalize', syntax: ['generalize h : e = x'], what: 'Replaces e by a new variable x (remembering h : e = x).', term: '?goal′ e rfl', ch: 'accumulators' },
  { name: 'revert / clear', syntax: ['revert h', 'clear h'], what: 'revert moves a hypothesis back into the goal (as ∀ or →); clear forgets one.', term: '?goal′ h', ch: 'accumulators' },
  { name: 'funext', syntax: ['funext x'], what: 'To prove two functions equal, prove them equal at an arbitrary x.', term: 'funext (fun x => ?goal)', ch: 'equality' },
  { name: 'sorry', syntax: ['sorry'], what: 'Gives up on the goal (with a warning): the proof uses the axiom sorryAx, which proves anything.', term: 'sorryAx T', ch: 'tactics' },
  { name: '· / case / next', syntax: ['· tac', 'case succ n ih => tac', 'next => tac'], what: 'Focus on one goal: the first one (· and next) or the one with a given tag (case). The goal must be closed at the end.', term: '(structure only)', ch: 'toolbox' },
  { name: '<;> / all_goals / any_goals / try / repeat / first', syntax: ['constructor <;> assumption', 'all_goals simp', 'try rfl', 'repeat constructor', 'first | rfl | simp'], what: 'Combinators: run a tactic on every goal produced by another (<;>) or on every goal (all_goals); ignore failure (try); repeat until failure; try alternatives in order (first).', term: '(structure only)', ch: 'toolbox' },
];

export interface SyntaxDoc {
  what: string;
  syntax: string;
  note: string;
  ch: string;
}

export const language: SyntaxDoc[] = [
  { what: 'Definition', syntax: 'def f (x : Nat) : Nat := x + 1', note: 'A named term. Recursive definitions must use pattern matching and structural recursion.', ch: 'programs' },
  { what: 'Pattern matching', syntax: 'def f : Nat → Nat\n  | 0 => 1\n  | n + 1 => 2 * f n', note: 'Equations are compiled to recursors; each case gets an equation lemma f.eq_i, used by simp [f], rw [f] and unfold f.', ch: 'programs' },
  { what: 'Inductive type', syntax: 'inductive Tree where\n  | leaf\n  | node (l : Tree) (x : Nat) (r : Tree)', note: 'Constructors, recursor Tree.rec and Tree.casesOn are generated. Add deriving DecidableEq to be able to test equality.', ch: 'programs' },
  { what: 'Structure', syntax: 'structure Point where\n  x : Nat\n  y : Nat', note: 'An inductive type with one constructor (Point.mk) and projections p.x, p.y. Build with ⟨1, 2⟩.', ch: 'programs' },
  { what: 'Theorem', syntax: 'theorem t (n : Nat) : n + 0 = n := rfl', note: 'Like def, but the type must be a proposition. The value is the proof.', ch: 'evidence' },
  { what: 'Tactic block', syntax: 'theorem t : p ∧ q → q ∧ p := by\n  intro ⟨hp, hq⟩\n  exact ⟨hq, hp⟩', note: 'by starts a tactic block; tactics are separated by new lines at the same column, or by ;.', ch: 'tactics' },
  { what: 'Anonymous constructor', syntax: '⟨a, b⟩', note: 'Builds a value of the expected type, if it has exactly one constructor (∧, ∃, ↔, structures).', ch: 'proof-terms' },
  { what: 'if', syntax: 'if x ≤ y then a else b\nif h : x ≤ y then a else b', note: 'Needs a Decidable instance for the condition. The second form names the proof of the condition in each branch.', ch: 'predicates' },
  { what: 'Lists', syntax: '[1, 2, 3]   x :: xs   xs ++ ys', note: ':: is List.cons (it binds tighter than +: write (a + b) :: s).', ch: 'programs' },
  { what: 'Pairs', syntax: '(a, b)   p.1   p.2', note: 'Prod.mk a b.', ch: 'programs' },
  { what: 'Run a program', syntax: '#eval f 10', note: 'Compiles the term with types and proofs erased, and runs it (numbers are native big integers).', ch: 'programs' },
  { what: 'Test a statement', syntax: '#test ∀ (xs : List Nat), rev (rev xs) = xs', note: 'Evaluates a decidable statement on 100 random inputs and reports a counterexample. Evidence, not proof.', ch: 'interpreter' },
  { what: 'Type of a term', syntax: '#check f', note: 'Shows the type.', ch: 'programs' },
  { what: 'Reduce', syntax: '#reduce f 3', note: 'Normalises with the kernel’s own reduction (slow, but shows the definitional computation).', ch: 'equality' },
  { what: 'Axioms used', syntax: '#print axioms t', note: 'Lists the axioms a declaration depends on (propext, Quot.sound, Classical.choice, sorryAx).', ch: 'limits' },
  { what: 'Class and instance', syntax: 'class Size (α : Type) where\n  size : α → Nat\ninstance : Size Nat := ⟨fun n => n⟩', note: 'Instance arguments [inst : C α] are found by type-class resolution.', ch: 'predicates' },
  { what: 'Rewriting notation', syntax: 'h ▸ e', note: 'Rewrites the type of e with the equation h, in whichever direction makes it fit the expected type.', ch: 'equality' },
  { what: 'Attribute', syntax: '@[simp] theorem …', note: 'Adds the theorem to the default simp set.', ch: 'automation' },
];

export interface DictRow {
  logic: string;
  types: string;
  syntax: string;
  ch: string;
}

export const dictionary: DictRow[] = [
  { logic: 'proposition', types: 'type (in Prop)', syntax: 'p : Prop', ch: 'evidence' },
  { logic: 'proof', types: 'program (a value of the type)', syntax: 'h : p', ch: 'evidence' },
  { logic: 'implication p → q', types: 'function type', syntax: 'fun hp => …', ch: 'evidence' },
  { logic: 'conjunction p ∧ q', types: 'pair (a structure)', syntax: '⟨hp, hq⟩, h.1, h.2', ch: 'evidence' },
  { logic: 'disjunction p ∨ q', types: 'tagged union (two constructors)', syntax: 'Or.inl hp, match h with …', ch: 'evidence' },
  { logic: 'truth True', types: 'unit type (one constructor)', syntax: 'True.intro', ch: 'evidence' },
  { logic: 'falsity False', types: 'empty type (no constructors)', syntax: 'nomatch h', ch: 'evidence' },
  { logic: 'negation ¬p', types: 'function into the empty type', syntax: 'fun hp => …', ch: 'evidence' },
  { logic: 'universal ∀ x, P x', types: 'dependent function type', syntax: 'fun x => …', ch: 'quantifiers' },
  { logic: 'existential ∃ x, P x', types: 'dependent pair (in Prop)', syntax: '⟨w, hw⟩', ch: 'quantifiers' },
  { logic: 'equality a = b', types: 'inductive family with one constructor, refl', syntax: 'rfl, h ▸ e', ch: 'equality' },
  { logic: 'modus ponens', types: 'application', syntax: 'f hp', ch: 'evidence' },
  { logic: 'case analysis', types: 'pattern matching', syntax: 'match h with …, cases h', ch: 'proof-terms' },
  { logic: 'proof by induction', types: 'structural recursion', syntax: 'induction n, recursive theorem', ch: 'induction' },
  { logic: 'lemma', types: 'auxiliary function', syntax: 'have h : p := …', ch: 'toolbox' },
  { logic: 'simplifying a proof (cut elimination)', types: 'running the program (β-reduction)', syntax: '#reduce', ch: 'proof-terms' },
  { logic: 'consistency', types: 'no closed program of the empty type', syntax: 'no proof of False', ch: 'termination' },
  { logic: 'excluded middle p ∨ ¬p', types: 'no program: needs an axiom', syntax: 'Classical.em p', ch: 'limits' },
  { logic: 'decidable proposition', types: 'a program returning evidence either way', syntax: 'Decidable p', ch: 'predicates' },
  { logic: 'specification', types: 'type of a program', syntax: '{ xs // Sorted xs }', ch: 'typed-language' },
];

export interface GlossaryEntry {
  term: string;
  def: string;
  ch?: string;
}

export const glossary: GlossaryEntry[] = [
  { term: 'Curry–Howard correspondence', def: 'The observation that propositions correspond to types and proofs to programs, so that checking a proof is type checking a program.', ch: 'evidence' },
  { term: 'Prop', def: 'The sort of propositions. Its types are propositions; their values are proofs. Proofs are erased when programs run, and two proofs of the same proposition are considered equal.', ch: 'evidence' },
  { term: 'inhabitant', def: 'A value of a type. A proposition is provable exactly when it has an inhabitant.', ch: 'promises' },
  { term: 'kernel', def: 'The small, trusted part of a proof checker that checks the terms produced by everything else.', ch: 'tactics' },
  { term: 'elaborator', def: 'The (untrusted) part of the system that turns what you write — with implicit arguments, pattern matching, tactics — into explicit terms for the kernel.', ch: 'tactics' },
  { term: 'goal', def: 'A hole in a proof term that remains to be filled, shown with its hypotheses and its type (after ⊢).', ch: 'tactics' },
  { term: 'tactic', def: 'A program that fills a goal with a term, possibly with new goals as holes.', ch: 'tactics' },
  { term: 'definitional equality', def: 'Equality by computation: two terms are definitionally equal if they reduce to the same thing. rfl proves exactly these equations.', ch: 'equality' },
  { term: 'propositional equality', def: 'The type a = b. Proved by rfl when the sides are definitionally equal, and otherwise by reasoning (rewriting, induction).', ch: 'equality' },
  { term: 'recursor', def: 'The eliminator of an inductive type, T.rec: at once the recursion scheme for programs and the induction principle for proofs.', ch: 'induction' },
  { term: 'structural recursion', def: 'Recursion in which each recursive call is on a constructor field of the argument being matched. It always terminates.', ch: 'termination' },
  { term: 'induction hypothesis', def: 'In a proof by induction, the statement for the smaller value; in the proof term, the result of the recursive call.', ch: 'induction' },
  { term: 'generalizing', def: 'Making the induction hypothesis quantify over a variable (reverting it before the induction), so that it can be used at other values of that variable.', ch: 'accumulators' },
  { term: 'inductive predicate', def: 'A proposition defined by constructors (rules), such as Even or Sorted. Its proofs are derivation trees.', ch: 'predicates' },
  { term: 'decidable', def: 'A proposition p is decidable if there is a program returning a proof of p or a proof of ¬p. The class Decidable p holds such programs.', ch: 'predicates' },
  { term: 'erasure', def: 'Removing types and proofs from a program before running it: they cannot influence the result.', ch: 'programs' },
  { term: 'axiom', def: 'A constant assumed without proof. The course’s standard library uses propext, Quot.sound and (in Chapter 7) Classical.choice; sorry uses sorryAx.', ch: 'limits' },
  { term: 'constructive', def: 'A proof is constructive if it only uses the rules of the type theory, without classical axioms: from a constructive proof of ∃ x, P x one can compute the witness.', ch: 'limits' },
  { term: 'Kripke model', def: 'A model of intuitionistic logic: worlds ordered by "later", in which a proposition, once true, stays true. Used to show that excluded middle is not provable.', ch: 'limits' },
  { term: 'equation lemma', def: 'f.eq_1, f.eq_2, …: one equation per case of a definition by pattern matching, proved by rfl and used by simp [f] and rw [f].', ch: 'automation' },
  { term: 'reflection', def: 'Proving by computing: write a checker, prove it sound once, and then prove each instance by running the checker inside the kernel.', ch: 'reflection' },
  { term: 'intrinsic typing', def: 'Indexing the syntax of a language by its types, so that only well-typed terms can be written.', ch: 'typed-language' },
  { term: 'progress and preservation', def: 'The two halves of type safety: a well-typed term is a value or can take a step, and a step preserves its type.', ch: 'typed-language' },
  { term: 'bidirectional type checking', def: 'Type checking with two modes: inferring the type of some terms, checking others against a known type.', ch: 'kernel' },
  { term: 'normalisation by evaluation', def: 'Deciding definitional equality by evaluating terms into a semantic domain (closures) and reading the values back as normal forms.', ch: 'kernel' },
  { term: 'universe', def: 'A type of types: Type, Type 1, … Type : Type is inconsistent (Girard’s paradox), hence the hierarchy.', ch: 'kernel' },
];

export interface Reading {
  cite: string;
  note: string;
  url?: string;
}

export const reading: Reading[] = [
  { cite: 'W. A. Howard. The formulae-as-types notion of construction (1969, published 1980).', note: 'The paper that gave the correspondence its name.' },
  { cite: 'P. Wadler. Propositions as Types. Communications of the ACM, 2015.', note: 'A short and very readable history of the correspondence.', url: 'https://homepages.inf.ed.ac.uk/wadler/papers/propositions-as-types/propositions-as-types.pdf' },
  { cite: 'J. Avigad, L. de Moura, S. Kong, S. Ullrich. Theorem Proving in Lean 4.', note: 'The reference introduction to Lean 4, whose design this course’s language follows.', url: 'https://lean-lang.org/theorem_proving_in_lean4/' },
  { cite: 'D. T. Christiansen. Functional Programming in Lean.', note: 'Lean 4 as a programming language.', url: 'https://lean-lang.org/functional_programming_in_lean/' },
  { cite: 'B. C. Pierce et al. Software Foundations.', note: 'Proving programs correct, from logic to type systems (in Coq/Rocq). Volume 2 covers type safety.', url: 'https://softwarefoundations.cis.upenn.edu/' },
  { cite: 'A. Chlipala. Certified Programming with Dependent Types. MIT Press, 2013.', note: 'Dependent types for verified programming, including proof by reflection.', url: 'http://adam.chlipala.net/cpdt/' },
  { cite: 'J. McCarthy and J. Painter. Correctness of a compiler for arithmetic expressions (1967).', note: 'The first compiler correctness proof — the theorem of Chapter 17.' },
  { cite: 'X. Leroy. Formal verification of a realistic compiler. Communications of the ACM, 2009.', note: 'CompCert: the same idea, for C.' },
  { cite: 'T. Nipkow and G. Klein. Concrete Semantics. Springer, 2014.', note: 'Semantics and verified compilers in Isabelle.', url: 'http://concrete-semantics.org/' },
  { cite: 'A. Abel. Normalization by Evaluation: Dependent Types and Impredicativity (habilitation, 2013).', note: 'The theory behind Chapter 21’s type checker.' },
  { cite: 'A. Kovács. elaboration-zoo.', note: 'Small, clear implementations of dependent type checkers with normalisation by evaluation.', url: 'https://github.com/AndrasKovacs/elaboration-zoo' },
  { cite: 'D. Christiansen. Checking Dependent Types with Normalization by Evaluation: A Tutorial.', note: 'A tutorial on the technique of Chapter 21.', url: 'https://davidchristiansen.dk/tutorials/nbe/' },
  { cite: 'W. Pugh. The Omega test: a fast and practical integer programming algorithm for dependence analysis, 1991.', note: 'The algorithm behind Lean’s omega (ours is a smaller cousin).' },
  { cite: 'S. Kripke. Semantical analysis of intuitionistic logic I (1965).', note: 'The models used in Chapter 7.' },
  { cite: 'The Calculus of Inductive Constructions — the companion course on this site.', note: 'How the kernel that checks everything in this course works.', url: '../cic/' },
];
