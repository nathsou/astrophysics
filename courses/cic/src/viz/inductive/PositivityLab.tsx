// Occurrences of an inductive type in its constructors, classified by polarity.

import { For, Show, createMemo, createSignal } from 'solid-js';
import { envFor, check } from '../../app/kernel.ts';
import { Editor } from '../Editor.tsx';
import { Term } from '../Term.tsx';
import { TypeChecker } from '../../kernel/core/typechecker.ts';
import { classifyOccurrences, type OccurrenceKind } from '../../kernel/core/inductive.ts';
import { LocalContext, type Decl } from '../../kernel/core/env.ts';
import { formatMsg } from '../../kernel/format.ts';
import type { Expr } from '../../kernel/core/expr.ts';

const kindInfo: Record<OccurrenceKind, { label: string; cls: string; blurb: string }> = {
  strict: { label: 'strictly positive', cls: 'occ-strict', blurb: 'allowed: the field is an element of the type (possibly behind arguments that do not mention it)' },
  nonstrict: { label: 'positive, not strict', cls: 'occ-nonstrict', blurb: 'rejected: to the left of an arrow an even number of times' },
  negative: { label: 'negative', cls: 'occ-negative', blurb: 'rejected: to the left of an arrow — the constructor consumes elements of the type' },
  nested: { label: 'nested', cls: 'occ-nested', blurb: 'as an argument of another type former (e.g. List T): Lean accepts these by translation, the course kernel does not' },
  index: { label: 'in an index', cls: 'occ-negative', blurb: 'rejected: the type may not appear in the indices of a recursive occurrence' },
};

interface FieldRow {
  ctor: string;
  name: string;
  type: Expr;
  lctx: LocalContext;
  occ: { path: number[]; kind: OccurrenceKind }[];
}

export function PositivityLab(props: { code: string; title?: string }) {
  const [src, setSrc] = createSignal(props.code.trim());
  const analysis = createMemo(() => {
    const base = envFor('cic');
    const verdict = check(src(), base);
    const errs = verdict.messages.filter((m) => m.severity === 'error');
    const relaxed = check('set_option kernel.positivity false\n' + src(), base);
    const env = relaxed.env;
    const names = relaxed.results.flatMap((r) => (r.output?.k === 'decl' ? r.output.names : []));
    const inds = names.map((n) => env.get(n)).filter((d): d is Extract<Decl, { kind: 'inductive' }> => d?.kind === 'inductive');
    const rows: FieldRow[] = [];
    for (const ind of inds) {
      const set = new Set(ind.all);
      for (const c of ind.ctors) {
        const cd = env.get(c) as Extract<Decl, { kind: 'ctor' }>;
        const tc = new TypeChecker(env);
        const { fvars } = tc.openPis(cd.type);
        fvars.slice(cd.numParams).forEach((fv) => {
          const d = tc.lctx.get(fv.id)!;
          const before = tc.lctx.decls.slice(0, tc.lctx.decls.findIndex((x) => x.id === fv.id)).reduce((l, x) => l.push(x), LocalContext.empty);
          rows.push({ ctor: c, name: d.name, type: d.type, lctx: before, occ: classifyOccurrences(d.type, set, cd.numParams) });
        });
      }
    }
    return { rows, env, errs, verdictEnv: verdict.env, relaxedErrs: relaxed.messages.filter((m) => m.severity === 'error') };
  });
  const accepted = () => analysis().errs.length === 0;
  return (
    <div class="widget wide poslab">
      <div class="widget-head">
        <span class="widget-title">{props.title ?? 'Positivity checker'}</span>
        <span class="grow" />
        <Show when={analysis().relaxedErrs.length === 0}>
          <span class={`badge ${accepted() ? 'ok' : 'err'}`}>{accepted() ? '✓ accepted by the kernel' : '✗ rejected by the kernel'}</span>
        </Show>
      </div>
      <div style={{ 'border-bottom': '1px solid var(--rule)' }}>
        <Editor value={src()} onChange={setSrc} minHeight="3rem" maxHeight="12rem" lineNumbers={false} />
      </div>
      <div class="widget-body">
        <Show when={analysis().relaxedErrs.length > 0}>
          <div class="msg error sans">{formatMsg(analysis().env, analysis().relaxedErrs[0].msg)}</div>
        </Show>
        <table class="pos-table sans">
          <tbody>
            <For each={analysis().rows}>
              {(r) => (
                <tr>
                  <td class="muted">{r.ctor.split('.').pop()}</td>
                  <td class="mono">{r.name}</td>
                  <td>
                    <Term env={analysis().env} expr={r.type} lctx={r.lctx} highlights={r.occ.map((o) => ({ path: o.path, cls: kindInfo[o.kind].cls }))} />
                  </td>
                  <td>
                    <Show when={r.occ.length} fallback={<span class="muted">not recursive</span>}>
                      <For each={[...new Set(r.occ.map((o) => o.kind))]}>{(k) => <span class={`badge pos-${k}`}>{kindInfo[k].label}</span>}</For>
                    </Show>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <Show when={!accepted() && analysis().relaxedErrs.length === 0}>
          <div class="msg error sans" style={{ 'margin-top': '0.6rem' }}>
            <span class="msg-icon">✗</span>
            <div class="msg-body msg-text">{formatMsg(analysis().verdictEnv, analysis().errs[0].msg)}</div>
          </div>
        </Show>
      </div>
      <div class="widget-foot">
        <div class="legend">
          <span style={{ color: 'var(--ok)' }}>strictly positive (allowed)</span>
          <span style={{ color: 'var(--warn)' }}>positive but not strict / nested</span>
          <span style={{ color: 'var(--err)' }}>negative</span>
        </div>
      </div>
    </div>
  );
}
