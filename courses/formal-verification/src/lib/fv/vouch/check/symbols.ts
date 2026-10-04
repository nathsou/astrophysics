/**
 * Symbols and scopes. Every name the checker resolves becomes a Sym with a stable id; references are recorded
 * by id so that the language server can answer go-to-definition, find-references and rename.
 */
import type { Span } from '../syntax/lexer';
import type * as A from '../syntax/ast';
import type { Ty } from './types';

export type SymKind =
  | 'local'
  | 'param'
  | 'result'
  | 'bound'
  | 'statevar'
  | 'const'
  | 'fn'
  | 'type'
  | 'variant'
  | 'process'
  | 'action'
  | 'rel'
  | 'container'
  | 'field'
  | 'label'
  | 'builtin';

export interface Sym {
  id: number;
  kind: SymKind;
  name: string;
  ty: Ty;
  def: Span;
  mutable?: boolean;
  ghost?: boolean;
  /** For fn, process, action, container, const: the declaration. */
  decl?: A.FnDecl | A.ProcessDecl | A.ActionDecl | A.ContainerDecl | A.ConstDecl | A.VarDecl;
  /** For variants: the index in the enum. */
  index?: number;
  /** Owning container (system, world, problem) or function. */
  owner?: string;
  doc?: string;
  /** For inout parameters. */
  inout?: boolean;
  /** For constants with a value known at check time. */
  value?: bigint | boolean;
}

export class Scope {
  readonly names = new Map<string, Sym>();
  constructor(readonly parent?: Scope) {}
  lookup(name: string): Sym | undefined {
    return this.names.get(name) ?? this.parent?.lookup(name);
  }
  /** Every name visible here (innermost first), for completion and "did you mean". */
  visible(): Sym[] {
    const out: Sym[] = [];
    const seen = new Set<string>();
    for (let s: Scope | undefined = this; s; s = s.parent) {
      for (const [n, sym] of s.names) {
        if (!seen.has(n)) {
          seen.add(n);
          out.push(sym);
        }
      }
    }
    return out;
  }
}

/** The closest names to `name` (edit distance ≤ 2), for "did you mean" hints. */
export function suggest(name: string, candidates: string[]): string[] {
  const d = (a: string, b: string) => {
    const m = a.length;
    const n = b.length;
    const row = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      let prev = row[0]!;
      row[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = row[j]!;
        row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return row[n]!;
  };
  return candidates
    .map((c) => [c, d(name.toLowerCase(), c.toLowerCase())] as const)
    .filter(([c, k]) => k <= Math.min(2, Math.floor(c.length / 2)) && c !== name)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([c]) => c);
}
