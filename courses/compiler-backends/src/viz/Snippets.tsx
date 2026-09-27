// Small static-but-hoverable code snippets for use inside prose.

import type { ReactNode } from 'react';
import { printFunc, printModule } from '../compiler/ir/print';
import { tok, type Line, type Tok } from '../compiler/listing';
import { CodeView } from '../ui/CodeView';
import { Figure } from '../ui/prose';
import { useCompile } from '../ui/useCompile';
import { exampleById } from '../examples';
import { asmTokens } from './asmtok';
import { sourceLines } from './common';

export function IRView({ example = 'sum', fn, stage = 'optimized', caption, title, opt = 2 }: { example?: string; fn?: string; stage?: 'lowered' | 'ssa' | 'optimized' | 'legalized'; caption?: ReactNode; title?: string; opt?: 0 | 1 | 2 }) {
  const r = useCompile(exampleById(example).src, { opt, run: false, asmOnly: true });
  const m = r[stage];
  const f = fn ? m?.funcs.find((x) => x.name === fn) : undefined;
  if (!m) return <div className="error-box">{r.error?.msg}</div>;
  return (
    <Figure caption={caption} title={title} wide={false}>
      <CodeView lines={f ? printFunc(f) : printModule(m)} notes maxHeight={460} />
    </Figure>
  );
}

export function SourceView({ example = 'sum', caption, title }: { example?: string; caption?: ReactNode; title?: string }) {
  return (
    <Figure caption={caption} title={title} wide={false}>
      <CodeView lines={sourceLines(exampleById(example).src)} gutter="num" />
    </Figure>
  );
}

const IR_OPS = new Set(['add', 'sub', 'mul', 'sdiv', 'srem', 'and', 'or', 'xor', 'shl', 'ashr', 'lshr', 'icmp', 'zext', 'select', 'alloca', 'load', 'store', 'gaddr', 'call', 'phi', 'br', 'condbr', 'ret', 'fn', 'global']);

function irTokens(line: string): Tok[] {
  const out: Tok[] = [];
  const re = /(;.*$|%[\w.]+|@\w+|\b[a-z_][\w.]*\b|-?\d+|\s+|.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const s = m[0];
    if (s.startsWith(';')) out.push(tok(s, 'comment'));
    else if (s.startsWith('%')) out.push(tok(s, 'vreg', `snip:${s}`));
    else if (s.startsWith('@')) out.push(tok(s, 'sym'));
    else if (IR_OPS.has(s)) out.push(tok(s, 'kw', undefined, { kind: 'irop', op: s }));
    else if (/^(eq|ne|slt|sle|sgt|sge)$/.test(s)) out.push(tok(s, 'op', undefined, { kind: 'irop', op: 'icmp', pred: s }));
    else if (/^-?\d+$/.test(s)) out.push(tok(s, 'imm', undefined, { kind: 'imm', value: s }));
    else if (/^[a-z_][\w.]*$/.test(s) && /:\s*$/.test(line.slice(m.index + s.length, m.index + s.length + 1))) out.push(tok(s, 'label'));
    else out.push(tok(s, /^[\w.]+$/.test(s) ? 'label' : 'punct'));
  }
  return out;
}

/** A literal code snippet. lang: kiln | ir | rv64 | aarch64 | x86_64 | text */
export function CodeSnippet({ lang = 'text', code, caption, title }: { lang?: string; code: string; caption?: ReactNode; title?: string }) {
  const src = code.replace(/^\n/, '').replace(/\n\s*$/, '');
  let lines: Line[];
  if (lang === 'kiln') lines = sourceLines(src);
  else if (lang === 'ir') lines = src.split('\n').map((l) => ({ kind: 'instr' as const, toks: irTokens(l) }));
  else if (lang === 'rv64' || lang === 'aarch64' || lang === 'x86_64') {
    lines = src.split('\n').map((l) => {
      const m = /^(\s*)(.*)$/.exec(l)!;
      const body = m[2];
      if (!body) return { kind: 'blank' as const, toks: [] };
      if (/^[\w.$]+:/.test(body)) return { kind: 'label' as const, toks: [tok(body, 'label')] };
      if (body.startsWith('.')) return { kind: 'directive' as const, toks: [tok(m[1] + body, 'dir')] };
      if (body.startsWith('#') || body.startsWith('//') || body.startsWith(';')) return { kind: 'comment' as const, toks: [tok(m[1] + body, 'comment')] };
      const cm = body.search(/\s(#|\/\/|;)\s/);
      const toks = asmTokens(cm >= 0 ? body.slice(0, cm) : body, lang);
      if (cm >= 0) toks.push(tok(body.slice(cm), 'comment'));
      return { kind: 'instr' as const, toks: [tok(m[1]), ...toks] };
    });
  } else lines = src.split('\n').map((l) => ({ kind: 'instr' as const, toks: [tok(l)] }));
  return (
    <Figure caption={caption} title={title} wide={false}>
      <CodeView lines={lines} target={['rv64', 'aarch64', 'x86_64'].includes(lang) ? lang : undefined} />
    </Figure>
  );
}

export const AsmSnippet = ({ target = 'rv64', code, caption, title }: { target?: string; code: string; caption?: ReactNode; title?: string }) => <CodeSnippet lang={target} code={code} caption={caption} title={title} />;
