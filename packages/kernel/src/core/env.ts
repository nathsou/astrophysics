// Global environment (signature) and local contexts.

import type { Expr } from './expr.ts';
import { type Features, defaultFeatures } from './calculus.ts';

export interface RecursorRule {
  ctor: string;
  nfields: number;
  /** closed term: λ params motives minors fields, rhs */
  rhs: Expr;
}

interface DeclBase {
  name: string;
  levelParams: string[];
  type: Expr;
  /** free-form documentation shown on hover */
  doc?: string;
  /** declared by the prelude / system rather than the user */
  builtin?: boolean;
}

export type Decl =
  | (DeclBase & { kind: 'axiom' })
  | (DeclBase & { kind: 'def'; value: Expr; height: number; compiled?: { recursive: boolean; decreasing?: number; argName?: string } })
  | (DeclBase & { kind: 'theorem'; value: Expr })
  | (DeclBase & { kind: 'opaque'; value: Expr })
  | (DeclBase & {
      kind: 'inductive';
      numParams: number;
      numIndices: number;
      ctors: string[];
      isRec: boolean;
      /** names of all types declared in the same mutual block */
      all: string[];
      /** Prop-valued inductive restricted to eliminating into Prop */
      elimOnlyProp: boolean;
      isStructure: boolean;
      /** projection functions (structure-like types only) */
      projs?: string[];
      /** field names given in a `structure` declaration */
      fieldNames?: string[];
    })
  | (DeclBase & { kind: 'ctor'; induct: string; cidx: number; numParams: number; numFields: number })
  | (DeclBase & {
      kind: 'rec';
      induct: string;
      all: string[];
      numParams: number;
      numIndices: number;
      numMotives: number;
      numMinors: number;
      rules: RecursorRule[];
      /** K-like reduction (Eq-style) */
      k: boolean;
      /** index of the major premise in the argument list */
      majorIdx: number;
    })
  | (DeclBase & { kind: 'quot'; quotKind: 'type' | 'mk' | 'lift' | 'ind' });

export type DeclKind = Decl['kind'];

export class Environment {
  private decls = new Map<string, Decl>();
  private order: string[] = [];
  features: Features;
  /** notation table shared with the parser */
  notations: Notation[] = [];
  /** namespaces opened with `open` */
  opened: string[] = [];

  constructor(features: Features = defaultFeatures) {
    this.features = { ...features };
  }

  get(name: string): Decl | undefined {
    return this.decls.get(name);
  }

  has(name: string): boolean {
    return this.decls.has(name);
  }

  add(d: Decl): void {
    if (this.decls.has(d.name)) throw new Error(`'${d.name}' has already been declared`);
    this.decls.set(d.name, d);
    this.order.push(d.name);
  }

  /** replace an existing declaration (used by the elaborator to attach docs) */
  update(d: Decl): void {
    this.decls.set(d.name, d);
  }

  all(): Decl[] {
    return this.order.map((n) => this.decls.get(n)!);
  }

  clone(): Environment {
    const e = new Environment(this.features);
    e.decls = new Map(this.decls);
    e.order = [...this.order];
    e.notations = [...this.notations];
    e.opened = [...this.opened];
    return e;
  }
}

export interface Notation {
  kind: 'infixl' | 'infixr' | 'prefix' | 'infix';
  symbol: string;
  prec: number;
  /** name of the function the notation stands for */
  target: string;
}

// ---------------------------------------------------------------------------
// local contexts

export interface LocalDecl {
  id: number;
  name: string;
  type: Expr;
  value?: Expr;
  binfo?: import('./expr.ts').BinderInfo;
}

let fvarCounter = 1;
export const freshFVarId = (): number => fvarCounter++;

/** An immutable, persistent local context. */
export class LocalContext {
  private constructor(
    readonly decls: readonly LocalDecl[],
    private readonly index: ReadonlyMap<number, LocalDecl>,
  ) {}

  static empty = new LocalContext([], new Map());

  push(d: LocalDecl): LocalContext {
    const m = new Map(this.index);
    m.set(d.id, d);
    return new LocalContext([...this.decls, d], m);
  }

  get(id: number): LocalDecl | undefined {
    return this.index.get(id);
  }

  get size(): number {
    return this.decls.length;
  }

  /** find a local by user-facing name (innermost first) */
  findByName(name: string): LocalDecl | undefined {
    for (let i = this.decls.length - 1; i >= 0; i--) if (this.decls[i].name === name) return this.decls[i];
    return undefined;
  }
}
