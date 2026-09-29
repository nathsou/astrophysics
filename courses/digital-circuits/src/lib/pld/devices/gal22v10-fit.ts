/**
 * The GAL22V10 fitter: from Boolean equations to a fuse map.
 *
 * Each output is a function of the input pins and of the outputs themselves (feedback, which is
 * how state machines are built). The fitter
 *
 *   1. minimises every output with Quine–McCluskey or Espresso (`minimise`), in both output
 *      polarities, and keeps the one with fewer product terms unless the polarity is fixed;
 *   2. assigns pins: pins given by the design are kept; the other outputs go to macrocells with
 *      enough product terms (8, 10, 12, 14, 16, 16, 14, 12, 10, 8 from pin 14 up to pin 23 … the
 *      big ones are pins 18 and 19), largest demand first; inputs take the dedicated input pins,
 *      then leftover macrocells. Pin 1 is the clock whenever an output is registered;
 *   3. programs the fuses (`programGal22v10`) and can write the JEDEC file or a galette `.pld`.
 *
 * Meaning of the equations: every name stands for the logic level on its pin. A registered output
 * `Q` with expression `f` means "after the next clock edge, the level on Q is f(current levels)".
 * Outputs may be active high or active low internally: the fitter may store the complement in the
 * register and invert on the way out (S0 = 0) if that needs fewer terms, but the level on the pin
 * is always what the equation says.
 */
import {
  CLOCK_PIN,
  FUSE_COUNT,
  GND_PIN,
  INPUT_PINS,
  OLMC_PINS,
  PINS,
  PRODUCT_TERMS,
  VCC_PIN,
  isOlmcPin,
  type PinLevels,
} from './gal22v10';
import { writeGal22v10Jedec, type Gal22v10JedecOptions } from './gal22v10-jedec';
import { GalProgramError, programGal22v10, type GalProgram, type GalSum, type OlmcProgram } from './gal22v10-program';
import {
  ExprError,
  STYLES,
  coverToText,
  exprToCover,
  exprVars,
  parseExpr,
  type Expr,
} from '../twolevel/expr';
import {
  ONE,
  ZERO,
  coverCost,
  getVar,
  type Cover,
  type Cube,
} from '../twolevel/cube';
import { minimise, minimiseComplement, type MinimiseOptions } from '../twolevel/minimise';

export type GalFitErrorCode =
  | 'syntax'
  | 'bad-name'
  | 'duplicate'
  | 'unknown-signal'
  | 'too-many-signals'
  | 'too-many-terms'
  | 'oe-terms'
  | 'pin'
  | 'program';

export class GalFitError extends Error {
  constructor(
    readonly code: GalFitErrorCode,
    message: string,
    /** For 'too-many-terms' and 'oe-terms': what was needed, what there was, and pins that would do. */
    readonly info?: { output?: string; needed?: number; capacity?: number; pin?: number; suggestions?: number[] },
  ) {
    super(message);
    this.name = 'GalFitError';
  }
}

export interface GalInputSpec {
  name: string;
  pin?: number;
}

export interface GalOutputSpec {
  name: string;
  /** The logic level the pin must have, as an expression over the signal names. */
  expr: string | Expr;
  /** Input combinations where the output does not matter, as an expression. */
  dc?: string | Expr;
  /** True for a D flip-flop on the output (clocked by pin 1). */
  registered?: boolean;
  /** Output-enable condition; it must reduce to a single product term. Default: always driven. */
  oe?: string | Expr;
  /** Force a pin (14–23). */
  pin?: number;
  /** 'auto' (default) picks the polarity with fewer product terms; 'high' or 'low' force it. */
  polarity?: 'auto' | 'high' | 'low';
}

export interface GalDesign {
  title?: string;
  /** Up to 8 characters stored in the user signature. */
  signature?: string;
  inputs: (string | GalInputSpec)[];
  outputs: GalOutputSpec[];
  /** Name of the clock; it takes pin 1 (and can be used as an ordinary input signal too). */
  clock?: string;
  /** Asynchronous reset of every register: one product term. */
  ar?: string | Expr;
  /** Synchronous preset of every register: one product term. */
  sp?: string | Expr;
}

export interface GalFitOptions extends MinimiseOptions {
  security?: boolean;
}

export type GalPinRole = 'input' | 'clock' | 'output' | 'gnd' | 'vcc' | 'nc' | 'input-olmc';

export interface GalPinAssignment {
  pin: number;
  role: GalPinRole;
  name: string;
}

export interface GalOutputFit {
  name: string;
  pin: number;
  registered: boolean;
  /** 'high': the sum is the function; 'low': the sum is its complement and the macrocell inverts. */
  polarity: 'high' | 'low';
  terms: number;
  capacity: number;
  /** Terms needed in each polarity (for the report). */
  highTerms: number;
  lowTerms: number;
  cover: Cover;
  /** The sum as galette would write it (`A * /B + C`), of the stored (possibly complemented) function. */
  sum: string;
  /** The enable condition as text, if any. */
  oe?: string;
}

export interface GalFit {
  design: GalDesign;
  fuses: Uint8Array;
  program: GalProgram;
  pins: GalPinAssignment[];
  outputs: GalOutputFit[];
  /** Pin of every signal name (inputs, outputs, the clock). */
  pinOf: Record<string, number>;
  signature: string;
  /** Names of the variables the covers are over (inputs, then outputs). */
  variables: string[];
  ar?: string;
  sp?: string;
  /** Product terms used, out of 130 available in the OLMCs (excluding OE rows). */
  termsUsed: number;
  jedec(opts?: Gal22v10JedecOptions): string;
  /** A galette `.pld` file that assembles to exactly the same fuses. */
  pld(): string;
  /** A readable summary: pinout, terms per output, polarity. */
  report(): string;
}

// ---------------------------------------------------------------------------------------------

function asExpr(e: string | Expr, what: string): Expr {
  if (typeof e !== 'string') return e;
  try {
    return parseExpr(e);
  } catch (err) {
    if (err instanceof ExprError) throw new GalFitError('syntax', `${what}: ${err.message} (at character ${err.offset + 1} of "${e}")`);
    throw err;
  }
}

function normaliseInputs(d: GalDesign): GalInputSpec[] {
  return d.inputs.map((i) => (typeof i === 'string' ? { name: i } : { ...i }));
}

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** A pin's capacity: product terms for an OLMC pin. */
export function capacityOf(pin: number): number {
  return PRODUCT_TERMS[pin] ?? 0;
}

function pinsWithAtLeast(k: number, free?: Set<number>): number[] {
  return (OLMC_PINS as readonly number[])
    .filter((p) => capacityOf(p) >= k && (!free || free.has(p)))
    .sort((a, b) => a - b);
}

function describePins(pins: number[]): string {
  return pins.map((p) => `${p} (${capacityOf(p)} terms)`).join(', ');
}

/** The cubes as a sum over pin numbers. */
function sumOf(cubes: Cube[], pinOfVar: number[], n: number): GalSum {
  return cubes.map((c) => {
    const prod = [];
    for (let i = 0; i < n; i++) {
      const v = getVar(c, i);
      if (v === ONE) prod.push({ pin: pinOfVar[i]!, neg: false });
      else if (v === ZERO) prod.push({ pin: pinOfVar[i]!, neg: true });
    }
    return prod;
  });
}

export function fitGal22v10(design: GalDesign, opts: GalFitOptions = {}): GalFit {
  const inputs = normaliseInputs(design);
  const outputs = design.outputs;

  // -- Names ------------------------------------------------------------------------------
  const seen = new Set<string>();
  const declare = (name: string, what: string) => {
    if (!NAME.test(name)) throw new GalFitError('bad-name', `${what} "${name}" is not a valid signal name (letters, digits and underscores, starting with a letter or underscore)`);
    if (seen.has(name)) throw new GalFitError('duplicate', `The name ${name} is used twice (${what})`);
    seen.add(name);
  };
  for (const i of inputs) declare(i.name, 'input');
  for (const o of outputs) declare(o.name, 'output');

  const anyRegistered = outputs.some((o) => o.registered);
  // The clock: pin 1.
  let clockName = design.clock;
  const pin1Input = inputs.find((i) => i.pin === CLOCK_PIN);
  if (anyRegistered) {
    if (clockName && pin1Input && pin1Input.name !== clockName) throw new GalFitError('pin', `Pin 1 is the clock ${clockName}; ${pin1Input.name} cannot be placed there`);
    clockName = clockName ?? pin1Input?.name;
  }
  if (clockName !== undefined) {
    const declared = inputs.find((i) => i.name === clockName);
    if (declared) {
      if (declared.pin !== undefined && declared.pin !== CLOCK_PIN) throw new GalFitError('pin', `The clock ${clockName} must be on pin 1, not pin ${declared.pin}`);
      declared.pin = CLOCK_PIN;
    } else if (!seen.has(clockName)) {
      declare(clockName, 'clock');
      inputs.unshift({ name: clockName, pin: CLOCK_PIN });
    } else throw new GalFitError('duplicate', `The clock name ${clockName} is also used by an output`);
  } else if (anyRegistered) {
    let name = 'CLK';
    for (let k = 1; seen.has(name); k++) name = `CLK${k}`;
    declare(name, 'clock');
    clockName = name;
    inputs.unshift({ name, pin: CLOCK_PIN });
  }

  // -- Variables and covers -----------------------------------------------------------------
  const variables = [...inputs.map((i) => i.name), ...outputs.map((o) => o.name)];
  const n = variables.length;
  if (n > 22) throw new GalFitError('too-many-signals', `${n} signals (${inputs.length} inputs and ${outputs.length} outputs), but the GAL22V10 has 22 signal pins`);
  const cover = (e: string | Expr, what: string): Cover => {
    const x = asExpr(e, what);
    for (const v of exprVars(x)) if (!variables.includes(v)) throw new GalFitError('unknown-signal', `${what}: unknown signal "${v}". Declared: ${variables.join(', ')}`);
    return exprToCover(x, variables);
  };

  interface Work {
    spec: GalOutputSpec;
    high: Cube[];
    low: Cube[];
    polarity: 'high' | 'low';
    oe?: Cube[];
    pin: number;
    need: number;
  }
  const work: Work[] = outputs.map((spec) => {
    const on = cover(spec.expr, `Equation for ${spec.name}`);
    const dc = spec.dc !== undefined ? cover(spec.dc, `Don't-care set of ${spec.name}`) : undefined;
    const high = minimise(on, dc, opts).cubes;
    const low = minimiseComplement(on, dc, opts).cubes;
    const pol = spec.polarity ?? 'auto';
    const cost = (c: Cube[]) => coverCost({ n, cubes: c });
    const lowCheaper = (() => {
      const a = cost(low);
      const b = cost(high);
      return a.cubes < b.cubes || (a.cubes === b.cubes && a.literals < b.literals);
    })();
    const polarity: 'high' | 'low' = pol === 'auto' ? (lowCheaper ? 'low' : 'high') : pol;
    let oe: Cube[] | undefined;
    if (spec.oe !== undefined) {
      const cubes = minimise(cover(spec.oe, `Output enable of ${spec.name}`)).cubes;
      if (cubes.length > 1)
        throw new GalFitError(
          'oe-terms',
          `The output enable of ${spec.name} needs ${cubes.length} product terms, but each macrocell has a single enable term. Simplify the condition to one AND of signals.`,
          { output: spec.name, needed: cubes.length, capacity: 1 },
        );
      oe = cubes;
    }
    return { spec, high, low, polarity, oe, pin: spec.pin ?? 0, need: (polarity === 'high' ? high : low).length };
  });
  const special = (e: string | Expr | undefined, name: string): Cube[] | undefined => {
    if (e === undefined) return undefined;
    const cubes = minimise(cover(e, `${name} equation`)).cubes;
    if (cubes.length > 1) throw new GalFitError('oe-terms', `${name} needs ${cubes.length} product terms, but it is a single product term`, { output: name, needed: cubes.length, capacity: 1 });
    return cubes;
  };
  const arCubes = special(design.ar, 'AR');
  const spCubes = special(design.sp, 'SP');

  // -- Pin assignment -----------------------------------------------------------------------
  const pinOf: Record<string, number> = {};
  const owner = new Map<number, string>();
  const take = (name: string, pin: number, kind: 'input' | 'output') => {
    if (!Number.isInteger(pin) || pin < 1 || pin > PINS) throw new GalFitError('pin', `${name}: there is no pin ${pin}`);
    if (pin === GND_PIN || pin === VCC_PIN) throw new GalFitError('pin', `${name}: pin ${pin} is ${pin === GND_PIN ? 'GND' : 'VCC'}`);
    if (kind === 'output' && !isOlmcPin(pin)) throw new GalFitError('pin', `${name}: pin ${pin} has no output macrocell; outputs go on pins 14–23`);
    if (kind === 'input' && !(INPUT_PINS as readonly number[]).includes(pin) && !isOlmcPin(pin)) throw new GalFitError('pin', `${name}: pin ${pin} cannot be an input`);
    const other = owner.get(pin);
    if (other) throw new GalFitError('pin', `${name} and ${other} are both on pin ${pin}`);
    owner.set(pin, name);
    pinOf[name] = pin;
  };
  for (const i of inputs) if (i.pin !== undefined) take(i.name, i.pin, 'input');
  for (const w of work) if (w.spec.pin !== undefined) take(w.spec.name, w.spec.pin, 'output');

  const free = new Set<number>((OLMC_PINS as readonly number[]).filter((p) => !owner.has(p)));
  // Fixed outputs must fit.
  for (const w of work) {
    if (w.spec.pin === undefined) continue;
    if (w.need > capacityOf(w.spec.pin)) throw overflow(w, free, w.spec.pin);
  }
  // The rest: largest demand first, each to the lowest free pin with enough terms.
  const order = work
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.spec.pin === undefined)
    .sort((a, b) => b.w.need - a.w.need || a.i - b.i);
  for (const { w } of order) {
    const pin = pinsWithAtLeast(Math.max(w.need, 0), free)[0];
    if (pin === undefined) throw overflow(w, free, undefined);
    free.delete(pin);
    take(w.spec.name, pin, 'output');
  }
  for (const w of work) w.pin = pinOf[w.spec.name]!;

  // Inputs: dedicated pins first (pin 1 is left to the clock when there is one), then macrocells.
  const dedicated = (INPUT_PINS as readonly number[]).filter((p) => !owner.has(p) && !(p === CLOCK_PIN && anyRegistered));
  const loose = inputs.filter((i) => i.pin === undefined);
  for (const i of loose) {
    let pin = dedicated.shift();
    if (pin === undefined) {
      // Least valuable macrocell first: fewest terms, highest pin.
      pin = [...free].sort((a, b) => capacityOf(a) - capacityOf(b) || b - a)[0];
      if (pin !== undefined) free.delete(pin);
    }
    if (pin === undefined)
      throw new GalFitError(
        'too-many-signals',
        `No pin left for input ${i.name}: the GAL22V10 has 12 input pins (11 if pin 1 is the clock) and 10 macrocells, and all are in use.`,
      );
    take(i.name, pin, 'input');
  }

  // -- Program -------------------------------------------------------------------------------
  const pinOfVar = variables.map((v) => pinOf[v]!);
  const programOutputs: OlmcProgram[] = work.map((w) => ({
    pin: w.pin,
    sum: sumOf(w.polarity === 'high' ? w.high : w.low, pinOfVar, n),
    registered: !!w.spec.registered,
    activeHigh: w.polarity === 'high',
    oe: w.oe ? sumOf(w.oe, pinOfVar, n) : undefined,
  }));
  const inputPins = inputs.filter((i) => isOlmcPin(pinOf[i.name]!)).map((i) => pinOf[i.name]!);
  const signature = (design.signature ?? design.title ?? '').replace(/[^\x20-\x7e]/g, '').slice(0, 8);
  const program: GalProgram = {
    outputs: programOutputs,
    ar: arCubes ? sumOf(arCubes, pinOfVar, n) : undefined,
    sp: spCubes ? sumOf(spCubes, pinOfVar, n) : undefined,
    signature,
    inputPins,
  };
  let fuses: Uint8Array;
  try {
    fuses = programGal22v10(program);
  } catch (e) {
    if (e instanceof GalProgramError) throw new GalFitError('program', e.message);
    throw e;
  }
  if (fuses.length !== FUSE_COUNT) throw new Error('internal error: wrong fuse count');

  const asText = (cubes: Cube[]) => coverToText({ n, cubes }, variables, STYLES.galette);
  const outFits: GalOutputFit[] = work.map((w) => ({
    name: w.spec.name,
    pin: w.pin,
    registered: !!w.spec.registered,
    polarity: w.polarity,
    terms: (w.polarity === 'high' ? w.high : w.low).length,
    capacity: capacityOf(w.pin),
    highTerms: w.high.length,
    lowTerms: w.low.length,
    cover: { n, cubes: w.polarity === 'high' ? w.high : w.low },
    sum: asText(w.polarity === 'high' ? w.high : w.low),
    oe: w.oe ? asText(w.oe) : undefined,
  }));

  const pins: GalPinAssignment[] = [];
  const outPins = new Set(work.map((w) => w.pin));
  for (let p = 1; p <= PINS; p++) {
    const name = owner.get(p);
    if (p === GND_PIN) pins.push({ pin: p, role: 'gnd', name: 'GND' });
    else if (p === VCC_PIN) pins.push({ pin: p, role: 'vcc', name: 'VCC' });
    else if (!name) pins.push({ pin: p, role: 'nc', name: 'NC' });
    else if (outPins.has(p)) pins.push({ pin: p, role: 'output', name });
    else if (p === CLOCK_PIN && name === clockName) pins.push({ pin: p, role: 'clock', name });
    else pins.push({ pin: p, role: isOlmcPin(p) ? 'input-olmc' : 'input', name });
  }

  const fit: GalFit = {
    design,
    fuses,
    program,
    pins,
    outputs: outFits,
    pinOf,
    signature,
    variables,
    ar: arCubes ? asText(arCubes) : undefined,
    sp: spCubes ? asText(spCubes) : undefined,
    termsUsed: outFits.reduce((s, o) => s + o.terms, 0),
    jedec: (jopts) => writeGal22v10Jedec(fuses, { style: 'standard', header: [`Device: GAL22V10 (ATF22V10)`, ...(design.title ? [`Design: ${design.title}`] : [])], security: opts.security, ...jopts }),
    pld: () => pldText(fit),
    report: () => reportText(fit),
  };
  return fit;
}

function overflow(w: { spec: GalOutputSpec; high: Cube[]; low: Cube[]; need: number }, free: Set<number>, pin: number | undefined): GalFitError {
  const name = w.spec.name;
  const both = `${w.high.length} active high, ${w.low.length} active low`;
  const forced = w.spec.polarity && w.spec.polarity !== 'auto';
  const candidates = pinsWithAtLeast(w.need);
  const freeOnes = pinsWithAtLeast(w.need, free);
  let msg: string;
  if (pin !== undefined) {
    msg = `Output ${name} needs ${w.need} product terms (${both}), but pin ${pin} has only ${capacityOf(pin)}.`;
    if (freeOnes.length) msg += ` Pins with enough terms that are still free: ${describePins(freeOnes)}.`;
    else if (candidates.length) msg += ` Pins with at least ${w.need} terms: ${describePins(candidates)}, but they are taken.`;
  } else if (candidates.length === 0) {
    msg = `Output ${name} needs ${w.need} product terms (${both}), more than any macrocell has (the largest, pins 18 and 19, have 16).`;
  } else {
    msg = `Output ${name} needs ${w.need} product terms (${both}), but the macrocells that large (${describePins(candidates)}) are all taken by other outputs.`;
  }
  if (candidates.length === 0)
    msg += ' Split the function: compute part of it in another output (or a spare pin used as an input) and use that signal here, or reduce it by choosing a different state encoding.';
  else if (forced) msg += ' The polarity was fixed; letting the fitter choose it may need fewer terms.';
  return new GalFitError('too-many-terms', msg, { output: name, needed: w.need, capacity: pin !== undefined ? capacityOf(pin) : 16, pin, suggestions: freeOnes.length ? freeOnes : candidates });
}

// ---------------------------------------------------------------------------------------------
// Text outputs

const SIGNATURE_OK = /^[\x20-\x7e]*$/;

function pldText(fit: GalFit): string {
  const bad = fit.pins.find((p) => p.role !== 'nc' && p.role !== 'gnd' && p.role !== 'vcc' && !/^[A-Za-z][A-Za-z0-9]*$/.test(p.name));
  if (bad) throw new GalFitError('bad-name', `The name ${bad.name} (pin ${bad.pin}) cannot appear in a galette .pld file: names start with a letter and contain letters and digits only`);
  if (!SIGNATURE_OK.test(fit.signature)) throw new GalFitError('bad-name', 'The signature must be printable ASCII');
  const row = (from: number) => fit.pins.slice(from, from + 12).map((p) => p.name.padEnd(6)).join(' ').trimEnd();
  const lines = ['GAL22V10', fit.signature || 'NoName', ''];
  if (fit.design.title) lines.push(`; ${fit.design.title.replace(/[^\x20-\x7e]+/g, ' ')}`, '');
  lines.push(row(0), row(12), '');
  const eq = (lhs: string, rhs: string) => {
    const parts = rhs.split(' + ');
    lines.push(`${lhs} = ${parts[0]}`);
    for (const p of parts.slice(1)) lines.push(`${' '.repeat(Math.max(2, lhs.length - 1))}+ ${p}`);
  };
  for (const o of [...fit.outputs].sort((a, b) => a.pin - b.pin)) {
    const lhs = `${o.polarity === 'low' ? '/' : ''}${o.name}${o.registered ? '.R' : o.oe ? '.T' : ''}`;
    eq(lhs, o.sum);
    if (o.oe) eq(`${o.name}.E`, o.oe);
  }
  if (fit.ar) eq('AR', fit.ar);
  if (fit.sp) eq('SP', fit.sp);
  lines.push('', 'DESCRIPTION', '', (fit.design.title ?? 'Fitted by the vGAL22V10 fitter.').replace(/[^\x20-\x7e]+/g, ' '), '');
  return lines.join('\n');
}

function reportText(fit: GalFit): string {
  const lines: string[] = [];
  lines.push(`GAL22V10  signature "${fit.signature}"  ${fit.termsUsed} product terms used`);
  lines.push('', 'Pin  Role     Name');
  for (const p of fit.pins) lines.push(`${String(p.pin).padStart(3)}  ${p.role.padEnd(8)} ${p.name}`);
  lines.push('', 'Output  Pin  Kind        Polarity  Terms  Sum');
  for (const o of [...fit.outputs].sort((a, b) => b.pin - a.pin)) {
    lines.push(
      `${o.name.padEnd(7)} ${String(o.pin).padStart(3)}  ${(o.registered ? 'registered' : 'combinational').padEnd(11)} ${(o.polarity === 'low' ? 'low' : 'high').padEnd(8)}  ${String(o.terms).padStart(2)}/${String(o.capacity).padEnd(2)}  ${o.polarity === 'low' ? '/' : ''}${o.name} = ${o.sum}` +
        (o.polarity === 'low' || o.highTerms !== o.terms ? `   (active high would need ${o.highTerms}, active low ${o.lowTerms})` : ''),
    );
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Equation text and simulation helpers

/**
 * Parse equations in the fitter's text form, one per line:
 *
 * ```
 * Y = A & B | !C         combinational (the level on pin Y)
 * Q.R = !Q ^ EN          registered: the level after the next clock edge
 * Y.T = ...  Y.E = OE    tri-state output with its enable
 * AR = RESET   SP = SET
 * ```
 * Expression operators: `!`, `/`, `~`, `'` not; `&`, `*` and; `+`, `|`, `#` or; `^` xor; parentheses.
 * Comments start with `;` or `//` (or `#` at the start of a line).
 */
export function designFromEquations(
  text: string,
  opts: {
    inputs?: (string | GalInputSpec)[];
    pins?: Record<string, number>;
    clock?: string;
    signature?: string;
    title?: string;
    polarity?: Record<string, 'auto' | 'high' | 'low'>;
  } = {},
): GalDesign {
  interface Def {
    name: string;
    expr?: string;
    registered: boolean;
    oe?: string;
    line: number;
  }
  const defs = new Map<string, Def>();
  let ar: string | undefined;
  let sp: string | undefined;
  const order: string[] = [];
  text.split(/\r\n|\n|\r/).forEach((raw, k) => {
    const line = raw.replace(/;.*$/, '').replace(/\/\/.*$/, '');
    if (/^\s*#/.test(line) || !line.trim()) return;
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)(?:\.([A-Za-z]+))?\s*=(.*)$/.exec(line);
    if (!m) throw new GalFitError('syntax', `Line ${k + 1}: expected "name = expression"`);
    const [, name, suffix, rhs] = m as unknown as [string, string, string | undefined, string];
    const sfx = suffix?.toUpperCase();
    if (name === 'AR' || name === 'SP') {
      if (sfx) throw new GalFitError('syntax', `Line ${k + 1}: ${name} takes no suffix`);
      if (name === 'AR') ar = rhs.trim();
      else sp = rhs.trim();
      return;
    }
    if (sfx !== undefined && !['R', 'T', 'E'].includes(sfx)) throw new GalFitError('syntax', `Line ${k + 1}: unknown suffix .${suffix} (use .R, .T or .E)`);
    let d = defs.get(name);
    if (!d) {
      d = { name, registered: false, line: k + 1 };
      defs.set(name, d);
      order.push(name);
    }
    if (sfx === 'E') {
      if (d.oe !== undefined) throw new GalFitError('duplicate', `Line ${k + 1}: ${name}.E is defined twice`);
      d.oe = rhs.trim();
    } else {
      if (d.expr !== undefined) throw new GalFitError('duplicate', `Line ${k + 1}: ${name} is defined twice`);
      d.expr = rhs.trim();
      d.registered = sfx === 'R';
    }
  });
  for (const d of defs.values()) if (d.expr === undefined) throw new GalFitError('syntax', `${d.name}.E is given but ${d.name} has no equation`);
  const outputs: GalOutputSpec[] = order.map((name) => {
    const d = defs.get(name)!;
    return {
      name,
      expr: d.expr!,
      registered: d.registered,
      oe: d.oe,
      pin: opts.pins?.[name],
      polarity: opts.polarity?.[name],
    };
  });
  let inputs = opts.inputs;
  if (!inputs) {
    const used: string[] = [];
    const all = [...outputs.flatMap((o) => [o.expr, o.oe].filter((x): x is string => typeof x === 'string')), ar, sp].filter((x): x is string => x !== undefined);
    for (const e of all) exprVars(parseExpr(e), used);
    inputs = used.filter((v) => !defs.has(v));
  }
  const withPins = inputs.map((i) => (typeof i === 'string' ? { name: i, pin: opts.pins?.[i] } : { ...i, pin: i.pin ?? opts.pins?.[i.name] }));
  return { title: opts.title, signature: opts.signature, inputs: withPins, outputs, clock: opts.clock, ar, sp };
}

export function fitGal22v10Equations(text: string, opts: Parameters<typeof designFromEquations>[1] & GalFitOptions = {}): GalFit {
  return fitGal22v10(designFromEquations(text, opts), opts);
}

/** Pin levels for the simulator from named input levels. Missing inputs read 0. */
export function pinLevelsFor(fit: GalFit, values: Record<string, number>): PinLevels {
  const levels: PinLevels = {};
  for (const [name, v] of Object.entries(values)) {
    const pin = fit.pinOf[name];
    if (pin === undefined) throw new GalFitError('unknown-signal', `No signal named ${name}`);
    levels[pin] = v ? 1 : 0;
  }
  return levels;
}

/** Levels of the named signals in a simulator snapshot (any signal with a pin). */
export function readSignals(fit: GalFit, pins: ArrayLike<number>): Record<string, 0 | 1> {
  const out: Record<string, 0 | 1> = {};
  for (const [name, pin] of Object.entries(fit.pinOf)) out[name] = pins[pin] ? 1 : 0;
  return out;
}
