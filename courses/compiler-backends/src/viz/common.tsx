import { useMemo, useState, type ReactNode } from 'react';
import { exampleById, EXAMPLES } from '../examples';
import type { Func } from '../compiler/ir/ir';
import type { CompileResult, FuncStages, PipelineOptions } from '../compiler/pipeline';
import { tok, type Line } from '../compiler/listing';
import { useCompile } from '../ui/useCompile';
import { Figure } from '../ui/prose';
import { Select } from '../ui/controls';
import { PipelineExplorer, type PipelineProps } from './Pipeline';

/** The pipeline explorer, framed as a wide figure for use in chapters. */
export function Pipeline(p: PipelineProps & { caption?: ReactNode; title?: string }) {
  return (
    <Figure caption={p.caption} title={p.title}>
      <PipelineExplorer {...p} />
    </Figure>
  );
}

export interface ExampleCtx {
  r: CompileResult;
  src: string;
  fnNames: string[];
  fn: string;
  setFn: (f: string) => void;
  ir?: Func;
  fs?: FuncStages;
}

/** Compile a named example (or explicit source) and pick a function in it. */
export function useExample(example: string | undefined, src: string | undefined, fn0: string | undefined, opts: Partial<PipelineOptions> = {}, stage: 'lowered' | 'ssa' | 'optimized' | 'legalized' = 'optimized'): ExampleCtx {
  const source = src ?? exampleById(example ?? 'sum').src;
  const r = useCompile(source, opts);
  const fnNames = r.optimized?.funcs.map((f) => f.name) ?? r.lowered?.funcs.map((f) => f.name) ?? [];
  const [fnSel, setFn] = useState(fn0 ?? '');
  const fn = fnNames.includes(fnSel) ? fnSel : fn0 && fnNames.includes(fn0) ? fn0 : fnNames.find((n) => n !== 'main') ?? fnNames[0] ?? 'main';
  const ir = r[stage]?.funcs.find((f) => f.name === fn);
  const fs = r.funcs.find((f) => f.name === fn);
  return { r, src: source, fnNames, fn, setFn, ir, fs };
}

export function FnPicker({ ctx }: { ctx: ExampleCtx }) {
  if (ctx.fnNames.length < 2) return <span className="pill">@{ctx.fn}</span>;
  return <Select value={ctx.fn} options={ctx.fnNames.map((n) => [n, `@${n}`] as [string, string])} onChange={ctx.setFn} />;
}

export function ExamplePicker({ value, onChange, ids }: { value: string; onChange: (id: string) => void; ids?: string[] }) {
  const list = ids ? EXAMPLES.filter((e) => ids.includes(e.id)) : EXAMPLES;
  return <Select value={value} options={list.map((e) => [e.id, e.title] as [string, string])} onChange={onChange} />;
}

/** Source code as hoverable lines (keys src:N) for side-by-side views. */
export function sourceLines(src: string, only?: [number, number]): Line[] {
  const kw = /\b(fn|let|if|else|while|for|in|return|break|continue|global)\b/;
  return src.replace(/\n$/, '').split('\n').map((text, i) => {
    const n = i + 1;
    const toks = text.split(/(\b(?:fn|let|if|else|while|for|in|return|break|continue|global)\b|\/\/.*$|\b\d+\b)/).filter(Boolean).map((p) =>
      kw.test(p) && /^[a-z]+$/.test(p) ? tok(p, 'kw') : p.startsWith('//') ? tok(p, 'comment') : /^\d+$/.test(p) ? tok(p, 'imm') : tok(p));
    return { kind: 'instr' as const, toks, key: `src:${n}` };
  }).filter((_, i) => !only || (i + 1 >= only[0] && i + 1 <= only[1]));
}

export function useToggle(init = false): [boolean, () => void] {
  const [v, set] = useState(init);
  return [v, () => set((x) => !x)];
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return <span>{label} <b>{value}</b></span>;
}

export function useMemoJSON<T>(f: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(f, [JSON.stringify(deps)]);
}
