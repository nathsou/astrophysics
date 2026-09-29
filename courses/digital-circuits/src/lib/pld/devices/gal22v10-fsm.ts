/**
 * From a finite-state machine to a GAL22V10 design (Chapter 26 imports the machines of Chapter 19).
 *
 * The machine is a list of states and transitions with guard expressions over the inputs. Within
 * one state the transitions are tried in the order given and the first true guard wins; if none
 * is true the machine stays where it is. State bits are registered outputs of the GAL that feed
 * back into the array; Moore outputs (a set of states) and Mealy outputs (an expression over the
 * inputs and the state bits) are combinational outputs.
 *
 * Reset: the state bits are stored so that the register state after power-up (all registers 0)
 * and after AR is the reset state. A state bit that is 1 in the reset state's code is therefore
 * stored inverted (active-low macrocell, S0 = 0): its pin still shows the state code. Unused state
 * codes are don't cares for the next-state and output equations (except for one-hot codes).
 */
import type { GalDesign, GalOutputSpec } from './gal22v10-fit';

export interface GalFsmTransition {
  from: string;
  to: string;
  /** Guard over the input names; default: always. */
  when?: string;
}

export interface GalFsmOutput {
  name: string;
  /** Moore output: 1 in these states. */
  states?: string[];
  /** Mealy output (or any function of inputs and state bits): an expression. */
  expr?: string;
}

export interface GalFsm {
  title?: string;
  signature?: string;
  inputs: string[];
  states: string[];
  /** Reset state (default: the first). */
  reset?: string;
  /** 'binary' (default), 'gray', 'one-hot', or an explicit code per state. */
  encoding?: 'binary' | 'gray' | 'one-hot' | number[];
  /** Names of the state bits, most significant first (default Q(k−1)…Q0). */
  stateBits?: string[];
  transitions: GalFsmTransition[];
  outputs?: GalFsmOutput[];
  clock?: string;
  /** An input that resets the machine asynchronously (AR). */
  resetInput?: string;
}

export interface GalFsmDesign {
  design: GalDesign;
  /** The code of each state. */
  codes: Record<string, number>;
  stateBits: string[];
}

export class FsmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FsmError';
  }
}

export function fsmToGalDesign(fsm: GalFsm): GalFsmDesign {
  const N = fsm.states.length;
  if (N < 1) throw new FsmError('A machine needs at least one state');
  if (new Set(fsm.states).size !== N) throw new FsmError('State names must be distinct');
  const idx = (s: string) => {
    const i = fsm.states.indexOf(s);
    if (i < 0) throw new FsmError(`Unknown state "${s}"`);
    return i;
  };
  const enc = fsm.encoding ?? 'binary';
  let codes: number[];
  let bits: number;
  if (Array.isArray(enc)) {
    if (enc.length !== N) throw new FsmError('One code per state is needed');
    if (new Set(enc).size !== N) throw new FsmError('State codes must be distinct');
    codes = enc.slice();
    bits = Math.max(1, ...enc.map((c) => c.toString(2).length));
  } else if (enc === 'one-hot') {
    codes = fsm.states.map((_, i) => 1 << i);
    bits = N;
  } else {
    bits = Math.max(1, Math.ceil(Math.log2(N)));
    codes = fsm.states.map((_, i) => (enc === 'gray' ? i ^ (i >> 1) : i));
  }
  if (bits > 10) throw new FsmError(`${N} states need ${bits} state bits; a GAL22V10 has 10 macrocells`);
  const names = fsm.stateBits ?? Array.from({ length: bits }, (_, i) => `Q${bits - 1 - i}`);
  if (names.length !== bits) throw new FsmError(`The encoding needs ${bits} state bits, ${names.length} names given`);

  const decode = (code: number) => '(' + names.map((_, i) => ((code >> (bits - 1 - i)) & 1 ? names[i]! : `!${names[i]!}`)).join(' & ') + ')';
  const resetState = fsm.reset ?? fsm.states[0]!;
  const resetCode = codes[idx(resetState)]!;

  const trans = fsm.transitions.map((t) => ({ ...t, fromI: idx(t.from), toI: idx(t.to) }));
  const next = names.map((_, i) => {
    const k = bits - 1 - i;
    const terms: string[] = [];
    fsm.states.forEach((_s, s) => {
      let remaining = '1';
      for (const t of trans.filter((x) => x.fromI === s)) {
        const g = t.when ?? '1';
        if ((codes[t.toI]! >> k) & 1) terms.push(`${decode(codes[s]!)} & (${g}) & ${remaining}`);
        remaining = `${remaining} & !(${g})`;
      }
      if ((codes[s]! >> k) & 1) terms.push(`${decode(codes[s]!)} & ${remaining}`);
    });
    return terms.length ? terms.join(' | ') : '0';
  });

  // Unused codes are don't cares (not for one-hot: there are far too many).
  let dc: string | undefined;
  if (enc !== 'one-hot' && bits <= 6) {
    const unused: string[] = [];
    for (let c = 0; c < 2 ** bits; c++) if (!codes.includes(c)) unused.push(decode(c));
    if (unused.length) dc = unused.join(' | ');
  }

  const stateOutputs: GalOutputSpec[] = names.map((name, i) => ({
    name,
    expr: next[i]!,
    dc,
    registered: true,
    polarity: (resetCode >> (bits - 1 - i)) & 1 ? 'low' : 'high',
  }));
  const outs: GalOutputSpec[] = (fsm.outputs ?? []).map((o) => {
    if (o.states && o.expr) throw new FsmError(`Output ${o.name}: give either states or expr, not both`);
    if (!o.states && !o.expr) throw new FsmError(`Output ${o.name}: needs states or expr`);
    const expr = o.expr ?? (o.states!.length ? o.states!.map((s) => decode(codes[idx(s)]!)).join(' | ') : '0');
    return { name: o.name, expr, dc: o.states ? dc : undefined };
  });
  const inputs = [...fsm.inputs, ...(fsm.resetInput && !fsm.inputs.includes(fsm.resetInput) ? [fsm.resetInput] : [])];
  return {
    design: {
      title: fsm.title,
      signature: fsm.signature,
      inputs,
      outputs: [...stateOutputs, ...outs],
      clock: fsm.clock ?? 'CLK',
      ar: fsm.resetInput,
    },
    codes: Object.fromEntries(fsm.states.map((s, i) => [s, codes[i]!])),
    stateBits: names,
  };
}
