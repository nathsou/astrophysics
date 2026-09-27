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
  | { k: 'ident'; name: string; levels?: SLevel[]; explicit: boolean }
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
  | { k: 'ascribe'; term: STerm; type: STerm }
  | { k: 'match'; discrs: STerm[]; motive?: STerm; alts: SAlt[] }
  | { k: 'proj'; term: STerm; field: string; fieldSpan: Span }
  | { k: 'paren'; term: STerm }
  | { k: 'show'; type: STerm; term: STerm }
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
  name: string;
  nameSpan: Span;
  levelParams?: string[];
  binders: SBinder[];
  type?: STerm;
  ctors: SCtor[];
  doc?: string;
  span: Span;
}

export type Command = { span: Span; doc?: string } & (
  | {
      k: 'def';
      kind: DefKind;
      name: string;
      nameSpan: Span;
      levelParams?: string[];
      binders: SBinder[];
      type?: STerm;
      body: { k: 'term'; term: STerm } | { k: 'equations'; alts: SAlt[] };
    }
  | { k: 'axiom'; name: string; nameSpan: Span; levelParams?: string[]; binders: SBinder[]; type: STerm }
  | { k: 'inductive'; types: SInductive[] }
  | {
      k: 'structure';
      name: string;
      nameSpan: Span;
      levelParams?: string[];
      binders: SBinder[];
      type?: STerm;
      ctorName?: string;
      fields: SBinder[];
    }
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
