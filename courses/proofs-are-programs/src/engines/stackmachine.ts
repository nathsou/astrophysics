// A JavaScript mirror of chapter 17's language, compiler and stack machine, for the
// simulation widget. (The chapter's definitions in the course language are the real ones;
// this copy only draws pictures, and the tests check that the two agree on examples.)

export type Ex =
  | { k: 'num'; n: number; span: [number, number] }
  | { k: 'var'; x: number; name: string; span: [number, number] }
  | { k: 'bin'; op: '+' | '-' | '*'; a: Ex; b: Ex; span: [number, number] };

export type Instr = { k: 'push'; n: number } | { k: 'load'; x: number; name: string } | { k: 'add' } | { k: 'sub' } | { k: 'mul' };

export const VARS = ['x', 'y', 'z'];

export function parseEx(src: string): Ex {
  const toks: { t: string; from: number; to: number }[] = [];
  const re = /\s*(\d+|[a-z]\w*|[-+*()])/gy;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(src))) {
    const from = m.index + m[0].length - m[1].length;
    toks.push({ t: m[1], from, to: from + m[1].length });
    last = re.lastIndex;
  }
  if (src.slice(last).trim()) throw new Error(`unexpected '${src.slice(last).trim()[0]}'`);
  let i = 0;
  const expr = (): Ex => {
    let a = term();
    while (toks[i] && (toks[i].t === '+' || toks[i].t === '-')) {
      const op = toks[i++].t as '+' | '-';
      const b = term();
      a = { k: 'bin', op, a, b, span: [a.span[0], b.span[1]] };
    }
    return a;
  };
  const term = (): Ex => {
    let a = atom();
    while (toks[i] && toks[i].t === '*') {
      i++;
      const b = atom();
      a = { k: 'bin', op: '*', a, b, span: [a.span[0], b.span[1]] };
    }
    return a;
  };
  const atom = (): Ex => {
    const t = toks[i++];
    if (!t) throw new Error('unexpected end of input');
    if (t.t === '(') {
      const e = expr();
      const c = toks[i++];
      if (!c || c.t !== ')') throw new Error('expected )');
      return { ...e, span: [t.from, c.to] };
    }
    if (/^\d+$/.test(t.t)) return { k: 'num', n: Number(t.t), span: [t.from, t.to] };
    const x = VARS.indexOf(t.t);
    if (x < 0) throw new Error(`unknown variable '${t.t}' (use x, y or z)`);
    return { k: 'var', x, name: t.t, span: [t.from, t.to] };
  };
  const e = expr();
  if (i < toks.length) throw new Error(`unexpected '${toks[i].t}'`);
  return e;
}

export function evalEx(env: number[], e: Ex): number {
  switch (e.k) {
    case 'num':
      return e.n;
    case 'var':
      return env[e.x] ?? 0;
    case 'bin': {
      const a = evalEx(env, e.a);
      const b = evalEx(env, e.b);
      return e.op === '+' ? a + b : e.op === '*' ? a * b : Math.max(0, a - b);
    }
  }
}

/** compile, remembering which subexpression each instruction comes from */
export function compileEx(e: Ex, buggy = false): { ins: Instr; from: Ex }[] {
  switch (e.k) {
    case 'num':
      return [{ ins: { k: 'push', n: e.n }, from: e }];
    case 'var':
      return [{ ins: { k: 'load', x: e.x, name: e.name }, from: e }];
    case 'bin': {
      const op: Instr = e.op === '+' ? { k: 'add' } : e.op === '-' ? { k: 'sub' } : { k: 'mul' };
      const [first, second] = buggy && e.op === '-' ? [e.b, e.a] : [e.a, e.b];
      return [...compileEx(first, buggy), ...compileEx(second, buggy), { ins: op, from: e }];
    }
  }
}

export interface Frame {
  /** instructions executed so far */
  pc: number;
  /** the stack, top first, each value with the subexpression it is the value of */
  stack: { v: number; from?: Ex }[];
}

/** run the machine, recording the state before each instruction and at the end */
export function trace(env: number[], code: { ins: Instr; from: Ex }[]): Frame[] {
  const frames: Frame[] = [];
  let stack: Frame['stack'] = [];
  for (let pc = 0; pc <= code.length; pc++) {
    frames.push({ pc, stack });
    if (pc === code.length) break;
    const { ins, from } = code[pc];
    switch (ins.k) {
      case 'push':
        stack = [{ v: ins.n, from }, ...stack];
        break;
      case 'load':
        stack = [{ v: env[ins.x] ?? 0, from }, ...stack];
        break;
      default: {
        const [b, a, ...rest] = stack;
        if (!a || !b) {
          stack = rest;
          break;
        }
        const v = ins.k === 'add' ? a.v + b.v : ins.k === 'mul' ? a.v * b.v : Math.max(0, a.v - b.v);
        stack = [{ v, from }, ...rest];
      }
    }
  }
  return frames;
}

export function showInstr(i: Instr): string {
  switch (i.k) {
    case 'push':
      return `push ${i.n}`;
    case 'load':
      return `load ${i.x}   -- ${i.name}`;
    default:
      return i.k;
  }
}
