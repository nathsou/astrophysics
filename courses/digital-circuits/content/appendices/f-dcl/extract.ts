/**
 * Extracts the diagnostics that DCL's front end can emit from its own source text, so that Appendix F's table
 * can be generated and checked (Node only: it reads files). Every call of the checker's `error`, `warning` and
 * `err` helpers, and the parser's and lexer's error calls, gives a code and a message template.
 */
import { readFileSync } from 'node:fs';

export interface Found {
  file: string;
  severity: 'error' | 'warning';
  code: string;
  /** Message templates, with `‹…›` for the parts that depend on the program. */
  messages: string[];
}

const FILES = ['check.ts', 'parser.ts', 'lexer.ts'];
const dir = new URL('../../../src/lib/hdl/', import.meta.url);

function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === "'" || c === '"' || c === '`') {
      const q = c;
      cur += c;
      i++;
      while (i < s.length && s[i] !== q) {
        if (s[i] === '\\') cur += s[i++];
        if (q === '`' && s[i] === '$' && s[i + 1] === '{') {
          let d = 0;
          while (i < s.length) {
            cur += s[i];
            if (s[i] === '{') d++;
            if (s[i] === '}' && --d === 0) break;
            i++;
          }
          i++;
          continue;
        }
        cur += s[i++];
      }
      cur += q;
      continue;
    }
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function callArgs(t: string, at: number): string {
  const open = t.indexOf('(', at);
  let depth = 0;
  let j = open;
  for (; j < t.length; j++) {
    const c = t[j]!;
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) break;
    else if (c === "'" || c === '"' || c === '`') {
      const q = c;
      j++;
      while (j < t.length && t[j] !== q) {
        if (t[j] === '\\') j++;
        if (q === '`' && t[j] === '$' && t[j + 1] === '{') {
          let d = 0;
          while (j < t.length) {
            if (t[j] === '{') d++;
            if (t[j] === '}' && --d === 0) break;
            j++;
          }
        }
        j++;
      }
    }
  }
  return t.slice(open + 1, j);
}

const isLiteral = (s: string) => /^(['"`])[\s\S]*\1$/.test(s.trim());

/** The parts of a message expression that are literals: itself, or both branches of a conditional. */
function literals(arg: string): string[] {
  const a = arg.trim();
  if (isLiteral(a)) return [a];
  const cond = /^[^?]*\?\s*((['"`])[\s\S]*?\2)\s*:\s*((['"`])[\s\S]*\4)$/.exec(a);
  if (cond) return [cond[1]!, cond[3]!];
  return [];
}

function placeholder(expr: string): string {
  const e = expr.trim();
  if (/MAX_WIDTH|MAX_UNROLL/.test(e)) return '65536';
  const t = /^[^?]*\?\s*'([^']*)'\s*:\s*'([^']*)'$/.exec(e);
  if (t) {
    const [, a, b] = t as unknown as [string, string, string];
    if (a === '') return `(${b})`;
    if (b === `${a}s`) return `${a}(s)`;
    return `‹${a} or ${b}›`;
  }
  if (/\?\s*'[^']*'\s*:\s*n\b/.test(e)) return '‹n›';
  if (/typeToString/.test(e)) return '‹type›';
  if (/listWords|\.map\(|\.join\(/.test(e)) return '‹list›';
  if (/describe\(/.test(e)) return '‹token›';
  if (/context/.test(e)) return '‹context›';
  if (/\.length/.test(e)) return '‹n›';
  const last = /([A-Za-z_]+)(?:\[[^\]]*\])?\s*$/.exec(e)?.[1] ?? 'value';
  const map: Record<string, string> = { name: 'name', f: 'name', m: 'method', op: 'op', iw: 'N', v: 'value', i: 'i', n: 'n', ch: 'char', bad: 'digit', digits: 'digit', selText: 'value', style: 'style', what: 'what', text: 'text', kind: 'kind', clock: 'clock', missing: 'fields', out: 'name' };
  return `‹${map[last] ?? last}›`;
}

function template(lit: string): string {
  const body = lit.slice(1, -1);
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (c === '\\') {
      out += body[++i]!;
      continue;
    }
    if (c === '$' && body[i + 1] === '{') {
      let d = 0;
      let j = i + 1;
      for (; j < body.length; j++) {
        if (body[j] === '{') d++;
        if (body[j] === '}' && --d === 0) break;
      }
      out += placeholder(body.slice(i + 2, j));
      i = j;
      continue;
    }
    out += c;
  }
  return out;
}

export function extract(): Found[] {
  const found = new Map<string, Found>();
  const add = (file: string, severity: 'error' | 'warning', code: string, lits: string[]) => {
    const key = `${severity}:${code}`;
    let f = found.get(key);
    if (!f) found.set(key, (f = { file, severity, code, messages: [] }));
    for (const l of lits) {
      const m = template(l);
      if (!f.messages.includes(m)) f.messages.push(m);
    }
  };
  for (const file of FILES) {
    const t = readFileSync(new URL(file, dir), 'utf8');
    const re = /(\.(error|warning)|\berr)\(\s*'([a-z-]+)'/g;
    for (let m = re.exec(t); m; m = re.exec(t)) {
      const args = splitArgs(callArgs(t, m.index));
      add(file, m[2] === 'warning' ? 'warning' : 'error', args[0]!.slice(1, -1), literals(args[1] ?? ''));
    }
    if (file === 'parser.ts') {
      const re2 = /this\.(error|fail)\(/g;
      for (let m = re2.exec(t); m; m = re2.exec(t)) {
        const args = splitArgs(callArgs(t, m.index));
        const lits = literals(args[0] ?? '');
        if (lits.length) add(file, 'error', 'syntax', lits);
      }
    }
    if (file === 'lexer.ts') {
      const re3 = /\berr\(([^\n]*)\)/g;
      for (let m = re3.exec(t); m; m = re3.exec(t)) {
        const args = splitArgs(m[1]!);
        if (args.length >= 3 && /^(i|start|digitsStart)/.test(args[0]!)) add(file, 'error', 'syntax', literals(args[2]!));
      }
    }
  }
  return [...found.values()].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}

/** The constants the templates above refer to, read from the checker's source. */
export function limits(): { maxWidth: number; maxUnroll: number } {
  const t = readFileSync(new URL('check.ts', dir), 'utf8');
  const w = /const MAX_WIDTH = 1 << (\d+);/.exec(t);
  const u = /const MAX_UNROLL = (\d+);/.exec(t);
  return { maxWidth: w ? 1 << Number(w[1]) : NaN, maxUnroll: u ? Number(u[1]) : NaN };
}
