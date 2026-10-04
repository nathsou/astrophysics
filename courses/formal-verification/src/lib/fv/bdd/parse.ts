/**
 * Propositional formulas as people type them, for the BDD lab: names, `true`, `false`, `!` (or `~`, `¬`), `&` (`&&`,
 * `∧`), `|` (`||`, `∨`), `^` (xor, `⊕`), `->` (`=>`, `→`), `<->` (`<=>`, `↔`) and parentheses. Precedence from
 * tightest: not, and, xor, or, implies (right-associative), iff.
 */
import type { Formula } from '../sat/encode';

export class ParseError extends Error {
  constructor(
    message: string,
    readonly at: number,
  ) {
    super(message);
  }
}

export interface Parsed {
  formula: Formula;
  /** Variable names in order of first appearance; variable i + 1 is names[i]. */
  names: string[];
}

export function parseFormula(text: string, known: string[] = []): Parsed {
  const names = [...known];
  const index = (n: string) => {
    let i = names.indexOf(n);
    if (i < 0) i = names.push(n) - 1;
    return i + 1;
  };
  const toks: { t: string; at: number }[] = [];
  const re = /\s*(<->|<=>|->|=>|&&|\|\||[A-Za-z_][A-Za-z0-9_']*|[()!~¬&|^∧∨⊕→↔])/y;
  let pos = 0;
  while (pos < text.length) {
    if (/^\s*$/.test(text.slice(pos))) break;
    re.lastIndex = pos;
    const m = re.exec(text);
    if (!m) throw new ParseError(`Unexpected “${text.slice(pos).trim()[0]}”.`, pos);
    toks.push({ t: m[1]!, at: pos + m[0].length - m[1]!.length });
    pos = re.lastIndex;
  }
  let i = 0;
  const peek = () => toks[i]?.t;
  const is = (...xs: string[]) => xs.includes(peek() ?? '');
  const iff = (): Formula => {
    let l = imp();
    while (is('<->', '<=>', '↔')) {
      i++;
      l = { k: 'iff', a: l, b: imp() };
    }
    return l;
  };
  const imp = (): Formula => {
    const l = or();
    if (is('->', '=>', '→')) {
      i++;
      return { k: 'imp', a: l, b: imp() };
    }
    return l;
  };
  const or = (): Formula => {
    const xs = [xor()];
    while (is('|', '||', '∨')) {
      i++;
      xs.push(xor());
    }
    return xs.length === 1 ? xs[0]! : { k: 'or', args: xs };
  };
  const xor = (): Formula => {
    let l = and();
    while (is('^', '⊕')) {
      i++;
      l = { k: 'xor', a: l, b: and() };
    }
    return l;
  };
  const and = (): Formula => {
    const xs = [not()];
    while (is('&', '&&', '∧')) {
      i++;
      xs.push(not());
    }
    return xs.length === 1 ? xs[0]! : { k: 'and', args: xs };
  };
  const not = (): Formula => {
    if (is('!', '~', '¬')) {
      i++;
      return { k: 'not', a: not() };
    }
    return atom();
  };
  const atom = (): Formula => {
    const t = toks[i];
    if (!t) throw new ParseError('The formula ends too early.', text.length);
    if (t.t === '(') {
      i++;
      const f = iff();
      if (peek() !== ')') throw new ParseError('Expected “)”.', toks[i]?.at ?? text.length);
      i++;
      return f;
    }
    if (/^[A-Za-z_]/.test(t.t)) {
      i++;
      if (t.t === 'true') return { k: 'const', value: true };
      if (t.t === 'false') return { k: 'const', value: false };
      return { k: 'var', v: index(t.t) };
    }
    throw new ParseError(`Unexpected “${t.t}”.`, t.at);
  };
  if (!toks.length) throw new ParseError('Type a formula.', 0);
  const formula = iff();
  if (i < toks.length) throw new ParseError(`Unexpected “${toks[i]!.t}”.`, toks[i]!.at);
  return { formula, names };
}
