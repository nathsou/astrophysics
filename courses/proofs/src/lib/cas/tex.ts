/**
 * Print expressions as TeX (for KaTeX previews of what the learner typed) and as plain text.
 */
import { BINDERS, type Expr, type Rel } from './expr';
import { Rat } from './rational';

const GREEK = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'lambda', 'mu', 'nu', 'xi', 'rho', 'sigma', 'tau', 'phi', 'chi', 'psi', 'omega', 'pi']);
const NAMED_FNS = new Set(['sin', 'cos', 'tan', 'exp', 'ln', 'log', 'gcd', 'max', 'min']);

function symTex(name: string): string {
  const [head, ...rest] = name.split('_');
  const h = GREEK.has(head!) ? (head === 'epsilon' ? '\\varepsilon' : head === 'phi' ? '\\varphi' : `\\${head}`) : head!.length > 1 ? `\\mathit{${head}}` : head!;
  return rest.length ? `${h}_{${rest.join('_')}}` : h;
}

export const REL_TEX: Record<Rel, string> = { '=': '=', '<': '<', '<=': '\\le', '>': '>', '>=': '\\ge', '!=': '\\ne' };

/** Split a product into numerator and denominator factors (negative integer powers go down). */
function splitFraction(e: Expr): { coef: Rat; up: Expr[]; down: Expr[] } {
  const factors = e.k === 'mul' ? e.args : [e];
  let coef = Rat.ONE;
  const up: Expr[] = [];
  const down: Expr[] = [];
  for (const f of factors) {
    if (f.k === 'num') coef = coef.mul(f.v);
    else if (f.k === 'pow' && f.exp.k === 'num' && f.exp.v.sign() < 0) {
      const k = f.exp.v.neg();
      down.push(k.isOne() ? f.base : { k: 'pow', base: f.base, exp: { k: 'num', v: k } });
    } else up.push(f);
  }
  return { coef, up, down };
}

type Ctx = 'top' | 'sum' | 'product' | 'power' | 'base';

export function toTex(e: Expr, ctx: Ctx = 'top'): string {
  switch (e.k) {
    case 'num': {
      const s = e.v.toTex();
      if (e.v.sign() < 0 || !e.v.isInt()) return ctx === 'base' || ctx === 'product' || ctx === 'power' ? `\\left(${s}\\right)` : s;
      return s;
    }
    case 'sym':
      return symTex(e.name);
    case 'add': {
      let out = '';
      e.args.forEach((t, i) => {
        const neg = isNegative(t);
        const body = toTex(neg ? negate(t) : t, 'sum');
        if (i === 0) out = neg ? `-${body}` : body;
        else out += neg ? ` - ${body}` : ` + ${body}`;
      });
      return ctx === 'product' || ctx === 'base' || ctx === 'power' ? `\\left(${out}\\right)` : out;
    }
    case 'mul': {
      const { coef, up, down } = splitFraction(e);
      const sign = coef.sign() < 0 ? '-' : '';
      const c = coef.sign() < 0 ? coef.neg() : coef;
      const upTex = joinFactors(c.isInt() && !c.isOne() ? [{ k: 'num', v: Rat.of(c.n) } as Expr, ...up] : up);
      let body: string;
      if (down.length || !c.isInt()) {
        const numTex = c.isInt() ? upTex || '1' : joinFactors([{ k: 'num', v: Rat.of(c.n) } as Expr, ...up]) || '1';
        const denTex = joinFactors(c.isInt() ? down : [{ k: 'num', v: Rat.of(c.d) } as Expr, ...down], true);
        body = `\\frac{${numTex}}{${denTex}}`;
      } else body = upTex || '1';
      const out = sign + body;
      return sign && (ctx === 'product' || ctx === 'base' || ctx === 'power') ? `\\left(${out}\\right)` : out;
    }
    case 'pow': {
      if (e.exp.k === 'num') {
        const v = e.exp.v;
        if (v.eq(Rat.of(1, 2))) return `\\sqrt{${toTex(e.base)}}`;
        if (v.n === 1n && v.d > 1n) return `\\sqrt[${v.d}]{${toTex(e.base)}}`;
        if (v.sign() < 0) return toTex({ k: 'mul', args: [e] }, ctx);
      }
      const base = toTex(e.base, 'base');
      return `${base}^{${toTex(e.exp)}}`;
    }
    case 'fn':
      return fnTex(e, ctx);
  }
}

function joinFactors(fs: Expr[], den = false): string {
  let out = '';
  let prevNumeric = false;
  fs.forEach((f, i) => {
    const t = toTex(f, fs.length > 1 || !den ? 'product' : 'top');
    const startsNumeric = /^[0-9]/.test(t) || (f.k === 'pow' && f.base.k === 'num');
    if (i > 0) out += prevNumeric && startsNumeric ? ' \\cdot ' : f.k === 'sym' && fs[i - 1]!.k === 'sym' ? ' ' : '';
    out += t;
    prevNumeric = f.k === 'num' || /[0-9]$/.test(t);
  });
  return out;
}

function isNegative(e: Expr): boolean {
  if (e.k === 'num') return e.v.sign() < 0;
  if (e.k === 'mul') return e.args.some((a) => a.k === 'num' && a.v.sign() < 0);
  return false;
}

function negate(e: Expr): Expr {
  if (e.k === 'num') return { k: 'num', v: e.v.neg() };
  if (e.k === 'mul') {
    const args = e.args.map((a) => (a.k === 'num' && a.v.sign() < 0 ? ({ k: 'num', v: a.v.neg() } as Expr) : a)).filter((a) => !(a.k === 'num' && a.v.isOne()));
    return args.length === 1 ? args[0]! : { k: 'mul', args };
  }
  return e;
}

function fnTex(e: Expr & { k: 'fn' }, ctx: Ctx): string {
  const a = e.args.map((x) => toTex(x));
  switch (e.name) {
    case 'pi':
      return '\\pi';
    case 'e':
      return 'e';
    case 'abs':
      return `\\left|${a[0]}\\right|`;
    case 'floor':
      return `\\left\\lfloor ${a[0]}\\right\\rfloor`;
    case 'ceil':
      return `\\left\\lceil ${a[0]}\\right\\rceil`;
    case 'fact': {
      const arg = e.args[0]!;
      const simple = arg.k === 'sym' || (arg.k === 'num' && arg.v.isInt() && arg.v.sign() >= 0);
      return simple ? `${a[0]}!` : `\\left(${a[0]}\\right)!`;
    }
    case 'binom':
      return `\\binom{${a[0]}}{${a[1]}}`;
    case 'mod':
      return `${toTex(e.args[0]!, 'product')} \\bmod ${toTex(e.args[1]!, 'product')}`;
    case 'exp':
      return `e^{${a[0]}}`;
  }
  if (BINDERS.has(e.name)) {
    const op = e.name === 'sum' ? '\\sum' : '\\prod';
    const out = `${op}_{${a[1]}=${a[2]}}^{${a[3]}} ${toTex(e.args[0]!, 'product')}`;
    return ctx === 'product' || ctx === 'base' ? `\\left(${out}\\right)` : out;
  }
  const name = NAMED_FNS.has(e.name) ? `\\${e.name}` : e.name.length > 1 ? `\\operatorname{${e.name}}` : e.name;
  const inner = a.join(', ');
  return /\\frac|\\sum|\\prod/.test(inner) ? `${name}\\left(${inner}\\right)` : `${name}(${inner})`;
}

export function chainTex(exprs: Expr[], rels: Rel[]): string {
  return exprs.map((x, i) => (i ? ` ${REL_TEX[rels[i - 1]!]} ` : '') + toTex(x)).join('');
}

/** Plain-text rendering of numbers for counterexamples: integers stay exact, others get 6 s.f. */
export function fmtNum(x: number): string {
  if (Number.isInteger(x) && Math.abs(x) < 1e15) return String(x);
  if (!Number.isFinite(x)) return String(x);
  return Number(x.toPrecision(6)).toString();
}
