// Every code snippet in the chapters is checked by the kernel.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { run } from './util.ts';
import * as L from '@kernel/untyped/lambda.ts';
import type { CalculusId } from '@kernel/core/calculus.ts';

interface Snippet {
  file: string;
  line: number;
  code: string;
  calculus: CalculusId;
  kind: 'lean' | 'lambda';
  allowErrors: boolean;
  what: string;
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}=(?:"([^"]*)"|\\{\`([\\s\\S]*?)\`\\}|\\{"([^"]*)"\\})`).exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

function extract(file: string, src: string): Snippet[] {
  const out: Snippet[] = [];
  const lineOf = (i: number) => src.slice(0, i).split('\n').length;
  // fenced blocks with `playground`
  for (const m of src.matchAll(/```(\w+)([^\n]*)\n([\s\S]*?)```/g)) {
    const meta = m[2];
    if (!/\bplayground\b/.test(meta) || m[1] === 'lambda') continue;
    const calc = /calculus=(\w+)/.exec(meta)?.[1] ?? 'cic';
    out.push({ file, line: lineOf(m.index!), code: m[3], calculus: calc as CalculusId, kind: 'lean', allowErrors: /\berrors\b/.test(meta), what: 'playground block' });
  }
  // JSX components
  for (const m of src.matchAll(/<(Playground|Exercise|LambdaLab|KernelLab|DerivationView|RecursorView|PositivityLab|CompileView|KernelTrace)\b/g)) {
    // scan to the end of the opening tag, skipping strings and braces
    let i = m.index! + m[0].length;
    let depth = 0;
    let q: string | undefined;
    for (; i < src.length; i++) {
      const c = src[i];
      if (q) {
        if (c === q) q = undefined;
        continue;
      }
      if (c === '`' || (c === '"' && depth === 0)) q = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    const tag = src.slice(m.index! + m[0].length, i);
    const kind = (attr(tag, 'kind') ?? (m[1] === 'LambdaLab' ? 'lambda' : 'lean')) as 'lean' | 'lambda';
    const calc = (attr(tag, 'calculus') ?? 'cic') as CalculusId;
    const allowErrors = /\berrors\b/.test(tag) || m[1] === 'LambdaLab' || m[1] === 'PositivityLab';
    let code = attr(tag, 'code');
    if (m[1] === 'DerivationView') code = `${attr(tag, 'setup') ?? ''}\n#check ${attr(tag, 'term')}`;
    if (code !== undefined && m[1] !== 'LambdaLab') out.push({ file, line: lineOf(m.index!), code, calculus: calc, kind, allowErrors: allowErrors || m[1] === 'Exercise', what: m[1] });
    const sol = attr(tag, 'solution');
    if (sol !== undefined) out.push({ file, line: lineOf(m.index!), code: sol, calculus: calc, kind, allowErrors: false, what: `${m[1]} solution` });
    if (m[1] === 'LambdaLab' && code !== undefined) out.push({ file, line: lineOf(m.index!), code, calculus: calc, kind: 'lambda', allowErrors: false, what: 'LambdaLab (parse only)' });
  }
  return out;
}

const dir = join(__dirname, '../src/content/chapters');
const files = readdirSync(dir).filter((f) => f.endsWith('.mdx')).sort();

describe('chapter snippets', () => {
  for (const f of files) {
    const src = readFileSync(join(dir, f), 'utf8');
    const snippets = extract(f, src);
    if (snippets.length === 0) continue;
    it(f, () => {
      const failures: string[] = [];
      for (const s of snippets) {
        if (s.kind === 'lambda') {
          try {
            L.parseProgram(L.STDLIB + '\n' + s.code);
          } catch (e) {
            failures.push(`${f}:${s.line} (${s.what}) λ parse error: ${(e as Error).message}`);
          }
          continue;
        }
        const r = run(s.code, s.calculus);
        const errs = r.msgs.filter((m) => m.startsWith('error'));
        const sorry = r.msgs.some((m) => m.includes("uses 'sorry'"));
        if (!s.allowErrors && (errs.length > 0 || (s.what.includes('solution') && sorry))) {
          failures.push(`${f}:${s.line} (${s.what}, ${s.calculus}):\n${errs.join('\n')}${sorry ? '\n(uses sorry)' : ''}`);
        }
      }
      if (failures.length) console.log(failures.join('\n\n'));
      expect(failures).toEqual([]);
    });
  }
});
