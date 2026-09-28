// The structures a reader can pick in the semantics workbenches, as serializable choices, and
// how to evaluate a formula in each (exactly for finite structures, by search for infinite ones).

import type { Formula } from '../../engine/syntax/ast';
import { varIndex } from '../../engine/syntax/language';
import { GENERIC, makeStructure, modArithmetic, pureStructure, showElem, validateStructure, type Elem, type Structure, type StructureSpec } from '../../engine/semantics/structure';
import { STRUCTURE_PRESETS } from '../../engine/semantics/examples';
import { SEARCH_STRUCTURES, satisfiesSearch, type IElem, type SearchStructure } from '../../engine/semantics/infinite';
import { satisfies } from '../../engine/semantics/satisfaction';
import type { FormulaTrace } from '../../engine/semantics/trace';
import { persistedStore, type Store } from '../../ui/store';

// ------------------------------------------------------------------ custom structures

/** The symbols a custom structure may interpret. */
export const CUSTOM_SYMBOLS = {
  zero: { label: '0', kind: 'const', index: 0, arity: 0 },
  a: { label: 'a', kind: 'const', index: 1, arity: 0 },
  b: { label: 'b', kind: 'const', index: 2, arity: 0 },
  succ: { label: '′', kind: 'fn', index: 0, arity: 1 },
  f: { label: 'f', kind: 'fn', index: GENERIC.f(1).index, arity: 1 },
  plus: { label: '+', kind: 'fn', index: 0, arity: 2 },
  times: { label: '×', kind: 'fn', index: 1, arity: 2 },
  less: { label: '<', kind: 'rel', index: 0, arity: 2 },
  P: { label: 'P', kind: 'rel', index: GENERIC.P(1).index, arity: 1 },
  R: { label: 'R', kind: 'rel', index: GENERIC.R(2).index, arity: 2 },
} as const;
export type CustomSymbol = keyof typeof CUSTOM_SYMBOLS;
export const CUSTOM_ORDER: CustomSymbol[] = ['zero', 'a', 'b', 'succ', 'f', 'plus', 'times', 'less', 'P', 'R'];

export interface CustomSpec {
  /** Domain {0, …, n−1}. */
  n: number;
  /** Interpretations: constants → element; 1-place functions → values; 2-place → grid; relations → booleans. */
  on: Partial<Record<CustomSymbol, number | number[] | number[][] | boolean[] | boolean[][]>>;
}

export const MAX_CUSTOM = 5;

export function defaultValue(sym: CustomSymbol, n: number): number | number[] | number[][] | boolean[] | boolean[][] {
  const d = CUSTOM_SYMBOLS[sym];
  if (d.kind === 'const') return 0;
  if (d.kind === 'fn') {
    if (d.arity === 1) return Array.from({ length: n }, (_, i) => (sym === 'succ' ? Math.min(i + 1, n - 1) : i));
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (sym === 'plus' ? Math.min(i + j, n - 1) : Math.min(i * j, n - 1))));
  }
  if (d.arity === 1) return Array.from({ length: n }, () => false);
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (sym === 'less' ? i < j : false)));
}

/** Resizes every table of the spec to a domain of n elements (keeping what fits). */
export function resizeCustom(spec: CustomSpec, n: number): CustomSpec {
  const on: CustomSpec['on'] = {};
  const clamp = (v: number) => (v < n ? v : 0);
  for (const k of Object.keys(spec.on) as CustomSymbol[]) {
    const d = CUSTOM_SYMBOLS[k];
    const old = spec.on[k];
    const fresh = defaultValue(k, n);
    if (d.kind === 'const') on[k] = clamp(old as number);
    else if (d.arity === 1) on[k] = (fresh as (number | boolean)[]).map((x, i) => (Array.isArray(old) && i < old.length ? (typeof old[i] === 'number' ? clamp(old[i] as number) : old[i]) : x)) as number[] | boolean[];
    else
      on[k] = (fresh as (number | boolean)[][]).map((row, i) =>
        row.map((x, j) => {
          const o = Array.isArray(old) ? (old as (number | boolean)[][])[i]?.[j] : undefined;
          return o === undefined ? x : typeof o === 'number' ? clamp(o) : o;
        }),
      ) as number[][] | boolean[][];
  }
  return { n, on };
}

export function customToSpec(c: CustomSpec, name = 'M'): StructureSpec {
  const domain = Array.from({ length: c.n }, (_, i) => i);
  const constants: Record<number, Elem> = {};
  const functions: NonNullable<StructureSpec['functions']>[number][] = [];
  const relations: NonNullable<StructureSpec['relations']>[number][] = [];
  for (const k of CUSTOM_ORDER) {
    const v = c.on[k];
    if (v === undefined) continue;
    const d = CUSTOM_SYMBOLS[k];
    if (d.kind === 'const') constants[d.index] = v as number;
    else if (d.kind === 'fn') functions.push({ arity: d.arity, index: d.index, def: d.arity === 1 ? { values: v as number[] } : { grid: v as number[][] } });
    else {
      const tuples = d.arity === 1 ? domain.filter((i) => (v as boolean[])[i]).map((i) => [i]) : domain.flatMap((i) => domain.filter((j) => (v as boolean[][])[i][j]).map((j) => [i, j]));
      relations.push({ arity: d.arity, index: d.index, def: { tuples } });
    }
  }
  return { name, domain, constants, functions, relations };
}

// ------------------------------------------------------------------ choices

export type StructureChoice =
  | { kind: 'preset'; id: string }
  | { kind: 'mod'; n: number; mode: 'wrap' | 'saturate' }
  | { kind: 'pure'; n: number }
  | { kind: 'search'; id: string }
  | { kind: 'custom'; spec: CustomSpec };

export type Resolved = { kind: 'finite'; M: Structure; label: string } | { kind: 'search'; S: SearchStructure; label: string } | { kind: 'error'; errors: string[]; label: string };

export function resolve(c: StructureChoice): Resolved {
  try {
    switch (c.kind) {
      case 'preset': {
        const p = STRUCTURE_PRESETS.find((x) => x.id === c.id) ?? STRUCTURE_PRESETS[0];
        return { kind: 'finite', M: p.build(), label: p.label };
      }
      case 'mod': {
        const n = Math.max(1, Math.min(12, Math.floor(c.n) || 1));
        return { kind: 'finite', M: modArithmetic(n, c.mode), label: c.mode === 'wrap' ? `ℤ${sub(n)}: arithmetic mod ${n}` : `ℕ cut off at ${n - 1}` };
      }
      case 'pure': {
        const n = Math.max(1, Math.min(8, Math.floor(c.n) || 1));
        return { kind: 'finite', M: pureStructure(Array.from({ length: n }, (_, i) => i)), label: `A domain of ${n} element${n === 1 ? '' : 's'}, no symbols` };
      }
      case 'search': {
        const S = SEARCH_STRUCTURES.find((x) => x.id === c.id) ?? SEARCH_STRUCTURES[0];
        return { kind: 'search', S, label: `${S.name} (${S.domainText})` };
      }
      case 'custom': {
        const r = validateStructure(customToSpec(c.spec));
        return r.ok ? { kind: 'finite', M: r.structure, label: 'Your structure' } : { kind: 'error', errors: r.errors, label: 'Your structure' };
      }
    }
  } catch (e) {
    return { kind: 'error', errors: [e instanceof Error ? e.message : String(e)], label: 'error' };
  }
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
export const sub = (n: number) => String(n).replace(/\d/g, (d) => SUB[Number(d)]);

export function choiceKey(c: StructureChoice): string {
  return JSON.stringify(c);
}

// ------------------------------------------------------------------ evaluation

export type AnyElem = Elem | IElem;
export type AnyTrace = FormulaTrace<AnyElem>;

export function showAny(r: Resolved, e: AnyElem): string {
  if (r.kind === 'search') return r.S.show(e as IElem);
  return typeof e === 'bigint' ? e.toString() : showElem(e as Elem);
}

/** Reads the element typed or picked for a variable. */
export function parseElem(r: Resolved, text: string): AnyElem | { fail: string } {
  if (r.kind === 'search') {
    const v = r.S.parse(text);
    return v;
  }
  if (r.kind === 'finite') {
    const hit = r.M.domain.find((d) => showElem(d) === text);
    return hit !== undefined ? hit : { fail: `${text} is not an element of the domain` };
  }
  return { fail: 'no structure' };
}

export interface EvalSettings {
  exhaustive?: boolean;
  limit?: number;
}

export function evaluateIn(r: Resolved, F: Formula, assign: Record<string, string>, settings: EvalSettings = {}): { trace: AnyTrace | null; errors: string[] } {
  const errors: string[] = [];
  const s = new Map<number, AnyElem>();
  for (const [name, text] of Object.entries(assign)) {
    const i = varIndex(name);
    if (i === null || text === '') continue;
    const v = parseElem(r, text);
    if (typeof v === 'object' && v !== null && 'fail' in v) errors.push(`${name}: ${v.fail}`);
    else s.set(i, v as AnyElem);
  }
  if (r.kind === 'error') return { trace: null, errors: r.errors };
  if (r.kind === 'finite') return { trace: satisfies(r.M, s as Map<number, Elem>, F, { exhaustive: settings.exhaustive, maxSteps: 400_000 }) as AnyTrace, errors };
  return { trace: satisfiesSearch(r.S, s as Map<number, IElem>, F, { exhaustive: settings.exhaustive, limit: settings.limit ?? 40, maxSteps: 400_000 }) as AnyTrace, errors };
}

/** The elements a variable may be assigned, for pickers (finite: all; infinite: a few suggestions). */
export function elementChoices(r: Resolved): string[] {
  if (r.kind === 'finite') return r.M.domain.map(showElem);
  if (r.kind === 'search') return r.S.enumerate(8).map(r.S.show);
  return [];
}

// ------------------------------------------------------------------ per-lab persisted state

export interface LabState {
  structure: StructureChoice;
  formula: string;
  assign: Record<string, string>;
}

const stores = new Map<string, Store<LabState>>();
export function labStore(id: string, initial: LabState): Store<LabState> {
  let s = stores.get(id);
  if (!s) {
    s = persistedStore<LabState>(`ic.sem.${id}`, initial);
    stores.set(id, s);
  }
  return s;
}

export const DEFAULT_CUSTOM: CustomSpec = {
  n: 3,
  on: { R: [[false, true, false], [false, false, true], [false, false, false]] },
};

/** A structure used by examples that need one quickly. */
export function exampleStructure(): Structure {
  return makeStructure(customToSpec(DEFAULT_CUSTOM));
}
