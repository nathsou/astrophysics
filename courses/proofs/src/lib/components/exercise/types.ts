import type { CheckOptions, Definition, Domain } from '$lib/cas';

/** Options shared by exercises whose answers are checked by the CAS (YAML field names). */
export interface CasSpec {
  domains?: Record<string, Domain>;
  domain?: Domain;
  assume?: string[];
  /** Either { S: { params: [n], body: "…" } } or ["S(n) = …"]. */
  defs?: Record<string, Definition> | string[];
  functions?: string[];
  variables?: string[];
  e?: 'variable' | 'constant';
}

export function casOptions(spec: CasSpec): CheckOptions {
  let defs: Record<string, Definition> | undefined;
  if (Array.isArray(spec.defs)) {
    defs = {};
    for (const line of spec.defs) {
      // "f(x, y) = …" defines a function; "p = …" a constant expression substituted for the symbol p.
      const m = /^\s*([A-Za-z]\w*)\s*(?:\(([^)]*)\))?\s*=\s*(.+)$/.exec(line);
      if (!m) throw new Error(`Bad definition “${line}” (expected “f(x, y) = …” or “p = …”)`);
      defs[m[1]!] = { params: (m[2] ?? '').split(',').map((s) => s.trim()).filter(Boolean), body: m[3]! };
    }
  } else defs = spec.defs;
  return {
    domains: spec.domains,
    defaultDomain: spec.domain,
    assume: spec.assume,
    defs,
    parse: { functions: spec.functions, variables: spec.variables, eIsVariable: spec.e === 'variable' },
  };
}

export interface ExerciseBase {
  id: string;
  title?: string;
  prompt?: string;
  hints?: string[];
  hint?: string;
  solution?: string;
  explain?: string;
}
