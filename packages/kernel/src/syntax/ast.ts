// Surface syntax trees produced by the parser and consumed by the elaborator.

export interface Span {
  from: number;
  to: number;
}

export type SLevel =
  | { k: 'num'; n: number }
  | { k: 'param'; name: string }
  | { k: 'succ'; l: SLevel; n: number }
  | { k: 'max'; args: SLevel[] }
  | { k: 'imax'; args: SLevel[] }
  | { k: 'hole' };

export type BinderKind = 'default' | 'implicit' | 'strictImplicit' | 'inst';

export interface SBinder {
  names: { name: string; span: Span }[];
  type?: STerm;
  binfo: BinderKind;
  span: Span;
}

export interface SArg {
  named?: string;
  arg: STerm;
}

export interface SAlt {
  pats: STerm[];
  rhs: STerm;
  span: Span;
}

export type STerm = { span: Span } & (
  | { k: 'ident'; name: string; levels?: SLevel[]; explicit: boolean; /** a notation's target: a global name, never a local or a namespace member */ root?: boolean }
  | { k: 'dotIdent'; name: string }
  | { k: 'sort'; sort: 'Prop' | 'Type' | 'Sort' | 'star' | 'box'; level?: SLevel }
  | { k: 'app'; fn: STerm; args: SArg[] }
  | { k: 'lam'; binders: SBinder[]; body: STerm }
  | { k: 'pi'; binders: SBinder[]; body: STerm; style: 'forall' | 'pi' | 'arrow' }
  | { k: 'arrow'; dom: STerm; cod: STerm }
  | { k: 'exists'; binders: SBinder[]; body: STerm }
  | { k: 'let'; name: string; nameSpan: Span; binders: SBinder[]; type?: STerm; value: STerm; body: STerm }
  | { k: 'hole' }
  | { k: 'synthHole'; name: string }
  | { k: 'sorry' }
  | { k: 'num'; value: number }
  | { k: 'anon'; args: STerm[] }
  | { k: 'structInst'; fields: { name: string; nameSpan: Span; value: STerm }[] }
  | { k: 'ascribe'; term: STerm; type: STerm }
  | { k: 'match'; discrs: STerm[]; motive?: STerm; alts: SAlt[]; /** `match h : e with`: h names the equation e = pattern */ discrNames?: (string | undefined)[] }
  | { k: 'proj'; term: STerm; field: string; fieldSpan: Span }
  | { k: 'paren'; term: STerm }
  | { k: 'show'; type: STerm; term: STerm }
  | { k: 'by'; tac: Tactic }
  | { k: 'if'; name?: string; nameSpan?: Span; cond: STerm; then: STerm; else: STerm }
  | { k: 'have'; name: string; nameSpan: Span; binders: SBinder[]; type?: STerm; value: STerm; body: STerm }
  | { k: 'calc'; steps: SCalcStep[] }
  | { k: 'subst'; eq: STerm; term: STerm }
  | { k: 'lamPat'; pats: STerm[]; body: STerm }
  /** an already elaborated term (used internally to build syntax around core terms) */
  | { k: 'elaborated'; e: import('../core/expr.ts').Expr; type?: import('../core/expr.ts').Expr }
);

export interface SCalcStep {
  /** `a = b`, or `_ = c` for every step but the first */
  rel: STerm;
  proof: STerm;
  span: Span;
}

// ---------------------------------------------------------------------------
// tactics

/** patterns of rintro / rcases / obtain */
export type RPat = { span: Span } & (
  | { k: 'var'; name: string }
  | { k: 'wild' }
  | { k: 'rfl' }
  | { k: 'tuple'; pats: RPat[] }
  | { k: 'alts'; pats: RPat[] }
  | { k: 'typed'; pat: RPat; type: STerm }
);

export interface TacAlt {
  /** constructor name (possibly dotted, e.g. `succ` or `Nat.succ`), or `_` */
  ctor: string;
  names: { name: string; span: Span }[];
  tac: Tactic;
  span: Span;
}

export interface RwRule {
  rev: boolean;
  term: STerm;
}

export interface Location {
  hyps: { name: string; span: Span }[];
  /** `at *` */
  wildcard: boolean;
  /** the goal is included (`at h ⊢`, or no location) */
  goal: boolean;
}

export type SimpArg = { k: 'term'; term: STerm; rev: boolean } | { k: 'star' } | { k: 'erase'; name: string };

export type Tactic = { span: Span } & (
  | { k: 'seq'; tacs: Tactic[] }
  | { k: 'then'; first: Tactic; rest: Tactic }
  | { k: 'focus'; tac: Tactic }
  | { k: 'case'; tag: string; tagSpan: Span; names: { name: string; span: Span }[]; tac: Tactic }
  | { k: 'next'; names: { name: string; span: Span }[]; tac: Tactic }
  | { k: 'combinator'; name: 'all_goals' | 'any_goals' | 'try' | 'repeat' | 'focus'; tac: Tactic }
  | { k: 'first'; alts: Tactic[] }
  | { k: 'intro'; pats: RPat[] }
  | { k: 'intros'; names: { name: string; span: Span }[] }
  | { k: 'rintro'; pats: RPat[] }
  | { k: 'term'; name: 'exact' | 'apply' | 'refine' | 'specialize' | 'show' | 'change' | 'exfalso_of' | 'nomatch'; term: STerm; loc?: Location }
  | { k: 'exists'; terms: STerm[] }
  | { k: 'atom'; name: string }
  | { k: 'cases'; target: STerm; hname?: string; alts?: TacAlt[] }
  | { k: 'induction'; target: STerm; generalizing: { name: string; span: Span }[]; alts?: TacAlt[] }
  | { k: 'rcases'; target: STerm; pat: RPat }
  | { k: 'obtain'; pat: RPat; type?: STerm; value?: STerm }
  | { k: 'rw'; rules: RwRule[]; loc: Location; rfl: boolean; assumption: boolean }
  | { k: 'simp'; only: boolean; args: SimpArg[]; loc: Location; all: boolean; arith: boolean }
  | { k: 'unfold'; names: { name: string; span: Span }[]; loc: Location }
  | { k: 'have'; name?: string; nameSpan?: Span; type?: STerm; value?: STerm; pat?: RPat }
  | { k: 'suffices'; name?: string; type: STerm; tac?: Tactic; value?: STerm }
  | { k: 'calc'; term: STerm }
  | { k: 'names'; name: 'subst' | 'revert' | 'clear' | 'funext' | 'injection_names'; names: { name: string; span: Span }[] }
  | { k: 'injection'; term: STerm; names: { name: string; span: Span }[] }
  | { k: 'by_cases'; name?: string; prop: STerm }
  | { k: 'generalize'; name?: string; term: STerm; var: string }
  | { k: 'decide' }
  | { k: 'error' }
);

export type DefKind = 'def' | 'theorem' | 'example' | 'abbrev' | 'opaque';

export interface SCtor {
  name: string;
  nameSpan: Span;
  binders: SBinder[];
  type?: STerm;
  doc?: string;
}

export interface SInductive {
  /** `deriving` clause */
  deriving?: string[];
  name: string;
  nameSpan: Span;
  levelParams?: string[];
  binders: SBinder[];
  type?: STerm;
  ctors: SCtor[];
  doc?: string;
  span: Span;
}

export type Command = { span: Span; doc?: string; attrs?: string[] } & (
  | {
      k: 'def';
      kind: DefKind;
      name: string;
      nameSpan: Span;
      levelParams?: string[];
      binders: SBinder[];
      type?: STerm;
      body: { k: 'term'; term: STerm } | { k: 'equations'; alts: SAlt[] };
      termination?: { by?: STerm; names?: { name: string; span: Span }[]; decreasing?: Tactic };
    }
  | { k: 'axiom'; name: string; nameSpan: Span; levelParams?: string[]; binders: SBinder[]; type: STerm }
  | { k: 'inductive'; types: SInductive[]; isClass?: boolean }
  | {
      k: 'structure';
      name: string;
      nameSpan: Span;
      levelParams?: string[];
      binders: SBinder[];
      type?: STerm;
      ctorName?: string;
      fields: SBinder[];
      deriving?: string[];
      isClass?: boolean;
    }
  | { k: 'instance'; name?: string; nameSpan: Span; binders: SBinder[]; type: STerm; body: STerm }
  | { k: 'attribute'; attrs: string[]; names: { name: string; span: Span }[] }
  | { k: 'test'; term: STerm; samples?: number }
  | { k: 'variable'; binders: SBinder[] }
  | { k: 'universe'; names: string[] }
  | { k: 'check'; term: STerm }
  | { k: 'reduce'; term: STerm; mode: 'reduce' | 'whnf' | 'eval' }
  | { k: 'print'; name: string; axioms: boolean }
  | { k: 'notation'; kind: 'infixl' | 'infixr' | 'infix' | 'prefix'; prec: number; symbol: string; target: string }
  | { k: 'open'; names: string[] }
  | { k: 'namespace'; name: string }
  | { k: 'section'; name?: string }
  | { k: 'end'; name?: string }
  | { k: 'setOption'; name: string; value: string }
  | { k: 'initQuot' }
  | { k: 'error' }
);
