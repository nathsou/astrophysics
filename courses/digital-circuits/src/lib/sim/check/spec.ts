/**
 * Specifications a circuit is checked against. Authors write them in YAML (exercise blocks) or code;
 * this module normalises the three combinational forms (truth table, Boolean expression, reference
 * circuit) into one evaluator, and the two sequential forms (reference circuit, FSM table).
 */
import type { Circuit } from '../netlist/types';
import type { SubResolver } from '../netlist/connect';
import { evalExpr, exprVars, parseExpr, ExprError, type Expr } from '../../pld/twolevel/expr';
import { CircuitBench } from './circuit';

export type Bit = 0 | 1;
/** An expected output bit; null means "don't care". */
export type Expect = Bit | null;

// ── Truth tables ───────────────────────────────────────────────────────────────

/** A truth table as authored: rows are arrays `[0, 1, 1]`, or strings `"01 1"` / `"01|1"` (inputs, then outputs). */
export interface TruthTableInput {
  inputs: string[];
  outputs: string[];
  rows: (string | (number | string)[])[];
}

export interface TruthTable {
  inputs: string[];
  outputs: string[];
  /** Expected outputs by input index (the first input is the most significant bit). Missing rows are don't-care. */
  table: (Expect[] | undefined)[];
}

const bitOf = (v: unknown): Expect => {
  const s = String(v).trim().toLowerCase();
  if (s === '1' || s === 'true') return 1;
  if (s === '0' || s === 'false') return 0;
  if (s === 'x' || s === '-' || s === '*') return null;
  throw new Error(`"${String(v)}" is not 0, 1 or x`);
};

export function parseTruthTable(t: TruthTableInput): TruthTable {
  const ni = t.inputs.length;
  const no = t.outputs.length;
  if (ni < 1 || ni > 16) throw new Error('a truth table needs 1 to 16 inputs');
  const table: (Expect[] | undefined)[] = new Array(1 << ni).fill(undefined);
  for (const raw of t.rows) {
    let cells: unknown[];
    if (Array.isArray(raw)) cells = raw;
    else {
      const [l, r] = raw.includes('|') ? raw.split('|') : [undefined, undefined];
      const text = raw.replace(/\|/g, ' ').trim();
      const tokens = text.split(/[\s,]+/).filter(Boolean);
      // "0110" without spaces: one character per column.
      cells = tokens.length === ni + no ? tokens : (l !== undefined && r !== undefined ? [...l.replace(/[\s,]/g, ''), ...r.replace(/[\s,]/g, '')] : [...tokens.join('')]);
    }
    if (cells.length !== ni + no) throw new Error(`row "${Array.isArray(raw) ? raw.join(' ') : raw}" has ${cells.length} columns, expected ${ni + no}`);
    let index = 0;
    for (let i = 0; i < ni; i++) {
      const b = bitOf(cells[i]);
      if (b === null) throw new Error(`inputs cannot be don't-care: row "${cells.join(' ')}"`);
      index = (index << 1) | b;
    }
    table[index] = cells.slice(ni).map(bitOf);
  }
  return { inputs: [...t.inputs], outputs: [...t.outputs], table };
}

// ── Combinational specs ────────────────────────────────────────────────────────

export interface CombSpec {
  truthTable?: TruthTableInput;
  /** `"Y = A & !B | C"`, several such strings, or `{ Y: "A & !B | C", … }`. A bare expression defines Y. */
  expression?: string | string[] | Record<string, string>;
  /** Input order for an expression spec (default: order of first appearance). */
  inputs?: string[];
  /** A reference circuit (ports, or toggles and indicators) with the same pin names. */
  reference?: Circuit;
  /** Code only: a function from named input bits to expected outputs (null: don't care), with `inputs` and `outputs` listing the pins. */
  fn?: (inputs: Record<string, number>) => Record<string, number | null>;
  outputs?: string[];
}

export interface CombModel {
  inputs: string[];
  outputs: string[];
  /** Expected outputs for input bits (inputs[0] first). */
  expected(bits: number[]): Expect[];
  kind: 'truthTable' | 'expression' | 'reference' | 'function';
  /** The reference's own problems, if any. */
  problems: string[];
}

export function parseExpressionSpec(spec: NonNullable<CombSpec['expression']>): { name: string; source: string; expr: Expr }[] {
  const items: [string | undefined, string][] = [];
  if (typeof spec === 'string') items.push([undefined, spec]);
  else if (Array.isArray(spec)) for (const s of spec) items.push([undefined, s]);
  else for (const [k, v] of Object.entries(spec)) items.push([k, v]);
  return items.map(([key, text]) => {
    let name = key;
    let source = text;
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?::=|<=|=)\s*(.+)$/.exec(text);
    if (m && !/^\s*[A-Za-z_]\w*\s*==/.test(text)) {
      if (name === undefined) name = m[1]!;
      source = m[2]!;
    }
    name ??= 'Y';
    try {
      return { name, source, expr: parseExpr(source) };
    } catch (e) {
      if (e instanceof ExprError) throw new Error(`expression for ${name}: ${e.message} (at "${source.slice(e.offset, e.offset + 8)}")`);
      throw e;
    }
  });
}

export function compileComb(spec: CombSpec, options: { parts?: SubResolver } = {}): CombModel {
  if (spec.truthTable) {
    const t = parseTruthTable(spec.truthTable);
    return {
      kind: 'truthTable',
      inputs: t.inputs,
      outputs: t.outputs,
      problems: [],
      expected: (bits) => {
        let i = 0;
        for (const b of bits) i = (i << 1) | (b ? 1 : 0);
        return t.table[i] ?? t.outputs.map(() => null);
      },
    };
  }
  if (spec.expression !== undefined) {
    const items = parseExpressionSpec(spec.expression);
    const vars: string[] = [];
    for (const it of items) exprVars(it.expr, vars);
    const inputs = spec.inputs ?? vars;
    for (const v of vars) if (!inputs.includes(v)) throw new Error(`the expression uses ${v}, which is not among the inputs`);
    return {
      kind: 'expression',
      inputs,
      outputs: items.map((i) => i.name),
      problems: [],
      expected: (bits) => items.map((it) => evalExpr(it.expr, (n) => bits[inputs.indexOf(n)] ?? 0)),
    };
  }
  if (spec.fn) {
    const fn = spec.fn;
    const inputs = spec.inputs ?? [];
    const outputs = spec.outputs ?? [];
    if (!inputs.length || !outputs.length) throw new Error('a function spec needs inputs and outputs');
    return {
      kind: 'function',
      inputs,
      outputs,
      problems: [],
      expected: (bits) => {
        const r = fn(Object.fromEntries(inputs.map((n, i) => [n, bits[i] ?? 0])));
        return outputs.map((o) => (r[o] === undefined || r[o] === null ? null : r[o] ? 1 : 0));
      },
    };
  }
  if (spec.reference) {
    const ref = new CircuitBench(spec.reference, { parts: options.parts });
    const outs = ref.outputs;
    return {
      kind: 'reference',
      inputs: ref.inputs,
      outputs: outs,
      problems: [...ref.problems, ...ref.errors()],
      expected: (bits) => {
        ref.inputs.forEach((n, i) => ref.set(n, bits[i] ?? 0));
        ref.settle();
        return outs.map((o) => {
          const v = ref.get(o);
          return v === 0 ? 0 : v === 1 ? 1 : null;
        });
      },
    };
  }
  throw new Error('a specification needs a truthTable, an expression, a reference circuit or a function');
}

/** The full truth table of a combinational spec (up to 12 inputs), for display. */
export function tableOf(model: CombModel): { inputs: string[]; outputs: string[]; rows: { inputs: number[]; outputs: Expect[] }[] } {
  const n = model.inputs.length;
  const rows = [];
  for (let i = 0; i < 1 << Math.min(n, 12); i++) {
    const bits = model.inputs.map((_, k) => (i >> (n - 1 - k)) & 1);
    rows.push({ inputs: bits, outputs: model.expected(bits) });
  }
  return { inputs: model.inputs, outputs: model.outputs, rows };
}
