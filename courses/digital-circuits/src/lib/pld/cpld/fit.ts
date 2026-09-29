/**
 * The vCPLD-32 fitter: from Boolean equations to the configuration bits.
 *
 * Meaning of the equations: every name stands for the logic level on its pin (or, for a buried
 * output, on its macrocell). A registered output `Q` with expression `f` means "after the next
 * rising edge of the global clock, the level on Q is f(current levels)"; a combinational output
 * follows its expression. Outputs may read each other (feedback), which is how state machines are
 * built. The fitter
 *
 *   1. minimises every output with Quine–McCluskey or Espresso in both output polarities (the
 *      macrocell's XOR bit inverts on the way out), and for registered outputs also for a T
 *      flip-flop (whose input is f XOR Q: a counter bit toggles on one product term), keeping the
 *      candidate with the fewest product terms, then literals;
 *   2. partitions the outputs into the four function blocks (`partition.ts`: greedy construction
 *      and Kernighan–Lin refinement so that each block reads at most 24 distinct signals and its
 *      product-term allocation succeeds);
 *   3. places the outputs of each block in its macrocells and allocates product terms, borrowing
 *      from neighbouring macrocells where an output needs more than five (`allocator.ts`);
 *   4. assigns pins: an output's pin is its macrocell's; inputs take pads whose macrocell is not
 *      driving a pin;
 *   5. assigns the interconnect: each block's 24 input multiplexers select the distinct signals its
 *      terms read;
 *   6. writes the bits, and reports utilisation, borrowing and timing.
 */
import {
  BIT_COUNT,
  FB_INPUTS,
  FUNCTION_BLOCKS,
  IO_PINS,
  MACROCELLS,
  MACROCELLS_PER_FB,
  MAX_TERMS_PER_MC,
  MC_INIT,
  MC_OE,
  MC_REG,
  MC_TFF,
  MC_XOR,
  MUX_BITS,
  OE_ALWAYS,
  OE_GLOBAL,
  OE_OFF,
  OE_TERM,
  STEER_NAMES,
  TERMS_PER_FB,
  TERMS_PER_MC,
  arrayBit,
  interconnectBit,
  ioFb,
  ioMc,
  ioOf,
  mcBit,
  setUsercode,
  steerBit,
  termEnableBit,
  termOf,
  toFuseMap,
  usercodeText,
  getUsercode,
  type CpldFuseMap,
  type Level,
} from '../devices/vcpld32-arch';
import { VCpld32, type CpldSnapshot } from '../devices/vcpld32';
import {
  ONE,
  ZERO,
  compareCost,
  coverCost,
  cubeToString,
  getVar,
  isUniversal,
  literalVars,
  type Cover,
  type Cube,
} from '../twolevel/cube';
import { STYLES, coverToText, exprToCover, exprVars, type Expr } from '../twolevel/expr';
import { minimise, minimiseComplement, type MinimiseOptions } from '../twolevel/minimise';
import { maxTermsAt, type FbAllocation } from './allocator';
import { CpldFitError, asExpr, designFromEquations, type CpldDesign, type CpldInputSpec, type CpldOutputSpec, type EquationOptions } from './design';
import { partition, type PartItem, type PartResult } from './partition';
import {
  T_FB,
  T_PD,
  T_PTA,
  T_REG2REG,
  T_SU,
  T_CO,
  TIMING,
  TIMING_STATEMENT,
  type OutputTiming,
  type TimingSummary,
} from './timing';

export * from './design';

export interface CpldFitOptions extends MinimiseOptions {
  /** Passes of the Kernighan–Lin refinement (default 12; it stops early when a pass gains nothing). */
  klPasses?: number;
}

export interface CpldOutputFit {
  name: string;
  /** Function block and macrocell within it. */
  fb: number;
  mc: number;
  /** Macrocell number 0–31 (= the I/O pad it is paired with). */
  macrocell: number;
  /** I/O pin carrying the output, or null for a buried macrocell. */
  pin: number | null;
  buried: boolean;
  registered: boolean;
  /** 'comb', 'D' or 'T'. */
  ff: 'comb' | 'D' | 'T';
  /** 'low': the macrocell's XOR inverts the sum of the stored cover. */
  polarity: 'high' | 'low';
  init: Level;
  oeMode: 'off' | 'always' | 'global' | 'term';
  /** Product terms in the OR gate (excluding the output-enable term). */
  terms: number;
  /** Terms collected from neighbours. */
  borrowed: number;
  /** Slots this macrocell lent to neighbours. */
  lent: number;
  /** Terms the macrocell could have at most in this position (10 at a chain end, else 15; one fewer with an enable term). */
  capacity: number;
  /** The candidates considered: label and term count. */
  alternatives: { label: string; terms: number }[];
  /** The stored cover, over `fit.variables`. */
  cover: Cover;
  /** The stored sum in galette style. */
  sum: string;
  oe?: string;
  /** Signals read (including the output enable), by name. */
  reads: string[];
  timing: OutputTiming;
}

export interface CpldInputFit {
  name: string;
  pin: number;
  /** Blocks that read the pin. */
  readBy: number[];
}

export interface CpldFbFit {
  fb: number;
  /** Outputs placed in this block (names, by macrocell). */
  outputs: (string | null)[];
  macrocellsUsed: number;
  /** Product terms in use, including output-enable terms (of 40). */
  termsUsed: number;
  /** Distinct signals the block reads (of 24). */
  inputsUsed: number;
  inputNames: string[];
  borrowed: number;
  lent: number;
  /** I/O pins in use in this block: driven outputs and input pads. */
  pinsUsed: number;
  allocation: FbAllocation;
}

export interface CpldFit {
  design: CpldDesign;
  bits: Uint8Array;
  /** Names of the variables the covers are over: the inputs, then the outputs. */
  variables: string[];
  outputs: CpldOutputFit[];
  inputs: CpldInputFit[];
  fbs: CpldFbFit[];
  /** I/O pin of every signal that has one: inputs and driven outputs. */
  pinOf: Record<string, number>;
  /** Function block and macrocell of every output. */
  mcOf: Record<string, { fb: number; mc: number; macrocell: number }>;
  utilisation: {
    macrocells: number;
    productTerms: number;
    productTermCapacity: number;
    pins: number;
    borrowedTerms: number;
    /** Sum over blocks of the signals each reads: multiplexers of the interconnect matrix in use (of 96). */
    blockInputs: number;
    blockInputCapacity: number;
  };
  partition: PartResult['stats'];
  timing: TimingSummary;
  warnings: string[];
  usercode: number;
  /** A device programmed with the bits (a fresh one on every call). */
  device(): VCpld32;
  simulate(steps: NamedStep[]): NamedResult[];
  fuseMap(): CpldFuseMap;
  report(): string;
}

export interface NamedStep {
  /** Levels of the input pins by name (missing inputs read 0). */
  inputs?: Record<string, number>;
  gsr?: number;
  goe?: number;
  /** Rising clock edge after the inputs settle (default true). */
  clock?: boolean;
}

export interface NamedResult {
  /** Level of every output (its macrocell's output), and of every input as applied. */
  values: Record<string, Level>;
  /** Outputs that drive their pin. */
  driven: Record<string, boolean>;
  snapshot: CpldSnapshot;
}

// ---------------------------------------------------------------------------------------------

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function canonical(cubes: Cube[], n: number): Cube[] {
  const key = (c: Cube) => cubeToString(c, n).replace(/1/g, 'a').replace(/0/g, 'b').replace(/-/g, 'c');
  return cubes.slice().sort((x, y) => (key(x) < key(y) ? -1 : key(x) > key(y) ? 1 : 0));
}

interface Candidate {
  polarity: 'high' | 'low';
  ff: 'comb' | 'D' | 'T';
  cubes: Cube[];
  label: string;
}

function pinCheck(name: string, pin: number, what: string): void {
  if (!Number.isInteger(pin) || pin < 0 || pin >= IO_PINS) throw new CpldFitError('pin', `${what} ${name}: there is no I/O pin ${pin} (pins are 0–${IO_PINS - 1})`);
}

export function fitCpld(design: CpldDesign, opts: CpldFitOptions = {}): CpldFit {
  const inputs: CpldInputSpec[] = design.inputs.map((i) => (typeof i === 'string' ? { name: i } : { ...i }));
  const outputs: CpldOutputSpec[] = design.outputs;
  const warnings: string[] = [];

  // -- Names ----------------------------------------------------------------------------------
  const seen = new Set<string>();
  const declare = (name: string, what: string) => {
    if (!NAME.test(name)) throw new CpldFitError('bad-name', `${what} "${name}" is not a valid signal name (letters, digits and underscores, starting with a letter or underscore)`);
    if (seen.has(name)) throw new CpldFitError('duplicate', `The name ${name} is used twice (${what})`);
    seen.add(name);
  };
  for (const i of inputs) declare(i.name, 'input');
  for (const o of outputs) declare(o.name, 'output');
  const special = [design.clock, design.gsr, design.goe].filter((s): s is string => s !== undefined);
  for (const s of special) declare(s, 'global pin');

  const ni = inputs.length;
  const no = outputs.length;
  const variables = [...inputs.map((i) => i.name), ...outputs.map((o) => o.name)];
  const n = variables.length;
  const drivers = outputs.filter((o) => !o.buried);
  if (no > MACROCELLS) throw new CpldFitError('too-many-outputs', `${no} outputs, but the vCPLD-32 has only ${MACROCELLS} macrocells (4 function blocks of 8)`);
  if (ni + drivers.length > IO_PINS) {
    throw new CpldFitError(
      'too-many-signals',
      `${ni} inputs and ${drivers.length} outputs that drive pins need ${ni + drivers.length} I/O pins, but the vCPLD-32 has ${IO_PINS}. Outputs marked buried do not use their pin.`,
    );
  }

  const cover = (e: string | Expr, what: string): Cover => {
    const x = asExpr(e, what);
    for (const v of exprVars(x)) {
      if (!variables.includes(v)) {
        const hint = special.includes(v) ? ` (${v} is a global pin: the clock, set/reset and output enable are not signals the logic can read)` : '';
        throw new CpldFitError('unknown-signal', `${what}: unknown signal "${v}"${hint}. Declared: ${variables.join(', ')}`);
      }
    }
    return exprToCover(x, variables);
  };

  // -- Minimisation ----------------------------------------------------------------------------
  interface Work {
    spec: CpldOutputSpec;
    cand: Candidate;
    alternatives: { label: string; terms: number }[];
    oe?: Cube;
    oeMode: number;
    support: number[];
    fb?: number;
    mc?: number;
    lit: number;
  }
  const work: Work[] = outputs.map((spec) => {
    const what = `Equation for ${spec.name}`;
    const expr = asExpr(spec.expr, what);
    const on = cover(expr, what);
    const dc = spec.dc !== undefined ? cover(spec.dc, `Don't-care set of ${spec.name}`) : undefined;
    const pols: ('high' | 'low')[] = spec.polarity === 'high' ? ['high'] : spec.polarity === 'low' ? ['low'] : ['high', 'low'];
    const cands: Candidate[] = [];
    const add = (f: Cover, fdc: Cover | undefined, ff: 'comb' | 'D' | 'T', label: string) => {
      for (const pol of pols) {
        const c = pol === 'high' ? minimise(f, fdc, opts) : minimiseComplement(f, fdc, opts);
        cands.push({ polarity: pol, ff, cubes: canonical(c.cubes, n), label: `${label}, active ${pol}` });
      }
    };
    if (!spec.registered) add(on, dc, 'comb', 'combinational');
    else {
      const kind = spec.ff ?? 'auto';
      if (kind !== 'T') add(on, dc, 'D', 'D flip-flop');
      if (kind !== 'D') {
        // T = f XOR Q. Q is the output's own name, that is, its feedback.
        const t = cover({ kind: 'xor', args: [expr, { kind: 'var', name: spec.name }] }, what);
        add(t, dc, 'T', 'T flip-flop');
      }
    }
    let best = cands[0]!;
    for (const c of cands.slice(1)) {
      if (compareCost(coverCost({ n, cubes: c.cubes }), coverCost({ n, cubes: best.cubes })) < 0) best = c;
    }
    // Output enable.
    let oe: Cube | undefined;
    let oeMode: number = spec.buried ? OE_OFF : OE_ALWAYS;
    if (spec.oe !== undefined) {
      if (spec.buried) throw new CpldFitError('syntax', `${spec.name} is buried, so it has no output enable`);
      if (spec.globalOe) throw new CpldFitError('syntax', `${spec.name} has both a product-term output enable and the global one`);
      const cubes = minimise(cover(spec.oe, `Output enable of ${spec.name}`), undefined, opts).cubes;
      if (cubes.length > 1) {
        throw new CpldFitError(
          'oe-terms',
          `The output enable of ${spec.name} needs ${cubes.length} product terms, but a macrocell's enable is a single product term. Simplify the condition to one AND of signals, or use the global output enable.`,
          { output: spec.name, needed: cubes.length, capacity: 1 },
        );
      }
      if (cubes.length === 0) {
        oeMode = OE_OFF;
        warnings.push(`The output enable of ${spec.name} is always false: the pin is never driven.`);
      } else if (isUniversal(cubes[0]!, n)) oeMode = OE_ALWAYS;
      else {
        oe = cubes[0]!;
        oeMode = OE_TERM;
      }
    } else if (spec.globalOe) {
      if (spec.buried) throw new CpldFitError('syntax', `${spec.name} is buried, so it has no output enable`);
      oeMode = OE_GLOBAL;
    }
    const vars = new Set<number>();
    for (const c of best.cubes) for (const v of literalVars(c, n)) vars.add(v);
    if (oe) for (const v of literalVars(oe, n)) vars.add(v);
    const support = [...vars].sort((a, b) => a - b);
    if (spec.pin !== undefined) pinCheck(spec.name, spec.pin, 'Output');
    const w: Work = {
      spec,
      cand: best,
      alternatives: cands.map((c) => ({ label: c.label, terms: c.cubes.length })),
      oe,
      oeMode,
      support,
      fb: spec.pin !== undefined ? ioFb(spec.pin) : undefined,
      mc: spec.pin !== undefined ? ioMc(spec.pin) : undefined,
      lit: best.cubes.reduce((s, c) => s + literalVars(c, n).length, 0),
    };
    return w;
  });

  // -- Checks that no partition can fix --------------------------------------------------------
  for (const w of work) {
    const name = w.spec.name;
    const need = w.cand.cubes.length;
    const hasOe = w.oe !== undefined;
    const most = w.mc !== undefined ? maxTermsAt(w.mc, hasOe) : maxTermsAt(3, hasOe);
    if (need > most) {
      const alt = w.alternatives.map((a) => `${a.terms} (${a.label})`).join('; ');
      throw new CpldFitError(
        'too-many-terms',
        `Output ${name} needs ${need} product terms even after choosing the best of ${alt}. ` +
          `A macrocell can collect at most ${most}${w.mc !== undefined ? ` at pin ${w.spec.pin}` : ''}: its own ${hasOe ? TERMS_PER_MC - 1 : TERMS_PER_MC} slots${hasOe ? ' (one is the output-enable term)' : ''} plus ${TERMS_PER_MC} borrowed from each neighbour (${MAX_TERMS_PER_MC} at best, and only ${TERMS_PER_MC * 2} at either end of a block). ` +
          `Split the function: compute part of it in another (buried) output and read that signal here.`,
        { output: name, needed: need, capacity: most },
      );
    }
    if (w.support.length > FB_INPUTS) {
      throw new CpldFitError(
        'fb-inputs',
        `Output ${name} reads ${w.support.length} different signals (${w.support.map((v) => variables[v]).join(', ')}), but a function block has only ${FB_INPUTS} inputs. ` +
          `Compute part of it in another output (a buried macrocell will do) and read that signal instead.`,
        { output: name, needed: w.support.length, capacity: FB_INPUTS, signals: w.support.map((v) => variables[v]!) },
      );
    }
  }
  const totalTerms = work.reduce((s, w) => s + w.cand.cubes.length + (w.oe ? 1 : 0), 0);
  if (totalTerms > MACROCELLS * TERMS_PER_MC) {
    throw new CpldFitError('too-many-terms', `The design needs ${totalTerms} product terms in all, but the vCPLD-32 has ${MACROCELLS * TERMS_PER_MC} (5 per macrocell).`, { needed: totalTerms, capacity: MACROCELLS * TERMS_PER_MC });
  }

  // -- Pin constraints ---------------------------------------------------------------------------
  const pinnedBy = new Map<number, string>();
  const claim = (pin: number, name: string, kind: string) => {
    const other = pinnedBy.get(pin);
    if (other) throw new CpldFitError('pin', `${name} and ${other} are both on I/O pin ${pin} (${kind})`);
    pinnedBy.set(pin, name);
  };
  const reserved: boolean[][] = Array.from({ length: FUNCTION_BLOCKS }, () => new Array<boolean>(MACROCELLS_PER_FB).fill(false));
  for (const i of inputs) {
    if (i.pin === undefined) continue;
    pinCheck(i.name, i.pin, 'Input');
    claim(i.pin, i.name, 'input');
    reserved[ioFb(i.pin)]![ioMc(i.pin)] = true;
  }
  const macrocellClaim = new Map<number, string>();
  for (const w of work) {
    if (w.spec.pin === undefined) continue;
    const other = macrocellClaim.get(w.spec.pin);
    if (other) throw new CpldFitError('pin', `${w.spec.name} and ${other} are both on macrocell ${w.spec.pin}`);
    macrocellClaim.set(w.spec.pin, w.spec.name);
    if (!w.spec.buried) {
      const inp = pinnedBy.get(w.spec.pin);
      if (inp) throw new CpldFitError('pin', `Output ${w.spec.name} and input ${inp} are both on I/O pin ${w.spec.pin}`);
    }
  }

  // -- Partition ---------------------------------------------------------------------------------
  const items: PartItem[] = work.map((w) => ({
    support: w.support,
    terms: w.cand.cubes.length,
    oe: w.oe !== undefined,
    buried: !!w.spec.buried,
    fb: w.fb,
    mc: w.mc,
  }));
  const part = partition(items, { reserved, maxPasses: opts.klPasses });
  if (!part.feasible) {
    const p = part.problems[0]!;
    const inBlock = part.members[p.fb]!.map((i) => outputs[i]!.name);
    if (p.kind === 'inputs') {
      const sig = new Set<number>();
      for (const i of part.members[p.fb]!) for (const s of items[i]!.support) sig.add(s);
      const names = [...sig].sort((a, b) => a - b).map((v) => variables[v]!);
      throw new CpldFitError(
        'fb-inputs',
        `Cannot partition the outputs: function block ${p.fb} (outputs ${inBlock.join(', ')}) would need ${p.inputs} distinct inputs (${names.join(', ')}), but a block has only ${FB_INPUTS}. ` +
          `The best partition found (${part.stats.passes} refinement passes) still overloads it. Reduce the signals shared between outputs, or place some outputs' logic in buried macrocells so fewer signals fan out.`,
        { block: p.fb, needed: p.inputs, capacity: FB_INPUTS, signals: names },
      );
    }
    throw new CpldFitError(
      'too-many-terms',
      `Cannot partition the outputs: function block ${p.fb} (outputs ${inBlock.join(', ')}) needs ${p.termLoad} product terms${p.members > MACROCELLS_PER_FB ? ` and ${p.members} macrocells` : ''}, ` +
        `and they cannot be allocated over its ${MACROCELLS_PER_FB} macrocells (${TERMS_PER_FB} terms, borrowed only from immediate neighbours). Other blocks are too full to take some of them, or pin constraints keep them together.`,
      { block: p.fb, needed: p.termLoad, capacity: TERMS_PER_FB },
    );
  }

  // -- Placement of outputs in macrocells ----------------------------------------------------------
  const macrocellOf = new Array<number>(no).fill(-1);
  const allocOf = part.arrangements.map((a) => a!.allocation);
  part.members.forEach((list, fb) => {
    const arr = part.arrangements[fb]!;
    list.forEach((oi, k) => (macrocellOf[oi] = ioOf(fb, arr.positions[k]!)));
  });
  const outAt = new Map<number, number>(); // macrocell → output index
  macrocellOf.forEach((m, oi) => outAt.set(m, oi));

  // -- Input pins ---------------------------------------------------------------------------------------
  const pinOfInput = new Array<number>(ni).fill(-1);
  const padTaken = new Set<number>();
  work.forEach((w, oi) => {
    if (!w.spec.buried) padTaken.add(macrocellOf[oi]!);
  });
  inputs.forEach((i, k) => {
    if (i.pin !== undefined) {
      pinOfInput[k] = i.pin;
      padTaken.add(i.pin);
    }
  });
  const hasRole = (m: number) => {
    const fb = ioFb(m);
    const a = allocOf[fb]!.mcs[ioMc(m)]!;
    return outAt.has(m) || a.lent > 0;
  };
  const freePads = [...Array(IO_PINS).keys()]
    .filter((p) => !padTaken.has(p))
    .sort((a, b) => Number(hasRole(a)) - Number(hasRole(b)) || a - b);
  inputs.forEach((_, k) => {
    if (pinOfInput[k]! >= 0) return;
    pinOfInput[k] = freePads.shift()!;
  });

  // -- Interconnect --------------------------------------------------------------------------------------
  const sourceOfVar = (v: number) => (v < ni ? pinOfInput[v]! : IO_PINS + macrocellOf[v - ni]!);
  const fbSignals: number[][] = part.members.map((list) => {
    const s = new Set<number>();
    for (const oi of list) for (const v of work[oi]!.support) s.add(v);
    return [...s].sort((a, b) => a - b);
  });
  const inputIndex: Map<number, number>[] = fbSignals.map((sigs) => new Map(sigs.map((v, k) => [v, k])));

  // -- Bits -----------------------------------------------------------------------------------------------
  const bits = new Uint8Array(BIT_COUNT);
  for (let fb = 0; fb < FUNCTION_BLOCKS; fb++) {
    fbSignals[fb]!.forEach((v, k) => {
      const src = sourceOfVar(v);
      for (let b = 0; b < MUX_BITS; b++) bits[interconnectBit(fb, k, b)] = (src >> b) & 1;
    });
    // Steering of every macrocell of the block (also of those that only lend).
    const alloc = allocOf[fb]!;
    for (const m of alloc.mcs) {
      m.steer.forEach((name, slot) => {
        const code = STEER_NAMES.indexOf(name);
        bits[steerBit(fb, m.mc, slot, 0)] = code & 1;
        bits[steerBit(fb, m.mc, slot, 1)] = (code >> 1) & 1;
      });
    }
  }
  const writeTerm = (fb: number, term: number, cube: Cube | null) => {
    bits[termEnableBit(fb, term)] = 1;
    if (!cube) return;
    for (const v of literalVars(cube, n)) {
      const k = inputIndex[fb]!.get(v)!;
      const val = getVar(cube, v);
      bits[arrayBit(fb, term, k, val === ZERO)] = val === ONE || val === ZERO ? 1 : 0;
    }
  };
  work.forEach((w, oi) => {
    const m = macrocellOf[oi]!;
    const fb = ioFb(m);
    const mc = ioMc(m);
    const a = allocOf[fb]!.mcs[mc]!;
    w.cand.cubes.forEach((cube, k) => {
      const src = a.sources[k]!;
      writeTerm(fb, termOf(src.mc, src.slot), cube);
    });
    if (w.oe) writeTerm(fb, termOf(mc, TERMS_PER_MC - 1), w.oe);
    bits[mcBit(fb, mc, MC_XOR)] = w.cand.polarity === 'low' ? 1 : 0;
    bits[mcBit(fb, mc, MC_REG)] = w.spec.registered ? 1 : 0;
    bits[mcBit(fb, mc, MC_TFF)] = w.cand.ff === 'T' ? 1 : 0;
    bits[mcBit(fb, mc, MC_INIT)] = w.spec.registered && w.spec.init ? 1 : 0;
    bits[mcBit(fb, mc, MC_OE)] = w.oeMode & 1;
    bits[mcBit(fb, mc, MC_OE + 1)] = (w.oeMode >> 1) & 1;
  });
  const usercode = design.usercode ?? '';
  setUsercode(bits, usercode);

  // -- Results ---------------------------------------------------------------------------------------------
  const asText = (cubes: Cube[]) => coverToText({ n, cubes }, variables, STYLES.galette);
  const depsOf = (oi: number) => work[oi]!.support.filter((v) => v >= ni).map((v) => v - ni);
  // Combinational chains: the delay added by comb macrocells ahead of an output.
  const pta = (oi: number) => (allocOf[ioFb(macrocellOf[oi]!)]!.mcs[ioMc(macrocellOf[oi]!)]!.borrowed > 0 ? T_PTA : 0);
  const extraMemo = new Map<number, { extra: number; depth: number; loop: boolean }>();
  const visiting = new Set<number>();
  const chain = (oi: number): { extra: number; depth: number; loop: boolean } => {
    const hit = extraMemo.get(oi);
    if (hit) return hit;
    if (visiting.has(oi)) return { extra: 0, depth: 0, loop: true };
    visiting.add(oi);
    let extra = 0;
    let depth = 0;
    let loop = false;
    for (const d of depsOf(oi)) {
      if (work[d]!.spec.registered) continue;
      const c = chain(d);
      extra = Math.max(extra, T_FB + pta(d) + c.extra);
      depth = Math.max(depth, 1 + c.depth);
      loop ||= c.loop;
    }
    visiting.delete(oi);
    const r = { extra, depth, loop };
    extraMemo.set(oi, r);
    return r;
  };
  const outFits: CpldOutputFit[] = work.map((w, oi) => {
    const m = macrocellOf[oi]!;
    const fb = ioFb(m);
    const mc = ioMc(m);
    const a = allocOf[fb]!.mcs[mc]!;
    const c = chain(oi);
    const p = pta(oi);
    const registered = !!w.spec.registered;
    const timing: OutputTiming = registered
      ? { kind: 'reg', tsu: T_SU + p + c.extra, tco: T_CO, tReg2Reg: T_REG2REG + p + c.extra, combDepth: c.depth, loop: c.loop, borrowPenalty: p > 0 }
      : { kind: 'comb', tpd: T_PD + p + c.extra, combDepth: c.depth, loop: c.loop, borrowPenalty: p > 0 };
    return {
      name: w.spec.name,
      fb,
      mc,
      macrocell: m,
      pin: w.spec.buried || w.oeMode === OE_OFF ? null : m,
      buried: !!w.spec.buried,
      registered,
      ff: w.cand.ff,
      polarity: w.cand.polarity,
      init: registered && w.spec.init ? 1 : 0,
      oeMode: (['off', 'always', 'global', 'term'] as const)[w.oeMode]!,
      terms: w.cand.cubes.length,
      borrowed: a.borrowed,
      lent: a.lent,
      capacity: maxTermsAt(mc, w.oe !== undefined),
      alternatives: w.alternatives,
      cover: { n, cubes: w.cand.cubes },
      sum: asText(w.cand.cubes),
      oe: w.oe ? asText([w.oe]) : undefined,
      reads: w.support.map((v) => variables[v]!),
      timing,
    };
  });
  const inFits: CpldInputFit[] = inputs.map((i, k) => ({
    name: i.name,
    pin: pinOfInput[k]!,
    readBy: fbSignals.map((s, fb) => (s.includes(k) ? fb : -1)).filter((fb) => fb >= 0),
  }));
  const fbFits: CpldFbFit[] = part.members.map((list, fb) => {
    const alloc = allocOf[fb]!;
    const outputsAt: (string | null)[] = new Array<string | null>(MACROCELLS_PER_FB).fill(null);
    for (const oi of list) outputsAt[ioMc(macrocellOf[oi]!)] = outputs[oi]!.name;
    let pinsUsed = 0;
    for (let mc = 0; mc < MACROCELLS_PER_FB; mc++) {
      const io = ioOf(fb, mc);
      const oi = outAt.get(io);
      if ((oi !== undefined && !work[oi]!.spec.buried) || inFits.some((i) => i.pin === io)) pinsUsed++;
    }
    return {
      fb,
      outputs: outputsAt,
      macrocellsUsed: list.length,
      termsUsed: alloc.termsUsed,
      inputsUsed: fbSignals[fb]!.length,
      inputNames: fbSignals[fb]!.map((v) => variables[v]!),
      borrowed: alloc.borrowed,
      lent: alloc.mcs.reduce((s, m) => s + m.lent, 0),
      pinsUsed,
      allocation: alloc,
    };
  });
  const pinOf: Record<string, number> = {};
  inFits.forEach((i) => (pinOf[i.name] = i.pin));
  const mcOf: Record<string, { fb: number; mc: number; macrocell: number }> = {};
  outFits.forEach((o) => {
    mcOf[o.name] = { fb: o.fb, mc: o.mc, macrocell: o.macrocell };
    if (o.pin !== null) pinOf[o.name] = o.pin;
  });

  const combs = outFits.filter((o) => !o.registered);
  const regs = outFits.filter((o) => o.registered);
  const worstReg2Reg = Math.max(0, ...regs.map((o) => o.timing.tReg2Reg ?? 0));
  const timing: TimingSummary = {
    constants: TIMING,
    worstTpd: Math.max(0, ...combs.map((o) => o.timing.tpd ?? 0)),
    worstTsu: Math.max(0, ...regs.map((o) => o.timing.tsu ?? 0)),
    worstTco: regs.length ? T_CO : 0,
    fmaxMHz: regs.length ? 1000 / worstReg2Reg : Infinity,
    statement: TIMING_STATEMENT,
  };
  for (const o of outFits) if (o.timing.loop) warnings.push(`${o.name} is part of a combinational feedback loop; its value depends on the initial state and it may oscillate.`);
  const unusedInputs = inputs.filter((_, k) => !part.members.some((_, fb) => fbSignals[fb]!.includes(k)));
  for (const i of unusedInputs) warnings.push(`Input ${i.name} is not read by any output.`);

  const fit: CpldFit = {
    design,
    bits,
    variables,
    outputs: outFits,
    inputs: inFits,
    fbs: fbFits,
    pinOf,
    mcOf,
    utilisation: {
      macrocells: no,
      productTerms: totalTerms,
      productTermCapacity: MACROCELLS * TERMS_PER_MC,
      pins: ni + outFits.filter((o) => o.pin !== null).length,
      borrowedTerms: fbFits.reduce((s, f) => s + f.borrowed, 0),
      blockInputs: fbFits.reduce((s, f) => s + f.inputsUsed, 0),
      blockInputCapacity: FUNCTION_BLOCKS * FB_INPUTS,
    },
    partition: part.stats,
    timing,
    warnings,
    usercode: getUsercode(bits),
    device: () => new VCpld32(bits),
    simulate: (steps) => simulateNamed(fit, steps),
    fuseMap: () => toFuseMap(bits),
    report: () => reportText(fit),
  };
  return fit;
}

/** Parse equations (see `designFromEquations`) and fit them. */
export function fitCpldEquations(text: string, opts: EquationOptions & CpldFitOptions = {}): CpldFit {
  return fitCpld(designFromEquations(text, opts), opts);
}

// ---------------------------------------------------------------------------------------------
// Simulation by name

/** External pin levels for the device from named input levels. */
export function pinLevelsFor(fit: CpldFit, values: Record<string, number>): Level[] {
  const levels: Level[] = new Array<Level>(IO_PINS).fill(0);
  for (const [name, v] of Object.entries(values)) {
    const inp = fit.inputs.find((i) => i.name === name);
    if (!inp) throw new CpldFitError('unknown-signal', `No input named ${name}`);
    levels[inp.pin] = v ? 1 : 0;
  }
  return levels;
}

function simulateNamed(fit: CpldFit, steps: NamedStep[]): NamedResult[] {
  const dev = fit.device();
  return steps.map((s) => {
    const pins = pinLevelsFor(fit, s.inputs ?? {});
    const inputs = { pins, gsr: s.gsr, goe: s.goe };
    const snapshot = s.clock === false ? dev.evaluate(inputs) : dev.clock(inputs);
    const values: Record<string, Level> = {};
    const driven: Record<string, boolean> = {};
    for (const i of fit.inputs) values[i.name] = pins[i.pin]!;
    for (const o of fit.outputs) {
      values[o.name] = snapshot.mc[o.macrocell]!;
      driven[o.name] = snapshot.driven[o.macrocell]!;
    }
    return { values, driven, snapshot };
  });
}

// ---------------------------------------------------------------------------------------------
// Report

function reportText(fit: CpldFit): string {
  const lines: string[] = [];
  const u = fit.utilisation;
  const code = usercodeText(fit.usercode);
  lines.push(`vCPLD-32${fit.design.title ? `  ${fit.design.title}` : ''}${code ? `  USERCODE "${code}"` : ''}`);
  lines.push(
    `Macrocells ${u.macrocells}/${MACROCELLS}   product terms ${u.productTerms}/${u.productTermCapacity}   I/O pins ${u.pins}/${IO_PINS}   borrowed terms ${u.borrowedTerms}   interconnect multiplexers ${u.blockInputs}/${u.blockInputCapacity}`,
  );
  lines.push('', 'Function blocks', `${'FB'.padEnd(4)}${'MCs'.padEnd(6)}${'Terms'.padEnd(9)}${'Inputs'.padEnd(9)}${'Borrowed'.padEnd(10)}${'Lent'.padEnd(6)}Pins`);
  for (const f of fit.fbs) {
    lines.push(`${String(f.fb).padEnd(4)}${`${f.macrocellsUsed}/8`.padEnd(6)}${`${f.termsUsed}/40`.padEnd(9)}${`${f.inputsUsed}/24`.padEnd(9)}${String(f.borrowed).padEnd(10)}${String(f.lent).padEnd(6)}${f.pinsUsed}/8`);
  }
  lines.push('', `${'Output'.padEnd(10)}${'Pin'.padEnd(5)}${'FB.MC'.padEnd(7)}${'Kind'.padEnd(14)}${'Polarity'.padEnd(12)}${'Terms'.padEnd(20)}${'OE'.padEnd(8)}Equation`);
  for (const o of fit.outputs) {
    const kind = o.registered ? `${o.ff} flip-flop` : 'combinational';
    const terms = `${o.terms}${o.borrowed ? ` (+${o.borrowed} borrowed)` : ''}${o.lent ? ` (-${o.lent} lent)` : ''}`;
    const oe = o.oe ? `[${o.oe}]` : o.oeMode === 'always' ? '-' : o.oeMode;
    lines.push(
      `${o.name.padEnd(10)}${(o.pin === null ? 'buried' : String(o.pin)).padEnd(5)}${`${o.fb}.${o.mc}`.padEnd(7)}${kind.padEnd(14)}${(o.polarity === 'low' ? 'active low' : 'active high').padEnd(12)}${terms.padEnd(20)}${String(oe).padEnd(8)}${o.polarity === 'low' ? '!(' : ''}${o.sum}${o.polarity === 'low' ? ')' : ''}`,
    );
  }
  lines.push('', 'Input pins', ...fit.inputs.map((i) => `  ${i.name.padEnd(10)} IO${i.pin} (block ${i.pin >> 3}), read by block${i.readBy.length === 1 ? '' : 's'} ${i.readBy.join(', ') || 'none'}`));
  const p = fit.partition;
  lines.push('', `Partitioning: block inputs ${p.initialInputs} after the greedy step, ${p.finalInputs} after ${p.passes} Kernighan–Lin pass${p.passes === 1 ? '' : 'es'} (${p.moves} moves kept).`);
  lines.push('', 'Timing', fit.timing.statement);
  const t = fit.timing;
  lines.push(
    `  worst tPD ${t.worstTpd ? `${t.worstTpd.toFixed(1)} ns` : 'n/a'}   worst tSU ${t.worstTsu ? `${t.worstTsu.toFixed(1)} ns` : 'n/a'}   tCO ${t.worstTco ? `${t.worstTco.toFixed(1)} ns` : 'n/a'}   fMAX ${Number.isFinite(t.fmaxMHz) ? `${t.fmaxMHz.toFixed(0)} MHz` : 'n/a'}`,
  );
  for (const w of fit.warnings) lines.push('', `Warning: ${w}`);
  return lines.join('\n');
}
