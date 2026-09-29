/**
 * vPLA: a virtual field-programmable logic array in the style of the Signetics 82S100 FPLA, scaled
 * down to 8 inputs, 16 product terms and 8 outputs.
 *
 * Structure (as drawn in Chapter 25):
 *
 *   inputs ──► AND plane ──► 16 product terms ──► OR plane ──► XOR (polarity) ──► outputs
 *
 * - AND plane: each product term has two fuses per input, one to the true input and one to its
 *   complement. An intact fuse connects the input to the term's AND gate. A term with both
 *   connected for some input is x·x̄ = 0; a term with nothing connected is the constant 1.
 * - OR plane: each output has one fuse per product term. An intact fuse connects the term to the
 *   output's OR gate.
 * - Polarity: each output has a fuse in front of an XOR. Intact = active high (the OR is the
 *   output); blown = the output is inverted. (This is a modelling choice: on the real 82S100 the
 *   polarity fuse is programmed for the same purpose, and which state means which depends on the
 *   part and how the datasheet draws it.)
 *
 * A virgin device has every fuse intact: all terms are 0, so every output reads 0 (active high).
 * Fuse arrays hold 1 for a blown fuse:
 *   andFuses[(term × inputs + input) × 2 + 0] true-input fuse,   + 1 complement-input fuse
 *   orFuses[term × outputs + output]
 *   polarityFuses[output]
 */
import { ONE, ZERO, cubeFromString, getVar, type Cover, type Cube } from '../twolevel/cube';
import { functionFromEquations, parseTruthTable, type BoolFunction } from '../twolevel/expr';
import { minimiseMultiPolarity, type MultiCost, type MultiOptions } from '../twolevel/multi';
import type { Polarity } from '../twolevel/minimise';
import { complement } from '../twolevel/unate';

export interface PlaSize {
  inputs: number;
  terms: number;
  outputs: number;
}

export const VPLA_SIZE: Readonly<PlaSize> = { inputs: 8, terms: 16, outputs: 8 };

export class PlaError extends Error {
  constructor(
    message: string,
    readonly code: 'size' | 'too-many-terms' | 'blown' | 'range' | 'format' = 'size',
  ) {
    super(message);
    this.name = 'PlaError';
  }
}

export type PlaBlowOp =
  | { plane: 'and'; term: number; input: number; literal: 'true' | 'complement' }
  | { plane: 'or'; term: number; output: number }
  | { plane: 'polarity'; output: number };

export type PlaTermKind = 'product' | 'true' | 'false';

export interface PlaTermInfo {
  index: number;
  /** One character per input: '1' (true form), '0' (complement), '-' (not connected), or 'x' (both connected). */
  pattern: string;
  kind: PlaTermKind;
  /** Outputs whose OR includes the term (fuse intact). */
  outputs: number[];
}

export interface PlaFuseMap {
  device: 'vPLA';
  version: 1;
  inputs: number;
  terms: number;
  outputs: number;
  inputNames: string[];
  outputNames: string[];
  /** One string per product term: two characters per input (true fuse, complement fuse); '1' = blown. */
  and: string[];
  /** One string per product term: one character per output; '1' = blown (term not in the output). */
  or: string[];
  /** One character per output; '1' = blown (output inverted). */
  polarity: string;
  /** The terms as decoded from the fuses. */
  termInfo: PlaTermInfo[];
  blown: number;
}

export interface PlaTrace {
  inputs: (0 | 1)[];
  terms: (0 | 1)[];
  /** OR of the connected terms, before the polarity XOR. */
  sums: (0 | 1)[];
  outputs: (0 | 1)[];
}

export class Pla {
  readonly size: PlaSize;
  readonly inputNames: string[];
  readonly outputNames: string[];
  readonly andFuses: Uint8Array;
  readonly orFuses: Uint8Array;
  readonly polarityFuses: Uint8Array;

  constructor(size: PlaSize = VPLA_SIZE, names: { inputs?: string[]; outputs?: string[] } = {}) {
    for (const [k, v] of Object.entries(size)) if (!Number.isInteger(v) || v < 1 || v > 64) throw new PlaError(`A vPLA needs 1 to 64 ${k}`);
    this.size = { ...size };
    this.inputNames = names.inputs ?? Array.from({ length: size.inputs }, (_, i) => `I${i}`);
    this.outputNames = names.outputs ?? Array.from({ length: size.outputs }, (_, i) => `O${i}`);
    if (this.inputNames.length !== size.inputs) throw new PlaError(`Expected ${size.inputs} input names`);
    if (this.outputNames.length !== size.outputs) throw new PlaError(`Expected ${size.outputs} output names`);
    this.andFuses = new Uint8Array(size.terms * size.inputs * 2);
    this.orFuses = new Uint8Array(size.terms * size.outputs);
    this.polarityFuses = new Uint8Array(size.outputs);
  }

  get fuseCount(): number {
    return this.andFuses.length + this.orFuses.length + this.polarityFuses.length;
  }

  // -- Addressing fuses ---------------------------------------------------------------------

  andIndex(term: number, input: number, literal: 'true' | 'complement'): number {
    this.checkTerm(term);
    if (!Number.isInteger(input) || input < 0 || input >= this.size.inputs) throw new PlaError(`Input ${input} out of range`, 'range');
    return (term * this.size.inputs + input) * 2 + (literal === 'true' ? 0 : 1);
  }

  orIndex(term: number, output: number): number {
    this.checkTerm(term);
    this.checkOutput(output);
    return term * this.size.outputs + output;
  }

  private checkTerm(t: number): void {
    if (!Number.isInteger(t) || t < 0 || t >= this.size.terms) throw new PlaError(`Product term ${t} out of range`, 'range');
  }

  private checkOutput(o: number): void {
    if (!Number.isInteger(o) || o < 0 || o >= this.size.outputs) throw new PlaError(`Output ${o} out of range`, 'range');
  }

  private array(op: PlaBlowOp): { a: Uint8Array; i: number } {
    if (op.plane === 'and') return { a: this.andFuses, i: this.andIndex(op.term, op.input, op.literal) };
    if (op.plane === 'or') return { a: this.orFuses, i: this.orIndex(op.term, op.output) };
    this.checkOutput(op.output);
    return { a: this.polarityFuses, i: op.output };
  }

  isBlown(op: PlaBlowOp): boolean {
    const { a, i } = this.array(op);
    return a[i] === 1;
  }

  /** Blow a fuse. Returns false if it was already blown. */
  blow(op: PlaBlowOp): boolean {
    const { a, i } = this.array(op);
    if (a[i]) return false;
    a[i] = 1;
    return true;
  }

  apply(ops: PlaBlowOp[]): number {
    let n = 0;
    for (const op of ops) if (this.blow(op)) n++;
    return n;
  }

  /** Every fuse that is blown, as pulses. */
  blownOps(): PlaBlowOp[] {
    return this.diffOps(new Pla(this.size), this);
  }

  private diffOps(from: Pla, to: Pla): PlaBlowOp[] {
    const ops: PlaBlowOp[] = [];
    const { inputs, terms, outputs } = this.size;
    for (let t = 0; t < terms; t++) {
      for (let i = 0; i < inputs; i++)
        for (const literal of ['true', 'complement'] as const) {
          const k = to.andIndex(t, i, literal);
          if (to.andFuses[k] && !from.andFuses[k]) ops.push({ plane: 'and', term: t, input: i, literal });
        }
      for (let o = 0; o < outputs; o++) {
        const k = to.orIndex(t, o);
        if (to.orFuses[k] && !from.orFuses[k]) ops.push({ plane: 'or', term: t, output: o });
      }
    }
    for (let o = 0; o < outputs; o++) if (to.polarityFuses[o] && !from.polarityFuses[o]) ops.push({ plane: 'polarity', output: o });
    return ops;
  }

  /** The pulses that turn this device's fuses into `target`'s; refused if a blown fuse would have to be restored. */
  plan(target: Pla): PlaBlowOp[] {
    if (target.size.inputs !== this.size.inputs || target.size.terms !== this.size.terms || target.size.outputs !== this.size.outputs)
      throw new PlaError('The two PLAs differ in size');
    for (const [name, a, b] of [
      ['AND-plane', this.andFuses, target.andFuses],
      ['OR-plane', this.orFuses, target.orFuses],
      ['polarity', this.polarityFuses, target.polarityFuses],
    ] as const)
      for (let i = 0; i < a.length; i++) if (a[i] && !b[i]) throw new PlaError(`A blown ${name} fuse (${i}) cannot be restored`, 'blown');
    return this.diffOps(this, target);
  }

  clone(): Pla {
    const p = new Pla(this.size, { inputs: this.inputNames, outputs: this.outputNames });
    p.andFuses.set(this.andFuses);
    p.orFuses.set(this.orFuses);
    p.polarityFuses.set(this.polarityFuses);
    return p;
  }

  // -- Reading the configuration ------------------------------------------------------------

  /** Decode a product term from its AND-plane fuses. */
  decodeTerm(t: number): PlaTermInfo {
    let pattern = '';
    let contradiction = false;
    let literals = 0;
    for (let i = 0; i < this.size.inputs; i++) {
      const tr = !this.andFuses[this.andIndex(t, i, 'true')];
      const co = !this.andFuses[this.andIndex(t, i, 'complement')];
      if (tr && co) {
        pattern += 'x';
        contradiction = true;
      } else if (tr) {
        pattern += '1';
        literals++;
      } else if (co) {
        pattern += '0';
        literals++;
      } else pattern += '-';
    }
    const outputs: number[] = [];
    for (let o = 0; o < this.size.outputs; o++) if (!this.orFuses[this.orIndex(t, o)]) outputs.push(o);
    return { index: t, pattern, kind: contradiction ? 'false' : literals === 0 ? 'true' : 'product', outputs };
  }

  terms(): PlaTermInfo[] {
    return Array.from({ length: this.size.terms }, (_, t) => this.decodeTerm(t));
  }

  /** Product terms in use: not identically 0 and connected to some output. */
  usedTerms(): number {
    return this.terms().filter((t) => t.kind !== 'false' && t.outputs.length > 0).length;
  }

  // -- Evaluation ---------------------------------------------------------------------------

  /** Step-by-step evaluation. `inputs` is a list of levels (index = input) or an integer with input 0 as the most significant bit. */
  trace(inputs: ArrayLike<number> | number): PlaTrace {
    const n = this.size.inputs;
    const x: (0 | 1)[] = [];
    if (typeof inputs === 'number') for (let i = 0; i < n; i++) x.push(((inputs >>> (n - 1 - i)) & 1) as 0 | 1);
    else {
      if (inputs.length !== n) throw new PlaError(`Expected ${n} input levels`);
      for (let i = 0; i < n; i++) x.push(inputs[i] ? 1 : 0);
    }
    const terms: (0 | 1)[] = [];
    for (let t = 0; t < this.size.terms; t++) {
      let v: 0 | 1 = 1;
      for (let i = 0; i < n && v; i++) {
        if (!this.andFuses[(t * n + i) * 2] && !x[i]) v = 0;
        if (!this.andFuses[(t * n + i) * 2 + 1] && x[i]) v = 0;
      }
      terms.push(v);
    }
    const sums: (0 | 1)[] = [];
    const outputs: (0 | 1)[] = [];
    for (let o = 0; o < this.size.outputs; o++) {
      let s: 0 | 1 = 0;
      for (let t = 0; t < this.size.terms; t++) if (terms[t] && !this.orFuses[t * this.size.outputs + o]) s = 1;
      sums.push(s);
      outputs.push((this.polarityFuses[o] ? 1 - s : s) as 0 | 1);
    }
    return { inputs: x, terms, sums, outputs };
  }

  evaluate(inputs: ArrayLike<number> | number): (0 | 1)[] {
    return this.trace(inputs).outputs;
  }

  /** The Boolean function the fuses implement, as covers over the inputs (unused terms omitted). */
  toFunction(): BoolFunction {
    const n = this.size.inputs;
    const on: Cover[] = [];
    for (let o = 0; o < this.size.outputs; o++) {
      const cubes: Cube[] = [];
      for (let t = 0; t < this.size.terms; t++) {
        const info = this.decodeTerm(t);
        if (info.kind === 'false' || !info.outputs.includes(o)) continue;
        cubes.push(cubeFromString(info.pattern.replace(/x/g, '-')));
      }
      on.push(this.polarityFuses[o] ? { n, cubes: complement(cubes, n) } : { n, cubes });
    }
    return { inputs: this.inputNames.slice(), outputs: this.outputNames.slice(), on, dc: on.map(() => ({ n, cubes: [] })) };
  }

  toFuseMap(): PlaFuseMap {
    const { inputs, terms, outputs } = this.size;
    const and: string[] = [];
    const or: string[] = [];
    for (let t = 0; t < terms; t++) {
      and.push(Array.from(this.andFuses.subarray(t * inputs * 2, (t + 1) * inputs * 2)).join(''));
      or.push(Array.from(this.orFuses.subarray(t * outputs, (t + 1) * outputs)).join(''));
    }
    let blown = 0;
    for (const a of [this.andFuses, this.orFuses, this.polarityFuses]) for (const v of a) blown += v;
    return {
      device: 'vPLA',
      version: 1,
      inputs,
      terms,
      outputs,
      inputNames: this.inputNames.slice(),
      outputNames: this.outputNames.slice(),
      and,
      or,
      polarity: Array.from(this.polarityFuses).join(''),
      termInfo: this.terms(),
      blown,
    };
  }

  static fromFuseMap(map: PlaFuseMap): Pla {
    if (map.device !== 'vPLA') throw new PlaError(`Not a vPLA fuse map: ${String(map.device)}`, 'format');
    const p = new Pla({ inputs: map.inputs, terms: map.terms, outputs: map.outputs }, { inputs: map.inputNames, outputs: map.outputNames });
    const fill = (rows: string[], width: number, dst: Uint8Array, what: string) => {
      if (rows.length !== map.terms) throw new PlaError(`Expected ${map.terms} ${what} rows`, 'format');
      rows.forEach((r, t) => {
        if (r.length !== width || /[^01]/.test(r)) throw new PlaError(`Bad ${what} row ${t}: "${r}"`, 'format');
        for (let k = 0; k < width; k++) dst[t * width + k] = r.charCodeAt(k) === 49 ? 1 : 0;
      });
    };
    fill(map.and, map.inputs * 2, p.andFuses, 'AND-plane');
    fill(map.or, map.outputs, p.orFuses, 'OR-plane');
    if (map.polarity.length !== map.outputs || /[^01]/.test(map.polarity)) throw new PlaError('Bad polarity string', 'format');
    for (let o = 0; o < map.outputs; o++) p.polarityFuses[o] = map.polarity.charCodeAt(o) === 49 ? 1 : 0;
    return p;
  }

  /**
   * Program a product term directly: `pattern` has one character per input ('1', '0' or '-'),
   * `outputs` are the outputs whose OR includes it. Returns the pulses used. Blown fuses cannot be
   * restored, so this only ever adds pulses.
   */
  programTerm(term: number, pattern: string, outputs: number[]): PlaBlowOp[] {
    if (pattern.length !== this.size.inputs) throw new PlaError(`Pattern needs ${this.size.inputs} characters`, 'format');
    const ops: PlaBlowOp[] = [];
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i]!;
      if (ch !== '0' && ch !== '1' && ch !== '-') throw new PlaError(`Bad pattern character '${ch}'`, 'format');
      if (ch === '1' || ch === '-') ops.push({ plane: 'and', term, input: i, literal: 'complement' });
      if (ch === '0' || ch === '-') ops.push({ plane: 'and', term, input: i, literal: 'true' });
    }
    for (let o = 0; o < this.size.outputs; o++) if (!outputs.includes(o)) ops.push({ plane: 'or', term, output: o });
    const done = ops.filter((op) => this.blow(op));
    return done;
  }
}

// ---------------------------------------------------------------------------------------------
// Fitting

export interface PlaFitOptions extends MultiOptions {
  size?: PlaSize;
  /** 'auto' picks each output's polarity to save product terms; default 'high'. */
  polarity?: 'auto' | 'high' | Polarity[];
}

export interface PlaFit {
  pla: Pla;
  /** The pulses that program a virgin device. */
  ops: PlaBlowOp[];
  terms: { pattern: string; outputs: number[] }[];
  polarity: Polarity[];
  cost: MultiCost;
  /** Product terms in use. */
  used: number;
  free: number;
}

/**
 * Fit a multi-output function to a PLA: minimise with shared product terms, choose output
 * polarities, and program the AND plane, the OR plane and the polarity fuses. Outputs the
 * function does not drive stay at 0 (virgin), and unused inputs are disconnected.
 */
export function fitPla(f: BoolFunction, opts: PlaFitOptions = {}): PlaFit {
  const size = opts.size ?? VPLA_SIZE;
  const n = f.inputs.length;
  const m = f.outputs.length;
  if (n > size.inputs) throw new PlaError(`The function has ${n} inputs but the PLA has ${size.inputs}.`);
  if (m > size.outputs) throw new PlaError(`The function has ${m} outputs but the PLA has ${size.outputs}.`);
  const res = minimiseMultiPolarity({ n, on: f.on, dc: f.dc }, opts.polarity ?? 'high', opts);
  if (res.cost.terms > size.terms) {
    const hi = opts.polarity === undefined || opts.polarity === 'high' ? res.cost.terms : undefined;
    throw new PlaError(
      `The function needs ${res.cost.terms} product terms (shared across the outputs) but the PLA has ${size.terms}.` +
        (hi !== undefined ? " Try polarity 'auto', which may find inverted outputs that need fewer terms," : '') +
        ' or split the function across two PLAs, or reduce the number of outputs.',
      'too-many-terms',
    );
  }
  const names = {
    inputs: [...f.inputs, ...Array.from({ length: size.inputs - n }, (_, i) => `I${n + i}`)],
    outputs: [...f.outputs, ...Array.from({ length: size.outputs - m }, (_, i) => `O${m + i}`)],
  };
  const pla = new Pla(size, names);
  const terms: { pattern: string; outputs: number[] }[] = [];
  // Every term row starts with every OR fuse blown; the terms in use get their connections back
  // (i.e. we blow the fuses of the outputs that do not use them), and unused rows are disconnected.
  const ops: PlaBlowOp[] = [];
  res.terms.forEach((term, t) => {
    let pattern = '';
    for (let i = 0; i < size.inputs; i++) {
      const v = i < n ? getVar(term.cube, i) : 3;
      pattern += v === ONE ? '1' : v === ZERO ? '0' : '-';
    }
    terms.push({ pattern, outputs: term.outputs.slice() });
    ops.push(...pla.programTerm(t, pattern, term.outputs));
  });
  for (let t = res.terms.length; t < size.terms; t++)
    for (let o = 0; o < size.outputs; o++) {
      const op: PlaBlowOp = { plane: 'or', term: t, output: o };
      if (pla.blow(op)) ops.push(op);
    }
  for (let o = 0; o < m; o++) {
    if (res.polarity[o] === 'low') {
      const op: PlaBlowOp = { plane: 'polarity', output: o };
      pla.blow(op);
      ops.push(op);
    }
  }
  return {
    pla,
    ops,
    terms,
    polarity: [...res.polarity, ...Array<Polarity>(size.outputs - m).fill('high')],
    cost: res.cost,
    used: res.terms.length,
    free: size.terms - res.terms.length,
  };
}

export function fitPlaEquations(text: string, opts: PlaFitOptions & { inputs?: string[] } = {}): PlaFit {
  return fitPla(functionFromEquations(text, opts.inputs), opts);
}

export function fitPlaTruthTable(text: string, opts: PlaFitOptions = {}): PlaFit {
  return fitPla(parseTruthTable(text), opts);
}

/** True if the fitted device implements the function on every input combination. */
export function plaMatches(pla: Pla, f: BoolFunction): boolean {
  const n = f.inputs.length;
  const N = pla.size.inputs;
  for (let x = 0; x < 2 ** n; x++) {
    const out = pla.evaluate(x << (N - n));
    for (let o = 0; o < f.outputs.length; o++) {
      const want = f.on[o]!.cubes.some((c) => cubeMatches(c, x, n));
      const dc = f.dc[o]!.cubes.some((c) => cubeMatches(c, x, n));
      if (!dc && Boolean(out[o]) !== want) return false;
    }
  }
  return true;
}

function cubeMatches(c: Cube, m: number, n: number): boolean {
  for (let i = 0; i < n; i++) {
    const bit = (m >>> (n - 1 - i)) & 1;
    const v = getVar(c, i);
    if (!(v & (bit ? ONE : ZERO))) return false;
  }
  return true;
}

/** The product-term patterns as text, one line per term: `10-1-  →  O0 O3`. */
export function describePlaTerms(pla: Pla): string[] {
  return pla
    .terms()
    .filter((t) => t.kind !== 'false' && t.outputs.length > 0)
    .map((t) => `T${t.index}: ${t.pattern}  →  ${t.outputs.map((o) => pla.outputNames[o]).join(' ')}`);
}
