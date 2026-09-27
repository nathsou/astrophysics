/**
 * A tiny expression language compiled to course-library tensors, for the graph visualiser.
 *   expr   := term (('+' | '-') term)*
 *   term   := factor (('*' | '/') factor)*
 *   factor := unary ('^' number)?
 *   unary  := '-' unary | call | atom
 *   call   := name '(' expr ')'        with name ∈ tanh, exp, log, relu, sigmoid, sqrt
 *   atom   := number | variable | '(' expr ')'
 */
import { Tensor } from '@lm/core/tensor';

type Tok = { kind: 'num' | 'id' | 'op'; text: string };
const FUNCS = new Set(['tanh', 'exp', 'log', 'relu', 'sigmoid', 'sqrt']);

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_]\w*)|(\*\*|[-+*/^()]))/y;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while (re.lastIndex < src.length && (m = re.exec(src))) {
    if (m[1]) out.push({ kind: 'num', text: m[1] });
    else if (m[2]) out.push({ kind: 'id', text: m[2] });
    else if (m[3]) out.push({ kind: 'op', text: m[3] === '**' ? '^' : m[3] });
  }
  if (src.slice(re.lastIndex).trim()) throw new Error(`Unexpected “${src.slice(re.lastIndex).trim()[0]}”`);
  return out;
}

export interface Compiled {
  output: Tensor;
  /** Leaf tensors for each variable name (requiresGrad). */
  inputs: Map<string, Tensor>;
}

/** Compile `src` with the given variable values into a graph of scalar tensors. */
export function compile(src: string, values: Record<string, number>): Compiled {
  const toks = lex(src);
  let i = 0;
  const inputs = new Map<string, Tensor>();
  const peek = () => toks[i];
  const eat = (text?: string) => {
    const t = toks[i++];
    if (!t || (text && t.text !== text)) throw new Error(text ? `Expected “${text}”` : 'Unexpected end of expression');
    return t;
  };
  const labelled = (t: Tensor, label: string) => ((t.label = label), t.retainGrad());

  function atom(): Tensor {
    const t = peek();
    if (!t) throw new Error('Unexpected end of expression');
    if (t.text === '(') {
      eat('(');
      const e = expr();
      eat(')');
      return e;
    }
    if (t.kind === 'num') {
      eat();
      const c = Tensor.scalar(Number(t.text));
      c.label = t.text;
      return c;
    }
    if (t.kind === 'id') {
      eat();
      if (FUNCS.has(t.text)) {
        eat('(');
        const arg = expr();
        eat(')');
        const f = t.text as 'tanh' | 'exp' | 'log' | 'relu' | 'sigmoid' | 'sqrt';
        return labelled(arg[f](), f);
      }
      let v = inputs.get(t.text);
      if (!v) {
        if (!(t.text in values)) throw new Error(`Unknown variable “${t.text}”`);
        v = Tensor.from([values[t.text]!], []).requiresGrad_();
        v.label = t.text;
        inputs.set(t.text, v);
      }
      return v;
    }
    throw new Error(`Unexpected “${t.text}”`);
  }
  function unary(): Tensor {
    if (peek()?.text === '-') {
      eat('-');
      return labelled(unary().neg(), 'neg');
    }
    return atom();
  }
  function factor(): Tensor {
    let b = unary();
    if (peek()?.text === '^') {
      eat('^');
      const t = eat();
      if (t.kind !== 'num') throw new Error('Exponent must be a number');
      b = labelled(b.pow(Number(t.text)), `^${t.text}`);
    }
    return b;
  }
  function term(): Tensor {
    let a = factor();
    while (peek()?.text === '*' || peek()?.text === '/') {
      const op = eat().text;
      const b = factor();
      a = labelled(op === '*' ? a.mul(b) : a.div(b), op === '*' ? '×' : '÷');
    }
    return a;
  }
  function expr(): Tensor {
    let a = term();
    while (peek()?.text === '+' || peek()?.text === '-') {
      const op = eat().text;
      const b = term();
      a = labelled(op === '+' ? a.add(b) : a.sub(b), op === '+' ? '+' : '−');
    }
    return a;
  }

  const output = expr();
  if (i < toks.length) throw new Error(`Unexpected “${toks[i]!.text}”`);
  return { output, inputs };
}

/** Variables mentioned in an expression (excluding function names). */
export function variables(src: string): string[] {
  try {
    return [...new Set(lex(src).filter((t) => t.kind === 'id' && !FUNCS.has(t.text)).map((t) => t.text))];
  } catch {
    return [];
  }
}
