// Every code snippet in the chapters is checked by the kernel.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { run } from './util.ts';
import { judge, parseF, theoremDecl } from '../src/engines/props.ts';

interface Snippet {
  line: number;
  code: string;
  allowErrors: boolean;
  what: string;
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}=(?:"([^"]*)"|\\{\`([\\s\\S]*?)\`\\}|\\{"([^"]*)"\\})`).exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

export function extract(src: string): Snippet[] {
  const out: Snippet[] = [];
  const lineOf = (i: number) => src.slice(0, i).split('\n').length;
  // the code blocks of a chapter form one file (see build/mdx-plugins.ts)
  let context = '';
  for (const m of src.matchAll(/```(\w+)([^\n]*)\n([\s\S]*?)```/g)) {
    const meta = m[2];
    if (m[1] !== 'lean' || /\bnocheck\b/.test(meta)) continue;
    const alone = /\balone\b/.test(meta);
    const errors = /\berrors\b/.test(meta);
    out.push({ line: lineOf(m.index!), code: (alone ? '' : context) + m[3], allowErrors: errors, what: 'code block' });
    if (!alone && !errors) context += m[3] + '\n\n';
  }
  for (const m of src.matchAll(/<(Playground|Exercise|ObligationGrid|[A-Z][A-Za-z]+Lab|[A-Z][A-Za-z]+View)\b/g)) {
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
    const setup = attr(tag, 'setup') ?? '';
    const code = attr(tag, 'code');
    const allowErrors = /\berrors\b/.test(tag) || m[1] === 'Exercise';
    if (code !== undefined) out.push({ line: lineOf(m.index!), code: setup + '\n' + code, allowErrors, what: m[1] });
    const sol = attr(tag, 'solution');
    if (sol !== undefined) out.push({ line: lineOf(m.index!), code: setup + '\n' + sol, allowErrors: false, what: `${m[1]} solution` });
  }
  // the provable presets of the provability oracle come with proof terms: check them
  for (const m of src.matchAll(/<PropOracle\b[^>]*presets="([^"]*)"/g)) {
    const decls = m[1].split(';').flatMap((p, i) => {
      const f = parseF(p);
      const v = judge(f);
      return v.kind === 'provable' ? [theoremDecl(f, v.term, `oracle${i}`)] : [];
    });
    out.push({ line: lineOf(m.index!), code: decls.join('\n\n'), allowErrors: false, what: 'PropOracle proofs' });
  }
  return out;
}

const dir = join(__dirname, '../src/content/chapters');
const files = readdirSync(dir).filter((f) => f.endsWith('.mdx')).sort();

describe('chapter snippets', () => {
  for (const f of files) {
    const src = readFileSync(join(dir, f), 'utf8');
    const snippets = extract(src);
    if (snippets.length === 0) continue;
    it(f, () => {
      const failures: string[] = [];
      for (const s of snippets) {
        const r = run(s.code);
        const errs = r.msgs.filter((m) => m.startsWith('error'));
        const sorry = r.msgs.some((m) => m.includes("uses 'sorry'"));
        if (!s.allowErrors && (errs.length > 0 || (s.what.includes('solution') && sorry))) {
          failures.push(`${f}:${s.line} (${s.what}):\n${errs.join('\n')}${sorry ? '\n(uses sorry)' : ''}`);
        }
      }
      if (failures.length) console.log(failures.join('\n\n'));
      expect(failures).toEqual([]);
    });
  }
});
