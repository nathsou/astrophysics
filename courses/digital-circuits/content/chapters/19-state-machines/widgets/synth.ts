/**
 * From a drawn state machine to logic: choose a code for every state, write the next-state and output
 * functions as truth tables over (state bits, inputs), minimise them together, and count the parts.
 *
 *   state bits ──┐                    ┌── next-state bits ──▶ flip-flops ──┐
 *                ├──▶ AND–OR logic ───┤                                    │
 *   inputs ──────┘        ▲           └── outputs                          │
 *                         └────────────────────────────────────────────────┘
 *
 * The codes that no state uses are *don't-cares*: the machine never gets there, so the logic may do
 * anything in those rows. That freedom is what a good encoding buys; one-hot codes have the most of it (of
 * the 2ⁿ patterns of n bits only n are used).
 *
 * The minimiser is the course's multi-output two-level one (`$lib/pld/twolevel`), the one the PAL fitter of
 * Chapter 26 uses, so a term here is a product term there.
 */
import {
  cubeFromString,
  cubeKey,
  coverToText,
  evalCoverAt,
  getVar,
  minimise,
  minimiseMulti,
  multiCost,
  ONE,
  ZERO,
  type Cover,
  type Cube,
  type MultiCover,
  type MultiTerm,
} from '$lib/pld/twolevel';
import { allInputs, hasErrors, step, validate, zeros, type Fsm } from './fsm';

export type Encoding = 'binary' | 'gray' | 'onehot';

export const ENCODINGS: { id: Encoding; label: string; blurb: string }[] = [
  { id: 'binary', label: 'Binary', blurb: 'States are numbered 0, 1, 2… in the order listed: the fewest flip-flops.' },
  { id: 'gray', label: 'Gray', blurb: 'Numbered in Gray code, so neighbours in the list differ in one bit: good for rings.' },
  { id: 'onehot', label: 'One-hot', blurb: 'One flip-flop per state, exactly one of them set: the most flip-flops, the simplest logic.' },
];

export interface Codes {
  encoding: Encoding;
  /** Number of state bits (flip-flops). */
  bits: number;
  /** The code of each state, by name. Bit 0 is the least significant. */
  code: Record<string, number>;
  /** Names of the state bits, most significant first: Q1 Q0, or Q_Red Q_Amber… for one-hot. */
  names: string[];
}

export function encode(fsm: Fsm, encoding: Encoding): Codes {
  const n = fsm.states.length;
  const code: Record<string, number> = {};
  let bits: number;
  let names: string[];
  if (encoding === 'onehot') {
    bits = n;
    fsm.states.forEach((s, i) => (code[s.name] = 1 << i));
    // Most significant first: the last state's flip-flop is the leftmost.
    names = fsm.states.map((s) => `Q_${s.name}`).reverse();
  } else {
    bits = Math.max(1, Math.ceil(Math.log2(n)));
    fsm.states.forEach((s, i) => (code[s.name] = encoding === 'gray' ? i ^ (i >> 1) : i));
    names = Array.from({ length: bits }, (_, i) => `Q${bits - 1 - i}`);
  }
  return { encoding, bits, code, names };
}

/** The code as a string of bits, most significant first. */
export const codeText = (value: number, bits: number): string => value.toString(2).padStart(bits, '0');

export interface Cost {
  /** Flip-flops. */
  flipFlops: number;
  /** Product terms (AND gates of two or more literals). */
  terms: number;
  /** AND gates. */
  and: number;
  /** OR gates (one per function with two or more terms). */
  or: number;
  /** Inverters (one per variable used complemented). */
  not: number;
  /** AND + OR + NOT. */
  gates: number;
  /** Inputs of all those gates: a measure of wiring. */
  gateInputs: number;
  /** flip-flops + gates: the number the encodings are compared on. */
  total: number;
  /** The most inputs any AND gate has (the slowest, widest gate in the logic). */
  widest: number;
  /**
   * A rough count of 4-input lookup tables (Chapter 28) for the same functions: one when a function depends
   * on at most four signals, else enough to tie the rest in a tree. A function that is a single wire costs none.
   */
  luts: number;
}

export interface Synthesis {
  fsm: Fsm;
  codes: Codes;
  /** Variable names: the state bits (most significant first), then the inputs. */
  vars: string[];
  /** Function names: `D_<bit>` for each next-state bit (same order as `codes.names`), then the outputs. */
  functions: string[];
  logic: MultiCover;
  /** The minimised sum of products of each function, as text. */
  equations: string[];
  cost: Cost;
}

/**
 * The cube for "in this state, with inputs matching this pattern". Binary and Gray codes test every state bit;
 * a one-hot machine tests only the state's own flip-flop (the others are known to be 0), which is what makes
 * it fast and what makes its logic so regular.
 */
function cubeOf(codes: Codes, code: number, pattern: string, ni: number): Cube {
  const k = codes.bits;
  const bits = codes.encoding === 'onehot' ? Array.from({ length: k }, (_, b) => (((code >> (k - 1 - b)) & 1) ? '1' : '-')).join('') : codeText(code, k);
  return cubeFromString(bits + pattern.padEnd(ni, '-'));
}

/** The unused binary or Gray codes as don't-care cubes (all the inputs free). One-hot has none: see `cubeOf`. */
function unusedCodes(fsm: Fsm, codes: Codes, ni: number): Cube[] {
  const k = codes.bits;
  const dc = '-'.repeat(ni);
  if (codes.encoding === 'onehot') return [];
  const used = new Set(Object.values(codes.code));
  const out: Cube[] = [];
  for (let c = 0; c < 1 << k; c++) if (!used.has(c)) out.push(cubeFromString(codeText(c, k) + dc));
  return out;
}

/** Count the parts of a minimised multi-output cover. */
export function costOf(logic: MultiCover, nVars: number, flipFlops: number): Cost {
  let and = 0;
  let inputs = 0;
  let widest = 0;
  const negated = new Set<number>();
  for (const t of logic.terms) {
    let lits = 0;
    for (let v = 0; v < nVars; v++) {
      const x = getVar(t.cube, v);
      if (x === ONE) lits++;
      else if (x === ZERO) {
        lits++;
        negated.add(v);
      }
    }
    if (lits >= 2) {
      and++;
      inputs += lits;
      widest = Math.max(widest, lits);
    }
  }
  let or = 0;
  logic.covers.forEach((c) => {
    if (c.cubes.length >= 2) {
      or++;
      inputs += c.cubes.length;
    }
  });
  const not = negated.size;
  inputs += not;
  const gates = and + or + not;
  let luts = 0;
  for (const c of logic.covers) {
    const support = new Set<number>();
    for (const cube of c.cubes) for (let v = 0; v < nVars; v++) if (getVar(cube, v) === ONE || getVar(cube, v) === ZERO) support.add(v);
    const wire = c.cubes.length === 1 && support.size === 1 && [...support].every((v) => getVar(c.cubes[0]!, v) === ONE);
    if (support.size === 0 || wire) continue;
    luts += support.size <= 4 ? 1 : Math.ceil((support.size - 1) / 3);
  }
  return { flipFlops, terms: logic.terms.length, and, or, not, gates, gateInputs: inputs, total: flipFlops + gates, widest, luts };
}

/**
 * Two ways to share product terms between the functions: minimise each function alone and merge identical
 * terms, or let the PLA minimiser trade literals for shared terms. A PLA counts terms; gates count gates,
 * so try both and keep the one with fewer gates (then fewer gate inputs).
 */
function bestLogic(spec: { n: number; on: Cover[]; dc: Cover[] }, flipFlops: number): MultiCover {
  const { n } = spec;
  const alone = spec.on.map((c, j) => (c.cubes.length ? minimise(c, spec.dc[j]) : { n, cubes: [] as Cube[] }));
  const byKey = new Map<string, MultiTerm>();
  alone.forEach((c, j) => {
    for (const cube of c.cubes) {
      const t = byKey.get(cubeKey(cube));
      if (t) t.outputs.push(j);
      else byKey.set(cubeKey(cube), { cube, outputs: [j] });
    }
  });
  const terms = [...byKey.values()];
  const merged: MultiCover = { n, m: alone.length, terms, covers: alone, cost: multiCost(terms, n) };
  const shared = minimiseMulti(spec);
  const a = costOf(merged, n, flipFlops);
  const b = costOf(shared, n, flipFlops);
  return b.gates < a.gates || (b.gates === a.gates && b.gateInputs < a.gateInputs) ? shared : merged;
}

/** Synthesise a valid machine with the chosen encoding. Throws if the machine has errors. */
export function synthesise(fsm: Fsm, encoding: Encoding): Synthesis {
  const problems = validate(fsm);
  if (hasErrors(problems)) throw new Error(problems.find((p) => p.level === 'error')!.text);
  const codes = encode(fsm, encoding);
  const ni = fsm.inputs.length;
  const no = fsm.outputs.length;
  const k = codes.bits;
  const n = k + ni;
  const nf = k + no;
  const on: Cube[][] = Array.from({ length: nf }, () => []);

  for (const s of fsm.states) {
    for (const v of allInputs(ni)) {
      const r = step(fsm, s.name, v);
      const cube = cubeOf(codes, codes.code[s.name]!, v.join(''), ni);
      const next = codes.code[r.next]!;
      for (let b = 0; b < k; b++) if ((next >> (k - 1 - b)) & 1) on[b]!.push(cube);
      for (let o = 0; o < no; o++) if (r.out[o] === '1') on[k + o]!.push(cube);
    }
  }
  const dcCubes = unusedCodes(fsm, codes, ni);
  const spec = {
    n,
    on: on.map((cubes): Cover => ({ n, cubes })),
    dc: on.map((): Cover => ({ n, cubes: dcCubes })),
  };
  const logic = bestLogic(spec, k);
  const vars = [...codes.names, ...fsm.inputs];
  const functions = [...codes.names.map((q) => `D_${q}`), ...fsm.outputs];
  const equations = logic.covers.map((c) => coverToText(c, vars));
  return { fsm, codes, vars, functions, logic, equations, cost: costOf(logic, n, k) };
}

/** All three encodings, for the comparison table. */
export function compareEncodings(fsm: Fsm): Record<Encoding, Synthesis> {
  return { binary: synthesise(fsm, 'binary'), gray: synthesise(fsm, 'gray'), onehot: synthesise(fsm, 'onehot') };
}

// ── Running the logic ──────────────────────────────────────────────────────────

/** The state bits (as a code) and outputs that the *logic* computes for a code and an input vector. */
export function evalLogic(s: Synthesis, code: number, bits: readonly number[]): { next: number; out: string } {
  const k = s.codes.bits;
  const point = [...Array.from({ length: k }, (_, b) => (code >> (k - 1 - b)) & 1), ...bits];
  let next = 0;
  for (let b = 0; b < k; b++) if (evalCoverAt(s.logic.covers[b]!, point)) next |= 1 << (k - 1 - b);
  let out = '';
  for (let o = 0; o < s.fsm.outputs.length; o++) out += evalCoverAt(s.logic.covers[k + o]!, point) ? '1' : '0';
  return { next, out };
}

/** The state whose code is `code`, or undefined for an unused code. */
export function stateOfCode(s: Synthesis, code: number): string | undefined {
  return Object.keys(s.codes.code).find((n) => s.codes.code[n] === code);
}

/**
 * Check the synthesised logic against the diagram for every state and every input combination. Returns the
 * first disagreement (or null): a proof by exhaustion, since there are at most 12 × 8 cases.
 */
export function verify(s: Synthesis): string | null {
  const { fsm, codes } = s;
  const no = fsm.outputs.length;
  for (const st of fsm.states) {
    for (const v of allInputs(fsm.inputs.length)) {
      const want = step(fsm, st.name, v);
      const got = evalLogic(s, codes.code[st.name]!, v);
      if (got.next !== codes.code[want.next]) return `${st.name} with ${v.join('')}: next state ${codeText(got.next, codes.bits)}, expected ${codeText(codes.code[want.next]!, codes.bits)}`;
      if (got.out !== want.out.padEnd(no, '0')) return `${st.name} with ${v.join('')}: outputs ${got.out}, expected ${want.out}`;
    }
  }
  return null;
}

export { zeros };
