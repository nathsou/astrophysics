/**
 * The `.pld` front end: GALasm and galette source files for the GAL22V10.
 *
 * ```
 * GAL22V10                     device (first line)
 * TrafficL                     signature, up to 8 characters (second line)
 *
 * Clock  A    B    NC   ...    pins 1–12 on one line, 13–24 on the next; a leading / declares
 * /OE    Q1   Q2   NC   ...    the pin active low; NC = not connected; pin 12 = GND, pin 24 = VCC
 *
 * Q1.R = A * /Q2               equations: /  not,  *  and,  +  or   (# and & also accepted)
 * /Q2.R = B + Q1               a leading / on the left makes the output active low
 * Y.T = A * B                  .R registered, .T tri-state, plain = combinational
 * Y.E = /OE                    .E output enable (needs .T or .R on the same pin)
 * AR = Reset                   asynchronous reset of all registers (one product term)
 * SP = Preset                  synchronous preset of all registers (one product term)
 *
 * DESCRIPTION                  optional; ends the file
 * ```
 *
 * Comments start with `;`. An equation may continue on the next line if either line ends, or the
 * next begins, with `*`, `+`, `#` or `&`. Right-hand sides are flat sums of products of pins (no
 * parentheses); `VCC` and `GND` alone on the right are the constants 1 and 0. Names start with a
 * letter and continue with letters and digits, as in galette.
 *
 * `assemblePld` assembles literally, like galette: the products are entered in the order written,
 * with no minimisation, and the JEDEC file it can write is byte for byte the file galette
 * produces. The error messages are galette's. Only the GAL22V10 is supported.
 */
import { FUSE_COUNT, GND_PIN, PINS, VCC_PIN, isOlmcPin } from './gal22v10';
import { writeGal22v10Jedec, type Gal22v10JedecOptions } from './gal22v10-jedec';
import {
  GAL_FALSE,
  GAL_TRUE,
  GalProgramError,
  programGal22v10,
  type GalLit,
  type GalProgram,
  type GalSum,
  type OlmcProgram,
} from './gal22v10-program';

export class PldError extends Error {
  constructor(
    /** The message without the line prefix. */
    readonly detail: string,
    readonly line: number,
  ) {
    super(`Error in line ${line}: ${detail}`);
    this.name = 'PldError';
  }
}

export type PldSuffix = 'none' | 'T' | 'R' | 'E' | 'CLK' | 'APRST' | 'ARST';

/** A literal on the right-hand side, resolved to a pin. */
export interface PldPin {
  pin: number;
  neg: boolean;
}

export interface PldEquation {
  line: number;
  /** 'AR' and 'SP' for the special terms, otherwise the output pin. */
  lhs: { kind: 'AR' } | { kind: 'SP' } | { kind: 'pin'; pin: number; neg: boolean; suffix: PldSuffix };
  rhs: PldPin[];
  /** `isOr[i]` is true when `rhs[i]` starts a new product (it follows a `+`). */
  isOr: boolean[];
}

export interface PldSource {
  device: string;
  /** Up to eight characters. */
  signature: string;
  /** The 24 pin names as declared, with a leading '/' for active-low pins. */
  pins: string[];
  equations: PldEquation[];
}

type Tok =
  | { t: 'item'; name: string; neg: boolean; suffix: PldSuffix; line: number }
  | { t: 'eq' | 'and' | 'or'; line: number };

const SUFFIXES: Record<string, PldSuffix> = { T: 'T', R: 'R', E: 'E', CLK: 'CLK', APRST: 'APRST', ARST: 'ARST' };

function isAlpha(c: string | undefined): boolean {
  return c !== undefined && /^[A-Za-z]$/.test(c);
}

function isAlnum(c: string | undefined): boolean {
  return c !== undefined && /^[A-Za-z0-9]$/.test(c);
}

function tokenise(line: number, s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === '=') {
      out.push({ t: 'eq', line });
      i++;
    } else if (c === '+' || c === '#') {
      out.push({ t: 'or', line });
      i++;
    } else if (c === '*' || c === '&') {
      out.push({ t: 'and', line });
      i++;
    } else if (c === '/' || isAlpha(c)) {
      let neg = false;
      if (c === '/') {
        neg = true;
        i++;
      }
      const first = s[i];
      if (first === undefined) throw new PldError('pin name expected after \'/\', found end-of-line', line);
      if (!isAlpha(first)) throw new PldError(`pin name expected after '/', found non-alphabetic character '${first}'`, line);
      let name = '';
      while (isAlnum(s[i])) name += s[i++];
      let suffix: PldSuffix = 'none';
      if (s[i] === '.') {
        i++;
        let ext = '';
        while (isAlnum(s[i])) ext += s[i++];
        const sfx = SUFFIXES[ext];
        if (!sfx) throw new PldError(`unknown suffix found: '${ext}'`, line);
        suffix = sfx;
      }
      out.push({ t: 'item', name, neg, suffix, line });
    } else if (/\s/.test(c)) {
      i++;
    } else throw new PldError(`unexpected character in input: '${c}'`, line);
  }
  return out;
}

const isJoin = (t: Tok | undefined) => t !== undefined && (t.t === 'and' || t.t === 'or');

/** Parse a `.pld` file (the part galette does before it looks at the equations' meaning). */
export function parsePld(text: string): PldSource {
  const raw = text.split(/\r\n|\n|\r/);
  // galette uses str::lines(): a trailing newline does not add a line.
  if (raw.length > 0 && raw[raw.length - 1] === '') raw.pop();
  const lineCount = raw.length;
  const fail = (detail: string, line: number): never => {
    throw new PldError(detail, line === 0 ? lineCount : line);
  };
  const cleaned = raw.map((l, i) => ({ n: i + 1, s: l.replace(/;.*$/, '').trim() }));
  let p = 0;
  const next = (): { n: number; s: string } | undefined => cleaned[p++];

  const first = next();
  if (!first) return fail("unexpected GAL type found: '<eof>'", 0);
  const device = first.s;
  if (device !== 'GAL22V10') {
    if (['GAL16V8', 'GAL20V8', 'GAL20RA10'].includes(device)) fail(`only the GAL22V10 is supported here (found '${device}')`, first.n);
    fail(`unexpected GAL type found: '${device}'`, first.n);
  }
  const sigLine = next();
  if (!sigLine) return fail('expected signature, found end of file', 0);
  const signature = [...new TextEncoder().encode(sigLine.s)].slice(0, 8).map((b) => String.fromCharCode(b)).join('');

  // Remaining non-blank lines up to DESCRIPTION.
  const rest: { n: number; s: string }[] = [];
  for (; p < cleaned.length; p++) {
    const l = cleaned[p]!;
    if (l.s === '') continue;
    if (l.s === 'DESCRIPTION') break;
    rest.push(l);
  }
  let q = 0;

  const pinMap = new Map<string, PldPin>();
  const pins: string[] = [];
  const readPins = (row: number) => {
    const l = rest[q++];
    if (!l) return fail('expected pin definitions, found end of file', 0);
    const toks = tokenise(l.n, l.s);
    const names: { name: string; neg: boolean }[] = [];
    for (const t of toks) {
      if (t.t !== 'item') return fail('expected pin, found other token', t.line);
      if (t.suffix !== 'none') return fail('expected plain pin name, found pin with suffix', t.line);
      names.push({ name: t.name, neg: t.neg });
    }
    if (names.length !== PINS / 2) fail(`wrong number of pins on pin definition line - expected ${PINS / 2}, found ${names.length}`, l.n);
    const firstPin = 1 + row * (PINS / 2);
    names.forEach(({ name, neg }, k) => {
      const pin = firstPin + k;
      if (pin === PINS && (name !== 'VCC' || neg)) fail(`pin ${pin} must be named VCC`, l.n);
      if (pin === PINS / 2 && (name !== 'GND' || neg)) fail(`pin ${pin} must be named GND`, l.n);
      if (name === 'VCC' && pin !== PINS) fail(`pin ${pin} cannot be named VCC, because the name is reserved for pin ${PINS}`, l.n);
      if (name === 'GND' && pin !== PINS / 2) fail(`pin ${pin} cannot be named GND, because the name is reserved for pin ${PINS / 2}`, l.n);
      if (name !== 'NC') {
        if (pinMap.has(name)) fail(`pinname ${name} is defined twice`, l.n);
        if (name === 'AR' || name === 'SP') fail(`GAL22V10: ${name} is not allowed as pinname`, l.n);
        pinMap.set(name, { pin, neg });
      }
      pins.push((neg ? '/' : '') + name);
    });
  };
  readPins(0);
  readPins(1);

  // Equations: tokenise, joining continuation lines.
  const tokLines = rest.slice(q).map((l) => tokenise(l.n, l.s));
  const joined: Tok[][] = [];
  for (let k = 0; k < tokLines.length; k++) {
    let cur = tokLines[k]!;
    while (isJoin(cur[cur.length - 1]) || isJoin(tokLines[k + 1]?.[0])) {
      if (k + 1 >= tokLines.length) break;
      k++;
      cur = cur.concat(tokLines[k]!);
    }
    joined.push(cur);
  }

  const lookup = (name: string, neg: boolean, line: number): PldPin => {
    const found = pinMap.get(name);
    if (!found) {
      if (name === 'NC') fail('NC (Not Connected) is not allowed in logic equations', line);
      if (name === 'AR' || name === 'SP') fail(`use of ${name} is not allowed in equations`, line);
      fail(`unknown pinname '${name}'`, line);
    }
    return { pin: found!.pin, neg: found!.neg !== neg };
  };

  const equations: PldEquation[] = [];
  for (const toks of joined) {
    let k = 0;
    const lhsTok = toks[k++];
    if (!lhsTok || lhsTok.t !== 'item') return fail('expected pin, found other token', 0);
    let lhs: PldEquation['lhs'];
    if (lhsTok.name === 'AR' || lhsTok.name === 'SP') {
      if (lhsTok.suffix !== 'none') fail(`no suffix is allowed for ${lhsTok.name}`, lhsTok.line);
      if (lhsTok.neg) fail(`negation of ${lhsTok.name} is not allowed`, lhsTok.line);
      lhs = { kind: lhsTok.name };
    } else {
      const pin = lookup(lhsTok.name, lhsTok.neg, lhsTok.line);
      lhs = { kind: 'pin', pin: pin.pin, neg: pin.neg, suffix: lhsTok.suffix };
    }
    const eq = toks[k++];
    if (!eq) return fail('expected right-hand side of equation, found end of file', 0);
    if (eq.t !== 'eq') fail("'=' expected", eq.line);
    const readPin = (): PldPin => {
      const t = toks[k++];
      if (!t) return fail('expected pin name, found end of line', 0);
      if (t.t !== 'item') return fail('expected pin, found other token', t.line);
      if (t.suffix !== 'none') return fail('expected plain pin name, found pin with suffix', t.line);
      return lookup(t.name, t.neg, t.line);
    };
    const rhs: PldPin[] = [readPin()];
    const isOr: boolean[] = [false];
    for (;;) {
      const t = toks[k++];
      if (!t) break;
      if (t.t === 'and') isOr.push(false);
      else if (t.t === 'or') isOr.push(true);
      else return fail('expected +, #, * or &, found other token', t.line);
      rhs.push(readPin());
    }
    equations.push({ line: eq.line, lhs, rhs, isOr });
  }
  return { device, signature, pins, equations };
}

// ---------------------------------------------------------------------------------------------
// From equations to a fuse program (galette's blueprint and gal_builder)

interface OlmcState {
  active: 'low' | 'high';
  output?: { mode: 'combinational' | 'tristate' | 'registered'; sum: GalSum; line: number };
  oe?: { sum: GalSum; line: number };
  clock?: { line: number };
  arst?: { line: number };
  aprst?: { line: number };
}

function termOf(eq: PldEquation): GalSum {
  if (eq.rhs.length === 1) {
    const p = eq.rhs[0]!;
    if (p.pin === VCC_PIN) {
      if (p.neg) throw new PldError('VCC cannot be negated, use GND instead of /VCC', eq.line);
      return GAL_TRUE;
    }
    if (p.pin === GND_PIN) {
      if (p.neg) throw new PldError('GND cannot be negated, use VCC instead of /GND', eq.line);
      return GAL_FALSE;
    }
  }
  const sum: GalSum = [];
  let cur: GalLit[] = [];
  eq.rhs.forEach((p, i) => {
    if (eq.isOr[i]) {
      sum.push(cur);
      cur = [];
    }
    cur.push({ pin: p.pin, neg: p.neg });
  });
  sum.push(cur);
  return sum;
}

export interface PldOlmcInfo {
  pin: number;
  /** Declared name (without '/'). */
  name: string;
  role: 'output' | 'input' | 'unused';
  registered: boolean;
  activeHigh: boolean;
  terms: number;
  tristate: boolean;
  hasEnable: boolean;
}

export interface PldAssembly {
  source: PldSource;
  fuses: Uint8Array;
  program: GalProgram;
  /** One entry per macrocell, pin 23 first. */
  olmcs: PldOlmcInfo[];
  /** Write the JEDEC file ('galette' style by default, matching galette byte for byte). */
  jedec(opts?: Gal22v10JedecOptions): string;
}

function galProgramErrorToPld(e: unknown): never {
  if (e instanceof GalProgramError) throw new PldError(e.message, e.line ?? 0);
  throw e;
}

/** Assemble a `.pld` source (text or parsed) literally, as galette does. */
export function assemblePld(input: string | PldSource, opts: { security?: boolean } = {}): PldAssembly {
  const source = typeof input === 'string' ? parsePld(input) : input;
  const olmcs = new Map<number, OlmcState>();
  for (let pin = 14; pin <= 23; pin++) olmcs.set(pin, { active: 'low' });
  let ar: { sum: GalSum; line: number } | undefined;
  let sp: { sum: GalSum; line: number } | undefined;

  // Blueprint: steer every equation to its macrocell.
  for (const eq of source.equations) {
    const sum = termOf(eq);
    if (eq.lhs.kind === 'AR') {
      if (ar) throw new PldError('AR is defined twice', eq.line);
      ar = { sum, line: eq.line };
    } else if (eq.lhs.kind === 'SP') {
      if (sp) throw new PldError('SP is defined twice', eq.line);
      sp = { sum, line: eq.line };
    } else {
      const { pin, neg, suffix } = eq.lhs;
      if (!isOlmcPin(pin)) throw new PldError("this pin can't be used as output", eq.line);
      const o = olmcs.get(pin)!;
      const name = source.pins[pin - 1]!;
      const control = (kind: 'E' | 'CLK' | 'ARST' | 'APRST', slot: 'oe' | 'clock' | 'arst' | 'aprst') => {
        if (neg) throw new PldError(`negation of .${kind} is not allowed`, eq.line);
        if (o[slot]) throw new PldError(`multiple .${kind} definitions for the same output`, eq.line);
        if (slot === 'oe') o.oe = { sum, line: eq.line };
        else o[slot] = { line: eq.line };
      };
      const base = (mode: 'combinational' | 'tristate' | 'registered') => {
        if (o.output) throw new PldError(`output ${name} is defined multiple times`, eq.line);
        o.output = { mode, sum, line: eq.line };
        o.active = neg ? 'low' : 'high';
      };
      if (suffix === 'R') base('registered');
      else if (suffix === 'none') base('combinational');
      else if (suffix === 'T') base('tristate');
      else if (suffix === 'E') control('E', 'oe');
      else if (suffix === 'CLK') control('CLK', 'clock');
      else if (suffix === 'ARST') control('ARST', 'arst');
      else control('APRST', 'aprst');
    }
  }

  // Builder: the checks galette makes for the 22V10, in its order (pin 14 first).
  for (let pin = 14; pin <= 23; pin++) {
    const o = olmcs.get(pin)!;
    for (const [slot, kind] of [['clock', 'CLK'], ['arst', 'ARST'], ['aprst', 'APRST']] as const)
      if (o[slot]) throw new PldError(`.${kind} is not allowed when this type of GAL is used`, o[slot]!.line);
  }

  const outputs: OlmcProgram[] = [];
  for (let pin = 14; pin <= 23; pin++) {
    const o = olmcs.get(pin)!;
    if (o.output) {
      outputs.push({
        pin,
        sum: o.output.sum,
        registered: o.output.mode === 'registered',
        activeHigh: o.active === 'high',
        oe: o.oe?.sum,
        line: o.output.line,
        oeLine: o.oe?.line,
      });
    }
    if (o.oe) {
      if (!o.output) throw new PldError('the output must be defined to use .E', o.oe.line);
      if (o.output.mode === 'combinational') throw new PldError("tristate control without previous '.T'", o.oe.line);
    }
  }
  const program: GalProgram = {
    outputs,
    ar: ar?.sum,
    sp: sp?.sum,
    arLine: ar?.line,
    spLine: sp?.line,
    signature: source.signature,
  };
  let fuses: Uint8Array;
  try {
    fuses = programGal22v10(program);
  } catch (e) {
    return galProgramErrorToPld(e);
  }
  if (fuses.length !== FUSE_COUNT) throw new Error('internal error: wrong fuse count');

  const used = new Set<number>();
  for (const eq of source.equations) for (const r of eq.rhs) if (isOlmcPin(r.pin)) used.add(r.pin);
  const infos: PldOlmcInfo[] = [];
  for (const pin of [23, 22, 21, 20, 19, 18, 17, 16, 15, 14]) {
    const o = olmcs.get(pin)!;
    infos.push({
      pin,
      name: source.pins[pin - 1]!.replace(/^\//, ''),
      role: o.output ? 'output' : used.has(pin) ? 'input' : 'unused',
      registered: o.output?.mode === 'registered',
      activeHigh: o.output ? o.active === 'high' : false,
      terms: o.output ? o.output.sum.length : 0,
      tristate: o.output?.mode === 'tristate',
      hasEnable: !!o.oe,
    });
  }
  return {
    source,
    fuses,
    program,
    olmcs: infos,
    jedec: (jopts) => writeGal22v10Jedec(fuses, { style: 'galette', security: opts.security, ...jopts }),
  };
}
