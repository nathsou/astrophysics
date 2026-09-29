// Show how the kernel represents a term: locally nameless core expressions.

import { For, Show, createMemo, createSignal } from 'solid-js';
import type { Expr } from '@kernel/core/expr.ts';
import { levelToString } from '@kernel/core/level.ts';
import { envFor, check } from '../../app/kernel.ts';
import type { CalculusId } from '@kernel/core/calculus.ts';
import { Term } from '../Term.tsx';

function Node(props: { e: Expr; depth: number; names: string[] }) {
  const [open, setOpen] = createSignal(props.depth < 6);
  const e = props.e;
  const kids = (): { label: string; e: Expr; names: string[] }[] => {
    switch (e.k) {
      case 'app':
        return [
          { label: 'fn', e: e.fn, names: props.names },
          { label: 'arg', e: e.arg, names: props.names },
        ];
      case 'lam':
      case 'pi':
        return [
          { label: 'type', e: e.type, names: props.names },
          { label: 'body', e: e.body, names: [e.name, ...props.names] },
        ];
      case 'let':
        return [
          { label: 'type', e: e.type, names: props.names },
          { label: 'value', e: e.value, names: props.names },
          { label: 'body', e: e.body, names: [e.name, ...props.names] },
        ];
      default:
        return [];
    }
  };
  const head = () => {
    switch (e.k) {
      case 'bvar':
        return (
          <>
            <span class="ct-k">bvar</span> <b>{e.i}</b>
            <span class="muted"> (refers to “{props.names[e.i] ?? '?'}”)</span>
          </>
        );
      case 'fvar':
        return (
          <>
            <span class="ct-k">fvar</span> #{e.id}
          </>
        );
      case 'sort':
        return (
          <>
            <span class="ct-k">sort</span> {levelToString(e.level)}
          </>
        );
      case 'const':
        return (
          <>
            <span class="ct-k">const</span> <b>{e.name}</b>
            <Show when={e.levels.length}>
              <span class="muted">.{'{'}{e.levels.map((l) => levelToString(l)).join(', ')}{'}'}</span>
            </Show>
          </>
        );
      case 'app':
        return <span class="ct-k">app</span>;
      case 'lam':
      case 'pi':
      case 'let':
        return (
          <>
            <span class="ct-k">{e.k}</span> <span class="muted">name hint</span> “{e.name}”
            <Show when={e.k !== 'let' && (e as { binfo: string }).binfo !== 'default'}>
              <span class="muted"> ({(e as { binfo: string }).binfo})</span>
            </Show>
          </>
        );
      default:
        return <span>{e.k}</span>;
    }
  };
  return (
    <div class="ct-node">
      <div class="ct-head" onClick={() => setOpen(!open())}>
        <Show when={kids().length} fallback={<span class="ct-tw" />}>
          <span class="ct-tw">{open() ? '▾' : '▸'}</span>
        </Show>
        {head()}
        <Show when={e.lb > 0}>
          <span class="badge" style={{ 'margin-left': '0.4rem' }} title="loose bound variables: this subterm refers to binders outside it">
            loose &lt; {e.lb}
          </span>
        </Show>
      </div>
      <Show when={open() && kids().length}>
        <div class="ct-kids">
          <For each={kids()}>
            {(k) => (
              <div class="ct-kid">
                <span class="ct-label">{k.label}</span>
                <Node e={k.e} depth={props.depth + 1} names={k.names} />
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export function CoreTermView(props: { code: string; calculus?: string; title?: string }) {
  const [src, setSrc] = createSignal(props.code);
  const r = createMemo(() => {
    const env = envFor((props.calculus as CalculusId) ?? 'cic');
    const res = check(`#check ${src()}`, env);
    const o = res.results[0]?.output;
    const err = res.messages.find((m) => m.severity === 'error');
    return { env: res.env, expr: o?.k === 'check' ? o.expr : undefined, err: err ? 'the term does not elaborate' : undefined };
  });
  return (
    <div class="widget wide">
      <div class="widget-head">
        <span class="widget-title">{props.title ?? 'How the kernel stores a term'}</span>
        <input class="input grow" value={src()} onInput={(e) => setSrc(e.currentTarget.value)} spellcheck={false} />
      </div>
      <div class="widget-body">
        <Show when={r().expr} fallback={<div class="muted sans">{r().err ?? '…'}</div>}>
          <div style={{ 'margin-bottom': '0.6rem' }}>
            <Term env={r().env} expr={r().expr!} />
          </div>
          <div class="ct-tree mono">
            <Node e={r().expr!} depth={0} names={[]} />
          </div>
        </Show>
      </div>
    </div>
  );
}
