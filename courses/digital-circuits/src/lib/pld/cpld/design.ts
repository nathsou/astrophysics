/**
 * What the vCPLD-32 fitter takes as input: a structured design, or equations in the same text form
 * as the GAL22V10 front end.
 *
 * ```
 * Y = A & B | !C            combinational output: the level on Y (or on the macrocell, if buried)
 * Q.R = !Q ^ EN             registered: the level after the next rising edge of the global clock
 * Y.E = SEL & !HOLD         product-term output enable (one product term, in the macrocell's slot 4)
 * ```
 *
 * A name that appears on a left-hand side is an output; every other name in the equations is an
 * input pin. An output's name on a right-hand side means the macrocell's feedback: the level of the
 * output itself (for a registered output, the current register value). `//` and `;` start comments,
 * as does `#` at the start of a line. Expression syntax is `parseExpr`'s: `!`, `/`, `~`, `'` not;
 * `&`, `*` and; `|`, `+`, `#` or; `^` xor; parentheses; 0 and 1.
 *
 * Options that the suffixes cannot say (buried outputs, the global output enable, T flip-flops,
 * power-up values, pins) are passed separately: see `designFromEquations`.
 */
import { ExprError, exprVars, parseExpr, type Expr } from '../twolevel/expr';

export type CpldFitErrorCode =
  | 'syntax'
  | 'bad-name'
  | 'duplicate'
  | 'unknown-signal'
  | 'too-many-outputs'
  | 'too-many-signals'
  | 'too-many-terms'
  | 'fb-inputs'
  | 'oe-terms'
  | 'pin'
  | 'partition';

export interface CpldFitErrorInfo {
  output?: string;
  needed?: number;
  capacity?: number;
  block?: number;
  signals?: string[];
  suggestions?: string[];
}

export class CpldFitError extends Error {
  constructor(
    readonly code: CpldFitErrorCode,
    message: string,
    readonly info?: CpldFitErrorInfo,
  ) {
    super(message);
    this.name = 'CpldFitError';
  }
}

export interface CpldInputSpec {
  name: string;
  /** Force an I/O pin (0–31). */
  pin?: number;
}

export interface CpldOutputSpec {
  name: string;
  /** The level the output must have, as an expression over the signal names. */
  expr: string | Expr;
  /** Input combinations where the output does not matter, as an expression. */
  dc?: string | Expr;
  /** A flip-flop on the global clock. */
  registered?: boolean;
  /** Flip-flop type for a registered output: 'auto' (default) picks whichever needs fewer terms. */
  ff?: 'auto' | 'D' | 'T';
  /** Power-up and GSR value of a registered output (default 0). */
  init?: 0 | 1;
  /** Output enable as one product term (a condition over the signals). Default: always enabled. */
  oe?: string | Expr;
  /** Enabled by the global output-enable pin GOE. */
  globalOe?: boolean;
  /** A buried macrocell: it does not drive its pin (the pad stays free to be an input). */
  buried?: boolean;
  /** Force the macrocell whose pin carries the output (0–31); this also fixes the function block. */
  pin?: number;
  /** 'auto' (default) picks the polarity with fewer product terms; the XOR bit inverts on the way out. */
  polarity?: 'auto' | 'high' | 'low';
}

export interface CpldDesign {
  title?: string;
  /** The 32-bit USERCODE: a number, or up to four ASCII characters. */
  usercode?: number | string;
  inputs: (string | CpldInputSpec)[];
  outputs: CpldOutputSpec[];
  /** Names used only in the reports and pin list: the global clock, set/reset and output-enable pins. */
  clock?: string;
  gsr?: string;
  goe?: string;
}

export function asExpr(e: string | Expr, what: string): Expr {
  if (typeof e !== 'string') return e;
  try {
    return parseExpr(e);
  } catch (err) {
    if (err instanceof ExprError) throw new CpldFitError('syntax', `${what}: ${err.message} (at character ${err.offset + 1} of "${e}")`);
    throw err;
  }
}

export interface EquationOptions {
  /** Input names in order; default: the names used but not defined, in order of first use. */
  inputs?: (string | CpldInputSpec)[];
  /** Pins (0–31) by signal name, for inputs and outputs. */
  pins?: Record<string, number>;
  buried?: string[];
  /** Outputs enabled by the global GOE pin. */
  globalOe?: string[];
  ff?: Record<string, 'auto' | 'D' | 'T'>;
  init?: Record<string, 0 | 1>;
  polarity?: Record<string, 'auto' | 'high' | 'low'>;
  title?: string;
  usercode?: number | string;
  clock?: string;
  gsr?: string;
  goe?: string;
}

/** Parse equations in the text form above into a design. */
export function designFromEquations(text: string, opts: EquationOptions = {}): CpldDesign {
  interface Def {
    name: string;
    expr?: string;
    registered: boolean;
    oe?: string;
    line: number;
  }
  const defs = new Map<string, Def>();
  const order: string[] = [];
  text.split(/\r\n|\n|\r/).forEach((raw, k) => {
    const line = raw.replace(/;.*$/, '').replace(/\/\/.*$/, '');
    if (/^\s*#/.test(line) || !line.trim()) return;
    // Several equations on a line are not supported here (';' starts a comment, as in the GAL front end).
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)(?:\.([A-Za-z]+))?\s*=(.*)$/.exec(line);
    if (!m) throw new CpldFitError('syntax', `Line ${k + 1}: expected "name = expression"`);
    const [, name, suffix, rhs] = m as unknown as [string, string, string | undefined, string];
    const sfx = suffix?.toUpperCase();
    if (sfx !== undefined && sfx !== 'R' && sfx !== 'E') throw new CpldFitError('syntax', `Line ${k + 1}: unknown suffix .${suffix} (use .R for a registered output or .E for an output enable)`);
    let d = defs.get(name);
    if (!d) {
      d = { name, registered: false, line: k + 1 };
      defs.set(name, d);
      order.push(name);
    }
    if (sfx === 'E') {
      if (d.oe !== undefined) throw new CpldFitError('duplicate', `Line ${k + 1}: ${name}.E is defined twice`);
      d.oe = rhs.trim();
    } else {
      if (d.expr !== undefined) throw new CpldFitError('duplicate', `Line ${k + 1}: ${name} is defined twice`);
      d.expr = rhs.trim();
      d.registered = sfx === 'R';
    }
  });
  for (const d of defs.values()) if (d.expr === undefined) throw new CpldFitError('syntax', `${d.name}.E is given but ${d.name} has no equation`);
  const outputs: CpldOutputSpec[] = order.map((name) => {
    const d = defs.get(name)!;
    return {
      name,
      expr: d.expr!,
      registered: d.registered,
      oe: d.oe,
      pin: opts.pins?.[name],
      buried: opts.buried?.includes(name),
      globalOe: opts.globalOe?.includes(name),
      ff: opts.ff?.[name],
      init: opts.init?.[name],
      polarity: opts.polarity?.[name],
    };
  });
  let inputs = opts.inputs;
  if (!inputs) {
    const used: string[] = [];
    for (const o of outputs) for (const e of [o.expr, o.oe]) if (typeof e === 'string') exprVars(asExpr(e, `Equation for ${o.name}`), used);
    inputs = used.filter((v) => !defs.has(v));
  }
  const withPins = inputs.map((i) => (typeof i === 'string' ? { name: i, pin: opts.pins?.[i] } : { ...i, pin: i.pin ?? opts.pins?.[i.name] }));
  return { title: opts.title, usercode: opts.usercode, inputs: withPins, outputs, clock: opts.clock, gsr: opts.gsr, goe: opts.goe };
}
